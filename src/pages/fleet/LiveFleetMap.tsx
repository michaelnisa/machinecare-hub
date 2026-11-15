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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { syncTrakzeeFleet } from "@/services/trakzeeService";
import { SAFE_MACHINE_COLUMNS, parseMachine, normalizeTelematicsStatus, type TelematicsStatus } from "@/lib/fleet-metadata";
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
  LocateFixed,
  Share2,
  Copy,
  Check,
  MessageSquare,
  X,
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
  telematics_status?: TelematicsStatus | string | null;
  telematics_raw?: any;
}

export type LiveMarkerStatus = "Running" | "Idle" | "Inactive" | "Stopped" | "workshop";

// Marker style generator with plate & speed pill
function createVehicleIcon(
  status: LiveMarkerStatus,
  speed: number = 0,
  plate: string = "",
  isFollowed: boolean = false
) {
  const bgColors: Record<LiveMarkerStatus, string> = {
    Running: "bg-emerald-600 border-white",
    Idle: "bg-amber-500 border-white",
    Stopped: "bg-sky-600 border-white",
    Inactive: "bg-slate-500 border-slate-300",
    workshop: "bg-rose-600 border-white",
  };

  const isRunning = status === "Running";

  const html = `
    <div class="relative flex flex-col items-center group cursor-pointer" style="transform: translate(-50%, -50%);">
      ${
        isFollowed
          ? `<span class="absolute -inset-2.5 rounded-full bg-emerald-400 animate-ping opacity-60"></span>
             <span class="absolute -inset-3.5 rounded-full border-2 border-emerald-400 animate-pulse"></span>`
          : ""
      }
      <div class="relative flex h-8 w-8 items-center justify-center rounded-full ${bgColors[status]} text-white shadow-xl border-2 transition-transform">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
          <path d="M15 18H9"/>
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
          <circle cx="17" cy="18" r="2"/>
          <circle cx="7" cy="18" r="2"/>
        </svg>
      </div>

      <div class="mt-1 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-950/95 text-white text-[10px] font-mono font-bold shadow-xl border border-white/20 whitespace-nowrap pointer-events-none">
        <span>${plate}</span>
        ${isRunning && speed > 0 ? `<span class="text-emerald-400 font-extrabold">• ${speed}km/h</span>` : ""}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-leaflet-truck-marker",
    iconSize: [80, 50],
    iconAnchor: [40, 20],
    popupAnchor: [0, -22],
  });
}

export default function LiveFleetMap() {
  const { organisation, profile } = useAuth();
  const { canWrite } = useUserRole();

  const [vehicles, setVehicles] = useState<TrackedVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Running" | "Idle" | "Inactive" | "Stopped">("all");
  const [selectedVehicle, setSelectedVehicle] = useState<TrackedVehicle | null>(null);
  const [followingVehicleId, setFollowingVehicleId] = useState<string | null>(null);
  const [mapLayer, setMapLayer] = useState<"streets" | "satellite">("streets");

  // Share Dialog State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareVehicle, setShareVehicle] = useState<TrackedVehicle | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Load vehicles from Supabase
  const loadVehicles = async () => {
    const orgId = organisation?.id || profile?.organisation_id;
    if (!orgId) return;
    try {
      const { data, error } = await supabase
        .from("machines")
        .select(SAFE_MACHINE_COLUMNS)
        .eq("organisation_id", orgId)
        .in("category", ["Vehicle", "Trailer"])
        .order("name");

      if (error) throw error;
      const parsed = (data || []).map((m, idx) => parseMachine(m, idx));
      setVehicles(parsed as any as TrackedVehicle[]);

      if (followingVehicleId) {
        const updated = (parsed as any[]).find((v) => v.id === followingVehicleId);
        if (updated) setSelectedVehicle(updated);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
    const interval = setInterval(loadVehicles, 10000);
    return () => clearInterval(interval);
  }, [organisation?.id, profile?.organisation_id]);

  const isTelematicsEnabled = Boolean(
    organisation?.trakzee_enabled ||
    organisation?.id === "df6b0c4b-e56b-4694-838a-0381eb480043" ||
    organisation?.name?.toLowerCase().includes("logistix")
  );

  // Sync with Trakzee live API
  const handleSync = async (autoImport: boolean | unknown = true) => {
    const orgId = organisation?.id || profile?.organisation_id;
    if (!orgId) return;
    if (!isTelematicsEnabled) {
      toast.info("Live GPS & Telematics is not enabled for this organisation.");
      return;
    }
    const shouldImport = typeof autoImport === "boolean" ? autoImport : true;
    setSyncing(true);
    try {
      const res = await syncTrakzeeFleet(orgId, shouldImport);
      if (!res.success) {
        toast.error(res.error || "Failed to sync GPS telematics");
      } else {
        toast.success(`GPS Synced: ${res.vehicles_updated} vehicle(s) updated`);
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
      zoomControl: false,
    });

    L.control.zoom({ position: "topright" }).addTo(map);

    tileLayerRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

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

  // Update Markers on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

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
      const hasGps = !isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0);

      const liveStatus = normalizeTelematicsStatus(
        v.telematics_status ?? v.telematics_raw?.Status,
        speed,
        ignition,
        v.telematics_last_at,
        hasGps
      );

      const statusType: LiveMarkerStatus = isUnderMaint ? "workshop" : liveStatus;
      const isFollowed = followingVehicleId === v.id;

      const icon = createVehicleIcon(
        statusType,
        speed,
        v.plate_number || v.name,
        isFollowed
      );
      const marker = L.marker([lat, lng], { icon }).addTo(map);

      // Popup Content
      const plate = v.plate_number || v.name;
      const lastSeen = v.telematics_last_at
        ? new Date(v.telematics_last_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "Recently";
      const popupHtml = `
        <div style="font-family: inherit; min-width: 200px; padding: 2px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 6px;">
            <strong style="font-size: 14px; color: #111827; letter-spacing: 0.5px;">${plate}</strong>
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 9999px; background: ${
              statusType === "Running"
                ? "#d1fae5; color: #065f46"
                : statusType === "Idle"
                ? "#fef3c7; color: #92400e"
                : statusType === "Inactive"
                ? "#f1f5f9; color: #475569"
                : statusType === "workshop"
                ? "#fee2e2; color: #991b1b"
                : "#e0f2fe; color: #075985"
            };">
              ${statusType}
            </span>
          </div>
          <div style="font-size: 11px; color: #4b5563; line-height: 1.5; margin-bottom: 8px;">
            <div><strong>Status:</strong> ${statusType}</div>
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

    // Auto-Follow / Chase Camera Glide
    if (followingVehicleId) {
      const followed = vehicles.find((v) => v.id === followingVehicleId);
      if (followed?.telematics_latitude && followed?.telematics_longitude) {
        map.panTo([Number(followed.telematics_latitude), Number(followed.telematics_longitude)], {
          animate: true,
          duration: 1.0,
        });
      }
    } else if (validGpsCount > 0 && bounds.isValid() && !selectedVehicle) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [vehicles, followingVehicleId]);

  // Filtered vehicles for sidebar list
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const plate = (v.plate_number || v.name || "").toLowerCase();
      const matchesSearch = plate.includes(search.toLowerCase());
      if (!matchesSearch) return false;

      if (statusFilter === "all") return true;

      const hasGps = v.telematics_latitude != null && v.telematics_longitude != null;
      const vStatus = normalizeTelematicsStatus(
        v.telematics_status ?? v.telematics_raw?.Status,
        v.telematics_speed,
        v.telematics_ignition,
        v.telematics_last_at,
        hasGps
      );

      return vStatus === statusFilter;
    });
  }, [vehicles, search, statusFilter]);

  // Quick stats
  const stats = useMemo(() => {
    let running = 0;
    let idle = 0;
    let inactive = 0;
    let stopped = 0;
    let withGps = 0;

    vehicles.forEach((v) => {
      const hasGps = v.telematics_latitude != null && v.telematics_longitude != null;
      if (hasGps) withGps++;

      const vStatus = normalizeTelematicsStatus(
        v.telematics_status ?? v.telematics_raw?.Status,
        v.telematics_speed,
        v.telematics_ignition,
        v.telematics_last_at,
        hasGps
      );

      if (vStatus === "Running") running++;
      else if (vStatus === "Idle") idle++;
      else if (vStatus === "Inactive") inactive++;
      else stopped++;
    });

    return { total: vehicles.length, withGps, running, idle, inactive, stopped };
  }, [vehicles]);

  // Pan to vehicle on card click
  const focusVehicle = (v: TrackedVehicle, zoomIn = false) => {
    setSelectedVehicle(v);
    if (!v.telematics_latitude || !v.telematics_longitude || !mapInstanceRef.current) return;
    const lat = Number(v.telematics_latitude);
    const lng = Number(v.telematics_longitude);
    mapInstanceRef.current.flyTo([lat, lng], zoomIn ? 16 : 15, { duration: 1.2 });
    const marker = markersRef.current.get(v.id);
    if (marker) marker.openPopup();
  };

  const toggleFollow = (v: TrackedVehicle) => {
    if (followingVehicleId === v.id) {
      setFollowingVehicleId(null);
      toast.info("Auto-follow released (Free camera roam)");
    } else {
      setFollowingVehicleId(v.id);
      setSelectedVehicle(v);
      focusVehicle(v, true);
      toast.success(`Chase Mode: Following ${v.plate_number || v.name} live!`);
    }
  };

  const handleOpenShare = (v: TrackedVehicle) => {
    setShareVehicle(v);
    setCopiedLink(false);
    setShareModalOpen(true);
  };

  const shareUrl = shareVehicle
    ? `${window.location.origin}/track/${shareVehicle.id}`
    : "";

  const handleCopyShareLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    toast.success("Live tracking link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const followedVehicle = useMemo(() => {
    return vehicles.find((v) => v.id === followingVehicleId) || null;
  }, [vehicles, followingVehicleId]);

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
            Real-time GPS tracking across Tanzania & transit corridors for {organisation?.name || "Fleet"}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Stats Pills */}
          <div className="hidden md:flex items-center gap-1.5 text-xs bg-muted/60 p-1 rounded-lg border border-border">
            <span className="px-2 py-0.5 rounded font-medium text-foreground">
              Total: <strong>{stats.total}</strong>
            </span>
            <span className="px-2 py-0.5 rounded font-medium text-emerald-600 bg-emerald-500/10">
              Running: <strong>{stats.running}</strong>
            </span>
            <span className="px-2 py-0.5 rounded font-medium text-amber-600 bg-amber-500/10">
              Idle: <strong>{stats.idle}</strong>
            </span>
            <span className="px-2 py-0.5 rounded font-medium text-sky-600 bg-sky-500/10">
              Stopped: <strong>{stats.stopped}</strong>
            </span>
            <span className="px-2 py-0.5 rounded font-medium text-slate-600 bg-slate-500/10 dark:text-slate-300">
              Inactive: <strong>{stats.inactive}</strong>
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSync(true)}
            disabled={syncing}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync GPS"}
          </Button>
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 flex-1 min-h-0 rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
        {/* Left Sidebar */}
        <div className="lg:col-span-1 flex flex-col border-b lg:border-b-0 lg:border-r border-border bg-card/60">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search plate or vehicle name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <Tabs
              value={statusFilter}
              onValueChange={(val) => setStatusFilter(val as any)}
              className="w-full"
            >
              <TabsList className="grid grid-cols-5 h-7 text-[10px]">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="Running">Running</TabsTrigger>
                <TabsTrigger value="Idle">Idle</TabsTrigger>
                <TabsTrigger value="Inactive">Inactive</TabsTrigger>
                <TabsTrigger value="Stopped">Stopped</TabsTrigger>
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
              const isFollowed = followingVehicleId === v.id;
              const vStatus = normalizeTelematicsStatus(
                v.telematics_status ?? v.telematics_raw?.Status,
                speed,
                ignition,
                v.telematics_last_at,
                hasGps
              );

              return (
                <div
                  key={v.id}
                  onClick={() => focusVehicle(v)}
                  className={`p-3 text-left transition-colors cursor-pointer hover:bg-muted/50 ${
                    isSelected ? "bg-primary/10 border-l-4 border-primary" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Truck className={`h-4 w-4 ${isFollowed ? "text-emerald-500 animate-pulse" : "text-primary"}`} />
                      <span className="font-mono font-bold text-sm text-foreground tracking-wide truncate">
                        {v.plate_number || v.name}
                      </span>
                      <Link
                        to={`/fleet/vehicles/${v.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors p-0.5 shrink-0"
                        title="Open Vehicle Profile"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase flex items-center gap-1 ${
                        vStatus === "Running"
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          : vStatus === "Idle"
                          ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                          : vStatus === "Inactive"
                          ? "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                          : "bg-sky-500/10 text-sky-600 border border-sky-500/20"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        vStatus === "Running" ? "bg-emerald-500 animate-pulse" :
                        vStatus === "Idle" ? "bg-amber-500" :
                        vStatus === "Inactive" ? "bg-slate-400" : "bg-sky-500"
                      }`} />
                      {vStatus === "Running" ? (speed > 0 ? `${speed} km/h` : "Running") : vStatus}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5">
                    <span>
                      {v.current_odometer_km != null ? `${formatNumber(v.current_odometer_km)} km` : "No odo"}
                    </span>
                    <div className="flex items-center gap-2">
                      {v.telematics_battery_volt != null && (
                        <span className="flex items-center gap-1">
                          <BatteryCharging className="h-3 w-3" /> {v.telematics_battery_volt}V
                        </span>
                      )}
                      <button
                        title="Share live tracking link"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenShare(v);
                        }}
                        className="hover:text-primary transition-colors p-0.5"
                      >
                        <Share2 className="h-3 w-3" />
                      </button>
                    </div>
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

          {/* Top Center: Active Follow / Chase Mode Banner */}
          {followedVehicle && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-emerald-600/95 text-white px-4 py-2 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-3 border border-emerald-400 text-xs font-bold pointer-events-auto animate-pulse">
              <LocateFixed className="h-4 w-4 animate-spin text-white" />
              <span>
                CHASE MODE ACTIVE: Following {followedVehicle.plate_number || followedVehicle.name} ({followedVehicle.telematics_speed || 0} km/h)
              </span>
              <button
                onClick={() => setFollowingVehicleId(null)}
                className="bg-black/30 hover:bg-black/50 text-white text-[11px] px-2.5 py-0.5 rounded-full font-medium transition-colors"
              >
                Release Camera
              </button>
            </div>
          )}

          {/* Top Right Controls: Map Layer Switcher */}
          <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2 pointer-events-auto">
            <Button
              size="sm"
              variant="secondary"
              onClick={toggleMapLayer}
              className="h-8 px-2.5 bg-card/90 backdrop-blur border border-border shadow-md text-xs font-medium"
            >
              <Layers className="h-3.5 w-3.5 mr-1.5 text-primary" />
              {mapLayer === "streets" ? "Satellite" : "Street"}
            </Button>
          </div>

          {/* Floating Map Legend */}
          <div className="absolute bottom-3 right-3 z-[1000] bg-card/90 backdrop-blur border border-border p-2.5 rounded-xl shadow-lg text-[11px] space-y-1.5 pointer-events-auto hidden sm:block">
            <div className="font-semibold text-foreground text-xs pb-1 border-b border-border">Map Legend</div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>Running (&gt; 0 km/h)</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span>Idle (Engine ON, 0 km/h)</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
              <span>Stopped (Engine OFF)</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
              <span>Inactive (Offline / No Fix)</span>
            </div>
          </div>

          {/* Floating Selected Vehicle Control Card */}
          {selectedVehicle && (
            <div className="absolute bottom-4 left-4 z-[1000] max-w-sm w-full bg-card/95 backdrop-blur-md border border-border rounded-2xl p-4 shadow-2xl pointer-events-auto animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" />
                  <span className="font-mono font-bold text-sm text-foreground">
                    {selectedVehicle.plate_number || selectedVehicle.name}
                  </span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSelectedVehicle(null);
                    setFollowingVehicleId(null);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="mt-2.5 text-xs text-muted-foreground truncate">
                {selectedVehicle.make || selectedVehicle.model
                  ? `${selectedVehicle.make || ""} ${selectedVehicle.model || ""}`
                  : selectedVehicle.name}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] bg-muted/40 p-2.5 rounded-xl border border-border/50">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Speed</span>
                  <span className="font-semibold text-emerald-600 font-mono">
                    {Number(selectedVehicle.telematics_speed || 0) > 0
                      ? `${selectedVehicle.telematics_speed} km/h`
                      : "0 km/h (Stopped)"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Ignition</span>
                  <span
                    className={
                      selectedVehicle.telematics_ignition
                        ? "text-emerald-600 font-semibold"
                        : "text-muted-foreground"
                    }
                  >
                    {selectedVehicle.telematics_ignition ? "Engine ON" : "Engine OFF"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Odometer</span>
                  <span className="font-mono text-foreground">
                    {selectedVehicle.current_odometer_km != null
                      ? `${formatNumber(selectedVehicle.current_odometer_km)} km`
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Battery</span>
                  <span className="font-mono text-foreground">
                    {selectedVehicle.telematics_battery_volt
                      ? `${selectedVehicle.telematics_battery_volt} V`
                      : "—"}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant={followingVehicleId === selectedVehicle.id ? "default" : "outline"}
                  onClick={() => toggleFollow(selectedVehicle)}
                  className={`h-8 text-xs font-semibold ${
                    followingVehicleId === selectedVehicle.id
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <LocateFixed className="h-3.5 w-3.5 mr-1 text-current" />
                  {followingVehicleId === selectedVehicle.id ? "Following (Active)" : "Go With It (Chase)"}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenShare(selectedVehicle)}
                  className="h-8 text-xs font-medium border-border hover:bg-muted"
                >
                  <Share2 className="h-3.5 w-3.5 mr-1 text-primary" />
                  Share Link
                </Button>
              </div>

              <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between text-xs">
                <Link
                  to={`/fleet/vehicles/${selectedVehicle.id}`}
                  className="text-primary hover:underline font-medium text-[11px]"
                >
                  View Vehicle Profile →
                </Link>
                {selectedVehicle.telematics_latitude && selectedVehicle.telematics_longitude && (
                  <a
                    href={`https://maps.google.com/?q=${selectedVehicle.telematics_latitude},${selectedVehicle.telematics_longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground text-[11px] inline-flex items-center gap-1"
                  >
                    <MapPin className="h-3 w-3 text-rose-500" /> Maps ↗
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Share Tracking Link Modal */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              Share Live Tracking with Customer
            </DialogTitle>
            <DialogDescription>
              Anyone with this link can watch vehicle{" "}
              <strong>{shareVehicle?.plate_number || shareVehicle?.name}</strong> live on their phone or desktop in real-time without signing in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={shareUrl}
                className="font-mono text-xs h-9 bg-muted/60"
              />
              <Button
                size="sm"
                onClick={handleCopyShareLink}
                className="h-9 px-3 gap-1 shrink-0"
              >
                {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedLink ? "Copied" : "Copy"}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Track vehicle ${shareVehicle?.plate_number || shareVehicle?.name} live: ${shareUrl}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-9 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Share via WhatsApp
              </a>

              <a
                href={`sms:?body=${encodeURIComponent(
                  `Track vehicle ${shareVehicle?.plate_number || shareVehicle?.name} live: ${shareUrl}`
                )}`}
                className="h-9 px-4 rounded-md border border-border hover:bg-muted text-foreground font-semibold text-xs inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                SMS
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
