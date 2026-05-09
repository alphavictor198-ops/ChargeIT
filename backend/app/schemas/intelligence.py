"""
Pydantic schemas for range prediction and routing APIs.
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, field_validator


class RangePredictionRequest(BaseModel):
    vehicle_id: str
    current_soc_percent: float  # 0–100
    speed_kmh: float = 60.0
    temperature_celsius: float = 25.0
    use_hvac: bool = True
    elevation_gain_m: float = 0.0
    traffic_factor: float = 1.0  # 1.0 = free flow, >1 = congested

    @field_validator("current_soc_percent")
    @classmethod
    def validate_soc(cls, v: float) -> float:
        if not 0 <= v <= 100:
            raise ValueError("SOC must be between 0 and 100")
        return v


class RangePredictionResponse(BaseModel):
    vehicle_id: str
    vehicle_name: str
    current_soc_percent: float
    usable_energy_kwh: float
    estimated_range_km: float
    efficiency_wh_per_km: float
    power_breakdown: Dict[str, float]
    confidence_interval: Dict[str, float]  # {low, mid, high}
    warnings: List[str]


class RouteOptimizeRequest(BaseModel):
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    vehicle_id: str
    current_soc_percent: float
    min_arrival_soc_percent: float = 15.0
    preferences: Optional[Dict[str, Any]] = None  # avoid_toll, prefer_fast_charge


class WaypointStation(BaseModel):
    station_id: str
    station_name: str
    latitude: float
    longitude: float
    arrival_soc_percent: float
    charge_to_soc_percent: float
    estimated_charge_time_min: float
    wait_time_min: float
    trust_score: float


class RouteOptimizeResponse(BaseModel):
    total_distance_km: float
    total_duration_min: float
    charging_stops: List[WaypointStation]
    arrival_soc_percent: float
    energy_consumed_kwh: float
    polyline: Optional[str] = None  # encoded polyline
    monte_carlo_confidence: Dict[str, float]


class WaitPredictionRequest(BaseModel):
    station_id: str
    arrival_time_iso: Optional[str] = None  # ISO datetime


class WaitPredictionResponse(BaseModel):
    station_id: str
    estimated_wait_min: float
    queue_length: int
    probability_no_wait: float
    charger_utilization_percent: float


class TrustScoreResponse(BaseModel):
    station_id: str
    trust_score: float
    total_reports: int
    verified_working: int
    recent_failures: int
    uptime_estimate_percent: float
    last_verified: Optional[str] = None
