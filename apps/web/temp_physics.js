"use strict";
/**
 * Client-side EV physics calculations — mirrors the backend energy_model.py
 * Used for instant/demo-mode results without a backend call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHARGING_HUBS = exports.ROAD_FACTOR = exports.VEHICLE_SPECS = void 0;
exports.haversineKm = haversineKm;
exports.computePowerKw = computePowerKw;
exports.effectiveEfficiency = effectiveEfficiency;
exports.predictTripSegment = predictTripSegment;
exports.monteCarloSoc = monteCarloSoc;
exports.planRoute = planRoute;
exports.VEHICLE_SPECS = {
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
var AIR_DENSITY = 1.225;
var GRAVITY = 9.81;
/** Great-circle distance in km */
function haversineKm(lat1, lng1, lat2, lng2) {
    var R = 6371;
    var dLat = ((lat2 - lat1) * Math.PI) / 180;
    var dLng = ((lng2 - lng1) * Math.PI) / 180;
    var a = Math.pow(Math.sin(dLat / 2), 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.pow(Math.sin(dLng / 2), 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
/** India road factor — roads are not straight lines */
exports.ROAD_FACTOR = 1.22; // ~22% more than crow-flies
/**
 * Physics-based power consumption in kW.
 * P = P_rolling + P_aero + P_gradient + P_hvac
 */
function computePowerKw(spec, speedKmh, gradientDeg, tempCelsius, hvacOn, trafficFactor) {
    if (gradientDeg === void 0) { gradientDeg = 0; }
    if (tempCelsius === void 0) { tempCelsius = 28; }
    if (hvacOn === void 0) { hvacOn = true; }
    if (trafficFactor === void 0) { trafficFactor = 1.0; }
    var v = speedKmh / 3.6; // m/s
    var theta = (gradientDeg * Math.PI) / 180;
    var rolling = spec.mass_kg * GRAVITY * spec.rolling_resistance * v;
    var aero = 0.5 * AIR_DENSITY * spec.drag_coefficient * spec.frontal_area_m2 * Math.pow(v, 3);
    var grad = spec.mass_kg * GRAVITY * Math.sin(theta) * v;
    var tempDelta = Math.abs(tempCelsius - 22);
    var hvac = hvacOn ? (spec.hvac_max_kw * Math.min(tempDelta / 20, 1) * 1000) : 0;
    var traffic_penalty = 1 + Math.max(trafficFactor - 1, 0) * 0.15;
    var mechanical = (rolling + aero + grad) * traffic_penalty;
    var total = Math.max((mechanical / 0.88 + hvac) / 1000, 0.1);
    return {
        rolling: +(rolling / 1000).toFixed(3),
        aero: +(aero / 1000).toFixed(3),
        gradient: +(grad / 1000).toFixed(3),
        hvac: +(hvac / 1000).toFixed(3),
        total: +total.toFixed(3),
    };
}
/**
 * Compute realistic efficiency (Wh/km) for given conditions.
 * Blends physics model with manufacturer spec.
 */
function effectiveEfficiency(spec, speedKmh, tempCelsius, hvacOn, trafficFactor, elevationGainM, distanceKm) {
    if (tempCelsius === void 0) { tempCelsius = 28; }
    if (hvacOn === void 0) { hvacOn = true; }
    if (trafficFactor === void 0) { trafficFactor = 1.0; }
    if (elevationGainM === void 0) { elevationGainM = 0; }
    if (distanceKm === void 0) { distanceKm = 100; }
    var gradDeg = distanceKm > 0
        ? (Math.atan(elevationGainM / (distanceKm * 1000)) * 180) / Math.PI
        : 0;
    var pw = computePowerKw(spec, speedKmh, gradDeg, tempCelsius, hvacOn, trafficFactor);
    return +((pw.total / speedKmh) * 1000).toFixed(1);
}
/** Predict range and SOC consumption for a trip segment */
function predictTripSegment(spec, distanceKm, startSoc, speedKmh, tempCelsius, hvacOn, trafficFactor, elevationGainM) {
    if (speedKmh === void 0) { speedKmh = 60; }
    if (tempCelsius === void 0) { tempCelsius = 28; }
    if (hvacOn === void 0) { hvacOn = true; }
    if (trafficFactor === void 0) { trafficFactor = 1.0; }
    if (elevationGainM === void 0) { elevationGainM = 0; }
    var eff = effectiveEfficiency(spec, speedKmh, tempCelsius, hvacOn, trafficFactor, elevationGainM, distanceKm);
    // Cold-weather penalty
    var tempMultiplier = 1.0;
    if (tempCelsius < 5)
        tempMultiplier = 1.25;
    else if (tempCelsius < 15)
        tempMultiplier = 1.10;
    else if (tempCelsius > 40)
        tempMultiplier = 1.08;
    var adjEff = eff * tempMultiplier;
    var energyKwh = (adjEff * distanceKm) / 1000;
    var socConsumed = (energyKwh / spec.battery_kwh) * 100;
    var arrivalSoc = Math.max(startSoc - socConsumed, 0);
    var usableKwh = spec.battery_kwh * (startSoc / 100);
    var rangeKm = (usableKwh * 1000) / adjEff;
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
function monteCarloSoc(spec, distanceKm, startSoc, speedKmh, tempCelsius) {
    if (speedKmh === void 0) { speedKmh = 60; }
    if (tempCelsius === void 0) { tempCelsius = 28; }
    var results = [];
    for (var i = 0; i < 500; i++) {
        var simSpeed = speedKmh * (1 + (Math.random() - 0.5) * 0.16);
        var simTemp = tempCelsius + (Math.random() - 0.5) * 6;
        var simTraffic = 1 + Math.random() * 0.4;
        var seg = predictTripSegment(spec, distanceKm, startSoc, simSpeed, simTemp, true, simTraffic);
        results.push(seg.arrival_soc);
    }
    results.sort(function (a, b) { return a - b; });
    var p = function (pct) { return results[Math.floor((pct / 100) * results.length)]; };
    var failures = results.filter(function (r) { return r <= 0; }).length;
    return {
        p5: +p(5).toFixed(1),
        p50: +p(50).toFixed(1),
        p95: +p(95).toFixed(1),
        failureProb: +(failures / results.length).toFixed(3),
    };
}
// Major Indian highway charging hubs with operator names
exports.CHARGING_HUBS = [
    // North India
    { city: "Delhi", operator: "Tata Power", lat: 28.6139, lng: 77.2090, power_kw: 150, wait_min: 15 },
    { city: "Mathura", operator: "Tata Power", lat: 27.4924, lng: 77.6737, power_kw: 50, wait_min: 5 },
    { city: "Agra", operator: "Statiq", lat: 27.1767, lng: 78.0081, power_kw: 60, wait_min: 10 },
    { city: "Gwalior", operator: "ChargeZone", lat: 26.2183, lng: 78.1828, power_kw: 50, wait_min: 8 },
    { city: "Jhansi", operator: "BPCL", lat: 25.4484, lng: 78.5685, power_kw: 50, wait_min: 5 },
    { city: "Jaipur", operator: "Statiq", lat: 26.9124, lng: 75.7873, power_kw: 60, wait_min: 10 },
    { city: "Ajmer", operator: "BPCL", lat: 26.4499, lng: 74.6399, power_kw: 50, wait_min: 8 },
    { city: "Jodhpur", operator: "Tata Power", lat: 26.2389, lng: 73.0243, power_kw: 50, wait_min: 10 },
    { city: "Udaipur", operator: "ChargeZone", lat: 24.5854, lng: 73.7125, power_kw: 50, wait_min: 8 },
    { city: "Chandigarh", operator: "Tata Power", lat: 30.7333, lng: 76.7794, power_kw: 60, wait_min: 8 },
    { city: "Ambala", operator: "ChargeZone", lat: 30.3782, lng: 76.7767, power_kw: 50, wait_min: 5 },
    { city: "Ludhiana", operator: "Statiq", lat: 30.9010, lng: 75.8573, power_kw: 60, wait_min: 10 },
    { city: "Amritsar", operator: "HPCL", lat: 31.6340, lng: 74.8723, power_kw: 50, wait_min: 10 },
    { city: "Haridwar", operator: "IOCL", lat: 29.9457, lng: 78.1642, power_kw: 50, wait_min: 8 },
    { city: "Dehradun", operator: "Tata Power", lat: 30.3165, lng: 78.0322, power_kw: 50, wait_min: 10 },
    { city: "Lucknow", operator: "Statiq", lat: 26.8467, lng: 80.9462, power_kw: 60, wait_min: 12 },
    { city: "Kanpur", operator: "ChargeZone", lat: 26.4499, lng: 80.3319, power_kw: 50, wait_min: 8 },
    { city: "Varanasi", operator: "Tata Power", lat: 25.3176, lng: 82.9739, power_kw: 50, wait_min: 10 },
    { city: "Patna", operator: "BPCL", lat: 25.5941, lng: 85.1376, power_kw: 50, wait_min: 12 },
    // Central India — fill Bhopal-Nagpur-Hyderabad gaps
    { city: "Indore", operator: "Statiq", lat: 22.7196, lng: 75.8577, power_kw: 60, wait_min: 10 },
    { city: "Ujjain", operator: "Statiq", lat: 23.1765, lng: 75.7885, power_kw: 60, wait_min: 10 },
    { city: "Kota", operator: "Tata Power", lat: 25.2138, lng: 75.8648, power_kw: 60, wait_min: 10 },
    { city: "Tonk", operator: "Jio-bp", lat: 26.1667, lng: 75.7833, power_kw: 50, wait_min: 8 },
    { city: "Biaora", operator: "BPCL", lat: 23.9167, lng: 76.9167, power_kw: 50, wait_min: 8 },
    { city: "Guna", operator: "Tata Power", lat: 24.6496, lng: 77.3156, power_kw: 50, wait_min: 5 },
    { city: "Shivpuri", operator: "ChargeZone", lat: 25.4299, lng: 77.6599, power_kw: 50, wait_min: 8 },
    { city: "Dewas", operator: "Tata Power", lat: 22.9623, lng: 76.0508, power_kw: 50, wait_min: 5 },
    { city: "Bhopal", operator: "Tata Power", lat: 23.2599, lng: 77.4126, power_kw: 60, wait_min: 12 },
    { city: "Hoshangabad", operator: "IOCL", lat: 22.7547, lng: 77.7340, power_kw: 50, wait_min: 8 },
    { city: "Betul", operator: "BPCL", lat: 21.9110, lng: 77.8970, power_kw: 50, wait_min: 8 },
    { city: "Amravati", operator: "ChargeZone", lat: 20.9374, lng: 77.7796, power_kw: 50, wait_min: 10 },
    { city: "Nagpur", operator: "Tata Power", lat: 21.1458, lng: 79.0882, power_kw: 60, wait_min: 15 },
    { city: "Wardha", operator: "Statiq", lat: 20.7453, lng: 78.6022, power_kw: 50, wait_min: 8 },
    { city: "Adilabad", operator: "HPCL", lat: 19.6640, lng: 78.5320, power_kw: 50, wait_min: 8 },
    { city: "Nirmal", operator: "IOCL", lat: 19.0960, lng: 78.3440, power_kw: 50, wait_min: 5 },
    { city: "Nizamabad", operator: "Statiq", lat: 18.6725, lng: 78.0940, power_kw: 50, wait_min: 8 },
    { city: "Hyderabad", operator: "Statiq", lat: 17.3850, lng: 78.4867, power_kw: 150, wait_min: 12 },
    // Hyderabad to Chennai corridor
    { city: "Nalgonda", operator: "Tata Power", lat: 17.0575, lng: 79.2670, power_kw: 50, wait_min: 5 },
    { city: "Kurnool", operator: "BPCL", lat: 15.8281, lng: 78.0373, power_kw: 50, wait_min: 8 },
    { city: "Anantapur", operator: "HPCL", lat: 14.6819, lng: 77.6006, power_kw: 50, wait_min: 8 },
    { city: "Kadapa", operator: "Statiq", lat: 14.4674, lng: 78.8241, power_kw: 50, wait_min: 8 },
    { city: "Tirupati", operator: "Tata Power", lat: 13.6288, lng: 79.4192, power_kw: 60, wait_min: 10 },
    { city: "Vellore", operator: "ChargeZone", lat: 12.9165, lng: 79.1325, power_kw: 50, wait_min: 8 },
    { city: "Chennai", operator: "Tata Power", lat: 13.0827, lng: 80.2707, power_kw: 100, wait_min: 15 },
    // West India
    { city: "Mumbai", operator: "Tata Power", lat: 19.0760, lng: 72.8777, power_kw: 150, wait_min: 15 },
    { city: "Pune", operator: "Tata Power", lat: 18.5204, lng: 73.8567, power_kw: 100, wait_min: 8 },
    { city: "Nashik", operator: "ChargeZone", lat: 19.9975, lng: 73.7898, power_kw: 50, wait_min: 10 },
    { city: "Aurangabad", operator: "Jio-bp", lat: 19.8762, lng: 75.3433, power_kw: 60, wait_min: 10 },
    { city: "Surat", operator: "Jio-bp", lat: 21.1702, lng: 72.8311, power_kw: 60, wait_min: 10 },
    { city: "Vadodara", operator: "Statiq", lat: 22.3119, lng: 73.1723, power_kw: 60, wait_min: 8 },
    { city: "Ahmedabad", operator: "Tata Power", lat: 23.0225, lng: 72.5714, power_kw: 100, wait_min: 12 },
    { city: "Rajkot", operator: "HPCL", lat: 22.3039, lng: 70.8022, power_kw: 50, wait_min: 8 },
    // East India
    { city: "Ranchi", operator: "Jio-bp", lat: 23.3441, lng: 85.3096, power_kw: 50, wait_min: 10 },
    { city: "Kolkata", operator: "Tata Power", lat: 22.5726, lng: 88.3639, power_kw: 100, wait_min: 15 },
    { city: "Bhubaneswar", operator: "Statiq", lat: 20.2961, lng: 85.8245, power_kw: 60, wait_min: 10 },
    { city: "Raipur", operator: "Tata Power", lat: 21.2514, lng: 81.6296, power_kw: 50, wait_min: 10 },
    { city: "Guwahati", operator: "IOCL", lat: 26.1445, lng: 91.7362, power_kw: 50, wait_min: 12 },
    // East coast
    { city: "Visakhapatnam", operator: "ChargeZone", lat: 17.6868, lng: 83.2185, power_kw: 60, wait_min: 12 },
    { city: "Vijayawada", operator: "Tata Power", lat: 16.5062, lng: 80.6480, power_kw: 60, wait_min: 10 },
    // South India
    { city: "Bangalore", operator: "Tata Power", lat: 12.9716, lng: 77.5946, power_kw: 150, wait_min: 10 },
    { city: "Mysore", operator: "Ather Grid", lat: 12.2958, lng: 76.6394, power_kw: 50, wait_min: 8 },
    { city: "Coimbatore", operator: "Statiq", lat: 11.0168, lng: 76.9558, power_kw: 60, wait_min: 10 },
    { city: "Salem", operator: "Tata Power", lat: 11.6643, lng: 78.1460, power_kw: 50, wait_min: 8 },
    { city: "Madurai", operator: "BPCL", lat: 9.9252, lng: 78.1198, power_kw: 50, wait_min: 10 },
    { city: "Kochi", operator: "Tata Power", lat: 9.9312, lng: 76.2673, power_kw: 60, wait_min: 10 },
    { city: "Thiruvananthapuram", operator: "Tata Power", lat: 8.5241, lng: 76.9366, power_kw: 60, wait_min: 10 },
    // Pune-Bangalore corridor
    { city: "Kolhapur", operator: "Jio-bp", lat: 16.7050, lng: 74.2433, power_kw: 50, wait_min: 8 },
    { city: "Belgaum", operator: "Tata Power", lat: 15.8497, lng: 74.4977, power_kw: 50, wait_min: 8 },
    { city: "Hubli", operator: "ChargeZone", lat: 15.3647, lng: 75.1240, power_kw: 50, wait_min: 8 },
    { city: "Davangere", operator: "BPCL", lat: 14.4644, lng: 75.9218, power_kw: 50, wait_min: 8 },
    { city: "Tumkur", operator: "Statiq", lat: 13.3379, lng: 77.1173, power_kw: 50, wait_min: 5 },
    // Solapur corridor (Pune-Hyderabad)
    { city: "Solapur", operator: "IOCL", lat: 17.6599, lng: 75.9064, power_kw: 50, wait_min: 8 },
    // Bangalore-Chennai corridor
    { city: "Krishnagiri", operator: "Tata Power", lat: 12.5186, lng: 78.2137, power_kw: 50, wait_min: 5 },
];
function planRoute(originLat, originLng, destLat, destLng, spec, startSoc, minArrivalSoc, speedKmh, tempCelsius) {
    if (minArrivalSoc === void 0) { minArrivalSoc = 15; }
    if (speedKmh === void 0) { speedKmh = 65; }
    if (tempCelsius === void 0) { tempCelsius = 28; }
    var crowKm = haversineKm(originLat, originLng, destLat, destLng);
    var roadKm = +(crowKm * exports.ROAD_FACTOR).toFixed(1);
    var warnings = [];
    var direct = predictTripSegment(spec, roadKm, startSoc, speedKmh, tempCelsius);
    var avgSpeed = roadKm > 300 ? 65 : roadKm > 100 ? 60 : 50;
    var drivingMin = (roadKm / avgSpeed) * 60;
    if (startSoc < 30)
        warnings.push("Low starting SOC — charging stop likely needed sooner");
    // No stops needed
    if (direct.arrival_soc >= minArrivalSoc) {
        var mc_1 = monteCarloSoc(spec, roadKm, startSoc, speedKmh, tempCelsius);
        if (mc_1.failureProb > 0.1)
            warnings.push("".concat(Math.round(mc_1.failureProb * 100), "% chance of running out"));
        return {
            distanceKm: crowKm, roadDistanceKm: roadKm, durationMin: +drivingMin.toFixed(0),
            stops: [], arrivalSoc: direct.arrival_soc, energyKwh: direct.energy_kwh,
            efficiency: direct.efficiency_wh_per_km, monteCarlo: mc_1,
            warnings: warnings,
            speedKmh: avgSpeed,
        };
    }
    // Wide corridor — prefer on-route hubs but don't exclude reachable ones
    var corridor = exports.CHARGING_HUBS.filter(function (hub) {
        var dToHub = haversineKm(originLat, originLng, hub.lat, hub.lng);
        var dHubToDest = haversineKm(hub.lat, hub.lng, destLat, destLng);
        var detour = (dToHub + dHubToDest) / Math.max(crowKm, 1);
        return detour < 1.6 && dHubToDest < crowKm * 0.98;
    });
    console.log("[Route] ".concat(spec.name, ": ").concat(crowKm.toFixed(0), "km crow, corridor: ").concat(corridor.length, " hubs, SOC: ").concat(startSoc, "%"));
    // Range-first greedy search: battery range decides next stop
    var stops = [];
    var curLat = originLat, curLng = originLng;
    var curSoc = startSoc;
    var totalTime = 0;
    var totalEnergy = 0;
    var usedHubs = new Set();
    var _loop_1 = function (iter) {
        // Can we reach destination directly?
        var remRoad = haversineKm(curLat, curLng, destLat, destLng) * exports.ROAD_FACTOR;
        var remSeg = predictTripSegment(spec, remRoad, curSoc, speedKmh, tempCelsius);
        if (remSeg.arrival_soc >= minArrivalSoc) {
            console.log("[Route] iter ".concat(iter, ": can reach dest directly, arrival ").concat(remSeg.arrival_soc, "%"));
            return "break";
        }
        // Use effective efficiency for accurate range calc
        var effWh = effectiveEfficiency(spec, speedKmh, tempCelsius);
        var usableKwh = spec.battery_kwh * ((curSoc - 5) / 100);
        var rangeKm = (usableKwh * 1000) / effWh;
        var curDistToDest = haversineKm(curLat, curLng, destLat, destLng);
        console.log("[Route] iter ".concat(iter, ": pos=(").concat(curLat.toFixed(2), ",").concat(curLng.toFixed(2), "), SOC=").concat(curSoc, "%, range=").concat(rangeKm.toFixed(0), "km, distToDest=").concat(curDistToDest.toFixed(0), "km"));
        // Step 1: Corridor hubs closer to destination (preferred)
        var candidates = corridor
            .filter(function (hub) {
            if (usedHubs.has(hub.city))
                return false;
            var hubDistToDest = haversineKm(hub.lat, hub.lng, destLat, destLng);
            if (hubDistToDest >= curDistToDest - 5)
                return false; // must be at least 5km closer to dest
            var segDist = haversineKm(curLat, curLng, hub.lat, hub.lng) * exports.ROAD_FACTOR;
            return segDist <= rangeKm;
        });
        // Step 2: If no forward corridor hub, try ANY corridor hub within range (may go sideways)
        if (candidates.length === 0) {
            candidates = corridor.filter(function (hub) {
                if (usedHubs.has(hub.city))
                    return false;
                var segDist = haversineKm(curLat, curLng, hub.lat, hub.lng) * exports.ROAD_FACTOR;
                return segDist > 5 && segDist <= rangeKm; // skip origin hub (>5km away)
            });
            console.log("[Route] iter ".concat(iter, ": sideways corridor: ").concat(candidates.length, " (").concat(candidates.map(function (h) { return h.city; }).join(', '), ")"));
        }
        // Step 3: If still nothing, search ALL hubs within range
        if (candidates.length === 0) {
            candidates = exports.CHARGING_HUBS.filter(function (hub) {
                if (usedHubs.has(hub.city))
                    return false;
                var segDist = haversineKm(curLat, curLng, hub.lat, hub.lng) * exports.ROAD_FACTOR;
                return segDist > 5 && segDist <= rangeKm;
            });
            console.log("[Route] iter ".concat(iter, ": ALL-hub fallback: ").concat(candidates.length, " (").concat(candidates.map(function (h) { return h.city; }).join(', '), ")"));
        }
        console.log("[Route] iter ".concat(iter, ": final candidates: ").concat(candidates.length, " (").concat(candidates.map(function (h) { return h.city; }).join(', '), ")"));
        // Sort: prefer hub closest to destination (max forward progress)
        candidates.sort(function (a, b) {
            var da = haversineKm(a.lat, a.lng, destLat, destLng);
            var db = haversineKm(b.lat, b.lng, destLat, destLng);
            return da - db;
        });
        if (candidates.length === 0) {
            warnings.push("No charging station within battery range — route may be infeasible");
            console.log("[Route] iter ".concat(iter, ": NO CANDIDATES \u2014 breaking"));
            return "break";
        }
        var hub = candidates[0];
        usedHubs.add(hub.city);
        var segRoad = haversineKm(curLat, curLng, hub.lat, hub.lng) * exports.ROAD_FACTOR;
        var seg = predictTripSegment(spec, segRoad, curSoc, speedKmh, tempCelsius);
        if (seg.arrival_soc < 5) {
            warnings.push("Critical: may not reach ".concat(hub.city, " \u2014 only ").concat(seg.arrival_soc.toFixed(0), "% SOC"));
        }
        var chargeTo = 80;
        var energyToAdd = ((chargeTo - seg.arrival_soc) / 100) * spec.battery_kwh;
        var chargeTimeMin = (energyToAdd / hub.power_kw) * 60;
        var legTimeMin = (segRoad / avgSpeed) * 60;
        stops.push({
            city: hub.city,
            operator: hub.operator,
            lat: hub.lat,
            lng: hub.lng,
            arrivalSoc: seg.arrival_soc,
            chargeTo: chargeTo,
            chargeTimeMin: +chargeTimeMin.toFixed(0),
            waitTimeMin: hub.wait_min,
            stationType: hub.power_kw >= 100 ? "DC Ultra-Fast" : hub.power_kw >= 50 ? "DC Fast" : "AC Fast",
        });
        totalTime += legTimeMin + chargeTimeMin + hub.wait_min;
        totalEnergy += seg.energy_kwh;
        curLat = hub.lat;
        curLng = hub.lng;
        curSoc = chargeTo;
    };
    for (var iter = 0; iter < 20; iter++) {
        var state_1 = _loop_1(iter);
        if (state_1 === "break")
            break;
    }
    // Final leg to destination
    var finalRoad = haversineKm(curLat, curLng, destLat, destLng) * exports.ROAD_FACTOR;
    var finalSeg = predictTripSegment(spec, finalRoad, curSoc, speedKmh, tempCelsius);
    totalTime += (finalRoad / avgSpeed) * 60;
    totalEnergy += finalSeg.energy_kwh;
    var mc = monteCarloSoc(spec, roadKm, startSoc, speedKmh, tempCelsius);
    return {
        distanceKm: crowKm,
        roadDistanceKm: roadKm,
        durationMin: +totalTime.toFixed(0),
        stops: stops,
        arrivalSoc: +finalSeg.arrival_soc.toFixed(1),
        energyKwh: +totalEnergy.toFixed(2),
        efficiency: direct.efficiency_wh_per_km,
        monteCarlo: mc,
        warnings: warnings,
        speedKmh: avgSpeed,
    };
}
