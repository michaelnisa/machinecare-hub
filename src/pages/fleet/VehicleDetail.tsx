import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { CoverImage } from "@/components/CoverImage";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { MachineStatusControl } from "@/components/MachineStatusControl";
import { MachineQrDialog } from "@/components/MachineQrDialog";
import { formatDate, formatNumber, formatMoney } from "@/lib/format";
import { toast } from "sonner";
import {
  SAFE_MACHINE_COLUMNS,
  SAFE_DRIVER_COLUMNS,
  SAFE_TRIP_COLUMNS,
  SAFE_TYRE_COLUMNS,
  parseMachine,
  parseDriver,
  parseTrip,
  AXLE_CONFIG_OPTIONS,
  type FleetVehicle,
  type FleetDriver,
  type FleetTrip,
} from "@/lib/fleet-metadata";
import { VehicleDialog } from "./Vehicles";
import {
  Truck,
  Container,
  ArrowLeft,
  QrCode,
  Pencil,
  Plus,
  Layers,
  Link2,
  Fuel,
  Wrench,
  Clock,
  Gauge,
  Phone,
  User,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Shield,
  Navigation,
  Disc,
  History,
  FileSpreadsheet,
  Upload,
  Loader2,
  ExternalLink,
} from "lucide-react";

type Trip = {
  id: string;
  machine_id: string;
  driver_id: string | null;
  status: string;
  origin: string | null;
  destination: string | null;
  cargo_description: string | null;
  start_at: string | null;
  end_at: string | null;
  start_odo: number | null;
  end_odo: number | null;
  fuel_used_l: number | null;
  purpose: string | null;
};

type Tyre = {
  id: string;
  machine_id: string;
  position: string;
  brand: string | null;
  size: string | null;
  serial: string | null;
  fitted_at: string | null;
  fitted_odo: number | null;
  current_tread_mm: number | null;
  target_replace_km: number | null;
  notes: string | null;
};

type Schedule = {
  id: string;
  name: string;
  service_type: string;
  interval_days: number | null;
  interval_hours: number | null;
  next_due_date: string | null;
  next_due_hours: number | null;
  status: string;
};

type ServiceLog = {
  id: string;
  service_date: string;
  service_type: string;
  description: string;
  meter_hours: number | null;
  cost_total: number | null;
  performed_by: string | null;
};

type VehicleDoc = {
  id: string;
  machine_id: string;
  doc_type: string;
  number: string | null;
  issued_on: string | null;
  expires_on: string | null;
  reminder_days: number;
  notes: string | null;
};

