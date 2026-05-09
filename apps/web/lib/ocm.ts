/**
 * Open Charge Map API client (free, public, no key required for basic use).
 * Docs: https://openchargemap.org/site/develop/api
 *
 * Maps OCM response format → our internal Station interface.
 */

import { Station } from "@/store/mapStore";

const OCM_BASE = "https://api.openchargemap.io/v3/poi";

// Map OCM connection type IDs → our charger_type keys
function mapConnectionType(conn: any): string {
  const title: string = (conn?.ConnectionType?.Title || "").toLowerCase();
  const kw: number = conn?.PowerKW || 0;

  if (kw >= 150) return "dc_ultra";
  if (kw >= 50)  return "dc_fast";
  if (title.includes("chademo") || title.includes("ccs") || title.includes("combo"))
    return kw >= 50 ? "dc_fast" : "ac_fast";
  if (kw >= 22)  return "ac_fast";
  if (kw >= 7)   return "ac_fast";
  return "ac_slow";
}

// Derive a simple trust score from OCM metadata
function deriveTrustScore(station: any): number {
  let score = 0.55; // baseline
  if (station.DateLastVerified) {
    const daysSince =
      (Date.now() - new Date(station.DateLastVerified).getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysSince < 30)  score += 0.25;
    else if (daysSince < 90)  score += 0.15;
    else if (daysSince < 180) score += 0.05;
  }
  if (station.StatusType?.IsOperational)       score += 0.10;
  if (station.OperatorInfo?.IsPrivateIndividual === false) score += 0.05;
  if (station.NumberOfPoints && station.NumberOfPoints > 2) score += 0.05;
  return Math.min(score, 0.99);
}

/** Fetch real stations from Open Charge Map */
export async function fetchOCMStations(params: {
  latitude: number;
  longitude: number;
  radius_km?: number;
  charger_type?: string | null;
  available_only?: boolean;
  limit?: number;
}): Promise<Station[]> {
  const {
    latitude, longitude,
    radius_km = 25,
    limit = 100,
  } = params;

  const url = new URL(OCM_BASE);
  url.searchParams.set("output",       "json");
  url.searchParams.set("latitude",     String(latitude));
  url.searchParams.set("longitude",    String(longitude));
  url.searchParams.set("distance",     String(radius_km));
  url.searchParams.set("distanceunit", "km");          // KM
  url.searchParams.set("maxresults",   String(limit));
  url.searchParams.set("compact",      "true");
  url.searchParams.set("verbose",      "false");
  url.searchParams.set("countrycode",  "IN");          // India only

  const res = await fetch(url.toString(), {
    headers: { "Accept": "application/json" },
    // 10 second timeout
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`OCM API ${res.status}`);
  const data: any[] = await res.json();

  return data.map((s): Station => {
    const addr   = s.AddressInfo || {};
    const conns: any[] = s.Connections || [];

    const chargerTypes = [
      ...new Set(conns.map(mapConnectionType).filter(Boolean)),
    ] as string[];

    const maxPowerKw = conns.reduce(
      (max: number, c: any) => Math.max(max, c.PowerKW || 0),
      0
    );

    const totalSlots   = s.NumberOfPoints || conns.length || 1;
    const isOperational = s.StatusType?.IsOperational !== false;

    return {
      id:              String(s.ID),
      name:            addr.Title || s.OperatorInfo?.Title || "EV Charging Station",
      operator:        s.OperatorInfo?.Title || undefined,
      address:         addr.AddressLine1 || undefined,
      city:            addr.Town || undefined,
      state:           addr.StateOrProvince || undefined,
      latitude:        addr.Latitude,
      longitude:       addr.Longitude,
      charger_types:   chargerTypes.length ? chargerTypes : ["ac_slow"],
      total_slots:     totalSlots,
      // OCM doesn't provide real-time slot availability — estimate
      available_slots: isOperational ? Math.max(1, Math.floor(totalSlots * 0.6)) : 0,
      max_power_kw:    maxPowerKw || 7.4,
      trust_score:     deriveTrustScore(s),
      is_open:         isOperational,
      is_verified:     !!s.DateLastVerified,
      distance_km:     addr.Distance
        ? +addr.Distance.toFixed(1)
        : undefined,
    };
  });
}

/** Reverse-geocode lat/lng to city name (OSM Nominatim — free) */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "en" }, signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    return (
      data.address?.city ||
      data.address?.town ||
      data.address?.county ||
      "your location"
    );
  } catch {
    return "your location";
  }
}
