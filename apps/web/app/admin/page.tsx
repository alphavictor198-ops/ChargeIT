"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  BarChart3, Settings, Shield, Activity, 
  Map as MapIcon, Users, DollarSign, Zap,
  TrendingUp, AlertCircle, CheckCircle2
} from "lucide-react";

const STATIONS = [
  { id: "1", name: "Cyber Hub Supercharger", status: "Active", power: "120kW", usage: "82%", price: "18.5" },
  { id: "2", name: "Sector 29 Hyperbolt", status: "Warning", power: "150kW", usage: "95%", price: "22.0" },
  { id: "3", name: "MG Road FastCharge", status: "Active", power: "60kW", usage: "45%", price: "15.0" },
  { id: "4", name: "Golf Course Rd Ultra", status: "Active", power: "240kW", usage: "12%", price: "28.5" },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen pt-20 p-6 bg-[#060b18]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              <Shield className="text-[#00ff9d] w-8 h-8" />
              CPO Admin Panel
            </h1>
            <p className="text-slate-400 mt-1">Charge Point Operator Control & Infrastructure Monitoring</p>
          </div>
          <div className="flex gap-2">
            <button className="bg-[#00ff9d]/10 text-[#00ff9d] px-4 py-2 rounded-lg border border-[#00ff9d]/20 text-sm font-bold flex items-center gap-2">
              <Activity className="w-4 h-4" /> Live Ops
            </button>
            <button className="bg-white/5 text-white px-4 py-2 rounded-lg border border-white/10 text-sm font-bold flex items-center gap-2">
              <Settings className="w-4 h-4" /> Config
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard icon={<DollarSign />} label="Daily Revenue" value="₹42,850" trend="+12.5%" color="#00ff9d" />
          <StatCard icon={<Zap />} label="Energy Delivered" value="1.2 MWh" trend="+5.2%" color="#00d4ff" />
          <StatCard icon={<Users />} label="Active Sessions" value="128" trend="+18%" color="#8b5cf6" />
          <StatCard icon={<TrendingUp />} label="Grid Load" value="72%" trend="Stable" color="#f59e0b" />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Station Management */}
          <div className="lg:col-span-2 glass-card p-6 bg-white/[0.03] border-white/5 rounded-2xl border">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <MapIcon className="w-5 h-5 text-[#00ff9d]" /> Station Infrastructure
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-500 text-xs uppercase tracking-widest border-b border-white/5">
                    <th className="pb-4">Station Name</th>
                    <th className="pb-4">Status</th>
                    <th className="pb-4">Usage</th>
                    <th className="pb-4">Base Price</th>
                    <th className="pb-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {STATIONS.map((s) => (
                    <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 font-bold text-white">{s.name}</td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${
                          s.status === 'Active' ? 'bg-[#00ff9d]/10 text-[#00ff9d]' : 'bg-amber-500/10 text-amber-500'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="py-4 text-slate-300">{s.usage}</td>
                      <td className="py-4 text-[#00d4ff] font-bold">₹{s.price}/u</td>
                      <td className="py-4 text-right">
                        <button className="text-xs text-slate-500 hover:text-white font-bold">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Demand Prediction */}
          <div className="glass-card p-6 bg-white/[0.03] border-white/5 rounded-2xl border">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#8b5cf6]" /> AI Demand Insights
            </h2>
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-400">Peak Demand Forecast</span>
                  <span className="text-xs font-bold text-[#8b5cf6]">HIGH (18:00 - 21:00)</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#8b5cf6] to-[#d946ef]" style={{ width: '85%' }} />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pricing Strategy</h3>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#00ff9d]/5 border border-[#00ff9d]/10">
                  <CheckCircle2 className="w-5 h-5 text-[#00ff9d]" />
                  <p className="text-xs text-slate-300">AI suggests +₹2.5 increase for Sector 29 to balance grid load.</p>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <p className="text-xs text-slate-300">Cyber Hub vacancy rising. Consider 10% discount to attract users.</p>
                </div>
              </div>

              <button className="w-full py-4 bg-[#8b5cf6] text-white rounded-xl font-black text-sm tracking-widest hover:brightness-110 transition-all shadow-lg shadow-[#8b5cf6]/20">
                APPLY AI PRICING
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend, color }: any) {
  return (
    <div className="glass-card p-5 bg-white/[0.03] border-white/5 rounded-2xl border">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg" style={{ background: `${color}15`, color }}>{icon}</div>
        <span className="text-xs font-bold text-slate-500 tracking-widest uppercase">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <div className="text-2xl font-black text-white">{value}</div>
        <div className="text-[10px] font-black" style={{ color }}>{trend}</div>
      </div>
    </div>
  );
}