export default function FleetVehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { canWrite, isManager } = useUserRole();

  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<FleetVehicle | null>(null);
  const [allTrailers, setAllTrailers] = useState<FleetVehicle[]>([]);
  const [trips, setTrips] = useState<FleetTrip[]>([]);
  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [serviceLogs, setServiceLogs] = useState<ServiceLog[]>([]);
  const [documents, setDocuments] = useState<VehicleDoc[]>([]);
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  // Odometer reading modal
  const [odoOpen, setOdoOpen] = useState(false);
  const [odoValue, setOdoValue] = useState("");
  const [hoursValue, setHoursValue] = useState("");
  const [odoSaving, setOdoSaving] = useState(false);

  // Document upload modal
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docType, setDocType] = useState("insurance");
  const [docNumber, setDocNumber] = useState("");
  const [docIssued, setDocIssued] = useState("");
  const [docExpiry, setDocExpiry] = useState("");
  const [docNotes, setDocNotes] = useState("");
  const [docSaving, setDocSaving] = useState(false);

  const load = async () => {
    if (!profile || !id) return;
    setLoading(true);

    try {
      const [
        { data: rawVeh, error: eVeh },
        { data: rawTrips, error: eTrips },
        { data: rawTyres, error: eTyres },
        { data: rawSched, error: eSched },
        { data: rawLogs, error: eLogs },
        { data: rawDocs, error: eDocs },
        { data: rawDrivers, error: eDrivers },
        { data: rawAllVeh, error: eAllVeh },
      ] = await Promise.all([
        supabase.from("machines").select(SAFE_MACHINE_COLUMNS).eq("id", id).maybeSingle(),
        supabase.from("trips").select(SAFE_TRIP_COLUMNS).eq("machine_id", id).order("start_at", { ascending: false }).limit(20),
        supabase.from("machine_tyres").select(SAFE_TYRE_COLUMNS).eq("machine_id", id).is("removed_at", null).order("position"),
        supabase.from("service_schedules").select("*").eq("machine_id", id).order("next_due_date"),
        supabase.from("service_logs").select("*").eq("machine_id", id).order("service_date", { ascending: false }).limit(20),
        supabase.from("vehicle_documents").select("*").eq("machine_id", id).order("expires_on"),
        supabase.from("drivers").select(SAFE_DRIVER_COLUMNS),
        supabase.from("machines").select(SAFE_MACHINE_COLUMNS).in("category", ["Vehicle", "Trailer"]),
      ]);

      if (eVeh) throw eVeh;
      if (!rawVeh) {
        setVehicle(null);
        setLoading(false);
        return;
      }

      const parsedVehicle = parseMachine(rawVeh);
      setVehicle(parsedVehicle);
      setTrips(((rawTrips ?? []).map(parseTrip)) as FleetTrip[]);
      setTyres((rawTyres ?? []) as Tyre[]);
      setSchedules((rawSched ?? []) as Schedule[]);
      setServiceLogs((rawLogs ?? []) as ServiceLog[]);
      setDocuments((rawDocs ?? []) as VehicleDoc[]);
      setDrivers(((rawDrivers ?? []).map(parseDriver)) as FleetDriver[]);
      setAllTrailers(((rawAllVeh ?? []).map(parseMachine)) as FleetVehicle[]);

      setOdoValue(parsedVehicle.current_odometer_km != null ? String(parsedVehicle.current_odometer_km) : "");
      setHoursValue(parsedVehicle.current_hours != null ? String(parsedVehicle.current_hours) : "");
    } catch (err: any) {
      toast.error(err.message || "Failed to load vehicle details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id, profile]);

  // Current Driver lookup
  const currentDriver = useMemo(() => {
    if (!trips.length) return null;
    const activeTrip = trips.find((t) => t.status === "in_progress" && t.driver_id);
    const targetTrip = activeTrip || trips.find((t) => t.driver_id);
    if (!targetTrip || !targetTrip.driver_id) return null;
    const driver = drivers.find((d) => d.id === targetTrip.driver_id);
    return {
      driver,
      onTrip: targetTrip.status === "in_progress",
    };
  }, [trips, drivers]);

  // Axle configuration match
  const axleMatch = useMemo(() => {
    if (!vehicle) return null;
    return AXLE_CONFIG_OPTIONS.find((a) => a.value === vehicle.axle_configuration);
  }, [vehicle]);

  // Document expiry check
  const earliestExpiry = useMemo(() => {
    if (!documents.length) return null;
    const now = new Date();
    const sorted = [...documents]
      .filter((d) => d.expires_on)
      .sort((a, b) => new Date(a.expires_on!).getTime() - new Date(b.expires_on!).getTime());
    if (!sorted.length) return null;
    const earliest = sorted[0];
    const days = Math.ceil((new Date(earliest.expires_on!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      doc: earliest,
      days,
      isOverdue: days < 0,
      isSoon: days >= 0 && days <= 30,
    };
  }, [documents]);

  const saveOdometer = async () => {
    if (!vehicle || !profile) return;
    setOdoSaving(true);
    try {
      const km = odoValue.trim() ? Number(odoValue) : null;
      const hours = hoursValue.trim() ? Number(hoursValue) : null;

      const { error } = await supabase
        .from("machines")
        .update({
          current_odometer_km: km,
          current_hours: hours,
        })
        .eq("id", vehicle.id);

      if (error) throw error;
      toast.success("Odometer and operating hours updated");
      setOdoOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to update odometer");
    } finally {
      setOdoSaving(false);
    }
  };

  const saveDocument = async () => {
    if (!vehicle || !profile) return;
    if (!docExpiry) return toast.error("Expiry date is required");
    setDocSaving(true);
    try {
      const { error } = await supabase.from("vehicle_documents").insert({
        organisation_id: profile.organisation_id,
        machine_id: vehicle.id,
        doc_type: docType,
        number: docNumber.trim() || null,
        issued_on: docIssued || null,
        expires_on: docExpiry,
        reminder_days: 30,
        notes: docNotes.trim() || null,
      });

      if (error) throw error;
      toast.success("Document recorded successfully");
      setDocModalOpen(false);
      setDocNumber("");
      setDocIssued("");
      setDocExpiry("");
      setDocNotes("");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to record document");
    } finally {
      setDocSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  if (!vehicle) {
    return (
      <div className="space-y-4 p-4">
        <Link to="/fleet/vehicles" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Fleet Registry
        </Link>
        <EmptyState
          icon={<Truck className="h-8 w-8 text-muted-foreground" />}
          title="Vehicle or Trailer Not Found"
          description="The requested fleet asset could not be located or has been archived."
          action={
            <Button onClick={() => navigate("/fleet/vehicles")}>
              Return to Fleet Registry
            </Button>
          }
        />
      </div>
    );
  }

  const isTrailer = vehicle.is_trailer || vehicle.category === "Trailer";
  const totalTank = vehicle.total_tank_capacity_l ?? vehicle.tank_capacity_l;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/fleet/vehicles"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Fleet Registry
        </Link>
        <span className="text-xs text-muted-foreground">Logistics & Fleet Management</span>
      </div>

      {/* Main Asset Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/60 shadow-2xs">
            <CoverImage
              value={vehicle.cover_image_url}
              alt={vehicle.name}
              className="h-full w-full object-cover"
              fallback={isTrailer ? <Container className="h-8 w-8 text-emerald-600" /> : <Truck className="h-8 w-8 text-muted-foreground" />}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {vehicle.name}
              </h1>

              {/* Official Corporate Asset ID Pill */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-muted/80 text-foreground border border-border">
                <span className="text-[10px] uppercase font-sans text-muted-foreground">ID</span>
                <span>{vehicle.vehicle_code}</span>
              </span>

              {isTrailer ? (
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 border border-emerald-500/20">
                  Independent Trailer
                </span>
              ) : (
                <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-600 border border-blue-500/20">
                  Power Unit / Truck
                </span>
              )}

              <MachineStatusControl
                machineId={vehicle.id}
                status={vehicle.status}
                onChanged={load}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground font-mono">{vehicle.plate_number || "No Plate"}</span>
              <span>•</span>
              <span>{[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" · ") || (isTrailer ? "Semi-Trailer" : "Heavy Commercial")}</span>
              <span>•</span>
              <span className="capitalize">{vehicle.vehicle_type?.replace("_", " ")}</span>
              {vehicle.home_depot && (
                <>
                  <span>•</span>
                  <span>Base: {vehicle.home_depot}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQrOpen(true)}
            className="gap-1.5 shadow-2xs"
          >
            <QrCode className="h-4 w-4 text-primary" /> QR Code
          </Button>

          {canWrite && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
              className="gap-1.5 shadow-2xs"
            >
              <Pencil className="h-4 w-4" /> Edit Asset
            </Button>
          )}

          {!isTrailer && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-1.5 shadow-2xs"
            >
              <Link to="/fleet/trips">
                <Navigation className="h-4 w-4 text-blue-600" /> Dispatch
              </Link>
            </Button>
          )}

          {canWrite && (
            <Button
              size="sm"
              asChild
              className="gap-1.5 shadow-xs"
            >
              <Link to={`/work-orders/new?machine=${vehicle.id}`}>
                <ClipboardList className="h-4 w-4" /> Job Card
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Fleet KPI Quick Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Odometer / Operating Hours */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Odometer & Usage</span>
            <Gauge className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-foreground">
              {vehicle.current_odometer_km != null ? `${formatNumber(vehicle.current_odometer_km)} km` : "—"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {vehicle.current_hours != null ? `${formatNumber(vehicle.current_hours)} operating hrs` : "0 operating hrs"}
            </div>
          </div>
          {canWrite && (
            <button
              type="button"
              onClick={() => setOdoOpen(true)}
              className="text-[11px] font-semibold text-primary hover:underline mt-2 text-left cursor-pointer inline-flex items-center gap-1"
            >
              + Update odometer reading
            </button>
          )}
        </div>

        {/* Assigned Driver */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Current / Assigned Driver</span>
            <User className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            {currentDriver?.driver ? (
              <div>
                <div className="font-bold text-foreground text-base leading-tight">
                  {currentDriver.driver.full_name}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-muted text-foreground border">
                    ID {currentDriver.driver.driver_code}
                  </span>
                  {currentDriver.onTrip && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> On trip
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground italic">No driver assigned</div>
            )}
          </div>
          {currentDriver?.driver?.phone && (
            <a
              href={`tel:${currentDriver.driver.phone}`}
              className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors mt-2 flex items-center gap-1"
            >
              <Phone className="h-3 w-3" /> {currentDriver.driver.phone}
            </a>
          )}
        </div>

        {/* Axle Layout & Tyres */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Axle & Wheel Layout</span>
            <Layers className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <div className="font-bold text-foreground text-sm truncate" title={axleMatch?.label}>
              {axleMatch ? axleMatch.label.split("(")[0].trim() : vehicle.axle_configuration || "6x4"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {axleMatch ? `${axleMatch.tyreCount} wheel positions` : "Configured"} • {tyres.length} tyres fitted
            </div>
          </div>
          <Link
            to="/fleet/tyres"
            className="text-[11px] font-semibold text-primary hover:underline mt-2 text-left inline-flex items-center gap-1"
          >
            Manage tyre fitment →
          </Link>
        </div>

        {/* Hitched Unit & Tank Capacity */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Hitch & Tank Capacity</span>
            <Fuel className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2">
            <div className="font-bold text-foreground text-base">
              {totalTank ? `${formatNumber(totalTank)} L` : "No tank recorded"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {!isTrailer ? (
                vehicle.has_trailer && vehicle.trailer_plate ? (
                  <span className="font-medium text-primary flex items-center gap-1 truncate">
                    <Link2 className="h-3 w-3" /> Trailer: {vehicle.trailer_plate}
                  </span>
                ) : (
                  <span>Solo (No trailer attached)</span>
                )
              ) : (
                <span>Independent Semi-Trailer</span>
              )}
            </div>
          </div>
          {earliestExpiry ? (
            <div className="text-[11px] font-medium text-muted-foreground mt-2 truncate">
              {earliestExpiry.isOverdue ? (
                <span className="text-destructive font-semibold">● Doc expired ({earliestExpiry.doc.doc_type})</span>
              ) : earliestExpiry.isSoon ? (
                <span className="text-amber-600 font-semibold">● Doc expires in {earliestExpiry.days}d</span>
              ) : (
                <span className="text-emerald-600">● Compliance valid</span>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground mt-2">All checks recorded</span>
          )}
        </div>
      </div>

      {/* Main Tabbed Sections */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/60 p-1 flex-wrap">
          <TabsTrigger value="overview" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Fleet Dossier
          </TabsTrigger>
          <TabsTrigger value="axles" className="gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Axles & Tyres ({tyres.length})
          </TabsTrigger>
          <TabsTrigger value="trips" className="gap-1.5">
            <Navigation className="h-3.5 w-3.5" /> Trips ({trips.length})
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-1.5">
            <Wrench className="h-3.5 w-3.5" /> Maintenance & PM ({schedules.length})
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Documents ({documents.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview & Fleet Dossier */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Asset Identity Card */}
            <div className="p-5 rounded-2xl border border-border bg-card shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/80">
                <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" /> Vehicle Identification
                </h3>
                <span className="text-xs font-mono font-bold bg-muted px-2 py-0.5 rounded text-muted-foreground border">
                  {vehicle.vehicle_code}
                </span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Registration Plate:</span>
                  <span className="font-bold text-foreground font-mono text-base">{vehicle.plate_number || "—"}</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Make & Model:</span>
                  <span className="font-semibold text-foreground">
                    {[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Manufacture Year:</span>
                  <span className="font-medium text-foreground">{vehicle.year || "—"}</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">VIN / Chassis Number:</span>
                  <span className="font-mono text-xs text-foreground bg-muted/60 px-2 py-0.5 rounded border">
                    {vehicle.vin || "Not recorded"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Vehicle Classification:</span>
                  <span className="capitalize font-medium text-foreground">
                    {vehicle.vehicle_type?.replace("_", " ") || "Commercial Transport"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Fuel Propulsion:</span>
                  <span className="capitalize font-medium text-foreground flex items-center gap-1.5">
                    <Fuel className="h-3.5 w-3.5 text-amber-600" />
                    {vehicle.fuel_type || "Diesel"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Home Depot / Terminal:</span>
                  <span className="font-medium text-foreground">{vehicle.home_depot || "Default Depot"}</span>
                </div>
              </div>
            </div>

            {/* Logistics & Hitching Card */}
            <div className="p-5 rounded-2xl border border-border bg-card shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/80">
                <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-blue-600" /> Hitching & Fleet Capacities
                </h3>
                <span className="text-xs text-muted-foreground">Logistics Specs</span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Trailer Hitch Status:</span>
                  {isTrailer ? (
                    <span className="font-semibold text-emerald-600">Independent Cargo Unit</span>
                  ) : vehicle.has_trailer && vehicle.trailer_plate ? (
                    <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary border border-primary/20">
                      <Link2 className="h-3 w-3" /> Hitched: {vehicle.trailer_plate}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">Solo (No trailer attached)</span>
                  )}
                </div>

                {vehicle.has_trailer && vehicle.trailer_make_model && (
                  <div className="flex items-center justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Coupled Trailer Model:</span>
                    <span className="font-medium text-foreground">{vehicle.trailer_make_model}</span>
                  </div>
                )}

                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Total Combined Fuel / Tank:</span>
                  <span className="font-bold text-foreground text-base">
                    {totalTank ? `${formatNumber(totalTank)} Litres` : "—"}
                  </span>
                </div>

                {vehicle.head_tank_capacity_l != null && (
                  <div className="flex items-center justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Tractor Head Tank:</span>
                    <span className="font-medium text-foreground">{formatNumber(vehicle.head_tank_capacity_l)} L</span>
                  </div>
                )}

                {vehicle.trailer_tank_capacity_l != null && (
                  <div className="flex items-center justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Trailer Tank Payload:</span>
                    <span className="font-medium text-foreground">{formatNumber(vehicle.trailer_tank_capacity_l)} L</span>
                  </div>
                )}

                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Automated PM Alerts:</span>
                  <span className="font-medium text-foreground">
                    {vehicle.auto_pm_enabled ? (
                      <span className="text-emerald-600 font-semibold inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Enabled (Every {vehicle.auto_pm_hours_interval ?? 250} hrs)
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Manual schedule</span>
                    )}
                  </span>
                </div>

                {vehicle.user_notes && (
                  <div className="pt-2">
                    <span className="text-xs text-muted-foreground font-semibold block mb-1">Dispatcher Remarks & Notes:</span>
                    <div className="p-2.5 rounded-lg bg-muted/40 text-xs text-foreground italic border">
                      {vehicle.user_notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Axles & Tyres */}
        <TabsContent value="axles" className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" /> Fitted Tyres & Axle Layout
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Layout: {axleMatch ? axleMatch.label : vehicle.axle_configuration} ({axleMatch ? axleMatch.description : ""})
                </p>
              </div>

              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <Link to="/fleet/tyres">
                  <Disc className="h-3.5 w-3.5 text-primary" /> Full Tyre Management
                </Link>
              </Button>
            </div>

            {tyres.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <Disc className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">No tyres currently registered to this vehicle's axle positions.</p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/fleet/tyres">Fit Tyres in Tyre Module</Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/30">
                    <tr>
                      <th className="px-4 py-3 font-medium">Position</th>
                      <th className="px-4 py-3 font-medium">Brand & Pattern</th>
                      <th className="px-4 py-3 font-medium">Size</th>
                      <th className="px-4 py-3 font-medium">Serial Number</th>
                      <th className="px-4 py-3 font-medium">Fitted Date / Odo</th>
                      <th className="px-4 py-3 font-medium">Tread Depth</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tyres.map((t) => (
                      <tr key={t.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded border text-xs">
                            {t.position}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">{t.brand || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{t.size || "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-foreground">{t.serial || "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {t.fitted_at ? formatDate(t.fitted_at) : "—"}
                          {t.fitted_odo != null && ` (${formatNumber(t.fitted_odo)} km)`}
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {t.current_tread_mm != null ? `${t.current_tread_mm} mm` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {t.current_tread_mm != null && t.current_tread_mm <= 3.0 ? (
                            <span className="rounded bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive border border-destructive/20">
                              Replace Soon
                            </span>
                          ) : (
                            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 border border-emerald-500/20">
                              Good Tread
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Trips & Dispatches */}
        <TabsContent value="trips" className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-primary" /> Trip Dispatch History
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Trips logged for this asset</p>
              </div>

              {!isTrailer && (
                <Button size="sm" asChild className="gap-1.5">
                  <Link to="/fleet/trips">
                    <Plus className="h-4 w-4" /> Create Trip Dispatch
                  </Link>
                </Button>
              )}
            </div>

            {trips.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <Navigation className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">No trips recorded for this vehicle yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/30">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date & Route</th>
                      <th className="px-4 py-3 font-medium">Cargo / Purpose</th>
                      <th className="px-4 py-3 font-medium">Driver</th>
                      <th className="px-4 py-3 font-medium">Odometer Range</th>
                      <th className="px-4 py-3 font-medium">Distance</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.map((tr) => {
                      const driver = drivers.find((d) => d.id === tr.driver_id);
                      const distance = tr.start_odo != null && tr.end_odo != null ? tr.end_odo - tr.start_odo : null;

                      return (
                        <tr key={tr.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">
                              {tr.origin || "Origin"} → {tr.destination || "Destination"}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {tr.start_at ? formatDate(tr.start_at) : "Scheduled"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {tr.client_name ? (
                              <span className="font-semibold text-foreground block">{tr.client_name}</span>
                            ) : null}
                            <span>{tr.raw_cargo || (tr as any).purpose || "General freight"}</span>
                          </td>
                          <td className="px-4 py-3 text-foreground font-medium">
                            {driver ? driver.full_name : "Unassigned"}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                            {tr.start_odo != null ? `${formatNumber(tr.start_odo)}` : "—"} - {tr.end_odo != null ? `${formatNumber(tr.end_odo)}` : "—"} km
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {distance != null && distance >= 0 ? `${formatNumber(distance)} km` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={tr.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 4: Maintenance & PM Schedules */}
        <TabsContent value="maintenance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PM Schedules */}
            <div className="p-5 rounded-2xl border border-border bg-card shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" /> Active PM Schedules
                </h3>
                <span className="text-xs text-muted-foreground">{schedules.length} schedules</span>
              </div>

              {schedules.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No active preventive maintenance schedules set for this unit.
                </div>
              ) : (
                <div className="space-y-3">
                  {schedules.map((s) => (
                    <div key={s.id} className="p-3 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-foreground text-sm">{s.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {s.interval_hours ? `Every ${s.interval_hours} operating hours` : `Every ${s.interval_days ?? 90} days`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-foreground">
                          {s.next_due_date ? formatDate(s.next_due_date) : (s.next_due_hours ? `${formatNumber(s.next_due_hours)} hrs` : "Pending")}
                        </div>
                        <span className="inline-block mt-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                          Active PM
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Historical Service Logs */}
            <div className="p-5 rounded-2xl border border-border bg-card shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                  <History className="h-4 w-4 text-emerald-600" /> Recent Service History
                </h3>
                <span className="text-xs text-muted-foreground">{serviceLogs.length} records</span>
              </div>

              {serviceLogs.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No completed service logs recorded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {serviceLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-foreground text-sm capitalize">
                          {log.service_type?.replace("_", " ") || "Maintenance Service"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {log.description || "General maintenance and fluids inspection"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-semibold text-foreground">
                          {formatDate(log.service_date)}
                        </div>
                        {log.cost_total != null && (
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">
                            {formatMoney(log.cost_total)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 5: Documents & Compliance */}
        <TabsContent value="documents" className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" /> Vehicle Legal Documents & Permits
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Track Insurance, Road Licence, Fitness Certificates, and LATRA permits
                </p>
              </div>

              {canWrite && (
                <Button size="sm" onClick={() => setDocModalOpen(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Add Document
                </Button>
              )}
            </div>

            {documents.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">No documents uploaded for this asset yet.</p>
                {canWrite && (
                  <Button variant="outline" size="sm" onClick={() => setDocModalOpen(true)}>
                    Upload First Document
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-4">
                {documents.map((doc) => {
                  const now = new Date();
                  const expiry = doc.expires_on ? new Date(doc.expires_on) : null;
                  const daysLeft = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
                  const isExpired = daysLeft != null && daysLeft < 0;
                  const isExpiringSoon = daysLeft != null && daysLeft >= 0 && daysLeft <= 30;

                  return (
                    <div
                      key={doc.id}
                      className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-2.5 flex flex-col justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-primary">
                            {doc.doc_type.replace("_", " ")}
                          </span>
                          {isExpired ? (
                            <span className="rounded bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive border border-destructive/20">
                              Expired
                            </span>
                          ) : isExpiringSoon ? (
                            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 border border-amber-500/20">
                              Expiring in {daysLeft}d
                            </span>
                          ) : (
                            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-500/20">
                              Valid
                            </span>
                          )}
                        </div>

                        <div className="text-sm font-semibold text-foreground font-mono">
                          {doc.number || "Document No. —"}
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/40">
                        {doc.issued_on && (
                          <div className="flex justify-between">
                            <span>Issued:</span>
                            <span>{formatDate(doc.issued_on)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-medium">
                          <span>Expires:</span>
                          <span className={isExpired ? "text-destructive font-bold" : "text-foreground"}>
                            {doc.expires_on ? formatDate(doc.expires_on) : "No expiry"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Vehicle Dialog */}
      <VehicleDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        machine={vehicle}
        initialCategory={vehicle.category === "Trailer" ? "Trailer" : "Vehicle"}
        availableTrailers={allTrailers.filter((t) => t.is_trailer || t.category === "Trailer")}
        onSaved={load}
      />

      {/* QR Code Modal */}
      <MachineQrDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        machineId={vehicle.id}
        machineName={vehicle.name}
        qrEnabled={true}
        plateNumber={vehicle.plate_number}
        registrationNumber={vehicle.vehicle_code}
        currentHours={vehicle.current_odometer_km}
        category={vehicle.category}
        organisationName={profile?.organisation_id}
      />

      {/* Update Odometer Modal */}
      <Dialog open={odoOpen} onOpenChange={setOdoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" /> Update Odometer & Operating Hours
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Current Odometer (km)</Label>
              <Input
                type="number"
                step="any"
                value={odoValue}
                onChange={(e) => setOdoValue(e.target.value)}
                placeholder="e.g. 145200"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Engine Operating Hours (hrs)</Label>
              <Input
                type="number"
                step="any"
                value={hoursValue}
                onChange={(e) => setHoursValue(e.target.value)}
                placeholder="e.g. 3450"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOdoOpen(false)}>Cancel</Button>
            <Button onClick={saveOdometer} disabled={odoSaving}>
              {odoSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Reading
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Upload Modal */}
      <Dialog open={docModalOpen} onOpenChange={setDocModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Add Vehicle Document
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label>Document Type *</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="insurance">Commercial Insurance</SelectItem>
                  <SelectItem value="road_licence">Road Licence / Motor Vehicle Tax</SelectItem>
                  <SelectItem value="inspection">Safety / Fitness Inspection</SelectItem>
                  <SelectItem value="permit">LATRA / Cross-Border Permit</SelectItem>
                  <SelectItem value="other">Other Compliance Certificate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Document / Policy Number</Label>
              <Input
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="e.g. POL-849201"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Issued Date</Label>
                <Input
                  type="date"
                  value={docIssued}
                  onChange={(e) => setDocIssued(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Expiry Date *</Label>
                <Input
                  type="date"
                  value={docExpiry}
                  onChange={(e) => setDocExpiry(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes / Details</Label>
              <Input
                value={docNotes}
                onChange={(e) => setDocNotes(e.target.value)}
                placeholder="e.g. Comprehensive policy with Jubilee Insurance"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDocModalOpen(false)}>Cancel</Button>
            <Button onClick={saveDocument} disabled={docSaving}>
              {docSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
