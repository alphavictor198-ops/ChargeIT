import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, TextInput, Keyboard, FlatList, ScrollView } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { planRoute, VEHICLE_SPECS, RoutePlan, CHARGING_HUBS } from '../lib/physics';
import { useVehicle } from '../lib/VehicleContext';

export default function RoutePlannerScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { spec, batteryPercent } = useVehicle();
  const params = route.params || {};

  const [startQuery, setStartQuery] = useState(params.originLoc ? 'Current Location' : '');
  const [destQuery, setDestQuery] = useState(params.destName || '');
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePlanRoute = async () => {
    setLoading(true);
    try {
      const plan = await planRoute(22.7196, 75.8577, 28.6139, 77.2090, spec, batteryPercent);
      setRoutePlan(plan);
    } catch (e) {
      alert("Failed to calculate route");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchPanel}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Route Planner [Web View]</Text>
        </View>
        <TextInput style={styles.input} placeholder="Start" value={startQuery} onChangeText={setStartQuery} placeholderTextColor="#444" />
        <TextInput style={styles.input} placeholder="Destination" value={destQuery} onChangeText={setDestQuery} placeholderTextColor="#444" />
        <TouchableOpacity style={styles.btnSecondary} onPress={handlePlanRoute}>
          <Text style={styles.btnSecondaryText}>Plan Route</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }}>
         <Text style={{ color: '#00ff9d', fontSize: 18, fontWeight: 'bold' }}>Map Interface [SIMULATED]</Text>
         {routePlan && (
           <ScrollView style={{ width: '90%', marginTop: 20 }}>
              {routePlan.stops.map((s, i) => (
                <View key={i} style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: '#333' }}>
                  <Text style={{ color: 'white' }}>Stop {i+1}: {s.city}</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 11 }}>Charge to {s.chargeTo}% · {s.waitTimeMin}m wait</Text>
                </View>
              ))}
           </ScrollView>
         )}
      </View>

      {routePlan && (
        <View style={styles.summaryPanel}>
           <Text style={styles.statValue}>{routePlan.roadDistanceKm} km · {routePlan.durationMin}m</Text>
           <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('ActiveTrip', { passengers: ['solo'] })}>
             <Text style={styles.btnText}>Start Simulated HUD</Text>
           </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060b18' },
  searchPanel: { paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20, backgroundColor: '#0d1526', borderBottomWidth: 1, borderColor: '#1a2744' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  backButton: { marginRight: 15 },
  backButtonText: { color: '#0ea5e9', fontSize: 16, fontWeight: 'bold' },
  headerTitle: { color: '#00ff9d', fontSize: 18, fontWeight: 'bold' },
  input: { backgroundColor: '#060b18', borderRadius: 10, padding: 12, color: 'white', marginBottom: 10 },
  btnSecondary: { backgroundColor: '#1a2744', borderRadius: 10, padding: 12, alignItems: 'center' },
  btnSecondaryText: { color: '#0ea5e9', fontWeight: 'bold' },
  summaryPanel: { backgroundColor: '#0d1526', padding: 20, borderTopWidth: 1, borderColor: '#1a2744' },
  statValue: { color: 'white', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  btnPrimary: { backgroundColor: '#00ff9d', borderRadius: 10, padding: 15, alignItems: 'center' },
  btnText: { color: '#060b18', fontWeight: 'bold' },
});
