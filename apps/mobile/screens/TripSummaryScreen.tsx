import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ViewShot from 'react-native-view-shot';
import { saveTrip, TripRecord, getTrips, getPatternInsight } from '../lib/tripStore';

type Params = {
  totalDistanceKm: number;
  totalDurationMin: number;
  chargingStopsTaken: number;
  batteryStart: number;
  batteryEnd: number;
  avgHumanScore: number;
  lowestHumanScore: number;
  fatigueOnsetMin: number | null;
  hardBrakeEvents: number;
  passengers: string[];
  scoreSamples: { minutesMark: number; score: number }[];
};

export default function TripSummaryScreen() {
  const route = useRoute<RouteProp<{ TripSummary: Params }, 'TripSummary'>>();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const params = route.params;
  const viewShotRef = useRef<ViewShot>(null);

  const [patternInsight, setPatternInsight] = useState('');
  const [tripCount, setTripCount] = useState(0);

  useEffect(() => {
    (async () => {
      // Save this trip
      const tripRecord: TripRecord = {
        id: `trip_${Date.now()}`,
        date: new Date().toLocaleDateString(),
        startTime: Date.now() - params.totalDurationMin * 60000,
        endTime: Date.now(),
        totalDistanceKm: params.totalDistanceKm,
        totalDurationMin: params.totalDurationMin,
        chargingStopsTaken: params.chargingStopsTaken,
        batteryStart: params.batteryStart,
        batteryEnd: params.batteryEnd,
        avgHumanScore: params.avgHumanScore,
        lowestHumanScore: params.lowestHumanScore,
        fatigueOnsetMin: params.fatigueOnsetMin,
        hardBrakeEvents: params.hardBrakeEvents,
        smoothestWindowKm: 'km 0–15',
        recommendedStops: 1,
        actualStops: params.chargingStopsTaken,
        humanEfficiencyScore: Math.min(100, params.avgHumanScore + 10),
        passengers: params.passengers,
        scoreSamples: params.scoreSamples,
      };
      await saveTrip(tripRecord);

      const trips = await getTrips();
      setTripCount(trips.length);
      const insight = await getPatternInsight(trips);
      setPatternInsight(insight);
    })();
  }, []);

  const handleShare = async () => {
    try {
      if (viewShotRef.current && viewShotRef.current.capture) {
        const uri = await viewShotRef.current.capture();
        await Share.share({
          title: 'My GatiCharge Trip',
          message: `I scored ${params.avgHumanScore}/100 on my drive today! My car battery efficiency was ${Math.round((1 - (params.batteryStart - params.batteryEnd) / params.batteryStart) * 100)}%. Check out GatiCharge!`,
          url: uri,
        });
      }
    } catch (e) {
      console.error('Share error:', e);
    }
  };

  const scoreColor = params.avgHumanScore >= 80 ? '#00ff9d' : params.avgHumanScore >= 50 ? '#fbbf24' : '#ef4444';

  // Simple text-based graph
  const graphBars = params.scoreSamples.length > 0
    ? params.scoreSamples
    : [{ minutesMark: 0, score: 95 }, { minutesMark: 5, score: 90 }, { minutesMark: 10, score: 85 }];

  return (
    <ScrollView style={styles.container}>
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }} style={styles.cardWrapper}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerEmoji}>🏁</Text>
          <Text style={styles.headerTitle}>Trip Complete</Text>
          <Text style={styles.headerSubtitle}>Here's what we learned about you today.</Text>
        </View>

        {/* Section 1 — Journey Stats (Car Data) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚗 Car & Journey Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{params.totalDistanceKm} km</Text>
              <Text style={styles.statLabel}>Total Distance</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{params.totalDurationMin} min</Text>
              <Text style={styles.statLabel}>Drive Duration</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{params.batteryStart}% → {params.batteryEnd}%</Text>
              <Text style={styles.statLabel}>Battery (Start → End)</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{params.batteryStart - params.batteryEnd}%</Text>
              <Text style={styles.statLabel}>Total SOC Consumed</Text>
            </View>
          </View>
        </View>

        {/* Section 2 — Human Performance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧠 Human Performance Score</Text>
          <View style={styles.bigScoreRow}>
            <View style={[styles.bigScoreCircle, { borderColor: scoreColor }]}>
              <Text style={[styles.bigScoreValue, { color: scoreColor }]}>{params.avgHumanScore}</Text>
              <Text style={styles.bigScoreLabel}>AVG SCORE</Text>
            </View>
            <View style={styles.perfDetails}>
              {params.fatigueOnsetMin !== null ? (
                <Text style={styles.perfText}>😴 Fatigue Onset: <Text style={styles.perfHighlight}>{params.fatigueOnsetMin} min</Text></Text>
              ) : (
                <Text style={styles.perfText}>✅ No Fatigue Detected</Text>
              )}
              <Text style={styles.perfText}>🛑 Hard Brakes: <Text style={styles.perfHighlight}>{params.hardBrakeEvents}</Text></Text>
              <Text style={styles.perfText}>📉 Critical Low: <Text style={[styles.perfHighlight, { color: '#ef4444' }]}>{params.lowestHumanScore}</Text></Text>
            </View>
          </View>

          {/* Simple bar chart */}
          <Text style={styles.chartTitle}>Alertness Timeline (sampled every 5m)</Text>
          <View style={styles.chartContainer}>
            {graphBars.map((bar, i) => (
              <View key={i} style={styles.chartBarWrapper}>
                <View style={[styles.chartBar, { 
                  height: Math.max(10, (bar.score / 100) * 80),
                  backgroundColor: bar.score >= 80 ? '#00ff9d' : bar.score >= 50 ? '#fbbf24' : '#ef4444'
                }]} />
                <Text style={styles.chartLabel}>{bar.minutesMark}m</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Section 3 — Pattern Insight */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔮 Intelligence Insight (Trip #{tripCount})</Text>
          <Text style={styles.insightText}>{patternInsight}</Text>
        </View>

        {/* GatiCharge Branding */}
        <View style={styles.branding}>
          <Text style={styles.brandText}>GatiCharge</Text>
          <Text style={styles.brandSub}>Powering the Future</Text>
        </View>
      </ViewShot>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnShare} onPress={handleShare}>
          <Text style={styles.btnShareText}>📤 Share Trip Card</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnDone} onPress={() => navigation.navigate('Dashboard')}>
          <Text style={styles.btnDoneText}>Done</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060404', padding: 15 },
  cardWrapper: { backgroundColor: '#0a0806', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,107,26,0.15)' },

  header: { padding: 25, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,107,26,0.15)' },
  headerEmoji: { fontSize: 40, marginBottom: 10 },
  headerTitle: { color: 'white', fontSize: 26, fontWeight: 'bold' },
  headerSubtitle: { color: '#94a3b8', fontSize: 14, marginTop: 5, textAlign: 'center' },

  section: { padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,107,26,0.15)' },
  sectionTitle: { color: '#ffaa44', fontSize: 16, fontWeight: 'bold', marginBottom: 15 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statItem: { width: '50%', marginBottom: 15 },
  statValue: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: '#94a3b8', fontSize: 12, marginTop: 2 },

  bigScoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  bigScoreCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 5, justifyContent: 'center', alignItems: 'center', marginRight: 20 },
  bigScoreValue: { fontSize: 28, fontWeight: 'bold' },
  bigScoreLabel: { color: '#94a3b8', fontSize: 11 },
  perfDetails: { flex: 1 },
  perfText: { color: '#94a3b8', fontSize: 13, marginBottom: 6 },
  perfHighlight: { color: 'white', fontWeight: 'bold' },

  chartTitle: { color: '#94a3b8', fontSize: 12, marginBottom: 10 },
  chartContainer: { flexDirection: 'row', alignItems: 'flex-end', height: 100, paddingTop: 10 },
  chartBarWrapper: { flex: 1, alignItems: 'center' },
  chartBar: { width: 12, borderRadius: 6, minHeight: 10 },
  chartLabel: { color: '#475569', fontSize: 9, marginTop: 4 },

  insightText: { color: '#ffd080', fontSize: 14, fontStyle: 'italic', lineHeight: 20 },

  branding: { padding: 15, alignItems: 'center' },
  brandText: { color: '#ff6b1a', fontSize: 18, fontWeight: 'bold' },
  brandSub: { color: '#94a3b8', fontSize: 11 },

  actions: { marginTop: 20 },
  btnShare: { backgroundColor: 'rgba(255,107,26,0.1)', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,107,26,0.3)' },
  btnShareText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  btnDone: { backgroundColor: '#ff6b1a', borderRadius: 12, padding: 16, alignItems: 'center' },
  btnDoneText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
