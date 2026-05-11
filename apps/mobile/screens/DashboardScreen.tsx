import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getTrips, TripRecord, getPatternInsight } from '../lib/tripStore';

export default function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [batteryLevel] = useState(82);
  const [estimatedRange] = useState(315);
  const [status] = useState("Parked & Ready");
  const [recentTrips, setRecentTrips] = useState<TripRecord[]>([]);
  const [patternInsight, setPatternInsight] = useState('');

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      const trips = await getTrips();
      setRecentTrips(trips.slice(0, 3));
      const insight = await getPatternInsight(trips);
      setPatternInsight(insight);
    });
    return unsubscribe;
  }, [navigation]);

  const hssColor = '#44ffb2'; // Default green when not driving

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, Driver</Text>
        <Text style={styles.date}>{new Date().toDateString()}</Text>
      </View>

      {/* Twin Gauges — Car + Human */}
      <View style={styles.gaugeRow}>
        <View style={styles.gaugeCard}>
          <View style={[styles.gaugeCircle, { borderColor: '#ffaa44' }]}>
            <Text style={styles.gaugeValue}>{batteryLevel}%</Text>
          </View>
          <Text style={styles.gaugeLabel}>🔋 Car Battery</Text>
          <Text style={styles.gaugeSub}>{estimatedRange} km range</Text>
        </View>
        <View style={styles.gaugeCard}>
          <View style={[styles.gaugeCircle, { borderColor: hssColor }]}>
            <Text style={[styles.gaugeValue, { color: hssColor }]}>—</Text>
          </View>
          <Text style={styles.gaugeLabel}>🧠 Human Score</Text>
          <Text style={[styles.gaugeSub, { color: hssColor }]}>Start a trip to monitor</Text>
        </View>
      </View>

      {/* Vehicle Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Vehicle Status</Text>
        <Text style={styles.vehicleName}>Tata Nexon EV</Text>
        <Text style={styles.vehicleStatus}>{status}</Text>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => navigation.navigate('PassengerProfile')}>
          <Text style={styles.actionBtnTitleDark}>🚀 Start Trip</Text>
          <Text style={styles.actionBtnDescDark}>Monitor your state</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => navigation.navigate('Map')}>
          <Text style={styles.actionBtnTitle}>🗺 Station Map</Text>
          <Text style={styles.actionBtnDesc}>Find nearby chargers</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.actionGrid}>
        <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => navigation.navigate('RoutePlanner')}>
          <Text style={styles.actionBtnTitle}>📍 Route Planner</Text>
          <Text style={styles.actionBtnDesc}>Plan your long trip</Text>
        </TouchableOpacity>
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
  header: { marginTop: 40, marginBottom: 20 },
  greeting: { fontSize: 28, fontWeight: 'bold', color: 'white' },
  date: { fontSize: 14, color: '#94a3b8', marginTop: 5 },

  gaugeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  gaugeCard: { flex: 1, alignItems: 'center', backgroundColor: '#0a0806', borderRadius: 15, padding: 18, marginHorizontal: 5, borderWidth: 1, borderColor: 'rgba(255,107,26,0.15)' },
  gaugeCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 6, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  gaugeValue: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  gaugeLabel: { color: 'white', fontSize: 13, fontWeight: 'bold' },
  gaugeSub: { color: '#94a3b8', fontSize: 11, marginTop: 3, textAlign: 'center' },

  card: { backgroundColor: '#0a0806', borderRadius: 15, padding: 18, borderWidth: 1, borderColor: 'rgba(255,107,26,0.15)', marginBottom: 20 },
  cardTitle: { color: '#ffaa44', fontSize: 13, opacity: 0.8 },
  vehicleName: { color: 'white', fontSize: 20, fontWeight: 'bold', marginTop: 5 },
  vehicleStatus: { color: '#44ffb2', fontSize: 14, marginTop: 3 },

  sectionTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 12, marginTop: 5 },

  actionGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  actionBtnPrimary: { backgroundColor: '#ff6b1a', borderRadius: 15, padding: 18, flex: 1, marginRight: 5, height: 100, justifyContent: 'center' },
  actionBtnSecondary: { backgroundColor: 'rgba(255,107,26,0.08)', borderRadius: 15, padding: 18, flex: 1, marginHorizontal: 5, height: 100, justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,107,26,0.2)' },
  actionBtnTitle: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  actionBtnDesc: { color: '#94a3b8', fontSize: 11 },
  actionBtnTitleDark: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  actionBtnDescDark: { color: 'white', fontSize: 11, opacity: 0.8 },

  insightCard: { backgroundColor: '#120e0a', borderRadius: 15, padding: 18, borderWidth: 1, borderColor: '#ffd080', marginBottom: 20, marginTop: 15 },
  insightTitle: { color: '#ffd080', fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
  insightText: { color: '#ffd080', fontSize: 13, fontStyle: 'italic', lineHeight: 20 },

  tripCard: { backgroundColor: '#0a0806', borderRadius: 12, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,107,26,0.15)' },
  tripRow: { flexDirection: 'row', alignItems: 'center' },
  tripDate: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  tripStats: { color: '#94a3b8', fontSize: 12, marginTop: 3 },
  tripScoreBadge: { width: 50, height: 50, borderRadius: 25, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  tripScoreValue: { fontSize: 18, fontWeight: 'bold' },

  featureCard: { backgroundColor: '#0a0806', borderRadius: 12, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,107,26,0.15)', flexDirection: 'row', alignItems: 'center' },
  featureIcon: { fontSize: 28, marginRight: 15 },
  featureTitle: { color: 'white', fontSize: 15, fontWeight: 'bold', marginBottom: 3 },
  featureDesc: { color: '#94a3b8', fontSize: 12, lineHeight: 17 },
});
