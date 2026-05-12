"use client";

import { useState, useMemo } from "react";
import { stationStore, StationData } from "@/lib/stationStore";
import { Zap, MapPin, Clock, Navigation, Search, Filter } from "lucide-react";
import Link from "next/link";

export default function StationsPage() {
  const [allStations] = useState<StationData[]>(stationStore.getStations());
  const [capFilter, setCapFilter] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<StationData | null>(null);

  const filteredStations = useMemo(() => {
    let result = allStations;
    if (capFilter) result = result.filter(s => s.maxPowerKw >= capFilter);
    if (typeFilter) result = result.filter(s => s.name.includes(typeFilter) || Math.random() > 0.5);
    return result;
  }, [capFilter, typeFilter, allStations]);

  return (
    <div className="min-h-screen pt-20 p-4 md:p-8 bg-[#060b18]">
      <div className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-120px)]">
        
        {/* Filter Banner */}
        <div className="flex flex-wrap gap-3 mb-6 p-4 bg-white/[0.03] border border-white/5 rounded-2xl">
          <div className="flex items-center gap-2 mr-4 border-r border-white/10 pr-4">
            <Filter className="w-4 h-4 text-[#00ff9d]" />
            <span className="text-xs font-bold text-white uppercase tracking-widest">Filters</span>
          </div>
          
          <FilterChip active={capFilter === 50} onClick={() => setCapFilter(capFilter === 50 ? null : 50)}>⚡ 50kW+</FilterChip>
          <FilterChip active={capFilter === 100} onClick={() => setCapFilter(capFilter === 100 ? null : 100)}>🚀 100kW+</FilterChip>
          <FilterChip active={typeFilter === 'CCS2'} onClick={() => setTypeFilter(typeFilter === 'CCS2' ? null : 'CCS2')}>🔌 CCS2</FilterChip>
          <FilterChip active={typeFilter === 'Type2'} onClick={() => setTypeFilter(typeFilter === 'Type2' ? null : 'Type2')}>🔋 Type-2</FilterChip>
        </div>

        <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
          {/* Station List */}
          <div className="w-full md:w-96 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
            {filteredStations.map(st => (
              <div 
                key={st.id} 
                onClick={() => setSelectedStation(st)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                  selectedStation?.id === st.id 
                  ? 'bg-[#00ff9d]/10 border-[#00ff9d]/50 ring-1 ring-[#00ff9d]/50' 
                  : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-white">{st.name}</h3>
                  <span className="text-[10px] font-black text-[#00ff9d] bg-[#00ff9d]/10 px-2 py-1 rounded uppercase">
                    {st.maxPowerKw}kW
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-4 truncate">{st.address}</p>
                <div className="flex justify-between items-center">
                  <div className="flex gap-3 text-[10px] font-bold text-slate-500 uppercase">
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {st.availableSlots}/{st.totalSlots}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {st.waitTimeMins}m</span>
                  </div>
                  <span className="text-sm font-black text-white">₹{st.pricePerKwh}/u</span>
                </div>
              </div>
            ))}
          </div>

          {/* Map Section (Simulation) */}
          <div className="flex-1 bg-white/[0.03] border border-white/5 rounded-3xl relative overflow-hidden group">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
              <MapPin className="w-64 h-64 text-[#00ff9d] blur-3xl" />
            </div>
            
            {/* Selected Station Card Overlay */}
            {selectedStation && (
              <div className="absolute bottom-8 left-8 right-8 md:right-auto md:w-[400px] bg-[#0d1526]/95 backdrop-blur-xl p-6 rounded-3xl border border-[#00ff9d]/30 shadow-2xl shadow-black animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-black text-white">{selectedStation.name}</h2>
                    <p className="text-sm text-slate-400 mt-1">{selectedStation.address}</p>
                  </div>
                  <div className="bg-[#00ff9d]/10 p-3 rounded-2xl text-[#00ff9d] border border-[#00ff9d]/20">
                    <Zap className="w-6 h-6" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-white/5 p-3 rounded-2xl text-center">
                    <div className="text-xl font-black text-white">{selectedStation.availableSlots}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Available</div>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl text-center">
                    <div className="text-xl font-black text-white">{selectedStation.maxPowerKw}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Max kW</div>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl text-center">
                    <div className="text-xl font-black text-[#ffaa44]">{selectedStation.waitTimeMins}m</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Wait</div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Link href={`/booking?id=${selectedStation.id}`} className="flex-1">
                    <button className="w-full py-4 bg-[#00ff9d] text-[#060b18] rounded-xl font-black text-sm tracking-widest hover:brightness-110 transition-all shadow-lg shadow-[#00ff9d]/20">
                      SECURE SLOT
                    </button>
                  </Link>
                  <button className="p-4 bg-white/5 text-white rounded-xl border border-white/10 hover:bg-white/10 transition-all">
                    <Navigation className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Static Map Background Mockup */}
            <div className="absolute inset-0 bg-[url('https://carto.com/blog/img/posts/2017/2017-07-06-how-to-design-dark-maps/dark-map-styles.png')] bg-cover opacity-40 mix-blend-luminosity" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ children, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
        active 
        ? 'bg-[#00ff9d]/20 text-[#00ff9d] border-[#00ff9d]/50' 
        : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}
