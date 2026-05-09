"""
Tests for the physics-based EV energy model and algorithms.
"""
import pytest
import math
from app.algorithms.energy_model import (
    VehicleEnergyProfile, compute_power_kw, predict_range, VEHICLE_PROFILES
)
from app.algorithms.erlang_c import erlang_c, predict_wait_time
from app.algorithms.trust_layer import score_from_reports, compute_trust_score, TrustEvidence
from app.algorithms.monte_carlo import simulate_arrival_soc
from datetime import datetime, timezone


# ─── Energy Model Tests ───────────────────────────────────────

class TestEnergyModel:
    def test_vehicle_profiles_exist(self):
        """All Indian EV profiles should be loaded."""
        assert "nexon_ev" in VEHICLE_PROFILES
        assert "tiago_ev" in VEHICLE_PROFILES
        assert "mg_zs_ev" in VEHICLE_PROFILES
        assert "byd_atto3" in VEHICLE_PROFILES

    def test_power_at_zero_speed_minimal(self):
        """At zero speed, only HVAC should draw power."""
        profile = VEHICLE_PROFILES["nexon_ev"]
        result = compute_power_kw(profile, speed_mps=0.1, gradient_deg=0, temperature_celsius=35, use_hvac=True)
        assert result["total_kw"] > 0
        assert result["hvac_kw"] > 0

    def test_aero_drag_cubed_relationship(self):
        """Aerodynamic drag should increase with the cube of speed."""
        profile = VEHICLE_PROFILES["nexon_ev"]
        p1 = compute_power_kw(profile, speed_mps=10, gradient_deg=0, temperature_celsius=25, use_hvac=False)
        p2 = compute_power_kw(profile, speed_mps=20, gradient_deg=0, temperature_celsius=25, use_hvac=False)
        # At double speed, aero drag should be ~8x (v³)
        assert p2["aero_kw"] > p1["aero_kw"] * 5

    def test_uphill_increases_power(self):
        """Going uphill should require more power than flat road."""
        profile = VEHICLE_PROFILES["nexon_ev"]
        flat = compute_power_kw(profile, speed_mps=15, gradient_deg=0, temperature_celsius=25, use_hvac=False)
        uphill = compute_power_kw(profile, speed_mps=15, gradient_deg=5, temperature_celsius=25, use_hvac=False)
        assert uphill["total_kw"] > flat["total_kw"]
        assert uphill["gradient_kw"] > 0

    def test_predict_range_decreases_with_low_soc(self):
        """Higher SOC should give more range."""
        profile = VEHICLE_PROFILES["nexon_ev"]
        r_full = predict_range(profile, 100.0, speed_kmh=60)
        r_half = predict_range(profile, 50.0, speed_kmh=60)
        assert r_full["estimated_range_km"] > r_half["estimated_range_km"]

    def test_cold_weather_penalty(self):
        """Cold weather should add warnings and reduce range."""
        profile = VEHICLE_PROFILES["nexon_ev"]
        result = predict_range(profile, 80.0, temperature_celsius=2)
        assert any("Cold" in w for w in result["warnings"])

    def test_confidence_interval_ordering(self):
        """Confidence interval low < mid < high."""
        profile = VEHICLE_PROFILES["mg_zs_ev"]
        result = predict_range(profile, 75.0)
        ci = result["confidence_interval"]
        assert ci["low_km"] < ci["mid_km"] < ci["high_km"]


# ─── Erlang-C Tests ───────────────────────────────────────────

class TestErlangC:
    def test_erlang_c_free_system(self):
        """Light load should give near-zero wait probability."""
        # 4 chargers, 1 vehicle per hour, 2 hours per vehicle
        p = erlang_c(num_servers=4, arrival_rate=1, service_rate=0.5)
        assert p < 0.2

    def test_erlang_c_overloaded(self):
        """Overloaded system (rho >= 1) should return 1.0."""
        p = erlang_c(num_servers=2, arrival_rate=10, service_rate=2)
        assert p == 1.0

    def test_no_wait_when_slots_available(self):
        """If chargers are free, wait should be 0."""
        result = predict_wait_time(
            total_chargers=4,
            occupied_chargers=0,
            queue_length=0,
            avg_charge_time_min=30,
            arrival_rate_per_hour=1,
        )
        assert result["estimated_wait_min"] == 0.0

    def test_wait_increases_with_queue(self):
        """Larger queue should mean longer wait."""
        r1 = predict_wait_time(4, 3, 1, 45, 2)
        r2 = predict_wait_time(4, 3, 5, 45, 2)
        assert r2["estimated_wait_min"] >= r1["estimated_wait_min"]


# ─── Trust Layer Tests ────────────────────────────────────────

class TestTrustLayer:
    def test_high_trust_for_verified_station(self):
        """Station with only positive reports and recent verification should score high."""
        score = score_from_reports(
            total_reports=10,
            negative_reports=0,
            verified_downtime_incidents=0,
            last_verified_at=datetime.now(timezone.utc),
        )
        assert score > 0.7

    def test_low_trust_for_frequent_failures(self):
        """Frequent negative reports should lower trust score."""
        score = score_from_reports(
            total_reports=10,
            negative_reports=9,
            verified_downtime_incidents=2,
        )
        assert score < 0.4

    def test_trust_range_valid(self):
        """Trust score must always be in [0, 1]."""
        for total in [0, 5, 20, 100]:
            for neg in [0, total // 2, total]:
                score = score_from_reports(total, neg)
                assert 0.0 <= score <= 1.0


# ─── Monte Carlo Tests ────────────────────────────────────────

class TestMonteCarlo:
    def test_sufficient_soc_for_short_trip(self):
        """100% SOC, short trip should arrive with high SOC."""
        profile = VEHICLE_PROFILES["nexon_ev"]
        result = simulate_arrival_soc(
            profile=profile,
            distance_km=30,
            current_soc_percent=100.0,
            speed_kmh=60,
            n_simulations=200,
        )
        assert result["p50_soc"] > 50

    def test_insufficient_soc_gives_failures(self):
        """Very low SOC for long trip should show failure probability > 0."""
        profile = VEHICLE_PROFILES["tiago_ev"]
        result = simulate_arrival_soc(
            profile=profile,
            distance_km=250,
            current_soc_percent=10.0,
            speed_kmh=80,
            n_simulations=200,
        )
        assert result["failure_probability"] > 0

    def test_percentiles_ordered(self):
        """p5 <= p25 <= p50 <= p75 <= p95."""
        profile = VEHICLE_PROFILES["byd_atto3"]
        result = simulate_arrival_soc(profile, 100, 70, n_simulations=200)
        assert result["p5_soc"] <= result["p25_soc"] <= result["p50_soc"]
        assert result["p50_soc"] <= result["p75_soc"] <= result["p95_soc"]
