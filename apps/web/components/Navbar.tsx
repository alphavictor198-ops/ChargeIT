"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, LogOut, User } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

const NAV_LINKS = [
  { label: "Features", href: "/features" },
  { label: "Stations", href: "/stations" },
  { label: "Route Planner", href: "/route-planner" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const loggedIn = mounted && isAuthenticated();

  // Hide navbar on auth pages
  if (pathname?.startsWith("/auth")) return null;

  const initials = user?.name
    ? user.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#e0f2fe] border-b border-slate-200 rounded-none shadow-sm">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
        {/* Logo → Homepage */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00ff9d] to-[#00d4ff] flex items-center justify-center">
            <Zap className="w-4 h-4 text-[#060b18]" />
          </div>
          <span className="text-lg font-bold gradient-text hidden sm:inline">GatiCharge</span>
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-4">
          {NAV_LINKS.map(link => (
            <Link key={link.href} href={link.href}>
              <button className={`btn-secondary text-base font-bold px-4 py-1.5 ${pathname === link.href ? "border-[#0ea5e9]" : ""}`}>
                {link.label}
              </button>
            </Link>
          ))}
          {loggedIn && (
            <Link href="/history">
              <button className={`btn-secondary text-base font-bold px-4 py-1.5 ${pathname === "/history" ? "border-[#0ea5e9]" : ""}`}>
                History
              </button>
            </Link>
          )}
        </div>

        {/* Right side: Auth */}
        <div className="flex items-center gap-3">
          {loggedIn ? (
            <>
              <Link href="/dashboard" className="flex items-center gap-2.5 group">
                {/* Avatar circle */}
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-[#060b18] shrink-0"
                  style={{ background: "linear-gradient(135deg, #00ff9d, #00d4ff)" }}>
                  {initials}
                </div>
                <span className="text-sm text-slate-300 font-medium hidden sm:inline group-hover:text-white transition-colors">
                  {user?.name}
                </span>
              </Link>
              <button onClick={() => { logout(); window.location.href = "/"; }}
                className="p-2 rounded-lg hover:bg-[#1a2744] transition-colors" title="Logout">
                <LogOut className="w-4 h-4 text-slate-500 hover:text-[#ef4444]" />
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login">
                <button className="btn-secondary text-xs py-1.5 px-4">Sign In</button>
              </Link>
              <Link href="/auth/register">
                <button className="btn-primary text-xs py-1.5 px-4">Get Started</button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
