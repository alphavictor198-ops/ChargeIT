import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import axios from 'axios';
import { darkMapStyle } from './MapScreen';

type RootStackParamList = {
  Map: undefined;
  RoutePlanner: { 
    originLoc: { lat: number, lng: number },
    destLoc: { lat: number, lng: number },
    destName: string 
  };
};

type RoutePlannerRouteProp = RouteProp<RootStackParamList, 'RoutePlanner'>;

export default function RoutePlannerScreen() {
  const route = useRoute<RoutePlannerRouteProp>();
  const navigation = useNavigation();
  const { originLoc, destLoc, destName } = route.params;

  const [routeCoords, setRouteCoords] = useState<{latitude: number, longitude: number}[]>([]);
  const [distance, setDistance] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Fetch polyline from OSRM (Free open-source routing)
        const url = `http://router.project-osrm.org/route/v1/driving/${originLoc.lng},${originLoc.lat};${destLoc.lng},${destLoc.lat}?overview=full&geometries=geojson`;
        const res = await axios.get(url);
        
        if (res.data.routes && res.data.routes.length > 0) {
          const r = res.data.routes[0];
          
          // OSRM returns coordinates as [longitude, latitude]
          const coords = r.geometry.coordinates.map((c: number[]) => ({
            latitude: c[1],
            longitude: c[0]
          }));
          
          setRouteCoords(coords);
          setDistance((r.distance / 1000).toFixed(1)); // Convert meters to km
          
          // Convert seconds to hours and minutes
          const hours = Math.floor(r.duration / 3600);
          const minutes = Math.floor((r.duration % 3600) / 60);
          setDuration(hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`);
        }
      } catch (e) {
        console.error("Error fetching route:", e);
        alert("Failed to calculate route");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleStartNavigation = () => {
    // Universal Google Maps Directions URL (works on Android and iOS if Google Maps is installed)
    const url = `https://www.google.com/maps/dir/?api=1&origin=${originLoc.lat},${originLoc.lng}&destination=${destLoc.lat},${destLoc.lng}&travelmode=driving`;
    Linking.openURL(url).catch(() => {
      alert("Couldn't open Google Maps");
    });
  };

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Route to {destName}</Text>
      </View>

      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={darkMapStyle}
        initialRegion={{
          latitude: (originLoc.lat + destLoc.lat) / 2,
          longitude: (originLoc.lng + destLoc.lng) / 2,
          latitudeDelta: Math.abs(originLoc.lat - destLoc.lat) * 2 || 0.1,
          longitudeDelta: Math.abs(originLoc.lng - destLoc.lng) * 2 || 0.1,
        }}
      >
        <Marker coordinate={{ latitude: originLoc.lat, longitude: originLoc.lng }} title="You" pinColor="#0ea5e9" />
        <Marker coordinate={{ latitude: destLoc.lat, longitude: destLoc.lng }} title={destName} pinColor="#00ff9d" />
        
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#00d4ff" // Neon blue path
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Summary Bottom Panel */}
      <View style={styles.summaryPanel}>
        {loading ? (
          <ActivityIndicator size="small" color="#00ff9d" />
        ) : (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{distance} km</Text>
              <Text style={styles.statLabel}>Total Distance</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{duration}</Text>
              <Text style={styles.statLabel}>Est. Time</Text>
            </View>
          </View>
        )}
        
        <TouchableOpacity style={styles.btnPrimary} onPress={handleStartNavigation}>
          <Text style={styles.btnText}>Start Navigation</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060b18' },
  header: {
    paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20,
    backgroundColor: '#060b18', borderBottomWidth: 1, borderBottomColor: '#1a2744',
    flexDirection: 'row', alignItems: 'center'
  },
  backButton: { marginRight: 15 },
  backButtonText: { color: '#0ea5e9', fontSize: 16, fontWeight: 'bold' },
  headerTitle: { color: '#00ff9d', fontSize: 18, fontWeight: 'bold', flex: 1 },
  map: { flex: 1, width: '100%' },
  
  summaryPanel: {
    backgroundColor: '#0d1526',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopWidth: 1, borderColor: '#1a2744',
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statBox: { backgroundColor: '#1a2744', borderRadius: 10, padding: 10, flex: 1, marginHorizontal: 5, alignItems: 'center' },
  statValue: { color: '#0ea5e9', fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  
  btnPrimary: {
    backgroundColor: '#0ea5e9', borderRadius: 10, padding: 15, alignItems: 'center',
  },
  btnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
