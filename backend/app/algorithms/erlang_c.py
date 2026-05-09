"""
Erlang-C queuing model for charging station wait time prediction.

The Erlang-C formula gives the probability that an arriving customer
must wait (P_wait) given:
  - c = number of chargers (servers)
  - λ = arrival rate (vehicles/hour)
  - μ = service rate (vehicles/hour per charger)
  - ρ = traffic intensity = λ / (c * μ)

E_c(c, ρ) = P(wait > 0) — the Erlang-C probability
"""
import math
from typing import Optional


def erlang_c(num_servers: int, arrival_rate: float, service_rate: float) -> float:
    """
    Compute Erlang-C probability P(wait > 0).

    Args:
        num_servers: Number of chargers (c)
        arrival_rate: Arrival rate in vehicles per hour (λ)
        service_rate: Service rate in vehicles per hour per charger (μ)

    Returns:
        Probability that an arriving vehicle must wait (0-1)
    """
    if num_servers <= 0 or arrival_rate <= 0 or service_rate <= 0:
        return 0.0

    c = num_servers
    lam = arrival_rate
    mu = service_rate
    rho = lam / (c * mu)  # utilization

    if rho >= 1.0:
        # System is overloaded — wait probability is 1
        return 1.0

    # P(0) calculation using Erlang-C numerator/denominator
    # Numerator: (c*rho)^c / c! * 1/(1-rho)
    # Sum: Σ_{k=0}^{c-1} (c*rho)^k / k!
    a = lam / mu  # offered load
    numerator = (a ** c) / math.factorial(c) * (1.0 / (1.0 - rho))

    sum_terms = sum((a ** k) / math.factorial(k) for k in range(c))
    denominator = sum_terms + numerator

    p_wait = numerator / denominator
    return min(max(p_wait, 0.0), 1.0)


def predict_wait_time(
    total_chargers: int,
    occupied_chargers: int,
    queue_length: int,
    avg_charge_time_min: float = 45.0,
    arrival_rate_per_hour: float = 3.0,
) -> dict:
    """
    Predict expected wait time using Erlang-C queuing model.

    Args:
        total_chargers: Total number of chargers at station
        occupied_chargers: Number of chargers currently in use
        queue_length: Number of vehicles currently waiting
        avg_charge_time_min: Average time each vehicle spends charging
        arrival_rate_per_hour: Expected vehicle arrivals per hour

    Returns:
        Dict with wait estimate, queue probability, and utilization
    """
    available = max(total_chargers - occupied_chargers, 0)

    # If there are free chargers and no queue → no wait
    if available > 0 and queue_length == 0:
        return {
            "estimated_wait_min": 0.0,
            "queue_length": 0,
            "probability_no_wait": 1.0 - erlang_c(total_chargers, arrival_rate_per_hour, 60.0 / avg_charge_time_min),
            "charger_utilization_percent": round((occupied_chargers / total_chargers) * 100, 1),
        }

    service_rate_per_hour = 60.0 / avg_charge_time_min  # vehicles per hour per charger
    p_wait = erlang_c(total_chargers, arrival_rate_per_hour, service_rate_per_hour)

    # Mean waiting time for those who wait (in hours)
    rho = arrival_rate_per_hour / (total_chargers * service_rate_per_hour)
    if rho < 1.0 and total_chargers > 0:
        mean_wait_hours = (p_wait / (total_chargers * service_rate_per_hour * (1 - rho)))
    else:
        mean_wait_hours = avg_charge_time_min / 60.0  # fallback: one full session

    # Add extra wait for existing queue
    extra_wait_min = queue_length * (avg_charge_time_min / total_chargers)
    total_wait_min = (mean_wait_hours * 60.0) + extra_wait_min

    return {
        "estimated_wait_min": round(total_wait_min, 1),
        "queue_length": queue_length,
        "probability_no_wait": round(1.0 - p_wait, 3),
        "charger_utilization_percent": round((occupied_chargers / max(total_chargers, 1)) * 100, 1),
    }
