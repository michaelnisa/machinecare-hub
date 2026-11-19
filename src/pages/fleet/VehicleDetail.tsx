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
  FLEET_AND_ASSET_CATEGORIES,
  isWorkshopAssetCategory,
  parseMachine,
  parseDriver,
  parseTrip,
  extractCleanCargo,
  normalizeTelematicsStatus,
  AXLE_CONFIG_OPTIONS,
  type FleetVehicle,
  type FleetDriver,
  type FleetTrip,
} from "@/lib/fleet-metadata";
import { VehicleDialog } from "./Vehicles";
import { ScheduleFormDialog } from "@/components/ScheduleFormDialog";
import { computeOdoPmStatus, recordCompletedPmService } from "@/services/fleetPmService";
import { TireAxleMatrix } from "@/components/fleet/TireAxleMatrix";
import { getPartsIssuanceHistory, type PartIssuanceRecord } from "@/services/smartPartsService";
import { getFleetApprovalRequests, type FleetApprovalRequest } from "@/services/fleetApprovalService";
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
  Radio,
  Building2,
  Package,
  ShoppingCart,
  ShieldCheck,
  Zap,
  Wind,
  Droplets,
  Boxes,
  Factory,
  Cog,
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
  const { profile, organisation } = useAuth();
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
  const [workOrders, setWorkOrders] = useState<Array<{
    id: string;
    wo_number: number;
    wo_year: number;
    title: string;
    work_type: string;
    status: string;
    priority: string;
    is_outsourced?: boolean | null;
    vendor_id?: string | null;
    vendor_cost?: number | null;
    created_at: string;
    due_date?: string | null;
  }>>([]);
  const [vendors, setVendors] = useState<Array<{ id: string; name: string; specialization?: string | null }>>([]);
  const [sparesHistory, setSparesHistory] = useState<PartIssuanceRecord[]>([]);
  const [vehicleApprovals, setVehicleApprovals] = useState<FleetApprovalRequest[]>([]);
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

  // PM Schedule & Service Logging Modals
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);

  const [logModalOpen, setLogModalOpen] = useState(false);
  const [selectedScheduleForLog, setSelectedScheduleForLog] = useState<any>(null);
  const [logOdo, setLogOdo] = useState("");
  const [logCost, setLogCost] = useState("");
  const [logTech, setLogTech] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [logSaving, setLogSaving] = useState(false);

  const load = async () => {
    if (!profile || !id) return;
    setLoading(true);

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      let vehRecord: any = null;
      let targetMachineId = id;

      if (!isUuid) {
        const { data: vByPlate, error: eVByPlate } = await supabase
          .from("machines")
          .select(SAFE_MACHINE_COLUMNS)
          .or(`plate_number.eq.${id},name.eq.${id}`)
          .maybeSingle();
        if (eVByPlate) throw eVByPlate;
        if (!vByPlate) {
          setVehicle(null);
          setLoading(false);
          return;
        }
        vehRecord = vByPlate;
        targetMachineId = vByPlate.id;
      }

      const [
        vehRes,
        { data: rawTrips, error: eTrips },
        { data: rawTyres, error: eTyres },
        { data: rawSched, error: eSched },
        { data: rawLogs, error: eLogs },
        { data: rawDocs, error: eDocs },
        { data: rawDrivers, error: eDrivers },
        { data: rawAllVeh, error: eAllVeh },
        { data: rawWOs, error: eWOs },
        { data: rawVendors, error: eVendors },
      ] = await Promise.all([
        vehRecord
          ? Promise.resolve({ data: vehRecord, error: null })
          : supabase.from("machines").select(SAFE_MACHINE_COLUMNS).eq("id", targetMachineId).maybeSingle(),
        supabase.from("trips").select(SAFE_TRIP_COLUMNS).eq("machine_id", targetMachineId).order("start_at", { ascending: false }).limit(20),
        supabase.from("tyres").select(SAFE_TYRE_COLUMNS).eq("machine_id", targetMachineId).is("removed_at", null).order("position"),
        supabase.from("service_schedules").select("*").eq("machine_id", targetMachineId).order("next_due_date"),
        supabase.from("service_logs").select("*").eq("machine_id", targetMachineId).order("performed_at", { ascending: false }).limit(20),
        supabase.from("vehicle_documents").select("*").eq("machine_id", targetMachineId).order("expires_on"),
        supabase.from("drivers").select(SAFE_DRIVER_COLUMNS),
        supabase.from("machines").select(SAFE_MACHINE_COLUMNS).in("category", FLEET_AND_ASSET_CATEGORIES as any),
        supabase.from("work_orders").select("id, wo_number, wo_year, title, work_type, status, priority, is_outsourced, vendor_id, vendor_cost, created_at, due_date").eq("machine_id", targetMachineId).order("created_at", { ascending: false }).limit(20),
        supabase.from("vendors").select("id, name, specialization, phone"),
      ]);

      const rawVeh = vehRes.data;
      if (vehRes.error) throw vehRes.error;
      if (!rawVeh) {
        setVehicle(null);
        setLoading(false);
        return;
      }

      if (eTrips || eTyres || eSched || eLogs || eDocs || eDrivers || eAllVeh || eWOs || eVendors) {
        console.warn("Ancillary vehicle details encountered query warning:", {
          eTrips, eTyres, eSched, eLogs, eDocs, eDrivers, eAllVeh, eWOs, eVendors
        });
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
      setWorkOrders((rawWOs ?? []) as any[]);
      setVendors((rawVendors ?? []) as any[]);

      setOdoValue(parsedVehicle.current_odometer_km != null ? String(parsedVehicle.current_odometer_km) : "");
      setHoursValue(parsedVehicle.current_hours != null ? String(parsedVehicle.current_hours) : "");

      // Cross-Department Sync: Load Stores Spares Issuance & Financial Approvals
      const orgId = organisation?.id || profile?.organisation_id || "";
      if (orgId) {
        try {
          const [spares, appReqs] = await Promise.all([
            getPartsIssuanceHistory(orgId, parsedVehicle.plate_number || parsedVehicle.name),
            getFleetApprovalRequests(orgId),
          ]);
          setSparesHistory(spares);
          setVehicleApprovals(
            (appReqs || []).filter(
              (a) =>
                a.vehicle_id === targetMachineId ||
                (parsedVehicle.plate_number && a.vehicle_plate && a.vehicle_plate.toLowerCase() === parsedVehicle.plate_number.toLowerCase())
            )
          );
        } catch (_err) {
          // non-blocking
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load vehicle details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id, profile]);

  // Vendor map lookup
  const vendorMap = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

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

  const handleSaveCompletedService = async () => {
    if (!selectedScheduleForLog || !vehicle) return;
    const odoNum = Number(logOdo);
    if (!odoNum || odoNum <= 0) {
      toast.error("Please enter a valid completed odometer reading");
      return;
    }
    setLogSaving(true);
    try {
      const res = await recordCompletedPmService({
        scheduleId: selectedScheduleForLog.id,
        machineId: vehicle.id,
        completedOdometerKm: odoNum,
        costTotal: logCost ? Number(logCost) : undefined,
        performedBy: logTech.trim() || undefined,
        notes: logNotes.trim() || undefined,
      });

      if (!res.success) throw new Error(res.error || "Failed to record service");
      toast.success(`Service completed! Next due service target set to ${res.nextDueOdo.toLocaleString()} km.`);
      setLogModalOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to record completed service");
    } finally {
      setLogSaving(false);
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

  const isWsAsset = vehicle.is_workshop_asset || isWorkshopAssetCategory(vehicle.category, vehicle.notes);
  const isTrailer = !isWsAsset && (vehicle.is_trailer || vehicle.category === "Trailer");
  const totalTank = vehicle.total_tank_capacity_l ?? vehicle.tank_capacity_l;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/fleet/vehicles"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Vehicles & Assets
        </Link>
        <span className="text-xs text-muted-foreground">Logistics, Fleet & Plant Asset Registry</span>
      </div>

      {/* Main Asset Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/60 shadow-2xs">
            <CoverImage
              value={vehicle.cover_image_url}
              alt={vehicle.name}
              className="h-full w-full object-cover"
              fallback={
                isWsAsset ? (
                  vehicle.category === "Generator" ? (
                    <Zap className="h-8 w-8 text-amber-500" />
                  ) : vehicle.category === "Compressor" ? (
                    <Wind className="h-8 w-8 text-blue-500" />
                  ) : vehicle.category === "Pump" ? (
                    <Droplets className="h-8 w-8 text-cyan-500" />
                  ) : vehicle.category === "Forklift" ? (
                    <Boxes className="h-8 w-8 text-orange-500" />
                  ) : vehicle.category === "Boiler" ? (
                    <Factory className="h-8 w-8 text-rose-500" />
                  ) : (
                    <Wrench className="h-8 w-8 text-amber-600" />
                  )
                ) : isTrailer ? (
                  <Container className="h-8 w-8 text-emerald-600" />
                ) : (
                  <Truck className="h-8 w-8 text-muted-foreground" />
                )
              }
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

              {isWsAsset ? (
                <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                  <Wrench className="h-3 w-3 text-amber-600" /> {vehicle.category || "Workshop Plant"}
                </span>
              ) : isTrailer ? (
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

            {isWsAsset ? (
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground font-mono">S/N: {vehicle.serial_number || "—"}</span>
                <span>•</span>
                <span>{[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" · ") || "Workshop Plant"}</span>
                {vehicle.rated_power_capacity && (
                  <>
                    <span>•</span>
                    <span className="font-medium text-foreground">Rating: {vehicle.rated_power_capacity}</span>
                  </>
                )}
                {vehicle.home_depot && (
                  <>
                    <span>•</span>
                    <span>Bay / Room: {vehicle.home_depot}</span>
                  </>
                )}
              </div>
            ) : (
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
            )}
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

          {!isWsAsset && !isTrailer && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-1.5 shadow-2xs"
            >
              <Link to={`/fleet/trips?vehicle=${vehicle.id}&new=1`}>
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

      {/* Fleet & Plant KPI Quick Stats Strip */}
      {isWsAsset ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* 1. Operating Runtime Hours */}
          <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Operating Runtime</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold text-foreground">
                {vehicle.current_hours != null ? `${formatNumber(vehicle.current_hours)} hrs` : "0 hrs"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Runtime meter reading
              </div>
            </div>
            {canWrite && (
              <button
                type="button"
                onClick={() => setOdoOpen(true)}
                className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline mt-2 text-left cursor-pointer inline-flex items-center gap-1"
              >
                + Update hours meter
              </button>
            )}
          </div>

          {/* 2. Rated Power / Capacity */}
          <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Rated Capacity / Power</span>
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2">
              <div className="font-bold text-foreground text-base">
                {vehicle.rated_power_capacity || "Standard Rating"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                Power: {vehicle.fuel_type?.replace(/_/g, " ") || "Electric / Diesel"}
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              Nameplate rating
            </div>
          </div>

          {/* 3. Serial Number & Model */}
          <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Equipment S/N</span>
              <Shield className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-2">
              <div className="font-bold text-foreground text-sm font-mono truncate" title={vehicle.serial_number || undefined}>
                {vehicle.serial_number || "No S/N recorded"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Make: {vehicle.make || "Manufacturer"}
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              Mfg Year: {vehicle.year || "—"}
            </div>
          </div>

          {/* 4. Location Bay & Day Tank */}
          <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Location & Tank</span>
              <Building2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2">
              <div className="font-bold text-foreground text-sm truncate" title={vehicle.home_depot || undefined}>
                {vehicle.home_depot || "Main Workshop"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {totalTank ? `Day Tank: ${formatNumber(totalTank)} L` : "Stationary equipment"}
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              Base installation
            </div>
          </div>

          {/* 5. PM Due Status / Spares */}
          <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Preventive Service</span>
              <Wrench className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2">
              {schedules.length > 0 ? (
                <div>
                  <div className="font-bold text-foreground text-sm truncate">
                    {schedules[0].name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {schedules[0].next_due_hours != null
                      ? `Due at ${formatNumber(schedules[0].next_due_hours)} hrs`
                      : schedules[0].next_due_date
                      ? `Due on ${formatDate(schedules[0].next_due_date)}`
                      : "Schedule active"}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic">No PM schedule</div>
              )}
            </div>
            {canWrite && (
              <button
                type="button"
                onClick={() => setScheduleDialogOpen(true)}
                className="text-[11px] font-semibold text-primary hover:underline mt-2 text-left cursor-pointer inline-flex items-center gap-1"
              >
                + Configure PM schedule
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
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

          {/* Live GPS & Telematics */}
          <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${vehicle.telematics_ignition ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"}`} />
                Live Telematics
              </span>
              <Radio className={`h-4 w-4 ${vehicle.telematics_ignition ? "text-emerald-600 animate-pulse" : "text-muted-foreground"}`} />
            </div>
            <div className="mt-2 space-y-1">
              {(() => {
                const hasGps = vehicle.telematics_latitude != null && vehicle.telematics_longitude != null;
                const vStatus = normalizeTelematicsStatus(
                  vehicle.telematics_status,
                  vehicle.telematics_speed,
                  vehicle.telematics_ignition,
                  vehicle.telematics_last_at,
                  hasGps
                );
                return (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-base">
                      {vehicle.telematics_speed != null ? `${vehicle.telematics_speed} km/h` : "0 km/h"}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase flex items-center gap-1 ${
                      vStatus === "Running"
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        : vStatus === "Idle"
                        ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                        : vStatus === "Inactive"
                        ? "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                        : "bg-sky-500/10 text-sky-600 border border-sky-500/20"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        vStatus === "Running" ? "bg-emerald-500 animate-pulse" :
                        vStatus === "Idle" ? "bg-amber-500" :
                        vStatus === "Inactive" ? "bg-slate-400" : "bg-sky-500"
                      }`} />
                      {vStatus === "Running" ? "Running" : vStatus === "Idle" ? "Idle (Key ON)" : vStatus === "Inactive" ? "Inactive" : "Stopped"}
                    </span>
                  </div>
                );
              })()}
              <div className="text-[11px] text-muted-foreground truncate">
                {vehicle.telematics_battery_volt != null && <span>Battery: {vehicle.telematics_battery_volt}V • </span>}
                {vehicle.telematics_imei ? `IMEI: ${vehicle.telematics_imei}` : "No IMEI set"}
              </div>
            </div>
            {vehicle.telematics_latitude != null && vehicle.telematics_longitude != null ? (
              <a
                href={`https://maps.google.com/?q=${vehicle.telematics_latitude},${vehicle.telematics_longitude}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-semibold text-primary hover:underline mt-2 inline-flex items-center gap-1"
              >
                <Navigation className="h-3 w-3" /> Live GPS Map →
              </a>
            ) : (
              <span className="text-[11px] text-muted-foreground mt-2 italic">
                {vehicle.telematics_imei ? "Awaiting GPS fix" : "No GPS tracker"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Tabbed Sections */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/60 p-1 flex-wrap">
          <TabsTrigger value="overview" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> {isWsAsset ? "Asset Dossier" : "Fleet Dossier"}
          </TabsTrigger>
          {!isWsAsset && (
            <TabsTrigger value="axles" className="gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Axles & Tyres ({tyres.length})
            </TabsTrigger>
          )}
          {!isWsAsset && (
            <TabsTrigger value="trips" className="gap-1.5">
              <Navigation className="h-3.5 w-3.5" /> Trips ({trips.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="maintenance" className="gap-1.5">
            <Wrench className="h-3.5 w-3.5" /> Maintenance & PM ({schedules.length})
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> {isWsAsset ? "Certificates & Docs" : "Documents"} ({documents.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview & Fleet/Asset Dossier */}
        <TabsContent value="overview" className="space-y-4">
          {isWsAsset ? (
            /* Plant Asset Technical Dossier */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Plant Identification Card */}
              <div className="p-5 rounded-2xl border border-border bg-card shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border/80">
                  <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-amber-600" /> Plant Equipment Identification
                  </h3>
                  <span className="text-xs font-mono font-bold bg-muted px-2 py-0.5 rounded text-foreground border">
                    {vehicle.vehicle_code}
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Asset Tag / ID:</span>
                    <span className="font-bold text-foreground font-mono text-base">{vehicle.vehicle_code}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Equipment Category:</span>
                    <span className="font-semibold text-amber-700 dark:text-amber-400">{vehicle.category || "Workshop Asset"}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Serial Number / S/N:</span>
                    <span className="font-mono text-xs text-foreground bg-muted/60 px-2 py-0.5 rounded border font-bold">
                      {vehicle.serial_number || "Not recorded"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Make & Model:</span>
                    <span className="font-semibold text-foreground">
                      {[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Year of Manufacture:</span>
                    <span className="font-medium text-foreground">{vehicle.year || "—"}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Power Source / Drive:</span>
                    <span className="capitalize font-medium text-foreground flex items-center gap-1.5">
                      <Fuel className="h-3.5 w-3.5 text-amber-600" />
                      {vehicle.fuel_type?.replace(/_/g, " ") || "Diesel Engine"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">Rated Power / Capacity:</span>
                    <span className="font-bold text-foreground">{vehicle.rated_power_capacity || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Operating Specs & Maintenance Setup Card */}
              <div className="p-5 rounded-2xl border border-border bg-card shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border/80">
                  <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-emerald-600" /> Installation & Maintenance Setup
                  </h3>
                  <span className="text-xs text-muted-foreground">Slide 19 Plant Specs</span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Installation Location / Bay:</span>
                    <span className="font-semibold text-foreground">{vehicle.home_depot || "Main Workshop"}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Current Operating Hours:</span>
                    <span className="font-bold text-foreground text-base">
                      {vehicle.current_hours != null ? `${formatNumber(vehicle.current_hours)} hrs` : "0 hrs"}
                    </span>
                  </div>

                  {totalTank != null && totalTank > 0 && (
                    <div className="flex items-center justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Day Fuel Tank Capacity:</span>
                      <span className="font-medium text-foreground">{formatNumber(totalTank)} Litres</span>
                    </div>
                  )}

                  {vehicle.purchase_date && (
                    <div className="flex items-center justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Commissioning / Purchase Date:</span>
                      <span className="font-medium text-foreground">{formatDate(vehicle.purchase_date)}</span>
                    </div>
                  )}

                  {vehicle.purchase_cost != null && vehicle.purchase_cost > 0 && (
                    <div className="flex items-center justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Asset Purchase Cost:</span>
                      <span className="font-mono font-bold text-foreground">{formatMoney(vehicle.purchase_cost)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Automated PM Alerts:</span>
                    <span className="font-medium text-foreground">
                      {vehicle.auto_pm_enabled ? (
                        <span className="text-emerald-600 font-semibold inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Active (Every {vehicle.auto_pm_hours_interval ?? 250} hrs)
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Manual schedule</span>
                      )}
                    </span>
                  </div>

                  {vehicle.user_notes && (
                    <div className="pt-2">
                      <span className="text-xs text-muted-foreground font-semibold block mb-1">Equipment Notes & Maintenance Instructions:</span>
                      <div className="p-2.5 rounded-lg bg-muted/40 text-xs text-foreground italic border">
                        {vehicle.user_notes}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Road Vehicle Dossier */
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
          )}
        </TabsContent>

        {/* Tab 2: Axles & Tyres */}
        <TabsContent value="axles" className="space-y-4">
          <TireAxleMatrix vehicle={vehicle} tyres={tyres} />

          <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" /> Fitted Tyres Registry Table
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
                            <span>{extractCleanCargo(tr.raw_cargo, (tr as any).purpose)}</span>
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
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
                <div>
                  <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-primary" /> Odometer-Triggered PM Schedules
                  </h3>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Live Odometer: <span className="font-mono font-bold text-foreground">{vehicle?.current_odometer_km ? `${formatNumber(vehicle.current_odometer_km)} km` : "No GPS reading"}</span>
                  </div>
                </div>
                {canWrite && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => {
                      setEditingSchedule(null);
                      setScheduleDialogOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Interval
                  </Button>
                )}
              </div>

              {schedules.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground space-y-3">
                  <p>No active preventive maintenance schedules set for this unit.</p>
                  {canWrite && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingSchedule(null);
                        setScheduleDialogOpen(true);
                      }}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Service Interval
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {schedules.map((s) => {
                    const odoStatus = computeOdoPmStatus(s, vehicle?.current_odometer_km);
                    const isOdo = Number(s.interval_hours || 0) >= 1000 || (vehicle?.current_odometer_km ?? 0) > 0;
                    return (
                      <div key={s.id} className="p-3.5 rounded-xl border border-border/70 bg-muted/20 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                              {s.name}
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
                                {s.service_type}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {isOdo
                                ? `Every ${odoStatus.intervalKm.toLocaleString()} km · Target: ${odoStatus.nextDueOdo.toLocaleString()} km`
                                : (s.interval_hours ? `Every ${s.interval_hours} operating hours` : `Every ${s.interval_days ?? 90} days`)}
                            </div>
                          </div>
                          <div className="text-right">
                            <span
                              className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                                odoStatus.status === "overdue"
                                  ? "text-red-600 bg-red-500/10 border-red-500/20"
                                  : odoStatus.status === "due_soon"
                                  ? "text-amber-600 bg-amber-500/10 border-amber-500/20"
                                  : "text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
                              }`}
                            >
                              {isOdo ? odoStatus.statusLabel : (s.next_due_date ? formatDate(s.next_due_date) : "Active")}
                            </span>
                          </div>
                        </div>

                        {/* Progress bar towards service */}
                        {isOdo && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>Service progress</span>
                              <span className="font-mono font-medium">{odoStatus.progressPct}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  odoStatus.status === "overdue" ? "bg-red-500" : odoStatus.status === "due_soon" ? "bg-amber-500" : "bg-emerald-500"
                                }`}
                                style={{ width: `${Math.min(100, Math.max(5, odoStatus.progressPct))}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {canWrite && (
                          <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => {
                                setSelectedScheduleForLog(s);
                                setLogOdo(vehicle?.current_odometer_km ? String(vehicle.current_odometer_km) : "");
                                setLogCost("");
                                setLogTech("");
                                setLogNotes("");
                                setLogModalOpen(true);
                              }}
                            >
                              <Wrench className="h-3 w-3 text-primary" /> Log Completed Service
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-muted-foreground"
                              onClick={() => {
                                setEditingSchedule(s);
                                setScheduleDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-3 w-3" /> Edit
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                          {formatDate(log.service_date || (log as any).performed_at || (log as any).created_at)}
                        </div>
                        {(log.cost_total != null ? log.cost_total : (log as any).cost) != null && (
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">
                            {formatMoney(log.cost_total != null ? log.cost_total : (log as any).cost)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Workshop Job Cards & Work Orders */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
              <div>
                <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" /> Active & Recent Workshop Job Cards
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Internal mechanical repairs, preventive maintenance services, and outsourced garage work orders
                </p>
              </div>
              {canWrite && (
                <Button size="sm" asChild className="gap-1.5 h-8 text-xs shadow-xs">
                  <Link to={`/work-orders/new?machine=${vehicle?.id}`}>
                    <Plus className="h-3.5 w-3.5" /> Create Job Card
                  </Link>
                </Button>
              )}
            </div>

            {workOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground space-y-3">
                <p>No job cards or work orders recorded for this asset yet.</p>
                {canWrite && (
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/work-orders/new?machine=${vehicle?.id}`}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Open First Job Card
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {workOrders.map((wo) => {
                  const vendor = wo.vendor_id ? vendorMap.get(wo.vendor_id) : null;
                  return (
                    <div
                      key={wo.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/10 rounded-lg px-2 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/work-orders/${wo.id}`}
                            className="font-mono text-xs font-bold text-primary hover:underline"
                          >
                            WO-{wo.wo_year}-{String(wo.wo_number).padStart(4, "0")}
                          </Link>
                          <span className="font-medium text-sm text-foreground">{wo.title}</span>
                          <StatusBadge status={wo.status} />
                          <span className="capitalize text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50">
                            {wo.work_type}
                          </span>
                          {wo.is_outsourced && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                              <Building2 className="h-3 w-3" />
                              Outsourced: {vendor?.name || "External Specialist"}
                              {wo.vendor_cost ? ` · ${formatMoney(wo.vendor_cost)}` : ""}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                          <span>Opened: {formatDate(wo.created_at)}</span>
                          {wo.due_date && <span>Target Due: {formatDate(wo.due_date)}</span>}
                          <span className="capitalize">
                            Priority:{" "}
                            <span className={wo.priority === "urgent" || wo.priority === "critical" ? "text-red-500 font-semibold" : ""}>
                              {wo.priority}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <Button size="sm" variant="ghost" asChild className="h-7 text-xs gap-1">
                          <Link to={`/work-orders/${wo.id}`}>
                            View Job Card <ExternalLink className="h-3 w-3 ml-0.5" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stores Spares Consumed & Issued (Slide 15) */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
              <div>
                <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" /> Stores Spares Consumed & Issued
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Audit log of spare parts issued by Stores against Job Cards for this vehicle chassis (Slide 15)
                </p>
              </div>
              <Button size="sm" variant="outline" asChild className="gap-1.5 h-8 text-xs">
                <Link to="/inventory">
                  <Package className="h-3.5 w-3.5 text-primary" /> View Stores Inventory
                </Link>
              </Button>
            </div>

            {sparesHistory.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No spare parts currently recorded as issued to this vehicle.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left uppercase text-muted-foreground bg-muted/30">
                    <tr>
                      <th className="px-3 py-2">Part Number & Name</th>
                      <th className="px-3 py-2">Job Card</th>
                      <th className="px-3 py-2">Technician</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="px-3 py-2 text-right">Total Cost</th>
                      <th className="px-3 py-2 text-right">Date Issued</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {sparesHistory.map((sp) => (
                      <tr key={sp.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2.5">
                          <span className="font-mono font-bold text-foreground">{sp.part_number}</span>
                          <span className="block text-muted-foreground">{sp.part_name}</span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-primary font-medium">
                          {sp.job_card_number}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {sp.technician_name}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-foreground">
                          {sp.quantity}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                          TZS {sp.unit_price.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-foreground">
                          TZS {sp.total_cost.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">
                          {formatDate(sp.issued_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Departmental Financial Approvals & Vouchers (Slide 16, 17) */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
              <div>
                <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" /> Vehicle Financial Approvals & Vouchers
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Multi-stage approval requisitions, emergency road funding, and payment vouchers for this asset
                </p>
              </div>
              <Button size="sm" asChild className="gap-1.5 h-8 text-xs bg-primary text-primary-foreground">
                <Link to={`/fleet/approvals?new=1&type=spare_parts&vehicle=${encodeURIComponent(vehicle?.plate_number || vehicle?.name || "")}&title=${encodeURIComponent(`Maintenance Requisition for ${vehicle?.plate_number || vehicle?.name || ""}`)}`}>
                  <Plus className="h-3.5 w-3.5" /> Request Requisition
                </Link>
              </Button>
            </div>

            {vehicleApprovals.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No financial approval requisitions raised for this asset yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left uppercase text-muted-foreground bg-muted/30">
                    <tr>
                      <th className="px-3 py-2">Req # & Title</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Requester</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Approval Status</th>
                      <th className="px-3 py-2">Disbursement</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {vehicleApprovals.map((req) => (
                      <tr key={req.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2.5">
                          <span className="font-mono font-bold text-foreground">{req.request_number}</span>
                          <span className="block text-muted-foreground truncate max-w-[200px]">{req.title}</span>
                        </td>
                        <td className="px-3 py-2.5 capitalize text-muted-foreground">
                          {req.request_type.replace(/_/g, " ")}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {req.requester_name}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-foreground">
                          {req.currency} {req.amount.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                              req.status === "approved" || req.status === "disbursed"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                : req.status === "rejected"
                                ? "bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {req.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground font-mono">
                          {req.disbursement_info ? (
                            <span className="text-emerald-600 font-semibold">
                              ✓ {req.disbursement_info.method.toUpperCase()} [{req.disbursement_info.reference}]
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Button size="sm" variant="ghost" asChild className="h-6 text-[11px] gap-1 px-2">
                            <Link to="/fleet/approvals">
                              Review <ExternalLink className="h-2.5 w-2.5" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
        initialCategory={vehicle.category || "Vehicle"}
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
        currentHours={vehicle.current_hours ?? vehicle.current_odometer_km}
        category={vehicle.category}
        make={vehicle.make}
        model={vehicle.model}
        year={vehicle.year}
        serialNumber={vehicle.serial_number}
        vin={vehicle.vin}
        organisationName={organisation?.name}
        organisationLogoUrl={organisation?.logo_url}
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
                  <SelectItem value="insurance">Commercial Insurance (Comprehensive / Third Party)</SelectItem>
                  <SelectItem value="road_licence">TRA Road Licence (Motor Vehicle Tax)</SelectItem>
                  <SelectItem value="latra_licence">LATRA Commercial Transport Licence</SelectItem>
                  <SelectItem value="inspection">TBS / Police Roadworthiness Inspection</SelectItem>
                  <SelectItem value="comesa_yellow_card">COMESA Yellow Card (Cross-Border Insurance)</SelectItem>
                  <SelectItem value="tanker_calibration">EWURA / WMA Calibration Chart (Fuel Tanker)</SelectItem>
                  <SelectItem value="fire_equipment">Fire Extinguisher & Safety Certificate</SelectItem>
                  <SelectItem value="fitness">Vehicle Fitness Certificate</SelectItem>
                  <SelectItem value="permit">Cross-Border Transit / Abnormal Load Permit</SelectItem>
                  <SelectItem value="other">Other Legal Compliance Document</SelectItem>
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

      {/* Log Completed Service Modal */}
      <Dialog open={logModalOpen} onOpenChange={setLogModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Record Completed Maintenance Service
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/40 p-3 border border-border">
              <div className="font-semibold text-sm text-foreground">{selectedScheduleForLog?.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Service Interval: {Number(selectedScheduleForLog?.interval_hours || 10000).toLocaleString()} km
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Completed Odometer Reading (km) *</Label>
              <Input
                type="number"
                value={logOdo}
                onChange={(e) => setLogOdo(e.target.value)}
                placeholder="e.g. 95000"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Next service will automatically be scheduled at {logOdo ? `${(Number(logOdo) + Number(selectedScheduleForLog?.interval_hours || 10000)).toLocaleString()} km` : "..."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Total Cost (TZS)</Label>
                <Input
                  type="number"
                  value={logCost}
                  onChange={(e) => setLogCost(e.target.value)}
                  placeholder="e.g. 350000"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Technician / Garage</Label>
                <Input
                  value={logTech}
                  onChange={(e) => setLogTech(e.target.value)}
                  placeholder="e.g. Master Tech John"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Service Notes & Parts Replaced</Label>
              <Input
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                placeholder="e.g. 15W40 Castrol, oil filter, air filter"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setLogModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCompletedService} disabled={logSaving || !logOdo}>
              {logSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save & Advance Odometer Target
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Form Dialog */}
      <ScheduleFormDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        machineId={vehicle?.id}
        machines={vehicle ? [vehicle] : []}
        schedule={editingSchedule}
        onSaved={load}
      />
    </div>
  );
}

