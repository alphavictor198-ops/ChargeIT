import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
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

export default function PassengerProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
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
    navigation.navigate('ActiveTrip', { passengers: Array.from(selected) });
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
          <Text style={styles.btnText}>Start Trip</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060b18' },
  header: { paddingTop: 50, paddingHorizontal: 20 },
  backText: { color: '#0ea5e9', fontSize: 16, fontWeight: 'bold' },
  content: { padding: 20, paddingTop: 10 },
  title: { color: 'white', fontSize: 26, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: '#94a3b8', fontSize: 14, marginBottom: 30 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  profileCard: {
    width: '48%', backgroundColor: '#0d1526', borderRadius: 15, padding: 20,
    alignItems: 'center', marginBottom: 15,
    borderWidth: 2, borderColor: '#1a2744',
  },
  profileCardActive: { borderColor: '#00ff9d', backgroundColor: '#0d1f26' },
  profileIcon: { fontSize: 36, marginBottom: 8 },
  profileLabel: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  profileLabelActive: { color: '#00ff9d' },
  profileDesc: { color: '#94a3b8', fontSize: 11, textAlign: 'center' },
  btnPrimary: {
    backgroundColor: '#00ff9d', borderRadius: 12, padding: 18,
    alignItems: 'center', marginTop: 20,
  },
  btnText: { color: '#060b18', fontSize: 18, fontWeight: 'bold' },
});
