"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { intelligenceApi } from "@/lib/api";
import { Battery, Zap, AlertTriangle, TrendingUp, Link as LinkIcon } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { VEHICLE_SPECS, computePowerKw, predictTripSegment } from "@/lib/physics";

const VEHICLE_OPTIONS = Object.values(VEHICLE_SPECS);

function SocGauge({ soc }: { soc: number }) {
  const color = soc > 50 ? "#00ff9d" : soc > 20 ? "#fbbf24" : "#ef4444";
  const circumference = 2 * Math.PI * 42;
  return (
    <div className="relative w-44 h-44 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#1a2744" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="42"
          fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${(soc / 100) * circumference} ${circumference}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-black text-white">{soc}%</div>
        <div className="text-xs text-slate-500">State of Charge</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [vehicleId, setVehicleId] = useState("nexon_ev");
  const [soc,       setSoc]       = useState(80);
  const [speed,     setSpeed]     = useState(60);
  const [temp,      setTemp]      = useState(28);
  const [useHvac,   setUseHvac]   = useState(true);

  const spec = VEHICLE_SPECS[vehicleId];

  // Real-time client-side physics (instant, no API call)
  const livePhysics = useMemo(() => {
    const power = computePowerKw(spec, speed, 0, temp, useHvac);
    const seg = predictTripSegment(spec, 1000, soc, speed, temp, useHvac); // large distance to get range
    const rangeKm = Math.round((soc / 100) * spec.battery_kwh * 1000 / seg.efficiency_wh_per_km);
    const warnings: string[] = [];
    if (temp < 5)  warnings.push("Cold weather reduces range by up to 25%");
    else if (temp < 15) warnings.push("Cool weather — ~10% range reduction expected");
    if (temp > 40) warnings.push("High heat — HVAC load increases energy use ~8%");
    if (speed > 100) warnings.push("High speed: aero drag grows with cube of velocity");
    if (soc < 20)  warnings.push("Low SoC — find a charger soon");
    return { power, rangeKm, efficiency: seg.efficiency_wh_per_km, warnings };
  }, [spec, soc, speed, temp, useHvac]);

  // Backend call for full breakdown with confidence intervals
  const rangeMutation = useMutation({
    mutationFn: () =>
      intelligenceApi.predictRange({
        vehicle_id: vehicleId,
        current_soc_percent: soc,
        speed_kmh: speed,
        temperature_celsius: temp,
        use_hvac: useHvac,
      }),
    onError: () => toast("Using on-device physics — backend offline", { icon: "🔬" }),
  });

  const backendResult = rangeMutation.data?.data;
  const displayRange = backendResult?.estimated_range_km ?? livePhysics.rangeKm;

  const powerBars = [
    { label: "Rolling Resistance", kw: livePhysics.power.rolling, color: "#00ff9d" },
    { label: "Aerodynamic Drag",   kw: livePhysics.power.aero,    color: "#00d4ff" },
    { label: "Elevation Load",     kw: livePhysics.power.gradient, color: "#8b5cf6" },
    { label: "HVAC Load",          kw: livePhysics.power.hvac,    color: "#f59e0b" },
  ];
  const totalKw = livePhysics.power.total;

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: "var(--dark-bg)" }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00ff9d] to-[#00d4ff] flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#060b18]" />
            </div>
            <span className="gradient-text font-bold text-xl">GatiCharge</span>
            <Link href="/vehicle-connect"
              className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-all"
              style={{ background: "rgba(0,212,255,0.1)", color: "#00d4ff", border: "1px solid rgba(0,212,255,0.3)" }}>
              <LinkIcon className="w-3.5 h-3.5" />Connect Vehicle
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white">EV Intelligence Center</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Live physics · Updates in real-time as you adjust parameters
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* ─ Controls ─────────────────────────────────────────── */}
          <div className="glass-card p-5">
            <h2 className="font-bold text-white mb-4 flex items-center gap-2">
              <Battery className="w-4 h-4 text-[#00ff9d]" />
              Vehicle & Conditions
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Vehicle</label>
                <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
                  className="w-full text-sm py-2 px-3">
                  {VEHICLE_OPTIONS.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <div className="text-xs text-slate-600 mt-1">
                  {spec.battery_kwh} kWh · base {spec.efficiency_wh_per_km} Wh/km · max {spec.max_charge_rate_kw} kW
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">
                  State of Charge: <span className="text-[#00ff9d] font-bold">{soc}%</span>
                  <span className="text-slate-600 ml-2">({((spec.battery_kwh * soc / 100)).toFixed(1)} kWh avail.)</span>
                </label>
                <input type="range" min="5" max="100" value={soc}
                  onChange={e => setSoc(Number(e.target.value))} className="w-full" />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">
                  Speed: <span className="text-[#00d4ff] font-bold">{speed} km/h</span>
                  {speed > 100 && <span className="text-[#ef4444] ml-2 text-xs">↑ High drag</span>}
                </label>
                <input type="range" min="20" max="130" value={speed}
                  onChange={e => setSpeed(Number(e.target.value))} className="w-full" />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">
                  Temperature: <span className="text-[#8b5cf6] font-bold">{temp}°C</span>
                  {temp < 10 && <span className="text-[#fbbf24] ml-2 text-xs">↓ Cold penalty</span>}
                  {temp > 38 && <span className="text-[#f59e0b] ml-2 text-xs">↑ Heat penalty</span>}
                </label>
                <input type="range" min="-5" max="48" value={temp}
                  onChange={e => setTemp(Number(e.target.value))} className="w-full" />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setUseHvac(!useHvac)}
                  className="w-10 h-5 rounded-full relative transition-all cursor-pointer"
                  style={{ background: useHvac ? "#00ff9d" : "#1a2744" }}>
                  <div className="w-4 h-4 rounded-full absolute top-0.5 bg-white transition-all"
                    style={{ left: useHvac ? "22px" : "2px" }} />
                </div>
                <span className="text-sm text-slate-300">HVAC Active</span>
                {useHvac && <span className="text-xs text-slate-500">({spec.hvac_max_kw} kW max)</span>}
              </label>

              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => rangeMutation.mutate()}
                disabled={rangeMutation.isPending}
                className="btn-primary w-full text-sm flex items-center justify-center gap-2"
              >
                {rangeMutation.isPending
                  ? <div className="w-4 h-4 border-2 border-[#060b18] border-t-transparent rounded-full animate-spin" />
                  : <><TrendingUp className="w-4 h-4" />Get Backend Prediction</>}
              </motion.button>
              <p className="text-xs text-slate-600 text-center -mt-2">
                Physics model updates live ↗ · Button sends to backend API
              </p>
            </div>
          </div>

          {/* ─ Gauge + Range ──────────────────────────────────── */}
          <div className="glass-card p-5 flex flex-col items-center">
            <h2 className="font-bold text-white mb-4 self-start">Range Prediction</h2>
            <SocGauge soc={soc} />

            <div className="mt-5 text-center">
              <motion.div
                key={displayRange}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl font-black text-white"
              >
                {displayRange}
                <span className="text-2xl text-slate-400 ml-1">km</span>
              </motion.div>
              <div className="text-sm text-slate-400 mt-1">Estimated Range</div>
              <div className="text-xs text-slate-600 mt-1">{livePhysics.efficiency} Wh/km at {speed} km/h</div>
            </div>

            {/* Backend confidence intervals */}
            {backendResult && (
              <div className="w-full mt-5 space-y-2">
                <div className="text-xs text-slate-500 mb-2 font-semibold">Backend Confidence Interval</div>
                {[
                  { l: "Conservative", v: backendResult.confidence_interval.low_km,  c: "#ef4444" },
                  { l: "Expected",     v: backendResult.confidence_interval.mid_km,  c: "#00ff9d" },
                  { l: "Optimistic",   v: backendResult.confidence_interval.high_km, c: "#00d4ff" },
                ].map(r => (
                  <div key={r.l} className="flex justify-between text-xs">
                    <span className="text-slate-500">{r.l}</span>
                    <span className="font-semibold" style={{ color: r.c }}>{r.v} km</span>
                  </div>
                ))}
              </div>
            )}

            {/* Live warnings */}
            <div className="w-full mt-4 space-y-2">
              {livePhysics.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg text-xs"
                  style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
                  <AlertTriangle className="w-3.5 h-3.5 text-[#fbbf24] shrink-0 mt-0.5" />
                  <span className="text-[#fbbf24]">{w}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ─ Power Breakdown ────────────────────────────────── */}
          <div className="glass-card p-5">
            <h2 className="font-bold text-white mb-4">Live Power Breakdown</h2>

            <div className="space-y-4">
              {powerBars.map(bar => {
                const pct = totalKw > 0 ? (bar.kw / totalKw) * 100 : 0;
                return (
                  <div key={bar.label}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-400">{bar.label}</span>
                      <span className="font-semibold" style={{ color: bar.color }}>
                        {bar.kw.toFixed(2)} kW
                      </span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: "#1a2744" }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: bar.color }}
                        animate={{ width: `${Math.min(pct, 100)}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="gradient-sep mt-5 mb-4" />

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white font-semibold">Total Power Draw</span>
                <span className="font-bold text-[#00ff9d]">{totalKw.toFixed(2)} kW</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Live Efficiency</span>
                <span className="text-white">{livePhysics.efficiency} Wh/km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">vs. Spec</span>
                <span className={livePhysics.efficiency > spec.efficiency_wh_per_km ? "text-[#ef4444]" : "text-[#00ff9d]"}>
                  {livePhysics.efficiency > spec.efficiency_wh_per_km ? "+" : ""}
                  {(livePhysics.efficiency - spec.efficiency_wh_per_km).toFixed(0)} Wh/km
                </span>
              </div>
            </div>

            {/* Time to charge */}
            <div className="mt-5 p-3 rounded-xl" style={{ background: "rgba(0,255,157,0.05)", border: "1px solid rgba(0,255,157,0.15)" }}>
              <div className="text-xs font-semibold text-slate-400 mb-2">Charge Time Estimates (10→80%)</div>
              <div className="space-y-1 text-xs">
                {[
                  ["AC Slow (7.4 kW)",   Math.round((0.7 * spec.battery_kwh / 7.4) * 60)],
                  ["AC Fast (22 kW)",    Math.round((0.7 * spec.battery_kwh / 22) * 60)],
                  [`DC Fast (${spec.max_charge_rate_kw} kW)`, Math.round((0.7 * spec.battery_kwh / spec.max_charge_rate_kw) * 60)],
                ].map(([type, mins]) => (
                  <div key={String(type)} className="flex justify-between">
                    <span className="text-slate-500">{type}</span>
                    <span className="text-white">{Math.floor(Number(mins)/60) > 0 ? `${Math.floor(Number(mins)/60)}h ` : ""}{Number(mins)%60} min</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid sm:grid-cols-3 gap-4 mt-5">
          {[
            { href: "/stations",       icon: "🗺️", title: "Station Map",    desc: "Find nearby chargers" },
            { href: "/route-planner",  icon: "🧭", title: "Route Planner",  desc: "Optimize your journey" },
            { href: "/vehicle-connect",icon: "📡", title: "Connect Vehicle", desc: "Live data via Bluetooth/WiFi" },
          ].map(c => (
            <Link key={c.href} href={c.href}>
              <motion.div whileHover={{ scale: 1.02 }} className="stat-card p-5 cursor-pointer">
                <div className="text-2xl mb-2">{c.icon}</div>
                <div className="font-semibold text-white text-sm">{c.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{c.desc}</div>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
