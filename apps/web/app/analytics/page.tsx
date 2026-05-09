"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Zap, TrendingUp, MapPin, Battery, Clock, Users,
  BarChart3, Activity, Gauge, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

// Simulated platform analytics (would come from backend /admin/stats in production)
const PLATFORM_STATS = [
  { label: "Active Users", value: "24,832", change: "+12.4%", up: true, icon: Users, color: "#00ff9d" },
  { label: "Sessions Today", value: "3,141", change: "+8.7%", up: true, icon: Activity, color: "#00d4ff" },
  { label: "Routes Planned", value: "1,847", change: "+23.1%", up: true, icon: TrendingUp, color: "#8b5cf6" },
  { label: "Avg Wait Saved", value: "18.2 min", change: "-2.1 min", up: true, icon: Clock, color: "#f59e0b" },
];

// City-level station analytics
const CITY_DATA = [
  { city: "Delhi",     stations: 487, dcFast: 312, utilization: 78, avgWait: 12, growth: 34 },
  { city: "Mumbai",    stations: 423, dcFast: 278, utilization: 82, avgWait: 15, growth: 28 },
  { city: "Bangalore", stations: 391, dcFast: 256, utilization: 71, avgWait: 8,  growth: 42 },
  { city: "Hyderabad", stations: 298, dcFast: 187, utilization: 65, avgWait: 10, growth: 38 },
  { city: "Pune",      stations: 267, dcFast: 178, utilization: 73, avgWait: 11, growth: 31 },
  { city: "Chennai",   stations: 234, dcFast: 156, utilization: 68, avgWait: 9,  growth: 36 },
  { city: "Ahmedabad", stations: 198, dcFast: 134, utilization: 61, avgWait: 7,  growth: 45 },
  { city: "Kolkata",   stations: 176, dcFast: 112, utilization: 58, avgWait: 6,  growth: 52 },
  { city: "Indore",    stations: 45,  dcFast: 28,  utilization: 54, avgWait: 5,  growth: 67 },
  { city: "Jaipur",    stations: 89,  dcFast: 56,  utilization: 62, avgWait: 8,  growth: 41 },
];

// Hourly demand pattern (typical Indian city)
const HOURLY_DEMAND = [
  { hour: "6am",  demand: 15 },
  { hour: "8am",  demand: 45 },
  { hour: "10am", demand: 62 },
  { hour: "12pm", demand: 78 },
  { hour: "2pm",  demand: 70 },
  { hour: "4pm",  demand: 65 },
  { hour: "6pm",  demand: 85 },
  { hour: "8pm",  demand: 92 },
  { hour: "10pm", demand: 58 },
  { hour: "12am", demand: 25 },
];

const CHARGER_MIX = [
  { type: "AC Slow (≤7.4 kW)",  pct: 28, color: "#64748b" },
  { type: "AC Fast (7.4–22 kW)", pct: 32, color: "#00d4ff" },
  { type: "DC Fast (50–150 kW)", pct: 31, color: "#00ff9d" },
  { type: "DC Ultra (150 kW+)",  pct: 9,  color: "#8b5cf6" },
];

const EV_ADOPTION = [
  { year: "2020", sales: 5000 },
  { year: "2021", sales: 14800 },
  { year: "2022", sales: 47000 },
  { year: "2023", sales: 90400 },
  { year: "2024", sales: 128000 },
  { year: "2025", sales: 195000 },
];

