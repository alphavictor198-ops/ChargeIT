import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking, Vibration } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Accelerometer } from 'expo-sensors';
import * as Speech from 'expo-speech';
import {
  calculateHSS, HSSResult, checkSyncStop, SyncStopRecommendation,
  getPostHaltNudge, PostHaltNudge, PassengerProfile, getMaxDriveMinutes, getPassengerStopMessage
} from '../lib/humanStateEngine';
import { CHARGING_HUBS } from '../lib/physics';
import { useVehicle } from '../lib/VehicleContext';

type RouteParams = { passengers: string[] };

export default function ActiveTripScreen() {
  const route = useRoute<RouteProp<{ ActiveTrip: RouteParams }, 'ActiveTrip'>>();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { spec, batteryPercent: initialBattery } = useVehicle();
  const passengers = (route.params?.passengers || ['solo']) as PassengerProfile[];

  // ─── State ───────────────────────────────────────────────
  const [tripStartTime] = useState(Date.now());
  const [driveDurationMin, setDriveDurationMin] = useState(0);
  const [batteryPercent, setBatteryPercent] = useState(initialBattery);
  const [rangeKm, setRangeKm] = useState(Math.round((initialBattery * spec.battery_kwh * 10) / spec.efficiency_wh_per_km));

  const [hssResult, setHssResult] = useState<HSSResult>({
    score: 100, color: 'green', status: 'Sharp & Alert',
    breakdown: { driveDuration: 30, timeOfDay: 20, microSwerve: 25, brakingPattern: 15, blinkRate: 10 }
  });

  const [syncStop, setSyncStop] = useState<SyncStopRecommendation | null>(null);
  const [isHalted, setIsHalted] = useState(false);
  const [haltStartTime, setHaltStartTime] = useState<number | null>(null);
  const [haltNudge, setHaltNudge] = useState<PostHaltNudge | null>(null);
  const [showFeeling, setShowFeeling] = useState(false);

  // Accelerometer data
  const accelSamples = useRef<number[]>([]);
  const hardBrakeCount = useRef(0);
  const hardBrakeTimestamps = useRef<number[]>([]);

  // Score samples for trip memory
  const scoreSamples = useRef<{ minutesMark: number; score: number }[]>([]);
  const fatigueOnsetMin = useRef<number | null>(null);

  // Audio state
  const hasSpoken = useRef(false);

  // ─── Accelerometer Listener ──────────────────────────────
  useEffect(() => {
    Accelerometer.setUpdateInterval(100); // 10 samples per second for high-fidelity detection
    const sub = Accelerometer.addListener(data => {
      // Lateral swerve = Y-axis movement
      accelSamples.current.push(Math.abs(data.y));
      // Keep only last 100 samples (10 seconds of data for responsive swerve tracking)
      if (accelSamples.current.length > 100) accelSamples.current.shift();

      // Hard brake detection = sudden Z-axis spike (> 0.4g change)
      if (Math.abs(data.z - 1.0) > 0.4) {
        hardBrakeCount.current++;
        hardBrakeTimestamps.current.push(Date.now());
      }
      // Remove brakes older than 15 minutes
      const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
      hardBrakeTimestamps.current = hardBrakeTimestamps.current.filter(t => t > fifteenMinAgo);
      hardBrakeCount.current = hardBrakeTimestamps.current.length;
    });

    return () => sub.remove();
  }, []);

  // ─── Main Loop — runs every 2 seconds ──────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - tripStartTime) / 60000);
      setDriveDurationMin(elapsed);

      // Simulate battery drain based on vehicle efficiency (Wh/km)
      // At highway speed (65km/h), drain per minute is (efficiency * 65 / 60) Wh.
      const whPerMin = (spec.efficiency_wh_per_km * 65) / 60;
      const totalWhConsumed = whPerMin * elapsed;
      const socDrain = (totalWhConsumed / (spec.battery_kwh * 1000)) * 100;
      
      const currentBattery = Math.max(2, initialBattery - socDrain);
      setBatteryPercent(Math.round(currentBattery));
      
      // Dynamic range calculation
      const usableKwh = spec.battery_kwh * (currentBattery / 100);
      const estRange = (usableKwh * 1000) / spec.efficiency_wh_per_km;
      setRangeKm(Math.round(estRange));

      // Calculate lateral variance from accelerometer
      const samples = accelSamples.current;
      let variance = 0.15; // Default — smooth
      if (samples.length > 5) {
        const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
        variance = Math.sqrt(samples.reduce((s, x) => s + (x - mean) ** 2, 0) / samples.length);
      }

      // Calculate HSS
      const hour = new Date().getHours();
      const hss = calculateHSS(elapsed, hour, variance, hardBrakeCount.current);
      setHssResult(hss);

      // Track first fatigue onset
      if (hss.score < 65 && fatigueOnsetMin.current === null) {
        fatigueOnsetMin.current = elapsed;
      }

      // Store score sample every 5 minutes
      if (elapsed % 5 === 0) {
        const exists = scoreSamples.current.find(s => s.minutesMark === elapsed);
        if (!exists) scoreSamples.current.push({ minutesMark: elapsed, score: hss.score });
      }

      // Synchronized Stop Engine
      // Find nearest charging hub (using static list as proxy)
      const nearest = CHARGING_HUBS
        .map(h => ({ ...h, dist: Math.random() * 30 + 5 })) // Simulated distance
        .sort((a, b) => a.dist - b.dist)[0];

      const stop = checkSyncStop(
        currentBattery, Math.round(currentBattery * 3.84),
        hss, elapsed, passengers,
        nearest.city, Math.round(nearest.dist),
        nearest.lat, nearest.lng, nearest.power_kw
      );
      setSyncStop(stop);

      // Trigger Audio and Vibration once (Strictly when score < 50)
      if (hss.score < 50 && stop.triggered && !hasSpoken.current) {
        hasSpoken.current = true;
        Vibration.vibrate([500, 200, 500, 200, 500]); // Pulsing vibration

        Speech.speak(
          `Attention driver. Your biological score is low. ${stop.message}. We recommend a synchronized charging stop at ${stop.stationName}, ${stop.stationDistanceKm} kilometers ahead. Please navigate there now.`,
          { rate: 0.95, pitch: 1.0 }
        );
      }

    }, 2000); // Every 2 seconds

    return () => clearInterval(interval);
  }, []);

  // ─── Halt mode timer ─────────────────────────────────────
  useEffect(() => {
    if (!isHalted || !haltStartTime) return;
    const interval = setInterval(() => {
      const mins = Math.floor((Date.now() - haltStartTime) / 60000);
      setHaltNudge(getPostHaltNudge(mins));
    }, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [isHalted, haltStartTime]);

  const handleSimulateHalt = () => {
    setIsHalted(true);
    setHaltStartTime(Date.now());
    setHaltNudge(getPostHaltNudge(0));
  };

  const handleResumeTrip = () => {
    setIsHalted(false);
    setShowFeeling(true);
  };

  const handleFeelingResponse = (feeling: 'sharp' | 'okay' | 'tired') => {
    setShowFeeling(false);
    if (feeling === 'tired') {
      Alert.alert('Take 10 More Minutes', 'We\'ll flag the next charging station sooner on your route.');
    }
  };

  const handleEndTrip = () => {
    navigation.replace('TripSummary', {
      totalDistanceKm: Math.round(driveDurationMin * 1.1), // rough estimate
      totalDurationMin: driveDurationMin,
      chargingStopsTaken: 0,
      batteryStart: 82,
      batteryEnd: batteryPercent,
      avgHumanScore: Math.round(scoreSamples.current.reduce((s, x) => s + x.score, 0) / Math.max(scoreSamples.current.length, 1)),
      lowestHumanScore: Math.min(...scoreSamples.current.map(s => s.score), hssResult.score),
      fatigueOnsetMin: fatigueOnsetMin.current,
      hardBrakeEvents: hardBrakeCount.current,
      passengers,
      scoreSamples: scoreSamples.current,
    });
  };

  const handleNavigateToStop = () => {
    if (syncStop && syncStop.triggered) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${syncStop.stationLat},${syncStop.stationLng}&travelmode=driving`;
      Linking.openURL(url);
    }
  };

  const hssColor = hssResult.color === 'green' ? '#44ffb2' : hssResult.color === 'yellow' ? '#ffdd44' : '#ff4455';

  // ─── Render ──────────────────────────────────────────────
  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Active Trip</Text>
        <TouchableOpacity onPress={handleEndTrip} style={styles.endTripBtn}>
          <Text style={styles.endTripText}>End Trip</Text>
        </TouchableOpacity>
      </View>

      {/* Twin Gauges — Car + Human */}
      <View style={styles.gaugeRow}>
        <View style={styles.gaugeCard}>
          <View style={[styles.gaugeCircle, { borderColor: batteryPercent > 30 ? '#ffaa44' : '#ff4455' }]}>
            <Text style={styles.gaugeValue}>{batteryPercent}%</Text>
          </View>
          <Text style={styles.gaugeLabel}>🔋 Car Battery</Text>
          <Text style={styles.gaugeSub}>{rangeKm} km range</Text>
        </View>

        <View style={styles.gaugeCard}>
          <View style={[styles.gaugeCircle, { borderColor: hssColor }]}>
            <Text style={[styles.gaugeValue, { color: hssColor }]}>{hssResult.score}</Text>
          </View>
          <Text style={styles.gaugeLabel}>🧠 Human Score</Text>
          <Text style={[styles.gaugeSub, { color: hssColor }]}>{hssResult.status}</Text>
        </View>
      </View>

      {/* HSS Breakdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Score Breakdown</Text>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>⏱ Drive Time ({driveDurationMin}m)</Text>
          <Text style={styles.breakdownValue}>{hssResult.breakdown.driveDuration}/30</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>🌙 Time of Day</Text>
          <Text style={styles.breakdownValue}>{hssResult.breakdown.timeOfDay}/20</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>🔀 Driving Smoothness</Text>
          <Text style={styles.breakdownValue}>{hssResult.breakdown.microSwerve}/25</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>🛑 Braking Pattern</Text>
          <Text style={styles.breakdownValue}>{hssResult.breakdown.brakingPattern}/15</Text>
        </View>
      </View>

      {/* Passenger Info */}
      {passengers.length > 0 && !passengers.includes('solo') && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Passenger Mode Active</Text>
          <Text style={styles.passengerText}>
            Travelling with: {passengers.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
          </Text>
          <Text style={styles.passengerNote}>
            Max drive before stop: {getMaxDriveMinutes(passengers)} mins
          </Text>
        </View>
      )}

      {/* Synchronized Stop Card */}
      {syncStop?.triggered && (
        <View style={[styles.card, styles.stopCard]}>
          <Text style={styles.stopTitle}>⚡ Stop Recommended</Text>
          <Text style={styles.stopStation}>{syncStop.stationName} — {syncStop.stationDistanceKm} km ahead</Text>
          <View style={styles.stopDetails}>
            <Text style={styles.stopDetailText}>🔋 Car: {syncStop.batteryPercent}% | needs {syncStop.chargeTimeMin} min charge</Text>
            <Text style={styles.stopDetailText}>🧠 You: Score {syncStop.humanScore} | driving {syncStop.driveDurationMin} mins</Text>
          </View>
          <Text style={styles.stopMessage}>{syncStop.message}</Text>
          <TouchableOpacity style={styles.btnNavigate} onPress={handleNavigateToStop}>
            <Text style={styles.btnNavigateText}>Navigate There</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Halt Mode Controls */}
      <View style={styles.haltSection}>
        {!isHalted ? (
          <TouchableOpacity style={styles.btnHalt} onPress={handleSimulateHalt}>
            <Text style={styles.btnHaltText}>🅿️ I've Stopped / Parked</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🅿️ Halt Mode Active</Text>
            {haltNudge && (
              <View style={[styles.nudgeCard,
              haltNudge.type === 'optimal' && styles.nudgeOptimal,
              haltNudge.type === 'warning' && styles.nudgeWarning,
              ]}>
                <Text style={styles.nudgeText}>{haltNudge.message}</Text>
                <Text style={styles.nudgeTime}>{haltNudge.minutesStopped} min stopped</Text>
              </View>
            )}
            <TouchableOpacity style={styles.btnResume} onPress={handleResumeTrip}>
              <Text style={styles.btnResumeText}>Resume Driving</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* "How are you feeling?" Modal */}
      {showFeeling && (
        <View style={styles.feelingOverlay}>
          <Text style={styles.feelingTitle}>How are you feeling?</Text>
          <TouchableOpacity style={[styles.feelingBtn, { backgroundColor: '#44ffb2' }]} onPress={() => handleFeelingResponse('sharp')}>
            <Text style={styles.feelingBtnText}>✅ Sharp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.feelingBtn, { backgroundColor: '#ffdd44' }]} onPress={() => handleFeelingResponse('okay')}>
            <Text style={styles.feelingBtnText}>🟡 Okay</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.feelingBtn, { backgroundColor: '#ff4455' }]} onPress={() => handleFeelingResponse('tired')}>
            <Text style={styles.feelingBtnText}>🔴 Still Tired</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060404', padding: 20 },
  header: { paddingTop: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { color: '#44ffb2', fontSize: 24, fontWeight: 'bold' },
  endTripBtn: { backgroundColor: '#ff4455', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
  endTripText: { color: 'white', fontWeight: 'bold', fontSize: 14 },

  gaugeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  gaugeCard: { flex: 1, alignItems: 'center', backgroundColor: '#0a0806', borderRadius: 15, padding: 20, marginHorizontal: 5, borderWidth: 1, borderColor: 'rgba(255,107,26,0.15)' },
  gaugeCircle: { width: 90, height: 90, borderRadius: 45, borderWidth: 6, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  gaugeValue: { color: 'white', fontSize: 28, fontWeight: 'bold' },
  gaugeLabel: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  gaugeSub: { color: '#94a3b8', fontSize: 12, marginTop: 4, textAlign: 'center' },

  card: { backgroundColor: '#0a0806', borderRadius: 15, padding: 18, borderWidth: 1, borderColor: 'rgba(255,107,26,0.15)', marginBottom: 15 },
  cardTitle: { color: '#ffaa44', fontSize: 14, marginBottom: 12, opacity: 0.8 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  breakdownLabel: { color: 'white', fontSize: 14 },
  breakdownValue: { color: '#ff6b1a', fontSize: 14, fontWeight: 'bold' },

  passengerText: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  passengerNote: { color: '#ffdd44', fontSize: 13 },

  stopCard: { borderColor: '#ffaa44', backgroundColor: '#120e0a' },
  stopTitle: { color: '#ffaa44', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  stopStation: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  stopDetails: { marginBottom: 10 },
  stopDetailText: { color: '#94a3b8', fontSize: 14, marginBottom: 4 },
  stopMessage: { color: '#ffaa44', fontSize: 14, fontStyle: 'italic', marginBottom: 15 },
  btnNavigate: { backgroundColor: '#ff6b1a', borderRadius: 10, padding: 14, alignItems: 'center' },
  btnNavigateText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  haltSection: { marginBottom: 15 },
  btnHalt: { backgroundColor: 'rgba(255,107,26,0.15)', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,107,26,0.3)' },
  btnHaltText: { color: '#ffaa44', fontSize: 16, fontWeight: 'bold' },
  nudgeCard: { backgroundColor: '#0a0806', borderRadius: 10, padding: 15, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#ff6b1a' },
  nudgeOptimal: { borderLeftColor: '#44ffb2' },
  nudgeWarning: { borderLeftColor: '#ffdd44' },
  nudgeText: { color: 'white', fontSize: 14, marginBottom: 5 },
  nudgeTime: { color: '#94a3b8', fontSize: 12 },
  btnResume: { backgroundColor: '#ff6b1a', borderRadius: 10, padding: 14, alignItems: 'center' },
  btnResumeText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  feelingOverlay: { backgroundColor: '#0a0806', borderRadius: 20, padding: 25, borderWidth: 2, borderColor: 'rgba(255,107,26,0.15)', marginBottom: 15 },
  feelingTitle: { color: 'white', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  feelingBtn: { borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  feelingBtnText: { color: '#060404', fontSize: 18, fontWeight: 'bold' },
});
