"use client";
import { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface RouteMapProps {
  origin: { name: string; lat: number; lng: number };
  destination: { name: string; lat: number; lng: number };
  stops: { name: string; lat: number; lng: number; type: string }[];
  userPos?: { lat: number; lng: number } | null;
}

const mkIcon = (bg: string, size = 16, label = "") => L.divIcon({
  className: "",
  html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:3px solid #060b18;box-shadow:0 0 10px ${bg};display:flex;align-items:center;justify-content:center;font-size:10px;color:#060b18;font-weight:bold">${label}</div>`,
  iconSize: [size, size], iconAnchor: [size / 2, size / 2],
});

async function fetchOSRMRoute(waypoints: [number, number][]): Promise<L.LatLng[]> {
  const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === "Ok" && data.routes?.[0]?.geometry?.coordinates) {
      return data.routes[0].geometry.coordinates.map(
        (c: [number, number]) => L.latLng(c[1], c[0])
      );
    }
  } catch { /* fallback to straight line */ }
  return waypoints.map(([lat, lng]) => L.latLng(lat, lng));
}

export default function RouteMap({ origin, destination, stops, userPos }: RouteMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  const allWaypoints = useMemo((): [number, number][] => {
    const pts: [number, number][] = [[origin.lat, origin.lng]];
    stops.forEach(s => pts.push([s.lat, s.lng]));
    pts.push([destination.lat, destination.lng]);
    return pts;
  }, [origin, destination, stops]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OSM &copy; CARTO', maxZoom: 18,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Markers
    L.marker([origin.lat, origin.lng], { icon: mkIcon("#00ff9d", 18) })
      .bindPopup(`<b style="color:#00ff9d">🟢 ${origin.name}</b>`).addTo(map);
    L.marker([destination.lat, destination.lng], { icon: mkIcon("#ef4444", 18) })
      .bindPopup(`<b style="color:#ef4444">🔴 ${destination.name}</b>`).addTo(map);
    stops.forEach((s) => {
      L.marker([s.lat, s.lng], { icon: mkIcon("#fbbf24", 22, "⚡") })
        .bindPopup(`<b style="color:#fbbf24">⚡ ${s.name}</b><br><span style="color:#999">${s.type}</span>`)
        .addTo(map);
    });

    // Fit bounds
    const allLatLngs = allWaypoints.map(([lat, lng]) => L.latLng(lat, lng));
    map.fitBounds(L.latLngBounds(allLatLngs), { padding: [40, 40] });

    // Route layer group
    const routeLayer = L.layerGroup().addTo(map);
    routeLayerRef.current = routeLayer;

    // Fetch real road route from OSRM
    fetchOSRMRoute(allWaypoints).then(routePoints => {
      routeLayer.clearLayers();
      if (routePoints.length > 0) {
        L.polyline(routePoints, {
          color: "#00ff9d", weight: 4, opacity: 0.8,
        }).addTo(routeLayer);
      }
    });

    // User GPS marker
    userMarkerRef.current = L.marker([0, 0], {
      icon: mkIcon("#00d4ff", 26, "📍"), zIndexOffset: 1000,
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [origin, destination, stops, allWaypoints]);

  // Update user position
  useEffect(() => {
    if (!mapRef.current || !userMarkerRef.current) return;
    if (!userPos) { userMarkerRef.current.remove(); return; }
    userMarkerRef.current.setLatLng([userPos.lat, userPos.lng]);
    if (!mapRef.current.hasLayer(userMarkerRef.current)) userMarkerRef.current.addTo(mapRef.current);
  }, [userPos]);

  return <div ref={containerRef} className="w-full h-full" style={{ background: "#060b18" }} />;
}
