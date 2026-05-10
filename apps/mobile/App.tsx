import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import Constants from 'expo-constants';

// Standard dark theme for Google Maps
const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
];

export default function App() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [stations, setStations] = useState<any[]>([]);
  const [selectedStation, setSelectedStation] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          alert('Permission to access location was denied');
          setLoading(false);
          return;
        }

        let loc;
        try {
          loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        } catch (e) {
          loc = await Location.getLastKnownPositionAsync({});
        }
        if (loc) setLocation(loc);

        // Your computer has multiple network adapters (VirtualBox/WSL).
        // We explicitly use your real Wi-Fi IP so the phone can connect to the PC.
        const localIp = '192.168.1.5';
        
        // We will hit the Next.js API proxy which is running on port 3000
        const lat = loc ? loc.coords.latitude : 22.7196;
        const lng = loc ? loc.coords.longitude : 75.8577;

        const res = await axios.get(`http://${localIp}:3000/api/stations`, {
          timeout: 5000, // 5 second timeout so it doesn't hang forever
          params: {
            latitude: lat,
            longitude: lng,
            radius_km: 50,
            limit: 50
          }
        });
        setStations(res.data.stations || []);
      } catch (error: any) {
        console.error("Error fetching stations:", error.message);
        alert(`Could not connect to the server. Make sure your Next.js web app is running!\n\nError: ${error.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GatiCharge Native</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00ff9d" />
          <Text style={styles.loadingText}>Locating nearby hubs...</Text>
        </View>
      ) : (
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          customMapStyle={darkMapStyle}
          initialRegion={{
            latitude: location ? location.coords.latitude : 22.7196,
            longitude: location ? location.coords.longitude : 75.8577,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
        >
          {/* User Location */}
          {location && (
            <Marker
              coordinate={{ latitude: location.coords.latitude, longitude: location.coords.longitude }}
              title="You are here"
              pinColor="#0ea5e9"
            />
          )}

          {/* Charging Stations */}
          {stations.map((st) => (
            <Marker
              key={st.id}
              coordinate={{ latitude: st.latitude, longitude: st.longitude }}
              title={st.name}
              pinColor="#00ff9d"
              onPress={() => setSelectedStation(st)}
            />
          ))}
        </MapView>
      )}

      {/* Bottom Sheet */}
      {selectedStation && (
        <View style={styles.bottomSheet}>
          <Text style={styles.stationName}>{selectedStation.name}</Text>
          <Text style={styles.stationAddress}>{selectedStation.address || selectedStation.city}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{selectedStation.available_slots}/{selectedStation.total_slots}</Text>
              <Text style={styles.statLabel}>Available</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{selectedStation.max_power_kw} kW</Text>
              <Text style={styles.statLabel}>Max Speed</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{selectedStation.distance_km} km</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.btnPrimary} onPress={() => alert('Route Planner coming soon!')}>
            <Text style={styles.btnText}>Plan Route</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060b18' },
  header: {
    paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20,
    backgroundColor: '#060b18', borderBottomWidth: 1, borderBottomColor: '#1a2744',
  },
  headerTitle: { color: '#00ff9d', fontSize: 22, fontWeight: 'bold' },
  map: { flex: 1, width: '100%' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#00ff9d', marginTop: 10, fontSize: 16 },
  
  bottomSheet: {
    backgroundColor: '#0d1526',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopWidth: 1, borderColor: '#1a2744',
    shadowColor: "#000", shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 10,
  },
  stationName: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
  stationAddress: { color: '#94a3b8', fontSize: 14, marginBottom: 15 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statBox: { backgroundColor: '#1a2744', borderRadius: 10, padding: 10, flex: 1, marginHorizontal: 5, alignItems: 'center' },
  statValue: { color: '#0ea5e9', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  
  btnPrimary: {
    backgroundColor: '#00ff9d', borderRadius: 10, padding: 15, alignItems: 'center',
  },
  btnText: { color: '#060b18', fontSize: 16, fontWeight: 'bold' },
});
