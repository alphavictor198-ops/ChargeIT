import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getTrips, TripRecord, getPatternInsight } from '../lib/tripStore';
import { useVehicle } from '../lib/VehicleContext';
import { VEHICLE_SPECS } from '../lib/physics';
import { CarFront, Battery, Zap, Timer, Activity } from 'lucide-react-native';

const VEHICLE_LIST = Object.values(VEHICLE_SPECS);

export default function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { spec, batteryPercent, estimatedRange, vehicleId, setVehicleId, setBatteryPercent, isConnected, setIsConnected } = useVehicle();
  const [recentTrips, setRecentTrips] = useState<TripRecord[]>([]);
  const [patternInsight, setPatternInsight] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const handleConnect = () => {
    setIsDetecting(true);
    setTimeout(() => {
      setVehicleId('tiago_ev');
      setBatteryPercent(64); 
      setIsDetecting(false);
      setIsConnected(true);
    }, 2000);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      const trips = await getTrips();
      setRecentTrips(trips.slice(0, 3));
      const insight = await getPatternInsight(trips);
      setPatternInsight(insight);
    });
    return unsubscribe;
  }, [navigation]);

  const hssColor = '#44ffb2'; 

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Gati Dash</Text>
          <Text style={styles.date}>{new Date().toDateString()}</Text>
        </View>
        {!isConnected ? (
          <TouchableOpacity 
            style={styles.connectBtn} 
            onPress={handleConnect}
            disabled={isDetecting}
          >
            <Text style={styles.connectBtnText}>
              {isDetecting ? 'SEARCHING...' : 'CONNECT'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.connectedBtn} disabled={true}>
            <Text style={styles.connectedBtnText}>CONNECTED</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 3D Rotating Car Section */}
      <View style={styles.carVisualizerSection}>
        <View style={[styles.visualizerBase, { perspective: 1000 }]}>
          <Animated.View style={{ 
            transform: [
              { rotateX: '15deg' }, 
              { rotateY: spin }
            ] 
          }}>
            <CarFront color="#ffaa44" size={110} strokeWidth={1.5} />
          </Animated.View>
          <View style={styles.scanningRing} />
        </View>

        <View style={styles.vehicleInfoHub}>
          <Text style={styles.vehicleModelName}>{isConnected ? spec.name : 'NO VEHICLE LINKED'}</Text>
          <View style={styles.mainStatsRow}>
            <View style={styles.mainStat}>
              <Battery color="#44ffb2" size={18} />
              <Text style={styles.mainStatValue}>{isConnected ? `${batteryPercent}%` : '--%'}</Text>
              <Text style={styles.mainStatLabel}>CHARGE</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.mainStat}>
              <Zap color="#ffaa44" size={18} />
              <Text style={styles.mainStatValue}>{isConnected ? `${estimatedRange} km` : '-- km'}</Text>
              <Text style={styles.mainStatLabel}>RANGE</Text>
            </View>
          </View>
          <Text style={styles.specSubText}>
            {isConnected ? `${spec.battery_kwh} kWh Battery · ${spec.max_charge_rate_kw} kW DC Fast` : 'Hardware interface disconnected'}
          </Text>
        </View>
      </View>

      {/* Human Score Preview */}
      <View style={styles.scorePreviewCard}>
        <Activity color={hssColor} size={20} />
        <View style={{ marginLeft: 15 }}>
          <Text style={styles.scorePreviewTitle}>Biological State Monitoring</Text>
          <Text style={styles.scorePreviewDesc}>System armed. Monitoring will begin on trip start.</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity 
          style={[styles.actionBtnPrimary, !isConnected && { opacity: 0.5 }]} 
          onPress={() => {
            if (!isConnected) return alert('Please connect to the vehicle first.');
            navigation.navigate('PassengerProfile');
          }}
        >
          <Text style={styles.actionBtnTitleDark}>🚀 Plan Trip</Text>
          <Text style={styles.actionBtnDescDark}>Setup & Navigation</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => navigation.navigate('Map')}>
          <Text style={styles.actionBtnTitle}>🗺 Station Map</Text>
          <Text style={styles.actionBtnDesc}>Find nearby chargers</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.actionGrid}>
        <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => {
          if (recentTrips.length > 0) {
            const t = recentTrips[0];
            navigation.navigate('TripSummary', {
              totalDistanceKm: t.totalDistanceKm,
              totalDurationMin: t.totalDurationMin,
              chargingStopsTaken: t.chargingStopsTaken,
              batteryStart: t.batteryStart,
              batteryEnd: t.batteryEnd,
              avgHumanScore: t.avgHumanScore,
              lowestHumanScore: t.lowestHumanScore,
              fatigueOnsetMin: t.fatigueOnsetMin,
              hardBrakeEvents: t.hardBrakeEvents,
              passengers: t.passengers,
              scoreSamples: t.scoreSamples,
            });
          } else {
            alert('No trips recorded yet. Start a trip first!');
          }
        }}>
          <Text style={styles.actionBtnTitle}>🏁 Last Trip</Text>
          <Text style={styles.actionBtnDesc}>View trip card</Text>
        </TouchableOpacity>
      </View>

      {/* Pattern Insight */}
      {patternInsight !== '' && (
        <View style={styles.insightCard}>
          <Text style={styles.insightTitle}>🔮 Your Driving Pattern</Text>
          <Text style={styles.insightText}>{patternInsight}</Text>
        </View>
      )}

      {/* Recent Trips */}
      {recentTrips.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent Trips</Text>
          {recentTrips.map((trip, i) => {
            const scoreColor = trip.avgHumanScore >= 80 ? '#44ffb2' : trip.avgHumanScore >= 50 ? '#ffdd44' : '#ff4455';
            return (
              <View key={i} style={styles.tripCard}>
                <View style={styles.tripRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tripDate}>{trip.date}</Text>
                    <Text style={styles.tripStats}>{trip.totalDistanceKm} km · {trip.totalDurationMin} min</Text>
                  </View>
                  <View style={[styles.tripScoreBadge, { borderColor: scoreColor }]}>
                    <Text style={[styles.tripScoreValue, { color: scoreColor }]}>{trip.avgHumanScore}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </>
      )}

      {/* Feature Highlights */}
      <Text style={styles.sectionTitle}>What Makes GatiCharge Different</Text>
      <View style={styles.featureCard}>
        <Text style={styles.featureIcon}>🧠</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.featureTitle}>Human State Score</Text>
          <Text style={styles.featureDesc}>Live monitoring of your fatigue, alertness, and driving patterns using phone sensors.</Text>
        </View>
      </View>
      <View style={styles.featureCard}>
        <Text style={styles.featureIcon}>⚡</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.featureTitle}>Synchronized Stop Engine</Text>
          <Text style={styles.featureDesc}>Finds the perfect moment where both your car AND you need a break. No wasted time.</Text>
        </View>
      </View>
      <View style={styles.featureCard}>
        <Text style={styles.featureIcon}>👨‍👩‍👧</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.featureTitle}>Passenger Aware</Text>
          <Text style={styles.featureDesc}>Adapts stop recommendations for infants, elderly, pets, and children.</Text>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060404', padding: 20 },
  header: { marginTop: 40, marginBottom: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 28, fontWeight: '900', color: 'white', letterSpacing: 1 },
  date: { fontSize: 13, color: '#94a3b8', marginTop: 4 },

  connectBtn: { backgroundColor: '#ff6b1a', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, shadowColor: '#ff6b1a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 },
  connectBtnText: { color: 'white', fontWeight: 'bold', fontSize: 11, letterSpacing: 1 },
  connectedBtn: { backgroundColor: '#44ffb2', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, shadowColor: '#44ffb2', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 6, borderBottomWidth: 3, borderBottomColor: '#2bb37d' },
  connectedBtnText: { color: '#060404', fontWeight: '900', fontSize: 11, letterSpacing: 1 },

  carVisualizerSection: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 30, padding: 25, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 20 },
  visualizerBase: { width: 180, height: 180, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  scanningRing: { position: 'absolute', width: 220, height: 120, borderRadius: 110, borderWidth: 1, borderColor: 'rgba(255, 107, 26, 0.2)', transform: [{ scaleX: 1 }, { rotateX: '75deg' }] },
  
  vehicleInfoHub: { alignItems: 'center', width: '100%' },
  vehicleModelName: { color: 'white', fontSize: 22, fontWeight: '900', letterSpacing: 1, marginBottom: 15 },
  mainStatsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20, padding: 15, width: '100%', justifyContent: 'space-around' },
  mainStat: { alignItems: 'center' },
  mainStatValue: { color: 'white', fontSize: 20, fontWeight: 'bold', marginVertical: 4 },
  mainStatLabel: { color: '#94a3b8', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)' },
  specSubText: { color: '#475569', fontSize: 11, marginTop: 15, fontWeight: '500' },

  scorePreviewCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(68,255,178,0.05)', borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(68,255,178,0.1)' },
  scorePreviewTitle: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  scorePreviewDesc: { color: '#94a3b8', fontSize: 12, marginTop: 4 },

  sectionTitle: { color: 'white', fontSize: 18, fontWeight: '900', marginBottom: 15, marginTop: 5, letterSpacing: 1 },
  actionGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  actionBtnPrimary: { backgroundColor: '#ff6b1a', borderRadius: 20, padding: 20, flex: 1, marginRight: 6, height: 110, justifyContent: 'center' },
  actionBtnSecondary: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 20, flex: 1, marginLeft: 6, height: 110, justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  actionBtnTitle: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  actionBtnDesc: { color: '#94a3b8', fontSize: 11 },
  actionBtnTitleDark: { color: 'white', fontSize: 17, fontWeight: '900', marginBottom: 5 },
  actionBtnDescDark: { color: 'white', fontSize: 11, opacity: 0.8 },

  insightCard: { backgroundColor: 'rgba(255,208,128,0.05)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,208,128,0.2)', marginBottom: 20 },
  insightTitle: { color: '#ffd080', fontSize: 13, fontWeight: 'bold', letterSpacing: 1, marginBottom: 10 },
  insightText: { color: '#ffd080', fontSize: 14, fontStyle: 'italic', lineHeight: 22 },

  tripCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 15, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  tripRow: { flexDirection: 'row', alignItems: 'center' },
  tripDate: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  tripStats: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  tripScoreBadge: { width: 50, height: 50, borderRadius: 25, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  tripScoreValue: { fontSize: 18, fontWeight: 'bold' },

  featureCard: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 15, padding: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  featureIcon: { fontSize: 32, marginRight: 20 },
  featureTitle: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  featureDesc: { color: '#94a3b8', fontSize: 13, lineHeight: 19 },
});
