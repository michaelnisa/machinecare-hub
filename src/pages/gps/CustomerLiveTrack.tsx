import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getSingleLiveVehicle, getRecentVehicleTrail, type LiveTrackedVehicle } from "@/services/gpsService";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Truck,
  Navigation,
  Compass,
  Radio,
  ExternalLink,
  Layers,
  RefreshCw,
  Clock,
  BatteryCharging,
  Gauge,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  LocateFixed,
  Eye,
  Share2,
} from "lucide-react";

export default function CustomerLiveTrack() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const [vehicle, setVehicle] = useState<LiveTrackedVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(true);
  const [mapLayer, setMapLayer] = useState<"streets" | "satellite">("streets");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const trailPolylineRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Load vehicle data
  const loadVehicle = async () => {
    if (!vehicleId) return;
    try {
      const data = await getSingleLiveVehicle(vehicleId);
      if (data) {
        setVehicle(data);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error("Failed to load vehicle live telemetry:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicle();
    const interval = setInterval(loadVehicle, 5000); // 5s refresh for customers
    return () => clearInterval(interval);
  }, [vehicleId]);

  // Realtime subscription
  useEffect(() => {
    if (!vehicleId) return;
    const channelName = `customer-track:${vehicleId}:${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "latest_vehicle_positions",
          filter: `vehicle_id=eq.${vehicleId}`,
        },
        () => loadVehicle()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vehicleId]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [-6.7924, 39.2083], // Default Dar es Salaam / TZ
      zoom: 14,
      zoomControl: false,
    });

    L.control.zoom({ position: "topright" }).addTo(map);

    tileLayerRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Detect user manual pan to pause follow
    map.on("dragstart", () => {
      // Don't disable following completely, but allow user to pan
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Map layer toggle
  const toggleMapLayer = () => {
    const next = mapLayer === "streets" ? "satellite" : "streets";
    setMapLayer(next);
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (next === "satellite") {
      tileLayerRef.current = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
          maxZoom: 19,
        }
      ).addTo(map);
    } else {
      tileLayerRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
    }
  };

  // Initial trail load
  useEffect(() => {
    if (!vehicleId || !mapInstanceRef.current) return;
    getRecentVehicleTrail(vehicleId, 60).then((coords) => {
      if (coords.length > 1 && mapInstanceRef.current) {
        if (trailPolylineRef.current) {
          mapInstanceRef.current.removeLayer(trailPolylineRef.current);
        }
        trailPolylineRef.current = L.polyline(coords, {
          color: "#059669",
          weight: 5,
          opacity: 0.85,
          lineJoin: "round",
        }).addTo(mapInstanceRef.current);
      }
    });
  }, [vehicleId]);

  // Update Marker & Auto-Follow Camera
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !vehicle || vehicle.latitude == null || vehicle.longitude == null) return;

    const lat = Number(vehicle.latitude);
    const lng = Number(vehicle.longitude);
    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

    const isMoving = vehicle.motionStatus === "moving";
    const bgCol = isMoving
      ? "bg-emerald-500"
      : vehicle.motionStatus === "idling"
      ? "bg-amber-500"
      : vehicle.motionStatus === "stopped"
      ? "bg-sky-500"
      : "bg-slate-500";

    const customHtml = `
      <div class="relative flex flex-col items-center cursor-pointer pointer-events-auto" style="transform: translate(-50%, -50%);">
        <!-- Glowing Pulse Rings -->
        <span class="absolute -inset-3 rounded-full ${isMoving ? "bg-emerald-400" : "bg-sky-400"} animate-ping opacity-50"></span>
        <span class="absolute -inset-4 rounded-full border-2 ${isMoving ? "border-emerald-400" : "border-sky-400"} animate-pulse"></span>

        <!-- Directional Circle -->
        <div class="relative flex h-10 w-10 items-center justify-center rounded-full ${bgCol} text-white shadow-2xl border-2 border-white transition-transform">
          ${isMoving ? `
            <div style="transform: rotate(${vehicle.heading || 0}deg);" class="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L19 21L12 17L5 21L12 2Z" />
              </svg>
            </div>
          ` : `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
              <path d="M15 18H9"/>
              <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
              <circle cx="17" cy="18" r="2"/>
              <circle cx="7" cy="18" r="2"/>
            </svg>
          `}
        </div>

        <!-- High Visibility Plate & Speed Badge -->
        <div class="mt-1.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-950/90 text-white text-xs font-mono font-bold shadow-xl border border-white/20 whitespace-nowrap">
          <span>${vehicle.plateNumber || vehicle.name}</span>
          ${isMoving ? `<span class="text-emerald-400 font-extrabold">• ${vehicle.speedKmh} km/h</span>` : ""}
        </div>
      </div>
    `;

    const icon = L.divIcon({
      html: customHtml,
      className: "customer-vehicle-marker",
      iconSize: [120, 60],
      iconAnchor: [60, 25],
    });

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      markerRef.current.setIcon(icon);
    } else {
      markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
    }

    // Add coordinate to trail
    if (trailPolylineRef.current) {
      trailPolylineRef.current.addLatLng([lat, lng]);
    }

    // Auto-Follow / Go With It
    if (isFollowing) {
      map.panTo([lat, lng], { animate: true, duration: 1.0 });
    }
  }, [vehicle, isFollowing]);

  const handleRecenter = () => {
    setIsFollowing(true);
    if (vehicle?.latitude && vehicle?.longitude && mapInstanceRef.current) {
      mapInstanceRef.current.setView([Number(vehicle.latitude), Number(vehicle.longitude)], 16, { animate: true });
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Live Tracking: ${vehicle?.plateNumber || vehicle?.name || "Vehicle"}`,
        text: `Watch live location of vehicle ${vehicle?.plateNumber || vehicle?.name}:`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Tracking link copied to clipboard!");
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 font-sans">
      {/* Map Container */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0 h-full w-full" />

      {/* Top Floating Header */}
      <header className="absolute top-4 left-4 right-4 z-[1000] flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-xl border border-white/10 text-white pointer-events-auto">
          <div className="h-8 w-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm font-bold">
            <Radio className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-bold tracking-tight">MachineCare Live Track</div>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              Live Telemetry Stream
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <Button
            size="sm"
            variant="secondary"
            onClick={toggleMapLayer}
            className="h-9 px-3 rounded-xl bg-slate-900/90 backdrop-blur-md text-white border border-white/10 shadow-xl hover:bg-slate-800 text-xs font-medium"
          >
            <Layers className="h-3.5 w-3.5 mr-1.5 text-sky-400" />
            {mapLayer === "streets" ? "Satellite View" : "Street Map"}
          </Button>

          <Button
            size="icon"
            variant="secondary"
            onClick={handleShare}
            className="h-9 w-9 rounded-xl bg-slate-900/90 backdrop-blur-md text-white border border-white/10 shadow-xl hover:bg-slate-800"
            title="Share Tracking Link"
          >
            <Share2 className="h-4 w-4 text-emerald-400" />
          </Button>
        </div>
      </header>

      {/* Follow / Chase Mode Indicator Floating Pill */}
      {isFollowing && vehicle && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] bg-emerald-600/95 text-white px-4 py-1.5 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2 border border-emerald-400 text-xs font-bold pointer-events-auto">
          <LocateFixed className="h-3.5 w-3.5 animate-spin text-white" />
          <span>CHASE MODE ACTIVE · Following Live</span>
          <button
            onClick={() => setIsFollowing(false)}
            className="ml-2 text-[10px] uppercase bg-black/30 hover:bg-black/50 px-2 py-0.5 rounded-full text-white/90"
          >
            Pause
          </button>
        </div>
      )}

      {/* Bottom Floating Card / Telemetry HUD */}
      <div className="absolute bottom-4 left-4 right-4 max-w-lg mx-auto z-[1000] pointer-events-auto">
        {loading && !vehicle ? (
          <div className="rounded-3xl bg-slate-900/95 backdrop-blur-xl border border-white/10 p-6 text-white text-center shadow-2xl">
            <Radio className="h-6 w-6 animate-spin mx-auto text-emerald-400 mb-2" />
            <p className="text-sm font-semibold">Connecting to vehicle satellite GPS...</p>
          </div>
        ) : !vehicle ? (
          <div className="rounded-3xl bg-slate-900/95 backdrop-blur-xl border border-white/10 p-6 text-white text-center shadow-2xl">
            <AlertTriangle className="h-6 w-6 mx-auto text-amber-400 mb-2" />
            <p className="text-sm font-semibold">Vehicle position unavailable</p>
            <p className="text-xs text-white/60 mt-1">Please check with the dispatcher or support team.</p>
          </div>
        ) : (
          <div className="rounded-3xl bg-slate-900/95 backdrop-blur-xl border border-white/10 p-5 text-white shadow-2xl animate-fade-in">
            {/* Top Row: Plate & Status */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center text-primary border border-white/15">
                  <Truck className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-mono tracking-wider text-white">
                    {vehicle.plateNumber || vehicle.name}
                  </h2>
                  <p className="text-xs text-white/60">
                    {vehicle.make || vehicle.model ? `${vehicle.make || ""} ${vehicle.model || ""}` : vehicle.name}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    vehicle.motionStatus === "moving"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : vehicle.motionStatus === "idling"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                      : "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      vehicle.motionStatus === "moving"
                        ? "bg-emerald-400 animate-pulse"
                        : vehicle.motionStatus === "idling"
                        ? "bg-amber-400 animate-pulse"
                        : "bg-sky-400"
                    }`}
                  />
                  {vehicle.motionStatus === "moving" ? `${vehicle.speedKmh} km/h` : vehicle.motionStatus}
                </span>
                <div className="text-[10px] text-white/40 mt-1">
                  Updated {new Date(vehicle.recordedAt || lastRefreshed).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="mt-3.5 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-white/5 rounded-2xl p-2.5 border border-white/5">
                <span className="text-[10px] uppercase text-white/40 block font-medium">Speed</span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  {vehicle.speedKmh} <span className="text-xs font-normal text-white/60">km/h</span>
                </span>
              </div>

              <div className="bg-white/5 rounded-2xl p-2.5 border border-white/5">
                <span className="text-[10px] uppercase text-white/40 block font-medium">Engine</span>
                <span className={`text-sm font-semibold ${vehicle.ignition ? "text-emerald-400" : "text-slate-400"}`}>
                  {vehicle.ignition ? "Ignition ON" : "Parked / OFF"}
                </span>
              </div>

              <div className="bg-white/5 rounded-2xl p-2.5 border border-white/5">
                <span className="text-[10px] uppercase text-white/40 block font-medium">Odometer</span>
                <span className="text-sm font-mono font-bold text-white">
                  {vehicle.currentOdometerKm != null ? `${formatNumber(vehicle.currentOdometerKm)} km` : "—"}
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
              <Button
                size="sm"
                variant={isFollowing ? "default" : "outline"}
                onClick={handleRecenter}
                className={`flex-1 text-xs font-bold rounded-xl h-9 ${
                  isFollowing
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-white/10 hover:bg-white/15 text-white border-white/15"
                }`}
              >
                <LocateFixed className="h-3.5 w-3.5 mr-1.5" />
                {isFollowing ? "Following Vehicle (Go With It)" : "Re-Center on Vehicle"}
              </Button>

              {vehicle.latitude && vehicle.longitude && (
                <a
                  href={`https://maps.google.com/?q=${vehicle.latitude},${vehicle.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/15 transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5 text-rose-400" />
                  Google Maps
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
