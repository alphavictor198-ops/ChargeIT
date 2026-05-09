"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, SlidersHorizontal, RefreshCw, Zap, Wifi, WifiOff, Info, Database } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMapStore, Station } from "@/store/mapStore";
import toast from "react-hot-toast";

const MapView      = dynamic(() => import("@/components/map/MapView"),           { ssr: false });
const StationPanel = dynamic(() => import("@/components/stations/StationPanel"), { ssr: false });

const CHARGER_TYPES = [
  { value: "",         label: "All Charger Types" },
  { value: "ac_slow",  label: "AC Slow  (≤7.4 kW)"  },
  { value: "ac_fast",  label: "AC Fast  (7.4–22 kW)" },
  { value: "dc_fast",  label: "DC Fast  (50–150 kW)" },
  { value: "dc_ultra", label: "DC Ultra (150 kW+)"   },
];
const RADIUS_OPTIONS = [5, 10, 15, 25, 50, 100];

type DataSource = "backend" | "ocm" | "overpass" | "curated" | "none";
const SOURCE_LABELS: Record<DataSource, { label: string; color: string }> = {
  backend:  { label: "GatiCharge Backend",        color: "#00ff9d" },
  ocm:      { label: "Open Charge Map (Live)",    color: "#00d4ff" },
  overpass: { label: "OpenStreetMap (Live)",       color: "#8b5cf6" },
  curated:  { label: "GatiCharge Verified Data",   color: "#f59e0b" },
  none:     { label: "",                           color: "#ef4444" },
};

