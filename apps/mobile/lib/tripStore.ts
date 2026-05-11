/**
 * Trip Store — Persistent trip data using AsyncStorage
 * Stores trip history for the Trip Memory Card feature.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TripRecord {
  id: string;
  date: string;
  startTime: number;   // timestamp
  endTime: number;      // timestamp
  totalDistanceKm: number;
  totalDurationMin: number;
  chargingStopsTaken: number;
  batteryStart: number;
  batteryEnd: number;
  
  // Human performance
  avgHumanScore: number;
  lowestHumanScore: number;
  fatigueOnsetMin: number | null;   // minutes into trip when score first dropped below 65
  hardBrakeEvents: number;
  smoothestWindowKm: string;        // e.g., "km 12–38"
  
  // Stop analysis
  recommendedStops: number;
  actualStops: number;
  humanEfficiencyScore: number;     // 0–100
  
  // Passenger profile used
  passengers: string[];
  
  // Score samples over time for graphing
  scoreSamples: { minutesMark: number; score: number }[];
}

const TRIPS_KEY = '@gaticharge_trips';

export async function saveTrip(trip: TripRecord): Promise<void> {
  try {
    const existing = await getTrips();
    existing.unshift(trip); // Most recent first
    // Keep last 50 trips
    const trimmed = existing.slice(0, 50);
    await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Error saving trip:', e);
  }
}

export async function getTrips(): Promise<TripRecord[]> {
  try {
    const data = await AsyncStorage.getItem(TRIPS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error loading trips:', e);
    return [];
  }
}

export async function getPatternInsight(trips: TripRecord[]): Promise<string> {
  if (trips.length < 2) return 'Complete more trips to unlock personal insights.';
  
  if (trips.length >= 20) {
    const avgFatigue = trips
      .filter(t => t.fatigueOnsetMin !== null)
      .reduce((sum, t) => sum + (t.fatigueOnsetMin || 0), 0) / trips.filter(t => t.fatigueOnsetMin !== null).length;
    return `Over ${trips.length} trips, your average fatigue onset is at ${Math.round(avgFatigue)} mins. We've optimized your stop suggestions accordingly.`;
  }
  
  if (trips.length >= 10) {
    const morningTrips = trips.filter(t => {
      const h = new Date(t.startTime).getHours();
      return h >= 6 && h < 12;
    });
    const eveningTrips = trips.filter(t => {
      const h = new Date(t.startTime).getHours();
      return h >= 17 && h < 23;
    });
    if (morningTrips.length > 2 && eveningTrips.length > 2) {
      const avgMorning = morningTrips.reduce((s, t) => s + t.avgHumanScore, 0) / morningTrips.length;
      const avgEvening = eveningTrips.reduce((s, t) => s + t.avgHumanScore, 0) / eveningTrips.length;
      const diff = Math.round(((avgMorning - avgEvening) / avgEvening) * 100);
      if (diff > 0) return `You drive ${diff}% more smoothly in mornings vs evenings.`;
      else return `You perform ${Math.abs(diff)}% better on evening drives than mornings.`;
    }
  }
  
  if (trips.length >= 5) {
    const fatigueTrips = trips.filter(t => t.fatigueOnsetMin !== null);
    if (fatigueTrips.length >= 3) {
      const avg = fatigueTrips.reduce((s, t) => s + (t.fatigueOnsetMin || 0), 0) / fatigueTrips.length;
      return `You consistently show fatigue after ${Math.round(avg)} mins — ${avg < 100 ? 'earlier' : 'later'} than average driver.`;
    }
  }

  return `${trips.length} trips recorded. Keep driving to unlock deeper insights.`;
}
