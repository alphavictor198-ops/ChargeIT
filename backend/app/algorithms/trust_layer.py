"""
Bayesian Trust Layer for charging station reliability scoring.

Each station gets a trust score in [0, 1] based on:
 - Official API data (base prior)
 - User positive/negative reports
 - Time decay (recent events weight more)
 - Verified downtime incidents

Uses a Beta distribution as the prior: Beta(α, β)
  α = positive evidence (working, confirmed available)
  β = negative evidence (failures, wrong availability)

Score = α / (α + β) after updates
"""
import math
from datetime import datetime, timezone
from typing import List, Optional
from dataclasses import dataclass


DECAY_HALF_LIFE_DAYS = 30  # positive evidence decays slower than negative
NEGATIVE_DECAY_HALF_LIFE_DAYS = 7  # negative reports decay faster


@dataclass
class TrustEvidence:
    """A single piece of evidence for the trust model."""
    is_positive: bool
    weight: float
    recorded_at: datetime


def time_decay_weight(recorded_at: datetime, half_life_days: float = 30.0) -> float:
    """Exponential time decay weight. Recent events have weight ~1.0."""
    now = datetime.now(timezone.utc)
    age_days = (now - recorded_at).total_seconds() / 86400.0
    return math.exp(-age_days * math.log(2) / half_life_days)


def compute_trust_score(
    evidence_list: List[TrustEvidence],
    alpha_prior: float = 2.0,  # weakly positive prior
    beta_prior: float = 1.0,
) -> float:
    """
    Compute Bayesian trust score using Beta(α, β) conjugate model.

    Args:
        evidence_list: List of weighted evidence items
        alpha_prior: Beta distribution α (positive prior)
        beta_prior: Beta distribution β (negative prior)

    Returns:
        Trust score in [0, 1]
    """
    alpha = alpha_prior
    beta = beta_prior

    for ev in evidence_list:
        half_life = DECAY_HALF_LIFE_DAYS if ev.is_positive else NEGATIVE_DECAY_HALF_LIFE_DAYS
        w = time_decay_weight(ev.recorded_at, half_life) * ev.weight
        if ev.is_positive:
            alpha += w
        else:
            beta += w

    return round(alpha / (alpha + beta), 4)


def score_from_reports(
    total_reports: int,
    negative_reports: int,
    verified_downtime_incidents: int = 0,
    last_verified_at: Optional[datetime] = None,
) -> float:
    """
    Quick trust score from aggregate report counts.

    Args:
        total_reports: Total user reports
        negative_reports: Number of negative/failure reports
        verified_downtime_incidents: Confirmed downtime events
        last_verified_at: When station was last confirmed working

    Returns:
        Trust score in [0, 1]
    """
    evidence: List[TrustEvidence] = []

    positive_reports = total_reports - negative_reports
    now = datetime.now(timezone.utc)

    # Add positive evidence
    for _ in range(positive_reports):
        evidence.append(TrustEvidence(is_positive=True, weight=1.0, recorded_at=now))

    # Add negative evidence
    for _ in range(negative_reports):
        evidence.append(TrustEvidence(is_positive=False, weight=1.5, recorded_at=now))

    # Downtime carries extra weight
    for _ in range(verified_downtime_incidents):
        evidence.append(TrustEvidence(is_positive=False, weight=3.0, recorded_at=now))

    # Verification bonus
    if last_verified_at:
        evidence.append(TrustEvidence(is_positive=True, weight=2.0, recorded_at=last_verified_at))

    return compute_trust_score(evidence)
