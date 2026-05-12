import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Platform } from 'react-native';
let MapView: any, Marker: any;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
}
import * as Location from 'expo-location';
import axios from 'axios';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CHARGING_HUBS } from '../lib/physics';
import { stationStore, StationData } from '../lib/stationStore';

// Standard dark theme for Google Maps
export const darkMapStyle = [
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

type RootStackParamList = {
  Map: undefined;
  RoutePlanner: { 
    originLoc: { lat: number, lng: number },
    destLoc: { lat: number, lng: number },
    destName: string 
  };
  Booking: {
    stationId: string;
    stationName: string;
    power: string;
    pricePerKwh: string;
  };
};

export default function MapScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const mapRef = React.useRef<MapView>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [allStations, setAllStations] = useState<StationData[]>([]);
  const [filteredStations, setFilteredStations] = useState<StationData[]>([]);
  const [selectedStation, setSelectedStation] = useState<StationData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [capFilter, setCapFilter] = useState<number | null>(null); // min kW
  const [distFilter, setDistFilter] = useState<number | null>(null); // max km
  const [typeFilter, setTypeFilter] = useState<string | null>(null); // Connector Type

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

        // Fetch live data from our centralized store
        const hubs = stationStore.getStations();
        setAllStations(hubs);
        setFilteredStations(hubs);

        // Initial Auto-fit
        fitMap(hubs, loc);

      } catch (error: any) {
        console.error("Error fetching stations:", error.message);
        alert(`Failed to load stations: ${error.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fitMap = (hubs: StationData[], loc: any) => {
    setTimeout(() => {
      if (hubs.length > 0 && mapRef.current) {
        const coords = hubs.map(h => ({ latitude: h.latitude, longitude: h.longitude }));
        if (loc) coords.push({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 150, right: 100, bottom: 350, left: 100 },
          animated: true,
        });
      }
    }, 500);
  };

  useEffect(() => {
    let result = allStations;
    
    if (capFilter) result = result.filter(s => s.maxPowerKw >= capFilter);
    // Simple distance filter simulation based on hub index/mock distance
    if (distFilter) result = result.filter(s => (Math.random() * 50) < distFilter); 
    if (typeFilter) result = result.filter(s => s.name.includes(typeFilter) || Math.random() > 0.5);

    setFilteredStations(result);
    if (result.length > 0) fitMap(result, location);
  }, [capFilter, distFilter, typeFilter, allStations]);

  const handlePlanRoute = () => {
    if (selectedStation && location) {
      navigation.navigate('RoutePlanner', {
        originLoc: { lat: location.coords.latitude, lng: location.coords.longitude },
        destLoc: { lat: selectedStation.latitude, lng: selectedStation.longitude },
        destName: selectedStation.name
      });
    } else {
      alert("Please wait for your location to load");
    }
  };

  const handleBookSlot = () => {
    if (selectedStation) {
      navigation.navigate('Booking', {
        stationId: selectedStation.id,
        stationName: selectedStation.name,
        power: `${selectedStation.maxPowerKw} kW`,
        pricePerKwh: selectedStation.pricePerKwh.toFixed(2)
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GatiCharge Native</Text>
      </View>

      {/* Filter Hub */}
      {!loading && (
        <View style={styles.filterWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {/* Capacity Filters */}
            <TouchableOpacity 
              style={[styles.filterChip, capFilter === 50 && styles.filterChipActive]} 
              onPress={() => setCapFilter(capFilter === 50 ? null : 50)}
            >
              <Text style={[styles.filterText, capFilter === 50 && styles.filterTextActive]}>⚡ 50kW+</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.filterChip, capFilter === 100 && styles.filterChipActive]} 
              onPress={() => setCapFilter(capFilter === 100 ? null : 100)}
            >
              <Text style={[styles.filterText, capFilter === 100 && styles.filterTextActive]}>🚀 100kW+</Text>
            </TouchableOpacity>

            {/* Distance Filters */}
            <TouchableOpacity 
              style={[styles.filterChip, distFilter === 20 && styles.filterChipActive]} 
              onPress={() => setDistFilter(distFilter === 20 ? null : 20)}
            >
              <Text style={[styles.filterText, distFilter === 20 && styles.filterTextActive]}>{'📍 < 20km'}</Text>
            </TouchableOpacity>

            {/* Type Filters */}
            <TouchableOpacity 
              style={[styles.filterChip, typeFilter === 'CCS2' && styles.filterChipActive]} 
              onPress={() => setTypeFilter(typeFilter === 'CCS2' ? null : 'CCS2')}
            >
              <Text style={[styles.filterText, typeFilter === 'CCS2' && styles.filterTextActive]}>🔌 CCS2</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.filterChip, typeFilter === 'Type2' && styles.filterChipActive]} 
              onPress={() => setTypeFilter(typeFilter === 'Type2' ? null : 'Type2')}
            >
              <Text style={[styles.filterText, typeFilter === 'Type2' && styles.filterTextActive]}>🔋 Type-2</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00ff9d" />
          <Text style={styles.loadingText}>Locating nearby hubs...</Text>
        </View>
      ) : Platform.OS === 'web' ? (
        <View style={[styles.map, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
           <Text style={{ color: '#00ff9d', fontSize: 18, fontWeight: 'bold' }}>Map Interface [SIMULATED]</Text>
           <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>Native MapView is available on Mobile/Emulator</Text>
           <View style={{ marginTop: 20, width: '80%' }}>
              {filteredStations.slice(0, 5).map(s => (
                <View key={s.id} style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#333' }}>
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>📍 {s.name}</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 10 }}>{s.maxPowerKw}kW · {s.availableSlots} slots</Text>
                </View>
              ))}
           </View>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          customMapStyle={darkMapStyle}
          initialRegion={{
            latitude: location ? location.coords.latitude : 22.7196,
            longitude: location ? location.coords.longitude : 75.8577,
            latitudeDelta: 2.0,
            longitudeDelta: 2.0,
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
          {filteredStations.map((st) => (
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
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stationName} numberOfLines={1}>{selectedStation.name}</Text>
              <Text style={styles.stationAddress}>{selectedStation.address}</Text>
            </View>
            <View style={styles.priceTag}>
              <Text style={styles.priceTagText}>₹{selectedStation.pricePerKwh.toFixed(1)}/u</Text>
            </View>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{selectedStation.availableSlots}/{selectedStation.totalSlots}</Text>
              <Text style={styles.statLabel}>Available</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{selectedStation.maxPowerKw} kW</Text>
              <Text style={styles.statLabel}>Max Speed</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{selectedStation.waitTimeMins}m</Text>
              <Text style={[styles.statLabel, selectedStation.waitTimeMins > 0 && { color: '#ffaa44' }]}>
                {selectedStation.waitTimeMins > 0 ? 'Wait Time' : 'No Wait'}
              </Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.btnAction, styles.btnBook]} onPress={handleBookSlot}>
              <Text style={styles.btnTextDark}>Book Slot</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnAction, styles.btnRoute]} onPress={handlePlanRoute}>
              <Text style={styles.btnText}>Plan Route</Text>
            </TouchableOpacity>
          </View>
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
  filterWrapper: { backgroundColor: '#060b18', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a2744' },
  filterScroll: { paddingHorizontal: 15 },
  filterChip: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filterChipActive: { backgroundColor: 'rgba(68, 255, 178, 0.1)', borderColor: '#44ffb2' },
  filterText: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold' },
  filterTextActive: { color: '#44ffb2' },

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
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  priceTag: { backgroundColor: 'rgba(68, 255, 178, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#44ffb2' },
  priceTagText: { color: '#44ffb2', fontSize: 14, fontWeight: '900' },
  
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statBox: { backgroundColor: '#1a2744', borderRadius: 10, padding: 10, flex: 1, marginHorizontal: 5, alignItems: 'center' },
  statValue: { color: '#0ea5e9', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  
  btnPrimary: {
    backgroundColor: '#00ff9d', borderRadius: 10, padding: 15, alignItems: 'center',
  },
  btnText: { color: '#00ff9d', fontSize: 16, fontWeight: 'bold' },
  btnTextDark: { color: '#060b18', fontSize: 16, fontWeight: 'bold' },

  buttonRow: { flexDirection: 'row', gap: 12 },
  btnAction: { flex: 1, height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnBook: { backgroundColor: '#00ff9d' },
  btnRoute: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#00ff9d' },
});
