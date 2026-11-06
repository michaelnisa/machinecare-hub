import { useEffect, useRef, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { syncTrakzeeFleet } from "@/services/trakzeeService";
import { formatNumber } from "@/lib/format";
import { toast } from "sonner";
import {
  Truck,
  Radio,
  Search,
  RefreshCw,
  Navigation,
  Gauge,
  BatteryCharging,
  Maximize2,
  ExternalLink,
  MapPin,
  Clock,
  Layers,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

interface TrackedVehicle {
  id: string;
  name: string;
  plate_number: string | null;
  make: string | null;
  model: string | null;
  status: string;
  current_odometer_km: number | null;
  telematics_speed: number | null;
  telematics_ignition: boolean | null;
  telematics_battery_volt: number | null;
  telematics_latitude: number | null;
  telematics_longitude: number | null;
  telematics_last_at: string | null;
  telematics_raw?: any;
}

// Marker style generator
function createVehicleIcon(status: "moving" | "idling" | "parked" | "workshop") {
  const bgColors = {
    moving: "bg-emerald-500",
    idling: "bg-amber-500",
    parked: "bg-sky-500",
    workshop: "bg-rose-500",
  };
  const pingColor = {
    moving: "bg-emerald-400",
    idling: "bg-amber-400",
    parked: "bg-sky-400",
    workshop: "bg-rose-400",
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
    className: "custom-leaflet-truck-marker",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

export default function LiveFleetMap() {
  const { organisation } = useAuth();
  const { canWrite } = useUserRole();

  const [vehicles, setVehicles] = useState<TrackedVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "moving" | "idling" | "parked">("all");
  const [selectedVehicle, setSelectedVehicle] = useState<TrackedVehicle | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  // Load vehicles from Supabase
  const loadVehicles = async () => {
    if (!organisation?.id) return;
    try {
      const { data, error } = await supabase
        .from("machines")
        .select("id, name, plate_number, make, model, status, current_odometer_km, telematics_speed, telematics_ignition, telematics_battery_volt, telematics_latitude, telematics_longitude, telematics_last_at, telematics_raw")
        .eq("organisation_id", organisation.id)
        .in("category", ["Vehicle", "Trailer"])
        .order("plate_number");

      if (error) throw error;
      setVehicles((data || []) as TrackedVehicle[]);
    } catch (err: any) {
      toast.error(err.message || "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, [organisation?.id]);

  // Sync with Trakzee live API
  const handleSync = async (autoImport = false) => {
    if (!organisation?.id) return;
    setSyncing(true);
    try {
      const res = await syncTrakzeeFleet(organisation.id, autoImport);
      if (!res.success) {
        toast.error(res.error || "Failed to sync Trakzee GPS");
      } else {
        toast.success(`Trakzee GPS Synced: ${res.vehicles_updated} vehicle(s) updated`);
        await loadVehicles();
      }
    } catch (err: any) {
      toast.error(err.message || "Error communicating with telematics bridge");
    } finally {
      setSyncing(false);
    }
  };

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

  // Update Markers on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    const bounds = L.latLngBounds([]);
    let validGpsCount = 0;

    vehicles.forEach((v) => {
      if (v.telematics_latitude == null || v.telematics_longitude == null) return;
      const lat = Number(v.telematics_latitude);
      const lng = Number(v.telematics_longitude);
      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

      validGpsCount++;
      bounds.extend([lat, lng]);

      const isUnderMaint = v.status === "under_maintenance";
      const speed = Number(v.telematics_speed || 0);
      const ignition = Boolean(v.telematics_ignition);

      let statusType: "moving" | "idling" | "parked" | "workshop" = "parked";
      if (isUnderMaint) statusType = "workshop";
      else if (speed > 0) statusType = "moving";
      else if (ignition) statusType = "idling";

      const icon = createVehicleIcon(statusType);
      const marker = L.marker([lat, lng], { icon }).addTo(map);

      // Popup Content
      const plate = v.plate_number || v.name;
      const lastSeen = v.telematics_last_at ? new Date(v.telematics_last_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Recently";
      const popupHtml = `
        <div style="font-family: inherit; min-width: 200px; padding: 2px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 6px;">
            <strong style="font-size: 14px; color: #111827; letter-spacing: 0.5px;">${plate}</strong>
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 9999px; background: ${
              statusType === "moving" ? "#d1fae5; color: #065f46" :
              statusType === "idling" ? "#fef3c7; color: #92400e" :
              statusType === "workshop" ? "#fee2e2; color: #991b1b" : "#e0f2fe; color: #075985"
            };">
              ${statusType}
            </span>
          </div>
          <div style="font-size: 11px; color: #4b5563; line-height: 1.5; margin-bottom: 8px;">
            <div><strong>Speed:</strong> ${speed} km/h</div>
            <div><strong>Ignition:</strong> ${ignition ? "ON" : "OFF"}</div>
            <div><strong>Odometer:</strong> ${v.current_odometer_km != null ? formatNumber(v.current_odometer_km) + " km" : "—"}</div>
            ${v.telematics_battery_volt ? `<div><strong>Battery:</strong> ${v.telematics_battery_volt}V</div>` : ""}
            <div style="color: #9ca3af; font-size: 10px; margin-top: 4px;">Last fix: ${lastSeen}</div>
          </div>
          <div style="display: flex; gap: 6px; border-top: 1px solid #f3f4f6; padding-top: 6px;">
            <a href="/fleet/vehicles/${v.id}" style="font-size: 11px; color: #2563eb; text-decoration: none; font-weight: 600;">Vehicle Profile →</a>
            <span style="color: #d1d5db;">•</span>
            <a href="https://maps.google.com/?q=${lat},${lng}" target="_blank" rel="noreferrer" style="font-size: 11px; color: #4b5563; text-decoration: none;">Google Maps ↗</a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on("click", () => {
        setSelectedVehicle(v);
      });

      markersRef.current.set(v.id, marker);
    });

    // Auto-fit to fleet bounds if multiple vehicles exist
    if (validGpsCount > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [vehicles]);

  // Filtered vehicles for sidebar list
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const plate = (v.plate_number || v.name || "").toLowerCase();
      const matchesSearch = plate.includes(search.toLowerCase());
      if (!matchesSearch) return false;

      const speed = Number(v.telematics_speed || 0);
      const ignition = Boolean(v.telematics_ignition);

      if (statusFilter === "moving") return speed > 0;
      if (statusFilter === "idling") return ignition && speed === 0;
      if (statusFilter === "parked") return !ignition;
      return true;
    });
  }, [vehicles, search, statusFilter]);

  // Quick stats
  const stats = useMemo(() => {
    let moving = 0;
    let idling = 0;
    let parked = 0;
    let withGps = 0;

    vehicles.forEach((v) => {
      if (v.telematics_latitude != null && v.telematics_longitude != null) withGps++;
      const speed = Number(v.telematics_speed || 0);
      const ignition = Boolean(v.telematics_ignition);
      if (speed > 0) moving++;
      else if (ignition) idling++;
      else parked++;
    });

    return { total: vehicles.length, withGps, moving, idling, parked };
  }, [vehicles]);

  // Pan to vehicle on card click
  const focusVehicle = (v: TrackedVehicle) => {
    setSelectedVehicle(v);
    if (!v.telematics_latitude || !v.telematics_longitude || !mapInstanceRef.current) return;
    const lat = Number(v.telematics_latitude);
    const lng = Number(v.telematics_longitude);
    mapInstanceRef.current.flyTo([lat, lng], 15, { duration: 1.2 });
    const marker = markersRef.current.get(v.id);
    if (marker) marker.openPopup();
  };

  return (
    <div className="space-y-4 animate-fade-in flex flex-col h-[calc(100vh-5rem)]">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Live GPS Fleet Map</h1>
            <span className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Telemetry
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time GPS tracking across Tanzania & transit corridors for LOGISTIXWARE.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Stats Pills */}
          <div className="hidden md:flex items-center gap-1.5 text-xs bg-muted/60 p-1 rounded-lg border border-border">
            <span className="px-2 py-0.5 rounded font-medium text-foreground">
              Total: <strong>{stats.total}</strong>
            </span>
            <span className="px-2 py-0.5 rounded font-medium text-emerald-600 bg-emerald-500/10">
              Moving: <strong>{stats.moving}</strong>
            </span>
            <span className="px-2 py-0.5 rounded font-medium text-amber-600 bg-amber-500/10">
              Idling: <strong>{stats.idling}</strong>
            </span>
            <span className="px-2 py-0.5 rounded font-medium text-sky-600 bg-sky-500/10">
              Parked: <strong>{stats.parked}</strong>
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSync(false)}
            disabled={syncing}
            className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing GPS..." : "Refresh GPS"}
          </Button>

          {canWrite && (
            <Button
              variant="default"
              size="sm"
              onClick={() => handleSync(true)}
              disabled={syncing}
              className="gap-1.5 text-xs"
              title="Pull and register all 56 vehicles from Trakzee"
            >
              <Truck className="h-3.5 w-3.5" />
              Auto-Import Trakzee Fleet
            </Button>
          )}
        </div>
      </div>

      {/* Main Map + Sidebar Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 flex-1 min-h-0 rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
        {/* Left Sidebar List */}
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
              <TabsList className="grid grid-cols-4 h-7 text-[10px]">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="moving">Moving</TabsTrigger>
                <TabsTrigger value="idling">Idle</TabsTrigger>
                <TabsTrigger value="parked">Parked</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Vehicle List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/60">
            {filteredVehicles.map((v) => {
              const speed = Number(v.telematics_speed || 0);
              const ignition = Boolean(v.telematics_ignition);
              const hasGps = v.telematics_latitude != null && v.telematics_longitude != null;
              const isSelected = selectedVehicle?.id === v.id;

              return (
                <div
                  key={v.id}
                  onClick={() => focusVehicle(v)}
                  className={`p-3 text-left transition-colors cursor-pointer hover:bg-muted/50 ${
                    isSelected ? "bg-primary/10 border-l-4 border-primary" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-foreground tracking-wide">
                      {v.plate_number || v.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase flex items-center gap-1 ${
                        speed > 0
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          : ignition
                          ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                          : "bg-sky-500/10 text-sky-600 border border-sky-500/20"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${speed > 0 ? "bg-emerald-500 animate-pulse" : "bg-current"}`} />
                      {speed > 0 ? `${speed} km/h` : ignition ? "Idling" : "Parked"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5">
                    <span>
                      {v.current_odometer_km != null ? `${formatNumber(v.current_odometer_km)} km` : "No odo"}
                    </span>
                    {v.telematics_battery_volt != null && (
                      <span className="flex items-center gap-1">
                        <BatteryCharging className="h-3 w-3" /> {v.telematics_battery_volt}V
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

        {/* Right Map Canvas */}
        <div className="lg:col-span-3 relative h-full min-h-[400px]">
          <div ref={mapContainerRef} className="absolute inset-0 z-0" />

          {/* Floating Map Legend */}
          <div className="absolute top-3 right-3 z-[1000] bg-card/90 backdrop-blur border border-border p-2.5 rounded-xl shadow-lg text-[11px] space-y-1.5 pointer-events-auto">
            <div className="font-semibold text-foreground text-xs pb-1 border-b border-border">Map Legend</div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>Moving (&gt; 0 km/h)</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span>Idling (Engine ON)</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
              <span>Parked (Engine OFF)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
