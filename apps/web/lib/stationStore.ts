import { CHARGING_HUBS } from './physics';

export interface StationData {
  id: string;
  name: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  totalSlots: number;
  availableSlots: number;
  maxPowerKw: number;
  pricePerKwh: number;
  waitTimeMins: number;
}

class StationStore {
  private stations: StationData[] = [];

  constructor() {
    this.initializeStations();
  }

  private initializeStations() {
    this.stations = CHARGING_HUBS.map((h, i) => ({
      id: i.toString(),
      name: `${h.operator} Hub ${h.city}`,
      city: h.city,
      address: `${h.city} Highway`,
      latitude: h.lat,
      longitude: h.lng,
      totalSlots: 4,
      availableSlots: Math.floor(Math.random() * 3) + 1,
      maxPowerKw: h.power_kw,
      pricePerKwh: 18.50 + (Math.random() * 5),
      waitTimeMins: 0
    }));
    this.calculateWaitTimes();
  }

  private calculateWaitTimes() {
    this.stations.forEach(s => {
      const occupied = s.totalSlots - s.availableSlots;
      s.waitTimeMins = occupied > 0 ? (occupied * 12) : 0;
    });
  }

  getStations(): StationData[] {
    return this.stations;
  }

  getStationById(id: string): StationData | undefined {
    return this.stations.find(s => s.id === id);
  }

  bookSlot(stationId: string): boolean {
    const station = this.getStationById(stationId);
    if (station && station.availableSlots > 0) {
      station.availableSlots -= 1;
      this.calculateWaitTimes();
      return true;
    }
    return false;
  }

  cancelBooking(stationId: string) {
    const station = this.getStationById(stationId);
    if (station && station.availableSlots < station.totalSlots) {
      station.availableSlots += 1;
      this.calculateWaitTimes();
    }
  }

  simulateExternalTraffic() {
    this.stations.forEach(s => {
      if (Math.random() > 0.8) {
        if (s.availableSlots > 0 && Math.random() > 0.5) s.availableSlots -= 1;
        else if (s.availableSlots < s.totalSlots) s.availableSlots += 1;
      }
    });
    this.calculateWaitTimes();
  }
}

export const stationStore = new StationStore();
