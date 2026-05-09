"""
Admin dashboard API routes (admin role only).
- GET /admin/stats       — platform-wide stats
- GET /admin/stations    — all stations with analytics
- GET /admin/users       — user management
- GET /admin/reports     — all user reports
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from app.core.database import get_db
from app.models.models import User, Station, Booking, UserReport, BookingStatus, UserRole
from app.api.deps import require_role

router = APIRouter(prefix="/admin", tags=["Admin"])
admin_required = require_role(UserRole.admin)


@router.get("/stats")
async def platform_stats(
    db: AsyncSession = Depends(get_db),
    _=Depends(admin_required),
):
    """Return aggregate platform statistics."""
    total_users = (await db.execute(select(func.count(User.id)))).scalar()
    total_stations = (await db.execute(select(func.count(Station.id)))).scalar()
    total_bookings = (await db.execute(select(func.count(Booking.id)))).scalar()
    active_bookings = (await db.execute(
        select(func.count(Booking.id)).where(Booking.status == BookingStatus.confirmed)
    )).scalar()
    total_reports = (await db.execute(select(func.count(UserReport.id)))).scalar()

    return {
        "total_users": total_users,
        "total_stations": total_stations,
        "total_bookings": total_bookings,
        "active_bookings": active_bookings,
        "total_reports": total_reports,
        "platform": "GatiCharge",
        "version": "1.0.0",
    }


@router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(admin_required),
):
    """List all users for admin management."""
    query = select(User)
    if role:
        try:
            query = query.where(User.role == UserRole(role))
        except ValueError:
            pass

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    users = result.scalars().all()

    return [
        {
            "id": str(u.id),
            "name": u.name,
            "email": u.email,
            "role": u.role.value,
            "is_active": u.is_active,
            "is_verified": u.is_verified,
            "created_at": str(u.created_at),
        }
        for u in users
    ]


@router.get("/reports")
async def list_reports(
    resolved: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _=Depends(admin_required),
):
    """List all user-submitted station reports."""
    query = select(UserReport)
    if resolved is not None:
        query = query.where(UserReport.is_resolved == resolved)

    query = query.order_by(UserReport.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    reports = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "station_id": str(r.station_id),
            "user_id": str(r.user_id),
            "issue_type": r.issue_type.value,
            "description": r.description,
            "is_resolved": r.is_resolved,
            "created_at": str(r.created_at),
        }
        for r in reports
    ]


@router.get("/bookings/analytics")
async def booking_analytics(
    db: AsyncSession = Depends(get_db),
    _=Depends(admin_required),
):
    """Return booking analytics for admin dashboard charts."""
    # Daily bookings last 7 days
    daily = await db.execute(text("""
        SELECT DATE(created_at) as date, COUNT(*) as count,
               SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
        FROM bookings
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date
    """))

    # Status breakdown
    status_result = await db.execute(
        select(Booking.status, func.count(Booking.id)).group_by(Booking.status)
    )

    return {
        "daily_bookings": [
            {"date": str(row.date), "total": row.count, "completed": row.completed}
            for row in daily
        ],
        "status_breakdown": {
            row[0].value: row[1] for row in status_result
        },
    }
