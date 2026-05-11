/**
 * Human State Score Engine
 * ========================
 * A single number between 0–100. Like a battery % — but for the human.
 * 
 * Five weighted inputs:
 *   1. Drive Duration     → 30 points
 *   2. Time of Day        → 20 points
 *   3. Micro-Swerve       → 25 points  (accelerometer lateral variance)
 *   4. Braking Pattern    → 15 points  (hard-brake count in last 15 min)
 *   5. Blink Rate (opt-in)→ 10 points  (placeholder for camera integration)
 */

// ─── Types ────────────────────────────────────────────────────────
export interface HSSBreakdown {
  driveDuration: number;   // 0–35
  timeOfDay: number;       // 0–25
  microSwerve: number;     // 0–25
  brakingPattern: number;  // 0–15
}

export interface HSSResult {
  score: number;           // 0–100
  color: 'green' | 'yellow' | 'red';
  status: string;
  breakdown: HSSBreakdown;
}

export type PassengerProfile = 'solo' | 'partner' | 'infant' | 'child' | 'elderly' | 'pet';

export interface SyncStopRecommendation {
  triggered: boolean;
  reason: 'battery' | 'human' | 'both' | 'passenger' | null;
  stationName: string;
  stationDistanceKm: number;
  stationLat: number;
  stationLng: number;
  batteryPercent: number;
  chargeTimeMin: number;
  humanScore: number;
  driveDurationMin: number;
  message: string;
}

export interface PostHaltNudge {
  minutesStopped: number;
  message: string;
  type: 'info' | 'optimal' | 'ready' | 'warning';
}

// ─── 1. Drive Duration Score (0–35) ──────────────────────────────
export function scoreDriveDuration(minutes: number): number {
  if (minutes <= 60) return 35;
  if (minutes <= 90) return 35 - ((minutes - 60) / 30) * 10;   // 35 → 25
  if (minutes <= 120) return 25 - ((minutes - 90) / 30) * 15;  // 25 → 10
  return Math.max(0, 10 - ((minutes - 120) / 60) * 10);        // 10 → 0
}

// ─── 2. Time of Day Score (0–25) ─────────────────────────────────
export function scoreTimeOfDay(hour: number): number {
  // Post-lunch dip: 2PM–4PM
  if (hour >= 14 && hour < 16) return 12;
  // Circadian low: 11PM–5AM
  if (hour >= 23 || hour < 5) return 8;
  // Transition zones
  if (hour >= 21 && hour < 23) return 18;
  if (hour >= 5 && hour < 7) return 20;
  return 25; // Full score during alert hours
}

// ─── 3. Micro-Swerve Score (0–25) ────────────────────────────────
// lateralVariance = standard deviation of accelerometer Y-axis readings
// Normal driving: variance < 0.3
// Fatigued driving: variance > 0.8
export function scoreMicroSwerve(lateralVariance: number): number {
  if (lateralVariance <= 0.15) return 25;
  if (lateralVariance <= 0.25) return 18;
  if (lateralVariance <= 0.40) return 10;
  if (lateralVariance <= 0.60) return 5;
  return 0;
}

// ─── 4. Braking Pattern Score (0–15) ─────────────────────────────
// hardBrakeCount = number of >0.4g deceleration events in last 15 min
export function scoreBrakingPattern(hardBrakeCount: number): number {
  if (hardBrakeCount === 0) return 15;
  if (hardBrakeCount === 1) return 8; // Heavy drop for even 1 hard brake
  if (hardBrakeCount === 2) return 3;
  return 0;
}



// ─── Combined Score ──────────────────────────────────────────────
export function calculateHSS(
  driveDurationMin: number,
  currentHour: number,
  lateralVariance: number,
  hardBrakeCount: number
): HSSResult {
  const breakdown: HSSBreakdown = {
    driveDuration: Math.round(scoreDriveDuration(driveDurationMin)),
    timeOfDay: Math.round(scoreTimeOfDay(currentHour)),
    microSwerve: Math.round(scoreMicroSwerve(lateralVariance)),
    brakingPattern: Math.round(scoreBrakingPattern(hardBrakeCount)),
  };

  const score = Math.round(
    breakdown.driveDuration +
    breakdown.timeOfDay +
    breakdown.microSwerve +
    breakdown.brakingPattern
  );

  let color: 'green' | 'yellow' | 'red';
  let status: string;
  if (score >= 80) { color = 'green'; status = 'Sharp & Alert'; }
  else if (score >= 50) { color = 'yellow'; status = 'Early Fatigue Detected'; }
  else { color = 'red'; status = 'Danger Zone — Rest Needed'; }

  return { score, color, status, breakdown };
}

