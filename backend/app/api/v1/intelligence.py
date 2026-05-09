"""
Intelligence engine API routes.
- POST /range/predict     — physics-based range prediction
- POST /route/optimize    — A* EV route optimization
- GET  /stations/:id/wait — Erlang-C wait prediction
- GET  /vehicles          — list vehicle profiles
"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.redis_client import cache_get, cache_set
from app.models.models import Station as StationModel, VehicleProfile, StationQueue
from app.schemas.intelligence import (
    RangePredictionRequest, RangePredictionResponse,
    RouteOptimizeRequest, RouteOptimizeResponse, WaypointStation,
    WaitPredictionRequest, WaitPredictionResponse,
)
from app.algorithms.energy_model import VEHICLE_PROFILES, predict_range
from app.algorithms.route_optimizer import optimize_route, StationNode, haversine_km
from app.algorithms.erlang_c import predict_wait_time
from app.algorithms.monte_carlo import simulate_arrival_soc
from app.services.external_apis import GoogleDirectionsService, OpenWeatherService, ElevationService
from app.api.deps import get_current_user_optional, rate_limit
from loguru import logger

router = APIRouter(tags=["Intelligence"])
directions_svc = GoogleDirectionsService()
weather_svc = OpenWeatherService()
elevation_svc = ElevationService()


@router.get("/vehicles")
async def list_vehicles():
    """Return all supported EV vehicle profiles."""
    return [
        {
            "vehicle_id": p.vehicle_id,
            "name": p.name,
            "battery_capacity_kwh": p.battery_capacity_kwh,
            "usable_capacity_kwh": p.usable_capacity_kwh,
            "max_charge_rate_kw": p.max_charge_rate_kw,
            "efficiency_base_wh_per_km": p.efficiency_base_wh_per_km,
        }
        for p in VEHICLE_PROFILES.values()
    ]


@router.post("/range/predict", response_model=RangePredictionResponse)
async def predict_ev_range(
    body: RangePredictionRequest,
    _: None = Depends(rate_limit),
):
    """
    Physics-based EV range prediction.
    Uses drag, rolling resistance, gradient, HVAC, and traffic factors.
    """
    profile = VEHICLE_PROFILES.get(body.vehicle_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Vehicle '{body.vehicle_id}' not found. Available: {list(VEHICLE_PROFILES.keys())}")

    result = predict_range(
        profile=profile,
        current_soc_percent=body.current_soc_percent,
        speed_kmh=body.speed_kmh,
        temperature_celsius=body.temperature_celsius,
        use_hvac=body.use_hvac,
        elevation_gain_m=body.elevation_gain_m,
        traffic_factor=body.traffic_factor,
    )

    return RangePredictionResponse(
        vehicle_id=result["vehicle_id"],
        vehicle_name=result["vehicle_name"],
        current_soc_percent=result["current_soc_percent"],
        usable_energy_kwh=result["usable_energy_kwh"],
        estimated_range_km=result["estimated_range_km"],
        efficiency_wh_per_km=result["efficiency_wh_per_km"],
        power_breakdown=result["power_breakdown"],
        confidence_interval=result["confidence_interval"],
        warnings=result["warnings"],
    )


@router.post("/route/optimize", response_model=RouteOptimizeResponse)
async def optimize_ev_route(
    body: RouteOptimizeRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit),
):
    """
    Optimize EV route with charging stops.
    Fetches real traffic data, weather, and available stations.
    """
    profile = VEHICLE_PROFILES.get(body.vehicle_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Vehicle '{body.vehicle_id}' not found")

    # Fetch real-world data in parallel
    import asyncio
    directions_task = directions_svc.get_directions(
        body.origin_lat, body.origin_lng, body.dest_lat, body.dest_lng
    )
    weather_task = weather_svc.get_weather(body.origin_lat, body.origin_lng)
    origin_elev_task = elevation_svc.get_elevation(body.origin_lat, body.origin_lng)
    dest_elev_task = elevation_svc.get_elevation(body.dest_lat, body.dest_lng)

    directions, weather, origin_elev, dest_elev = await asyncio.gather(
        directions_task, weather_task, origin_elev_task, dest_elev_task,
        return_exceptions=True
    )

    # Extract values with fallbacks
    traffic_factor = 1.0
    polyline = None
    if isinstance(directions, dict):
        traffic_factor = directions.get("traffic_factor", 1.0)
        polyline = directions.get("polyline")

    temperature = 28.0
    if isinstance(weather, dict):
        temperature = weather.get("temperature_celsius", 28.0)

    elevation_gain = 0.0
    if isinstance(origin_elev, (int, float)) and isinstance(dest_elev, (int, float)):
        elevation_gain = float(dest_elev) - float(origin_elev)

    # Fetch candidate stations from DB (wider radius)
    total_dist = haversine_km(body.origin_lat, body.origin_lng, body.dest_lat, body.dest_lng)
    search_radius = min(total_dist * 0.8, 200.0)  # km

    lat_delta = search_radius / 111.0
    lng_delta = search_radius / 111.0

    import math
    mid_lat = (body.origin_lat + body.dest_lat) / 2
    mid_lng = (body.origin_lng + body.dest_lng) / 2

    station_result = await db.execute(
        select(StationModel).where(
            StationModel.latitude.between(mid_lat - lat_delta, mid_lat + lat_delta),
            StationModel.longitude.between(mid_lng - lng_delta, mid_lng + lng_delta),
            StationModel.is_open == True,
            StationModel.available_slots > 0,
        ).limit(50)
    )
    db_stations = station_result.scalars().all()

    candidate_stations = [
        StationNode(
            station_id=str(s.id),
            name=s.name,
            latitude=s.latitude,
            longitude=s.longitude,
            max_power_kw=s.max_power_kw,
            available_slots=s.available_slots,
            total_slots=s.total_slots,
            trust_score=s.trust_score,
        )
        for s in db_stations
    ]

    # Run route optimizer
    route_result = optimize_route(
        profile=profile,
        origin_lat=body.origin_lat,
        origin_lng=body.origin_lng,
        dest_lat=body.dest_lat,
        dest_lng=body.dest_lng,
        current_soc=body.current_soc_percent,
        candidate_stations=candidate_stations,
        min_arrival_soc=body.min_arrival_soc_percent,
        temperature_celsius=temperature,
        traffic_factor=traffic_factor,
    )

    charging_stops = [
        WaypointStation(**{k: v for k, v in stop.items() if k in WaypointStation.model_fields})
        for stop in route_result.get("charging_stops", [])
    ]

    mc = route_result.get("monte_carlo", {})

    return RouteOptimizeResponse(
        total_distance_km=route_result["total_distance_km"],
        total_duration_min=route_result["total_duration_min"],
        charging_stops=charging_stops,
        arrival_soc_percent=route_result["arrival_soc_percent"],
        energy_consumed_kwh=route_result["energy_consumed_kwh"],
        polyline=polyline,
        monte_carlo_confidence={
            "p5": mc.get("p5_soc", 0),
            "p50": mc.get("p50_soc", 0),
            "p95": mc.get("p95_soc", 0),
            "failure_probability": mc.get("failure_probability", 0),
        },
    )


@router.get("/stations/{station_id}/wait", response_model=WaitPredictionResponse)
async def predict_wait(
    station_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit),
):
    """Predict wait time at a station using Erlang-C queuing model."""
    station_result = await db.execute(select(StationModel).where(StationModel.id == station_id))
    station = station_result.scalar_one_or_none()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    queue_result = await db.execute(
        select(StationQueue).where(StationQueue.station_id == station_id)
    )
    queue = queue_result.scalar_one_or_none()

    occupied = station.total_slots - station.available_slots
    queue_length = queue.queue_length if queue else 0
    arrival_rate = queue.arrival_rate_per_hour if queue else 2.0
    avg_charge_time = queue.avg_service_time_min if queue else 45.0

    wait = predict_wait_time(
        total_chargers=station.total_slots,
        occupied_chargers=max(occupied, 0),
        queue_length=queue_length,
        avg_charge_time_min=avg_charge_time,
        arrival_rate_per_hour=arrival_rate,
    )

    return WaitPredictionResponse(
        station_id=str(station_id),
        estimated_wait_min=wait["estimated_wait_min"],
        queue_length=wait["queue_length"],
        probability_no_wait=wait["probability_no_wait"],
        charger_utilization_percent=wait["charger_utilization_percent"],
    )
