import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PassengerProfile } from '../lib/humanStateEngine';

const PROFILES: { id: PassengerProfile; label: string; icon: string; desc: string }[] = [
  { id: 'solo', label: 'Solo', icon: '🧑', desc: 'Just me' },
  { id: 'partner', label: 'Partner', icon: '👫', desc: 'Adult companion' },
  { id: 'infant', label: 'Infant', icon: '👶', desc: 'Under 2 years' },
  { id: 'child', label: 'Child', icon: '🧒', desc: '2–12 years' },
  { id: 'elderly', label: 'Elderly', icon: '👴', desc: 'Senior passenger' },
  { id: 'pet', label: 'Pet', icon: '🐕', desc: 'Dog, cat, etc.' },
];

type ProfileParams = {
  stationId?: string;
  stationName?: string;
};

export default function PassengerProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: ProfileParams }, 'params'>>();
  const { stationId, stationName } = route.params || {};
  
  const [selected, setSelected] = useState<Set<PassengerProfile>>(new Set(['solo']));

  const toggle = (id: PassengerProfile) => {
    const next = new Set(selected);
    if (id === 'solo') {
      next.clear();
      next.add('solo');
    } else {
      next.delete('solo');
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) next.add('solo');
    }
    setSelected(next);
  };

  const handleContinue = () => {
    const passengers = Array.from(selected);
    if (stationId) {
      navigation.navigate('ActiveTrip', { 
        passengers,
        destinationId: stationId,
        destinationName: stationName
      });
    } else {
      navigation.navigate('RoutePlanner', { passengers });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Who's travelling with you?</Text>
        <Text style={styles.subtitle}>We'll adapt recommendations for everyone's comfort.</Text>

        <View style={styles.grid}>
          {PROFILES.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.profileCard, selected.has(p.id) && styles.profileCardActive]}
              onPress={() => toggle(p.id)}
            >
              <Text style={styles.profileIcon}>{p.icon}</Text>
              <Text style={[styles.profileLabel, selected.has(p.id) && styles.profileLabelActive]}>{p.label}</Text>
              <Text style={styles.profileDesc}>{p.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.btnPrimary} onPress={handleContinue}>
          <Text style={styles.btnText}>Continue to Route Planner</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060404' },
  header: { paddingTop: 50, paddingHorizontal: 20 },
  backText: { color: '#ff6b1a', fontSize: 16, fontWeight: 'bold' },
  content: { padding: 20, paddingTop: 10 },
  title: { color: 'white', fontSize: 26, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: '#94a3b8', fontSize: 14, marginBottom: 30 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  profileCard: {
    width: '48%', backgroundColor: '#0a0806', borderRadius: 15, padding: 20,
    alignItems: 'center', marginBottom: 15,
    borderWidth: 2, borderColor: 'rgba(255,107,26,0.15)',
  },
  profileCardActive: { borderColor: '#ffaa44', backgroundColor: 'rgba(255,107,26,0.1)' },
  profileIcon: { fontSize: 36, marginBottom: 8 },
  profileLabel: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  profileLabelActive: { color: '#ffaa44' },
  profileDesc: { color: '#94a3b8', fontSize: 11, textAlign: 'center' },
  btnPrimary: {
    backgroundColor: '#ff6b1a', borderRadius: 12, padding: 18,
    alignItems: 'center', marginTop: 20,
  },
  btnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});
