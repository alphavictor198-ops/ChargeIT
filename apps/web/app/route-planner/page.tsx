"use client";
import dynamic from "next/dynamic";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation, Battery, Clock, MapPin, Locate } from "lucide-react";
import toast from "react-hot-toast";
import { VEHICLE_SPECS, planRoute, haversineKm, ROAD_FACTOR, type RoutePlan } from "@/lib/physics";
import { CITIES, type City } from "@/lib/cities";

const RouteMap = dynamic(() => import("@/components/map/RouteMap"), { ssr: false });
const VEHICLES = Object.values(VEHICLE_SPECS);

function CityPicker({ label, value, onChange }: { label: string; value: City; onChange: (c: City) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!q) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&featuretype=city`);
        const data = await res.json();
        const cities = data.map((d: any) => ({
          city: d.display_name.split(",")[0],
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
        }));
        setResults(cities);
      } catch {
        // ignore error
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div ref={ref} className="relative mb-3">
      <label className="text-xs text-slate-400 block mb-1">{label}</label>
      <input
        value={open ? q : value.city}
        onFocus={() => { setOpen(true); setQ(""); setResults([]); }}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        placeholder="Type city name..."
        className="w-full text-sm py-2 px-3 bg-white text-slate-800 border border-slate-300 rounded"
      />
      {open && q && (
        <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-xl shadow-xl bg-slate-900 border border-slate-700">
          {loading ? <div className="px-3 py-2 text-xs text-slate-400">Searching...</div> : results.map((c, i) => (
            <div key={i} onClick={() => { onChange(c); setOpen(false); setQ(""); }}
              className="px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 cursor-pointer">{c.city}</div>
          ))}
          {!loading && results.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">No city found</div>}
        </div>
      )}
    </div>
  );
}

export default function RoutePlannerPage() {
  const [origin, setOrigin] = useState(CITIES.find(c => c.city === "Indore")!);
  const [dest, setDest] = useState(CITIES.find(c => c.city === "Delhi")!);
  const [vid, setVid] = useState("nexon_ev");
  const [soc, setSoc] = useState(80);
  const [minSoc, setMinSoc] = useState(15);
  const [result, setResult] = useState<RoutePlan | null>(null);
  const [isCalc, setIsCalc] = useState(false);

  // GPS navigation state
  const [navActive, setNavActive] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [liveEta, setLiveEta] = useState(0);
  const [liveDistNext, setLiveDistNext] = useState(0);
  const [liveNextStop, setLiveNextStop] = useState("");
  const [liveSoc, setLiveSoc] = useState(soc);
  const watchRef = useRef<number | null>(null);

  const spec = VEHICLE_SPECS[vid];
  const preview = useMemo(() => {
    const crow = haversineKm(origin.lat, origin.lng, dest.lat, dest.lng);
    return { crow: +crow.toFixed(0), road: +(crow * ROAD_FACTOR).toFixed(0) };
  }, [origin, dest]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dName = params.get("destName");
    const dLat = params.get("destLat");
    const dLng = params.get("destLng");
    
    if (dName && dLat && dLng) {
      const customDest = { city: dName, lat: parseFloat(dLat), lng: parseFloat(dLng) };
      setDest(customDest);
      const currentOrigin = CITIES.find(c => c.city === "Indore")!;
      setOrigin(currentOrigin);
      
      setIsCalc(true);
      setTimeout(() => {
        const plan = planRoute(currentOrigin.lat, currentOrigin.lng, customDest.lat, customDest.lng, spec, soc, minSoc, 65, 28);
        setResult(plan);
        setIsCalc(false);
        toast.success(`Route planned to ${customDest.city}`);
      }, 500);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlan = () => {
    if (origin.city === dest.city) { toast.error("Pick different cities"); return; }
    setIsCalc(true);
    stopNav();
    setTimeout(() => {
      const plan = planRoute(origin.lat, origin.lng, dest.lat, dest.lng, spec, soc, minSoc, 65, 28);
      setResult(plan);
      setIsCalc(false);
      toast.success(`Route: ${plan.roadDistanceKm} km, ${plan.stops.length} stop${plan.stops.length !== 1 ? "s" : ""}`);
    }, 200);
  };

  // Build waypoints for GPS navigation
  const waypoints = useMemo(() => {
    if (!result) return [];
    const pts = [
      { name: origin.city, lat: origin.lat, lng: origin.lng, isCharger: false },
      ...result.stops.map(s => ({ name: `${s.operator} — ${s.city}`, lat: s.lat, lng: s.lng, isCharger: true })),
      { name: dest.city, lat: dest.lat, lng: dest.lng, isCharger: false },
    ];
    return pts;
  }, [result, origin, dest]);

  // GPS-based live navigation
  const startNav = useCallback(() => {
    if (!result || !navigator.geolocation) {
      toast.error("Geolocation not available");
      return;
    }
    setNavActive(true);
    setLiveSoc(soc);
    toast.success("📍 Live navigation started — GPS tracking active");

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        setUserPos({ lat, lng });

        // Find next waypoint
        let closestFuture = waypoints[waypoints.length - 1];
        let minDist = Infinity;
        for (let i = 0; i < waypoints.length; i++) {
          const d = haversineKm(lat, lng, waypoints[i].lat, waypoints[i].lng);
          if (d < minDist) { minDist = d; }
        }
        // Next waypoint = first one ahead that's > 1km away
        for (const wp of waypoints) {
          const d = haversineKm(lat, lng, wp.lat, wp.lng);
          if (d > 1) { closestFuture = wp; break; }
        }

        const distToNext = haversineKm(lat, lng, closestFuture.lat, closestFuture.lng) * ROAD_FACTOR;
        const distToDest = haversineKm(lat, lng, dest.lat, dest.lng) * ROAD_FACTOR;
        const speed = pos.coords.speed ? pos.coords.speed * 3.6 : 55;
        const eta = distToDest / Math.max(speed, 20) * 60;

        setLiveDistNext(+distToNext.toFixed(1));
        setLiveNextStop(closestFuture.name);
        setLiveEta(+eta.toFixed(0));

        // SOC estimate based on distance from origin
        const distFromOrigin = haversineKm(origin.lat, origin.lng, lat, lng) * ROAD_FACTOR;
        const consumed = (spec.efficiency_wh_per_km * distFromOrigin) / (spec.battery_kwh * 10);
        setLiveSoc(Math.max(0, soc - consumed));

        if (distToDest < 0.5) {
          toast.success("🎉 You have arrived!");
          stopNav();
        }
      },
      (err) => toast.error(`GPS Error: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }, [result, waypoints, origin, dest, soc, spec]);

  const stopNav = useCallback(() => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setNavActive(false);
  }, []);

  useEffect(() => () => { if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); }, []);

  const mapPoints = useMemo(() => {
    if (!result) return null;
    return {
      origin: { name: origin.city, lat: origin.lat, lng: origin.lng },
      dest: { name: dest.city, lat: dest.lat, lng: dest.lng },
      stops: result.stops.map(s => ({ name: `${s.operator} — ${s.city}`, lat: s.lat, lng: s.lng, type: s.stationType })),
    };
  }, [result, origin, dest]);

  const h = result ? Math.floor(result.durationMin / 60) : 0;
  const m = result ? Math.round(result.durationMin % 60) : 0;

  return (
    <div className="min-h-screen pt-16 p-4 md:px-6 md:pb-6" style={{ background: "var(--dark-bg)" }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <Navigation className="w-6 h-6 text-[#00ff9d]" />
            <h1 className="text-2xl md:text-3xl font-black text-white">Route Optimizer</h1>
          </div>
          <p className="text-slate-400 text-sm">Physics-based planning · Shortest route with real charging stations</p>
        </div>

        <div className="grid lg:grid-cols-5 gap-5">
          {/* ── LEFT PANEL ─────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-card p-5">
              <h2 className="font-bold text-white mb-4">Trip Setup</h2>
              <CityPicker label="Origin" value={origin} onChange={setOrigin} />
              <CityPicker label="Destination" value={dest} onChange={setDest} />

              {origin.city !== dest.city && (
                <motion.div key={`${origin.city}-${dest.city}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex justify-between text-xs px-3 py-2 rounded-lg mb-3"
                  style={{ background: "rgba(0,255,157,0.06)", border: "1px solid rgba(0,255,157,0.15)" }}>
                  <span className="text-slate-400">Straight-line: <b className="text-white">{preview.crow} km</b></span>
                  <span className="text-slate-400">Road est.: <b className="text-[#00ff9d]">{preview.road} km</b></span>
                </motion.div>
              )}

              <div className="mb-3">
                <label className="text-xs text-slate-400 block mb-1">Vehicle</label>
                <select value={vid} onChange={e => setVid(e.target.value)} className="w-full text-sm py-2 px-3">
                  {VEHICLES.map(v => <option key={v.id} value={v.id}>{v.name} ({v.battery_kwh} kWh)</option>)}
                </select>
              </div>
              <div className="mb-3">
                <label className="text-xs text-slate-400 block mb-1">
                  Battery SoC: <span className="text-[#00ff9d] font-bold">{soc}%</span>
                  <span className="text-slate-600 ml-2">({(spec.battery_kwh*soc/100).toFixed(1)} kWh)</span>
                </label>
                <input type="range" min="10" max="100" value={soc} onChange={e => setSoc(+e.target.value)} className="w-full" />
              </div>
              <div className="mb-4">
                <label className="text-xs text-slate-400 block mb-1">
                  Min Arrival SoC: <span className="text-[#fbbf24] font-bold">{minSoc}%</span>
                </label>
                <input type="range" min="5" max="30" value={minSoc} onChange={e => setMinSoc(+e.target.value)} className="w-full" />
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handlePlan} disabled={isCalc || origin.city === dest.city}
                className="btn-primary w-full flex items-center justify-center gap-2">
                {isCalc ? <div className="w-4 h-4 border-2 border-[#060b18] border-t-transparent rounded-full animate-spin" />
                  : <><Navigation className="w-4 h-4" />Plan Route</>}
              </motion.button>
            </div>

            {/* ── ROUTE RESULT ─────────────────────────── */}
            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[{ icon: "📏", val: `${result.roadDistanceKm} km`, lbl: "Distance" },
                      { icon: "⏱️", val: `${h}h ${m}m`, lbl: "Duration" },
                      { icon: "🔌", val: `${result.stops.length}`, lbl: "Stops" },
                    ].map(s => (
                      <div key={s.lbl} className="bg-slate-900 text-center p-3 rounded-xl">
                        <div className="text-lg">{s.icon}</div>
                        <div className="text-sm font-bold text-white">{s.val}</div>
                        <div className="text-[10px] text-slate-300">{s.lbl}</div>
                      </div>
                    ))}
                  </div>

                  {result.stops.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-semibold text-slate-400 mb-2">Charging Stops</div>
                      {result.stops.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 py-2 text-xs border-b border-[#1a2744] last:border-0">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={{ background: "rgba(0,255,157,0.15)", color: "#00ff9d" }}>{i+1}</div>
                          <div className="min-w-0 flex-1">
                            <div className="text-white font-medium truncate">{s.city}
                              <span className="text-[#00d4ff] ml-1 font-normal">· {s.operator}</span>
                            </div>
                            <div className="text-[10px] text-slate-600">{s.stationType} · {s.waitTimeMin}m wait</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-slate-400">{s.arrivalSoc.toFixed(0)}%→{s.chargeTo}%</div>
                            <div className="text-[#fbbf24] font-semibold">{s.chargeTimeMin}m</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Start / Stop Navigation */}
                  {!navActive ? (
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={startNav}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                      style={{ background: "linear-gradient(135deg,#00ff9d,#00d4ff)", color: "#060b18" }}>
                      <Locate className="w-4 h-4" />Start Navigation (GPS)
                    </motion.button>
                  ) : (
                    <motion.button whileHover={{ scale: 1.02 }} onClick={stopNav}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                      style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                      Stop Navigation
                    </motion.button>
                  )}

                  {/* Live GPS info */}
                  {navActive && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <div className="w-2 h-2 rounded-full bg-[#00ff9d] animate-pulse" />GPS tracking active
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 rounded-xl" style={{ background: "#0d1526" }}>
                          <div className="text-[10px] text-slate-500 mb-0.5">🔋 Battery</div>
                          <div className="text-xl font-black" style={{ color: liveSoc > 30 ? "#00ff9d" : liveSoc > 15 ? "#fbbf24" : "#ef4444" }}>
                            {liveSoc.toFixed(0)}%</div>
                        </div>
                        <div className="p-3 rounded-xl" style={{ background: "#0d1526" }}>
                          <div className="text-[10px] text-slate-500 mb-0.5">⏱️ ETA</div>
                          <div className="text-xl font-black text-white">{Math.floor(liveEta/60)}h {liveEta%60}m</div>
                        </div>
                        <div className="p-3 rounded-xl col-span-2" style={{ background: "#0d1526" }}>
                          <div className="text-[10px] text-slate-500 mb-0.5">📍 Next Stop</div>
                          <div className="text-sm font-bold text-[#00d4ff] truncate">{liveNextStop}</div>
                          <div className="text-xs text-slate-500">{liveDistNext} km away</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── RIGHT: MAP ─────────────────────────────── */}
          <div className="lg:col-span-3">
            <div className="glass-card overflow-hidden" style={{ height: "calc(100vh - 120px)", minHeight: 500 }}>
              {result && mapPoints ? (
                <RouteMap origin={mapPoints.origin} destination={mapPoints.dest}
                  stops={mapPoints.stops} userPos={userPos} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <Navigation className="w-16 h-16 text-slate-700 mb-4" />
                  <p className="text-slate-400 font-medium">Select origin, destination &amp; vehicle</p>
                  <p className="text-slate-600 text-sm mt-1">then click <span className="text-[#00ff9d]">Plan Route</span></p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
