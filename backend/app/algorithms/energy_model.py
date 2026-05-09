"""
Physics-based EV energy model.

Implements the formula:
P(v, θ, T) = P_rolling + P_aero + P_gradient + P_hvac

Where:
  P_rolling = m * g * Cr * v               (rolling resistance)
  P_aero    = 0.5 * ρ * Cd * A * v³       (aerodynamic drag)
  P_gradient = m * g * sin(θ) * v          (slope)
  P_hvac    = HVAC load (weather dependent)
"""
import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional


AIR_DENSITY = 1.225  # kg/m³ at 15°C sea level
GRAVITY = 9.81       # m/s²


@dataclass
class VehicleEnergyProfile:
    """Energy model parameters for an EV vehicle."""
    vehicle_id: str
    name: str
    battery_capacity_kwh: float
    usable_capacity_kwh: float
    efficiency_base_wh_per_km: float  # manufacturer spec
    drag_coefficient: float            # Cd
    frontal_area_m2: float             # A
    mass_kg: float                     # m (with driver ~75 kg)
    rolling_resistance_coeff: float    # Cr
    max_regen_power_kw: float
    hvac_max_kw: float
    max_charge_rate_kw: float


# ── Pre-defined Indian EV Profiles ──────────────────────────────────────────

VEHICLE_PROFILES: Dict[str, VehicleEnergyProfile] = {
    "nexon_ev": VehicleEnergyProfile(
        vehicle_id="nexon_ev",
        name="Tata Nexon EV",
        battery_capacity_kwh=40.5,
        usable_capacity_kwh=37.5,
        efficiency_base_wh_per_km=155,
        drag_coefficient=0.36,
        frontal_area_m2=2.35,
        mass_kg=1580,
        rolling_resistance_coeff=0.012,
        max_regen_power_kw=50,
        hvac_max_kw=2.2,
        max_charge_rate_kw=50,
    ),
    "tiago_ev": VehicleEnergyProfile(
        vehicle_id="tiago_ev",
        name="Tata Tiago EV",
        battery_capacity_kwh=24.0,
        usable_capacity_kwh=21.5,
        efficiency_base_wh_per_km=115,
        drag_coefficient=0.34,
        frontal_area_m2=2.10,
        mass_kg=1175,
        rolling_resistance_coeff=0.011,
        max_regen_power_kw=35,
        hvac_max_kw=1.8,
        max_charge_rate_kw=25,
    ),
    "mg_zs_ev": VehicleEnergyProfile(
        vehicle_id="mg_zs_ev",
        name="MG ZS EV",
        battery_capacity_kwh=50.3,
        usable_capacity_kwh=46.8,
        efficiency_base_wh_per_km=175,
        drag_coefficient=0.38,
        frontal_area_m2=2.55,
        mass_kg=1620,
        rolling_resistance_coeff=0.013,
        max_regen_power_kw=70,
        hvac_max_kw=2.5,
        max_charge_rate_kw=76,
    ),
    "byd_atto3": VehicleEnergyProfile(
        vehicle_id="byd_atto3",
        name="BYD Atto 3",
        battery_capacity_kwh=60.5,
        usable_capacity_kwh=56.6,
        efficiency_base_wh_per_km=165,
        drag_coefficient=0.29,
        frontal_area_m2=2.52,
        mass_kg=1750,
        rolling_resistance_coeff=0.011,
        max_regen_power_kw=100,
        hvac_max_kw=2.8,
        max_charge_rate_kw=88,
    ),
}


