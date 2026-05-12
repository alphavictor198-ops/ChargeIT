"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { stationStore } from "@/lib/stationStore";
import { CheckCircle2, Zap, CreditCard, Clock, ShieldCheck, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

const TIME_SLOTS = [
  "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
  "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM"
];

export default function BookingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const stationId = searchParams.get("id");
  const station = stationStore.getStations().find(s => s.id === stationId);

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Availability Simulation
  const bookedSlots = useMemo(() => {
    const booked = new Set<string>();
    if (!stationId) return booked;
    const seed = stationId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    TIME_SLOTS.forEach((slot, index) => {
      if ((seed + index) % 4 === 0) booked.add(slot);
    });
    return booked;
  }, [stationId]);

  const handlePay = async () => {
    if (!selectedSlot) return toast.error("Please select a time slot");
    setIsProcessing(true);
    
    // Simulate Payment & OCPP Handshake
    setTimeout(() => {
      setIsProcessing(false);
      setConfirmed(true);
      toast.success("Slot Secured via GPay");
    }, 2500);
  };

  if (!station) return <div className="pt-32 text-center text-white">Station not found</div>;

  if (confirmed) {
    return (
      <div className="min-h-screen pt-32 p-6 flex items-center justify-center bg-[#060b18]">
        <div className="max-w-md w-full glass-card p-8 bg-white/[0.03] border-[#00ff9d]/30 border rounded-3xl text-center">
          <div className="w-20 h-20 bg-[#00ff9d]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-[#00ff9d]" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Booking Secured!</h1>
          <p className="text-slate-400 mb-8">Your hardware connector is now locked for {selectedSlot} at {station.name}.</p>
          
          <div className="space-y-3 mb-8">
            <div className="flex justify-between text-sm py-2 border-b border-white/5">
              <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Transaction ID</span>
              <span className="text-white font-mono">GATI-WEB-99X</span>
            </div>
            <div className="flex justify-between text-sm py-2">
              <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Reference</span>
              <span className="text-[#00ff9d] font-bold">RESERVED_OCPP_1.6</span>
            </div>
          </div>

          <button 
            onClick={() => router.push('/active-trip')}
            className="w-full py-4 bg-[#ff6b1a] text-white rounded-xl font-black text-sm tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            START NAVIGATION <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 p-6 bg-[#060b18]">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
        
        {/* Left: Summary */}
        <div>
          <h1 className="text-4xl font-black text-white mb-2">Secure Your Slot</h1>
          <p className="text-slate-400 mb-10">Instant reservation with hardware-level lock synchronization.</p>
          
          <div className="glass-card p-8 bg-white/[0.03] border-white/5 rounded-3xl border mb-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-[#00ff9d]/10 rounded-2xl text-[#00ff9d]">
                <Zap className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{station.name}</h3>
                <p className="text-sm text-slate-500">{station.maxPowerKw}kW DC Hypercharger</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Pricing</div>
                <div className="text-xl font-black text-white">₹{station.pricePerKwh}<span className="text-xs text-slate-500 font-normal"> / kWh</span></div>
              </div>
              <div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Platform Fee</div>
                <div className="text-xl font-black text-[#00d4ff]">₹150.00</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#00ff9d]/5 border border-[#00ff9d]/20">
            <ShieldCheck className="w-6 h-6 text-[#00ff9d]" />
            <p className="text-xs text-slate-300 font-medium">Your reservation amount will be adjusted in the final bill during the charging session.</p>
          </div>
        </div>

        {/* Right: Slot Selection */}
        <div className="glass-card p-8 bg-white/[0.02] border-white/10 rounded-3xl border">
          <h2 className="text-sm font-black text-[#ffaa44] uppercase tracking-[0.2em] mb-8">Select Time (Today)</h2>
          
          <div className="grid grid-cols-3 gap-3 mb-10">
            {TIME_SLOTS.map(slot => {
              const isBooked = bookedSlots.has(slot);
              return (
                <button
                  key={slot}
                  disabled={isBooked}
                  onClick={() => setSelectedSlot(slot)}
                  className={`py-4 rounded-xl text-xs font-bold transition-all border ${
                    isBooked ? 'bg-white/2 opacity-20 border-transparent cursor-not-allowed' :
                    selectedSlot === slot ? 'bg-[#00ff9d]/20 border-[#00ff9d] text-[#00ff9d] shadow-lg shadow-[#00ff9d]/10' :
                    'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'
                  }`}
                >
                  {isBooked ? 'Occupied' : slot}
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
             <div className="flex justify-between items-center px-2">
                <span className="text-slate-400 text-sm font-bold">Total Amount</span>
                <span className="text-2xl font-black text-white">₹150.00</span>
             </div>
             
             <button 
                onClick={handlePay}
                disabled={isProcessing || !selectedSlot}
                className="w-full h-16 bg-white text-[#060b18] rounded-2xl font-black text-sm tracking-widest hover:brightness-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
             >
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-[#060b18] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Google_Pay_Logo_%282020%29.svg/1024px-Google_Pay_Logo_%282020%29.svg.png" className="h-4" alt="GPay" />
                    PAY & SECURE SLOT
                  </>
                )}
             </button>
          </div>
        </div>

      </div>
    </div>
  );
}
