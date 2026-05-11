import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export default function SplashScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();

    // Navigate to Login after 3 seconds
    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ scale: fadeAnim }] }]}>
        <View style={styles.icon3DWrapper}>
          <View style={styles.glowAura} />
          <Text style={styles.boltIcon}>⚡</Text>
        </View>
        <Text style={styles.logoText}>GatiCharge</Text>
        <View style={styles.accentBar} />
        <Text style={styles.tagline}>Powering India's EV Revolution</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060404',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  icon3DWrapper: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  glowAura: {
    position: 'absolute',
    width: 80,
    height: 80,
    backgroundColor: '#ffaa44',
    borderRadius: 40,
    shadowColor: '#ffaa44',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 50,
    elevation: 30,
    opacity: 0.4,
  },
  boltIcon: {
    fontSize: 80,
    color: '#ffaa44',
    textShadowColor: 'rgba(255, 170, 68, 1)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  logoText: {
    fontSize: 42,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  accentBar: {
    width: 60,
    height: 4,
    backgroundColor: '#ff6b1a',
    marginTop: 10,
    borderRadius: 2,
  },
  tagline: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 15,
    letterSpacing: 2,
    fontWeight: '500',
  }
});