def compute_power_kw(
    profile: VehicleEnergyProfile,
    speed_mps: float,
    gradient_deg: float = 0.0,
    temperature_celsius: float = 25.0,
    use_hvac: bool = True,
    traffic_factor: float = 1.0,
) -> Dict[str, float]:
    """
    Compute instantaneous power consumption in kW.

    Args:
        profile: Vehicle energy profile
        speed_mps: Speed in metres per second
        gradient_deg: Road gradient in degrees (positive = uphill)
        temperature_celsius: Ambient temperature
        use_hvac: Whether HVAC is active
        traffic_factor: 1.0 = free flow; >1.0 = congested (stop-go increases losses)

    Returns:
        Dict with power breakdown and total in kW
    """
    # Rolling resistance power (W)
    p_rolling = profile.mass_kg * GRAVITY * profile.rolling_resistance_coeff * speed_mps

    # Aerodynamic drag power (W)  — cubed relationship
    p_aero = 0.5 * AIR_DENSITY * profile.drag_coefficient * profile.frontal_area_m2 * (speed_mps ** 3)

    # Gradient power (W)
    theta_rad = math.radians(gradient_deg)
    p_gradient = profile.mass_kg * GRAVITY * math.sin(theta_rad) * speed_mps

    # HVAC power — weather dependent
    if use_hvac:
        temp_delta = abs(temperature_celsius - 22.0)  # comfort at 22°C
        hvac_fraction = min(temp_delta / 20.0, 1.0)
        p_hvac_w = profile.hvac_max_kw * hvac_fraction * 1000
    else:
        p_hvac_w = 0.0

    # Drivetrain losses (~12% overhead)
    drivetrain_efficiency = 0.88
    mechanical_power = p_rolling + p_aero + p_gradient

    # Traffic stop-go penalty: +15% per 0.5 traffic factor above 1
    traffic_penalty = 1.0 + (max(traffic_factor - 1.0, 0) * 0.15)
    total_mechanical_w = mechanical_power * traffic_penalty

    total_kw = (total_mechanical_w / drivetrain_efficiency + p_hvac_w) / 1000.0

    return {
        "rolling_kw": round(p_rolling / 1000, 3),
        "aero_kw": round(p_aero / 1000, 3),
        "gradient_kw": round(p_gradient / 1000, 3),
        "hvac_kw": round(p_hvac_w / 1000, 3),
        "total_kw": round(max(total_kw, 0.1), 3),
    }


def predict_range(
    profile: VehicleEnergyProfile,
    current_soc_percent: float,
    speed_kmh: float = 60.0,
    temperature_celsius: float = 25.0,
    use_hvac: bool = True,
    elevation_gain_m: float = 0.0,
    distance_km: float = 100.0,
    traffic_factor: float = 1.0,
) -> Dict:
    """
    Predict EV range from current SOC and driving conditions.

    Returns range estimation with confidence interval.
    """
    speed_mps = speed_kmh / 3.6

    # Average gradient if elevation gain provided over distance
    if distance_km > 0 and elevation_gain_m != 0:
        avg_gradient_deg = math.degrees(math.atan(elevation_gain_m / (distance_km * 1000)))
    else:
        avg_gradient_deg = 0.0

    power_breakdown = compute_power_kw(
        profile=profile,
        speed_mps=speed_mps,
        gradient_deg=avg_gradient_deg,
        temperature_celsius=temperature_celsius,
        use_hvac=use_hvac,
        traffic_factor=traffic_factor,
    )

    total_power_kw = power_breakdown["total_kw"]
    efficiency_wh_per_km = (total_power_kw / speed_kmh) * 1000

    usable_energy = profile.usable_capacity_kwh * (current_soc_percent / 100.0)
    estimated_range_km = (usable_energy * 1000.0) / efficiency_wh_per_km

    # Confidence interval using ±15% variance (weather, driving style)
    low = estimated_range_km * 0.85
    high = estimated_range_km * 1.12

    warnings = []
    if temperature_celsius < 5:
        warnings.append("Cold temperature significantly reduces battery range")
        estimated_range_km *= 0.80
    if temperature_celsius > 40:
        warnings.append("High temperature may stress battery")
        estimated_range_km *= 0.92
    if current_soc_percent < 20:
        warnings.append("Low SOC — range accuracy decreases below 20%")

    return {
        "vehicle_id": profile.vehicle_id,
        "vehicle_name": profile.name,
        "current_soc_percent": current_soc_percent,
        "usable_energy_kwh": round(usable_energy, 2),
        "estimated_range_km": round(estimated_range_km, 1),
        "efficiency_wh_per_km": round(efficiency_wh_per_km, 1),
        "power_breakdown": power_breakdown,
        "confidence_interval": {
            "low_km": round(low, 1),
            "mid_km": round(estimated_range_km, 1),
            "high_km": round(high, 1),
        },
        "warnings": warnings,
    }
