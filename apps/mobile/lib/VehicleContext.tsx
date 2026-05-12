import React, { createContext, useContext, useState } from 'react';
import { VEHICLE_SPECS, VehicleSpec } from './physics';

interface VehicleContextType {
  vehicleId: string;
  spec: VehicleSpec;
  batteryPercent: number;
  estimatedRange: number;
  isConnected: boolean;
  activeBooking: any | null;
  setVehicleId: (id: string) => void;
  setBatteryPercent: (pct: number) => void;
  setIsConnected: (status: boolean) => void;
  setActiveBooking: (booking: any | null) => void;
}

const VehicleContext = createContext<VehicleContextType>({
  vehicleId: 'nexon_ev',
  spec: VEHICLE_SPECS.nexon_ev,
  batteryPercent: 82,
  estimatedRange: 315,
  isConnected: false,
  setVehicleId: () => {},
  setBatteryPercent: () => {},
  setIsConnected: () => {},
});

export function VehicleProvider({ children }: { children: React.ReactNode }) {
  const [vehicleId, setVehicleId] = useState('nexon_ev');
  const [batteryPercent, setBatteryPercent] = useState(82);
  const [isConnected, setIsConnected] = useState(false);
  const [activeBooking, setActiveBooking] = useState<any | null>(null);

  const spec = VEHICLE_SPECS[vehicleId] || VEHICLE_SPECS.nexon_ev;

  // Calculate range from actual physics: usable energy / base efficiency
  const usableKwh = spec.battery_kwh * (batteryPercent / 100);
  const estimatedRange = Math.round((usableKwh * 1000) / spec.efficiency_wh_per_km);

  return (
    <VehicleContext.Provider value={{
      vehicleId, spec, batteryPercent, estimatedRange, isConnected, activeBooking,
      setVehicleId, setBatteryPercent, setIsConnected, setActiveBooking
    }}>
      {children}
    </VehicleContext.Provider>
  );
}

export function useVehicle() {
  return useContext(VehicleContext);
}
