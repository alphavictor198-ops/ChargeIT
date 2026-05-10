"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Zap, Mail, Lock, User, Eye, EyeOff, AlertCircle, WifiOff } from "lucide-react";
import toast from "react-hot-toast";

// ─── Mock users for offline / demo mode ─────────────────────
const DEMO_USERS: Record<string, { name: string; role: "user" | "admin" }> = {
  "demo@gaticharge.in":  { name: "Arjun Sharma",      role: "user"  },
  "admin@gaticharge.in": { name: "GatiCharge Admin",  role: "admin" },
};

const DEMO_PASSWORDS: Record<string, string> = {
  "demo@gaticharge.in":  "Demo@12345",
  "admin@gaticharge.in": "Admin@12345",
};

function loginOffline(
  email: string,
  password: string,
  setTokens: (a: string, r: string) => void,
  setUser: (u: any) => void,
  router: ReturnType<typeof useRouter>
) {
  const user = DEMO_USERS[email];
  if (!user || DEMO_PASSWORDS[email] !== password) {
    toast.error("Incorrect demo credentials");
    return;
  }
  // Store a fake JWT so the app thinks it's logged in
  const fakeToken = `demo.${btoa(JSON.stringify({ sub: "demo-id", type: "access" }))}.sig`;
  setTokens(fakeToken, fakeToken);
  setUser({
    id: "demo-user-id",
    name: user.name,
    email,
    role: user.role,
    is_active: true,
    is_verified: true,
  });
  toast.success(`Welcome, ${user.name}! ⚡ (Demo Mode)`);
  router.push("/dashboard");
}

function LoginPage() {
  const [email, setEmail]     = useState("demo@gaticharge.in");
  const [password, setPassword] = useState("Demo@12345");
  const [showPwd, setShowPwd] = useState(false);
  const [backendDown, setBackendDown] = useState(false);
  const { setTokens, setUser } = useAuthStore();
  const router = useRouter();

  const loginMutation = useMutation({
    mutationFn: () => authApi.login({ email, password }),
    onSuccess: async (res) => {
      const { access_token, refresh_token } = res.data;
      setTokens(access_token, refresh_token);
      const meRes = await authApi.me();
      setUser(meRes.data);
      toast.success(`Welcome back, ${meRes.data.name}! ⚡`);
      router.push("/dashboard");
    },
    onError: (err: any) => {
      const isNetwork =
        !err.response ||
        err.code === "ECONNREFUSED" ||
        err.message?.includes("Network Error");
      if (isNetwork) {
        setBackendDown(true);
        toast("Backend offline — use Demo Mode below", { icon: "📡" });
      } else {
        toast.error(err.response?.data?.detail || "Login failed");
      }
    },
  });

  const handleDemoMode = () =>
    loginOffline(email, password, setTokens, setUser, router);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--dark-bg)" }}
    >
      <div className="absolute inset-0 hero-gradient pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card neon-border w-full max-w-md p-8 relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-white">Welcome to GatiCharge</h1>
          <p className="text-slate-400 text-sm mt-1">India's EV Intelligence Platform</p>
        </div>

        {/* Backend offline banner */}
        {backendDown && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-4 p-3 rounded-xl flex items-start gap-2 text-xs"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}
          >
            <WifiOff className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="text-red-300">
              <strong>Backend not running.</strong> Use{" "}
              <span className="text-[#00ff9d] font-semibold">Demo Mode</span> below to
              explore the UI, or start the backend with{" "}
              <code className="bg-black/40 px-1 rounded">docker-compose up</code>.
            </div>
          </motion.div>
        )}

        <div className="space-y-4">
          {/* Email */}
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 text-sm"
                onKeyDown={(e) => e.key === "Enter" && loginMutation.mutate()}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 text-sm"
                onKeyDown={(e) => e.key === "Enter" && loginMutation.mutate()}
              />
              <button
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Primary sign-in button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => loginMutation.mutate()}
            disabled={loginMutation.isPending}
            className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
          >
            {loginMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-[#060b18] border-t-transparent rounded-full animate-spin" />
            ) : (
              "Sign In ⚡"
            )}
          </motion.button>

          {/* Demo Mode button — always visible */}
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#1a2744]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#0d1526] px-3 text-xs text-slate-500">or</span>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDemoMode}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            🚗 Enter Demo Mode (No Backend Needed)
          </motion.button>
        </div>

        {/* Demo credentials hint */}
        <div
          className="mt-5 p-3 rounded-xl text-xs"
          style={{ background: "rgba(0,255,157,0.06)", border: "1px solid rgba(0,255,157,0.15)" }}
        >
          <div className="flex items-start gap-2 text-slate-400">
            <AlertCircle className="w-3.5 h-3.5 text-[#00ff9d] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#00ff9d]">Demo User:</strong> demo@gaticharge.in / Demo@12345
              <br />
              <strong className="text-[#fbbf24]">Admin:</strong> admin@gaticharge.in / Admin@12345
              <br />
              <span className="text-slate-600 mt-1 block">
                These work with both Sign In (backend required) and Demo Mode (offline).
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="text-[#00ff9d] hover:underline font-medium">
            Sign up free
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

function RegisterPage() {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const { setTokens, setUser }  = useAuthStore();
  const router = useRouter();

  const registerMutation = useMutation({
    mutationFn: () => authApi.register({ name, email, password }),
    onSuccess: async (res) => {
      const { access_token, refresh_token } = res.data;
      setTokens(access_token, refresh_token);
      const meRes = await authApi.me();
      setUser(meRes.data);
      toast.success("Account created! Welcome ⚡");
      router.push("/dashboard");
    },
    onError: (err: any) => {
      const isNetwork = !err.response || err.message?.includes("Network Error");
      if (isNetwork) {
        toast("Backend offline — use Demo Mode on the login page", { icon: "📡" });
      } else {
        toast.error(err.response?.data?.detail || "Registration failed");
      }
    },
  });

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--dark-bg)" }}
    >
      <div className="absolute inset-0 hero-gradient pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card neon-border w-full max-w-md p-8 relative z-10"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-white">Create Account</h1>
          <p className="text-slate-400 text-sm mt-1">Join India's smartest EV platform</p>
        </div>

        <div className="space-y-4">
          {[
            { label: "Full Name", value: name,     setter: setName,     type: "text",     icon: User, placeholder: "Arjun Sharma" },
            { label: "Email",     value: email,    setter: setEmail,    type: "email",    icon: Mail, placeholder: "arjun@example.com" },
            { label: "Password",  value: password, setter: setPassword, type: "password", icon: Lock, placeholder: "Min 8 chars, 1 uppercase + 1 digit" },
          ].map((field) => {
            const Icon = field.icon;
            return (
              <div key={field.label}>
                <label className="text-xs text-slate-400 block mb-1.5">{field.label}</label>
                <div className="relative">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type={field.type}
                    value={field.value}
                    onChange={(e) => field.setter(e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full pl-10 pr-4 py-2.5 text-sm"
                  />
                </div>
              </div>
            );
          })}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => registerMutation.mutate()}
            disabled={registerMutation.isPending}
            className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
          >
            {registerMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-[#060b18] border-t-transparent rounded-full animate-spin" />
            ) : (
              "Create Account ⚡"
            )}
          </motion.button>
        </div>

        <div className="mt-5 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-[#00ff9d] hover:underline font-medium">
            Sign in
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export { LoginPage, RegisterPage };
export default LoginPage;
