"""
Monte Carlo simulation for arrival SOC confidence intervals.

Simulates N trips under uncertainty (traffic, weather, driving style)
to produce a confidence interval for State of Charge at destination.
"""
import math
import random
from typing import Dict, List
from app.algorithms.energy_model import (
    VehicleEnergyProfile, VEHICLE_PROFILES, compute_power_kw
)

N_SIMULATIONS = 1000


def simulate_arrival_soc(
    profile: VehicleEnergyProfile,
    distance_km: float,
    current_soc_percent: float,
    speed_kmh: float = 60.0,
    temperature_celsius: float = 25.0,
    use_hvac: bool = True,
    elevation_gain_m: float = 0.0,
    traffic_factor: float = 1.0,
    n_simulations: int = N_SIMULATIONS,
) -> Dict:
    """
    Run Monte Carlo simulation to estimate arrival SOC.

    Adds Gaussian noise to key parameters to model real-world variability.

    Returns:
        Dict with p5, p25, p50, p75, p95 percentiles and failure probability
    """
    results: List[float] = []

    base_speed_mps = speed_kmh / 3.6

    for _ in range(n_simulations):
        # Perturb parameters with realistic variance
        sim_speed_mps = max(base_speed_mps * random.gauss(1.0, 0.08), 1.0)
        sim_traffic = max(traffic_factor * random.gauss(1.0, 0.15), 0.5)
        sim_temp = temperature_celsius + random.gauss(0, 2.0)
        sim_elevation = elevation_gain_m * random.gauss(1.0, 0.10)

        if distance_km > 0 and sim_elevation != 0:
            avg_gradient_deg = math.degrees(math.atan(sim_elevation / (distance_km * 1000)))
        else:
            avg_gradient_deg = 0.0

        breakdown = compute_power_kw(
            profile=profile,
            speed_mps=sim_speed_mps,
            gradient_deg=avg_gradient_deg,
            temperature_celsius=sim_temp,
            use_hvac=use_hvac,
            traffic_factor=sim_traffic,
        )

        power_kw = breakdown["total_kw"]
        speed_kmh_sim = sim_speed_mps * 3.6
        efficiency_wh_per_km = (power_kw / speed_kmh_sim) * 1000

        energy_consumed_kwh = (efficiency_wh_per_km * distance_km) / 1000.0
        usable_kwh = profile.usable_capacity_kwh * (current_soc_percent / 100.0)
        remaining_kwh = usable_kwh - energy_consumed_kwh
        arrival_soc = max((remaining_kwh / profile.usable_capacity_kwh) * 100.0, 0.0)
        results.append(arrival_soc)

    results.sort()

    def percentile(p: float) -> float:
        idx = int((p / 100.0) * len(results))
        return round(results[min(idx, len(results) - 1)], 1)

    failure_prob = sum(1 for r in results if r <= 0) / len(results)

    return {
        "p5_soc": percentile(5),
        "p25_soc": percentile(25),
        "p50_soc": percentile(50),
        "p75_soc": percentile(75),
        "p95_soc": percentile(95),
        "failure_probability": round(failure_prob, 3),
        "n_simulations": n_simulations,
        "mean_arrival_soc": round(sum(results) / len(results), 1),
    }
