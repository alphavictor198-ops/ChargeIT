"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, Zap, Battery, Brain, MapPin, 
  Timer, AlertTriangle, ShieldCheck, TrendingUp,
  Info, Navigation
} from "lucide-react";
import toast from "react-hot-toast";

export default function ActiveTripHUD() {
  const [soc, setSoc] = useState(82);
  const [hss, setHss] = useState(98);
  const [elapsed, setElapsed] = useState(0);
  const [isAlert, setIsAlert] = useState(false);

  // Simulation Loop
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(prev => prev + 1);
      
      // Simulate slow battery drain
      if (Math.random() > 0.8) setSoc(s => Math.max(2, s - 1));
      
      // Simulate HSS fluctuation
      if (Math.random() > 0.9) {
        const drop = Math.floor(Math.random() * 5);
        setHss(h => {
          const next = Math.max(45, h - drop);
          if (next < 80 && !isAlert) {
             setIsAlert(true);
             toast("Safety Alert: Fatigue detected", { icon: "⚠️", style: { background: "#ff4455", color: "#fff" } });
          }
          return next;
        });
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [isAlert]);

  const hssColor = hss > 85 ? "#00ff9d" : hss > 70 ? "#ffaa44" : "#ff4455";

  return (
    <div className="min-h-screen bg-[#060404] text-white p-6 pt-24 overflow-hidden relative">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" 
           style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      
      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header HUD */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#ff6b1a] animate-pulse" />
              <h1 className="text-2xl font-black tracking-widest uppercase italic">GATI_HUD_v1.6</h1>
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Live Synchronization Active</p>
          </div>
          <div className="flex gap-4">
             <div className="bg-white/5 border border-white/10 px-6 py-2 rounded-xl text-center">
                <div className="text-xs text-slate-500 font-bold uppercase">Time Elapsed</div>
                <div className="text-xl font-black text-white">{Math.floor(elapsed / 60)}h {elapsed % 60}m</div>
             </div>
             <button className="bg-red-500/10 border border-red-500/30 text-red-500 px-6 py-2 rounded-xl font-black text-xs tracking-widest hover:bg-red-500/20 transition-all">
                END JOURNEY
             </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Main Gauges */}
          <div className="lg:col-span-2 grid md:grid-cols-2 gap-8">
            {/* CAR SOC GAUGE */}
            <HUDCard title="VEHICLE ENERGY SYSTEM" icon={<Zap className="text-[#ffaa44]" />}>
               <div className="flex items-center justify-between mt-6">
                  <div className="relative w-48 h-48">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#ffaa44" strokeWidth="6" 
                              strokeDasharray={`${soc * 2.82} 282`} strokeLinecap="round" 
                              style={{ transition: "all 1s ease" }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                       <span className="text-5xl font-black">{soc}%</span>
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Charge</span>
                    </div>
                  </div>
                  <div className="space-y-4 flex-1 ml-10">
                     <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Est. Range</div>
                        <div className="text-2xl font-black text-white">{Math.round(soc * 4.2)} <span className="text-xs text-slate-500 font-normal">km</span></div>
                     </div>
                     <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Consumption</div>
                        <div className="text-2xl font-black text-white">142 <span className="text-xs text-slate-500 font-normal">Wh/km</span></div>
                     </div>
                  </div>
               </div>
            </HUDCard>

            {/* HUMAN HSS GAUGE */}
            <HUDCard title="BIOLOGICAL MONITORING" icon={<Brain className="text-[#00ff9d]" />}>
               <div className="flex items-center justify-between mt-6">
                  <div className="relative w-48 h-48">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                      <circle cx="50" cy="50" r="45" fill="none" stroke={hssColor} strokeWidth="6" 
                              strokeDasharray={`${hss * 2.82} 282`} strokeLinecap="round" 
                              style={{ transition: "all 1s ease", filter: `drop-shadow(0 0 8px ${hssColor})` }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                       <span className="text-5xl font-black" style={{ color: hssColor }}>{hss}</span>
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Focus Score</span>
                    </div>
                  </div>
                  <div className="space-y-4 flex-1 ml-10">
                     <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Status</div>
                        <div className="text-lg font-black" style={{ color: hssColor }}>{hss > 85 ? 'OPTIMAL' : hss > 70 ? 'FATIGUE_WARING' : 'CRITICAL_STOP'}</div>
                     </div>
                     <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Jerk Detected</div>
                        <div className="text-2xl font-black text-white">0.42 <span className="text-xs text-slate-500 font-normal">g</span></div>
                     </div>
                  </div>
               </div>
            </HUDCard>
          </div>

          {/* Sidebar Recommendations */}
          <div className="space-y-8">
             <HUDCard title="SYNCHRONIZED STOP" icon={<TrendingUp className="text-[#ff6b1a]" />}>
                <div className="mt-6 p-6 rounded-3xl bg-gradient-to-br from-[#ff6b1a]/20 to-transparent border border-[#ff6b1a]/30">
                   <div className="flex items-center gap-3 mb-4">
                      <MapPin className="text-[#ff6b1a] w-6 h-6" />
                      <div>
                        <h3 className="text-lg font-black">Cyber Hub Hyper-charger</h3>
                        <p className="text-[10px] font-bold text-[#ff6b1a] tracking-widest uppercase">Recommended in 12km</p>
                      </div>
                   </div>
                   <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                     Your battery will reach 12% and your HSS score is projected to drop below 75 in the next 15 minutes. 
                     We suggest a 20-minute break here.
                   </p>
                   <button className="w-full py-4 bg-[#ff6b1a] text-white rounded-xl font-black text-xs tracking-widest shadow-lg shadow-[#ff6b1a]/20 hover:brightness-110 transition-all">
                      NAVIGATE TO HUB
                   </button>
                </div>
             </HUDCard>

             <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                   <Info className="w-3 h-3" /> Trip Insights
                </h3>
                <div className="space-y-4">
                   <InsightRow label="Smoothness Index" value="92/100" />
                   <InsightRow label="Eco-Score" value="+12%" />
                   <InsightRow label="Grid Efficiency" value="Optimal" />
                </div>
             </div>
          </div>

        </div>

      </div>
    </div>
  );
}

function HUDCard({ title, icon, children }: any) {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-[40px] p-8 relative overflow-hidden">
       <div className="flex items-center gap-3 mb-2">
          {icon}
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</h2>
       </div>
       {children}
    </div>
  );
}

function InsightRow({ label, value }: any) {
  return (
    <div className="flex justify-between items-center text-xs">
       <span className="text-slate-400">{label}</span>
       <span className="text-white font-bold">{value}</span>
    </div>
  );
}
