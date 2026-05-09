"""
External API service layer for Open Charge Map, Google Directions, OpenWeather.
All HTTP calls are wrapped with retry logic and caching.
"""
import asyncio
from typing import Any, Dict, List, Optional
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential
from app.core.config import settings
from app.core.redis_client import cache_get, cache_set
from loguru import logger


class OpenChargeMapService:
    """Wrapper for the Open Charge Map API."""

    BASE_URL = "https://api.openchargemap.io/v3"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.OPENCHARGEMAP_KEY

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=4))
    async def get_nearby_stations(
        self,
        latitude: float,
        longitude: float,
        radius_km: float = 10.0,
        limit: int = 50,
        charger_type: Optional[str] = None,
    ) -> List[Dict]:
        """Fetch nearby EV stations from Open Charge Map."""
        cache_key = f"ocm:nearby:{latitude:.4f}:{longitude:.4f}:{radius_km}:{limit}:{charger_type}"
        cached = await cache_get(cache_key)
        if cached:
            return cached

        params = {
            "output": "json",
            "latitude": latitude,
            "longitude": longitude,
            "distance": radius_km,
            "distanceunit": "km",
            "maxresults": limit,
            "compact": True,
            "verbose": False,
            "countrycode": "IN",  # India only
        }
        if self.api_key:
            params["key"] = self.api_key

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{self.BASE_URL}/poi", params=params)
            resp.raise_for_status()
            data = resp.json()

        stations = self._parse_stations(data)
        await cache_set(cache_key, stations, ttl=300)
        return stations

    def _parse_stations(self, raw: List[Dict]) -> List[Dict]:
        """Parse Open Charge Map response into our standard format."""
        stations = []
        for item in raw:
            try:
                addr = item.get("AddressInfo", {})
                connections = item.get("Connections", [])

                # Determine charger types
                charger_types = []
                max_power = 7.4
                for conn in connections:
                    level = conn.get("Level", {})
                    power = conn.get("PowerKW") or 0
                    if power > max_power:
                        max_power = power
                    ct = conn.get("ConnectionType", {}).get("Title", "")
                    if "CCS" in ct or "CHAdeMO" in ct:
                        charger_types.append("dc_fast")
                    elif "Type 2" in ct:
                        charger_types.append("ac_fast")
                    else:
                        charger_types.append("ac_slow")

                charger_types = list(set(charger_types)) or ["ac_slow"]

                status = item.get("StatusType", {})
                is_open = not (status and status.get("IsOperational") is False)

                stations.append({
                    "external_id": str(item.get("ID", "")),
                    "name": addr.get("Title", "EV Station"),
                    "operator": (item.get("OperatorInfo") or {}).get("Title"),
                    "address": addr.get("AddressLine1"),
                    "city": addr.get("Town"),
                    "state": addr.get("StateOrProvince"),
                    "latitude": addr.get("Latitude", 0),
                    "longitude": addr.get("Longitude", 0),
                    "charger_types": charger_types,
                    "total_slots": len(connections) or 1,
                    "available_slots": len(connections) or 1,
                    "max_power_kw": max_power,
                    "trust_score": 0.6,
                    "is_open": is_open,
                    "is_verified": False,
                })
            except Exception as e:
                logger.warning(f"Failed to parse OCM station: {e}")
                continue

        return stations