// ─── Passenger Profile Modifiers ─────────────────────────────────
export function getMaxDriveMinutes(profiles: PassengerProfile[]): number {
  if (profiles.includes('infant')) return 90;   // Feeding schedule
  if (profiles.includes('child')) return 90;    // Restlessness
  if (profiles.includes('elderly')) return 80;  // Comfort
  if (profiles.includes('pet')) return 100;     // Exercise needs
  return 120; // Solo / partner
}

export function getPassengerStopMessage(profiles: PassengerProfile[]): string | null {
  if (profiles.includes('infant')) return 'Feeding window approaching. This stop has a quiet family room.';
  if (profiles.includes('child')) return 'Time for a stretch! This stop has a play area nearby.';
  if (profiles.includes('elderly')) return 'Comfort stop recommended. This station has accessible seating.';
  if (profiles.includes('pet')) return 'Your pet needs a walk! Green space 200m from this charger.';
  return null;
}

// ─── Synchronized Stop Engine ────────────────────────────────────
export function checkSyncStop(
  batteryPercent: number,
  rangeKm: number,
  hssResult: HSSResult,
  driveDurationMin: number,
  profiles: PassengerProfile[],
  nextStationName: string,
  nextStationDistKm: number,
  nextStationLat: number,
  nextStationLng: number,
  nextStationPowerKw: number
): SyncStopRecommendation {
  const maxDrive = getMaxDriveMinutes(profiles);
  
  const batteryNeedStop = batteryPercent <= 25 || rangeKm <= 60;
  const humanNeedStop = hssResult.score < 50;
  const passengerNeedStop = driveDurationMin >= maxDrive && profiles.length > 0 && !profiles.includes('solo');
  const earlyFatigue = hssResult.score < 65 && driveDurationMin > 60;

  const triggered = batteryNeedStop || humanNeedStop || passengerNeedStop || earlyFatigue;

  if (!triggered) {
    return {
      triggered: false, reason: null,
      stationName: '', stationDistanceKm: 0, stationLat: 0, stationLng: 0,
      batteryPercent, chargeTimeMin: 0, humanScore: hssResult.score,
      driveDurationMin, message: ''
    };
  }

  let reason: 'battery' | 'human' | 'both' | 'passenger';
  let message: string;

  if (batteryNeedStop && humanNeedStop) {
    reason = 'both';
    message = `Your car AND you both need a break. Perfect sync — charge the car, recharge yourself.`;
  } else if (humanNeedStop) {
    reason = 'human';
    message = `Fatigue detected. You've been driving ${driveDurationMin} mins. Your alertness is dropping.`;
  } else if (batteryNeedStop) {
    reason = 'battery';
    message = `Battery at ${batteryPercent}%. Charging recommended before range runs critically low.`;
  } else {
    reason = 'passenger';
    message = getPassengerStopMessage(profiles) || `Time for a comfort stop. You've been driving ${driveDurationMin} mins.`;
  }

  const energyToAdd = ((80 - batteryPercent) / 100) * 40; // Approx kWh
  const chargeTimeMin = Math.round((energyToAdd / nextStationPowerKw) * 60);

  return {
    triggered: true, reason,
    stationName: nextStationName,
    stationDistanceKm: nextStationDistKm,
    stationLat: nextStationLat,
    stationLng: nextStationLng,
    batteryPercent,
    chargeTimeMin: Math.max(chargeTimeMin, 15),
    humanScore: hssResult.score,
    driveDurationMin,
    message
  };
}

// ─── Post-Halt Re-Entry Nudge ────────────────────────────────────
export function getPostHaltNudge(minutesStopped: number): PostHaltNudge {
  if (minutesStopped < 10) {
    return { minutesStopped, message: 'Relax. Your charge has just started. Take a moment to breathe.', type: 'info' };
  }
  if (minutesStopped < 17) {
    return { minutesStopped, message: 'Having coffee? It\'ll peak in your system in ' + (25 - minutesStopped) + ' mins — perfect timing with your charge.', type: 'info' };
  }
  if (minutesStopped < 22) {
    return { minutesStopped, message: 'Your alertness reset window is NOW. Optimal moment to stretch and prepare to resume.', type: 'optimal' };
  }
  if (minutesStopped < 35) {
    return { minutesStopped, message: 'You\'re in the green zone physically. Ready when you are.', type: 'ready' };
  }
  return { minutesStopped, message: 'Sitting too long causes stiffness. A 2-min walk before resuming sharpens reaction time.', type: 'warning' };
}
