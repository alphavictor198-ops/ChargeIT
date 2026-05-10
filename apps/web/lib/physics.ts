/**
 * Client-side EV physics calculations — mirrors the backend energy_model.py
 * Used for instant/demo-mode results without a backend call.
 */

export interface VehicleSpec {
  id: string;
  name: string;
  battery_kwh: number;       // usable kWh
  efficiency_wh_per_km: number; // base Wh/km
  drag_coefficient: number;  // Cd
  frontal_area_m2: number;   // A
  mass_kg: number;
  rolling_resistance: number; // Cr
  max_charge_rate_kw: number;
  hvac_max_kw: number;
}

export const VEHICLE_SPECS: Record<string, VehicleSpec> = {
  nexon_ev: {
    id: "nexon_ev", name: "Tata Nexon EV",
    battery_kwh: 37.5, efficiency_wh_per_km: 155,
    drag_coefficient: 0.36, frontal_area_m2: 2.35,
    mass_kg: 1580, rolling_resistance: 0.012,
    max_charge_rate_kw: 50, hvac_max_kw: 2.2,
  },
  tiago_ev: {
    id: "tiago_ev", name: "Tata Tiago EV",
    battery_kwh: 21.5, efficiency_wh_per_km: 115,
    drag_coefficient: 0.34, frontal_area_m2: 2.10,
    mass_kg: 1175, rolling_resistance: 0.011,
    max_charge_rate_kw: 25, hvac_max_kw: 1.8,
  },
  mg_zs_ev: {
    id: "mg_zs_ev", name: "MG ZS EV",
    battery_kwh: 46.8, efficiency_wh_per_km: 175,
    drag_coefficient: 0.38, frontal_area_m2: 2.55,
    mass_kg: 1620, rolling_resistance: 0.013,
    max_charge_rate_kw: 76, hvac_max_kw: 2.5,
  },
  byd_atto3: {
    id: "byd_atto3", name: "BYD Atto 3",
    battery_kwh: 56.6, efficiency_wh_per_km: 165,
    drag_coefficient: 0.29, frontal_area_m2: 2.52,
    mass_kg: 1750, rolling_resistance: 0.011,
    max_charge_rate_kw: 88, hvac_max_kw: 2.8,
  },
};

const AIR_DENSITY = 1.225;
const GRAVITY = 9.81;

/** Great-circle distance in km */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** India road factor — roads are not straight lines */
export const ROAD_FACTOR = 1.22; // ~22% more than crow-flies

/**
 * Physics-based power consumption in kW.
 * P = P_rolling + P_aero + P_gradient + P_hvac
 */
export function computePowerKw(
  spec: VehicleSpec,
  speedKmh: number,
  gradientDeg = 0,
  tempCelsius = 28,
  hvacOn = true,
  trafficFactor = 1.0
): { rolling: number; aero: number; gradient: number; hvac: number; total: number } {
  const v = speedKmh / 3.6; // m/s
  const theta = (gradientDeg * Math.PI) / 180;

  const rolling = spec.mass_kg * GRAVITY * spec.rolling_resistance * v;
  const aero = 0.5 * AIR_DENSITY * spec.drag_coefficient * spec.frontal_area_m2 * v ** 3;
  const grad = spec.mass_kg * GRAVITY * Math.sin(theta) * v;

  const tempDelta = Math.abs(tempCelsius - 22);
  const hvac = hvacOn ? (spec.hvac_max_kw * Math.min(tempDelta / 20, 1) * 1000) : 0;

  const traffic_penalty = 1 + Math.max(trafficFactor - 1, 0) * 0.15;
  const mechanical = (rolling + aero + grad) * traffic_penalty;
  const total = Math.max((mechanical / 0.88 + hvac) / 1000, 0.1);

  return {
    rolling: +(rolling / 1000).toFixed(3),
    aero:    +(aero    / 1000).toFixed(3),
    gradient: +(grad   / 1000).toFixed(3),
    hvac:    +(hvac    / 1000).toFixed(3),
    total:   +total.toFixed(3),
  };
}

