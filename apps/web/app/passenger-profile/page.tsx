"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Users, Baby, Heart, Shield, ArrowRight, CheckCircle2 } from "lucide-react";

const PROFILES = [
  { id: "solo", label: "Solo", icon: <User />, desc: "Focus mode" },
  { id: "partner", label: "Partner", icon: <Users />, desc: "Standard stops" },
  { id: "infant", label: "Infant", icon: <Baby />, desc: "Frequent soft stops" },
  { id: "elderly", label: "Elderly", icon: <Heart />, desc: "Comfort priority" },
  { id: "pet", label: "Pet", icon: <Shield />, desc: "Quick breaks" },
];

export default function PassengerProfilePage() {
  const [selected, setSelected] = useState<string[]>(["solo"]);
  const router = useRouter();

  const toggle = (id: string) => {
    if (id === "solo") {
      setSelected(["solo"]);
    } else {
      const next = selected.filter(s => s !== "solo");
      if (next.includes(id)) {
        const updated = next.filter(s => s !== id);
        setSelected(updated.length === 0 ? ["solo"] : updated);
      } else {
        setSelected([...next, id]);
      }
    }
  };

  return (
    <div className="min-h-screen pt-24 p-6 bg-[#060b18] flex items-center justify-center">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-white mb-4">Who's travelling?</h1>
          <p className="text-slate-400">GatiCharge adapts charging stops based on your passengers.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
          {PROFILES.map(p => (
            <div 
              key={p.id}
              onClick={() => toggle(p.id)}
              className={`p-6 rounded-3xl border transition-all cursor-pointer flex flex-col items-center text-center group ${
                selected.includes(p.id) 
                ? 'bg-[#ff6b1a]/10 border-[#ff6b1a] ring-1 ring-[#ff6b1a]/30' 
                : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.05]'
              }`}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all ${
                selected.includes(p.id) ? 'bg-[#ff6b1a] text-white' : 'bg-white/5 text-slate-500 group-hover:text-white'
              }`}>
                {p.icon}
              </div>
              <h3 className="font-bold text-white mb-1">{p.label}</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{p.desc}</p>
              
              {selected.includes(p.id) && (
                <div className="mt-4 text-[#ff6b1a]">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
        </div>

        <button 
          onClick={() => router.push('/active-trip')}
          className="w-full py-5 bg-[#ff6b1a] text-white rounded-2xl font-black text-lg tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-[#ff6b1a]/20"
        >
          GENERATE OPTIMIZED ROUTE <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
