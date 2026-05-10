"use client";

import { useMapStore, Station } from "@/store/mapStore";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, MapPin, Shield, Clock, ChevronRight, CheckCircle } from "lucide-react";
import Link from "next/link";

function TrustBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.7 ? "#00ff9d" : score >= 0.4 ? "#fbbf24" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "#1a2744" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-semibold" style={{ color }}>{pct}%</span>
    </div>
  );
}

function StationCard({ station }: { station: Station }) {
  const { setSelectedStation, selectedStation } = useMapStore();
  const isSelected = selectedStation?.id === station.id;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => setSelectedStation(isSelected ? null : station)}
      className="p-3 rounded-xl cursor-pointer transition-all"
      style={{
        background: isSelected ? "rgba(0,255,157,0.08)" : "rgba(13,21,38,0.6)",
        border: `1px solid ${isSelected ? "rgba(0,255,157,0.4)" : "rgba(26,39,68,0.8)"}`,
        marginBottom: 8,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-white truncate">{station.name}</div>
          {station.city && (
            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" />
              {station.city}, {station.state}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              background: station.available_slots > 0 ? "rgba(0,255,157,0.15)" : "rgba(239,68,68,0.15)",
              color: station.available_slots > 0 ? "#00ff9d" : "#ef4444",
            }}
          >
            {station.available_slots}/{station.total_slots}
          </span>
          {station.distance_km && (
            <span className="text-xs text-slate-500">{station.distance_km.toFixed(1)}km</span>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {station.charger_types.slice(0, 2).map((t) => (
          <span
            key={t}
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: "#1a2744", color: "#94a3b8" }}
          >
            {t.replace("_", " ").toUpperCase()}
          </span>
        ))}
        <span className="text-xs text-[#00d4ff] ml-auto">{station.max_power_kw}kW</span>
      </div>

      <div className="mt-2">
        <TrustBar score={station.trust_score} />
      </div>

      {station.is_verified && (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-[#00ff9d]">
          <CheckCircle className="w-3 h-3" />
          Verified
        </div>
      )}
    </motion.div>
  );
}

export default function StationPanel() {
  const { stations, selectedStation, isLoadingStations } = useMapStore();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[#1a2744]">
        <h2 className="font-bold text-white">Nearby Stations</h2>
        <p className="text-xs text-slate-500 mt-1">{stations.length} found in radius</p>
      </div>

      {/* Selected station detail */}
      <AnimatePresence>
        {selectedStation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-[#1a2744]"
          >
            <div className="p-4" style={{ background: "rgba(0,255,157,0.04)" }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-[#00ff9d] text-sm">{selectedStation.name}</h3>
                <span className={`text-xs font-bold ${selectedStation.is_open ? "text-[#00ff9d]" : "text-[#ef4444]"}`}>
                  {selectedStation.is_open ? "OPEN" : "CLOSED"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center">
                  <div className="text-lg font-black text-white">{selectedStation.available_slots}</div>
                  <div className="text-xs text-slate-500">Available</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-black text-white">{selectedStation.max_power_kw}</div>
                  <div className="text-xs text-slate-500">Max kW</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-black" style={{
                    color: selectedStation.trust_score >= 0.7 ? "#00ff9d" : "#fbbf24"
                  }}>
                    {Math.round(selectedStation.trust_score * 100)}%
                  </div>
                  <div className="text-xs text-slate-500">Trust</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Link href={`/route-planner?destName=${encodeURIComponent(selectedStation.name)}&destLat=${selectedStation.lat}&destLng=${selectedStation.lng}`} className="flex-1">
                  <button className="btn-primary w-full text-xs py-2">Plan Route</button>
                </Link>
                <Link href={`/stations/${selectedStation.id}`}>
                  <button className="btn-secondary text-xs py-2 px-3">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Station list */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoadingStations ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl shimmer" />
            ))}
          </div>
        ) : stations.length === 0 ? (
          <div className="text-center py-12">
            <Zap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No stations found.</p>
            <p className="text-slate-600 text-xs mt-1">Try expanding the radius.</p>
          </div>
        ) : (
          <div>
            {stations.map((station) => (
              <StationCard key={station.id} station={station} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
