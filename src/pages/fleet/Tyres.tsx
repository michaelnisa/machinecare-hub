import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { StatusBadge } from "@/components/StatusBadge";
import { 
  CircleDot, 
  Plus, 
  Trash2, 
  Loader2, 
  AlertTriangle, 
  ArrowLeftRight, 
  Gauge, 
  Search, 
  CheckCircle2, 
  ShieldAlert, 
  Truck, 
  Copy, 
  Check, 
  Download, 
  ClipboardCheck, 
  SlidersHorizontal,
  Layers,
  Sparkles,
  RefreshCw,
  Filter,
  Eye,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatNumber } from "@/lib/format";
import { 
  tyreStatus, 
  normalizeTyrePosition as normalizePosition, 
  formatPositionName, 
  TRUCK_LAYOUTS, 
  type TruckLayoutConfigId,
  TYRE_MIN_TREAD_MM,
  TYRE_WARN_TREAD_MM,
  TRUCK_TYRE_MIN_PSI
} from "@/lib/fleet-constants";
import { useI18n } from "@/i18n/I18nProvider";
import {
  SAFE_MACHINE_COLUMNS,
  parseMachine,
  type FleetVehicle,
} from "@/lib/fleet-metadata";

const POPULAR_BRANDS = [
  "Michelin",
  "Bridgestone",
  "Goodyear",
  "Continental",
  "Pirelli",
  "Aeolus",
  "Triangle",
  "Sailun",
  "Double Coin",
  "Giti",
  "Linglong",
  "Chaoyang",
];

const POPULAR_TRUCK_SIZES = [
  "315/80R22.5",
  "295/80R22.5",
  "12.00R20",
  "11R22.5",
  "385/65R22.5 (Super Single)",
  "12R22.5",
  "275/70R22.5",
  "10.00R20",
];

const TYRE_PATTERNS = [
  { value: "steer", label: "Steer / Highway Rib" },
  { value: "drive", label: "Drive / Traction Lug" },
  { value: "trailer", label: "Trailer / Free-Rolling" },
  { value: "all_position", label: "All-Position" },
];

const RETIRE_REASONS = [
  { value: "worn_minimum", label: "Normal Wear — Reached ≤ 3.0mm Legal Minimum" },
  { value: "puncture_blowout", label: "Puncture / Unrepairable Blowout" },
  { value: "sidewall_damage", label: "Sidewall Impact / Bulge / Cut" },
  { value: "irregular_wear", label: "Irregular / Feathered Wear (Suspension / Alignment issue)" },
  { value: "retreading", label: "Sent for Retreading (Casing Reuse)" },
  { value: "yard_spare", label: "Transferred to Yard Spares / Secondary Duty" },
  { value: "scrapped", label: "Scrapped / Disposed" },
];

type Machine = FleetVehicle;

export type Tyre = {
  id: string;
  machine_id: string;
  position: string;
  brand: string | null;
  size: string | null;
  serial: string | null;
  fitted_at: string | null;
  fitted_odo: number | null;
  removed_at: string | null;
  removed_reason: string | null;
  current_tread_mm: number | null;
  target_replace_km: number | null;
  notes: string | null;
  // Extended parsed attributes
  pressure_psi?: number | null;
  pattern?: string | null;
  dot_code?: string | null;
  initial_tread_mm?: number | null;
};

// Helper to safely parse JSON notes or extract metadata without schema disruption
function parseTyre(raw: any): Tyre {
  let pressure_psi: number | null = raw.pressure_psi ?? null;
  let pattern: string | null = raw.pattern ?? null;
  let dot_code: string | null = raw.dot_code ?? null;
  let initial_tread_mm: number | null = raw.initial_tread_mm ?? null;
  let userNotes: string | null = raw.notes ?? null;

  if (raw.notes && typeof raw.notes === "string" && raw.notes.startsWith("{") && raw.notes.endsWith("}")) {
    try {
      const parsed = JSON.parse(raw.notes);
      if (parsed.psi != null) pressure_psi = Number(parsed.psi);
      if (parsed.pattern != null) pattern = parsed.pattern;
      if (parsed.dot != null) dot_code = parsed.dot;
      if (parsed.initial_tread != null) initial_tread_mm = Number(parsed.initial_tread);
      userNotes = parsed.text ?? null;
    } catch {
      // Keep raw notes on parse failure
    }
  }

  return {
    ...raw,
    pressure_psi,
    pattern,
    dot_code,
    initial_tread_mm,
    notes: userNotes,
  };
}

function encodeTyreNotes(meta: {
  pressure_psi?: number | null;
  pattern?: string | null;
  dot_code?: string | null;
  initial_tread_mm?: number | null;
  notes?: string | null;
}): string {
  if (
    meta.pressure_psi == null &&
    !meta.pattern &&
    !meta.dot_code &&
    meta.initial_tread_mm == null
  ) {
    return meta.notes || "";
  }
  return JSON.stringify({
    psi: meta.pressure_psi ?? null,
    pattern: meta.pattern ?? null,
    dot: meta.dot_code ?? null,
    initial_tread: meta.initial_tread_mm ?? null,
    text: meta.notes ?? "",
  });
}

