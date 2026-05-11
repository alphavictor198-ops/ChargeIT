import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import MapScreen from './screens/MapScreen';
import RoutePlannerScreen from './screens/RoutePlannerScreen';
import PassengerProfileScreen from './screens/PassengerProfileScreen';
import ActiveTripScreen from './screens/ActiveTripScreen';
import TripSummaryScreen from './screens/TripSummaryScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Map" component={MapScreen} />
        <Stack.Screen name="RoutePlanner" component={RoutePlannerScreen} />
        <Stack.Screen name="PassengerProfile" component={PassengerProfileScreen} />
        <Stack.Screen name="ActiveTrip" component={ActiveTripScreen} />
        <Stack.Screen name="TripSummary" component={TripSummaryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
