"""
SQLAlchemy ORM Models — complete database schema for GatiCharge.
"""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, Text,
    ForeignKey, Enum as SAEnum, Index, UniqueConstraint, func
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.core.database import Base
import enum


# ─────────────────────────── Enums ───────────────────────────

class UserRole(str, enum.Enum):
    user = "user"
    station_owner = "station_owner"
    admin = "admin"


class BookingStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class ChargerType(str, enum.Enum):
    ac_slow = "ac_slow"       # Type 1/2, up to 7.4 kW
    ac_fast = "ac_fast"       # Type 2, 7.4–22 kW
    dc_fast = "dc_fast"       # CCS/CHAdeMO, 50–150 kW
    dc_ultra = "dc_ultra"     # 150+ kW


class IssueType(str, enum.Enum):
    charger_offline = "charger_offline"
    wrong_availability = "wrong_availability"
    payment_issue = "payment_issue"
    safety_concern = "safety_concern"
    wrong_info = "wrong_info"
    other = "other"


# ─────────────────────────── Models ───────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), default=UserRole.user, nullable=False)
    google_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    vehicle_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("vehicle_profiles.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    bookings = relationship("Booking", back_populates="user", lazy="select")
    reports = relationship("UserReport", back_populates="user", lazy="select")
    vehicle = relationship("VehicleProfile", foreign_keys=[vehicle_id], lazy="select")

    __table_args__ = (Index("ix_users_email_active", "email", "is_active"),)


class VehicleProfile(Base):
    __tablename__ = "vehicle_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    brand: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    battery_capacity_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    usable_capacity_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    efficiency_wh_per_km: Mapped[float] = mapped_column(Float, nullable=False)  # base Wh/km
    drag_coefficient: Mapped[float] = mapped_column(Float, nullable=False)
    frontal_area_m2: Mapped[float] = mapped_column(Float, nullable=False)
    mass_kg: Mapped[float] = mapped_column(Float, nullable=False)
    rolling_resistance: Mapped[float] = mapped_column(Float, nullable=False, default=0.012)
    max_regen_power_kw: Mapped[float] = mapped_column(Float, nullable=False)
    hvac_power_kw: Mapped[float] = mapped_column(Float, nullable=False, default=2.0)
    max_charge_rate_kw: Mapped[float] = mapped_column(Float, nullable=False)
    connector_types: Mapped[list] = mapped_column(ARRAY(String), nullable=False, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Station(Base):
    __tablename__ = "stations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    operator: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    charger_types: Mapped[list] = mapped_column(ARRAY(String), nullable=False, default=list)
    total_slots: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    available_slots: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_power_kw: Mapped[float] = mapped_column(Float, nullable=False, default=7.4)
    trust_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    amenities: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    operating_hours: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    pricing_info: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    elevation_m: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    last_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    bookings = relationship("Booking", back_populates="station", lazy="select")
    reports = relationship("UserReport", back_populates="station", lazy="select")
    slots = relationship("ChargingSlot", back_populates="station", lazy="select")

    __table_args__ = (
        Index("ix_stations_location", "latitude", "longitude"),
        Index("ix_stations_city", "city"),
    )


class ChargingSlot(Base):
    __tablename__ = "charging_slots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    station_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stations.id", ondelete="CASCADE"), nullable=False)
    slot_number: Mapped[int] = mapped_column(Integer, nullable=False)
    charger_type: Mapped[str] = mapped_column(String(50), nullable=False)
    power_kw: Mapped[float] = mapped_column(Float, nullable=False)
    is_operational: Mapped[bool] = mapped_column(Boolean, default=True)
    is_occupied: Mapped[bool] = mapped_column(Boolean, default=False)
    connector_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    station = relationship("Station", back_populates="slots")
    bookings = relationship("Booking", back_populates="slot", lazy="select")

    __table_args__ = (
        UniqueConstraint("station_id", "slot_number", name="uq_station_slot"),
    )


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    station_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stations.id", ondelete="CASCADE"), nullable=False)
    slot_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("charging_slots.id"), nullable=True)
    vehicle_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("vehicle_profiles.id"), nullable=True)
    status: Mapped[BookingStatus] = mapped_column(SAEnum(BookingStatus), default=BookingStatus.pending, nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    energy_kwh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cost_inr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="bookings")
    station = relationship("Station", back_populates="bookings")
    slot = relationship("ChargingSlot", back_populates="bookings")

    __table_args__ = (
        Index("ix_bookings_user_id", "user_id"),
        Index("ix_bookings_station_time", "station_id", "start_time"),
    )


class TrafficSnapshot(Base):
    __tablename__ = "traffic_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    origin_lat: Mapped[float] = mapped_column(Float, nullable=False)
    origin_lng: Mapped[float] = mapped_column(Float, nullable=False)
    dest_lat: Mapped[float] = mapped_column(Float, nullable=False)
    dest_lng: Mapped[float] = mapped_column(Float, nullable=False)
    congestion_level: Mapped[float] = mapped_column(Float, nullable=False)  # 0=free, 1=gridlock
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    distance_meters: Mapped[int] = mapped_column(Integer, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserReport(Base):
    __tablename__ = "user_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    station_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stations.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    issue_type: Mapped[IssueType] = mapped_column(SAEnum(IssueType), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    station = relationship("Station", back_populates="reports")
    user = relationship("User", back_populates="reports")


class StationQueue(Base):
    __tablename__ = "station_queues"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    station_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stations.id", ondelete="CASCADE"), nullable=False, unique=True)
    queue_length: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    avg_service_time_min: Mapped[float] = mapped_column(Float, nullable=False, default=30.0)
    arrival_rate_per_hour: Mapped[float] = mapped_column(Float, nullable=False, default=2.0)
    estimated_wait_min: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
