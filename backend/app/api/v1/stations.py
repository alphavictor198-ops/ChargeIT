"""
Station discovery API routes.
- GET /stations          — list/filter all stations
- GET /stations/nearby   — nearby stations by coordinates
- GET /stations/:id      — single station detail
- POST /stations/sync    — sync from Open Charge Map (admin)
"""
import math
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.core.database import get_db
from app.core.redis_client import cache_get, cache_set
from app.models.models import Station, UserReport, IssueType, UserRole
from app.schemas.station import StationResponse, NearbyStationsRequest, ReportCreate, ReportResponse
from app.schemas.intelligence import TrustScoreResponse
from app.api.deps import get_current_user, get_current_user_optional, require_role, rate_limit
from app.services.external_apis import OpenChargeMapService
from app.algorithms.trust_layer import score_from_reports
from app.algorithms.erlang_c import predict_wait_time
from loguru import logger

router = APIRouter(prefix="/stations", tags=["Stations"])
ocm_service = OpenChargeMapService()


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance in km."""
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@router.get("", response_model=List[StationResponse])
async def list_stations(
    city: Optional[str] = None,
    charger_type: Optional[str] = None,
    min_power_kw: Optional[float] = None,
    available_only: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit),
):
    """List all stations with optional filters and pagination."""
    query = select(Station).where(Station.is_open == True)

    if city:
        query = query.where(Station.city.ilike(f"%{city}%"))
    if charger_type:
        # ARRAY contains check
        query = query.where(Station.charger_types.contains([charger_type]))
    if min_power_kw:
        query = query.where(Station.max_power_kw >= min_power_kw)
    if available_only:
        query = query.where(Station.available_slots > 0)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    stations = result.scalars().all()

    return [StationResponse(**{
        **{c.key: getattr(s, c.key) for c in s.__table__.columns},
        "id": str(s.id),
    }) for s in stations]


@router.get("/nearby", response_model=List[StationResponse])
async def nearby_stations(
    latitude: float = Query(..., description="User latitude"),
    longitude: float = Query(..., description="User longitude"),
    radius_km: float = Query(10.0, le=100.0),
    charger_type: Optional[str] = None,
    min_power_kw: Optional[float] = None,
    available_only: bool = False,
    limit: int = Query(50, le=200),
    use_live_api: bool = Query(True, description="Fetch from Open Charge Map API"),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit),
):
    """
    Find nearby EV charging stations.
    Optionally pulls live data from Open Charge Map and merges with DB.
    """
    cache_key = f"nearby:{latitude:.3f}:{longitude:.3f}:{radius_km}:{charger_type}:{available_only}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    # Fetch from Open Charge Map if requested
    if use_live_api:
        try:
            ocm_stations = await ocm_service.get_nearby_stations(
                latitude, longitude, radius_km, limit, charger_type
            )
            # Upsert live data to DB
            for st_data in ocm_stations[:20]:  # limit DB writes
                existing = await db.execute(
                    select(Station).where(Station.external_id == st_data["external_id"])
                )
                if not existing.scalar_one_or_none():
                    station = Station(**{k: v for k, v in st_data.items() if hasattr(Station, k)})
                    db.add(station)
            await db.flush()
        except Exception as e:
            logger.warning(f"Open Charge Map API failed: {e}")

    # Query local DB with bounding box approximation
    lat_delta = radius_km / 111.0
    lng_delta = radius_km / (111.0 * math.cos(math.radians(latitude)))

    query = select(Station).where(
        Station.latitude.between(latitude - lat_delta, latitude + lat_delta),
        Station.longitude.between(longitude - lng_delta, longitude + lng_delta),
        Station.is_open == True,
    )
    if charger_type:
        query = query.where(Station.charger_types.contains([charger_type]))
    if min_power_kw:
        query = query.where(Station.max_power_kw >= min_power_kw)
    if available_only:
        query = query.where(Station.available_slots > 0)

    result = await db.execute(query)
    stations = result.scalars().all()

    response = []
    for s in stations:
        dist = _distance_km(latitude, longitude, s.latitude, s.longitude)
        if dist <= radius_km:
            response.append(StationResponse(**{
                **{c.key: getattr(s, c.key) for c in s.__table__.columns},
                "id": str(s.id),
                "distance_km": round(dist, 2),
            }))

    response.sort(key=lambda x: x.distance_km or 999)
    response = response[:limit]

    await cache_set(cache_key, [r.model_dump() for r in response], ttl=180)
    return response


@router.get("/{station_id}", response_model=StationResponse)
async def get_station(
    station_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get single station details by ID."""
    result = await db.execute(select(Station).where(Station.id == station_id))
    station = result.scalar_one_or_none()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    return StationResponse(**{
        **{c.key: getattr(station, c.key) for c in station.__table__.columns},
        "id": str(station.id),
    })


@router.get("/{station_id}/trust", response_model=TrustScoreResponse)
async def get_trust_score(
    station_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get Bayesian trust score for a station."""
    result = await db.execute(select(Station).where(Station.id == station_id))
    station = result.scalar_one_or_none()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    # Fetch reports
    reports_result = await db.execute(
        select(UserReport).where(UserReport.station_id == station_id)
    )
    reports = reports_result.scalars().all()

    negative_types = {IssueType.charger_offline, IssueType.wrong_availability, IssueType.safety_concern}
    neg_count = sum(1 for r in reports if r.issue_type in negative_types)
    total = len(reports)

    trust = score_from_reports(
        total_reports=total,
        negative_reports=neg_count,
        verified_downtime_incidents=0,
        last_verified_at=station.last_verified_at,
    )

    station.trust_score = trust
    db.add(station)

    return TrustScoreResponse(
        station_id=str(station_id),
        trust_score=trust,
        total_reports=total,
        verified_working=total - neg_count,
        recent_failures=neg_count,
        uptime_estimate_percent=round(trust * 100, 1),
        last_verified=str(station.last_verified_at) if station.last_verified_at else None,
    )


@router.post("/report", status_code=status.HTTP_201_CREATED)
async def submit_report(
    body: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _: None = Depends(rate_limit),
):
    """Submit a user report for a station."""
    station_id = UUID(body.station_id)
    station_result = await db.execute(select(Station).where(Station.id == station_id))
    if not station_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Station not found")

    report = UserReport(
        station_id=station_id,
        user_id=current_user.id,
        issue_type=body.issue_type,
        description=body.description,
    )
    db.add(report)
    await db.flush()

    return {"message": "Report submitted successfully", "report_id": str(report.id)}
