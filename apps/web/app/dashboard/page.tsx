"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { intelligenceApi } from "@/lib/api";
import { 
  Battery, Zap, AlertTriangle, TrendingUp, 
  Link as LinkIcon, Shield, Activity, Truck, Car, MapPin, CheckCircle 
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { VEHICLE_SPECS, computePowerKw, predictTripSegment } from "@/lib/physics";
import dynamic from "next/dynamic";

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
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    setIsConnecting(true);
    setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(true);
      toast.success("Vehicle Securely Connected", {
        icon: "🔒",
        style: { background: "#060b18", color: "#fff", border: "1px solid #ff6b1a" }
      });
    }, 2000);
  };
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
            <button 
              onClick={handleConnect}
              disabled={isConnected || isConnecting}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${isConnected ? 'cursor-default' : 'hover:brightness-110'}`}
              style={{ 
                background: isConnected ? "rgba(0,255,157,0.1)" : "rgba(0,212,255,0.1)", 
                color: isConnected ? "#00ff9d" : "#00d4ff", 
                border: `1px solid ${isConnected ? "rgba(0,255,157,0.3)" : "rgba(0,212,255,0.3)"}` 
              }}
            >
              {isConnecting ? (
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : isConnected ? (
                <CheckCircle className="w-3.5 h-3.5 animate-pulse" />
              ) : (
                <LinkIcon className="w-3.5 h-3.5" />
              )}
              {isConnecting ? "Connecting..." : isConnected ? "Vehicle Connected" : "Connect Vehicle"}
            </button>
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

          {/* ─ Rotating Car HUD ──────────────────────────────────── */}
          <div className="glass-card p-5 flex flex-col items-center relative overflow-hidden">
            <div className="hud-scanner" />
            <h2 className="font-bold text-white mb-4 self-start tracking-widest text-xs opacity-60">VEHICLE SCANNER</h2>
            
            <div className="rotating-car-container relative">
              <div className="neon-ring" />
              <div className="rotating-car">
                <img 
                  src="/charging_car_dark.png" 
                  alt="Vehicle Scan" 
                  className="w-48 h-auto object-contain drop-shadow-[0_0_15px_rgba(255,107,26,0.3)]" 
                />
              </div>
            </div>

            <div className="w-full text-center z-10">
              <h3 className="text-xl font-black text-white tracking-widest uppercase mb-4">{spec.name}</h3>
              
              <div className="grid grid-cols-2 gap-4 bg-black/40 p-4 rounded-2xl border border-white/5 mb-6">
                <div className="flex flex-col items-center">
                  <Battery className="w-4 h-4 text-[#44ffb2] mb-1" />
                  <span className="text-2xl font-black text-white">{soc}%</span>
                  <span className="text-[10px] font-bold text-slate-500 tracking-tighter">CHARGE</span>
                </div>
                <div className="flex flex-col items-center border-l border-white/10">
                  <Zap className="w-4 h-4 text-[#ffaa44] mb-1" />
                  <span className="text-2xl font-black text-white">{displayRange}</span>
                  <span className="text-[10px] font-bold text-slate-500 tracking-tighter">EST. RANGE</span>
                </div>
              </div>

              <div className="text-xs text-slate-500 mb-6 italic">
                {spec.battery_kwh} kWh Battery · {livePhysics.efficiency} Wh/km avg.
              </div>
            </div>

            {/* Map, Route Planner & Active Trip Buttons */}
            <div className="w-full mt-auto grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link href="/stations" className="w-full">
                <button className="btn-secondary w-full text-[10px] py-3 flex flex-col items-center justify-center gap-1.5" style={{ minHeight: "80px" }}>
                  <MapPin className="w-4 h-4" />
                  Station Map
                </button>
              </Link>
              <Link href="/route-planner" className="w-full">
                <button className="btn-secondary w-full text-[10px] py-3 flex flex-col items-center justify-center gap-1.5" style={{ minHeight: "80px" }}>
                  <TrendingUp className="w-4 h-4" />
                  Optimizer
                </button>
              </Link>
              <Link href="/passenger-profile" className="w-full">
                <button className="w-full text-[10px] py-3 flex flex-col items-center justify-center gap-1.5 rounded-xl font-bold transition-all" 
                        style={{ minHeight: "80px", background: "rgba(255,107,26,0.1)", color: "#ff6b1a", border: "1px solid rgba(255,107,26,0.3)" }}>
                  <Zap className="w-4 h-4" />
                  Start HUD
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

        {/* ─ Enterprise & AI Suite ────────────────────────────── */}
        <div className="mt-8">
          <h2 className="text-xl font-black text-white mb-6 tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#00ff9d]" /> Enterprise Intelligence Suite
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Link href="/admin">
              <div className="glass-card p-6 bg-white/[0.03] border-white/5 rounded-2xl border hover:bg-white/[0.05] transition-all group cursor-pointer h-full">
                <h3 className="text-lg font-bold text-white group-hover:text-[#00ff9d] transition-colors">CPO Admin Panel</h3>
                <p className="text-sm text-slate-400 mt-2">Manage charging infrastructure, pricing models, and hardware health via OCPP.</p>
              </div>
            </Link>

            <Link href="/fleet">
              <div className="glass-card p-6 bg-white/[0.03] border-white/5 rounded-2xl border hover:bg-white/[0.05] transition-all group cursor-pointer h-full">
                <h3 className="text-lg font-bold text-white group-hover:text-[#ff6b1a] transition-colors">Fleet Management</h3>
                <p className="text-sm text-slate-400 mt-2">Monitor multi-vehicle telemetry, driver HSS safety scores, and logistical efficiency.</p>
              </div>
            </Link>

            <div className="glass-card p-6 bg-white/[0.03] border-white/5 rounded-2xl border opacity-80 h-full relative overflow-hidden">
               <div className="absolute top-0 right-0 bg-[#8b5cf6]/20 text-[#8b5cf6] px-3 py-1 text-[10px] font-black uppercase rounded-bl-lg">Simulated</div>
                <h3 className="text-lg font-bold text-white">AI Demand Forecast</h3>
                <p className="text-sm text-slate-400 mt-2">Predictive heatmaps and grid-load balancing suggestions for future-ready infrastructure.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
