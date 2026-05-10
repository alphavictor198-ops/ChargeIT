"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { useHistoryStore } from "@/store/historyStore";
import { Clock, Zap, MapPin, Activity, User, Calendar, Navigation, BatteryCharging } from "lucide-react";
import { useRouter } from "next/navigation";

export default function HistoryPage() {
  const { user, isAuthenticated } = useAuthStore();
  const { chargings, trips } = useHistoryStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (useAuthStore.persist.hasHydrated() && !isAuthenticated()) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, router]);

  if (!mounted || !user) return <div className="min-h-screen pt-20 px-6 flex justify-center text-white">Loading...</div>;

  const initials = user.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  // Use a simulated last login time (e.g. 5 mins ago) or retrieve from real auth info
  const lastLogin = new Date(Date.now() - 5 * 60000).toLocaleString();

  return (
    <main className="min-h-screen pb-16" style={{ background: "var(--dark-bg)" }}>
      {/* Header Profile Section */}
      <div className="pt-24 pb-10 px-6 border-b border-[#1a2744] bg-[#060b18]/50">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-[#060b18] shrink-0 shadow-[0_0_20px_rgba(0,255,157,0.3)]"
            style={{ background: "linear-gradient(135deg, #00ff9d, #00d4ff)" }}>
            {initials}
          </div>
          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl font-black text-white">{user.name}</h1>
            <p className="text-slate-400 mt-1 flex items-center justify-center md:justify-start gap-2">
              <User className="w-4 h-4" /> {user.email}
            </p>
            <p className="text-slate-500 mt-1 text-sm flex items-center justify-center md:justify-start gap-2">
              <Clock className="w-4 h-4" /> Last login: {lastLogin}
            </p>
          </div>
          <div className="flex gap-4">
            <div className="glass-card p-4 rounded-xl text-center min-w-[120px]">
              <div className="text-2xl font-bold text-[#00ff9d]">{trips.length}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Total Trips</div>
            </div>
            <div className="glass-card p-4 rounded-xl text-center min-w-[120px]">
              <div className="text-2xl font-bold text-[#00d4ff]">{chargings.length}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Charge Sessions</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Past Trips Column */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Navigation className="w-5 h-5 text-[#8b5cf6]" />
            Past Trips & Analytics
          </h2>
          <div className="space-y-4">
            {trips.length === 0 ? (
              <p className="text-slate-500 italic">No trips recorded yet.</p>
            ) : trips.map((trip) => (
              <div key={trip.id} className="glass-card p-5 rounded-xl hover:border-[#1a2744] transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {trip.origin} <span className="text-slate-500">→</span> {trip.destination}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {new Date(trip.date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="bg-[#1a2744] text-[#00ff9d] px-2.5 py-1 rounded-md text-xs font-semibold">
                    {trip.vehicle}
                  </span>
                </div>
                
                {/* Trip Analytics Grid */}
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-[#1a2744]/50">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase">Distance</span>
                    <span className="text-sm font-medium text-white">{trip.distanceKm} km</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase">Duration</span>
                    <span className="text-sm font-medium text-white">{(trip.durationMin / 60).toFixed(1)} hrs</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase">Energy Used</span>
                    <span className="text-sm font-medium text-[#00d4ff] flex items-center gap-1">
                      <Zap className="w-3 h-3" /> {trip.energyKwh.toFixed(1)} kWh
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase">Avg Efficiency</span>
                    <span className="text-sm font-medium text-[#00ff9d] flex items-center gap-1">
                      <Activity className="w-3 h-3" /> {trip.efficiency.toFixed(0)} Wh/km
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Past Chargings Column */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <BatteryCharging className="w-5 h-5 text-[#00d4ff]" />
            Past Charging Sessions
          </h2>
          <div className="space-y-4">
            {chargings.length === 0 ? (
              <p className="text-slate-500 italic">No charging sessions recorded yet.</p>
            ) : chargings.map((session) => (
              <div key={session.id} className="glass-card p-5 rounded-xl hover:border-[#1a2744] transition-all flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#00d4ff]" /> {session.stationName}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {new Date(session.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {session.durationMin} mins
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-[#00ff9d]">+{session.energyKwh.toFixed(1)} kWh</div>
                  <div className="text-sm text-slate-400 mt-1">₹{session.costInr.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </main>
  );
}
