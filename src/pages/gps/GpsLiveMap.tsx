import { useEffect, useRef, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getLiveGpsFleet, type LiveTrackedVehicle } from "@/services/gpsService";
import { GpsNavHeader } from "./GpsNavHeader";
import { formatNumber } from "@/lib/format";
import { toast } from "sonner";
import {
  Truck,
  Search,
  RefreshCw,
  Navigation,
  History,
  BatteryCharging,
  AlertTriangle,
  Radio,
  ExternalLink,
} from "lucide-react";

export type GpsMarkerStatus = "moving" | "idling" | "stopped" | "offline";

function createGpsVehicleIcon(status: GpsMarkerStatus) {
  const bgColors: Record<GpsMarkerStatus, string> = {
    moving: "bg-emerald-500",
    idling: "bg-amber-500",
    stopped: "bg-sky-500",
    offline: "bg-slate-400",
  };
  const pingColor: Record<GpsMarkerStatus, string> = {
    moving: "bg-emerald-400",
    idling: "bg-amber-400",
    stopped: "bg-sky-400",
    offline: "bg-slate-300",
  };

  const html = `
    <div class="relative flex items-center justify-center">
      ${status === "moving" ? `<span class="absolute h-8 w-8 rounded-full ${pingColor[status]} animate-ping opacity-60"></span>` : ""}
      <div class="relative flex h-7 w-7 items-center justify-center rounded-full ${bgColors[status]} text-white shadow-lg border-2 border-white">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
          <path d="M15 18H9"/>
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
          <circle cx="17" cy="18" r="2"/>
          <circle cx="7" cy="18" r="2"/>
        </svg>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-leaflet-gps-marker",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

export default function GpsLiveMap() {
  const { organisation, profile } = useAuth();
  const [vehicles, setVehicles] = useState<LiveTrackedVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | GpsMarkerStatus>("all");
  const [selectedVehicle, setSelectedVehicle] = useState<LiveTrackedVehicle | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  const loadLiveFleet = async () => {
    const orgId = organisation?.id || profile?.organisation_id;
    if (!orgId) return;
    try {
      const data = await getLiveGpsFleet(orgId);
      setVehicles(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load live GPS fleet");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLiveFleet();
    const interval = setInterval(loadLiveFleet, 15000);
    return () => clearInterval(interval);
  }, [organisation?.id, profile?.organisation_id]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center: Dodoma / Central Tanzania
    const map = L.map(mapContainerRef.current, {
      center: [-6.369028, 34.888822],
      zoom: 6,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    const bounds = L.latLngBounds([]);
    let validGpsCount = 0;

    vehicles.forEach((v) => {
      if (v.latitude == null || v.longitude == null) return;
      const lat = Number(v.latitude);
      const lng = Number(v.longitude);
      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

      validGpsCount++;
      bounds.extend([lat, lng]);

      const icon = createGpsVehicleIcon(v.motionStatus);
      const marker = L.marker([lat, lng], { icon }).addTo(map);

      const plate = v.plateNumber || v.name;
      const lastSeen = v.recordedAt
        ? new Date(v.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "Recently";

      const popupHtml = `
        <div style="font-family: inherit; min-width: 220px; padding: 2px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 6px;">
            <strong style="font-size: 14px; color: #111827; letter-spacing: 0.5px;">${plate}</strong>
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 9999px; background: ${
              v.motionStatus === "moving"
                ? "#d1fae5; color: #065f46"
                : v.motionStatus === "idling"
                ? "#fef3c7; color: #92400e"
                : v.motionStatus === "offline"
                ? "#f1f5f9; color: #475569"
                : "#e0f2fe; color: #075985"
            };">
              ${v.motionStatus}
            </span>
          </div>
          <div style="font-size: 11px; color: #4b5563; line-height: 1.5; margin-bottom: 8px;">
            <div><strong>Speed:</strong> ${v.speedKmh} km/h</div>
            <div><strong>Ignition:</strong> ${v.ignition ? "ON" : "OFF"}</div>
            <div><strong>Odometer:</strong> ${v.currentOdometerKm != null ? formatNumber(v.currentOdometerKm) + " km" : "—"}</div>
            ${v.batteryVoltage ? `<div><strong>Battery:</strong> ${v.batteryVoltage}V</div>` : ""}
            <div style="color: #9ca3af; font-size: 10px; margin-top: 4px;">Last fix: ${lastSeen}</div>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; border-top: 1px solid #f3f4f6; padding-top: 6px;">
            <a href="/gps/replay?vehicleId=${v.vehicleId}" style="font-size: 11px; color: #16a34a; text-decoration: none; font-weight: 600;">Replay Route ↺</a>
            <span style="color: #d1d5db;">•</span>
            <a href="https://maps.google.com/?q=${lat},${lng}" target="_blank" rel="noreferrer" style="font-size: 11px; color: #4b5563; text-decoration: none;">Maps ↗</a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on("click", () => setSelectedVehicle(v));
      markersRef.current.set(v.vehicleId, marker);
    });

    if (validGpsCount > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const plate = (v.plateNumber || v.name || "").toLowerCase();
      const matchesSearch = plate.includes(search.toLowerCase());
      if (!matchesSearch) return false;
      if (statusFilter === "all") return true;
      return v.motionStatus === statusFilter;
    });
  }, [vehicles, search, statusFilter]);

  const stats = useMemo(() => {
    let moving = 0;
    let idling = 0;
    let stopped = 0;
    let offline = 0;

    vehicles.forEach((v) => {
      if (v.motionStatus === "moving") moving++;
      else if (v.motionStatus === "idling") idling++;
      else if (v.motionStatus === "stopped") stopped++;
      else offline++;
    });

    return { total: vehicles.length, moving, idling, stopped, offline };
  }, [vehicles]);

  const focusVehicle = (v: LiveTrackedVehicle) => {
    setSelectedVehicle(v);
    if (!v.latitude || !v.longitude || !mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([Number(v.latitude), Number(v.longitude)], 15, { duration: 1.2 });
    const marker = markersRef.current.get(v.vehicleId);
    if (marker) marker.openPopup();
  };

  return (
    <div className="space-y-3 animate-fade-in flex flex-col h-[calc(100vh-5rem)] p-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">MachineCare GPS Tracking</h1>
            <span className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Telemetry
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Independent GPS telematics and asset monitoring for {organisation?.name || "Organization"}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 text-xs bg-muted/60 p-1 rounded-lg border border-border">
            <span className="px-2 py-0.5 rounded font-medium text-foreground">
              Total: <strong>{stats.total}</strong>
            </span>
            <span className="px-2 py-0.5 rounded font-medium text-emerald-600 bg-emerald-500/10">
              Moving: <strong>{stats.moving}</strong>
            </span>
            <span className="px-2 py-0.5 rounded font-medium text-amber-600 bg-amber-500/10">
              Idle: <strong>{stats.idling}</strong>
            </span>
            <span className="px-2 py-0.5 rounded font-medium text-sky-600 bg-sky-500/10">
              Stopped: <strong>{stats.stopped}</strong>
            </span>
            <span className="px-2 py-0.5 rounded font-medium text-slate-600 bg-slate-500/10 dark:text-slate-300">
              Offline: <strong>{stats.offline}</strong>
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshing(true);
              loadLiveFleet();
            }}
            disabled={refreshing}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Updating..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Navigation Header */}
      <GpsNavHeader />

      {/* Map + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 flex-1 min-h-0 rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
        {/* Sidebar */}
        <div className="lg:col-span-1 flex flex-col border-b lg:border-b-0 lg:border-r border-border bg-card/60">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search plate or vehicle..."
                className="pl-8 text-xs h-8"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <TabsList className="grid grid-cols-5 h-7 text-[10px]">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="moving">Moving</TabsTrigger>
                <TabsTrigger value="idling">Idle</TabsTrigger>
                <TabsTrigger value="stopped">Stopped</TabsTrigger>
                <TabsTrigger value="offline">Offline</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/60">
            {filteredVehicles.map((v) => {
              const isSelected = selectedVehicle?.vehicleId === v.vehicleId;
              const hasGps = v.latitude != null && v.longitude != null;

              return (
                <div
                  key={v.vehicleId}
                  onClick={() => focusVehicle(v)}
                  className={`p-3 text-left transition-colors cursor-pointer hover:bg-muted/50 ${
                    isSelected ? "bg-primary/10 border-l-4 border-primary" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono font-bold text-sm text-foreground tracking-wide truncate">
                        {v.plateNumber || v.name}
                      </span>
                      <Link
                        to={`/gps/replay?vehicleId=${v.vehicleId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-muted-foreground hover:text-emerald-600 transition-colors p-0.5 shrink-0"
                        title="Replay Route History"
                      >
                        <History className="h-3 w-3" />
                      </Link>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase flex items-center gap-1 ${
                        v.motionStatus === "moving"
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          : v.motionStatus === "idling"
                          ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                          : v.motionStatus === "offline"
                          ? "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                          : "bg-sky-500/10 text-sky-600 border border-sky-500/20"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          v.motionStatus === "moving"
                            ? "bg-emerald-500 animate-pulse"
                            : v.motionStatus === "idling"
                            ? "bg-amber-500"
                            : v.motionStatus === "offline"
                            ? "bg-slate-400"
                            : "bg-sky-500"
                        }`}
                      />
                      {v.motionStatus === "moving" ? `${v.speedKmh} km/h` : v.motionStatus}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5">
                    <span>
                      {v.currentOdometerKm != null ? `${formatNumber(v.currentOdometerKm)} km` : "No odo"}
                    </span>
                    {v.batteryVoltage != null && (
                      <span className="flex items-center gap-1">
                        <BatteryCharging className="h-3 w-3" /> {v.batteryVoltage}V
                      </span>
                    )}
                  </div>

                  {!hasGps && (
                    <div className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-2.5 w-2.5" /> Awaiting GPS fix
                    </div>
                  )}
                </div>
              );
            })}

            {filteredVehicles.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No vehicles matching this filter.
              </div>
            )}
          </div>
        </div>

        {/* Map Canvas */}
        <div className="lg:col-span-3 relative h-full min-h-[400px]">
          <div ref={mapContainerRef} className="absolute inset-0 z-0" />

          {/* Map Legend */}
          <div className="absolute top-3 right-3 z-[1000] bg-card/90 backdrop-blur border border-border p-2.5 rounded-xl shadow-lg text-[11px] space-y-1.5 pointer-events-auto">
            <div className="font-semibold text-foreground text-xs pb-1 border-b border-border">
              Status Legend
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>Moving (&gt; 0 km/h)</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span>Idling (Ignition ON, 0 km/h)</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
              <span>Stopped (Ignition OFF)</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
              <span>Offline / No GPS Fix</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
