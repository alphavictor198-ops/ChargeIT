"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMapStore, Station } from "@/store/mapStore";
import { motion } from "framer-motion";

// Fix Leaflet default icon issue in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom colored marker factory
function createStationIcon(available: boolean, trustScore: number): L.DivIcon {
  const color = !available ? "#ef4444" : trustScore >= 0.7 ? "#00ff9d" : trustScore >= 0.4 ? "#fbbf24" : "#ef4444";
  return L.divIcon({
    html: `
      <div style="
        width: 32px; height: 32px;
        background: ${color};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid rgba(255,255,255,0.2);
        box-shadow: 0 0 12px ${color}88;
        position: relative;
      ">
        <div style="
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          transform: rotate(45deg); font-size: 10px; color: #060b18; font-weight: 700;
        ">⚡</div>
      </div>
    `,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

function MapController() {
  const map = useMap();
  const { mapCenter, mapZoom } = useMapStore();

  useEffect(() => {
    map.setView(mapCenter, mapZoom, { animate: true });
  }, [map, mapCenter, mapZoom]);

  return null;
}

function ChargerTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    ac_slow: "#6366f1",
    ac_fast: "#0ea5e9",
    dc_fast: "#00ff9d",
    dc_ultra: "#f59e0b",
  };
  const labels: Record<string, string> = {
    ac_slow: "AC Slow",
    ac_fast: "AC Fast",
    dc_fast: "DC Fast",
    dc_ultra: "DC Ultra",
  };
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: `${colors[type]}22`, color: colors[type] || "#aaa", border: `1px solid ${colors[type]}44` }}
    >
      {labels[type] || type}
    </span>
  );
}

export default function MapView() {
  const { stations, mapCenter, mapZoom, setSelectedStation, selectedStation, userLocation } = useMapStore();

  return (
    <MapContainer
      center={mapCenter}
      zoom={mapZoom}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        subdomains="abcd"
        maxZoom={19}
      />

      <MapController />

      {/* User location */}
      {userLocation && (
        <CircleMarker
          center={userLocation}
          radius={10}
          fillColor="#00d4ff"
          color="#00d4ff"
          weight={2}
          fillOpacity={0.8}
        >
          <Popup className="custom-popup">
            <div className="text-center py-1">
              <div className="font-semibold text-[#00d4ff]">📍 You are here</div>
            </div>
          </Popup>
        </CircleMarker>
      )}

      {/* Station markers */}
      {stations.map((station) => (
        <Marker
          key={station.id}
          position={[station.latitude, station.longitude]}
          icon={createStationIcon(station.available_slots > 0, station.trust_score)}
          eventHandlers={{
            click: () => setSelectedStation(station),
          }}
        >
          <Popup maxWidth={280}>
            <div style={{ fontFamily: "Inter, sans-serif" }}>
              <div className="font-bold text-base mb-1" style={{ color: "#e2e8f0" }}>
                {station.name}
              </div>
              {station.operator && (
                <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 8 }}>
                  {station.operator}
                </div>
              )}

              <div style={{ marginBottom: 8 }}>
                <span style={{
                  color: station.available_slots > 0 ? "#00ff9d" : "#ef4444",
                  fontWeight: 600, fontSize: 13
                }}>
                  {station.available_slots}/{station.total_slots} slots available
                </span>
              </div>

              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                {station.charger_types.map((t) => (
                  <ChargerTypeBadge key={t} type={t} />
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94a3b8" }}>
                <span>Max Power: <strong style={{ color: "#00d4ff" }}>{station.max_power_kw}kW</strong></span>
                <span>Trust: <strong style={{
                  color: station.trust_score >= 0.7 ? "#00ff9d" : station.trust_score >= 0.4 ? "#fbbf24" : "#ef4444"
                }}>{Math.round(station.trust_score * 100)}%</strong></span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
