import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Linking, Alert, Animated } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calendar, Clock, Zap, MapPin, CheckCircle, CreditCard, ChevronRight } from 'lucide-react-native';
import { ocppEngine } from '../lib/ocppEngine';
import { stationStore } from '../lib/stationStore';
import { useVehicle } from '../lib/VehicleContext';

type BookingParams = {
  stationId: string;
  stationName: string;
  power: string;
  pricePerKwh: string;
};

const TIME_SLOTS = [
  "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
  "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM"
];

export default function BookingScreen() {
  const route = useRoute<RouteProp<{ Booking: BookingParams }, 'Booking'>>();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { stationId, stationName, power, pricePerKwh } = route.params;
  const { setActiveBooking } = useVehicle();

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  // Simulate already booked slots for this specific station
  const bookedSlots = React.useMemo(() => {
    const booked = new Set<string>();
    // Use stationId as a seed for consistent mock data
    const seed = stationId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    TIME_SLOTS.forEach((slot, index) => {
      if ((seed + index) % 4 === 0) booked.add(slot);
    });
    return booked;
  }, [stationId]);

  const handleGPayPayment = async () => {
    if (!selectedSlot) {
      Alert.alert("Select a Slot", "Please choose a time slot before proceeding to payment.");
      return;
    }

    setIsProcessing(true);

    // 1. Prefilled UPI Details for GPay
    const upiId = "gaticharge@okaxis";
    const amount = "150.00"; 
    const txnRef = `BOOK_${Math.floor(Math.random() * 1000000)}`;
    const upiUrl = `upi://pay?pa=${upiId}&pn=GatiCharge&tr=${txnRef}&am=${amount}&cu=INR&tn=Booking_${stationName}_${selectedSlot}`;

    try {
      // 2. Open GPay
      const supported = await Linking.canOpenURL(upiUrl);
      if (supported) {
        await Linking.openURL(upiUrl);
      }
      
      // 3. Initiate OCPP Handshake (The "Physical Lock")
      const ocppResponse = await ocppEngine.reserveNow(1, new Date(), "USER_TAG_9921");
      
      if (ocppResponse.status === 'Accepted') {
        // 4. Update the live Station Store (Real-time Availability)
        stationStore.bookSlot(stationId);
        
        // 5. Store globally for Dashboard management
        setActiveBooking({
          stationId,
          stationName,
          selectedSlot,
          txnId: 'GATI-RESRV-9921'
        });
        
        setTimeout(() => {
          setIsProcessing(false);
          setBookingConfirmed(true);
        }, 2000);
      } else {
        setIsProcessing(false);
        Alert.alert("OCPP Error", "The station hardware is currently unreachable or occupied.");
      }

    } catch (err) {
      setIsProcessing(false);
      Alert.alert("Process Error", "An error occurred during the booking handshake.");
    }
  };

  if (bookingConfirmed) {
    return (
      <View style={styles.successContainer}>
        <CheckCircle color="#44ffb2" size={100} strokeWidth={1.5} />
        <Text style={styles.successTitle}>Booking Secured!</Text>
        <Text style={styles.successSub}>
          Your slot at {stationName} is reserved for {selectedSlot}.
        </Text>
        
        <View style={styles.receiptCard}>
          <Text style={styles.receiptLabel}>Transaction ID</Text>
          <Text style={styles.receiptValue}>GATI-RESRV-9921</Text>
          <View style={styles.divider} />
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Station</Text>
            <Text style={styles.receiptValue}>{stationName}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Time</Text>
            <Text style={styles.receiptValue}>{selectedSlot}</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.btnDone} 
          onPress={() => navigation.navigate('PassengerProfile', { stationId, stationName })}
        >
          <Text style={styles.btnDoneText}>START NAVIGATION</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Secure Your Slot</Text>
        <Text style={styles.subtitle}>Avoiding the queue at {stationName}</Text>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoItem}>
          <Zap color="#ffaa44" size={20} />
          <Text style={styles.infoText}>{power}</Text>
        </View>
        <View style={styles.infoItem}>
          <CreditCard color="#44ffb2" size={20} />
          <Text style={styles.infoText}>₹{pricePerKwh}/kWh</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Select Time (Today)</Text>
      <View style={styles.slotGrid}>
        {TIME_SLOTS.map((slot) => {
          const isBooked = bookedSlots.has(slot);
          return (
            <TouchableOpacity
              key={slot}
              style={[
                styles.slotItem,
                selectedSlot === slot && styles.slotItemSelected,
                isBooked && styles.slotItemDisabled
              ]}
              onPress={() => !isBooked && setSelectedSlot(slot)}
              disabled={isBooked}
            >
              <Text style={[
                styles.slotText,
                selectedSlot === slot && styles.slotTextSelected,
                isBooked && styles.slotTextDisabled
              ]}>{isBooked ? 'Booked' : slot}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.paymentCard}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Reservation Fee</Text>
          <Text style={styles.priceValue}>₹150.00</Text>
        </View>
        <Text style={styles.priceNote}>This amount will be adjusted in your final bill.</Text>
        
        <TouchableOpacity 
          style={[styles.btnPay, isProcessing && { opacity: 0.7 }]} 
          onPress={handleGPayPayment}
          disabled={isProcessing}
        >
          <Image 
            source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Google_Pay_Logo_%282020%29.svg/1024px-Google_Pay_Logo_%282020%29.svg.png' }} 
            style={styles.gpayLogo}
            resizeMode="contain"
          />
          <Text style={styles.btnPayText}>
            {isProcessing ? 'PROCESSING...' : 'PAY NOW'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060404', padding: 20 },
  header: { marginTop: 40, marginBottom: 30 },
  title: { color: 'white', fontSize: 32, fontWeight: '900', letterSpacing: 1 },
  subtitle: { color: '#94a3b8', fontSize: 16, marginTop: 5 },
  
  infoCard: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 20, marginBottom: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  infoItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  infoText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  sectionTitle: { color: '#ffaa44', fontSize: 14, fontWeight: 'bold', letterSpacing: 2, marginBottom: 20, textTransform: 'uppercase' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 40 },
  slotItem: { width: '30%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  slotItemSelected: { backgroundColor: 'rgba(68, 255, 178, 0.1)', borderColor: '#44ffb2' },
  slotItemDisabled: { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'transparent', opacity: 0.5 },
  slotText: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold' },
  slotTextSelected: { color: '#44ffb2' },
  slotTextDisabled: { color: '#475569', fontSize: 11 },

  paymentCard: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 25, padding: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  priceLabel: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  priceValue: { color: '#44ffb2', fontSize: 24, fontWeight: '900' },
  priceNote: { color: '#64748b', fontSize: 12, marginBottom: 25 },
  
  btnPay: { backgroundColor: 'white', borderRadius: 15, height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  gpayLogo: { width: 60, height: 25 },
  btnPayText: { color: '#060404', fontWeight: '900', fontSize: 16, letterSpacing: 1 },

  successContainer: { flex: 1, backgroundColor: '#060404', justifyContent: 'center', alignItems: 'center', padding: 30 },
  successTitle: { color: 'white', fontSize: 32, fontWeight: '900', marginTop: 25 },
  successSub: { color: '#94a3b8', fontSize: 16, textAlign: 'center', marginTop: 10, lineHeight: 24 },
  receiptCard: { width: '100%', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 25, marginTop: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  receiptLabel: { color: '#64748b', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  receiptValue: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 15 },
  btnDone: { width: '100%', backgroundColor: '#ff6b1a', borderRadius: 15, height: 60, alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  btnDoneText: { color: 'white', fontWeight: '900', fontSize: 16, letterSpacing: 1 }
});