function BarChart({ data, maxVal }: { data: { label: string; value: number }[]; maxVal: number }) {
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((d, i) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
          <motion.div
            className="w-full rounded-t-md"
            style={{ background: "linear-gradient(to top, #00ff9d, #00d4ff)" }}
            initial={{ height: 0 }}
            whileInView={{ height: `${(d.value / maxVal) * 100}%` }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05, duration: 0.5 }}
          />
          <span className="text-[10px] text-slate-600">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [selectedCity, setSelectedCity] = useState("Delhi");
  const cityInfo = CITY_DATA.find(c => c.city === selectedCity)!;

  return (
    <main className="min-h-screen" style={{ background: "var(--dark-bg)" }}>
      <div className="pt-20 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-3xl md:text-4xl font-black text-white flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-[#00ff9d]" />
              Platform Analytics
            </h1>
            <p className="text-slate-400 mt-1">
              India&apos;s EV charging landscape — live metrics, city breakdowns, and growth trends.
            </p>
          </motion.div>

          {/* Platform stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {PLATFORM_STATS.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="glass-card p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${s.color}18` }}>
                      <Icon className="w-5 h-5" style={{ color: s.color }} />
                    </div>
                    <span className={`flex items-center gap-1 text-xs font-semibold ${s.up ? "text-[#00ff9d]" : "text-[#ef4444]"}`}>
                      {s.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {s.change}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-white">{s.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                </motion.div>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {/* ── City Breakdown ──────────────────────────── */}
            <div className="lg:col-span-2 glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-white">City-Level Station Analytics</h2>
                <select
                  value={selectedCity}
                  onChange={e => setSelectedCity(e.target.value)}
                  className="text-xs py-1.5 px-3"
                >
                  {CITY_DATA.map(c => <option key={c.city} value={c.city}>{c.city}</option>)}
                </select>
              </div>

              {/* City detail */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
                {[
                  { label: "Total Stations", val: cityInfo.stations, color: "#00ff9d" },
                  { label: "DC Fast",         val: cityInfo.dcFast,  color: "#00d4ff" },
                  { label: "Utilization",     val: `${cityInfo.utilization}%`, color: "#8b5cf6" },
                  { label: "Avg Wait",        val: `${cityInfo.avgWait} min`, color: "#f59e0b" },
                  { label: "YoY Growth",      val: `+${cityInfo.growth}%`, color: "#10b981" },
                ].map(m => (
                  <div key={m.label} className="text-center p-3 rounded-xl"
                    style={{ background: "rgba(13,21,38,0.6)", border: "1px solid #1a2744" }}>
                    <div className="text-lg font-black" style={{ color: m.color }}>{m.val}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{m.label}</div>
                  </div>
                ))}
              </div>

              {/* City table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1a2744]">
                      {["City", "Stations", "DC Fast", "Utilization", "Avg Wait", "Growth"].map(h => (
                        <th key={h} className="py-2 px-3 text-left text-slate-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CITY_DATA.map(c => (
                      <tr key={c.city}
                        className={`border-b border-[#0d1526] cursor-pointer transition-colors ${c.city === selectedCity ? "bg-[#0d1526]" : "hover:bg-[#0d1526]/50"}`}
                        onClick={() => setSelectedCity(c.city)}>
                        <td className="py-2.5 px-3 font-semibold text-white">{c.city}</td>
                        <td className="py-2.5 px-3 text-slate-300">{c.stations}</td>
                        <td className="py-2.5 px-3 text-[#00d4ff]">{c.dcFast}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-[#1a2744]">
                              <div className="h-full rounded-full" style={{
                                width: `${c.utilization}%`,
                                background: c.utilization > 75 ? "#ef4444" : c.utilization > 60 ? "#fbbf24" : "#00ff9d",
                              }} />
                            </div>
                            <span className="text-slate-400">{c.utilization}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-[#fbbf24]">{c.avgWait} min</td>
                        <td className="py-2.5 px-3 text-[#00ff9d]">+{c.growth}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Charger Mix ────────────────────────────── */}
            <div className="space-y-6">
              <div className="glass-card p-6">
                <h2 className="font-bold text-white mb-4">Charger Type Mix</h2>
                <div className="space-y-3">
                  {CHARGER_MIX.map(c => (
                    <div key={c.type}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">{c.type}</span>
                        <span className="font-semibold" style={{ color: c.color }}>{c.pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#1a2744]">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: c.color }}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${c.pct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.6 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Donut center stat */}
                <div className="mt-5 text-center p-4 rounded-xl" style={{ background: "rgba(0,255,157,0.04)" }}>
                  <div className="text-3xl font-black text-white">5,247</div>
                  <div className="text-xs text-slate-500">Total Chargers Tracked</div>
                </div>
              </div>

              {/* Hourly demand */}
              <div className="glass-card p-6">
                <h2 className="font-bold text-white mb-4">Hourly Demand Pattern</h2>
                <BarChart
                  data={HOURLY_DEMAND.map(h => ({ label: h.hour, value: h.demand }))}
                  maxVal={100}
                />
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <Activity className="w-3.5 h-3.5 text-[#00ff9d]" />
                  Peak: 8–10 PM (post-office commute)
                </div>
              </div>
            </div>
          </div>

          {/* EV Adoption Trend */}
          <div className="glass-card p-6 mb-8">
            <h2 className="font-bold text-white mb-1">India EV 4-Wheeler Sales Growth</h2>
            <p className="text-xs text-slate-500 mb-4">Annual passenger EV registrations (VAHAN data + industry estimates)</p>
            <BarChart
              data={EV_ADOPTION.map(e => ({ label: e.year, value: e.sales }))}
              maxVal={200000}
            />
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-4">
              {EV_ADOPTION.map(e => (
                <div key={e.year} className="text-center">
                  <div className="text-sm font-bold text-white">{(e.sales / 1000).toFixed(1)}k</div>
                  <div className="text-xs text-slate-600">{e.year}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Key Insights */}
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: "⚡", title: "DC Fast Growing 42% YoY", desc: "India's DC fast charger deployment is accelerating — 50 kW+ installations doubled since 2023." },
              { icon: "🏙️", title: "Tier-2 Cities Leading Growth", desc: "Cities like Indore (+67%), Kolkata (+52%), and Ahmedabad (+45%) are outpacing metros in charger rollout." },
              { icon: "📉", title: "Wait Times Dropping", desc: "Average wait at DC fast stations dropped from 28 min to 12 min with intelligent queue management." },
            ].map(ins => (
              <motion.div key={ins.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="glass-card p-5">
                <div className="text-2xl mb-2">{ins.icon}</div>
                <h3 className="font-bold text-white text-sm mb-1">{ins.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{ins.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#1a2744] py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#00ff9d]" />
            <span className="font-bold gradient-text">GatiCharge</span>
            <span className="text-slate-600 text-sm">© 2025</span>
          </Link>
          <p className="text-slate-600 text-sm">Built for India&apos;s EV revolution.</p>
        </div>
      </footer>
    </main>
  );
}
