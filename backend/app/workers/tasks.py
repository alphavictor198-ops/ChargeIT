"""
Celery background tasks for GatiCharge.
"""
import asyncio
from loguru import logger
from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.tasks.sync_stations", bind=True, max_retries=3)
def sync_stations(self):
    """
    Fetch latest charging station data from Open Charge Map
    and upsert into the database.
    Runs every 30 minutes via Celery Beat.
    """
    try:
        from app.services.external_apis import OpenChargeMapService
        from app.core.database import AsyncSessionLocal
        from app.models.models import Station

        async def _run():
            svc = OpenChargeMapService()
            # Major Indian cities
            cities = [
                (28.6139, 77.2090, "Delhi"),
                (19.0760, 72.8777, "Mumbai"),
                (12.9716, 77.5946, "Bangalore"),
                (17.3850, 78.4867, "Hyderabad"),
                (22.5726, 88.3639, "Kolkata"),
            ]

            async with AsyncSessionLocal() as db:
                from sqlalchemy import select
                for lat, lng, city in cities:
                    try:
                        stations = await svc.get_nearby_stations(lat, lng, radius_km=25, limit=30)
                        for st in stations:
                            existing = await db.execute(
                                select(Station).where(Station.external_id == st["external_id"])
                            )
                            if not existing.scalar_one_or_none():
                                s = Station(**{k: v for k, v in st.items() if hasattr(Station, k)})
                                db.add(s)
                        await db.commit()
                        logger.info(f"Synced {len(stations)} stations for {city}")
                    except Exception as e:
                        logger.error(f"Failed to sync {city}: {e}")

        asyncio.get_event_loop().run_until_complete(_run())
    except Exception as exc:
        logger.error(f"sync_stations failed: {exc}")
        self.retry(exc=exc, countdown=300)


@celery_app.task(name="app.workers.tasks.update_trust_scores")
def update_trust_scores():
    """
    Recompute Bayesian trust scores for all stations.
    Runs every hour.
    """
    async def _run():
        from app.core.database import AsyncSessionLocal
        from app.models.models import Station, UserReport, IssueType
        from app.algorithms.trust_layer import score_from_reports
        from sqlalchemy import select, func

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Station))
            stations = result.scalars().all()

            negative_types = {IssueType.charger_offline, IssueType.wrong_availability}

            for station in stations:
                reports_result = await db.execute(
                    select(UserReport).where(UserReport.station_id == station.id)
                )
                reports = reports_result.scalars().all()
                neg = sum(1 for r in reports if r.issue_type in negative_types)

                station.trust_score = score_from_reports(
                    total_reports=len(reports),
                    negative_reports=neg,
                    last_verified_at=station.last_verified_at,
                )
                db.add(station)

            await db.commit()
            logger.info(f"Updated trust scores for {len(stations)} stations")

    asyncio.get_event_loop().run_until_complete(_run())


@celery_app.task(name="app.workers.tasks.recalculate_queue_stats")
def recalculate_queue_stats():
    """
    Update queue statistics every 60 seconds based on recent bookings.
    """
    async def _run():
        from app.core.database import AsyncSessionLocal
        from app.models.models import Station, Booking, StationQueue, BookingStatus
        from sqlalchemy import select, func
        from datetime import datetime, timezone, timedelta

        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            window_start = now - timedelta(hours=2)

            # Get active bookings grouped by station
            result = await db.execute(
                select(Booking.station_id, func.count(Booking.id).label("active"))
                .where(
                    Booking.status.in_([BookingStatus.active, BookingStatus.confirmed]),
                    Booking.start_time <= now,
                    Booking.end_time >= now,
                )
                .group_by(Booking.station_id)
            )

            for row in result:
                queue_result = await db.execute(
                    select(StationQueue).where(StationQueue.station_id == row.station_id)
                )
                queue = queue_result.scalar_one_or_none()
                if not queue:
                    queue = StationQueue(station_id=row.station_id)
                queue.queue_length = max(row.active - 1, 0)
                db.add(queue)

            await db.commit()

    asyncio.get_event_loop().run_until_complete(_run())
