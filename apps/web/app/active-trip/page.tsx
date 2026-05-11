"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { 
  calculateHSS, HSSResult, checkSyncStop, SyncStopRecommendation, 
  getPostHaltNudge, PostHaltNudge, PassengerProfile, getMaxDriveMinutes, getPassengerStopMessage
} from "@/lib/humanStateEngine";
import { CHARGING_HUBS } from "@/lib/physics";
import Link from "next/link";
import { ChevronLeft, Zap, Brain, PauseCircle, PlayCircle, MapPin, Activity } from "lucide-react";

export default function ActiveTripSimulationPage() {
  const [tripStarted, setTripStarted] = useState(false);
  const [passengers, setPassengers] = useState<PassengerProfile[]>(["solo"]);
  const [fastForward, setFastForward] = useState(false);

  const [driveDurationMin, setDriveDurationMin] = useState(0);
  const [batteryPercent, setBatteryPercent] = useState(82);
  const [rangeKm, setRangeKm] = useState(315);
  
  const [hssResult, setHssResult] = useState<HSSResult>({
    score: 100, color: 'green', status: 'Sharp & Alert',
    breakdown: { driveDuration: 30, timeOfDay: 20, microSwerve: 25, brakingPattern: 15, blinkRate: 10 }
  });

  const [syncStop, setSyncStop] = useState<SyncStopRecommendation | null>(null);
  const [isHalted, setIsHalted] = useState(false);
  const [haltMinutes, setHaltMinutes] = useState(0);
  const [haltNudge, setHaltNudge] = useState<PostHaltNudge | null>(null);

  const togglePassenger = (p: PassengerProfile) => {
    let next = [...passengers];
    if (p === "solo") {
      next = ["solo"];
    } else {
      next = next.filter(x => x !== "solo");
      if (next.includes(p)) next = next.filter(x => x !== p);
      else next.push(p);
      if (next.length === 0) next = ["solo"];
    }
    setPassengers(next);
  };

  useEffect(() => {
    if (!tripStarted || isHalted) return;
    
    // In web simulation, we tick every second. If fastForward is true, 1 tick = 1 min.
    // If normal, 1 tick = 0.1 min.
    const interval = setInterval(() => {
      setDriveDurationMin(prev => {
        const next = prev + (fastForward ? 1 : 0.1);
        
        // Drain battery
        const drain = next * 0.15;
        const currentBattery = Math.max(5, 82 - drain);
        setBatteryPercent(Math.round(currentBattery));
        setRangeKm(Math.round(currentBattery * 3.84));

        // Mock variance (increases slightly as time goes on to simulate fatigue)
        const variance = 0.15 + (next / 120) * 0.4;
        const mockHardBrakes = next > 60 ? 1 : 0;
        
        const hour = new Date().getHours();
        const hss = calculateHSS(next, hour, variance, mockHardBrakes);
        setHssResult(hss);

        // Sync Stop Check
        const nearest = CHARGING_HUBS[0]; // Mock nearest
        const stop = checkSyncStop(
          Math.round(currentBattery), Math.round(currentBattery * 3.84),
          hss, Math.round(next), passengers,
          nearest.city, 14, nearest.lat, nearest.lng, nearest.power_kw
        );
        setSyncStop(stop);

        return next;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [tripStarted, isHalted, fastForward, passengers]);

  // Halt Timer
  useEffect(() => {
    if (!isHalted) return;
    const interval = setInterval(() => {
      setHaltMinutes(prev => {
        const next = prev + (fastForward ? 1 : 0.2);
        setHaltNudge(getPostHaltNudge(Math.floor(next)));
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isHalted, fastForward]);

  if (!tripStarted) {
    return (
      <div className="min-h-screen pt-24 px-6" style={{ background: "var(--dark-bg)" }}>
        <div className="max-w-3xl mx-auto">
          <Link href="/dashboard" className="text-[#0ea5e9] flex items-center gap-2 mb-8 hover:underline">
            <ChevronLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          
          <h1 className="text-4xl font-black text-white mb-2">Trip Setup</h1>
          <p className="text-slate-400 mb-10">Who is traveling with you? We'll adapt stops for everyone's comfort.</p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
            {[
              { id: "solo", icon: "🧑", label: "Solo" },
              { id: "partner", icon: "👫", label: "Partner" },
              { id: "infant", icon: "👶", label: "Infant" },
              { id: "child", icon: "🧒", label: "Child" },
              { id: "elderly", icon: "👴", label: "Elderly" },
              { id: "pet", icon: "🐕", label: "Pet" },
            ].map(p => {
              const isSelected = passengers.includes(p.id as PassengerProfile);
              return (
                <button 
                  key={p.id} 
                  onClick={() => togglePassenger(p.id as PassengerProfile)}
                  className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${isSelected ? 'border-[#00ff9d] bg-[#00ff9d]/10' : 'border-[#1a2744] bg-[#0d1526] hover:border-slate-700'}`}
                >
                  <span className="text-4xl">{p.icon}</span>
                  <span className={`font-bold ${isSelected ? 'text-[#00ff9d]' : 'text-white'}`}>{p.label}</span>
                </button>
              );
            })}
          </div>

          <button onClick={() => setTripStarted(true)} className="btn-primary w-full py-4 text-lg">
            Start Trip Simulation
          </button>
        </div>
      </div>
    );
  }

  const hssColor = hssResult.color === 'green' ? '#00ff9d' : hssResult.color === 'yellow' ? '#fbbf24' : '#ef4444';

  return (
    <div className="min-h-screen pt-24 px-6 pb-20" style={{ background: "var(--dark-bg)" }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black text-white">Active Trip</h1>
          
          <div className="flex gap-4">
            <button onClick={() => setFastForward(!fastForward)} className="px-4 py-2 rounded-lg border border-[#1a2744] text-white flex items-center gap-2 hover:bg-[#1a2744]">
              {fastForward ? <><PlayCircle className="w-4 h-4 text-[#0ea5e9]"/> Normal Speed</> : <><PlayCircle className="w-4 h-4 text-[#ef4444]"/> Fast Forward (1s = 1m)</>}
            </button>
            <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-[#ef4444] text-white font-bold">End Trip</button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Car Battery */}
          <div className="glass-card p-8 flex flex-col items-center justify-center relative overflow-hidden">
             <div className="absolute top-4 left-4 text-slate-500 font-bold flex items-center gap-2"><Zap className="w-4 h-4"/> CAR</div>
             <div className="w-40 h-40 rounded-full border-8 border-[#1a2744] flex items-center justify-center mb-4 relative" style={{ borderColor: batteryPercent > 30 ? '#0ea5e9' : '#ef4444' }}>
                <span className="text-4xl font-black text-white">{batteryPercent}%</span>
             </div>
             <div className="text-xl font-bold text-slate-300">{rangeKm} km remaining</div>
          </div>

          {/* Human Score */}
          <div className="glass-card p-8 flex flex-col items-center justify-center relative overflow-hidden">
             <div className="absolute top-4 left-4 text-slate-500 font-bold flex items-center gap-2"><Brain className="w-4 h-4"/> HUMAN</div>
             <div className="w-40 h-40 rounded-full border-8 flex items-center justify-center mb-4" style={{ borderColor: hssColor, boxShadow: `0 0 20px ${hssColor}40` }}>
                <span className="text-5xl font-black" style={{ color: hssColor }}>{hssResult.score}</span>
             </div>
             <div className="text-xl font-bold" style={{ color: hssColor }}>{hssResult.status}</div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="glass-card p-6 md:col-span-1">
             <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-[#0ea5e9]"/> Score Breakdown</h3>
             <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-slate-400">Drive Time ({Math.floor(driveDurationMin)}m)</span><span className="text-white font-bold">{hssResult.breakdown.driveDuration}/30</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Time of Day</span><span className="text-white font-bold">{hssResult.breakdown.timeOfDay}/20</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Smoothness</span><span className="text-white font-bold">{hssResult.breakdown.microSwerve}/25</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Braking</span><span className="text-white font-bold">{hssResult.breakdown.brakingPattern}/15</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Blink Rate</span><span className="text-white font-bold">{hssResult.breakdown.blinkRate}/10</span></div>
             </div>
          </div>

          <div className="md:col-span-2 space-y-6">
             {syncStop?.triggered && !isHalted && (
               <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="p-6 rounded-2xl border border-[#fbbf24] bg-[#fbbf24]/10 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-1 h-full bg-[#fbbf24]"></div>
                 <h2 className="text-2xl font-black text-[#fbbf24] mb-2">⚡ Stop Recommended</h2>
                 <div className="text-xl text-white font-bold mb-4">{syncStop.stationName} — {syncStop.stationDistanceKm} km ahead</div>
                 <div className="space-y-2 mb-6">
                   <div className="text-slate-300">🔋 <span className="text-white font-semibold">Car:</span> {syncStop.batteryPercent}% | Needs {syncStop.chargeTimeMin}m charge</div>
                   <div className="text-slate-300">🧠 <span className="text-white font-semibold">You:</span> Score {syncStop.humanScore} | Driving {Math.floor(syncStop.driveDurationMin)}m</div>
                 </div>
                 <p className="text-[#fbbf24] italic mb-6">{syncStop.message}</p>
                 
                 <div className="flex gap-4">
                   <button className="btn-primary flex-1">Navigate There</button>
                   <button onClick={() => { setIsHalted(true); setHaltMinutes(0); }} className="px-6 py-3 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-700">Simulate Parking</button>
                 </div>
               </motion.div>
             )}

             {isHalted && (
               <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card p-6 border-[#0ea5e9]">
                 <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><PauseCircle className="w-6 h-6 text-[#0ea5e9]"/> Halt Mode Active</h2>
                 
                 {haltNudge && (
                   <div className={`p-4 rounded-xl mb-6 border-l-4 ${haltNudge.type === 'optimal' ? 'border-[#00ff9d] bg-[#00ff9d]/10' : haltNudge.type === 'warning' ? 'border-[#fbbf24] bg-[#fbbf24]/10' : 'border-[#0ea5e9] bg-[#0ea5e9]/10'}`}>
                     <div className="text-lg text-white mb-2">{haltNudge.message}</div>
                     <div className="text-sm text-slate-400">{Math.floor(haltNudge.minutesStopped)} minutes stopped</div>
                   </div>
                 )}

                 <button onClick={() => { setIsHalted(false); setHaltMinutes(0); }} className="btn-primary w-full py-4">Resume Driving</button>
               </motion.div>
             )}

             {!syncStop?.triggered && !isHalted && (
               <div className="glass-card p-6 flex items-center justify-center min-h-[200px]">
                 <p className="text-slate-500 text-lg">Driving smoothly. No stops needed yet.</p>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
