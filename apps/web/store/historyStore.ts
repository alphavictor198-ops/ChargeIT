/**
 * Zustand store to simulate a database for user history
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuthStore } from "./authStore";

export interface ChargingSession {
  id: string;
  date: string;
  stationName: string;
  energyKwh: number;
  costInr: number;
  durationMin: number;
}

export interface TripHistory {
  id: string;
  date: string;
  origin: string;
  destination: string;
  vehicle: string;
  distanceKm: number;
  stops: number;
  durationMin: number;
  energyKwh: number;
  efficiency: number; // Wh/km
}

interface HistoryState {
  chargings: ChargingSession[];
  trips: TripHistory[];
  addCharging: (session: Omit<ChargingSession, "id" | "date">) => void;
  addTrip: (trip: Omit<TripHistory, "id" | "date">) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      chargings: [
        { id: "c1", date: new Date(Date.now() - 86400000 * 2).toISOString(), stationName: "Tata Power, Bhopal", energyKwh: 24.5, costInr: 450, durationMin: 35 },
        { id: "c2", date: new Date(Date.now() - 86400000 * 5).toISOString(), stationName: "Statiq, Indore", energyKwh: 18.2, costInr: 320, durationMin: 25 },
        { id: "c3", date: new Date(Date.now() - 86400000 * 12).toISOString(), stationName: "ChargeZone, Ujjain", energyKwh: 32.1, costInr: 600, durationMin: 45 },
      ],
      trips: [
        { id: "t1", date: new Date(Date.now() - 86400000 * 2).toISOString(), origin: "Indore", destination: "Bhopal", vehicle: "Tata Nexon EV", distanceKm: 195, stops: 1, durationMin: 210, energyKwh: 28.5, efficiency: 146 },
        { id: "t2", date: new Date(Date.now() - 86400000 * 10).toISOString(), origin: "Indore", destination: "Ujjain", vehicle: "Tata Nexon EV", distanceKm: 55, stops: 0, durationMin: 65, energyKwh: 8.2, efficiency: 149 },
      ],

      addCharging: (session) => set((state) => ({
        chargings: [
          { ...session, id: Math.random().toString(36).substr(2, 9), date: new Date().toISOString() },
          ...state.chargings
        ]
      })),

      addTrip: (trip) => set((state) => ({
        trips: [
          { ...trip, id: Math.random().toString(36).substr(2, 9), date: new Date().toISOString() },
          ...state.trips
        ]
      })),

      clearHistory: () => set({ chargings: [], trips: [] })
    }),
    {
      name: "gaticharge-history-db",
    }
  )
);
