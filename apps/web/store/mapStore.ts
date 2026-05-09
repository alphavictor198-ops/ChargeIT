/**
 * Zustand store for map state: stations, user location, selected station.
 */
import { create } from "zustand";

export interface Station {
  id: string;
  name: string;
  operator?: string;
  address?: string;
  city?: string;
  state?: string;
  latitude: number;
  longitude: number;
  charger_types: string[];
  total_slots: number;
  available_slots: number;
  max_power_kw: number;
  trust_score: number;
  is_open: boolean;
  is_verified: boolean;
  distance_km?: number;
}

interface MapState {
  stations: Station[];
  selectedStation: Station | null;
  userLocation: [number, number] | null;
  mapCenter: [number, number];
  mapZoom: number;
  isLoadingStations: boolean;
  filters: {
    charger_type: string | null;
    available_only: boolean;
    min_power_kw: number | null;
    radius_km: number;
  };
  setStations: (stations: Station[]) => void;
  setSelectedStation: (station: Station | null) => void;
  setUserLocation: (loc: [number, number]) => void;
  setMapCenter: (center: [number, number], zoom?: number) => void;
  setFilters: (filters: Partial<MapState["filters"]>) => void;
  setLoadingStations: (v: boolean) => void;
}

export const useMapStore = create<MapState>((set) => ({
  stations: [],
  selectedStation: null,
  userLocation: null,
  mapCenter: [20.5937, 78.9629], // India center
  mapZoom: 5,
  isLoadingStations: false,
  filters: {
    charger_type: null,
    available_only: false,
    min_power_kw: null,
    radius_km: 15,
  },

  setStations: (stations) => set({ stations }),
  setSelectedStation: (station) => set({ selectedStation: station }),
  setUserLocation: (loc) => set({ userLocation: loc, mapCenter: loc, mapZoom: 13 }),
  setMapCenter: (center, zoom) =>
    set({ mapCenter: center, ...(zoom !== undefined ? { mapZoom: zoom } : {}) }),
  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
  setLoadingStations: (v) => set({ isLoadingStations: v }),
}));