/**
 * Compute realistic efficiency (Wh/km) for given conditions.
 * Blends physics model with manufacturer spec.
 */
export function effectiveEfficiency(
  spec: VehicleSpec,
  speedKmh: number,
  tempCelsius = 28,
  hvacOn = true,
  trafficFactor = 1.0,
  elevationGainM = 0,
  distanceKm = 100
): number {
  const gradDeg = distanceKm > 0
    ? (Math.atan(elevationGainM / (distanceKm * 1000)) * 180) / Math.PI
    : 0;
  const pw = computePowerKw(spec, speedKmh, gradDeg, tempCelsius, hvacOn, trafficFactor);
  return +((pw.total / speedKmh) * 1000).toFixed(1);
}

/** Predict range and SOC consumption for a trip segment */
export function predictTripSegment(
  spec: VehicleSpec,
  distanceKm: number,
  startSoc: number,
  speedKmh = 60,
  tempCelsius = 28,
  hvacOn = true,
  trafficFactor = 1.0,
  elevationGainM = 0
): {
  efficiency_wh_per_km: number;
  energy_kwh: number;
  soc_consumed: number;
  arrival_soc: number;
  feasible: boolean;
  range_km: number;
} {
  const eff = effectiveEfficiency(spec, speedKmh, tempCelsius, hvacOn, trafficFactor, elevationGainM, distanceKm);

  // Cold-weather penalty
  let tempMultiplier = 1.0;
  if (tempCelsius < 5)  tempMultiplier = 1.25;
  else if (tempCelsius < 15) tempMultiplier = 1.10;
  else if (tempCelsius > 40) tempMultiplier = 1.08;

  const adjEff = eff * tempMultiplier;
  const energyKwh = (adjEff * distanceKm) / 1000;
  const socConsumed = (energyKwh / spec.battery_kwh) * 100;
  const arrivalSoc = Math.max(startSoc - socConsumed, 0);
  const usableKwh = spec.battery_kwh * (startSoc / 100);
  const rangeKm = (usableKwh * 1000) / adjEff;

  return {
    efficiency_wh_per_km: +adjEff.toFixed(1),
    energy_kwh: +energyKwh.toFixed(2),
    soc_consumed: +socConsumed.toFixed(1),
    arrival_soc: +arrivalSoc.toFixed(1),
    feasible: arrivalSoc >= 10,
    range_km: +rangeKm.toFixed(1),
  };
}

/** Monte Carlo confidence interval (simplified browser version, 500 sims) */
export function monteCarloSoc(
  spec: VehicleSpec,
  distanceKm: number,
  startSoc: number,
  speedKmh = 60,
  tempCelsius = 28
): { p5: number; p50: number; p95: number; failureProb: number } {
  const results: number[] = [];
  for (let i = 0; i < 500; i++) {
    const simSpeed = speedKmh * (1 + (Math.random() - 0.5) * 0.16);
    const simTemp  = tempCelsius + (Math.random() - 0.5) * 6;
    const simTraffic = 1 + Math.random() * 0.4;
    const seg = predictTripSegment(spec, distanceKm, startSoc, simSpeed, simTemp, true, simTraffic);
    results.push(seg.arrival_soc);
  }
  results.sort((a, b) => a - b);
  const p = (pct: number) => results[Math.floor((pct / 100) * results.length)];
  const failures = results.filter(r => r <= 0).length;
  return {
    p5:  +p(5).toFixed(1),
    p50: +p(50).toFixed(1),
    p95: +p(95).toFixed(1),
    failureProb: +(failures / results.length).toFixed(3),
  };
}

/** Plan optimal charging stops for a route */
export interface ChargingStopPlan {
  city: string;
  operator: string;
  lat: number;
  lng: number;
  arrivalSoc: number;
  chargeTo: number;
  chargeTimeMin: number;
  waitTimeMin: number;
  stationType: string;
}

