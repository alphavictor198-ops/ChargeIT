"use client";

import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation } from "lucide-react";
import { useRouter } from "next/navigation";

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const userLocation: [number, number] = [22.7196, 75.8577];

const STATIONS = [
  { id: 1, name: "Nexus Mall Charging Hub", lat: 22.722, lng: 75.860, distance: "1.2 km" },
  { id: 2, name: "Tata Power Station - MG Road", lat: 22.715, lng: 75.865, distance: "2.5 km" },
  { id: 3, name: "Jio-bp Pulse Hub", lat: 22.725, lng: 75.850, distance: "3.1 km" }
];

export default function LocationServices() {
  const [selected, setSelected] = useState<any>(null);
  const router = useRouter();

  return (
    <div className="w-full h-full relative" style={{ minHeight: "350px", borderRadius: "12px", overflow: "hidden", zIndex: 10 }}>
      <MapContainer center={userLocation} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap"
        />

        {/* User location */}
        <CircleMarker center={userLocation} radius={8} fillColor="#0ea5e9" color="#0ea5e9" weight={2} fillOpacity={0.8} />

        {/* Stations */}
        {STATIONS.map((st) => (
          <Marker 
            key={st.id} 
            position={[st.lat, st.lng]}
            eventHandlers={{
              click: () => setSelected(st)
            }}
          >
            <Popup>
              <div className="p-1" style={{ color: "#000000" }}>
                <div className="font-bold text-sm mb-1">{st.name}</div>
                <div className="text-xs text-slate-500 mb-2">{st.distance} away</div>
                <button 
                  onClick={() => router.push(`/route-planner?destName=${encodeURIComponent(st.name)}&destLat=${st.lat}&destLng=${st.lng}`)}
                  className="btn-primary w-full text-xs py-1.5 flex items-center justify-center gap-1 text-white"
                >
                  <Navigation className="w-3 h-3" /> Plan Route
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