export default function StationsPage() {
  const {
    setStations, setUserLocation, filters, setFilters,
    setLoadingStations, setMapCenter,
  } = useMapStore();

  const [showFilters, setShowFilters] = useState(false);
  const [userLat,  setUserLat]  = useState(22.7196);
  const [userLng,  setUserLng]  = useState(75.8577);
  const [cityName, setCityName] = useState("Indore");
  const [locating, setLocating] = useState(false);
  const [source,   setSource]   = useState<DataSource>("none");

  // ── Geolocation ──────────────────────────────────────────
  const locate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        setUserLat(lat); setUserLng(lng);
        setUserLocation([lat, lng]);
        setLocating(false);
        // Reverse geocode via Nominatim
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const d = await r.json();
          const city = d.address?.city || d.address?.town || d.address?.county || "your location";
          setCityName(city);
          toast.success(`📍 Location: ${city}`);
        } catch { /* ignore */ }
      },
      () => { setLocating(false); toast("Using Indore as default", { icon: "📍" }); },
      { timeout: 8000, maximumAge: 60000 }
    );
  }, [setUserLocation]);

  useEffect(() => { locate(); }, [locate]);

  // ── Station fetch: calls our own Next.js API route ──────
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["stations", userLat, userLng, filters.radius_km, filters.charger_type, filters.available_only],
    queryFn: async (): Promise<{ stations: Station[]; source: DataSource }> => {
      // 1. Try GatiCharge backend first
      try {
        const backendRes = await fetch(
          `http://localhost:8000/api/v1/stations/nearby?` +
          `latitude=${userLat}&longitude=${userLng}` +
          `&radius_km=${filters.radius_km}` +
          `${filters.charger_type ? `&charger_type=${filters.charger_type}` : ""}` +
          `${filters.available_only ? "&available_only=true" : ""}` +
          `&limit=150`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (backendRes.ok) {
          const d = await backendRes.json();
          if (Array.isArray(d) && d.length > 0) return { stations: d, source: "backend" };
        }
      } catch { /* backend offline — fall through */ }

      // 2. Call our Next.js server-side proxy (Overpass / OCM)
      const params = new URLSearchParams({
        latitude:       String(userLat),
        longitude:      String(userLng),
        radius_km:      String(filters.radius_km),
        limit:          "150",
        ...(filters.charger_type  ? { charger_type: filters.charger_type } : {}),
        ...(filters.available_only ? { available_only: "true" } : {}),
      });

      const res = await fetch(`/api/stations?${params}`);
      if (!res.ok) throw new Error("Station API failed");
      const json = await res.json();
      return { stations: json.stations || [], source: json.source || "overpass" };
    },
    staleTime: 60_000,
    retry: 1,
  });

  // ── Sync to map store ────────────────────────────────────
  useEffect(() => {
    if (data) {
      setStations(data.stations);
      setSource(data.source);
    }
    setLoadingStations(isLoading || isFetching);
  }, [data, isLoading, isFetching, setStations, setLoadingStations]);

  const totalShown = data?.stations?.length ?? 0;
  const loading    = isLoading || isFetching;
  const srcInfo    = SOURCE_LABELS[source];

  return (
    <div className="flex flex-col h-screen" style={{ background: "var(--dark-bg)" }}>

      {/* ── Top bar ────────────────────────────────────────── */}
      <div className="glass-card border-b border-[#1a2744] rounded-none z-40 shrink-0">
        <div className="px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00ff9d] to-[#00d4ff] flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#060b18]" />
            </div>
            <span className="font-bold gradient-text hidden sm:block">GatiCharge</span>
          </div>

          <div className="h-5 w-px bg-[#1a2744] mx-1 hidden sm:block" />

          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            <MapPin className="w-3.5 h-3.5 text-[#00ff9d]" />
            <span className="hidden sm:block">{cityName}</span>
          </div>

          {/* Source badge */}
          {source !== "none" && (
            <span className="hidden md:flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
              style={{ background: `${srcInfo.color}15`, color: srcInfo.color, border: `1px solid ${srcInfo.color}40` }}>
              <Database className="w-3 h-3" />{srcInfo.label}
            </span>
          )}

          <div className="flex-1" />

          <span className="text-xs text-slate-500 shrink-0">
            {loading ? "Searching…" : `${totalShown} station${totalShown !== 1 ? "s" : ""}`}
          </span>

          <button onClick={locate} disabled={locating}
            className="p-2 rounded-lg hover:bg-[#1a2744] transition-colors" title="Use my location">
            <MapPin className={`w-4 h-4 ${locating ? "text-[#00ff9d] animate-pulse" : "text-slate-400"}`} />
          </button>

          <button onClick={() => refetch()}
            className="p-2 rounded-lg hover:bg-[#1a2744] transition-colors" title="Refresh">
            <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              showFilters ? "bg-[#00ff9d] text-[#060b18]" : "bg-[#1a2744] text-slate-300 hover:bg-[#243060]"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Filters</span>
          </button>
        </div>

        {/* ── Filters bar ──────────────────────────────────── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-[#1a2744] px-4 py-3 flex flex-wrap items-center gap-4"
            >
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 whitespace-nowrap">Type</label>
                <select
                  value={filters.charger_type || ""}
                  onChange={e => setFilters({ charger_type: e.target.value || null })}
                  className="text-xs py-1.5 px-3"
                >
                  {CHARGER_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">Radius</label>
                <div className="flex gap-1">
                  {RADIUS_OPTIONS.map(r => (
                    <button
                      key={r}
                      onClick={() => setFilters({ radius_km: r })}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                        filters.radius_km === r
                          ? "bg-[#00ff9d] text-[#060b18]"
                          : "bg-[#1a2744] text-slate-400 hover:text-white"
                      }`}
                    >{r} km</button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input type="checkbox" checked={filters.available_only}
                  onChange={e => setFilters({ available_only: e.target.checked })}
                  className="w-3.5 h-3.5 accent-[#00ff9d]" />
                Available Only
              </label>

              <div className="ml-auto flex items-start gap-1.5 text-xs text-slate-600">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Real data from OpenStreetMap / Open Charge Map</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Main ───────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <MapView />

          {loading && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000]">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-white"
                style={{ background: "rgba(13,21,38,0.9)", border: "1px solid rgba(0,255,157,0.3)" }}>
                <div className="w-3.5 h-3.5 border-2 border-[#00ff9d] border-t-transparent rounded-full animate-spin" />
                Fetching real stations near {cityName}…
              </div>
            </div>
          )}

          {!loading && totalShown === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[500]">
              <div className="glass-card p-6 text-center max-w-xs pointer-events-auto">
                <WifiOff className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-white font-semibold">No stations found</p>
                <p className="text-slate-500 text-xs mt-1">Try increasing the radius or removing filters.</p>
                <button
                  onClick={() => { setFilters({ radius_km: 100, charger_type: null, available_only: false }); refetch(); }}
                  className="btn-primary text-xs py-2 px-4 mt-3">
                  Search 100km · All Types
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="w-80 hidden lg:flex flex-col overflow-hidden border-l border-[#1a2744]"
          style={{ background: "var(--dark-card)" }}>
          <StationPanel />
        </div>
      </div>
    </div>
  );
}
