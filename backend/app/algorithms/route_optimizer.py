"""
Modified A* route optimization for EV charging stops.

Finds the optimal set of charging stops to minimize:
  - Total travel time
  - Number of charging stops
  - Average wait time at chargers
  - Preference for high-trust stations

Constraints:
  - Never drop below min_arrival_soc at any segment
  - Only use stations with enough available slots
"""
import math
import heapq
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from app.algorithms.energy_model import VehicleEnergyProfile, predict_range
from app.algorithms.erlang_c import predict_wait_time
from app.algorithms.monte_carlo import simulate_arrival_soc


@dataclass
class StationNode:
    """A charging station as a routing waypoint."""
    station_id: str
    name: str
    latitude: float
    longitude: float
    max_power_kw: float
    available_slots: int
    total_slots: int
    trust_score: float
    avg_charge_time_min: float = 45.0
    arrival_rate_per_hour: float = 2.0


@dataclass(order=True)
class RouteState:
    """State in the A* search tree."""
    f_score: float
    soc: float = field(compare=False)
    current_lat: float = field(compare=False)
    current_lng: float = field(compare=False)
    stops: List[dict] = field(compare=False, default_factory=list)
    total_time_min: float = field(compare=False, default=0.0)
    total_distance_km: float = field(compare=False, default=0.0)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Compute great-circle distance in km between two coordinates."""
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lng / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def segment_soc_cost(
    profile: VehicleEnergyProfile,
    distance_km: float,
    speed_kmh: float = 60.0,
    temperature_celsius: float = 25.0,
    traffic_factor: float = 1.0,
) -> float:
    """Estimate SOC consumed for a route segment (percentage points)."""
    result = predict_range(
        profile=profile,
        current_soc_percent=100.0,
        speed_kmh=speed_kmh,
        temperature_celsius=temperature_celsius,
        traffic_factor=traffic_factor,
        distance_km=distance_km,
    )
    energy_per_km = result["efficiency_wh_per_km"]
    energy_needed_kwh = (energy_per_km * distance_km) / 1000.0
    soc_consumed = (energy_needed_kwh / profile.usable_capacity_kwh) * 100.0
    return soc_consumed


def optimize_route(
    profile: VehicleEnergyProfile,
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    current_soc: float,
    candidate_stations: List[StationNode],
    min_arrival_soc: float = 15.0,
    speed_kmh: float = 60.0,
    temperature_celsius: float = 25.0,
    traffic_factor: float = 1.0,
    max_stops: int = 3,
) -> Dict:
    """
    A*-inspired EV route optimizer.

    Args:
        profile: Vehicle energy profile
        origin/dest: Start and destination coordinates
        current_soc: Starting state of charge (%)
        candidate_stations: Available charging stations along route
        min_arrival_soc: Minimum SOC required at any arrival point
        max_stops: Maximum number of charging stops allowed

    Returns:
        Optimized route with charging stops and energy estimates
    """
    total_direct_km = haversine_km(origin_lat, origin_lng, dest_lat, dest_lng)
    direct_soc_cost = segment_soc_cost(profile, total_direct_km, speed_kmh, temperature_celsius, traffic_factor)

    # Check if direct route is feasible
    if current_soc - direct_soc_cost >= min_arrival_soc:
        mc = simulate_arrival_soc(
            profile=profile,
            distance_km=total_direct_km,
            current_soc_percent=current_soc,
            speed_kmh=speed_kmh,
            temperature_celsius=temperature_celsius,
            traffic_factor=traffic_factor,
        )
        return {
            "charging_stops": [],
            "total_distance_km": round(total_direct_km, 1),
            "total_duration_min": round((total_direct_km / speed_kmh) * 60, 0),
            "arrival_soc_percent": round(current_soc - direct_soc_cost, 1),
            "energy_consumed_kwh": round((direct_soc_cost / 100.0) * profile.usable_capacity_kwh, 2),
            "monte_carlo": mc,
        }

    # Filter stations within a corridor around the route
    corridor_km = max(total_direct_km * 0.3, 30.0)
    relevant = [
        s for s in candidate_stations
        if (haversine_km(origin_lat, origin_lng, s.latitude, s.longitude) < total_direct_km * 1.5
            and s.trust_score >= 0.3
            and s.available_slots > 0)
    ]

    # Sort stations by proximity to direct line
    def detour_factor(s: StationNode) -> float:
        d_to_station = haversine_km(origin_lat, origin_lng, s.latitude, s.longitude)
        d_station_to_dest = haversine_km(s.latitude, s.longitude, dest_lat, dest_lng)
        return (d_to_station + d_station_to_dest) / max(total_direct_km, 1)

    relevant.sort(key=lambda s: (detour_factor(s), -s.trust_score))
    relevant = relevant[:15]  # top candidates

    # Greedy search: pick minimum stops needed
    best_route = None
    best_score = float("inf")

    # Try with 1, 2, 3 stops
    for n_stops in range(1, min(max_stops + 1, len(relevant) + 1)):
        route = _greedy_route(
            profile, origin_lat, origin_lng, dest_lat, dest_lng,
            current_soc, relevant, min_arrival_soc, speed_kmh,
            temperature_celsius, traffic_factor, n_stops
        )
        if route and route["arrival_soc_percent"] >= min_arrival_soc:
            score = route["total_duration_min"] + len(route["charging_stops"]) * 10
            if score < best_score:
                best_score = score
                best_route = route
            break

    if best_route is None:
        # No feasible route found — return partial with warning
        best_route = {
            "charging_stops": [],
            "total_distance_km": round(total_direct_km, 1),
            "total_duration_min": round((total_direct_km / speed_kmh) * 60, 0),
            "arrival_soc_percent": round(current_soc - direct_soc_cost, 1),
            "energy_consumed_kwh": round((direct_soc_cost / 100.0) * profile.usable_capacity_kwh, 2),
            "warning": "Insufficient charging infrastructure. May not complete route.",
            "monte_carlo": {},
        }

    return best_route


def _greedy_route(
    profile, origin_lat, origin_lng, dest_lat, dest_lng,
    current_soc, stations, min_soc, speed_kmh, temp, traffic, n_stops
) -> Optional[Dict]:
    """Greedy route planner attempting n_stops charging stops."""
    stops = []
    lat, lng = origin_lat, origin_lng
    soc = current_soc
    total_time = 0.0
    total_dist = 0.0

    for _ in range(n_stops):
        # Find the furthest reachable station that keeps us safe
        best_station = None
        best_dist = 0.0

        for s in stations:
            if s in [stop["_station"] for stop in stops]:
                continue
            d = haversine_km(lat, lng, s.latitude, s.longitude)
            soc_cost = segment_soc_cost(profile, d, speed_kmh, temp, traffic)
            arrival_soc = soc - soc_cost
            if arrival_soc >= min_soc and d > best_dist:
                best_dist = d
                best_station = s
                _arrival_soc = arrival_soc

        if best_station is None:
            return None

        # Travel to station
        travel_time_min = (best_dist / speed_kmh) * 60
        total_time += travel_time_min
        total_dist += best_dist

        # Wait time at station
        wait = predict_wait_time(
            total_chargers=best_station.total_slots,
            occupied_chargers=best_station.total_slots - best_station.available_slots,
            queue_length=0,
            avg_charge_time_min=best_station.avg_charge_time_min,
            arrival_rate_per_hour=best_station.arrival_rate_per_hour,
        )

        # Charge to 80% (optimal for battery longevity)
        charge_to_soc = 80.0
        energy_to_add_kwh = ((charge_to_soc - _arrival_soc) / 100.0) * profile.usable_capacity_kwh
        charge_time_min = (energy_to_add_kwh / best_station.max_power_kw) * 60

        total_time += wait["estimated_wait_min"] + charge_time_min

        stops.append({
            "_station": best_station,
            "station_id": best_station.station_id,
            "station_name": best_station.name,
            "latitude": best_station.latitude,
            "longitude": best_station.longitude,
            "arrival_soc_percent": round(_arrival_soc, 1),
            "charge_to_soc_percent": charge_to_soc,
            "estimated_charge_time_min": round(charge_time_min, 1),
            "wait_time_min": round(wait["estimated_wait_min"], 1),
            "trust_score": best_station.trust_score,
        })

        lat, lng = best_station.latitude, best_station.longitude
        soc = charge_to_soc

    # Final leg to destination
    final_dist = haversine_km(lat, lng, dest_lat, dest_lng)
    final_soc_cost = segment_soc_cost(profile, final_dist, speed_kmh, temp, traffic)
    final_soc = soc - final_soc_cost
    total_dist += final_dist
    total_time += (final_dist / speed_kmh) * 60

    # Clean output (remove internal _station refs)
    clean_stops = [{k: v for k, v in s.items() if k != "_station"} for s in stops]

    mc = simulate_arrival_soc(
        profile=profile,
        distance_km=total_dist,
        current_soc_percent=current_soc,
        speed_kmh=speed_kmh,
        temperature_celsius=temp,
        traffic_factor=traffic,
    )

    return {
        "charging_stops": clean_stops,
        "total_distance_km": round(total_dist, 1),
        "total_duration_min": round(total_time, 0),
        "arrival_soc_percent": round(final_soc, 1),
        "energy_consumed_kwh": round(((100 - final_soc) / 100.0) * profile.usable_capacity_kwh, 2),
        "monte_carlo": mc,
    }
