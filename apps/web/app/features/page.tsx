"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Zap, Battery, Navigation, Clock, Shield, TrendingUp,
  Cpu, Bluetooth, MapPin, BarChart3, Gauge, Thermometer,
  ChevronRight, ArrowRight,
} from "lucide-react";

const FEATURES = [
  {
    icon: Battery,
    title: "Physics-Based Range Engine",
    desc: "Full energy model using aerodynamic drag (Cd × A × v³), rolling resistance, gradient forces, and HVAC thermal load — not marketing estimates.",
    color: "#00ff9d",
    details: [
      "Vehicle-specific Cd, frontal area, mass, Cr profiles",
      "Temperature-dependent efficiency (cold/hot penalty)",
      "Speed-cubed aerodynamic loss at highway speeds",
      "HVAC power draw proportional to ΔT from 22°C",
    ],
  },
  {
    icon: Navigation,
    title: "A* Route Optimizer",
    desc: "Greedy A* graph search over 39 real Indian highway charging hubs. Minimizes total trip time including charging and wait.",
    color: "#00d4ff",
    details: [
      "Haversine + 1.22× road factor for Indian highways",
      "Selects furthest reachable hub with highest trust score",
      "Charges to 80% (optimal Li-ion health zone)",
      "Warns when segments are infeasible at current SOC",
    ],
  },
  {
    icon: Clock,
    title: "Erlang-C Wait Prediction",
    desc: "Queuing theory calculates your probability of waiting and expected wait time — before you drive there.",
    color: "#8b5cf6",
    details: [
      "Models arrival rate λ and service rate μ per station",
      "Computes P(wait > 0) using Erlang-C formula",
      "Factors number of chargers (c) and utilization (ρ)",
      "Live updates from station occupancy patterns",
    ],
  },
  {
    icon: Shield,
    title: "Bayesian Trust Scores",
    desc: "Every station gets a β-distribution trust score derived from user reports, verification age, and uptime history.",
    color: "#f59e0b",
    details: [
      "Beta conjugate model: α (positive) + β (negative)",
      "Time-decay: negative reports decay 4× faster",
      "Verification date boosts score by up to 0.25",
      "Output: normalized score ∈ [0, 1]",
    ],
  },
  {
    icon: TrendingUp,
    title: "Monte Carlo Confidence",
    desc: "500+ probabilistic simulations with Gaussian noise on speed, traffic, temperature, and elevation give you a real confidence interval.",
    color: "#ec4899",
    details: [
      "Speed noise σ = 8%, traffic σ = 15%",
      "Temperature σ = 2°C, elevation σ = 10%",
      "Returns p5 / p25 / p50 / p75 / p95 percentiles",
      "Failure probability (SOC ≤ 0%) clearly shown",
    ],
  },
  {
    icon: Cpu,
    title: "On-Device Physics",
    desc: "Entire physics engine runs in your browser — instant slider response, no API latency. Backend call available for full confidence intervals.",
    color: "#10b981",
    details: [
      "Client-side TypeScript mirror of backend Python model",
      "Works fully offline / in demo mode",
      "Live power breakdown: rolling + aero + gradient + HVAC",
      "Instant range update as you drag speed/temp sliders",
    ],
  },
  {
    icon: Bluetooth,
    title: "Vehicle Connect (BLE / WiFi)",
    desc: "Connect your EV via Web Bluetooth or WiFi OBD2 adapter for live telemetry — SOC, speed, battery temp, power draw.",
    color: "#06b6d4",
    details: [
      "Web Bluetooth API for BLE OBD2 adapters (ELM327)",
      "WiFi OBD2 at standard 192.168.4.1:35000",
      "1-second refresh rate for live dashboard",
      "Simulated feed available without real vehicle",
    ],
  },
  {
    icon: MapPin,
    title: "Multi-Source Station Data",
    desc: "Three-tier data waterfall: GatiCharge backend → Open Charge Map → curated verified dataset. Guaranteed results.",
    color: "#f97316",
    details: [
      "70+ curated Indian stations with verified GPS",
      "Overpass API for OpenStreetMap (free, no key)",
      "Open Charge Map (45k+ Indian POIs with API key)",
      "Haversine distance sort + charger type filtering",
    ],
  },
];

const VEHICLES = [
  { name: "Tata Nexon EV",  battery: "37.5 kWh", eff: "155 Wh/km", charge: "50 kW",  mass: "1580 kg", emoji: "🚗" },
  { name: "Tata Tiago EV",  battery: "21.5 kWh", eff: "115 Wh/km", charge: "25 kW",  mass: "1175 kg", emoji: "🚙" },
  { name: "MG ZS EV",       battery: "46.8 kWh", eff: "175 Wh/km", charge: "76 kW",  mass: "1620 kg", emoji: "🚘" },
  { name: "BYD Atto 3",     battery: "56.6 kWh", eff: "165 Wh/km", charge: "88 kW",  mass: "1750 kg", emoji: "🛻" },
];

export default function FeaturesPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--dark-bg)" }}>
      {/* Hero */}
      <section className="pt-20 pb-16 px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4">
            Intelligence, Not Just a <span className="gradient-text">Locator</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-3xl mx-auto">
            Eight layers of real-world EV science power every decision on GatiCharge —
            from physics-based range to Bayesian trust scores.
          </p>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="px-6 pb-20">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-6">
          {FEATURES.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="glass-card p-6 hover:scale-[1.01] transition-transform"
                style={{ borderColor: `${feat.color}22` }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${feat.color}18` }}>
                    <Icon className="w-6 h-6" style={{ color: feat.color }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">{feat.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-3">{feat.desc}</p>
                    <ul className="space-y-1.5">
                      {feat.details.map((d) => (
                        <li key={d} className="flex items-start gap-2 text-xs text-slate-500">
                          <ArrowRight className="w-3 h-3 shrink-0 mt-0.5" style={{ color: feat.color }} />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Supported Vehicles */}
      <section className="px-6 pb-20">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">Optimized for Indian EVs</h2>
            <p className="text-slate-400">Accurate physics profiles for every vehicle — drag, mass, rolling resistance, HVAC.</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {VEHICLES.map((v, i) => (
              <motion.div
                key={v.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="stat-card p-6 text-center"
              >
                <div className="text-4xl mb-3">{v.emoji}</div>
                <h3 className="font-bold text-white text-sm mb-2">{v.name}</h3>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Battery</span><span className="text-[#00ff9d] font-semibold">{v.battery}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Efficiency</span><span className="text-[#00d4ff] font-semibold">{v.eff}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Max Charge</span><span className="text-[#8b5cf6] font-semibold">{v.charge}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Mass</span><span className="text-white">{v.mass}</span></div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="glass-card neon-border p-10 text-center relative overflow-hidden">
            <div className="hero-gradient absolute inset-0 pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-3">Try it now — no signup needed</h2>
              <p className="text-slate-400 mb-6">Route Planner, Station Map, and Dashboard all work in demo mode.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/route-planner">
                  <motion.button whileHover={{ scale: 1.05 }} className="btn-primary text-sm flex items-center gap-2">
                    <Navigation className="w-4 h-4" />Plan a Route
                  </motion.button>
                </Link>
                <Link href="/stations">
                  <motion.button whileHover={{ scale: 1.03 }} className="btn-secondary text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4" />Find Stations
                  </motion.button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

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
