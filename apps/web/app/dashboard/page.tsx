"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { intelligenceApi } from "@/lib/api";
import { Battery, Zap, AlertTriangle, TrendingUp, Link as LinkIcon } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { VEHICLE_SPECS, computePowerKw, predictTripSegment } from "@/lib/physics";
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";

const LocationServices = dynamic(() => import("@/components/dashboard/LocationServices"), { ssr: false });

const VEHICLE_OPTIONS = Object.values(VEHICLE_SPECS);

function SocGauge({ soc }: { soc: number }) {
  const color = soc > 50 ? "#0ea5e9" : soc > 20 ? "#f59e0b" : "#ef4444";
  const circumference = 2 * Math.PI * 42;
  return (
    <div className="relative w-44 h-44 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#bae6fd" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="42"
          fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${(soc / 100) * circumference} ${circumference}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${color})`, transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-black text-slate-800">{soc}%</div>
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
    <div className="min-h-screen pt-16 p-4 md:px-6 md:pb-6" style={{ background: "var(--dark-bg)" }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 relative">
          <div className="absolute right-0 top-0">
            <Link href="/vehicle-connect"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-all"
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
          {/* ─ Left Panel: Charging Details ────────────────────── */}
          <div className="glass-card p-5">
            <h2 className="font-bold mb-4 flex items-center gap-2 text-slate-800">
              <Zap className="w-5 h-5 text-[#0ea5e9]" />
              Charging Details
            </h2>

            <div className="space-y-4">
              <div className="p-4 rounded-xl" style={{ background: "rgba(14, 165, 233, 0.1)", border: "1px solid rgba(14, 165, 233, 0.2)" }}>
                 <div className="text-xs text-slate-500 mb-1">Status</div>
                 <div className="text-xl font-bold text-[#0ea5e9] flex items-center gap-2">
                   <Zap className="w-5 h-5" /> Plugged In, Charging
                 </div>
              </div>
               
              <div className="p-4 rounded-xl" style={{ background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
                 <div className="text-xs text-slate-500 mb-1">Real-time Speed</div>
                 <div className="text-3xl font-black text-[#3b82f6]">48.5 <span className="text-lg text-slate-500 font-normal">kW</span></div>
              </div>

              <div className="p-4 rounded-xl" style={{ background: "rgba(99, 102, 241, 0.1)", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
                 <div className="text-xs text-slate-500 mb-1">Time to Full (100%)</div>
                 <div className="text-3xl font-black text-[#6366f1]">1<span className="text-lg font-normal">h</span> 15<span className="text-lg font-normal">m</span></div>
              </div>
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

            {/* Map & Route Planner Buttons */}
            <div className="w-full mt-6 grid grid-cols-2 gap-3">
              <Link href="/stations" className="w-full">
                <button className="btn-secondary w-full text-xs py-3 flex flex-col items-center justify-center gap-1.5" style={{ minHeight: "80px" }}>
                  <span className="text-xl">🗺️</span>
                  Station Map
                </button>
              </Link>
              <Link href="/route-planner" className="w-full">
                <button className="btn-secondary w-full text-xs py-3 flex flex-col items-center justify-center gap-1.5" style={{ minHeight: "80px" }}>
                  <span className="text-xl">🧭</span>
                  Route Planner
                </button>
              </Link>
            </div>
          </div>

          {/* ─ Location Services ──────────────────────────────── */}
          <div className="glass-card p-5 flex flex-col">
            <h2 className="font-bold mb-4 flex items-center gap-2 text-slate-800">
              <MapPin className="w-5 h-5 text-[#3b82f6]" />
              Location Services
            </h2>
            <div className="flex-1 min-h-[300px]">
              <LocationServices />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
