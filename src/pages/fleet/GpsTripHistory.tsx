import { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getLiveGpsFleet,
  getVehicleRouteHistory,
  RouteHistoryReport,
  LiveTrackedVehicle,
} from "@/services/gpsService";
import { formatNumber } from "@/lib/format";
import {
  History,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  MapPin,
  Clock,
  Gauge,
  Navigation,
  Truck,
  Calendar,
  AlertCircle,
  Flag,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

export default function GpsTripHistory() {
  const { organisation } = useAuth();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [fetchingRoute, setFetchingRoute] = useState(false);
  const [vehicles, setVehicles] = useState<LiveTrackedVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");

  // Date range defaults: Today (00:00 to now)
  const todayStr = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(`${todayStr}T00:00`);
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 16));

  const [report, setReport] = useState<RouteHistoryReport | null>(null);

  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 5>(1);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const playbackMarkerRef = useRef<L.Marker | null>(null);
  const stopMarkersRef = useRef<L.Marker[]>([]);
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Load Vehicles
  useEffect(() => {
    if (!organisation?.id) return;
    getLiveGpsFleet(organisation.id).then((list) => {
      setVehicles(list);
      setLoading(false);
      const queryVehicle = searchParams.get("vehicleId");
      if (queryVehicle && list.some((v) => v.vehicleId === queryVehicle)) {
        setSelectedVehicleId(queryVehicle);
      } else if (list.length > 0) {
        setSelectedVehicleId(list[0].vehicleId);
      }
    });
  }, [organisation?.id, searchParams]);

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [-6.369028, 34.888822],
      zoom: 6,
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

  // 3. Fetch Route History
  const handleLoadRoute = async () => {
    if (!selectedVehicleId) {
      toast.error("Please select a vehicle to view history.");
      return;
    }
    setFetchingRoute(true);
    setIsPlaying(false);
    setPlaybackIndex(0);

    try {
      const data = await getVehicleRouteHistory(
        selectedVehicleId,
        new Date(startDate).toISOString(),
        new Date(endDate).toISOString()
      );

      setReport(data);

      if (!data || data.breadcrumbs.length === 0) {
        toast.info("No GPS telemetry breadcrumbs found for this time window.");
        // Clear old overlays
        if (polylineRef.current) polylineRef.current.remove();
        if (playbackMarkerRef.current) playbackMarkerRef.current.remove();
        stopMarkersRef.current.forEach((m) => m.remove());
        stopMarkersRef.current = [];
      } else {
        toast.success(`Loaded route: ${data.breadcrumbs.length} points, ${data.totalDistanceKm} km`);
        renderRouteOnMap(data);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load route history");
    } finally {
      setFetchingRoute(false);
    }
  };

  // 4. Render Route, Stops and Markers
  const renderRouteOnMap = (data: RouteHistoryReport) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing overlays
    if (polylineRef.current) polylineRef.current.remove();
    if (playbackMarkerRef.current) playbackMarkerRef.current.remove();
    stopMarkersRef.current.forEach((m) => m.remove());
    stopMarkersRef.current = [];

    const latLngs: L.LatLngExpression[] = data.breadcrumbs.map((b) => [b.latitude, b.longitude]);

    // Draw main route polyline
    const poly = L.polyline(latLngs, {
      color: "#2563eb",
      weight: 5,
      opacity: 0.85,
      lineJoin: "round",
    }).addTo(map);
    polylineRef.current = poly;

    // Fit map bounds to polyline
    map.fitBounds(poly.getBounds(), { padding: [40, 40] });

    // Start Pin (Green)
    const first = data.breadcrumbs[0];
    L.circleMarker([first.latitude, first.longitude], {
      radius: 8,
      fillColor: "#10b981",
      color: "#ffffff",
      weight: 2,
      fillOpacity: 1,
    })
      .addTo(map)
      .bindPopup(`<strong>Trip Origin:</strong> ${new Date(first.recordedAt).toLocaleTimeString()}`);

    // End Pin (Blue / Checkered)
    const last = data.breadcrumbs[data.breadcrumbs.length - 1];
    L.circleMarker([last.latitude, last.longitude], {
      radius: 8,
      fillColor: "#0284c7",
      color: "#ffffff",
      weight: 2,
      fillOpacity: 1,
    })
      .addTo(map)
      .bindPopup(`<strong>Latest / End:</strong> ${new Date(last.recordedAt).toLocaleTimeString()}`);

    // Stop Pins (Amber/Red)
    data.stops.forEach((s, idx) => {
      const stopMarker = L.circleMarker([s.latitude, s.longitude], {
        radius: 6,
        fillColor: "#f59e0b",
        color: "#ffffff",
        weight: 1.5,
        fillOpacity: 0.9,
      })
        .addTo(map)
        .bindPopup(
          `<div><strong>Stop #${idx + 1}</strong> (${s.durationMinutes} min)</div>
           <div class="text-xs text-gray-500">${new Date(s.startAt).toLocaleTimeString()} - ${new Date(s.endAt).toLocaleTimeString()}</div>`
        );
      stopMarkersRef.current.push(stopMarker);
    });

    // Create Playback Moving Marker
    const movingIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <span class="absolute h-6 w-6 rounded-full bg-primary/40 animate-ping"></span>
          <div class="relative flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-md border-2 border-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
            </svg>
          </div>
        </div>
      `,
      className: "custom-playback-marker",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const playbackMarker = L.marker([first.latitude, first.longitude], { icon: movingIcon }).addTo(map);
    playbackMarkerRef.current = playbackMarker;
  };

  // 5. Playback Animation Loop
  useEffect(() => {
    if (!isPlaying || !report || report.breadcrumbs.length === 0) {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
      return;
    }

    const interval = Math.max(300 / playbackSpeed, 50);

    animationTimerRef.current = setInterval(() => {
      setPlaybackIndex((prev) => {
        if (prev >= report.breadcrumbs.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        const next = prev + 1;
        const pt = report.breadcrumbs[next];
        if (playbackMarkerRef.current) {
          playbackMarkerRef.current.setLatLng([pt.latitude, pt.longitude]);
        }
        return next;
      });
    }, interval);

    return () => {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
    };
  }, [isPlaying, playbackSpeed, report]);

  // Handle timeline scrubber drag
  const handleScrubberChange = (idx: number) => {
    setPlaybackIndex(idx);
    if (report && report.breadcrumbs[idx] && playbackMarkerRef.current) {
      const pt = report.breadcrumbs[idx];
      playbackMarkerRef.current.setLatLng([pt.latitude, pt.longitude]);
    }
  };

  const currentPoint = report?.breadcrumbs[playbackIndex];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/fleet/live-map"
              className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <History className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Route History & Telematics Replay
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 ml-7">
            Analyze historical breadcrumb playback, stop durations, and speed trajectories along transit corridors.
          </p>
        </div>

        {/* Quick Date Presets */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8"
            onClick={() => {
              setStartDate(`${todayStr}T00:00`);
              setEndDate(new Date().toISOString().slice(0, 16));
            }}
          >
            Today
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8"
            onClick={() => {
              const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
              setStartDate(`${yest}T00:00`);
              setEndDate(`${yest}T23:59`);
            }}
          >
            Yesterday
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8"
            onClick={() => {
              const past7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
              setStartDate(`${past7}T00:00`);
              setEndDate(new Date().toISOString().slice(0, 16));
            }}
          >
            Past 7 Days
          </Button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div>
          <Label className="text-xs font-medium">Select Vehicle</Label>
          <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
            <SelectTrigger className="mt-1">
              <Truck className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Choose vehicle..." />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((v) => (
                <SelectItem key={v.vehicleId} value={v.vehicleId}>
                  {v.name} ({v.plateNumber || "No Plate"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs font-medium">From Date & Time</Label>
          <Input
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 text-xs"
          />
        </div>

        <div>
          <Label className="text-xs font-medium">To Date & Time</Label>
          <Input
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 text-xs"
          />
        </div>

        <div className="flex items-end">
          <Button
            onClick={handleLoadRoute}
            disabled={fetchingRoute || !selectedVehicleId}
            className="w-full gap-2"
          >
            <Navigation className="h-4 w-4" />
            {fetchingRoute ? "Querying Telemetry..." : "Load Route"}
          </Button>
        </div>
      </div>

      {/* Metrics Strip */}
      {report && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground uppercase">GPS Distance</span>
            <div className="text-xl font-bold tracking-tight text-foreground mt-1">
              {report.totalDistanceKm} km
            </div>
            <span className="text-[11px] text-muted-foreground">Validated trajectory</span>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground uppercase">Driving Time</span>
            <div className="text-xl font-bold tracking-tight text-emerald-600 mt-1">
              {Math.floor(report.drivingDurationMinutes / 60)}h {report.drivingDurationMinutes % 60}m
            </div>
            <span className="text-[11px] text-muted-foreground">In active motion</span>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground uppercase">Stops & Idling</span>
            <div className="text-xl font-bold tracking-tight text-amber-600 mt-1">
              {report.stops.length} Stops ({Math.floor(report.stopDurationMinutes / 60)}h {report.stopDurationMinutes % 60}m)
            </div>
            <span className="text-[11px] text-muted-foreground">Parked / Station time</span>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground uppercase">Max Speed</span>
            <div className="text-xl font-bold tracking-tight text-foreground mt-1">
              {report.maxSpeedKmh} km/h
            </div>
            <span className="text-[11px] text-muted-foreground">Avg: {report.avgSpeedKmh} km/h</span>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground uppercase">Pings Recorded</span>
            <div className="text-xl font-bold tracking-tight text-primary mt-1">
              {report.breadcrumbs.length}
            </div>
            <span className="text-[11px] text-muted-foreground">Breadcrumb points</span>
          </div>
        </div>
      )}

      {/* Map & Timeline Replay */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm flex flex-col">
        {/* Leaflet Map Canvas */}
        <div ref={mapContainerRef} className="h-[460px] w-full" />

        {/* Playback Controls & Timeline Scrubber */}
        {report && report.breadcrumbs.length > 0 && (
          <div className="p-4 border-t border-border bg-muted/20 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="h-8 gap-1.5 font-medium"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {isPlaying ? "Pause" : "Play Replay"}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsPlaying(false);
                    handleScrubberChange(0);
                  }}
                  className="h-8 w-8 p-0"
                  title="Reset to Start"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-1 border-l border-border pl-2 ml-1">
                  <span className="text-xs text-muted-foreground mr-1">Speed:</span>
                  {[1, 2, 5].map((spd) => (
                    <Button
                      key={spd}
                      size="sm"
                      variant={playbackSpeed === spd ? "default" : "outline"}
                      onClick={() => setPlaybackSpeed(spd as any)}
                      className="h-7 text-xs px-2"
                    >
                      {spd}x
                    </Button>
                  ))}
                </div>
              </div>

              {/* Point Telemetry Card */}
              {currentPoint && (
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(currentPoint.recordedAt).toLocaleTimeString()}
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <Gauge className="h-3.5 w-3.5 text-primary" />
                    {currentPoint.speedKmh} km/h
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                    currentPoint.ignition ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
                  }`}>
                    {currentPoint.ignition ? "IGNITION ON" : "IGNITION OFF"}
                  </span>
                  {currentPoint.batteryVoltage && (
                    <span className="text-muted-foreground font-mono">
                      {currentPoint.batteryVoltage.toFixed(1)}V
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Scrubber Range Slider */}
            <div className="space-y-1">
              <input
                type="range"
                min={0}
                max={report.breadcrumbs.length - 1}
                value={playbackIndex}
                onChange={(e) => handleScrubberChange(Number(e.target.value))}
                className="w-full accent-primary h-2 cursor-pointer bg-muted rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>Start: {new Date(report.breadcrumbs[0].recordedAt).toLocaleTimeString()}</span>
                <span>
                  Point {playbackIndex + 1} of {report.breadcrumbs.length}
                </span>
                <span>
                  End: {new Date(report.breadcrumbs[report.breadcrumbs.length - 1].recordedAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stop Points Table */}
      {report && report.stops.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-amber-500" />
            <h3 className="font-semibold text-sm">Detected Stops & Station Idling</h3>
            <span className="text-xs text-muted-foreground">({report.stops.length} stops exceeding 3 minutes)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/30 text-muted-foreground uppercase">
                <tr>
                  <th className="py-2 px-3 font-semibold">Stop #</th>
                  <th className="py-2 px-3 font-semibold">Arrival Time</th>
                  <th className="py-2 px-3 font-semibold">Departure Time</th>
                  <th className="py-2 px-3 font-semibold">Duration</th>
                  <th className="py-2 px-3 font-semibold">Coordinates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.stops.map((s, idx) => (
                  <tr key={idx} className="hover:bg-muted/20">
                    <td className="py-2.5 px-3 font-bold text-foreground">Stop {idx + 1}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{new Date(s.startAt).toLocaleTimeString()}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{new Date(s.endAt).toLocaleTimeString()}</td>
                    <td className="py-2.5 px-3 font-semibold text-amber-600">{s.durationMinutes} minutes</td>
                    <td className="py-2.5 px-3 font-mono text-muted-foreground">
                      {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