export default function Tyres() {
  const { profile } = useAuth();
  const { canWrite } = useUserRole();
  const { t, currentLang } = useI18n();
  const isSwahili = currentLang === "sw";

  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("chassis");
  const [truckLayoutId, setTruckLayoutId] = useState<TruckLayoutConfigId>("6x4");
  const [serialSearchQuery, setSerialSearchQuery] = useState("");
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<"all" | "mounted" | "spares" | "removed">("all");

  // Dialog states
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [fitOpen, setFitOpen] = useState(false);
  const [fitPosition, setFitPosition] = useState<string>("");
  const [inspectingTyre, setInspectingTyre] = useState<Tyre | null>(null);
  const [rotatingTyre, setRotatingTyre] = useState<Tyre | null>(null);
  const [retiringTyre, setRetiringTyre] = useState<Tyre | null>(null);
  const [walkaroundOpen, setWalkaroundOpen] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: m }, { data: rawT, error: tErr }] = await Promise.all([
      supabase
        .from("machines")
        .select(SAFE_MACHINE_COLUMNS)
        .in("category", ["Vehicle", "Trailer"])
        .order("name"),
      supabase.from("tyres").select("*").order("created_at", { ascending: false }),
    ]);

    if (tErr) toast.error(tErr.message);
    const parsedMachines = (m ?? []).map(parseMachine);
    setMachines(parsedMachines);
    const parsedTyres = (rawT ?? []).map(parseTyre);
    setTyres(parsedTyres);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [profile]);

  // Set default machine and auto-detect layout
  useEffect(() => {
    if (!selectedMachine && machines.length > 0) {
      setSelectedMachine(machines[0].id);
    }
  }, [machines, selectedMachine]);

  const currentMachine = useMemo(
    () => machines.find((m) => m.id === selectedMachine),
    [machines, selectedMachine]
  );

  // Set layout strictly based on vehicle/trailer's configured axle configuration
  // Fulfills "know like this car it axle is this so the tyre is this"
  useEffect(() => {
    if (!currentMachine) return;
    if (currentMachine.axle_configuration && TRUCK_LAYOUTS[currentMachine.axle_configuration]) {
      setTruckLayoutId(currentMachine.axle_configuration);
    } else {
      const isTrailer = currentMachine.is_trailer || currentMachine.category === "Trailer";
      if (isTrailer) {
        setTruckLayoutId("trailer_tri");
      } else {
        const vt = currentMachine.vehicle_type?.toLowerCase() || "";
        if (vt === "rigid") setTruckLayoutId("4x2");
        else if (vt === "van_pickup" || vt === "pickup" || vt === "van") setTruckLayoutId("4_wheel");
        else setTruckLayoutId("6x4");
      }
    }
  }, [currentMachine?.id, currentMachine?.axle_configuration]);

  const machineMap = useMemo(() => new Map(machines.map((m) => [m.id, m])), [machines]);

  const vehicleLabel = (machineId: string) => {
    const m = machineMap.get(machineId);
    if (!m) return "Vehicle";
    return m.plate_number ? `${m.name} (${m.plate_number})` : m.name;
  };

  const currentLayout = TRUCK_LAYOUTS[truckLayoutId] || TRUCK_LAYOUTS["6x4"];

  // Active tyres mounted on currently selected machine
  const activeTyresByPosition = useMemo(() => {
    const map = new Map<string, Tyre>();
    for (const tyre of tyres) {
      if (tyre.machine_id === selectedMachine && !tyre.removed_at) {
        map.set(normalizePosition(tyre.position), tyre);
      }
    }
    return map;
  }, [tyres, selectedMachine]);

  const vehicleTyres = useMemo(
    () => tyres.filter((t) => t.machine_id === selectedMachine),
    [tyres, selectedMachine]
  );

  const activeVehicleTyres = useMemo(
    () => vehicleTyres.filter((t) => !t.removed_at),
    [vehicleTyres]
  );

  const history = useMemo(
    () => vehicleTyres.filter((t) => t.removed_at),
    [vehicleTyres]
  );

  // Critical alerts across fleet (low tread or overdue)
  const alerts = useMemo(() => {
    return tyres
      .filter((t) => !t.removed_at)
      .map((t) => ({
        tyre: t,
        status: tyreStatus(t, machineMap.get(t.machine_id)?.current_odometer_km ?? null),
        lowPressure: t.pressure_psi != null && t.pressure_psi < TRUCK_TYRE_MIN_PSI,
      }))
      .filter((x) => x.status !== "ok" || x.lowPressure);
  }, [tyres, machineMap]);

  // Serial number global search results
  const filteredInventory = useMemo(() => {
    let result = tyres;

    // Filter by status tab
    if (inventoryStatusFilter === "mounted") {
      result = result.filter((t) => !t.removed_at && !t.position.startsWith("Spare"));
    } else if (inventoryStatusFilter === "spares") {
      result = result.filter((t) => !t.removed_at && t.position.startsWith("Spare"));
    } else if (inventoryStatusFilter === "removed") {
      result = result.filter((t) => !!t.removed_at);
    }

    const q = serialSearchQuery.trim().toLowerCase();
    if (!q) return result;

    return result.filter((t) => {
      const sn = (t.serial || "").toLowerCase();
      const br = (t.brand || "").toLowerCase();
      const sz = (t.size || "").toLowerCase();
      const pos = (t.position || "").toLowerCase();
      const mach = (machineMap.get(t.machine_id)?.plate_number || machineMap.get(t.machine_id)?.name || "").toLowerCase();
      return sn.includes(q) || br.includes(q) || sz.includes(q) || pos.includes(q) || mach.includes(q);
    });
  }, [tyres, serialSearchQuery, inventoryStatusFilter, machineMap]);

  // Selected tyre from position click
  const selectedTyre = selectedPosition ? activeTyresByPosition.get(selectedPosition) ?? null : null;
  const selectedPositionHistory = useMemo(
    () => (selectedPosition ? history.filter((t) => normalizePosition(t.position) === selectedPosition) : []),
    [selectedPosition, history]
  );

  // CSV Export Function
  const exportTyresCsv = () => {
    const headers = [
      "Serial Number",
      "Vehicle Plate",
      "Vehicle Name",
      "Axle Position",
      "Position Label",
      "Brand",
      "Size",
      "Pattern",
      "Current Tread (mm)",
      "Pressure (PSI)",
      "Fitted Date",
      "Status",
      "Notes",
    ];
    const rows = filteredInventory.map((t) => {
      const mach = machineMap.get(t.machine_id);
      return [
        `"${t.serial || ""}"`,
        `"${mach?.plate_number || ""}"`,
        `"${mach?.name || ""}"`,
        `"${normalizePosition(t.position)}"`,
        `"${formatPositionName(t.position)}"`,
        `"${t.brand || ""}"`,
        `"${t.size || ""}"`,
        `"${t.pattern || ""}"`,
        t.current_tread_mm != null ? t.current_tread_mm : "",
        t.pressure_psi != null ? t.pressure_psi : "",
        `"${t.fitted_at || ""}"`,
        `"${!t.removed_at ? "Mounted" : "Removed: " + (t.removed_reason || "")}"`,
        `"${(t.notes || "").replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fleet_tyres_inventory_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(isSwahili ? "Faili la CSV limepakuliwa" : "Tyre inventory CSV exported successfully");
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* ── TOP HEADER & VEHICLE PICKER ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {isSwahili ? "Usimamizi wa Matairi ya Malori" : "Truck & Trailer Tyre Management"}
            </h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Axle & Serial Tracking
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSwahili
              ? "Fuata matairi kwa namba ya usajili (Serial Number), muundo wa axle (Front & Rear Duals), na ukaguzi wa haraka."
              : "Track truck tyres with compulsory Serial Numbers, visual Front & Rear dual-wheel axles, and walkaround inspections."}
          </p>
        </div>

        {/* Global Serial Number Search & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={isSwahili ? "Tafuta Serial No / Gari..." : "Search Serial No / Plate..."}
              value={serialSearchQuery}
              onChange={(e) => setSerialSearchQuery(e.target.value)}
              className="pl-9 h-10 font-mono text-xs uppercase"
            />
            {serialSearchQuery && (
              <button
                onClick={() => setSerialSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>

          <Select value={selectedMachine} onValueChange={setSelectedMachine}>
            <SelectTrigger className="w-80 h-10">
              <SelectValue placeholder="Pick a vehicle or trailer" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {machines.map((m) => {
                const isTrl = m.is_trailer || m.category === "Trailer";
                return (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-1 rounded uppercase ${isTrl ? 'bg-emerald-500/15 text-emerald-700' : 'bg-blue-500/15 text-blue-700'}`}>
                        {isTrl ? 'Trailer' : 'Truck'}
                      </span>
                      <span className="font-medium text-foreground">{m.name}</span>
                      {m.plate_number && <span className="text-muted-foreground font-mono text-xs">({m.plate_number})</span>}
                      {m.axle_configuration && (
                        <span className="text-[10px] text-muted-foreground ml-auto bg-muted px-1.5 py-0.5 rounded border">
                          {m.axle_configuration}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {canWrite && currentMachine && (
            <Button
              onClick={() => setWalkaroundOpen(true)}
              variant="outline"
              className="h-10 text-xs gap-1.5"
            >
              <ClipboardCheck className="h-4 w-4 text-primary" />
              {isSwahili ? "Ukaguzi wa Lori Nzima" : "Walkaround Inspection"}
            </Button>
          )}
        </div>
      </div>

      {/* ── ALERTS BANNER ── */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-500/10 p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>
                {alerts.length} {alerts.length === 1 ? "tyre requires" : "tyres require"} attention across fleet
              </span>
            </div>
            <button
              onClick={() => setActiveTab("alerts")}
              className="text-xs font-medium text-amber-800 dark:text-amber-300 underline hover:no-underline"
            >
              {isSwahili ? "Angalia yote" : "View all alerts"} →
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {alerts.slice(0, 3).map(({ tyre, status, lowPressure }) => (
              <div
                key={tyre.id}
                className="flex items-center justify-between rounded-lg border border-amber-200/60 bg-background/80 p-2 text-xs"
              >
                <div>
                  <span className="font-semibold">{vehicleLabel(tyre.machine_id)}</span>
                  <div className="text-[11px] text-muted-foreground">
                    Pos: <span className="font-mono">{normalizePosition(tyre.position)}</span> ·{" "}
                    {tyre.serial ? `S/N: ${tyre.serial}` : "No Serial"}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {lowPressure && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                      {tyre.pressure_psi} PSI
                    </span>
                  )}
                  <StatusBadge status={status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TABS NAVIGATION ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
          <TabsList className="bg-muted/80">
            <TabsTrigger value="chassis" className="flex items-center gap-2 text-xs">
              <Truck className="h-3.5 w-3.5" />
              {isSwahili ? "Mpangilio wa Axle (Chassis)" : "Axle Layout (Chassis Diagram)"}
            </TabsTrigger>
            <TabsTrigger value="inventory" className="flex items-center gap-2 text-xs">
              <Layers className="h-3.5 w-3.5" />
              {isSwahili ? "Orodha ya Serial & Matairi" : "Tyre Inventory & Serial Directory"}
              <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                {tyres.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-2 text-xs">
              <ShieldAlert className="h-3.5 w-3.5" />
              {isSwahili ? "Ukaguzi & Arifa" : "Health & Critical Alerts"}
              {alerts.length > 0 && (
                <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.2 text-[10px] font-semibold text-white">
                  {alerts.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Quick stats for current machine */}
          {currentMachine && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                Fitted: <strong className="text-foreground">{activeVehicleTyres.length}</strong> /{" "}
                {currentLayout.totalTyres}
              </span>
              <span>•</span>
              <span>
                Odo: <strong className="text-foreground">{formatNumber(currentMachine.current_odometer_km)} km</strong>
              </span>
              {currentMachine.trailer_plate && (
                <>
                  <span>•</span>
                  <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                    Trailer: {currentMachine.trailer_plate}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* TAB 1: INTERACTIVE TRUCK AXLE LAYOUT                        */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <TabsContent value="chassis" className="space-y-6">
          {!currentMachine ? (
            <EmptyState
              icon={<Truck className="h-6 w-6" />}
              title="No vehicle selected"
              description="Please select a vehicle to display its axle and tyre diagram."
            />
          ) : (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm overflow-hidden">
              {/* Axle Layout Switcher & Legend Bar */}
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
                <div className="flex items-center gap-2.5">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {isSwahili ? "Muundo wa Lori (Axle Configuration):" : "Truck Axle Configuration:"}
                  </span>
                  <Select
                    value={truckLayoutId}
                    onValueChange={(val) => setTruckLayoutId(val as TruckLayoutConfigId)}
                  >
                    <SelectTrigger className="h-9 w-60 text-xs font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(TRUCK_LAYOUTS).map((layout) => (
                        <SelectItem key={layout.id} value={layout.id} className="text-xs">
                          {layout.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tread & Pressure Legend */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-muted-foreground font-medium">
                    {isSwahili ? "Hali ya Tairi:" : "Tread Status:"}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span>&gt; 6mm (Good)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <span>3 - 6mm (Warning)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span>&lt; 3mm (Critical)</span>
                  </div>
                </div>
              </div>

              {/* ── VISUAL TRUCK CHASSIS (Responsive with horizontal overflow guard) ── */}
              <div className="overflow-x-auto pb-4">
                <div className="mx-auto min-w-[550px] max-w-2xl">
                  {/* Truck Cabin Graphic Header */}
                  <div className="mb-6 flex flex-col items-center">
                    <div className="relative flex h-14 w-52 flex-col items-center justify-center rounded-t-2xl border-2 border-primary/40 bg-gradient-to-b from-primary/15 to-primary/5 shadow-inner">
                      <div className="h-1.5 w-16 rounded-full bg-primary/40 mb-1" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
                        CABIN / FRONT
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        ▲ Direction of Travel ▲
                      </span>
                    </div>
                    {/* Left & Right orientation markers */}
                    <div className="flex w-full items-center justify-between px-6 pt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                        <span>◀ LEFT (DRIVER)</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <span>RIGHT (PASSENGER) ▶</span>
                      </div>
                    </div>
                  </div>

                  {/* Axles rendering */}
                  <div className="space-y-8">
                    {currentLayout.axles.map((axle, axleIndex) => {
                      const isFrontSteer = axle.type === "front_steer";
                      return (
                        <div
                          key={axle.id}
                          className="relative rounded-xl border border-border/80 bg-secondary/30 p-4 transition-all hover:border-primary/30"
                        >
                          {/* Axle Header Label */}
                          <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold uppercase text-primary">
                                {axle.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {axle.isDual ? "(Dual Wheels: Outer + Inner)" : "(Single Steer Wheels)"}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-muted-foreground">
                              Axle {axleIndex + 1}
                            </span>
                          </div>

                          {/* Wheels along the axle bar */}
                          <div className="relative flex items-center justify-between px-2">
                            {/* Axle Structural Bar Graphic */}
                            <div
                              aria-hidden
                              className="absolute left-10 right-10 top-1/2 -translate-y-1/2 h-2.5 bg-gradient-to-r from-zinc-700 via-zinc-500 to-zinc-700 rounded-full shadow z-0 flex items-center justify-center"
                            >
                              {/* Differential Pumpkin / Hub in Center */}
                              {!isFrontSteer && (
                                <div className="h-7 w-7 rounded-full bg-zinc-800 border-2 border-zinc-600 shadow-md flex items-center justify-center">
                                  <div className="h-2 w-2 rounded-full bg-primary" />
                                </div>
                              )}
                            </div>

                            {/* LEFT WHEEL(S) */}
                            <div className="relative z-10 flex items-center gap-2">
                              {axle.slots
                                .filter((s) => s.side === "left")
                                .map((slot) => {
                                  const tyre = activeTyresByPosition.get(slot.id) ?? null;
                                  return (
                                    <TruckWheelCard
                                      key={slot.id}
                                      slot={slot}
                                      tyre={tyre}
                                      currentOdo={currentMachine.current_odometer_km}
                                      onSelect={() => setSelectedPosition(slot.id)}
                                      onFitNew={() => {
                                        setFitPosition(slot.id);
                                        setFitOpen(true);
                                      }}
                                      onInspect={() => tyre && setInspectingTyre(tyre)}
                                      onRotate={() => tyre && setRotatingTyre(tyre)}
                                    />
                                  );
                                })}
                            </div>

                            {/* RIGHT WHEEL(S) */}
                            <div className="relative z-10 flex items-center gap-2">
                              {axle.slots
                                .filter((s) => s.side === "right")
                                .map((slot) => {
                                  const tyre = activeTyresByPosition.get(slot.id) ?? null;
                                  return (
                                    <TruckWheelCard
                                      key={slot.id}
                                      slot={slot}
                                      tyre={tyre}
                                      currentOdo={currentMachine.current_odometer_km}
                                      onSelect={() => setSelectedPosition(slot.id)}
                                      onFitNew={() => {
                                        setFitPosition(slot.id);
                                        setFitOpen(true);
                                      }}
                                      onInspect={() => tyre && setInspectingTyre(tyre)}
                                      onRotate={() => tyre && setRotatingTyre(tyre)}
                                    />
                                  );
                                })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── SPARE TYRES RACK ── */}
                  <div className="mt-8 rounded-xl border border-dashed border-border bg-card/60 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CircleDot className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {isSwahili ? "Matairi ya Akiba (Spare Tyres Rack)" : "Chassis Spare Tyre Mounts"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">Mounted on carrier</span>
                    </div>

                    <div className="flex items-center justify-center gap-8">
                      {["Spare1", "Spare2"].map((posId) => {
                        const tyre = activeTyresByPosition.get(posId) ?? null;
                        const slot = {
                          id: posId,
                          label: posId === "Spare1" ? "Spare 1" : "Spare 2",
                          side: "left" as const,
                        };
                        return (
                          <div key={posId} className="flex flex-col items-center">
                            <TruckWheelCard
                              slot={slot}
                              tyre={tyre}
                              currentOdo={currentMachine.current_odometer_km}
                              onSelect={() => setSelectedPosition(posId)}
                              onFitNew={() => {
                                setFitPosition(posId);
                                setFitOpen(true);
                              }}
                              onInspect={() => tyre && setInspectingTyre(tyre)}
                              onRotate={() => tyre && setRotatingTyre(tyre)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* TAB 2: TYRE DIRECTORY & SERIAL INVENTORY                    */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <TabsContent value="inventory" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  {isSwahili ? "Daftari Kamili la Matairi ya Magari" : "Fleet Tyre Inventory & Serial Directory"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {filteredInventory.length} {filteredInventory.length === 1 ? "tyre record" : "tyre records"}{" "}
                  {serialSearchQuery ? `matching "${serialSearchQuery}"` : "in fleet"}
                </p>
              </div>

              {/* Action Buttons: Status Filter + CSV Export + Fit */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-lg border border-border bg-secondary/40 p-0.5 text-xs">
                  <button
                    onClick={() => setInventoryStatusFilter("all")}
                    className={`rounded-md px-2.5 py-1 transition-colors ${
                      inventoryStatusFilter === "all" ? "bg-background font-semibold shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All ({tyres.length})
                  </button>
                  <button
                    onClick={() => setInventoryStatusFilter("mounted")}
                    className={`rounded-md px-2.5 py-1 transition-colors ${
                      inventoryStatusFilter === "mounted" ? "bg-background font-semibold shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Mounted ({tyres.filter((t) => !t.removed_at && !t.position.startsWith("Spare")).length})
                  </button>
                  <button
                    onClick={() => setInventoryStatusFilter("spares")}
                    className={`rounded-md px-2.5 py-1 transition-colors ${
                      inventoryStatusFilter === "spares" ? "bg-background font-semibold shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Spares ({tyres.filter((t) => !t.removed_at && t.position.startsWith("Spare")).length})
                  </button>
                  <button
                    onClick={() => setInventoryStatusFilter("removed")}
                    className={`rounded-md px-2.5 py-1 transition-colors ${
                      inventoryStatusFilter === "removed" ? "bg-background font-semibold shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Removed ({history.length})
                  </button>
                </div>

                <Button
                  onClick={exportTyresCsv}
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 text-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>

                {canWrite && currentMachine && (
                  <Button
                    onClick={() => {
                      setFitPosition("Spare1");
                      setFitOpen(true);
                    }}
                    className="h-9 gap-1.5 text-xs"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    <Plus className="h-4 w-4" />
                    {isSwahili ? "Sajili Tairi Jipya" : "Fit / Register Tyre"}
                  </Button>
                )}
              </div>
            </div>

            {filteredInventory.length === 0 ? (
              <EmptyState
                icon={<Search className="h-6 w-6" />}
                title="No matching tyres found"
                description={
                  serialSearchQuery
                    ? `No tyres found matching serial or vehicle "${serialSearchQuery}".`
                    : "No tyres registered under this filter."
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-sm">
                  <thead className="border-b border-border bg-secondary/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Tyre Serial Number</th>
                      <th className="py-2.5 px-3 font-semibold">Vehicle</th>
                      <th className="py-2.5 px-3 font-semibold">Axle Position</th>
                      <th className="py-2.5 px-3 font-semibold">Brand / Size</th>
                      <th className="py-2.5 px-3 font-semibold">Tread Depth</th>
                      <th className="py-2.5 px-3 font-semibold">Pressure</th>
                      <th className="py-2.5 px-3 font-semibold">Fitted</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredInventory.map((t) => {
                      const mach = machineMap.get(t.machine_id);
                      const isFitted = !t.removed_at;
                      const status = tyreStatus(t, mach?.current_odometer_km ?? null);

                      return (
                        <tr key={t.id} className="hover:bg-muted/40 transition-colors">
                          {/* Serial Number */}
                          <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                            {t.serial ? (
                              <span className="rounded bg-secondary/80 px-2 py-0.5 text-xs text-primary border border-border">
                                {t.serial}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">No Serial</span>
                            )}
                          </td>

                          {/* Vehicle */}
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-xs text-foreground">
                              {mach?.plate_number || mach?.name || "—"}
                            </div>
                            {mach?.plate_number && (
                              <div className="text-[11px] text-muted-foreground">{mach.name}</div>
                            )}
                          </td>

                          {/* Position */}
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-xs font-semibold text-foreground">
                              {normalizePosition(t.position)}
                            </span>
                            <div className="text-[10px] text-muted-foreground">
                              {formatPositionName(t.position)}
                            </div>
                          </td>

                          {/* Brand & Size */}
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-xs text-foreground">
                              {t.brand || "Unbranded"}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {t.size || "—"} {t.pattern ? `· ${t.pattern}` : ""}
                            </div>
                          </td>

                          {/* Tread Depth */}
                          <td className="py-2.5 px-3">
                            {t.current_tread_mm != null ? (
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-xs font-bold ${
                                    t.current_tread_mm <= TYRE_MIN_TREAD_MM
                                      ? "text-red-600 font-extrabold"
                                      : t.current_tread_mm <= TYRE_WARN_TREAD_MM
                                      ? "text-amber-600"
                                      : "text-emerald-600"
                                  }`}
                                >
                                  {t.current_tread_mm} mm
                                </span>
                                <div className="h-1.5 w-12 rounded-full bg-secondary overflow-hidden">
                                  <div
                                    className={`h-full ${
                                      t.current_tread_mm <= TYRE_MIN_TREAD_MM
                                        ? "bg-red-500"
                                        : t.current_tread_mm <= TYRE_WARN_TREAD_MM
                                        ? "bg-amber-500"
                                        : "bg-emerald-500"
                                    }`}
                                    style={{
                                      width: `${Math.min(100, Math.max(0, (t.current_tread_mm / 16) * 100))}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>

                          {/* Pressure */}
                          <td className="py-2.5 px-3 font-mono text-xs">
                            {t.pressure_psi != null ? (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                                  t.pressure_psi < TRUCK_TYRE_MIN_PSI
                                    ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                    : "bg-secondary text-foreground"
                                }`}
                              >
                                {t.pressure_psi} PSI
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>

                          {/* Fitted Date */}
                          <td className="py-2.5 px-3 text-xs text-muted-foreground">
                            {formatDate(t.fitted_at)}
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3">
                            {isFitted ? (
                              <StatusBadge status={status} />
                            ) : (
                              <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                Removed ({t.removed_reason || "Retired"})
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isFitted && canWrite && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setInspectingTyre(t)}
                                    title="Quick inspect pressure & tread"
                                    className="h-7 px-2 text-xs"
                                  >
                                    <Gauge className="h-3.5 w-3.5 text-primary mr-1" /> Inspect
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setRotatingTyre(t)}
                                    title="Rotate position"
                                    className="h-7 px-2 text-xs"
                                  >
                                    <ArrowLeftRight className="h-3.5 w-3.5 mr-1" /> Rotate
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedMachine(t.machine_id);
                                  setSelectedPosition(normalizePosition(t.position));
                                }}
                                className="h-7 px-2 text-xs"
                              >
                                Dossier
                              </Button>
                            </div>
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

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* TAB 3: TYRE HEALTH & CRITICAL ALERTS                        */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <TabsContent value="alerts" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-red-300 bg-red-500/10 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-red-700 dark:text-red-300">
                  Critical Tread (&le; 3mm)
                </span>
                <ShieldAlert className="h-5 w-5 text-red-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-red-700 dark:text-red-300">
                {tyres.filter((t) => !t.removed_at && t.current_tread_mm != null && t.current_tread_mm <= TYRE_MIN_TREAD_MM).length}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Dangerous blowout hazard. Requires immediate replacement.
              </p>
            </div>

            <div className="rounded-xl border border-amber-300 bg-amber-500/10 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">
                  Low Pressure (&lt; 95 PSI)
                </span>
                <Gauge className="h-5 w-5 text-amber-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-300">
                {tyres.filter((t) => !t.removed_at && t.pressure_psi != null && t.pressure_psi < TRUCK_TYRE_MIN_PSI).length}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Under-inflated tyres cause excessive heat buildup and tyre delamination.
              </p>
            </div>

            <div className="rounded-xl border border-blue-300 bg-blue-500/10 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">
                  Total Active Tyres
                </span>
                <Truck className="h-5 w-5 text-blue-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-blue-700 dark:text-blue-300">
                {tyres.filter((t) => !t.removed_at).length}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Active commercial tyres fitted across all fleet machines.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold tracking-tight text-foreground">
              {isSwahili ? "Matairi Yenye Tahadhari" : "Tyres Requiring Attention"}
            </h3>

            {alerts.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 mb-2" />
                <p className="text-sm font-medium text-foreground">All Tyres Healthy</p>
                <p className="text-xs text-muted-foreground">
                  No tyres are below legal tread limits or under-inflated.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {alerts.map(({ tyre, status, lowPressure }) => {
                  const m = machineMap.get(tyre.machine_id);
                  return (
                    <div
                      key={tyre.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-foreground">
                            {tyre.serial ? `S/N: ${tyre.serial}` : "No Serial"}
                          </span>
                          <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                            {tyre.brand || "Unbranded"} · {tyre.size || "—"}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Fitted to: <strong className="text-foreground">{m?.plate_number || m?.name}</strong> · Position:{" "}
                          <span className="font-mono font-semibold">{normalizePosition(tyre.position)}</span> (
                          {formatPositionName(tyre.position)})
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {tyre.current_tread_mm != null && (
                          <div className="text-right text-xs">
                            <div className="text-muted-foreground">Tread:</div>
                            <span
                              className={`font-bold ${
                                tyre.current_tread_mm <= TYRE_MIN_TREAD_MM ? "text-red-600" : "text-amber-600"
                              }`}
                            >
                              {tyre.current_tread_mm} mm
                            </span>
                          </div>
                        )}
                        {lowPressure && (
                          <div className="text-right text-xs">
                            <div className="text-muted-foreground">Pressure:</div>
                            <span className="font-bold text-red-600">{tyre.pressure_psi} PSI</span>
                          </div>
                        )}
                        <StatusBadge status={status} />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setInspectingTyre(tyre)}
                          className="h-8 text-xs"
                        >
                          <Gauge className="mr-1 h-3.5 w-3.5 text-primary" /> Inspect Now
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* DIALOGS & ACTION MODALS                                     */}
      {/* ═════════════════════════════════════════════════════════════ */}

      {/* Position Detail Dialog */}
      <PositionDetailDialog
        open={!!selectedPosition}
        onOpenChange={(v) => !v && setSelectedPosition(null)}
        position={selectedPosition}
        tyre={selectedTyre}
        positionHistory={selectedPositionHistory}
        currentOdo={currentMachine?.current_odometer_km ?? null}
        canWrite={canWrite}
        onFit={() => {
          if (!selectedPosition) return;
          setFitPosition(selectedPosition);
          setFitOpen(true);
          setSelectedPosition(null);
        }}
        onInspect={() => {
          if (!selectedTyre) return;
          setInspectingTyre(selectedTyre);
        }}
        onRotate={() => {
          if (!selectedTyre) return;
          setRotatingTyre(selectedTyre);
        }}
        onRetire={() => {
          if (!selectedTyre) return;
          setRetiringTyre(selectedTyre);
          setSelectedPosition(null);
        }}
      />

      {/* Fit Tyre Dialog */}
      <FitTyreDialog
        open={fitOpen}
        onOpenChange={setFitOpen}
        machineId={selectedMachine}
        position={fitPosition}
        currentOdo={currentMachine?.current_odometer_km ?? null}
        onSaved={load}
      />

      {/* Quick Inspection Dialog */}
      <QuickInspectDialog
        open={!!inspectingTyre}
        onOpenChange={(v) => !v && setInspectingTyre(null)}
        tyre={inspectingTyre}
        onSaved={load}
      />

      {/* Tyre Rotation Dialog */}
      <RotateTyreDialog
        open={!!rotatingTyre}
        onOpenChange={(v) => !v && setRotatingTyre(null)}
        tyre={rotatingTyre}
        machineId={selectedMachine}
        layout={currentLayout}
        activeTyresByPosition={activeTyresByPosition}
        onSaved={load}
      />

      {/* Dedicated Retire / Remove Tyre Dialog */}
      <RetireTyreDialog
        open={!!retiringTyre}
        onOpenChange={(v) => !v && setRetiringTyre(null)}
        tyre={retiringTyre}
        currentOdo={currentMachine?.current_odometer_km ?? null}
        onSaved={load}
        onFitReplacement={(pos) => {
          setFitPosition(pos);
          setFitOpen(true);
        }}
      />

      {/* Full Vehicle Walkaround Inspection Dialog */}
      <WalkaroundInspectDialog
        open={walkaroundOpen}
        onOpenChange={setWalkaroundOpen}
        machine={currentMachine ?? null}
        layout={currentLayout}
        activeTyresByPosition={activeTyresByPosition}
        onSaved={load}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENT: TRUCK WHEEL CARD (Visual Rim + Tyre + S/N Tag + Actions)
// ─────────────────────────────────────────────────────────────
function TruckWheelCard({
  slot,
  tyre,
  currentOdo,
  onSelect,
  onFitNew,
  onInspect,
  onRotate,
}: {
  slot: { id: string; label: string; side: "left" | "right"; tier?: "outer" | "inner" };
  tyre: Tyre | null;
  currentOdo: number | null;
  onSelect: () => void;
  onFitNew: () => void;
  onInspect: () => void;
  onRotate: () => void;
}) {
  const status = tyre ? tyreStatus(tyre, currentOdo) : null;
  const isOverdue = status === "overdue";
  const isDueSoon = status === "due_soon";
  const isLowPressure = tyre?.pressure_psi != null && tyre.pressure_psi < TRUCK_TYRE_MIN_PSI;

  // Tread depth color
  const treadColor =
    tyre?.current_tread_mm == null
      ? "text-muted-foreground"
      : tyre.current_tread_mm <= TYRE_MIN_TREAD_MM
      ? "text-red-600 font-extrabold"
      : tyre.current_tread_mm <= TYRE_WARN_TREAD_MM
      ? "text-amber-600 font-bold"
      : "text-emerald-600 font-bold";

  return (
    <div
      onClick={tyre ? onSelect : onFitNew}
      className={`group relative flex w-28 cursor-pointer flex-col items-center rounded-xl border p-2.5 transition-all hover:scale-105 hover:shadow-md ${
        !tyre
          ? "border-dashed border-muted-foreground/30 bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
          : isOverdue || isLowPressure
          ? "border-red-400 bg-red-500/10 shadow-sm"
          : isDueSoon
          ? "border-amber-400 bg-amber-500/10 shadow-sm"
          : "border-border bg-card shadow-sm hover:border-primary/40"
      }`}
    >
      {/* Position tag */}
      <div className="flex w-full items-center justify-between text-[10px]">
        <span className="font-mono font-bold uppercase text-foreground">{slot.id}</span>
        <span className="text-[9px] text-muted-foreground uppercase">{slot.tier || slot.label}</span>
      </div>

      {/* Wheel Graphic */}
      <div className="relative my-1.5 flex h-14 w-14 items-center justify-center">
        {/* Outer Rubber Tyre with Tread Grooves */}
        <div
          className={`relative flex h-13 w-13 items-center justify-center rounded-full border-4 transition-colors ${
            !tyre
              ? "border-dashed border-muted-foreground/40 bg-zinc-100 dark:bg-zinc-800"
              : isOverdue || isLowPressure
              ? "border-red-500 bg-zinc-900"
              : isDueSoon
              ? "border-amber-500 bg-zinc-900"
              : "border-zinc-800 bg-zinc-900 dark:border-zinc-700"
          }`}
        >
          {/* Inner Steel / Alloy Rim */}
          <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-zinc-400 bg-zinc-300 dark:bg-zinc-700">
            {/* Center Lug Hub */}
            <div className="h-2.5 w-2.5 rounded-full bg-zinc-600 dark:bg-zinc-900" />
          </div>
        </div>

        {/* Warning Indicator */}
        {(isOverdue || isLowPressure) && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white shadow">
            <AlertTriangle className="h-2.5 w-2.5" />
          </span>
        )}
      </div>

      {/* Tyre Details or Empty Action */}
      {tyre ? (
        <div className="w-full space-y-0.5 text-center">
          {/* Prominent Serial Number */}
          <div className="truncate font-mono text-[10px] font-bold text-foreground bg-secondary/80 rounded px-1 py-0.2">
            {tyre.serial ? `S/N: ${tyre.serial}` : "No Serial"}
          </div>

          {/* Brand */}
          <div className="truncate text-[10px] text-muted-foreground font-medium">
            {tyre.brand || "Unbranded"}
          </div>

          {/* Tread Depth & PSI */}
          <div className="flex items-center justify-between text-[10px] pt-0.5">
            <span className={treadColor}>
              {tyre.current_tread_mm != null ? `${tyre.current_tread_mm}mm` : "—"}
            </span>
            <span className="font-mono text-muted-foreground text-[9px]">
              {tyre.pressure_psi != null ? `${tyre.pressure_psi}PSI` : ""}
            </span>
          </div>

          {/* Hover Action Bar (Shortcut on Desktop) */}
          <div className="hidden group-hover:flex items-center justify-center gap-1 pt-1 border-t border-border/50 mt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onInspect();
              }}
              title="Quick inspect"
              className="p-1 rounded bg-secondary hover:bg-primary/20 text-foreground transition-colors"
            >
              <Gauge className="h-3 w-3 text-primary" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRotate();
              }}
              title="Rotate tyre"
              className="p-1 rounded bg-secondary hover:bg-blue-500/20 text-foreground transition-colors"
            >
              <ArrowLeftRight className="h-3 w-3 text-blue-600" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center py-1 text-center">
          <span className="text-[10px] font-semibold text-primary group-hover:underline">
            + Fit Tyre
          </span>
          <span className="text-[9px] text-muted-foreground">Empty slot</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DIALOG: POSITION DETAIL & TYRE DOSSIER
// ─────────────────────────────────────────────────────────────
function PositionDetailDialog({
  open,
  onOpenChange,
  position,
  tyre,
  positionHistory,
  currentOdo,
  canWrite,
  onFit,
  onInspect,
  onRotate,
  onRetire,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  position: string | null;
  tyre: Tyre | null;
  positionHistory: Tyre[];
  currentOdo: number | null;
  canWrite: boolean;
  onFit: () => void;
  onInspect: () => void;
  onRotate: () => void;
  onRetire: () => void;
}) {
  const { currentLang } = useI18n();
  const isSwahili = currentLang === "sw";
  const [copied, setCopied] = useState(false);

  if (!position) return null;
  const status = tyre ? tyreStatus(tyre, currentOdo) : null;
  const posName = formatPositionName(position);

  const copySerial = () => {
    if (!tyre?.serial) return;
    navigator.clipboard.writeText(tyre.serial);
    setCopied(true);
    toast.success("Serial number copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between pr-4">
            <div>
              <DialogTitle className="text-base font-bold">
                {posName} ({position})
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isSwahili ? "Maelezo ya tairi na ukaguzi wa gurudumu hili" : "Wheel position tyre dossier & health"}
              </DialogDescription>
            </div>
            {status && <StatusBadge status={status} />}
          </div>
        </DialogHeader>

        {tyre ? (
          <div className="space-y-4">
            {/* Prominent Serial Number Card */}
            <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Tyre Serial Number (S/N)
                </span>
                <div className="font-mono text-base font-bold text-foreground">
                  {tyre.serial || "Not Registered"}
                </div>
              </div>
              {tyre.serial && (
                <Button variant="ghost" size="sm" onClick={copySerial} className="h-8 px-2 text-xs">
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>

            {/* Core Specs Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-secondary/50 p-2.5">
                <span className="text-muted-foreground">Brand & Model</span>
                <div className="font-semibold text-foreground">{tyre.brand || "—"}</div>
              </div>
              <div className="rounded-lg bg-secondary/50 p-2.5">
                <span className="text-muted-foreground">Tyre Size</span>
                <div className="font-semibold text-foreground">{tyre.size || "—"}</div>
              </div>
              <div className="rounded-lg bg-secondary/50 p-2.5">
                <span className="text-muted-foreground">Tread Depth (Current)</span>
                <div className="font-semibold text-foreground">
                  {tyre.current_tread_mm != null ? `${tyre.current_tread_mm} mm` : "—"}
                  {tyre.initial_tread_mm != null && (
                    <span className="text-[10px] text-muted-foreground ml-1">
                      (New: {tyre.initial_tread_mm}mm)
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-secondary/50 p-2.5">
                <span className="text-muted-foreground">Cold Pressure</span>
                <div className="font-semibold text-foreground">
                  {tyre.pressure_psi != null ? `${tyre.pressure_psi} PSI` : "Not recorded"}
                </div>
              </div>
              <div className="rounded-lg bg-secondary/50 p-2.5">
                <span className="text-muted-foreground">Fitted Date</span>
                <div className="font-semibold text-foreground">{formatDate(tyre.fitted_at)}</div>
              </div>
              <div className="rounded-lg bg-secondary/50 p-2.5">
                <span className="text-muted-foreground">Fitted at Odometer</span>
                <div className="font-semibold text-foreground">
                  {tyre.fitted_odo != null ? `${formatNumber(tyre.fitted_odo)} km` : "—"}
                </div>
              </div>
              {tyre.pattern && (
                <div className="rounded-lg bg-secondary/50 p-2.5">
                  <span className="text-muted-foreground">Tread Pattern</span>
                  <div className="font-semibold text-foreground capitalize">{tyre.pattern}</div>
                </div>
              )}
              {tyre.dot_code && (
                <div className="rounded-lg bg-secondary/50 p-2.5">
                  <span className="text-muted-foreground">DOT Code</span>
                  <div className="font-semibold text-foreground">{tyre.dot_code}</div>
                </div>
              )}
            </div>

            {tyre.notes && (
              <div className="rounded-md bg-muted/60 p-2.5 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground block mb-0.5">Notes:</span>
                {tyre.notes}
              </div>
            )}

            {/* Quick Actions Bar */}
            {canWrite && (
              <div className="grid grid-cols-3 gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={onInspect} className="text-xs h-9">
                  <Gauge className="mr-1 h-3.5 w-3.5 text-primary" /> Inspect
                </Button>
                <Button variant="outline" size="sm" onClick={onRotate} className="text-xs h-9">
                  <ArrowLeftRight className="mr-1 h-3.5 w-3.5 text-blue-600" /> Rotate
                </Button>
                <Button variant="destructive" size="sm" onClick={onRetire} className="text-xs h-9">
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              {isSwahili
                ? "Hakuna tairi lililofungwa kwenye gurudumu hili kwa sasa."
                : "No tyre is currently mounted at this wheel position."}
            </p>
            {canWrite && (
              <Button onClick={onFit} className="w-full h-10 text-xs" style={{ background: "var(--gradient-primary)" }}>
                <Plus className="mr-1.5 h-4 w-4" />
                {isSwahili ? "Funga Tairi kwenye Nafasi Hii" : "Fit Tyre at this Position"}
              </Button>
            )}
          </div>
        )}

        {/* History at this position */}
        {positionHistory.length > 0 && (
          <div className="border-t border-border pt-3">
            <span className="mb-2 block text-xs font-semibold text-muted-foreground uppercase">
              Previous Tyres at this Position
            </span>
            <ul className="space-y-1.5 text-xs">
              {positionHistory.slice(0, 3).map((h) => (
                <li key={h.id} className="flex items-center justify-between rounded bg-muted/40 p-1.5">
                  <span className="font-mono font-medium">
                    {h.serial ? `S/N: ${h.serial}` : h.brand || "Tyre"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(h.fitted_at)} – {formatDate(h.removed_at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// DIALOG: FIT NEW TYRE (Prominent Serial Number & Specs)
// ─────────────────────────────────────────────────────────────
function FitTyreDialog({
  open,
  onOpenChange,
  machineId,
  position,
  currentOdo,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machineId: string;
  position: string;
  currentOdo: number | null;
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const { currentLang } = useI18n();
  const isSwahili = currentLang === "sw";
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    serial: "",
    brand: "",
    size: "315/80R22.5",
    pattern: "all_position",
    dot_code: "",
    fitted_at: new Date().toISOString().slice(0, 10),
    fitted_odo: "",
    initial_tread_mm: "15.0",
    current_tread_mm: "15.0",
    pressure_psi: "110",
    target_replace_km: "80000",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        serial: "",
        brand: "Michelin",
        size: "315/80R22.5",
        pattern: position.startsWith("A1") ? "steer" : position.startsWith("B") ? "drive" : "all_position",
        dot_code: "",
        fitted_at: new Date().toISOString().slice(0, 10),
        fitted_odo: currentOdo != null ? String(currentOdo) : "",
        initial_tread_mm: "15.0",
        current_tread_mm: "15.0",
        pressure_psi: "110",
        target_replace_km: "80000",
        notes: "",
      });
    }
  }, [open, currentOdo, position]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !machineId) return;

    if (!form.serial.trim()) {
      return toast.error("Tyre Serial Number is required.");
    }

    setSubmitting(true);

    const encodedNotes = encodeTyreNotes({
      pressure_psi: form.pressure_psi ? Number(form.pressure_psi) : null,
      pattern: form.pattern,
      dot_code: form.dot_code.trim(),
      initial_tread_mm: form.initial_tread_mm ? Number(form.initial_tread_mm) : null,
      notes: form.notes.trim(),
    });

    const payload = {
      organisation_id: profile.organisation_id,
      machine_id: machineId,
      position,
      serial: form.serial.trim().toUpperCase(),
      brand: form.brand.trim() || null,
      size: form.size.trim() || null,
      fitted_at: form.fitted_at || null,
      fitted_odo: form.fitted_odo === "" ? null : Number(form.fitted_odo),
      current_tread_mm: form.current_tread_mm === "" ? null : Number(form.current_tread_mm),
      target_replace_km: form.target_replace_km === "" ? null : Number(form.target_replace_km),
      notes: encodedNotes,
    };

    const { error } = await supabase.from("tyres").insert(payload);
    setSubmitting(false);

    if (error) return toast.error(error.message);
    toast.success(isSwahili ? "Tairi limefungwa na kusajiliwa" : "Tyre fitted and registered successfully");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">
            {isSwahili ? "Funga Tairi Jipya" : "Fit New Tyre"} — {position}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {formatPositionName(position)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/* Prominent Tyre Serial Number Input */}
          <div className="space-y-1.5 rounded-xl border-2 border-primary/40 bg-primary/5 p-3">
            <Label htmlFor="tyre_serial" className="text-xs font-bold uppercase tracking-wider text-primary">
              Tyre Serial Number (S/N) *
            </Label>
            <Input
              id="tyre_serial"
              required
              placeholder="e.g. MI-2024-88910"
              value={form.serial}
              onChange={(e) => setForm({ ...form, serial: e.target.value.toUpperCase() })}
              className="font-mono text-sm font-bold uppercase tracking-wider h-10 bg-background"
            />
            <p className="text-[11px] text-muted-foreground">
              Manufacturer serial number stamped on tyre sidewall.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Brand</Label>
              <Select value={form.brand} onValueChange={(b) => setForm({ ...form, brand: b })}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Pick brand" />
                </SelectTrigger>
                <SelectContent>
                  {POPULAR_BRANDS.map((b) => (
                    <SelectItem key={b} value={b} className="text-xs">
                      {b}
                    </SelectItem>
                  ))}
                  <SelectItem value="Other" className="text-xs">
                    Other / Custom
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Size</Label>
              <Select value={form.size} onValueChange={(s) => setForm({ ...form, size: s })}>
                <SelectTrigger className="h-9 text-xs font-mono">
                  <SelectValue placeholder="Pick size" />
                </SelectTrigger>
                <SelectContent>
                  {POPULAR_TRUCK_SIZES.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs font-mono">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tread Pattern</Label>
              <Select value={form.pattern} onValueChange={(p) => setForm({ ...form, pattern: p })}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYRE_PATTERNS.map((p) => (
                    <SelectItem key={p.value} value={p.value} className="text-xs">
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">DOT / Manufacture Week</Label>
              <Input
                placeholder="e.g. 4223 (Wk 42, 2023)"
                value={form.dot_code}
                onChange={(e) => setForm({ ...form, dot_code: e.target.value })}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Initial Tread (mm)</Label>
              <Input
                type="number"
                step="0.1"
                min={0}
                value={form.initial_tread_mm}
                onChange={(e) => setForm({ ...form, initial_tread_mm: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Cold Pressure (PSI)</Label>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 110"
                value={form.pressure_psi}
                onChange={(e) => setForm({ ...form, pressure_psi: e.target.value })}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Fitted Date</Label>
              <Input
                type="date"
                value={form.fitted_at}
                onChange={(e) => setForm({ ...form, fitted_at: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Fitted at Odometer (km)</Label>
              <Input
                type="number"
                min={0}
                value={form.fitted_odo}
                onChange={(e) => setForm({ ...form, fitted_odo: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Target Replacement Mileage (km)</Label>
              <Input
                type="number"
                min={0}
                value={form.target_replace_km}
                onChange={(e) => setForm({ ...form, target_replace_km: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Notes / Comments</Label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="e.g. New fitment from central warehouse"
                className="flex min-h-[50px] w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} style={{ background: "var(--gradient-primary)" }}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSwahili ? "Kamilisha Usajili wa Tairi" : "Complete Tyre Fitment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// DIALOG: QUICK INSPECTION (Tread Depth mm + Pressure PSI)
// ─────────────────────────────────────────────────────────────
function QuickInspectDialog({
  open,
  onOpenChange,
  tyre,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tyre: Tyre | null;
  onSaved: () => void;
}) {
  const { currentLang } = useI18n();
  const isSwahili = currentLang === "sw";
  const [submitting, setSubmitting] = useState(false);

  const [tread, setTread] = useState("");
  const [pressure, setPressure] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (tyre) {
      setTread(tyre.current_tread_mm != null ? String(tyre.current_tread_mm) : "");
      setPressure(tyre.pressure_psi != null ? String(tyre.pressure_psi) : "110");
      setNotes("");
    }
  }, [tyre]);

  if (!tyre) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const newTread = tread === "" ? null : Number(tread);
    const newPressure = pressure === "" ? null : Number(pressure);

    const encodedNotes = encodeTyreNotes({
      pressure_psi: newPressure,
      pattern: tyre.pattern,
      dot_code: tyre.dot_code,
      initial_tread_mm: tyre.initial_tread_mm,
      notes: notes.trim() || tyre.notes,
    });

    const { error } = await supabase
      .from("tyres")
      .update({
        current_tread_mm: newTread,
        notes: encodedNotes,
      })
      .eq("id", tyre.id);

    setSubmitting(false);

    if (error) return toast.error(error.message);
    toast.success(isSwahili ? "Ukaguzi umehifadhiwa kikamilifu" : "Tyre inspection logged successfully");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            {isSwahili ? "Kurekodi Ukaguzi wa Tairi" : "Log Tyre Inspection"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Position: <span className="font-mono font-bold">{normalizePosition(tyre.position)}</span> · S/N:{" "}
            <span className="font-mono font-bold">{tyre.serial || "Unregistered"}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Current Tread Depth (mm) *</Label>
              <Input
                type="number"
                step="0.1"
                min={0}
                required
                value={tread}
                onChange={(e) => setTread(e.target.value)}
                className="h-10 text-sm font-bold"
              />
              <span className="text-[10px] text-muted-foreground">Min safe: 3.0 mm</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Cold Pressure (PSI)</Label>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 110"
                value={pressure}
                onChange={(e) => setPressure(e.target.value)}
                className="h-10 text-sm font-mono"
              />
              <span className="text-[10px] text-muted-foreground">Std truck: 100-120 PSI</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Inspection Notes</Label>
            <Input
              placeholder="e.g. Even wear, no sidewall bulges"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} style={{ background: "var(--gradient-primary)" }}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Inspection
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// DIALOG: ROTATE TYRE (Swap positions between axles/spares)
// ─────────────────────────────────────────────────────────────
function RotateTyreDialog({
  open,
  onOpenChange,
  tyre,
  machineId,
  layout,
  activeTyresByPosition,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tyre: Tyre | null;
  machineId: string;
  layout: typeof TRUCK_LAYOUTS["6x4"];
  activeTyresByPosition: Map<string, Tyre>;
  onSaved: () => void;
}) {
  const { currentLang } = useI18n();
  const isSwahili = currentLang === "sw";
  const [submitting, setSubmitting] = useState(false);
  const [targetPosition, setTargetPosition] = useState<string>("");

  // Collect all slots for current truck + spares
  const allAvailableSlots = useMemo(() => {
    const slots: { id: string; label: string }[] = [];
    for (const axle of layout.axles) {
      for (const slot of axle.slots) {
        slots.push({ id: slot.id, label: `${slot.id} — ${axle.name} (${slot.label})` });
      }
    }
    slots.push({ id: "Spare1", label: "Spare 1 (Carrier mount)" });
    slots.push({ id: "Spare2", label: "Spare 2 (Carrier mount)" });
    return slots;
  }, [layout]);

  useEffect(() => {
    if (tyre && allAvailableSlots.length > 0) {
      const other = allAvailableSlots.find((s) => s.id !== normalizePosition(tyre.position));
      if (other) setTargetPosition(other.id);
    }
  }, [tyre, allAvailableSlots]);

  if (!tyre) return null;

  const currentPos = normalizePosition(tyre.position);
  const occupant = activeTyresByPosition.get(targetPosition) ?? null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPosition || targetPosition === currentPos) {
      return toast.error("Please pick a different target position.");
    }

    setSubmitting(true);

    if (occupant) {
      // SWAP positions: update tyre A to target, and tyre B to current
      const [{ error: errA }, { error: errB }] = await Promise.all([
        supabase.from("tyres").update({ position: targetPosition }).eq("id", tyre.id),
        supabase.from("tyres").update({ position: currentPos }).eq("id", occupant.id),
      ]);

      setSubmitting(false);
      if (errA || errB) {
        return toast.error(errA?.message || errB?.message || "Failed to swap positions");
      }
      toast.success(
        isSwahili
          ? `Matairi yamebadilishwa nafasi (${currentPos} ⇄ ${targetPosition})`
          : `Tyres swapped positions (${currentPos} ⇄ ${targetPosition})`
      );
    } else {
      // MOVE to empty slot
      const { error } = await supabase
        .from("tyres")
        .update({ position: targetPosition })
        .eq("id", tyre.id);

      setSubmitting(false);
      if (error) return toast.error(error.message);
      toast.success(
        isSwahili
          ? `Tairi limehamishwa kwenda ${targetPosition}`
          : `Tyre moved to ${targetPosition}`
      );
    }

    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            {isSwahili ? "Mzunguko wa Tairi (Tyre Rotation)" : "Rotate / Swap Tyre Position"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Move tyre across axles to equalize tread wear and extend lifespan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-xl border border-border bg-secondary/30 p-3 text-xs space-y-1">
            <div className="font-semibold text-foreground">
              Current Tyre: <span className="font-mono text-primary">{tyre.serial || "No Serial"}</span>
            </div>
            <div className="text-muted-foreground">
              Position: <span className="font-mono font-bold text-foreground">{currentPos}</span> (
              {formatPositionName(currentPos)})
            </div>
            <div className="text-muted-foreground">
              Tread: {tyre.current_tread_mm != null ? `${tyre.current_tread_mm} mm` : "—"} ·{" "}
              {tyre.brand || "Unbranded"}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Select Target Position</Label>
            <Select value={targetPosition} onValueChange={setTargetPosition}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allAvailableSlots
                  .filter((s) => s.id !== currentPos)
                  .map((slot) => {
                    const occ = activeTyresByPosition.get(slot.id);
                    return (
                      <SelectItem key={slot.id} value={slot.id} className="text-xs">
                        {slot.label} {occ ? `(Occupied: S/N ${occ.serial || "Tyre"})` : "(Empty)"}
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
          </div>

          {occupant ? (
            <div className="rounded-lg bg-amber-500/10 border border-amber-300 p-2.5 text-xs text-amber-900 dark:text-amber-200">
              <span className="font-semibold block mb-0.5">Two-way Swap:</span>
              Position <span className="font-mono font-bold">{targetPosition}</span> currently has tyre{" "}
              <span className="font-mono font-bold">{occupant.serial || "Unregistered"}</span>. Both tyres will
              swap places.
            </div>
          ) : (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-300 p-2.5 text-xs text-emerald-900 dark:text-emerald-200">
              Position <span className="font-mono font-bold">{targetPosition}</span> is currently empty.
              The tyre will simply move to this slot.
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} style={{ background: "var(--gradient-primary)" }}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {occupant ? "Swap Tyres" : "Move Tyre"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// DIALOG: RETIRE / REMOVE TYRE (With Reason & Final Tread)
// ─────────────────────────────────────────────────────────────
function RetireTyreDialog({
  open,
  onOpenChange,
  tyre,
  currentOdo,
  onSaved,
  onFitReplacement,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tyre: Tyre | null;
  currentOdo: number | null;
  onSaved: () => void;
  onFitReplacement: (pos: string) => void;
}) {
  const { currentLang } = useI18n();
  const isSwahili = currentLang === "sw";
  const [submitting, setSubmitting] = useState(false);

  const [reason, setReason] = useState("worn_minimum");
  const [finalTread, setFinalTread] = useState("");
  const [fitReplacementImmediately, setFitReplacementImmediately] = useState(false);

  useEffect(() => {
    if (tyre) {
      setFinalTread(tyre.current_tread_mm != null ? String(tyre.current_tread_mm) : "");
      setReason("worn_minimum");
      setFitReplacementImmediately(false);
    }
  }, [tyre]);

  if (!tyre) return null;
  const position = normalizePosition(tyre.position);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const selectedReasonLabel =
      RETIRE_REASONS.find((r) => r.value === reason)?.label || reason;

    const { error } = await supabase
      .from("tyres")
      .update({
        removed_at: new Date().toISOString().slice(0, 10),
        removed_reason: selectedReasonLabel,
        current_tread_mm: finalTread === "" ? tyre.current_tread_mm : Number(finalTread),
      })
      .eq("id", tyre.id);

    setSubmitting(false);

    if (error) return toast.error(error.message);
    toast.success(isSwahili ? "Tairi limeondolewa kikamilifu" : "Tyre removed from vehicle");
    onOpenChange(false);
    onSaved();

    if (fitReplacementImmediately) {
      onFitReplacement(position);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            {isSwahili ? "Ondoa Tairi Kwenye Lori" : "Remove / Retire Tyre from Vehicle"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Position: <span className="font-mono font-bold">{position}</span> · S/N:{" "}
            <span className="font-mono font-bold text-foreground">{tyre.serial || "Unregistered"}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Reason for Removal *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETIRE_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value} className="text-xs">
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Final Tread Depth (mm)</Label>
              <Input
                type="number"
                step="0.1"
                min={0}
                value={finalTread}
                onChange={(e) => setFinalTread(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Current Odometer (km)</Label>
              <Input
                type="text"
                disabled
                value={currentOdo != null ? `${formatNumber(currentOdo)} km` : "—"}
                className="h-9 text-xs bg-muted"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-xs text-foreground cursor-pointer bg-secondary/30">
            <input
              type="checkbox"
              checked={fitReplacementImmediately}
              onChange={(e) => setFitReplacementImmediately(e.target.checked)}
              className="rounded border-input text-primary focus:ring-primary h-4 w-4"
            />
            <span>Fit a new replacement tyre immediately at this position</span>
          </label>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Removal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// DIALOG: WALKAROUND INSPECTION (Rapid batch check for all wheels)
// ─────────────────────────────────────────────────────────────
function WalkaroundInspectDialog({
  open,
  onOpenChange,
  machine,
  layout,
  activeTyresByPosition,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machine: Machine | null;
  layout: typeof TRUCK_LAYOUTS["6x4"];
  activeTyresByPosition: Map<string, Tyre>;
  onSaved: () => void;
}) {
  const { currentLang } = useI18n();
  const isSwahili = currentLang === "sw";
  const [submitting, setSubmitting] = useState(false);

  // Map of inputs per slot: { [slotId]: { tread: string, psi: string } }
  const [inputs, setInputs] = useState<Record<string, { tread: string; psi: string }>>({});

  // Flatten all slots in this layout
  const allSlots = useMemo(() => {
    const list: { slotId: string; label: string; axleName: string; tyre: Tyre | null }[] = [];
    for (const axle of layout.axles) {
      for (const slot of axle.slots) {
        list.push({
          slotId: slot.id,
          label: slot.label,
          axleName: axle.name,
          tyre: activeTyresByPosition.get(slot.id) ?? null,
        });
      }
    }
    list.push({
      slotId: "Spare1",
      label: "Spare 1",
      axleName: "Spare Carrier",
      tyre: activeTyresByPosition.get("Spare1") ?? null,
    });
    list.push({
      slotId: "Spare2",
      label: "Spare 2",
      axleName: "Spare Carrier",
      tyre: activeTyresByPosition.get("Spare2") ?? null,
    });
    return list;
  }, [layout, activeTyresByPosition]);

  useEffect(() => {
    if (open) {
      const init: Record<string, { tread: string; psi: string }> = {};
      for (const item of allSlots) {
        init[item.slotId] = {
          tread: item.tyre?.current_tread_mm != null ? String(item.tyre.current_tread_mm) : "",
          psi: item.tyre?.pressure_psi != null ? String(item.tyre.pressure_psi) : "110",
        };
      }
      setInputs(init);
    }
  }, [open, allSlots]);

  if (!machine) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const updatePromises: Promise<any>[] = [];

    for (const item of allSlots) {
      if (!item.tyre) continue;
      const slotInput = inputs[item.slotId];
      if (!slotInput) continue;

      const newTread = slotInput.tread === "" ? null : Number(slotInput.tread);
      const newPsi = slotInput.psi === "" ? null : Number(slotInput.psi);

      // Only update if changed
      if (newTread !== item.tyre.current_tread_mm || newPsi !== item.tyre.pressure_psi) {
        const encodedNotes = encodeTyreNotes({
          pressure_psi: newPsi,
          pattern: item.tyre.pattern,
          dot_code: item.tyre.dot_code,
          initial_tread_mm: item.tyre.initial_tread_mm,
          notes: item.tyre.notes,
        });

        updatePromises.push(
          supabase
            .from("tyres")
            .update({
              current_tread_mm: newTread,
              notes: encodedNotes,
            })
            .eq("id", item.tyre.id)
        );
      }
    }

    if (updatePromises.length === 0) {
      setSubmitting(false);
      onOpenChange(false);
      return toast.info("No tyre metrics were modified.");
    }

    const results = await Promise.all(updatePromises);
    setSubmitting(false);

    const hasError = results.some((r) => r.error);
    if (hasError) {
      toast.error("Some tyre inspection updates failed.");
    } else {
      toast.success(
        isSwahili
          ? `Ukaguzi wa matairi ${updatePromises.length} umehifadhiwa`
          : `Walkaround inspection saved for ${updatePromises.length} tyres`
      );
    }

    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            {isSwahili ? "Ukaguzi wa Haraka wa Lori Zima" : "Full Vehicle Walkaround Inspection"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Vehicle: <strong className="text-foreground">{machine.plate_number || machine.name}</strong> · Record tread
            depth & PSI across all wheels in one pass.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {allSlots.map((item) => {
              const currentInput = inputs[item.slotId] || { tread: "", psi: "" };
              const isFitted = !!item.tyre;

              return (
                <div
                  key={item.slotId}
                  className={`flex flex-wrap items-center justify-between gap-3 p-3 transition-colors ${
                    !isFitted ? "opacity-60 bg-muted/20" : "hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold w-14 rounded bg-secondary px-2 py-1 text-center">
                      {item.slotId}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-foreground">
                        {item.axleName} ({item.label})
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {isFitted ? (
                          <>
                            <span className="font-mono font-medium text-foreground">
                              {item.tyre?.serial ? `S/N: ${item.tyre.serial}` : "No Serial"}
                            </span>{" "}
                            · {item.tyre?.brand || "Tyre"}
                          </>
                        ) : (
                          <span className="italic text-muted-foreground">Empty Wheel Position</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isFitted ? (
                    <div className="flex items-center gap-3">
                      <div className="w-24 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Tread (mm)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min={0}
                          placeholder="mm"
                          value={currentInput.tread}
                          onChange={(e) =>
                            setInputs({
                              ...inputs,
                              [item.slotId]: { ...currentInput, tread: e.target.value },
                            })
                          }
                          className="h-8 text-xs font-bold"
                        />
                      </div>

                      <div className="w-24 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Cold PSI</Label>
                        <Input
                          type="number"
                          min={0}
                          placeholder="PSI"
                          value={currentInput.psi}
                          onChange={(e) =>
                            setInputs({
                              ...inputs,
                              [item.slotId]: { ...currentInput, psi: e.target.value },
                            })
                          }
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground pr-4">—</span>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} style={{ background: "var(--gradient-primary)" }}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Walkaround Inspection
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
