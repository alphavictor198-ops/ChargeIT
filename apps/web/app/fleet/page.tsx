"use client";

import { useState } from "react";
import { 
  Truck, Battery, Brain, Navigation, 
  Search, Filter, MoreVertical, ShieldCheck,
  AlertTriangle, Clock, MapPin
} from "lucide-react";

const FLEET_VEHICLES = [
  { id: "FL-001", model: "Tata Nexon EV", driver: "Arjun S.", soc: 82, hss: 94, status: "Driving", location: "NH-48, Gurgaon", eta: "12m" },
  { id: "FL-002", model: "Hyundai Kona", driver: "Priya M.", soc: 15, hss: 88, status: "Critical SoC", location: "Cyber City", eta: "Searching" },
  { id: "FL-003", model: "MG ZS EV", driver: "Rahul K.", soc: 65, hss: 62, status: "Fatigued", location: "Sector 56", eta: "Stop Suggested" },
  { id: "FL-004", model: "Tata Xpres-T", driver: "Vikram R.", soc: 45, hss: 98, status: "Driving", location: "MG Road", eta: "25m" },
  { id: "FL-005", model: "Mahindra XUV400", driver: "Sneha L.", soc: 92, hss: 91, status: "Charging", location: "Ambience Mall", eta: "Full in 15m" },
];

export default function FleetPage() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="min-h-screen pt-20 p-6 bg-[#060b18]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              <Truck className="text-[#ff6b1a] w-8 h-8" />
              Fleet Command Center
            </h1>
            <p className="text-slate-400 mt-1">Real-time Telemetry & Safety Monitoring for 12 Active Units</p>
          </div>
          
          <div className="flex gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search vehicle or driver..." 
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-[#ff6b1a]/50"
              />
            </div>
            <button className="bg-white/5 p-2 rounded-xl border border-white/10 text-white">
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Fleet Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <FleetStat label="Total Vehicles" value="12" sub="8 Active | 4 Idle" icon={<Truck />} color="#ff6b1a" />
          <FleetStat label="Avg. SOC Level" value="64%" sub="Optimal" icon={<Battery />} color="#00ff9d" />
          <FleetStat label="Fleet Safety Index" value="91.2" sub="Above Target" icon={<ShieldCheck />} color="#00d4ff" />
          <FleetStat label="Alerts" value="2" sub="1 Fatigue | 1 Low Bat" icon={<AlertTriangle />} color="#ef4444" />
        </div>

        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Navigation className="w-5 h-5 text-[#ff6b1a]" /> Live Unit Tracking
        </h2>

        {/* Vehicle Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FLEET_VEHICLES.map((v) => (
            <div key={v.id} className="glass-card p-6 bg-white/[0.03] border-white/5 rounded-2xl border relative overflow-hidden group">
              {/* Status Indicator */}
              <div className={`absolute top-0 right-0 px-4 py-1.5 text-[10px] font-black uppercase rounded-bl-xl ${
                v.status === 'Fatigued' ? 'bg-red-500/20 text-red-500' : 
                v.status === 'Critical SoC' ? 'bg-amber-500/20 text-amber-500' : 
                'bg-[#00ff9d]/20 text-[#00ff9d]'
              }`}>
                {v.status}
              </div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-xs font-bold text-slate-500 tracking-widest">{v.id}</div>
                  <div className="text-xl font-black text-white">{v.model}</div>
                  <div className="text-sm text-slate-400 mt-1 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500" /> {v.driver}
                  </div>
                </div>
                <button className="text-slate-500 hover:text-white p-1">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-slate-500 uppercase">
                    <Battery className={`w-3 h-3 ${v.soc < 20 ? 'text-red-500' : 'text-[#00ff9d]'}`} /> Charge
                  </div>
                  <div className={`text-xl font-black ${v.soc < 20 ? 'text-red-500' : 'text-white'}`}>{v.soc}%</div>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-slate-500 uppercase">
                    <Brain className={`w-3 h-3 ${v.hss < 70 ? 'text-red-500' : 'text-[#00d4ff]'}`} /> Driver HSS
                  </div>
                  <div className={`text-xl font-black ${v.hss < 70 ? 'text-red-500' : 'text-white'}`}>{v.hss}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span className="truncate">{v.location}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>ETA: {v.eta}</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-white/5 flex gap-2">
                <button className="flex-1 py-2 rounded-lg bg-white/5 text-white text-[10px] font-bold border border-white/10 hover:bg-white/10 transition-all">
                  VIEW TELEMETRY
                </button>
                <button className="flex-1 py-2 rounded-lg bg-[#ff6b1a]/10 text-[#ff6b1a] text-[10px] font-bold border border-[#ff6b1a]/20 hover:bg-[#ff6b1a]/20 transition-all">
                  OPTIMIZE ROUTE
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FleetStat({ label, value, sub, icon, color }: any) {
  return (
    <div className="glass-card p-5 bg-white/[0.03] border-white/5 rounded-2xl border">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 rounded-lg" style={{ background: `${color}15`, color }}>{icon}</div>
        <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">{label}</span>
      </div>
      <div className="text-3xl font-black text-white mb-1">{value}</div>
      <div className="text-[10px] font-medium text-slate-500">{sub}</div>
    </div>
  );
}
