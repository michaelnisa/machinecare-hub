import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getGeofences,
  createGeofence,
  deleteGeofence,
  Geofence,
} from "@/services/gpsService";
import {
  Target,
  Plus,
  Trash2,
  MapPin,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

export default function GpsGeofences() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [geofences, setGeofences] = useState<Geofence[]>([]);

  // Create Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [geofenceType, setGeofenceType] = useState<"circle" | "polygon">("circle");
  const [centerLat, setCenterLat] = useState("-6.8211");
  const [centerLng, setCenterLng] = useState("39.2812");
  const [radiusMeters, setRadiusMeters] = useState("1000");
  const [speedLimit, setSpeedLimit] = useState("");
  const [entryAlert, setEntryAlert] = useState(true);
  const [exitAlert, setExitAlert] = useState(true);
  const [color, setColor] = useState("#2563eb");

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geofenceLayersRef = useRef<Map<string, L.Layer>>(new Map());

  const loadData = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const data = await getGeofences(organisation.id);
      setGeofences(data);
    } catch (err) {
      toast.error("Failed to load geofences");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  // Initialize Map
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

    // Map click handler to pre-fill coordinates
    map.on("click", (e: L.LeafletMouseEvent) => {
      setCenterLat(e.latlng.lat.toFixed(6));
      setCenterLng(e.latlng.lng.toFixed(6));
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Render Geofence Shapes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing
    geofenceLayersRef.current.forEach((layer) => layer.remove());
    geofenceLayersRef.current.clear();

    const bounds = L.latLngBounds([]);
    let count = 0;

    geofences.forEach((g) => {
      if (g.geofence_type === "circle" && g.center_latitude != null && g.center_longitude != null) {
        const circle = L.circle([g.center_latitude, g.center_longitude], {
          radius: g.radius_meters || 1000,
          color: g.color || "#2563eb",
          fillColor: g.color || "#2563eb",
          fillOpacity: 0.25,
          weight: 2,
        }).addTo(map);

        circle.bindPopup(
          `<div><strong>${g.name}</strong></div>
           <div class="text-xs text-gray-500">${g.description || "Geofenced zone"}</div>
           <div class="text-xs mt-1">Radius: ${g.radius_meters || 1000}m</div>`
        );

        geofenceLayersRef.current.set(g.id, circle);
        bounds.extend([g.center_latitude, g.center_longitude]);
        count++;
      }
    });

    if (count > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [geofences]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id) return;
    if (!name.trim()) {
      toast.error("Please enter a geofence name.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createGeofence(organisation.id, {
        name: name.trim(),
        description: description.trim() || null,
        geofence_type: geofenceType,
        center_latitude: Number(centerLat),
        center_longitude: Number(centerLng),
        radius_meters: Number(radiusMeters || 1000),
        polygon_coordinates: null,
        speed_limit_kmh: speedLimit ? Number(speedLimit) : null,
        color,
        entry_alert: entryAlert,
        exit_alert: exitAlert,
        active: true,
      });

      if (!res.success) throw new Error(res.error || "Failed to create geofence");

      toast.success("Geofence perimeter created successfully!");
      setModalOpen(false);
      setName("");
      setDescription("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create geofence");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, zoneName: string) => {
    if (!confirm(`Are you sure you want to remove geofence '${zoneName}'?`)) return;
    try {
      const res = await deleteGeofence(id);
      if (!res.success) throw new Error(res.error || "Failed to delete");
      toast.success("Geofence removed");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete geofence");
    }
  };

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
            <Target className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Geofence Perimeters & Designated Zones
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 ml-7">
            Configure depots, warehouses, customer facilities, and corridor border checkpoints with automated entry and exit alerts.
          </p>
        </div>

        <Button onClick={() => setModalOpen(true)} className="gap-1.5 text-xs">
          <Plus className="h-4 w-4" />
          Create Geofence
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: Map */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden shadow-sm h-[520px]">
          <div ref={mapContainerRef} className="h-full w-full" />
        </div>

        {/* Right: Geofence List */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col justify-between h-[520px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <h3 className="font-semibold text-sm text-foreground">Active Perimeters ({geofences.length})</h3>
              <span className="text-[11px] text-muted-foreground">Click map to set coordinates</span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[420px] pr-1">
              {geofences.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground italic">
                  No geofence perimeters configured. Click "Create Geofence" to define depots, hubs, or restricted zones.
                </div>
              ) : (
                geofences.map((g) => (
                  <div
                    key={g.id}
                    className="p-3 rounded-lg border border-border bg-background/80 hover:bg-background transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: g.color || "#2563eb" }}
                        />
                        <span className="font-semibold text-xs text-foreground truncate">{g.name}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{g.description || "Circular zone"}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        <span>Radius: {g.radius_meters || 1000}m</span>
                        {g.speed_limit_kmh && (
                          <span className="font-semibold text-amber-600">Limit: {g.speed_limit_kmh} km/h</span>
                        )}
                        <span>{g.entry_alert ? "Entry Alert" : ""}</span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600"
                      onClick={() => handleDelete(g.id, g.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Define New Geofence Perimeter
            </DialogTitle>
            <DialogDescription>
              Create automated telematics entry and departure alerts for this zone.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Geofence Name *</Label>
              <Input
                required
                placeholder="e.g. Dar es Salaam Port Terminal, Dodoma Central Depot"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Description</Label>
              <Input
                placeholder="Optional notes or facility address"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Center Latitude *</Label>
                <Input
                  required
                  value={centerLat}
                  onChange={(e) => setCenterLat(e.target.value)}
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Center Longitude *</Label>
                <Input
                  required
                  value={centerLng}
                  onChange={(e) => setCenterLng(e.target.value)}
                  className="mt-1 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Radius (Meters) *</Label>
                <Input
                  type="number"
                  required
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(e.target.value)}
                  className="mt-1 text-xs"
                />
                <div className="flex gap-1 mt-1">
                  {["250", "500", "1000", "2000"].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRadiusMeters(r)}
                      className="px-1.5 py-0.5 rounded bg-muted text-[10px] hover:bg-muted/80 text-muted-foreground"
                    >
                      {Number(r) >= 1000 ? `${Number(r) / 1000}km` : `${r}m`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs">Speed Limit (km/h)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 25 km/h inside yard"
                  value={speedLimit}
                  onChange={(e) => setSpeedLimit(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={entryAlert}
                  onCheckedChange={(c) => setEntryAlert(Boolean(c))}
                />
                <span>Alert on Entry</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={exitAlert}
                  onCheckedChange={(c) => setExitAlert(Boolean(c))}
                />
                <span>Alert on Exit</span>
              </label>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save Geofence"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
