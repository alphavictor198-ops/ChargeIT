/**
 * API client for GatiCharge backend.
 * Centralized axios instance with auth header injection and error handling.
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: inject JWT token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 by clearing session
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("access_token");
        // Don't log out if running in Demo Mode (fake token)
        if (token?.startsWith("demo.")) return Promise.reject(error);
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        if (!window.location.pathname.includes("/auth")) {
          window.location.href = "/auth/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

// ─── Auth API ──────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    apiClient.post("/auth/register", data),

  login: (data: { email: string; password: string }) =>
    apiClient.post("/auth/login", data),

  me: () => apiClient.get("/auth/me"),

  googleAuth: (code: string) => apiClient.post("/auth/google", { code }),
};

// ─── Stations API ──────────────────────────────────────────────────────────

export const stationsApi = {
  getNearby: (params: {
    latitude: number;
    longitude: number;
    radius_km?: number;
    charger_type?: string;
    available_only?: boolean;
    limit?: number;
  }) => apiClient.get("/stations/nearby", { params }),

  getAll: (params?: {
    city?: string;
    charger_type?: string;
    available_only?: boolean;
    page?: number;
    page_size?: number;
  }) => apiClient.get("/stations", { params }),

  getById: (id: string) => apiClient.get(`/stations/${id}`),

  getTrust: (id: string) => apiClient.get(`/stations/${id}/trust`),

  submitReport: (data: { station_id: string; issue_type: string; description?: string }) =>
    apiClient.post("/stations/report", data),
};

// ─── Bookings API ─────────────────────────────────────────────────────────

export const bookingsApi = {
  create: (data: {
    station_id: string;
    start_time: string;
    end_time: string;
    slot_id?: string;
    vehicle_id?: string;
    notes?: string;
  }) => apiClient.post("/bookings", data),

  getAll: (params?: { status?: string; page?: number }) =>
    apiClient.get("/bookings", { params }),

  getById: (id: string) => apiClient.get(`/bookings/${id}`),

  cancel: (id: string) => apiClient.patch(`/bookings/${id}/cancel`),
};

// ─── Intelligence API ─────────────────────────────────────────────────────

export const intelligenceApi = {
  predictRange: (data: {
    vehicle_id: string;
    current_soc_percent: number;
    speed_kmh?: number;
    temperature_celsius?: number;
    use_hvac?: boolean;
    elevation_gain_m?: number;
    traffic_factor?: number;
  }) => apiClient.post("/range/predict", data),

  optimizeRoute: (data: {
    origin_lat: number;
    origin_lng: number;
    dest_lat: number;
    dest_lng: number;
    vehicle_id: string;
    current_soc_percent: number;
    min_arrival_soc_percent?: number;
  }) => apiClient.post("/route/optimize", data),

  getWaitPrediction: (stationId: string) =>
    apiClient.get(`/stations/${stationId}/wait`),

  getVehicles: () => apiClient.get("/vehicles"),
};

// ─── Admin API ────────────────────────────────────────────────────────────

export const adminApi = {
  getStats: () => apiClient.get("/admin/stats"),
  getUsers: (params?: { page?: number; role?: string }) =>
    apiClient.get("/admin/users", { params }),
  getReports: (params?: { resolved?: boolean }) =>
    apiClient.get("/admin/reports", { params }),
  getBookingAnalytics: () => apiClient.get("/admin/bookings/analytics"),
};
