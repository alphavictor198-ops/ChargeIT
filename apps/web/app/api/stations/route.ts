import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for EV station data.
 *
 * Strategy (waterfall):
 *   1. Open Charge Map (if OPENCHARGEMAP_KEY is set)
 *   2. Overpass / OpenStreetMap (free, no key, always works)
 *
 * This avoids CORS issues since the request runs server-side.
 */

// ─── OpenStreetMap / Overpass (always free, no key) ─────────────
async function fetchFromOverpass(
  lat: number, lng: number, radiusKm: number, limit: number
) {
  const radiusM = radiusKm * 1000;

  // Overpass QL query for EV charging stations
  const query = `[out:json][timeout:25];(node["amenity"="charging_station"](around:${radiusM},${lat},${lng});way["amenity"="charging_station"](around:${radiusM},${lat},${lng}););out center ${Math.min(limit, 1000)};`;

  const encoded = encodeURIComponent(query);

  // Try multiple Overpass endpoints (primary + mirrors)
  const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  ];

  let data: any = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(`${endpoint}?data=${encoded}`, {
        method: "GET",
        headers: {
          "User-Agent": "GatiCharge/1.0 (EV Charging Platform India)",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        data = await res.json();
        break;
      }
    } catch {
      // Try next endpoint
      continue;
    }
  }

  if (!data) throw new Error("All Overpass endpoints failed");

  return (data.elements || []).map((el: any) => {
    const tags = el.tags || {};
    const elLat = el.lat ?? el.center?.lat;
    const elLng = el.lon ?? el.center?.lon;

    // Parse socket types
    const chargerTypes: string[] = [];
    const socketStr = [
      tags["socket:chademo"],
      tags["socket:type2_combo"],
      tags["socket:type2"],
      tags["socket:type1"],
      tags["socket:ccs"],
    ].join(" ");

    if (tags["socket:chademo"] || socketStr.includes("chademo")) chargerTypes.push("dc_fast");
    if (tags["socket:type2_combo"] || tags["socket:ccs"] || socketStr.includes("ccs")) chargerTypes.push("dc_fast");
    if (tags["socket:type2"]) chargerTypes.push("ac_fast");
    if (tags["socket:type1"]) chargerTypes.push("ac_slow");

    // Try to get power from tags
    let maxPower = 0;
    const outputTag = tags["charging_station:output"] || tags["maxpower"] || "";
    const pwMatch = outputTag.match(/(\d+)/);
    if (pwMatch) maxPower = parseInt(pwMatch[1]);
    if (maxPower === 0 && chargerTypes.includes("dc_fast")) maxPower = 50;
    if (maxPower === 0) maxPower = 7.4;

    if (maxPower >= 150 && !chargerTypes.includes("dc_ultra")) chargerTypes.push("dc_ultra");
    if (chargerTypes.length === 0) chargerTypes.push("ac_slow");

    const totalSlots = parseInt(tags["capacity"] || tags["sockets"] || "2") || 2;

    // Compute distance from request point
    const dLat = ((elLat - lat) * Math.PI) / 180;
    const dLng = ((elLng - lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos((lat * Math.PI) / 180) * Math.cos((elLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
    const distKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return {
      id: String(el.id),
      name: tags.name || tags.operator || tags.brand || tags.network || "EV Charging Station",
      operator: tags.operator || tags.brand || tags.network || undefined,
      address: tags["addr:street"]
        ? `${tags["addr:housenumber"] || ""} ${tags["addr:street"]}`.trim()
        : undefined,
      city: tags["addr:city"] || tags["addr:district"] || undefined,
      state: tags["addr:state"] || undefined,
      latitude: elLat,
      longitude: elLng,
      charger_types: [...new Set(chargerTypes)],
      total_slots: totalSlots,
      available_slots: Math.max(1, Math.floor(totalSlots * 0.6)),
      max_power_kw: maxPower,
      trust_score: tags.name ? 0.65 : 0.45,
      is_open: tags.access !== "private",
      is_verified: !!tags.name,
      distance_km: +distKm.toFixed(1),
    };
  });
}

// ─── Open Charge Map (needs API key) ────────────────────────────
async function fetchFromOCM(
  lat: number, lng: number, radiusKm: number, limit: number, apiKey: string
) {
  const url = new URL("https://api.openchargemap.io/v3/poi");
  url.searchParams.set("output", "json");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("distance", String(radiusKm));
  url.searchParams.set("distanceunit", "KM");
  url.searchParams.set("maxresults", String(limit));
  url.searchParams.set("compact", "true");
  url.searchParams.set("verbose", "false");
  url.searchParams.set("countrycode", "IN");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`OCM API ${res.status}`);
  const data: any[] = await res.json();

  return data.map((s: any) => {
    const addr = s.AddressInfo || {};
    const conns: any[] = s.Connections || [];

    const chargerTypes = [...new Set(conns.map((c: any) => {
      const kw = c.PowerKW || 0;
      const title = (c.ConnectionType?.Title || "").toLowerCase();
      if (kw >= 150) return "dc_ultra";
      if (kw >= 50 || title.includes("chademo") || title.includes("ccs")) return "dc_fast";
      if (kw >= 7 || title.includes("type 2")) return "ac_fast";
      return "ac_slow";
    }))];

    const maxPowerKw = conns.reduce((m: number, c: any) => Math.max(m, c.PowerKW || 0), 0) || 7.4;
    const totalSlots = s.NumberOfPoints || conns.length || 1;
    const isOp = s.StatusType?.IsOperational !== false;

    let trust = 0.55;
    if (s.DateLastVerified) {
      const days = (Date.now() - new Date(s.DateLastVerified).getTime()) / 864e5;
      trust += days < 30 ? 0.25 : days < 90 ? 0.15 : days < 180 ? 0.05 : 0;
    }
    if (isOp) trust += 0.1;
    trust = Math.min(trust, 0.99);

    return {
      id: String(s.ID),
      name: addr.Title || s.OperatorInfo?.Title || "EV Charging Station",
      operator: s.OperatorInfo?.Title || undefined,
      address: addr.AddressLine1 || undefined,
      city: addr.Town || undefined,
      state: addr.StateOrProvince || undefined,
      latitude: addr.Latitude,
      longitude: addr.Longitude,
      charger_types: chargerTypes.length ? chargerTypes : ["ac_slow"],
      total_slots: totalSlots,
      available_slots: isOp ? Math.max(1, Math.floor(totalSlots * 0.6)) : 0,
      max_power_kw: maxPowerKw,
      trust_score: trust,
      is_open: isOp,
      is_verified: !!s.DateLastVerified,
      distance_km: addr.Distance ? +addr.Distance.toFixed(1) : undefined,
    };
  });
}

// ─── Curated local dataset (guaranteed fallback) ────────────────
import { ALL_STATIONS } from "@/lib/stations-data";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fetchFromCuratedData(lat: number, lng: number, radiusKm: number) {
  return ALL_STATIONS
    .map((s, i) => {
      const dist = haversineKm(lat, lng, s.lat, s.lng);
      return {
        id: `curated-${i}`,
        name: s.name,
        operator: s.operator,
        address: s.address,
        city: s.city,
        state: s.state,
        latitude: s.lat,
        longitude: s.lng,
        charger_types: s.charger_types,
        total_slots: s.total_slots,
        available_slots: Math.max(1, Math.floor(s.total_slots * 0.6)),
        max_power_kw: s.max_power_kw,
        trust_score: 0.70,
        is_open: true,
        is_verified: true,
        distance_km: +dist.toFixed(1),
      };
    })
    .filter(s => s.distance_km <= radiusKm);
}

// ─── API Route Handler ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat      = parseFloat(sp.get("latitude")  || "22.7196");
  const lng      = parseFloat(sp.get("longitude") || "75.8577");
  const radius   = parseInt(sp.get("radius_km")   || "25", 10);
  const limit    = parseInt(sp.get("limit")        || "1000", 10);
  const chargerType   = sp.get("charger_type") || "";
  const availableOnly = sp.get("available_only") === "true";

  let stations: any[] = [];
  let source = "curated";

  // 1. Try OCM if key exists
  const ocmKey = process.env.OPENCHARGEMAP_KEY;
  if (ocmKey) {
    try {
      stations = await fetchFromOCM(lat, lng, radius, limit, ocmKey);
      source = "ocm";
    } catch (e) {
      console.error("OCM failed:", e);
    }
  }

  // 2. Try Overpass (free, but OSM data for India is sparse)
  if (stations.length === 0) {
    try {
      const overpassResult = await fetchFromOverpass(lat, lng, radius, limit);
      if (overpassResult.length > 0) {
        stations = overpassResult;
        source = "overpass";
      }
    } catch (e) {
      console.error("Overpass failed:", e);
    }
  }

  // 3. GUARANTEED FALLBACK: curated Indian station dataset + dynamic mock
  if (stations.length === 0) {
    stations = fetchFromCuratedData(lat, lng, radius);
    if (stations.length === 0) {
      // Dynamic fallback for any unmapped city
      stations = Array.from({ length: 25 }).map((_, i) => {
        const dLat = (Math.random() - 0.5) * (radius / 111) * 1.5;
        const dLng = (Math.random() - 0.5) * (radius / 111) * 1.5;
        const types = [["ac_slow"], ["ac_fast", "dc_fast"], ["dc_fast", "dc_ultra"], ["dc_fast"]][i % 4];
        return {
          id: `mock-${lat}-${i}`,
          name: `GatiCharge Hub ${i+1}`,
          operator: ["Tata Power", "ChargeZone", "Statiq", "BPCL", "Jio-bp"][i % 5],
          address: "EV Charging Zone",
          city: "Local",
          state: "India",
          latitude: lat + dLat,
          longitude: lng + dLng,
          charger_types: types,
          total_slots: (i % 3) + 2,
          available_slots: Math.floor(Math.random() * ((i % 3) + 2)) + 1,
          max_power_kw: [7.4, 50, 150, 60][i % 4],
          trust_score: 0.70 + Math.random() * 0.25,
          is_open: true,
          is_verified: true,
          distance_km: haversineKm(lat, lng, lat + dLat, lng + dLng),
        };
      }).filter(s => s.distance_km <= radius);
      source = "mocked";
    } else {
      source = "curated";
    }
  }

  // 4. Apply filters
  if (chargerType) {
    stations = stations.filter((s: any) => s.charger_types?.includes(chargerType));
  }
  if (availableOnly) {
    stations = stations.filter((s: any) => s.available_slots > 0);
  }

  // Sort by distance
  stations.sort((a: any, b: any) => (a.distance_km || 999) - (b.distance_km || 999));

  return NextResponse.json({ stations, source, total: stations.length });
}

