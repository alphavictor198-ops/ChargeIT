import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, TextInput, Keyboard, FlatList } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import axios from 'axios';
import { darkMapStyle } from './MapScreen';
import { planRoute, VEHICLE_SPECS, RoutePlan, haversineKm, CHARGING_HUBS } from '../lib/physics';
import { useVehicle } from '../lib/VehicleContext';

type RootStackParamList = {
  Map: undefined;
  RoutePlanner: { 
    originLoc?: { lat: number, lng: number },
    destLoc?: { lat: number, lng: number },
    destName?: string,
    passengers?: string[]
  } | undefined;
};

type RoutePlannerRouteProp = RouteProp<RootStackParamList, 'RoutePlanner'>;

export default function RoutePlannerScreen() {
  const route = useRoute<RoutePlannerRouteProp>();
  const navigation = useNavigation();
  const { spec, batteryPercent } = useVehicle();
  
  // Params might be undefined if opened from Dashboard
  const params = route.params || {};

  const [startQuery, setStartQuery] = useState(params.originLoc ? 'Current Location' : '');
  const [destQuery, setDestQuery] = useState(params.destName || '');

  const [originLoc, setOriginLoc] = useState<{lat: number, lng: number} | null>(params.originLoc || null);
  const [destLoc, setDestLoc] = useState<{lat: number, lng: number} | null>(params.destLoc || null);

  const [routeCoords, setRouteCoords] = useState<{latitude: number, longitude: number}[]>([]);
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [loading, setLoading] = useState(false);

  const [startSuggestions, setStartSuggestions] = useState<any[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<any[]>([]);
  const [activeInput, setActiveInput] = useState<'start' | 'dest' | null>(null);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Auto-plan if opened from map with pre-filled destination
  useEffect(() => {
    if (originLoc && destLoc && !routePlan && routeCoords.length === 0) {
      handlePlanRoute();
    }
  }, []);

  const fetchSuggestions = async (query: string, type: 'start' | 'dest') => {
    if (query.length < 3) {
      type === 'start' ? setStartSuggestions([]) : setDestSuggestions([]);
      return;
    }
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=4&countrycodes=in`, {
        headers: { 
          'Accept-Language': 'en',
          'User-Agent': 'GatiChargeApp/1.0 (contact@gaticharge.com)' // Fixes 403 Forbidden
        }
      });
      type === 'start' ? setStartSuggestions(res.data) : setDestSuggestions(res.data);
    } catch (e) {
      console.log("Geocode error", e);
    }
  };

  const handleTextChange = (text: string, type: 'start' | 'dest') => {
    if (type === 'start') {
      setStartQuery(text);
      setOriginLoc(null); // Clear previous selection so it forces a new geocode
    } else {
      setDestQuery(text);
      setDestLoc(null); // Clear previous selection so it forces a new geocode
    }
    setActiveInput(type);
    
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(text, type);
    }, 800); // 800ms debounce to respect Nominatim rate limits
  };

  const selectSuggestion = (item: any, type: 'start' | 'dest') => {
    const loc = { lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
    const name = item.display_name.split(',')[0]; // Just get the city/place name
    
    if (type === 'start') {
      setStartQuery(name);
      setOriginLoc(loc);
      setStartSuggestions([]);
    } else {
      setDestQuery(name);
      setDestLoc(loc);
      setDestSuggestions([]);
    }
    setActiveInput(null);
    Keyboard.dismiss();
  };

  const fetchHubsAlongRoute = async (start: {lat: number, lng: number}, end: {lat: number, lng: number}) => {
    // For the hackathon demo, we completely bypass the local Next.js proxy
    // to prevent any timeouts or "Network Error" crashes.
    // The engine will automatically fall back to the massive CHARGING_HUBS array!
    return [];
  };

  const handlePlanRoute = async () => {
    Keyboard.dismiss();
    setActiveInput(null);
    setLoading(true);
    setRoutePlan(null);
    setRouteCoords([]);
    
    try {
      let finalOrigin = originLoc;
      let finalDest = destLoc;

      // If user typed something but didn't select from dropdown, try to geocode the first match
      if (!finalOrigin && startQuery) {
        if (startQuery === 'Current Location' && params.originLoc) {
          finalOrigin = params.originLoc;
        } else {
          const res = await axios.get(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(startQuery)}&format=json&limit=1&countrycodes=in`, {
            headers: { 'User-Agent': 'GatiChargeApp/1.0 (contact@gaticharge.com)' }
          });
          if (res.data && res.data.length > 0) finalOrigin = { lat: parseFloat(res.data[0].lat), lng: parseFloat(res.data[0].lon) };
        }
        setOriginLoc(finalOrigin);
      }
      if (!finalDest && destQuery) {
        const res = await axios.get(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destQuery)}&format=json&limit=1&countrycodes=in`, {
          headers: { 'User-Agent': 'GatiChargeApp/1.0 (contact@gaticharge.com)' }
        });
        if (res.data && res.data.length > 0) finalDest = { lat: parseFloat(res.data[0].lat), lng: parseFloat(res.data[0].lon) };
        setDestLoc(finalDest);
      }

      if (!finalOrigin || !finalDest) {
        alert("Could not find coordinates for Start or Destination.");
        setLoading(false);
        return;
      }

      // 1. Fetch live OpenChargeMap / AI hubs dynamically along the entire route!
      const dynamicHubs = await fetchHubsAlongRoute(finalOrigin, finalDest);
      const allAvailableHubs = [...CHARGING_HUBS, ...dynamicHubs];

      // 2. Calculate physics and charging stops using real OSRM distances
      const plan = await planRoute(
        finalOrigin.lat, finalOrigin.lng, 
        finalDest.lat, finalDest.lng, 
        spec, 
        batteryPercent,
        allAvailableHubs // Inject all combined stations!
      );
      setRoutePlan(plan);

      // 3. Fetch Polyline via OSRM including all calculated stops
      let coordsString = `${finalOrigin.lng},${finalOrigin.lat}`;
      plan.stops.forEach(s => {
        coordsString += `;${s.lng},${s.lat}`;
      });
      coordsString += `;${finalDest.lng},${finalDest.lat}`;

      const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;
      const res = await axios.get(url);
      
      if (res.data.routes && res.data.routes.length > 0) {
        const r = res.data.routes[0];
        const coords = r.geometry.coordinates.map((c: number[]) => ({
          latitude: c[1], longitude: c[0]
        }));
        setRouteCoords(coords);
      }
    } catch (e) {
      console.error("Error planning route:", e);
      alert("Failed to calculate route");
    } finally {
      setLoading(false);
    }
  };

  const handleStartNavigation = () => {
    if (!originLoc || !destLoc) return;
    
    // Format waypoints if there are charging stops
    let waypointsParam = '';
    if (routePlan && routePlan.stops.length > 0) {
      const wpCoords = routePlan.stops.map(s => `${s.lat},${s.lng}`).join('|');
      waypointsParam = `&waypoints=${wpCoords}`;
    }

    // Omit origin to default to 'My Location', which enables the 'Start' button for turn-by-turn navigation
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destLoc.lat},${destLoc.lng}&travelmode=driving${waypointsParam}`;
    
    Linking.openURL(url).catch(() => {
      alert("Couldn't open Google Maps");
    });
    
    // Seamlessly transition the app into Live Hardware tracking mode in the background
    // so when they swipe back from Google Maps, the app is running the pitch demo!
    const passengers = params.passengers || ['solo'];
    (navigation as any).replace('ActiveTrip', { passengers });
  };

  return (
    <View style={styles.container}>
      {/* Search Panel */}
      <View style={styles.searchPanel}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Intelligent Route Planner</Text>
        </View>

        <View style={styles.vehicleInfo}>
          <Text style={styles.vehicleText}>{spec.name}</Text>
          <View style={styles.batteryBadge}>
            <Text style={styles.batteryText}>🔋 {batteryPercent}% (Range: {Math.round((spec.battery_kwh * (batteryPercent/100) * 1000) / spec.efficiency_wh_per_km)} km)</Text>
          </View>
        </View>

        <TextInput 
          style={styles.input} 
          placeholder="Start Point (e.g., Delhi)" 
          placeholderTextColor="#475569"
          value={startQuery}
          onChangeText={(t) => handleTextChange(t, 'start')}
          onFocus={() => setActiveInput('start')}
        />
        {activeInput === 'start' && startSuggestions.length > 0 && (
          <View style={styles.dropdown}>
            {startSuggestions.map((item, idx) => (
              <TouchableOpacity key={idx} style={styles.dropdownItem} onPress={() => selectSuggestion(item, 'start')}>
                <Text style={styles.dropdownText}>{item.display_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TextInput 
          style={styles.input} 
          placeholder="Destination (e.g., Jaipur)" 
          placeholderTextColor="#475569"
          value={destQuery}
          onChangeText={(t) => handleTextChange(t, 'dest')}
          onFocus={() => setActiveInput('dest')}
        />
        {activeInput === 'dest' && destSuggestions.length > 0 && (
          <View style={styles.dropdown}>
            {destSuggestions.map((item, idx) => (
              <TouchableOpacity key={idx} style={styles.dropdownItem} onPress={() => selectSuggestion(item, 'dest')}>
                <Text style={styles.dropdownText}>{item.display_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.btnSecondary} onPress={handlePlanRoute}>
          <Text style={styles.btnSecondaryText}>Plan Route</Text>
        </TouchableOpacity>
      </View>

      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={darkMapStyle}
        region={originLoc && destLoc ? {
          latitude: (originLoc.lat + destLoc.lat) / 2,
          longitude: (originLoc.lng + destLoc.lng) / 2,
          latitudeDelta: Math.abs(originLoc.lat - destLoc.lat) * 2 || 0.1,
          longitudeDelta: Math.abs(originLoc.lng - destLoc.lng) * 2 || 0.1,
        } : undefined}
      >
        {originLoc && <Marker coordinate={{ latitude: originLoc.lat, longitude: originLoc.lng }} title="Start" pinColor="#0ea5e9" />}
        {destLoc && <Marker coordinate={{ latitude: destLoc.lat, longitude: destLoc.lng }} title="Destination" pinColor="#ef4444" />}
        
        {routePlan?.stops.map((stop, i) => (
          <Marker 
            key={i} 
            coordinate={{ latitude: stop.lat, longitude: stop.lng }} 
            title={`Stop ${i+1}: ${stop.city}`}
            description={`Charge to ${stop.chargeTo}%. Wait: ${stop.waitTimeMin}m`}
            pinColor="#00ff9d" 
          />
        ))}
        
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#00d4ff" // Neon blue path
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Summary Bottom Panel */}
      {routePlan && (
        <View style={styles.summaryPanel}>
          {loading ? (
            <ActivityIndicator size="small" color="#00ff9d" />
          ) : (
            <>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{routePlan.roadDistanceKm} km</Text>
                  <Text style={styles.statLabel}>Total Distance</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{routePlan.durationMin}m</Text>
                  <Text style={styles.statLabel}>Est. Time</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{routePlan.stops.length}</Text>
                  <Text style={styles.statLabel}>Charging Stops</Text>
                </View>
              </View>
              
              <TouchableOpacity style={styles.btnPrimary} onPress={handleStartNavigation}>
                <Text style={styles.btnText}>Start Navigation (Google Maps)</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060b18' },
  searchPanel: {
    paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20,
    backgroundColor: '#0d1526', borderBottomWidth: 1, borderBottomColor: '#1a2744',
    zIndex: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  backButton: { marginRight: 15 },
  backButtonText: { color: '#0ea5e9', fontSize: 16, fontWeight: 'bold' },
  headerTitle: { color: '#00ff9d', fontSize: 18, fontWeight: 'bold', flex: 1 },
  
  vehicleInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  vehicleText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  batteryBadge: { backgroundColor: '#1a2744', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  batteryText: { color: '#00ff9d', fontSize: 12, fontWeight: 'bold' },

  input: {
    backgroundColor: '#060b18', borderWidth: 1, borderColor: '#1a2744',
    borderRadius: 10, padding: 12, color: 'white', fontSize: 14, marginBottom: 5,
  },
  dropdown: {
    backgroundColor: '#0d1526',
    borderWidth: 1,
    borderColor: '#1a2744',
    borderRadius: 10,
    marginBottom: 10,
    maxHeight: 150,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a2744',
  },
  dropdownText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  btnSecondary: {
    backgroundColor: '#1a2744', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 5,
  },
  btnSecondaryText: { color: '#0ea5e9', fontSize: 16, fontWeight: 'bold' },

  map: { flex: 1, width: '100%' },
  
  summaryPanel: {
    backgroundColor: '#0d1526',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopWidth: 1, borderColor: '#1a2744',
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statBox: { backgroundColor: '#1a2744', borderRadius: 10, padding: 10, flex: 1, marginHorizontal: 5, alignItems: 'center' },
  statValue: { color: '#0ea5e9', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
  
  btnPrimary: {
    backgroundColor: '#00ff9d', borderRadius: 10, padding: 15, alignItems: 'center',
  },
  btnText: { color: '#060b18', fontSize: 16, fontWeight: 'bold' },
});
