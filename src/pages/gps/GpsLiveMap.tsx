import { useEffect, useRef, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "@/contexts/AuthContext";
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
import {
  getLiveGpsFleet,
  getRecentVehicleTrail,
  toggleVehicleEngineImmobilizer,
  type LiveTrackedVehicle,
} from "@/services/gpsService";
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
  Zap,
  ZapOff,
  Power,
  PowerOff,
  X,
  Gauge,
  Layers,
  LocateFixed,
  Share2,
  Copy,
  Check,
  MessageSquare,
  MapPin,
} from "lucide-react";

export type GpsMarkerStatus = "moving" | "idling" | "stopped" | "offline";

function createGpsVehicleIcon(
  status: GpsMarkerStatus,
  heading: number = 0,
  speed: number = 0,
  plate: string = "",
  isFollowed: boolean = false
) {
  const bgColors: Record<GpsMarkerStatus, string> = {
    moving: "bg-emerald-600 border-white",
    idling: "bg-amber-500 border-white",
    stopped: "bg-sky-600 border-white",
    offline: "bg-slate-500 border-slate-300",
  };

  const isMoving = status === "moving";

  const html = `
    <div class="relative flex flex-col items-center group cursor-pointer" style="transform: translate(-50%, -50%);">
      <!-- Follow Glow Effect -->
      ${
        isFollowed
          ? `<span class="absolute -inset-2.5 rounded-full bg-emerald-400 animate-ping opacity-60"></span>
             <span class="absolute -inset-3.5 rounded-full border-2 border-emerald-400 animate-pulse"></span>`
          : ""
      }
      
      <!-- Directional Marker Circle with Heading Arrow -->
      <div class="relative flex h-8 w-8 items-center justify-center rounded-full ${bgColors[status]} text-white shadow-xl border-2 transition-transform duration-300">
        ${
          isMoving
            ? `
          <!-- Rotating Heading Arrow -->
          <div style="transform: rotate(${heading || 0}deg);" class="flex items-center justify-center transition-transform duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L19 21L12 17L5 21L12 2Z" />
            </svg>
          </div>
        `
            : `
          <!-- Vehicle Icon -->
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
            <path d="M15 18H9"/>
            <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
            <circle cx="17" cy="18" r="2"/>
            <circle cx="7" cy="18" r="2"/>
          </svg>
        `
        }
      </div>

      <!-- Attached High-Contrast Vehicle Label & Speed Pill -->
      <div class="mt-1 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-950/95 text-white text-[10px] font-mono font-bold shadow-xl border border-white/20 whitespace-nowrap pointer-events-none">
        <span>${plate}</span>
        ${isMoving ? `<span class="text-emerald-400 font-extrabold">• ${speed}km/h</span>` : ""}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-leaflet-gps-marker",
    iconSize: [80, 50],
    iconAnchor: [40, 20],
    popupAnchor: [0, -22],
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
  const [followingVehicleId, setFollowingVehicleId] = useState<string | null>(null);
  const [mapLayer, setMapLayer] = useState<"streets" | "satellite">("streets");

  // Share Dialog State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareVehicle, setShareVehicle] = useState<LiveTrackedVehicle | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const trailPolylineRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const loadLiveFleet = async () => {
    const orgId = organisation?.id || profile?.organisation_id;
    if (!orgId) return;
    try {
      const data = await getLiveGpsFleet(orgId);
      setVehicles(data);

      // If currently following a vehicle, update selected reference
      if (followingVehicleId) {
        const updated = data.find((v) => v.vehicleId === followingVehicleId);
        if (updated) setSelectedVehicle(updated);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load live GPS fleet");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLiveFleet();
    const interval = setInterval(loadLiveFleet, 10000);
    return () => clearInterval(interval);
  }, [organisation?.id, profile?.organisation_id]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

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

  // Map Layer Switcher
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

  // Draw Vehicle Recent Trail
  const loadAndDrawTrail = async (vehicleId: string) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (trailPolylineRef.current) {
      map.removeLayer(trailPolylineRef.current);
      trailPolylineRef.current = null;
    }

    const coords = await getRecentVehicleTrail(vehicleId, 60);
    if (coords.length > 1 && mapInstanceRef.current) {
      trailPolylineRef.current = L.polyline(coords, {
        color: "#059669",
        weight: 4,
        opacity: 0.85,
        lineJoin: "round",
      }).addTo(mapInstanceRef.current);
    }
  };

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

      const isFollowed = followingVehicleId === v.vehicleId;
      const icon = createGpsVehicleIcon(
        v.motionStatus,
        v.heading,
        v.speedKmh,
        v.plateNumber || v.name,
        isFollowed
      );
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
      marker.on("click", () => {
        setSelectedVehicle(v);
        loadAndDrawTrail(v.vehicleId);
      });
      markersRef.current.set(v.vehicleId, marker);
    });

    // Handle Follow / Chase Mode auto-glide
    if (followingVehicleId) {
      const followed = vehicles.find((v) => v.vehicleId === followingVehicleId);
      if (followed?.latitude && followed?.longitude) {
        map.panTo([Number(followed.latitude), Number(followed.longitude)], {
          animate: true,
          duration: 1.0,
        });
      }
    } else if (validGpsCount > 0 && bounds.isValid() && !selectedVehicle) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [vehicles, followingVehicleId]);

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

  const [immobilizing, setImmobilizing] = useState(false);

  const handleToggleImmobilizer = async (v: LiveTrackedVehicle) => {
    const isCut = Boolean((v as any).relay_cut || (v as any).engine_immobilized);
    const action = isCut ? "restore engine ignition" : "remotely cut the engine";
    if (!window.confirm(`Are you sure you want to ${action} for vehicle ${v.plateNumber || v.name}?`)) {
      return;
    }
    setImmobilizing(true);
    try {
      const res = await toggleVehicleEngineImmobilizer(v.vehicleId, !isCut);
      if (res.success) {
        toast.success(isCut ? "Engine ignition restored successfully" : "Engine cut signal transmitted. Ignition inhibited.");
        await loadLiveFleet();
        setSelectedVehicle((prev) => (prev ? ({ ...prev, relay_cut: !isCut, engine_immobilized: !isCut } as any) : null));
      } else {
        toast.error(res.error || "Failed to execute immobilizer command");
      }
    } catch {
      toast.error("Execution failed");
    } finally {
      setImmobilizing(false);
    }
  };

  const focusVehicle = (v: LiveTrackedVehicle, zoomIn = false) => {
    setSelectedVehicle(v);
    loadAndDrawTrail(v.vehicleId);
    if (!v.latitude || !v.longitude || !mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([Number(v.latitude), Number(v.longitude)], zoomIn ? 16 : 15, { duration: 1.2 });
    const marker = markersRef.current.get(v.vehicleId);
    if (marker) marker.openPopup();
  };

  const toggleFollow = (v: LiveTrackedVehicle) => {
    if (followingVehicleId === v.vehicleId) {
      setFollowingVehicleId(null);
      toast.info("Auto-follow released (Free camera roam)");
    } else {
      setFollowingVehicleId(v.vehicleId);
      setSelectedVehicle(v);
      focusVehicle(v, true);
      toast.success(`Chase Mode: Following ${v.plateNumber || v.name} live!`);
    }
  };

  const handleOpenShare = (v: LiveTrackedVehicle) => {
    setShareVehicle(v);
    setCopiedLink(false);
    setShareModalOpen(true);
  };

  const shareUrl = shareVehicle
    ? `${window.location.origin}/track/${shareVehicle.vehicleId}`
    : "";

  const handleCopyShareLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    toast.success("Live tracking link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const followedVehicle = useMemo(() => {
    return vehicles.find((v) => v.vehicleId === followingVehicleId) || null;
  }, [vehicles, followingVehicleId]);

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
            Independent GPS telematics, live vehicle chase mode, and customer tracking for {organisation?.name || "Organization"}.
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
              <TabsList className="grid grid-cols-4 h-7 text-[10px] w-full bg-muted/80">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="moving" className="text-emerald-600">
                  Moving
                </TabsTrigger>
                <TabsTrigger value="idling" className="text-amber-600">
                  Idle
                </TabsTrigger>
                <TabsTrigger value="stopped" className="text-sky-600">
                  Parked
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Vehicle List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {filteredVehicles.map((v) => {
              const isSelected = selectedVehicle?.vehicleId === v.vehicleId;
              const isFollowed = followingVehicleId === v.vehicleId;
              const hasGps = v.latitude != null && v.longitude != null;

              return (
                <div
                  key={v.vehicleId}
                  onClick={() => focusVehicle(v)}
                  className={`p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                    isSelected ? "bg-muted border-l-4 border-l-primary" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className={`h-4 w-4 ${isFollowed ? "text-emerald-500 animate-pulse" : "text-primary"}`} />
                      <span className="font-mono font-bold text-xs text-foreground">
                        {v.plateNumber || v.name}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        v.motionStatus === "moving"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : v.motionStatus === "idling"
                          ? "bg-amber-500/10 text-amber-600"
                          : v.motionStatus === "offline"
                          ? "bg-slate-500/10 text-slate-500"
                          : "bg-sky-500/10 text-sky-600"
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
                    <div className="flex items-center gap-2">
                      {v.batteryVoltage != null && (
                        <span className="flex items-center gap-0.5">
                          <BatteryCharging className="h-3 w-3" /> {v.batteryVoltage}V
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

        {/* Map Canvas */}
        <div className="lg:col-span-3 relative h-full min-h-[400px]">
          <div ref={mapContainerRef} className="absolute inset-0 z-0" />

          {/* Top Center: Active Follow / Chase Mode Pill */}
          {followedVehicle && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-emerald-600/95 text-white px-4 py-2 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-3 border border-emerald-400 text-xs font-bold pointer-events-auto animate-pulse">
              <LocateFixed className="h-4 w-4 animate-spin text-white" />
              <span>
                CHASE MODE ACTIVE: Following {followedVehicle.plateNumber || followedVehicle.name} ({followedVehicle.speedKmh} km/h)
              </span>
              <button
                onClick={() => setFollowingVehicleId(null)}
                className="bg-black/30 hover:bg-black/50 text-white text-[11px] px-2.5 py-0.5 rounded-full font-medium transition-colors"
              >
                Release Camera
              </button>
            </div>
          )}

          {/* Top Right Controls: Map Layer Switcher & Re-center */}
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

          {/* Bottom Right Map Legend */}
          <div className="absolute bottom-3 right-3 z-[1000] bg-card/90 backdrop-blur border border-border p-2.5 rounded-xl shadow-lg text-[11px] space-y-1.5 pointer-events-auto hidden sm:block">
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

          {/* Floating Selected Vehicle Control Card & Telemetry HUD */}
          {selectedVehicle && (
            <div className="absolute bottom-4 left-4 z-[1000] max-w-sm w-full bg-card/95 backdrop-blur-md border border-border rounded-2xl p-4 shadow-2xl pointer-events-auto animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" />
                  <span className="font-mono font-bold text-sm text-foreground">
                    {selectedVehicle.plateNumber || selectedVehicle.name}
                  </span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSelectedVehicle(null);
                    setFollowingVehicleId(null);
                    if (trailPolylineRef.current && mapInstanceRef.current) {
                      mapInstanceRef.current.removeLayer(trailPolylineRef.current);
                      trailPolylineRef.current = null;
                    }
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="mt-2 text-xs text-muted-foreground truncate">
                {selectedVehicle.make || selectedVehicle.model
                  ? `${selectedVehicle.make || ""} ${selectedVehicle.model || ""}`
                  : selectedVehicle.name}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] bg-muted/40 p-2.5 rounded-xl border border-border/50">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Speed</span>
                  <span className="font-semibold text-emerald-600 font-mono">
                    {selectedVehicle.speedKmh > 0 ? `${selectedVehicle.speedKmh} km/h` : "0 km/h (Stopped)"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Ignition</span>
                  <span className={selectedVehicle.ignition ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
                    {selectedVehicle.ignition ? "Engine ON" : "Engine OFF"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Odometer</span>
                  <span className="font-mono text-foreground">
                    {selectedVehicle.currentOdometerKm != null ? `${formatNumber(selectedVehicle.currentOdometerKm)} km` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Battery</span>
                  <span className="font-mono text-foreground">
                    {selectedVehicle.batteryVoltage ? `${selectedVehicle.batteryVoltage} V` : "—"}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Follow / Go with it, Share, Replay, Immobilizer */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant={followingVehicleId === selectedVehicle.vehicleId ? "default" : "outline"}
                  onClick={() => toggleFollow(selectedVehicle)}
                  className={`h-8 text-xs font-semibold ${
                    followingVehicleId === selectedVehicle.vehicleId
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <LocateFixed className="h-3.5 w-3.5 mr-1 text-current" />
                  {followingVehicleId === selectedVehicle.vehicleId ? "Following (Active)" : "Go With It (Chase)"}
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

              {/* Remote Immobilizer Action Strip */}
              {(() => {
                const isCut = Boolean((selectedVehicle as any).relay_cut || (selectedVehicle as any).engine_immobilized);
                return (
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground font-medium">Remote Relay</div>
                      <div className="text-xs font-semibold">
                        {isCut ? (
                          <span className="text-rose-600 inline-flex items-center gap-1">
                            <ZapOff className="h-3 w-3" /> Cut (Inhibited)
                          </span>
                        ) : (
                          <span className="text-emerald-600 inline-flex items-center gap-1">
                            <Zap className="h-3 w-3" /> Normal (Ready)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/gps/replay?vehicleId=${selectedVehicle.vehicleId}`}
                        className="h-7 text-xs px-2.5 inline-flex items-center rounded-lg border border-border hover:bg-muted text-muted-foreground font-medium"
                      >
                        <History className="h-3 w-3 mr-1 text-primary" />
                        Replay
                      </Link>

                      <Button
                        size="sm"
                        variant={isCut ? "default" : "destructive"}
                        disabled={immobilizing}
                        onClick={() => handleToggleImmobilizer(selectedVehicle)}
                        className={`h-7 text-xs px-2.5 font-semibold ${
                          isCut
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-rose-600 hover:bg-rose-700 text-white"
                        }`}
                      >
                        {immobilizing ? (
                          "Sending..."
                        ) : isCut ? (
                          <>
                            <Power className="h-3 w-3 mr-1" />
                            Restore
                          </>
                        ) : (
                          <>
                            <PowerOff className="h-3 w-3 mr-1" />
                            Cut
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })()}
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
              <strong>{shareVehicle?.plateNumber || shareVehicle?.name}</strong> live on their phone or desktop in real-time without signing in.
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
                  `Track vehicle ${shareVehicle?.plateNumber || shareVehicle?.name} live: ${shareUrl}`
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
                  `Track vehicle ${shareVehicle?.plateNumber || shareVehicle?.name} live: ${shareUrl}`
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
