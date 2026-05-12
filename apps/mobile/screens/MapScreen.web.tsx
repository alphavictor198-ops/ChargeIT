import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { stationStore, StationData } from '../lib/stationStore';

export default function MapScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [location, setLocation] = useState<any>(null);
  const [filteredStations, setFilteredStations] = useState<StationData[]>([]);
  const [selectedStation, setSelectedStation] = useState<StationData | null>(null);
  const [loading, setLoading] = useState(true);

  const [capFilter, setCapFilter] = useState<number | null>(null);
  const [distFilter, setDistFilter] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const hubs = stationStore.getStations();
      setFilteredStations(hubs);
      setLoading(false);
    })();
  }, []);

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GatiCharge [Web View]</Text>
      </View>

      <View style={styles.map}>
        <View style={{ flex: 1, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }}>
           <Text style={{ color: '#00ff9d', fontSize: 18, fontWeight: 'bold' }}>Map Interface [SIMULATED]</Text>
           <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>Web Preview Mode</Text>
           <ScrollView style={{ marginTop: 20, width: '90%' }}>
              {filteredStations.map(s => (
                <TouchableOpacity 
                  key={s.id} 
                  onPress={() => setSelectedStation(s)}
                  style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: '#333', backgroundColor: selectedStation?.id === s.id ? '#222' : 'transparent' }}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>📍 {s.name}</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 11 }}>{s.maxPowerKw}kW · {s.availableSlots} slots · ₹{s.pricePerKwh}/u</Text>
                </TouchableOpacity>
              ))}
           </ScrollView>
        </View>
      </View>

      {selectedStation && (
        <View style={styles.bottomSheet}>
          <Text style={styles.stationName}>{selectedStation.name}</Text>
          <Text style={styles.stationAddress}>{selectedStation.address}</Text>
          <TouchableOpacity style={styles.btnBook} onPress={handleBookSlot}>
            <Text style={styles.btnTextDark}>Book Slot</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060b18' },
  header: { paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: '#1a2744' },
  headerTitle: { color: '#00ff9d', fontSize: 20, fontWeight: 'bold' },
  map: { flex: 1 },
  bottomSheet: { backgroundColor: '#0d1526', padding: 20, borderTopWidth: 1, borderColor: '#1a2744' },
  stationName: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  stationAddress: { color: '#94a3b8', fontSize: 12, marginBottom: 15 },
  btnBook: { backgroundColor: '#00ff9d', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnTextDark: { color: '#060b18', fontWeight: 'bold' },
});
