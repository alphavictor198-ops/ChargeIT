"""
Booking management API routes.
- POST /bookings          — create booking
- GET  /bookings          — list user's bookings
- GET  /bookings/:id      — booking detail
- PATCH /bookings/:id/cancel — cancel booking
- DELETE /bookings/:id    — delete (admin)
"""
from datetime import datetime, timezone
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.core.database import get_db
from app.models.models import Booking, Station, BookingStatus, ChargingSlot, UserRole
from app.schemas.station import BookingCreate, BookingResponse
from app.api.deps import get_current_user, require_role, rate_limit

router = APIRouter(prefix="/bookings", tags=["Bookings"])


@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    body: BookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _: None = Depends(rate_limit),
):
    """Create a charging slot booking."""
    # Validate times
    now = datetime.now(timezone.utc)
    if body.start_time <= now:
        raise HTTPException(status_code=400, detail="Start time must be in the future")
    if body.end_time <= body.start_time:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    if (body.end_time - body.start_time).total_seconds() > 8 * 3600:
        raise HTTPException(status_code=400, detail="Booking cannot exceed 8 hours")

    # Check station exists
    station_id = UUID(body.station_id)
    station_result = await db.execute(select(Station).where(Station.id == station_id))
    station = station_result.scalar_one_or_none()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    if not station.is_open:
        raise HTTPException(status_code=400, detail="Station is currently closed")

    # Check slot availability — no overlapping bookings at same time
    overlap_check = await db.execute(
        select(Booking).where(
            and_(
                Booking.station_id == station_id,
                Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed]),
                Booking.start_time < body.end_time,
                Booking.end_time > body.start_time,
            )
        )
    )
    overlapping = overlap_check.scalars().all()
    if len(overlapping) >= station.total_slots:
        raise HTTPException(status_code=409, detail="No available slots for the requested time")

    # Slot-specific check if slot_id provided
    slot_id = UUID(body.slot_id) if body.slot_id else None
    if slot_id:
        slot_result = await db.execute(select(ChargingSlot).where(ChargingSlot.id == slot_id))
        slot = slot_result.scalar_one_or_none()
        if not slot or not slot.is_operational:
            raise HTTPException(status_code=400, detail="Requested slot is not available")

    booking = Booking(
        user_id=current_user.id,
        station_id=station_id,
        slot_id=slot_id,
        vehicle_id=UUID(body.vehicle_id) if body.vehicle_id else None,
        status=BookingStatus.confirmed,
        start_time=body.start_time,
        end_time=body.end_time,
        notes=body.notes,
    )
    db.add(booking)
    await db.flush()
    await db.refresh(booking)

    return _booking_to_response(booking)


@router.get("", response_model=List[BookingResponse])
async def list_bookings(
    status_filter: str = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List current user's bookings."""
    query = select(Booking).where(Booking.user_id == current_user.id)

    if status_filter:
        try:
            s = BookingStatus(status_filter)
            query = query.where(Booking.status == s)
        except ValueError:
            pass

    query = query.order_by(Booking.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    bookings = result.scalars().all()
    return [_booking_to_response(b) for b in bookings]


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get a single booking by ID."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to view this booking")
    return _booking_to_response(booking)


@router.patch("/{booking_id}/cancel", response_model=BookingResponse)
async def cancel_booking(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Cancel a booking. Must be owned by current user."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if booking.status in (BookingStatus.completed, BookingStatus.cancelled):
        raise HTTPException(status_code=400, detail=f"Cannot cancel a {booking.status.value} booking")

    booking.status = BookingStatus.cancelled
    db.add(booking)

    return _booking_to_response(booking)


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_booking(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role(UserRole.admin)),
):
    """Delete a booking record. Admin only."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    await db.delete(booking)


def _booking_to_response(b: Booking) -> BookingResponse:
    return BookingResponse(
        id=str(b.id),
        user_id=str(b.user_id),
        station_id=str(b.station_id),
        slot_id=str(b.slot_id) if b.slot_id else None,
        status=b.status,
        start_time=b.start_time,
        end_time=b.end_time,
        energy_kwh=b.energy_kwh,
        cost_inr=b.cost_inr,
        notes=b.notes,
        created_at=b.created_at,
    )
