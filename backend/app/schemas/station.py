"""
Pydantic schemas for Station, Booking, Reports.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, field_validator
from app.models.models import BookingStatus, IssueType


class StationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    operator: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    latitude: float
    longitude: float
    charger_types: List[str]
    total_slots: int
    available_slots: int
    max_power_kw: float
    trust_score: float
    is_open: bool
    is_verified: bool
    amenities: Optional[Dict[str, Any]] = None
    operating_hours: Optional[Dict[str, Any]] = None
    pricing_info: Optional[Dict[str, Any]] = None
    distance_km: Optional[float] = None  # computed field

    @field_validator("id", mode="before")
    @classmethod
    def stringify_id(cls, v):
        return str(v)


class NearbyStationsRequest(BaseModel):
    latitude: float
    longitude: float
    radius_km: float = 10.0
    charger_type: Optional[str] = None
    min_power_kw: Optional[float] = None
    available_only: bool = False
    limit: int = 50


class BookingCreate(BaseModel):
    station_id: str
    slot_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    start_time: datetime
    end_time: datetime
    notes: Optional[str] = None


class BookingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    station_id: str
    slot_id: Optional[str] = None
    status: BookingStatus
    start_time: datetime
    end_time: datetime
    energy_kwh: Optional[float] = None
    cost_inr: Optional[float] = None
    notes: Optional[str] = None
    created_at: datetime

    @field_validator("id", "user_id", "station_id", "slot_id", mode="before")
    @classmethod
    def stringify_uuid(cls, v):
        return str(v) if v else None


class ReportCreate(BaseModel):
    station_id: str
    issue_type: IssueType
    description: Optional[str] = None


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    station_id: str
    issue_type: IssueType
    description: Optional[str] = None
    is_verified: bool
    created_at: datetime

    @field_validator("id", "station_id", mode="before")
    @classmethod
    def stringify_uuid(cls, v):
        return str(v) if v else None


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int
