"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { bookingsApi, stationsApi } from "@/lib/api";
import { Calendar, MapPin, Clock, CheckCircle, XCircle, AlertCircle, Plus } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import toast from "react-hot-toast";

const STATUS_CONFIG = {
  pending:   { label: "Pending",   color: "#fbbf24", icon: AlertCircle },
  confirmed: { label: "Confirmed", color: "#00d4ff", icon: CheckCircle },
  active:    { label: "Active",    color: "#00ff9d", icon: CheckCircle },
  completed: { label: "Done",      color: "#6366f1", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "#ef4444", icon: XCircle },
};

function BookingCard({ booking, onCancel }: { booking: any; onCancel: (id: string) => void }) {
  const status = STATUS_CONFIG[booking.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const StatusIcon = status.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-[#00ff9d]" />
            <span className="font-semibold text-white text-sm">
              {booking.station_name || `Station ${booking.station_id?.slice(0, 8)}...`}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {booking.start_time ? format(new Date(booking.start_time), "MMM d, HH:mm") : "—"}
            </div>
            <span>→</span>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {booking.end_time ? format(new Date(booking.end_time), "HH:mm") : "—"}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: `${status.color}18`, color: status.color }}
          >
            <StatusIcon className="w-3.5 h-3.5" />
            {status.label}
          </span>

          {(booking.status === "pending" || booking.status === "confirmed") && (
            <button
              onClick={() => onCancel(booking.id)}
              className="text-xs text-slate-500 hover:text-[#ef4444] transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {booking.notes && (
        <div className="mt-3 text-xs text-slate-500 border-t border-[#1a2744] pt-2">
          📝 {booking.notes}
        </div>
      )}
    </motion.div>
  );
}

export default function BookingsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["bookings", statusFilter],
    queryFn: async () => {
      const res = await bookingsApi.getAll({ status: statusFilter || undefined });
      return res.data;
    },
    retry: false,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => bookingsApi.cancel(id),
    onSuccess: () => {
      toast.success("Booking cancelled");
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: () => toast.error("Failed to cancel booking"),
  });

  // Demo bookings when backend offline
  const demoBookings = [
    {
      id: "demo-1",
      station_name: "Tata Power EV Hub - Connaught Place",
      station_id: "station-1",
      status: "confirmed",
      start_time: new Date(Date.now() + 3600000).toISOString(),
      end_time: new Date(Date.now() + 7200000).toISOString(),
      notes: "Nexon EV charging",
    },
    {
      id: "demo-2",
      station_name: "Ather Grid - Koramangala",
      station_id: "station-2",
      status: "completed",
      start_time: new Date(Date.now() - 86400000).toISOString(),
      end_time: new Date(Date.now() - 79200000).toISOString(),
    },
  ];

  const bookings = data || demoBookings;

  return (
    <div className="min-h-screen pt-20 px-6 pb-6" style={{ background: "var(--dark-bg)" }}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-white">My Bookings</h1>
            <p className="text-slate-400 mt-1">Manage your charging reservations</p>
          </div>
          <Link href="/bookings/new">
            <button className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" />
              New Booking
            </button>
          </Link>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {["", "confirmed", "pending", "completed", "cancelled"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                statusFilter === s
                  ? "bg-[#00ff9d] text-[#060b18]"
                  : "bg-[#1a2744] text-slate-400 hover:text-white"
              }`}
            >
              {s === "" ? "All" : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label || s}
            </button>
          ))}
        </div>

        {/* Bookings list */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl shimmer" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No bookings found</p>
            <Link href="/stations">
              <button className="btn-primary mt-4 text-sm">Find Stations</button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking: any) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onCancel={(id) => cancelMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