class GoogleDirectionsService:
    """Wrapper for Google Directions / Maps API."""

    BASE_URL = "https://maps.googleapis.com/maps/api"

    def __init__(self):
        self.api_key = settings.GOOGLE_MAPS_KEY

    @retry(stop=stop_after_attempt(2), wait=wait_exponential(min=1, max=3))
    async def get_directions(
        self,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
        departure_time: str = "now",
    ) -> Dict:
        """Get directions with traffic-aware ETAs."""
        if not self.api_key:
            # Fallback: estimate using Haversine
            import math
            d_lat = math.radians(dest_lat - origin_lat)
            d_lng = math.radians(dest_lng - origin_lng)
            a = (math.sin(d_lat/2)**2 + math.cos(math.radians(origin_lat)) *
                 math.cos(math.radians(dest_lat)) * math.sin(d_lng/2)**2)
            dist_km = 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
            return {
                "distance_km": round(dist_km, 1),
                "duration_min": round((dist_km / 50.0) * 60, 0),
                "traffic_factor": 1.0,
                "polyline": None,
            }

        cache_key = f"gmaps:{origin_lat:.4f}:{origin_lng:.4f}:{dest_lat:.4f}:{dest_lng:.4f}"
        cached = await cache_get(cache_key)
        if cached:
            return cached

        params = {
            "origin": f"{origin_lat},{origin_lng}",
            "destination": f"{dest_lat},{dest_lng}",
            "departure_time": departure_time,
            "traffic_model": "best_guess",
            "key": self.api_key,
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{self.BASE_URL}/directions/json", params=params)
            resp.raise_for_status()
            data = resp.json()

        if data.get("status") != "OK":
            raise ValueError(f"Google Directions API error: {data.get('status')}")

        route = data["routes"][0]["legs"][0]
        distance_m = route["distance"]["value"]
        duration_sec = route["duration"]["value"]
        traffic_sec = route.get("duration_in_traffic", {}).get("value", duration_sec)

        result = {
            "distance_km": round(distance_m / 1000, 1),
            "duration_min": round(duration_sec / 60, 0),
            "traffic_factor": round(traffic_sec / max(duration_sec, 1), 2),
            "polyline": data["routes"][0].get("overview_polyline", {}).get("points"),
        }

        await cache_set(cache_key, result, ttl=180)
        return result


class OpenWeatherService:
    """Wrapper for OpenWeather API."""

    BASE_URL = "https://api.openweathermap.org/data/2.5"

    def __init__(self):
        self.api_key = settings.OPENWEATHER_KEY

    @retry(stop=stop_after_attempt(2), wait=wait_exponential(min=1, max=3))
    async def get_weather(self, latitude: float, longitude: float) -> Dict:
        """Fetch current weather for a coordinate."""
        if not self.api_key:
            return {"temperature_celsius": 28.0, "humidity": 60, "wind_speed_mps": 3.0, "condition": "clear"}

        cache_key = f"weather:{latitude:.3f}:{longitude:.3f}"
        cached = await cache_get(cache_key)
        if cached:
            return cached

        params = {
            "lat": latitude,
            "lon": longitude,
            "appid": self.api_key,
            "units": "metric",
        }

        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(f"{self.BASE_URL}/weather", params=params)
            resp.raise_for_status()
            data = resp.json()

        result = {
            "temperature_celsius": data["main"]["temp"],
            "humidity": data["main"]["humidity"],
            "wind_speed_mps": data["wind"]["speed"],
            "condition": data["weather"][0]["main"],
        }

        await cache_set(cache_key, result, ttl=600)  # 10 min cache
        return result


class ElevationService:
    """Wrapper for Open Elevation API."""

    def __init__(self):
        self.base_url = settings.OPEN_ELEVATION_URL

    @retry(stop=stop_after_attempt(2), wait=wait_exponential(min=1, max=4))
    async def get_elevation(self, latitude: float, longitude: float) -> float:
        """Get elevation in meters at a coordinate."""
        cache_key = f"elev:{latitude:.4f}:{longitude:.4f}"
        cached = await cache_get(cache_key)
        if cached is not None:
            return cached

        payload = {"locations": [{"latitude": latitude, "longitude": longitude}]}
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(self.base_url, json=payload)
                resp.raise_for_status()
                data = resp.json()
            elevation = data["results"][0]["elevation"]
        except Exception:
            elevation = 0.0  # fallback to sea level

        await cache_set(cache_key, elevation, ttl=86400)  # 24h cache
        return float(elevation)
