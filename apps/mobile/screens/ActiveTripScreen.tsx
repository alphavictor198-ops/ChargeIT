import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking, Vibration, Animated } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Accelerometer } from 'expo-sensors';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { BatteryCharging, Brain, Timer, Zap, MapPin, AlertTriangle, Activity, User, Info } from 'lucide-react-native';
import {
  calculateHSS, HSSResult, checkSyncStop, SyncStopRecommendation,
  getPostHaltNudge, PostHaltNudge, PassengerProfile, getMaxDriveMinutes, getPassengerStopMessage
} from '../lib/humanStateEngine';
import { CHARGING_HUBS } from '../lib/physics';
import { useVehicle } from '../lib/VehicleContext';

type RouteParams = { 
  passengers: string[],
  destinationId?: string,
  destinationName?: string
};

export default function ActiveTripScreen() {
  const route = useRoute<RouteProp<{ ActiveTrip: RouteParams }, 'ActiveTrip'>>();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { spec, batteryPercent: initialBattery } = useVehicle();
  const params = route.params || {};
  const passengers = (params.passengers || ['solo']) as PassengerProfile[];
  const { destinationId, destinationName } = params;

  // Auto-launch Google Maps if destination is provided
  useEffect(() => {
    if (destinationId) {
      const hub = CHARGING_HUBS.find((h, i) => i.toString() === destinationId);
      if (hub) {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${hub.lat},${hub.lng}&travelmode=driving`;
        Linking.openURL(url);
      }
    }
  }, [destinationId]);

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

  // Audio & Animation state
  const hasSpoken = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const warningAnim = useRef(new Animated.Value(0)).current;
  const currentScoreRef = useRef(100);

  useEffect(() => {
    currentScoreRef.current = hssResult.score;
  }, [hssResult.score]);

  // ─── Safety Beep & Vibration Controller ──────────────────
  const playWarningBeep = async () => {
    try {
      // Trigger HUD Flash Animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(warningAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
          Animated.timing(warningAnim, { toValue: 0, duration: 400, useNativeDriver: false })
        ]),
        { iterations: 6 }
      ).start();

      // Configure audio
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      // Start 5-second pulsing vibration pattern
      Vibration.vibrate([0, 500, 200], true); 

      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundjay.com/buttons/beep-07a.mp3' },
        { shouldPlay: true, isLooping: true, volume: 0.8 }
      );
      soundRef.current = sound;

      // Stop both Audio and Vibration after 5 seconds
      setTimeout(async () => {
        Vibration.cancel();
        console.log("[Safety] Vibration stopped.");
        if (soundRef.current) {
          try {
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
          } catch (e) {}
          soundRef.current = null;
        }
      }, 5000);
    } catch (error) {
      console.log("Audio/Vibration Error:", error);
    }
  };

  // ─── High-Fidelity Signal Processing ────────────────────
  const lastAccelZ = useRef(1.0);
  const lastAccelY = useRef(0.0);
  const filterAlpha = 0.15; // Increased smoothing to ignore hand-held jitter
  
  // ─── Accelerometer Listener (Zero Latency) ────────────────
  useEffect(() => {
    Accelerometer.setUpdateInterval(50); 
    const sub = Accelerometer.addListener(data => {
      // 1. Low-Pass Filter to ignore potholes/vibrations
      const filteredY = lastAccelY.current * (1 - filterAlpha) + data.y * filterAlpha;
      const filteredZ = lastAccelZ.current * (1 - filterAlpha) + data.z * filterAlpha;
      
      lastAccelY.current = filteredY;
      lastAccelZ.current = filteredZ;

      // Lateral swerve tracking
      accelSamples.current.push(Math.abs(filteredY));
      if (accelSamples.current.length > 200) accelSamples.current.shift();

      // 2. High-Impact Braking Detection (> 0.85g after filtering)
      const brakeForce = Math.abs(filteredZ - 1.0);
      if (brakeForce > 0.85) {
        const now = Date.now();
        if (hardBrakeTimestamps.current.length === 0 || now - hardBrakeTimestamps.current[hardBrakeTimestamps.current.length - 1] > 6000) {
          hardBrakeCount.current++;
          hardBrakeTimestamps.current.push(now);
          
          if (currentScoreRef.current < 80) {
            Vibration.vibrate([0, 200, 100, 200]); 
            playWarningBeep();
            Speech.speak("Sudden braking detected", { rate: 1.2 });
          }
        }
      }

      // 3. High-G Swerve Detection (> 0.65g)
      if (Math.abs(filteredY) > 0.65) {
        const now = Date.now();
        if (now % 5000 < 50 && currentScoreRef.current < 80) { 
          playWarningBeep();
        }
      }

      // Cleanup old brake events
      const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
      hardBrakeTimestamps.current = hardBrakeTimestamps.current.filter(t => t > fifteenMinAgo);
      hardBrakeCount.current = hardBrakeTimestamps.current.length;
    });

    return () => {
      sub.remove();
      Vibration.cancel(); // Stop any pending vibration on unmount
    };
  }, []);

  // ─── Main Logic Loop — UI & HSS Updates ─────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - tripStartTime) / 60000);
      setDriveDurationMin(elapsed);

      // Simulate battery drain based on vehicle efficiency
      const whPerMin = (spec.efficiency_wh_per_km * 65) / 60;
      const totalWhConsumed = whPerMin * elapsed;
      const socDrain = (totalWhConsumed / (spec.battery_kwh * 1000)) * 100;
      const currentBattery = Math.max(2, initialBattery - socDrain);
      setBatteryPercent(Math.round(currentBattery));
      
      const usableKwh = spec.battery_kwh * (currentBattery / 100);
      const estRange = (usableKwh * 1000) / spec.efficiency_wh_per_km;
      setRangeKm(Math.round(estRange));

      // 3. Calculate Smoothness from Filtered Samples
      const samples = accelSamples.current;
      let variance = 0.1; 
      if (samples.length > 10) {
        const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
        variance = Math.sqrt(samples.reduce((s, x) => s + (x - mean) ** 2, 0) / samples.length);
      }

      // 4. Update HSS (Human State Score)
      const hour = new Date().getHours();
      const hss = calculateHSS(elapsed, hour, variance, hardBrakeCount.current);
      setHssResult(hss);

      if (hss.score < 65 && fatigueOnsetMin.current === null) {
        fatigueOnsetMin.current = elapsed;
      }

      if (elapsed % 5 === 0) {
        const exists = scoreSamples.current.find(s => s.minutesMark === elapsed);
        if (!exists) scoreSamples.current.push({ minutesMark: elapsed, score: hss.score });
      }

      // 5. Intelligent Synchronized Stop Check
      const nearest = CHARGING_HUBS
        .map(h => ({ ...h, dist: Math.random() * 25 + 5 }))
        .sort((a, b) => a.dist - b.dist)[0];

      const stop = checkSyncStop(
        currentBattery, Math.round(currentBattery * 3.8),
        hss, elapsed, passengers,
        nearest.city, Math.round(nearest.dist),
        nearest.lat, nearest.lng, nearest.power_kw
      );
      setSyncStop(stop);

      // Major Score Drop Alert (Biological Warning)
      if (hss.score < 50 && stop.triggered && !hasSpoken.current) {
        hasSpoken.current = true;
        Vibration.vibrate([0, 500, 200, 500]);
        Speech.speak(`Alert. Your focus is declining. ${stop.message}. Recommend stopping in ${stop.stationDistanceKm} km.`);
      }

    }, 2000); 

    return () => clearInterval(interval);
  }, [driveDurationMin, batteryPercent]);

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

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // If we're already navigating away (e.g. to TripSummary), don't intercept
      if (e.data.action.type === 'REPLACE' || e.data.action.type === 'NAVIGATE') {
        return;
      }

      e.preventDefault();

      Alert.alert(
        'End Trip?',
        'Do you want to end your current trip and view the summary?',
        [
          { text: 'No, Continue', style: 'cancel', onPress: () => {} },
          {
            text: 'Yes, End Trip',
            style: 'destructive',
            onPress: () => {
              handleEndTrip();
            },
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, driveDurationMin, batteryPercent, hssResult, passengers]);

  const handleEndTrip = () => {
    navigation.replace('TripSummary', {
      totalDistanceKm: Math.round(driveDurationMin * 1.1), // rough estimate
      totalDurationMin: driveDurationMin,
      chargingStopsTaken: 0,
      batteryStart: initialBattery, // Use the actual start battery from context
      batteryEnd: batteryPercent,
      avgHumanScore: Math.round(scoreSamples.current.reduce((s, x) => s + x.score, 0) / Math.max(scoreSamples.current.length, 1)) || hssResult.score,
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
  const flashBg = warningAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', 'rgba(255, 107, 26, 0.2)']
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#060404' }}>
      {/* Visual Warning Overlay (Flash) */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: flashBg, zIndex: 99, pointerEvents: 'none' }]} />

      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Activity color="#44ffb2" size={24} style={{ marginRight: 10 }} />
            <Text style={styles.headerTitle}>GATI HUD</Text>
          </View>
          {destinationId && (
            <TouchableOpacity 
              onPress={() => {
                const hub = CHARGING_HUBS.find((h, i) => i.toString() === destinationId);
                if (hub) {
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${hub.lat},${hub.lng}&travelmode=driving`;
                  Linking.openURL(url);
                }
              }} 
              style={styles.resumeNavBtn}
            >
              <Text style={styles.resumeNavText}>RESUME MAPS</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            onPress={() => {
              Alert.alert(
                'End Trip?',
                'Are you sure you want to finish your journey?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'End Trip', style: 'destructive', onPress: handleEndTrip }
                ]
              );
            }} 
            style={styles.endTripBtn}
          >
            <Text style={styles.endTripText}>END TRIP</Text>
          </TouchableOpacity>
        </View>

        {/* Twin Gauges — Car + Human */}
        <View style={styles.gaugeRow}>
          <View style={styles.gaugeCard}>
            <View style={[styles.gaugeCircle, { borderColor: batteryPercent > 30 ? '#ffaa44' : '#ff4455', shadowColor: batteryPercent > 30 ? '#ffaa44' : '#ff4455' }]}>
              <Text style={styles.gaugeValue}>{batteryPercent}%</Text>
            </View>
            <View style={styles.labelRow}>
              <BatteryCharging color="#ffaa44" size={16} />
              <Text style={styles.gaugeLabel}> CAR SOC</Text>
            </View>
            <Text style={styles.gaugeSub}>{rangeKm} km range</Text>
          </View>

          <View style={styles.gaugeCard}>
            <View style={[styles.gaugeCircle, { borderColor: hssColor, shadowColor: hssColor }]}>
              <Text style={[styles.gaugeValue, { color: hssColor }]}>{hssResult.score}</Text>
            </View>
            <View style={styles.labelRow}>
              <Brain color={hssColor} size={16} />
              <Text style={[styles.gaugeLabel, { color: hssColor }]}> FOCUS</Text>
            </View>
            <Text style={[styles.gaugeSub, { color: hssColor }]}>{hssResult.status}</Text>
          </View>
        </View>

        {/* HSS Breakdown */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Zap color="#ffaa44" size={16} />
            <Text style={styles.cardTitle}> PERFORMANCE METRICS</Text>
          </View>
          <View style={styles.breakdownRow}>
            <View style={styles.metricItem}>
              <Timer color="#94a3b8" size={14} />
              <Text style={styles.breakdownLabel}> Time: {driveDurationMin}m</Text>
            </View>
            <Text style={styles.breakdownValue}>{hssResult.breakdown.driveDuration}/30</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>🌙 Time of Day</Text>
            <Text style={styles.breakdownValue}>{hssResult.breakdown.timeOfDay}/20</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>🔀 Smoothness</Text>
            <Text style={styles.breakdownValue}>{hssResult.breakdown.microSwerve}/25</Text>
          </View>
        </View>

        {/* Passenger Info */}
        {passengers.length > 0 && !passengers.includes('solo') && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <User color="#ffaa44" size={16} />
              <Text style={styles.cardTitle}> PASSENGER MODE</Text>
            </View>
            <Text style={styles.passengerText}>
              Active: {passengers.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
            </Text>
            <Text style={styles.passengerNote}>
              Synced Stop @ {getMaxDriveMinutes(passengers)} mins
            </Text>
          </View>
        )}

        {/* Synchronized Stop Card */}
        {syncStop?.triggered && (
          <View style={[styles.card, styles.stopCard]}>
            <View style={styles.cardHeaderRow}>
              <MapPin color="#ffaa44" size={20} />
              <Text style={styles.stopTitle}> RECOMMENDED STOP</Text>
            </View>
            <Text style={styles.stopStation}>{syncStop.stationName} — {syncStop.stationDistanceKm} km ahead</Text>
            <View style={styles.stopDetails}>
              <Text style={styles.stopDetailText}>🔋 Car: {syncStop.batteryPercent}% | needs {syncStop.chargeTimeMin} min charge</Text>
              <Text style={styles.stopDetailText}>🧠 You: Score {syncStop.humanScore} | driving {syncStop.driveDurationMin} mins</Text>
            </View>
            <Text style={styles.stopMessage}>{syncStop.message}</Text>
            <TouchableOpacity style={styles.btnNavigate} onPress={handleNavigateToStop}>
              <Text style={styles.btnNavigateText}>Open in Google Maps</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { paddingTop: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  resumeNavBtn: { backgroundColor: 'rgba(68, 255, 178, 0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#44ffb2', marginRight: 10 },
  resumeNavText: { color: '#44ffb2', fontWeight: 'bold', fontSize: 10 },
  endTripBtn: { backgroundColor: 'rgba(255, 68, 85, 0.2)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ff4455' },
  endTripText: { color: '#ff4455', fontWeight: 'bold', fontSize: 12 },

  gaugeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  gaugeCard: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 20, marginHorizontal: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  gaugeCircle: { width: 95, height: 95, borderRadius: 48, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 15, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10, elevation: 5 },
  gaugeValue: { color: 'white', fontSize: 32, fontWeight: '900' },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  gaugeLabel: { color: 'white', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  gaugeSub: { color: '#94a3b8', fontSize: 12, textAlign: 'center' },

  card: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 15 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  cardTitle: { color: '#ffaa44', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  metricItem: { flexDirection: 'row', alignItems: 'center' },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' },
  breakdownLabel: { color: '#94a3b8', fontSize: 13 },
  breakdownValue: { color: 'white', fontSize: 14, fontWeight: 'bold' },

  passengerText: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  passengerNote: { color: '#ffdd44', fontSize: 12 },

  stopCard: { borderColor: 'rgba(255,170,68,0.3)', backgroundColor: 'rgba(255,170,68,0.05)' },
  stopTitle: { color: '#ffaa44', fontSize: 14, fontWeight: 'bold', letterSpacing: 1 },
  stopStation: { color: 'white', fontSize: 18, fontWeight: 'bold', marginVertical: 10 },
  stopDetails: { marginBottom: 15 },
  stopDetailText: { color: '#94a3b8', fontSize: 13, marginBottom: 4 },
  stopMessage: { color: '#ffaa44', fontSize: 14, fontStyle: 'italic', marginBottom: 20, lineHeight: 20 },
  btnNavigate: { backgroundColor: '#ff6b1a', borderRadius: 12, padding: 16, alignItems: 'center', shadowColor: '#ff6b1a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  btnNavigateText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  haltSection: { marginBottom: 20 },
  btnHalt: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 15, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  btnHaltText: { color: '#ffaa44', fontSize: 16, fontWeight: 'bold' },
  nudgeCard: { backgroundColor: '#0a0806', borderRadius: 12, padding: 15, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#ff6b1a' },
  nudgeOptimal: { borderLeftColor: '#44ffb2' },
  nudgeWarning: { borderLeftColor: '#ffdd44' },
  nudgeText: { color: 'white', fontSize: 14, marginBottom: 5 },
  nudgeTime: { color: '#94a3b8', fontSize: 12 },
  btnResume: { backgroundColor: '#44ffb2', borderRadius: 12, padding: 16, alignItems: 'center' },
  btnResumeText: { color: '#060404', fontWeight: 'bold', fontSize: 16 },

  feelingOverlay: { backgroundColor: '#0a0806', borderRadius: 25, padding: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 20 },
  feelingTitle: { color: 'white', fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 25 },
  feelingBtn: { borderRadius: 15, padding: 18, alignItems: 'center', marginBottom: 12 },
  feelingBtnText: { color: '#060404', fontSize: 18, fontWeight: 'bold' },
});