export interface RoutePlan {
  distanceKm: number;
  roadDistanceKm: number;
  durationMin: number;
  stops: ChargingStopPlan[];
  arrivalSoc: number;
  energyKwh: number;
  efficiency: number;
  monteCarlo: { p5: number; p50: number; p95: number; failureProb: number };
  warnings: string[];
  speedKmh: number;
}

// Major Indian highway charging hubs with operator names
export const CHARGING_HUBS: { city: string; operator: string; lat: number; lng: number; power_kw: number; wait_min: number }[] = [
  // North India
  { city: "Delhi",        operator: "Tata Power",   lat: 28.6139, lng: 77.2090, power_kw: 150, wait_min: 15 },
  { city: "Mathura",      operator: "Tata Power",   lat: 27.4924, lng: 77.6737, power_kw: 50,  wait_min: 5  },
  { city: "Agra",         operator: "Statiq",       lat: 27.1767, lng: 78.0081, power_kw: 60,  wait_min: 10 },
  { city: "Gwalior",      operator: "ChargeZone",   lat: 26.2183, lng: 78.1828, power_kw: 50,  wait_min: 8  },
  { city: "Jhansi",       operator: "BPCL",         lat: 25.4484, lng: 78.5685, power_kw: 50,  wait_min: 5  },
  { city: "Jaipur",       operator: "Statiq",       lat: 26.9124, lng: 75.7873, power_kw: 60,  wait_min: 10 },
  { city: "Ajmer",        operator: "BPCL",         lat: 26.4499, lng: 74.6399, power_kw: 50,  wait_min: 8  },
  { city: "Jodhpur",      operator: "Tata Power",   lat: 26.2389, lng: 73.0243, power_kw: 50,  wait_min: 10 },
  { city: "Udaipur",      operator: "ChargeZone",   lat: 24.5854, lng: 73.7125, power_kw: 50,  wait_min: 8  },
  { city: "Chandigarh",   operator: "Tata Power",   lat: 30.7333, lng: 76.7794, power_kw: 60,  wait_min: 8  },
  { city: "Ambala",       operator: "ChargeZone",   lat: 30.3782, lng: 76.7767, power_kw: 50,  wait_min: 5  },
  { city: "Ludhiana",     operator: "Statiq",       lat: 30.9010, lng: 75.8573, power_kw: 60,  wait_min: 10 },
  { city: "Amritsar",     operator: "HPCL",         lat: 31.6340, lng: 74.8723, power_kw: 50,  wait_min: 10 },
  { city: "Haridwar",     operator: "IOCL",         lat: 29.9457, lng: 78.1642, power_kw: 50,  wait_min: 8  },
  { city: "Dehradun",     operator: "Tata Power",   lat: 30.3165, lng: 78.0322, power_kw: 50,  wait_min: 10 },
  { city: "Lucknow",      operator: "Statiq",       lat: 26.8467, lng: 80.9462, power_kw: 60,  wait_min: 12 },
  { city: "Kanpur",       operator: "ChargeZone",   lat: 26.4499, lng: 80.3319, power_kw: 50,  wait_min: 8  },
  { city: "Varanasi",     operator: "Tata Power",   lat: 25.3176, lng: 82.9739, power_kw: 50,  wait_min: 10 },
  { city: "Patna",        operator: "BPCL",         lat: 25.5941, lng: 85.1376, power_kw: 50,  wait_min: 12 },
  // Central India — fill Bhopal-Nagpur-Hyderabad gaps
  { city: "Indore",       operator: "Statiq",       lat: 22.7196, lng: 75.8577, power_kw: 60,  wait_min: 10 },
  { city: "Ujjain",       operator: "Statiq",       lat: 23.1765, lng: 75.7885, power_kw: 60,  wait_min: 10 },
  { city: "Kota",         operator: "Tata Power",   lat: 25.2138, lng: 75.8648, power_kw: 60,  wait_min: 10 },
  { city: "Tonk",         operator: "Jio-bp",       lat: 26.1667, lng: 75.7833, power_kw: 50,  wait_min: 8  },
  { city: "Biaora",       operator: "BPCL",         lat: 23.9167, lng: 76.9167, power_kw: 50,  wait_min: 8  },
  { city: "Guna",         operator: "Tata Power",   lat: 24.6496, lng: 77.3156, power_kw: 50,  wait_min: 5  },
  { city: "Shivpuri",     operator: "ChargeZone",   lat: 25.4299, lng: 77.6599, power_kw: 50,  wait_min: 8  },
  { city: "Dewas",        operator: "Tata Power",   lat: 22.9623, lng: 76.0508, power_kw: 50,  wait_min: 5  },
  { city: "Bhopal",       operator: "Tata Power",   lat: 23.2599, lng: 77.4126, power_kw: 60,  wait_min: 12 },
  { city: "Hoshangabad",  operator: "IOCL",         lat: 22.7547, lng: 77.7340, power_kw: 50,  wait_min: 8  },
  { city: "Betul",        operator: "BPCL",         lat: 21.9110, lng: 77.8970, power_kw: 50,  wait_min: 8  },
  { city: "Amravati",     operator: "ChargeZone",   lat: 20.9374, lng: 77.7796, power_kw: 50,  wait_min: 10 },
  { city: "Nagpur",       operator: "Tata Power",   lat: 21.1458, lng: 79.0882, power_kw: 60,  wait_min: 15 },
  { city: "Wardha",       operator: "Statiq",       lat: 20.7453, lng: 78.6022, power_kw: 50,  wait_min: 8  },
  { city: "Adilabad",     operator: "HPCL",         lat: 19.6640, lng: 78.5320, power_kw: 50,  wait_min: 8  },
  { city: "Nirmal",       operator: "IOCL",         lat: 19.0960, lng: 78.3440, power_kw: 50,  wait_min: 5  },
  { city: "Nizamabad",    operator: "Statiq",       lat: 18.6725, lng: 78.0940, power_kw: 50,  wait_min: 8  },
  { city: "Hyderabad",    operator: "Statiq",       lat: 17.3850, lng: 78.4867, power_kw: 150, wait_min: 12 },
  // Hyderabad to Chennai corridor
  { city: "Nalgonda",     operator: "Tata Power",   lat: 17.0575, lng: 79.2670, power_kw: 50,  wait_min: 5  },
  { city: "Kurnool",      operator: "BPCL",         lat: 15.8281, lng: 78.0373, power_kw: 50,  wait_min: 8  },
  { city: "Anantapur",    operator: "HPCL",         lat: 14.6819, lng: 77.6006, power_kw: 50,  wait_min: 8  },
  { city: "Kadapa",       operator: "Statiq",       lat: 14.4674, lng: 78.8241, power_kw: 50,  wait_min: 8  },
  { city: "Tirupati",     operator: "Tata Power",   lat: 13.6288, lng: 79.4192, power_kw: 60,  wait_min: 10 },
  { city: "Vellore",      operator: "ChargeZone",   lat: 12.9165, lng: 79.1325, power_kw: 50,  wait_min: 8  },
  { city: "Chennai",      operator: "Tata Power",   lat: 13.0827, lng: 80.2707, power_kw: 100, wait_min: 15 },
  // West India
  { city: "Mumbai",       operator: "Tata Power",   lat: 19.0760, lng: 72.8777, power_kw: 150, wait_min: 15 },
  { city: "Pune",         operator: "Tata Power",   lat: 18.5204, lng: 73.8567, power_kw: 100, wait_min: 8  },
  { city: "Nashik",       operator: "ChargeZone",   lat: 19.9975, lng: 73.7898, power_kw: 50,  wait_min: 10 },
  { city: "Aurangabad",   operator: "Jio-bp",       lat: 19.8762, lng: 75.3433, power_kw: 60,  wait_min: 10 },
  { city: "Surat",        operator: "Jio-bp",       lat: 21.1702, lng: 72.8311, power_kw: 60,  wait_min: 10 },
  { city: "Vadodara",     operator: "Statiq",       lat: 22.3119, lng: 73.1723, power_kw: 60,  wait_min: 8  },
  { city: "Ahmedabad",    operator: "Tata Power",   lat: 23.0225, lng: 72.5714, power_kw: 100, wait_min: 12 },
  { city: "Rajkot",       operator: "HPCL",         lat: 22.3039, lng: 70.8022, power_kw: 50,  wait_min: 8  },
  // East India
  { city: "Ranchi",       operator: "Jio-bp",       lat: 23.3441, lng: 85.3096, power_kw: 50,  wait_min: 10 },
  { city: "Kolkata",      operator: "Tata Power",   lat: 22.5726, lng: 88.3639, power_kw: 100, wait_min: 15 },
  { city: "Bhubaneswar",  operator: "Statiq",       lat: 20.2961, lng: 85.8245, power_kw: 60,  wait_min: 10 },
  { city: "Raipur",       operator: "Tata Power",   lat: 21.2514, lng: 81.6296, power_kw: 50,  wait_min: 10 },
  { city: "Guwahati",     operator: "IOCL",         lat: 26.1445, lng: 91.7362, power_kw: 50,  wait_min: 12 },
  // East coast
  { city: "Visakhapatnam",operator: "ChargeZone",   lat: 17.6868, lng: 83.2185, power_kw: 60,  wait_min: 12 },
  { city: "Vijayawada",   operator: "Tata Power",   lat: 16.5062, lng: 80.6480, power_kw: 60,  wait_min: 10 },
  // South India
  { city: "Bangalore",    operator: "Tata Power",   lat: 12.9716, lng: 77.5946, power_kw: 150, wait_min: 10 },
  { city: "Mysore",       operator: "Ather Grid",   lat: 12.2958, lng: 76.6394, power_kw: 50,  wait_min: 8  },
  { city: "Coimbatore",   operator: "Statiq",       lat: 11.0168, lng: 76.9558, power_kw: 60,  wait_min: 10 },
  { city: "Salem",        operator: "Tata Power",   lat: 11.6643, lng: 78.1460, power_kw: 50,  wait_min: 8  },
  { city: "Madurai",      operator: "BPCL",         lat:  9.9252, lng: 78.1198, power_kw: 50,  wait_min: 10 },
  { city: "Kochi",        operator: "Tata Power",   lat:  9.9312, lng: 76.2673, power_kw: 60,  wait_min: 10 },
  { city: "Thiruvananthapuram", operator: "Tata Power", lat: 8.5241, lng: 76.9366, power_kw: 60, wait_min: 10 },
  // Pune-Bangalore corridor
  { city: "Kolhapur",     operator: "Jio-bp",       lat: 16.7050, lng: 74.2433, power_kw: 50,  wait_min: 8  },
  { city: "Belgaum",      operator: "Tata Power",   lat: 15.8497, lng: 74.4977, power_kw: 50,  wait_min: 8  },
  { city: "Hubli",        operator: "ChargeZone",   lat: 15.3647, lng: 75.1240, power_kw: 50,  wait_min: 8  },
  { city: "Davangere",    operator: "BPCL",         lat: 14.4644, lng: 75.9218, power_kw: 50,  wait_min: 8  },
  { city: "Tumkur",       operator: "Statiq",       lat: 13.3379, lng: 77.1173, power_kw: 50,  wait_min: 5  },
  // Solapur corridor (Pune-Hyderabad)
  { city: "Solapur",      operator: "IOCL",         lat: 17.6599, lng: 75.9064, power_kw: 50,  wait_min: 8  },
  // Bangalore-Chennai corridor
  { city: "Krishnagiri",  operator: "Tata Power",   lat: 12.5186, lng: 78.2137, power_kw: 50,  wait_min: 5  },
];

