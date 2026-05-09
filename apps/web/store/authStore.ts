/**
 * Zustand auth store — manages JWT tokens and user session.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "@/lib/api";

interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "station_owner" | "admin";
  avatar_url?: string;
  is_active: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  fetchMe: () => Promise<void>;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,

      setTokens: (access: string, refresh: string) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("access_token", access);
          localStorage.setItem("refresh_token", refresh);
        }
        set({ accessToken: access, refreshToken: refresh });
      },

      setUser: (user: User) => set({ user }),

      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        }
        set({ user: null, accessToken: null, refreshToken: null });
      },

      fetchMe: async () => {
        const token = get().accessToken;
        // Skip real API call when running in Demo Mode (fake token)
        if (token?.startsWith("demo.")) {
          return;
        }
        set({ isLoading: true });
        try {
          const response = await authApi.me();
          set({ user: response.data });
        } catch {
          get().logout();
        } finally {
          set({ isLoading: false });
        }
      },

      isAuthenticated: () => !!get().accessToken && !!get().user,
    }),
    {
      name: "gaticharge-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
);
