"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Zap, MapPin, Clock, ChevronRight, Battery,
} from "lucide-react";

const STATS = [
  { label: "Charging Stations", value: "5,000+", icon: Zap },
  { label: "Cities Covered", value: "120+", icon: MapPin },
  { label: "EVs Served", value: "2.4L+", icon: Battery },
  { label: "Avg Wait Saved", value: "18 min", icon: Clock },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--dark-bg)" }}>
      {/* ── Hero + Stats ──────────────────────────────────── */}
      <section className="relative pt-24 pb-20 px-6 overflow-hidden min-h-screen flex flex-col justify-center">
        <div className="hero-gradient absolute inset-0 pointer-events-none" />

        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,255,157,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,157,0.1) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6"
              style={{
                background: "rgba(255,107,26,0.1)",
                border: "1px solid rgba(255,107,26,0.3)",
                color: "#ff6b1a",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff6b1a] animate-pulse" />
              Live across 120+ Indian cities
            </span>

            <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
              <span className="text-white">India&apos;s EV Charging</span>
              <br />
              <span className="gradient-text">Journey OS</span>
            </h1>

            <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
              Not just a locator. GatiCharge uses physics-based range prediction,
              human fatigue monitoring, and passenger-aware planning to power 
              your next adventure.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/dashboard">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  className="btn-primary flex items-center gap-2 text-base"
                >
                  Launch Dashboard
                  <ChevronRight className="w-5 h-5" />
                </motion.button>
              </Link>
              <Link href="/stations">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  className="btn-secondary flex items-center gap-2 text-base"
                >
                  <MapPin className="w-5 h-5" />
                  Find Stations
                </motion.button>
              </Link>
            </div>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-20"
          >
            {STATS.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  whileHover={{ scale: 1.03 }}
                  className="stat-card p-6 text-center"
                  transition={{ delay: i * 0.1 }}
                >
                  <Icon className="w-6 h-6 mx-auto mb-2" style={{ color: "#ff6b1a" }} />
                  <div className="text-2xl font-black text-white">{stat.value}</div>
                  <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>
    </main>
  );
}