export function planRoute(
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  spec: VehicleSpec,
  startSoc: number,
  minArrivalSoc = 15,
  speedKmh = 65,
  tempCelsius = 28
): RoutePlan {
  const crowKm = haversineKm(originLat, originLng, destLat, destLng);
  const roadKm = +(crowKm * ROAD_FACTOR).toFixed(1);
  const warnings: string[] = [];

  const direct = predictTripSegment(spec, roadKm, startSoc, speedKmh, tempCelsius);
  const avgSpeed = roadKm > 300 ? 65 : roadKm > 100 ? 60 : 50;
  const drivingMin = (roadKm / avgSpeed) * 60;

  if (startSoc < 30) warnings.push("Low starting SOC — charging stop likely needed sooner");

  // No stops needed
  if (direct.arrival_soc >= minArrivalSoc) {
    const mc = monteCarloSoc(spec, roadKm, startSoc, speedKmh, tempCelsius);
    if (mc.failureProb > 0.1) warnings.push(`${Math.round(mc.failureProb * 100)}% chance of running out`);
    return {
      distanceKm: crowKm, roadDistanceKm: roadKm, durationMin: +drivingMin.toFixed(0),
      stops: [], arrivalSoc: direct.arrival_soc, energyKwh: direct.energy_kwh,
      efficiency: direct.efficiency_wh_per_km, monteCarlo: mc, warnings, speedKmh: avgSpeed,
    };
  }

  // A* Graph Search for absolute optimal route (shortest distance + minimum stops)
  interface AStarNode { id: string; lat: number; lng: number; hub?: any; }
  const nodes: Map<string, AStarNode> = new Map();
  nodes.set("origin", { id: "origin", lat: originLat, lng: originLng });
  nodes.set("dest", { id: "dest", lat: destLat, lng: destLng });
  CHARGING_HUBS.forEach(h => nodes.set(h.city, { id: h.city, lat: h.lat, lng: h.lng, hub: h }));

  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  const nodeSoc = new Map<string, number>();

  for (const key of nodes.keys()) {
    gScore.set(key, Infinity);
    fScore.set(key, Infinity);
  }

  gScore.set("origin", 0);
  fScore.set("origin", haversineKm(originLat, originLng, destLat, destLng));
  nodeSoc.set("origin", startSoc);

  const openSet = new Set<string>(["origin"]);
  let pathFound = false;
  const effWh = effectiveEfficiency(spec, speedKmh, tempCelsius);

  while (openSet.size > 0) {
    let currentId = "";
    let minF = Infinity;
    for (const id of openSet) {
      const f = fScore.get(id)!;
      if (f < minF) { minF = f; currentId = id; }
    }

    if (currentId === "dest") {
      pathFound = true;
      break;
    }

    openSet.delete(currentId);
    const current = nodes.get(currentId)!;
    const curArrivalSoc = nodeSoc.get(currentId)!;
    
    // Origin uses startSoc. Hubs charge up to 90% for reachability calculation.
    const startingSoc = currentId === "origin" ? curArrivalSoc : 90;
    const usableKwh = spec.battery_kwh * ((startingSoc - 5) / 100);
    const rangeKm = (usableKwh * 1000) / effWh;

    for (const [neighborId, neighbor] of nodes.entries()) {
      if (neighborId === currentId || neighborId === "origin") continue;
      
      const distCrow = haversineKm(current.lat, current.lng, neighbor.lat, neighbor.lng);
      const distRoad = distCrow * ROAD_FACTOR;

      // Check if reachable
      if (distRoad <= rangeKm) {
        // Penalty for making a stop (equivalent to 50 km) to prefer fewer stops
        const stopPenalty = neighborId === "dest" ? 0 : 50;
        const tentativeG = gScore.get(currentId)! + distRoad + stopPenalty;

        if (tentativeG < gScore.get(neighborId)!) {
          cameFrom.set(neighborId, currentId);
          gScore.set(neighborId, tentativeG);
          fScore.set(neighborId, tentativeG + haversineKm(neighbor.lat, neighbor.lng, destLat, destLng));
          
          const energyKwh = (distRoad * effWh) / 1000;
          const socConsumed = (energyKwh / spec.battery_kwh) * 100;
          nodeSoc.set(neighborId, startingSoc - socConsumed);
          
          openSet.add(neighborId);
        }
      }
    }
  }

  const stops: ChargingStopPlan[] = [];
  let totalTime = 0;
  let totalEnergy = 0;
  let finalArrivalSoc = 0;

  if (pathFound) {
    const path: string[] = [];
    let curr = "dest";
    while (curr !== "origin") {
      path.unshift(curr);
      curr = cameFrom.get(curr)!;
    }
    
    let curLat = originLat, curLng = originLng;
    let currentSoc = startSoc;

    for (const stepId of path) {
      if (stepId === "dest") {
        const segRoad = haversineKm(curLat, curLng, destLat, destLng) * ROAD_FACTOR;
        const seg = predictTripSegment(spec, segRoad, currentSoc, speedKmh, tempCelsius);
        totalTime += (segRoad / avgSpeed) * 60;
        totalEnergy += seg.energy_kwh;
        finalArrivalSoc = seg.arrival_soc;
      } else {
        const hubNode = nodes.get(stepId)!;
        const hub = hubNode.hub!;
        const segRoad = haversineKm(curLat, curLng, hub.lat, hub.lng) * ROAD_FACTOR;
        const seg = predictTripSegment(spec, segRoad, currentSoc, speedKmh, tempCelsius);
        
        // Dynamically compute charge needed for next leg, but at least 80%
        const nextId = path[path.indexOf(stepId) + 1];
        const nextNode = nodes.get(nextId)!;
        const nextRoad = haversineKm(hub.lat, hub.lng, nextNode.lat, nextNode.lng) * ROAD_FACTOR;
        const nextEnergy = (nextRoad * effWh) / 1000;
        const nextSocConsumed = (nextEnergy / spec.battery_kwh) * 100;
        const requiredCharge = Math.min(100, nextSocConsumed + 10); // 10% buffer
        const chargeToLimit = Math.max(80, requiredCharge);

        const energyToAdd = ((chargeToLimit - seg.arrival_soc) / 100) * spec.battery_kwh;
        const chargeTimeMin = (energyToAdd / hub.power_kw) * 60;
        const legTimeMin = (segRoad / avgSpeed) * 60;

        stops.push({
          city: hub.city, operator: hub.operator, lat: hub.lat, lng: hub.lng,
          arrivalSoc: seg.arrival_soc, chargeTo: +chargeToLimit.toFixed(0),
          chargeTimeMin: +chargeTimeMin.toFixed(0), waitTimeMin: hub.wait_min,
          stationType: hub.power_kw >= 100 ? "DC Ultra-Fast" : hub.power_kw >= 50 ? "DC Fast" : "AC Fast",
        });

        totalTime += legTimeMin + chargeTimeMin + hub.wait_min;
        totalEnergy += seg.energy_kwh;
        curLat = hub.lat; curLng = hub.lng;
        currentSoc = chargeToLimit;
      }
    }
  } else {
    warnings.push("No charging station within battery range — route may be infeasible");
    // Fallback: draw straight line
    totalTime = drivingMin;
    finalArrivalSoc = direct.arrival_soc;
  }

  const mc = monteCarloSoc(spec, roadKm, startSoc, speedKmh, tempCelsius);

  return {
    distanceKm: crowKm,
    roadDistanceKm: roadKm,
    durationMin: +totalTime.toFixed(0),
    stops,
    arrivalSoc: +finalArrivalSoc.toFixed(1),
    energyKwh: +totalEnergy.toFixed(2),
    efficiency: direct.efficiency_wh_per_km,
    monteCarlo: mc,
    warnings,
    speedKmh: avgSpeed,
  };
}
