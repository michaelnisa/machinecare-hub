import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Route,
  Plus,
  Play,
  Square,
  Ban,
  Trash2,
  Loader2,
  Receipt,
  AlertOctagon,
  Search,
  Building2,
  FileText,
  Clock,
  ArrowRight,
  Eye,
  MapPin,
  Truck,
  User,
  HeartHandshake,
  Phone,
  Globe2,
  DollarSign,
  Check,
  SlidersHorizontal,
  Info,
  Fuel,
} from "lucide-react";
import { TripExpensesListDialog } from "@/components/TripExpensesListDialog";
import { CorridorExpenseCatalogDialog } from "@/components/CorridorExpenseCatalogDialog";
import { TripReceiptDialog } from "@/components/TripReceiptDialog";
import { QuickFuelDialog } from "@/components/QuickFuelDialog";
import { SearchableVehicleSelect } from "@/components/fleet/SearchableVehicleSelect";
import { SearchableDriverSelect } from "@/components/fleet/SearchableDriverSelect";
import { PaymentTermsInput } from "@/components/fleet/PaymentTermsInput";
import {
  CROSS_BORDER_CORRIDORS,
  DEFAULT_USD_TO_TZS_RATE,
  convertUsdToTzs,
  convertTzsToUsd,
  formatDualCurrency,
  formatTripCurrency,
  hoursToDaysAndHours,
  formatTurnaroundDuration,
  daysAndHoursToHours,
  type CrossBorderCorridor,
  type CorridorExpenseItem,
} from "@/services/crossBorderCorridors";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDate, formatNumber, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import {
  SAFE_MACHINE_COLUMNS,
  SAFE_DRIVER_COLUMNS,
  parseMachine,
  parseDriver,
  parseCargoMeta,
  type FleetVehicle,
  type FleetDriver,
} from "@/lib/fleet-metadata";

type Machine = FleetVehicle;
type Driver = FleetDriver;

type ExpenseSummary = {
  total: number;
  fines: number;
  receipts: number;
  count: number;
};

type Trip = {
  id: string;
  machine_id: string;
  driver_id: string | null;
  client_name: string | null;
  client_order_no: string | null;
  purpose: string | null;
  origin: string | null;
  destination: string | null;
  route_notes: string | null;
  cargo_description: string | null;
  is_round_trip: boolean | null;
  roundtrip_hours_est: number | null;
  estimated_return_at: string | null;
  start_odo: number | null;
  end_odo: number | null;
  start_at: string | null;
  end_at: string | null;
  fuel_used_l: number | null;
  cost: number | null;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  corridor_id?: string | null;
  corridor_name?: string | null;
  border_post?: string | null;
  currency?: "USD" | "TZS" | null;
  exchange_rate?: number | null;
  expenses?: any[] | null;
  client_billing_amount?: number | null;
  billing_currency?: "USD" | "TZS" | null;
  payment_terms?: string | null;
  tax_percent?: number | null;
  include_statutory_tolls?: boolean | null;
  custom_logo_url?: string | null;
};

const STATUS_CLASS: Record<string, string> = {
  planned: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-muted text-muted-foreground",
};

const TABS = ["all", "planned", "in_progress", "completed", "cancelled"] as const;
const TAB_LABELS: Record<(typeof TABS)[number], string> = {
  all: "All",
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function parseTripRecord(raw: any): Trip {
  let client_name = raw.client_name ?? null;
  let client_order_no = raw.client_order_no ?? null;
  let roundtrip_hours_est = raw.roundtrip_hours_est ?? null;
  let is_round_trip = raw.is_round_trip ?? true;
  let cargo_description = raw.cargo_description ?? null;
  let purpose = raw.purpose ?? null;
  let route_notes = raw.route_notes ?? null;
  let estimated_return_at = raw.estimated_return_at ?? null;
  let corridor_id = raw.corridor_id ?? null;
  let corridor_name = raw.corridor_name ?? null;
  let border_post = raw.border_post ?? null;
  let currency = raw.currency ?? null;
  let exchange_rate = raw.exchange_rate ?? null;
  let expenses = raw.expenses ?? null;
  let client_billing_amount = raw.client_billing_amount ?? null;
  let billing_currency = raw.billing_currency ?? null;
  let payment_terms = raw.payment_terms ?? null;
  let tax_percent = raw.tax_percent ?? null;
  let include_statutory_tolls = raw.include_statutory_tolls ?? null;
  let custom_logo_url = raw.custom_logo_url ?? null;

  if (raw.cargo_description && typeof raw.cargo_description === "string" && raw.cargo_description.trim().startsWith("{")) {
    const parsed = parseCargoMeta(raw.cargo_description);
    if (parsed) {
      if (parsed.client) client_name = parsed.client;
      if (parsed.order_no) client_order_no = parsed.order_no;
      if (parsed.est_hours != null) roundtrip_hours_est = Number(parsed.est_hours);
      if (parsed.is_round_trip != null) is_round_trip = Boolean(parsed.is_round_trip);
      if (parsed.purpose) purpose = parsed.purpose;
      if (parsed.cargo && typeof parsed.cargo === "string" && !parsed.cargo.trim().startsWith("{")) {
        cargo_description = parsed.cargo;
      } else {
        cargo_description = null;
      }
      if (parsed.route_notes) route_notes = parsed.route_notes;
      if (parsed.estimated_return_at) estimated_return_at = parsed.estimated_return_at;
      if (parsed.corridor_id) corridor_id = parsed.corridor_id;
      if (parsed.corridor_name) corridor_name = parsed.corridor_name;
      if (parsed.border_post) border_post = parsed.border_post;
      if (parsed.currency) currency = parsed.currency;
      if (parsed.exchange_rate != null) exchange_rate = Number(parsed.exchange_rate);
      if (parsed.expenses) expenses = parsed.expenses;
      if (parsed.client_billing_amount != null) client_billing_amount = Number(parsed.client_billing_amount);
      if (parsed.billing_currency) billing_currency = parsed.billing_currency;
      if (parsed.payment_terms) payment_terms = parsed.payment_terms;
      if (parsed.tax_percent != null) tax_percent = Number(parsed.tax_percent);
      if (parsed.include_statutory_tolls != null) include_statutory_tolls = Boolean(parsed.include_statutory_tolls);
      if (parsed.custom_logo_url) custom_logo_url = parsed.custom_logo_url;
    } else {
      cargo_description = null;
    }
  }

  if (typeof cargo_description === "string" && cargo_description.trim().startsWith("{")) {
    cargo_description = null;
  }

  return {
    ...raw,
    client_name,
    client_order_no,
    roundtrip_hours_est,
    is_round_trip,
    cargo_description,
    purpose,
    route_notes,
    estimated_return_at,
    corridor_id,
    corridor_name,
    border_post,
    currency,
    exchange_rate,
    expenses,
    client_billing_amount,
    billing_currency,
    payment_terms,
    tax_percent,
    include_statutory_tolls,
    custom_logo_url,
  };
}

function calculateRoundtripDisplay(t: Trip) {
  if (t.status === "completed" && t.start_at && t.end_at) {
    const ms = new Date(t.end_at).getTime() - new Date(t.start_at).getTime();
    if (ms > 0) {
      const days = Math.floor(ms / (24 * 3600 * 1000));
      const hours = Math.floor((ms % (24 * 3600 * 1000)) / (3600 * 1000));
      const mins = Math.floor((ms % (3600 * 1000)) / (60 * 1000));
      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0 || days > 0) parts.push(`${hours}h`);
      parts.push(`${mins}m`);
      return {
        label: parts.join(" "),
        sub: "Turnaround duration",
        isDone: true,
      };
    }
  }

  if (t.status === "in_progress" && t.start_at) {
    const ms = Date.now() - new Date(t.start_at).getTime();
    if (ms > 0) {
      const days = Math.floor(ms / (24 * 3600 * 1000));
      const hours = Math.floor((ms % (24 * 3600 * 1000)) / (3600 * 1000));
      const elapsed = `${days > 0 ? `${days}d ` : ""}${hours}h elapsed`;
      return {
        label: elapsed,
        sub: t.roundtrip_hours_est ? `Est. RT: ${formatTurnaroundDuration(t.roundtrip_hours_est)}` : "In transit",
        isDone: false,
      };
    }
  }

  if (t.roundtrip_hours_est) {
    const dur = hoursToDaysAndHours(t.roundtrip_hours_est);
    return {
      label: dur.formatted,
      sub: t.is_round_trip !== false ? `Est. roundtrip (${t.roundtrip_hours_est}h)` : `Est. one-way (${t.roundtrip_hours_est}h)`,
      isDone: false,
    };
  }

  return {
    label: t.is_round_trip !== false ? "Roundtrip" : "One-way",
    sub: "Standard run",
    isDone: false,
  };
}

export default function Trips() {
  const { profile, organisation } = useAuth();
  const { canWrite } = useUserRole();
  const { t: i18n } = useI18n();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [corridorForNewTrip, setCorridorForNewTrip] = useState<CrossBorderCorridor | null>(null);
  const [closeTrip, setCloseTrip] = useState<Trip | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [confirmDeleteTrip, setConfirmDeleteTrip] = useState<Trip | null>(null);
  const [expenseSummaries, setExpenseSummaries] = useState<Map<string, ExpenseSummary>>(new Map());
  const [expensesTrip, setExpensesTrip] = useState<Trip | null>(null);
  const [detailTrip, setDetailTrip] = useState<Trip | null>(null);
  const [receiptTrip, setReceiptTrip] = useState<Trip | null>(null);
  const [fuelTrip, setFuelTrip] = useState<Trip | null>(null);

  const openReceiptById = async (tripId: string) => {
    const existing = trips.find((t) => t.id === tripId);
    if (existing) {
      setReceiptTrip(existing);
      return;
    }
    const { data } = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle();
    if (data) {
      setReceiptTrip(parseTripRecord(data));
    }
  };

  const handleTripSaved = async (createdTripId?: string) => {
    await load();
    if (createdTripId) {
      await openReceiptById(createdTripId);
    }
  };

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: t, error: tErr }, { data: m }, { data: d }, { data: exp }] = await Promise.all([
      supabase.from("trips").select("*").order("created_at", { ascending: false }),
      supabase
        .from("machines")
        .select(SAFE_MACHINE_COLUMNS)
        .order("name"),
      supabase
        .from("drivers")
        .select(SAFE_DRIVER_COLUMNS)
        .eq("status", "active")
        .order("full_name"),
      (supabase as any).from("trip_expenses").select("id, trip_id, expense_type, amount, currency"),
    ]);

    if (tErr) toast.error(tErr.message);
    setTrips((t ?? []).map(parseTripRecord));
    setMachines((m ?? []).map(parseMachine));
    setDrivers((d ?? []).map(parseDriver));

    const expMap = new Map<string, ExpenseSummary>();
    (exp ?? []).forEach((e: any) => {
      const current = expMap.get(e.trip_id) || { total: 0, fines: 0, receipts: 0, count: 0 };
      const isUsd = (e.currency || "").toUpperCase() === "USD";
      const rate = 2600;
      const amtInTzs = isUsd ? (Number(e.amount) || 0) * rate : (Number(e.amount) || 0);
      current.total += amtInTzs;
      current.count += 1;
      if (e.expense_type === "fine") {
        current.fines += amtInTzs;
      } else {
        current.receipts += amtInTzs;
      }
      expMap.set(e.trip_id, current);
    });

    // Also parse expenses from cargo_description JSON metadata if trip_expenses table was not present
    (t ?? []).forEach((tripRaw: any) => {
      if (tripRaw.cargo_description && typeof tripRaw.cargo_description === "string" && tripRaw.cargo_description.trim().startsWith("{")) {
        try {
          const parsed = parseCargoMeta(tripRaw.cargo_description);
          if (parsed && Array.isArray(parsed.expenses) && parsed.expenses.length > 0) {
            const current = expMap.get(tripRaw.id) || { total: 0, fines: 0, receipts: 0, count: 0 };
            if (current.count === 0) {
              const tripRate = Number(parsed.exchange_rate) || 2600;
              parsed.expenses.forEach((e: any) => {
                const isUsd = (e.currency || parsed.currency || "").toUpperCase() === "USD";
                const rawAmt = Number(e.amount ?? e.amountTzs ?? e.amountUsd) || 0;
                const amtInTzs = isUsd ? (Number(e.amountUsd ?? rawAmt) * tripRate) : (Number(e.amountTzs ?? rawAmt));
                current.total += amtInTzs;
                current.count += 1;
                if (e.expense_type === "fine" || e.category === "fine") {
                  current.fines += amtInTzs;
                } else {
                  current.receipts += amtInTzs;
                }
              });
              expMap.set(tripRaw.id, current);
            }
          }
        } catch (_err) {
          // Ignore parse errors on corrupt notes
        }
      }
    });

    setExpenseSummaries(expMap);

    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const machineMap = useMemo(() => new Map(machines.map((m) => [m.id, m])), [machines]);
  const driverMap = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);

  const filtered = useMemo(() => {
    let list = tab === "all" ? trips : trips.filter((t) => t.status === tab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => {
        const vehicle = machineMap.get(t.machine_id);
        const driver = t.driver_id ? driverMap.get(t.driver_id) : null;
        return [
          t.client_name,
          t.client_order_no,
          t.origin,
          t.destination,
          t.purpose,
          t.cargo_description,
          vehicle?.name,
          vehicle?.plate_number,
          vehicle?.trailer_plate,
          driver?.full_name,
        ]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(q));
      });
    }
    return list;
  }, [trips, tab, search, machineMap, driverMap]);

  const vehicleLabel = (machineId: string) => {
    const m = machineMap.get(machineId);
    if (!m) return "—";
    return m.plate_number ? `${m.name} (${m.plate_number})` : m.name;
  };

  const startTrip = async (trip: Trip) => {
    const m = machineMap.get(trip.machine_id);
    const { error } = await supabase
      .from("trips")
      .update({
        status: "in_progress",
        start_at: new Date().toISOString(),
        start_odo: trip.start_odo ?? m?.current_odometer_km ?? null,
      })
      .eq("id", trip.id);
    if (error) return toast.error(error.message);
    toast.success("Trip started");
    load();
  };

  const cancelTrip = async () => {
    if (!confirmCancel) return;
    const { error } = await supabase.from("trips").update({ status: "cancelled" }).eq("id", confirmCancel);
    if (error) return toast.error(error.message);
    toast.success("Trip cancelled");
    setConfirmCancel(null);
    load();
  };

  const deleteTrip = async () => {
    if (!confirmDeleteTrip) return;
    const tripId = confirmDeleteTrip.id;
    try {
      // 1. Delete associated trip_expenses
      await (supabase as any).from("trip_expenses").delete().eq("trip_id", tripId);

      // 2. Delete trip record
      const { error } = await supabase.from("trips").delete().eq("id", tripId);
      if (error) throw error;

      toast.success("Trip permanently deleted");
      if (detailTrip?.id === tripId) setDetailTrip(null);
      if (receiptTrip?.id === tripId) setReceiptTrip(null);
      setConfirmDeleteTrip(null);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete trip");
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{i18n.fleet.tripsTitle}</h1>
          <p className="text-sm text-muted-foreground">{i18n.fleet.tripsSub}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCatalogOpen(true)}
            className="border-primary/30 text-primary hover:bg-primary/5 shadow-xs"
          >
            <Globe2 className="mr-2 h-4 w-4" /> Cross-Border Corridors & Rates
          </Button>
          {canWrite && (
            <Button onClick={() => { setCorridorForNewTrip(null); setNewOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> {i18n.fleet.newTrip}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                tab === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-accent",
              )}
            >
              {TAB_LABELS[t]} {t !== "all" && `(${trips.filter((tr) => tr.status === t).length})`}
            </button>
          ))}
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client, order no, destination, car…"
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Route className="h-5 w-5" />}
          title="No trips found"
          description="Create a trip to start tracking client delivery orders, car destinations, and roundtrip times."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Vehicle & Trailer</th>
                  <th className="px-5 py-3 font-medium">Driver</th>
                  <th className="px-5 py-3 font-medium">Client Order</th>
                  <th className="px-5 py-3 font-medium">Where Car Go (Route)</th>
                  <th className="px-5 py-3 font-medium">Roundtrip Time</th>
                  <th className="px-5 py-3 font-medium">Start Date</th>
                  <th className="px-5 py-3 font-medium">Odometer</th>
                  <th className="px-5 py-3 font-medium">Total Cost</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const m = machineMap.get(t.machine_id);
                  const d = t.driver_id ? driverMap.get(t.driver_id) : null;
                  const rt = calculateRoundtripDisplay(t);
                  const fuelCost = Number(t.cost) || 0;
                  const expCost = expenseSummaries.get(t.id)?.total || 0;
                  const grandTotal = fuelCost + expCost;

                  return (
                    <tr
                      key={t.id}
                      className="border-t border-border hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setDetailTrip(t)}
                    >
                      <td className="px-5 py-3 font-medium" onClick={(e) => e.stopPropagation()}>
                        <div className="font-semibold text-foreground">{vehicleLabel(t.machine_id)}</div>
                        {m?.has_trailer && m.trailer_plate && (
                          <div className="text-[11px] text-primary font-medium">
                            Trailer: {m.trailer_plate}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                        <div className="font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                          <span>{d ? d.full_name : "—"}</span>
                          {d?.driver_code && (
                            <span className="font-mono text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-1 py-0.2 rounded">
                              {d.driver_code}
                            </span>
                          )}
                        </div>
                        {d?.phone && <div className="text-xs">{d.phone}</div>}
                      </td>

                      <td className="px-5 py-3">
                        {t.client_name || t.client_order_no ? (
                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-primary" />
                              <span>{t.client_name || "Client Order"}</span>
                            </div>
                            {t.client_order_no && (
                              <div className="text-xs text-muted-foreground font-mono mt-0.5">
                                Order: {t.client_order_no}
                              </div>
                            )}
                            {t.cargo_description && !t.cargo_description.trim().startsWith("{") && (
                              <div className="text-[11px] text-muted-foreground line-clamp-1 italic">
                                {t.cargo_description}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Internal / Depot</span>
                        )}
                      </td>

                      <td className="px-5 py-3 text-muted-foreground">
                        {t.corridor_name && (
                          <Badge variant="outline" className="mb-1 text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20 flex items-center gap-1 w-fit">
                            <Globe2 className="h-2.5 w-2.5" />
                            {t.corridor_name.split("–")[0]?.trim()}
                          </Badge>
                        )}
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                          <span>{t.origin || "Origin"}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-primary font-bold">{t.destination || "Destination"}</span>
                        </div>
                        {t.purpose && <div className="text-xs text-muted-foreground mt-0.5">{t.purpose}</div>}
                      </td>

                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className={cn("font-semibold text-xs", rt.isDone ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
                            {rt.label}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">{rt.sub}</div>
                      </td>

                      <td className="px-5 py-3 text-muted-foreground text-xs">
                        {t.start_at ? formatDate(t.start_at) : "—"}
                      </td>

                      <td className="px-5 py-3 text-muted-foreground text-xs font-mono">
                        {t.start_odo != null ? formatNumber(t.start_odo) : "—"} → {t.end_odo != null ? formatNumber(t.end_odo) : "—"}
                      </td>

                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        {grandTotal > 0 ? (
                          <div>
                            <span className="font-bold text-foreground text-xs">{formatMoney(grandTotal)}</span>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              ≈ ${(grandTotal / 2600).toFixed(2)} USD
                            </div>
                            {expCost > 0 && (
                              <div className="text-[10px] text-primary">
                                Incl. {formatMoney(expCost)} expenses
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${STATUS_CLASS[t.status]}`}>
                          {t.status.replace("_", " ")}
                        </span>
                      </td>

                      <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="View Full Trip Dossier"
                            onClick={() => setDetailTrip(t)}
                          >
                            <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10 font-semibold"
                            title="Official Client Waybill & Freight Receipt"
                            onClick={() => setReceiptTrip(t)}
                          >
                            <FileText className="h-3.5 w-3.5 text-primary" />
                            <span>Waybill</span>
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 font-semibold"
                            title="Add Fuel Fill-Up for this Trip"
                            onClick={() => setFuelTrip(t)}
                          >
                            <Fuel className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Add Fuel</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            title="Trip Expenses & Fines"
                            onClick={() => setExpensesTrip(t)}
                          >
                            <Receipt className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </Button>

                          {canWrite && t.status === "planned" && (
                            <>
                              <Button variant="ghost" size="icon" title={i18n.fleet.startTrip} onClick={() => startTrip(t)}>
                                <Play className="h-4 w-4 text-emerald-600" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Cancel trip" onClick={() => setConfirmCancel(t.id)}>
                                <Ban className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}

                          {canWrite && t.status === "in_progress" && (
                            <>
                              <Button variant="ghost" size="icon" title="Close trip" onClick={() => setCloseTrip(t)}>
                                <Square className="h-4 w-4 text-amber-600" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Cancel trip" onClick={() => setConfirmCancel(t.id)}>
                                <Ban className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}

                          {canWrite && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete trip permanently"
                              onClick={() => setConfirmDeleteTrip(t)}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NewTripDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        machines={machines}
        drivers={drivers}
        onSaved={handleTripSaved}
        onOpenReceipt={openReceiptById}
        initialCorridor={corridorForNewTrip}
        onOpenCatalog={() => setCatalogOpen(true)}
      />

      <CorridorExpenseCatalogDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        onSelectCorridor={(c) => {
          setCorridorForNewTrip(c);
          setNewOpen(true);
        }}
      />

      <CloseTripDialog
        trip={closeTrip}
        onOpenChange={(v) => !v && setCloseTrip(null)}
        onSaved={load}
        expensesSummary={closeTrip ? expenseSummaries.get(closeTrip.id) : undefined}
      />

      {expensesTrip && (
        <TripExpensesListDialog
          open={!!expensesTrip}
          onOpenChange={(v) => !v && setExpensesTrip(null)}
          tripId={expensesTrip.id}
          machineId={expensesTrip.machine_id}
          machineName={machineMap.get(expensesTrip.machine_id)?.name}
          driverName={driverMap.get(expensesTrip.driver_id ?? "")?.full_name}
          fuelCost={expensesTrip.cost}
          orgId={profile?.organisation_id}
          canManage={canWrite}
          onExpenseChanged={load}
        />
      )}

      {detailTrip && (
        <TripDetailDialog
          trip={detailTrip}
          machine={machineMap.get(detailTrip.machine_id)}
          driver={detailTrip.driver_id ? driverMap.get(detailTrip.driver_id) : undefined}
          expenseSummary={expenseSummaries.get(detailTrip.id)}
          open={!!detailTrip}
          onOpenChange={(v) => !v && setDetailTrip(null)}
          onStart={() => {
            const t = detailTrip;
            setDetailTrip(null);
            startTrip(t);
          }}
          onCloseTrip={() => {
            const t = detailTrip;
            setDetailTrip(null);
            setCloseTrip(t);
          }}
          onOpenReceipt={() => {
            const t = detailTrip;
            setDetailTrip(null);
            setReceiptTrip(t);
          }}
          canManage={canWrite}
          onDelete={() => {
            const t = detailTrip;
            setDetailTrip(null);
            setConfirmDeleteTrip(t);
          }}
        />
      )}

      <TripReceiptDialog
        open={!!receiptTrip}
        onOpenChange={(v) => !v && setReceiptTrip(null)}
        trip={receiptTrip}
        machine={receiptTrip ? machineMap.get(receiptTrip.machine_id) : undefined}
        driver={receiptTrip?.driver_id ? driverMap.get(receiptTrip.driver_id) : undefined}
        org={organisation || (profile as any)?.organisation}
        onPriceUpdated={load}
      />

      {fuelTrip && (
        <QuickFuelDialog
          open={!!fuelTrip}
          onOpenChange={(v) => !v && setFuelTrip(null)}
          machineId={fuelTrip.machine_id}
          onSaved={load}
        />
      )}

      <ConfirmDialog
        open={!!confirmCancel}
        onOpenChange={(v) => !v && setConfirmCancel(null)}
        title="Cancel this trip?"
        description="The trip will be marked as cancelled."
        confirmLabel="Cancel trip"
        onConfirm={async () => { await cancelTrip(); }}
      />

      <ConfirmDialog
        open={!!confirmDeleteTrip}
        onOpenChange={(v) => !v && setConfirmDeleteTrip(null)}
        title="Delete this trip permanently?"
        description={`Are you sure you want to permanently delete this trip (${confirmDeleteTrip?.origin || 'Origin'} → ${confirmDeleteTrip?.destination || 'Destination'}) and all its associated expense records? This action cannot be undone.`}
        confirmLabel="Delete permanently"
        confirmVariant="destructive"
        onConfirm={deleteTrip}
      />
    </div>
  );
}

type NewTripForm = {
  machine_id: string;
  driver_id: string;
  client_name: string;
  client_order_no: string;
  client_billing_amount: string;
  payment_terms: string;
  tax_percent: string;
  purpose: string;
  origin: string;
  destination: string;
  route_notes: string;
  cargo_description: string;
  is_round_trip: boolean;
  roundtrip_hours_est: string;
  start_odo: string;
  start_now: boolean;
};

const EMPTY_NEW_TRIP: NewTripForm = {
  machine_id: "",
  driver_id: "",
  client_name: "",
  client_order_no: "",
  client_billing_amount: "",
  payment_terms: "Upon Delivery & Offloading",
  tax_percent: "0",
  purpose: "",
  origin: "",
  destination: "",
  route_notes: "",
  cargo_description: "",
  is_round_trip: true,
  roundtrip_hours_est: "48",
  start_odo: "",
  start_now: true,
};

interface EditableCorridorExpense {
  id: string;
  title: string;
  category: "toll" | "receipt" | "parking" | "fine" | "fuel" | "repair" | "other";
  amountUsd: number;
  amountTzs: number;
  selected: boolean;
  isRequired: boolean;
  notes?: string;
}

function NewTripDialog({
  open,
  onOpenChange,
  machines,
  drivers,
  onSaved,
  onOpenReceipt,
  initialCorridor,
  onOpenCatalog,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machines: Machine[];
  drivers: Driver[];
  onSaved: (createdTripId?: string) => void;
  onOpenReceipt?: (createdTripId: string) => void;
  initialCorridor?: CrossBorderCorridor | null;
  onOpenCatalog?: () => void;
}) {
  const { profile, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<NewTripForm>(EMPTY_NEW_TRIP);
  const [corridorId, setCorridorId] = useState<string>("custom");
  const [currencyMode, setCurrencyMode] = useState<"USD" | "TZS">("USD");
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_USD_TO_TZS_RATE);
  const [expenseItems, setExpenseItems] = useState<EditableCorridorExpense[]>([]);

  // Initialize or reset form and corridor items
  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_NEW_TRIP);
    setCurrencyMode("USD");
    setExchangeRate(DEFAULT_USD_TO_TZS_RATE);

    if (initialCorridor) {
      applyCorridor(initialCorridor);
    } else {
      setCorridorId("custom");
      setExpenseItems([]);
    }
  }, [open, initialCorridor]);

  const applyCorridor = (c: CrossBorderCorridor) => {
    setCorridorId(c.id);
    setForm((prev) => ({
      ...prev,
      origin: c.defaultOrigin,
      destination: c.defaultDestination,
      roundtrip_hours_est: String(c.estimatedRoundtripHours),
      route_notes: `${c.description} (Primary Border: ${c.borderPost})`,
      purpose: prev.purpose || `Transit Run: ${c.name}`,
    }));

    const mapped: EditableCorridorExpense[] = c.expenses.map((e) => ({
      id: e.id,
      title: e.title,
      category: e.category,
      amountUsd: e.defaultAmountUsd,
      amountTzs: e.defaultAmountTzs || Math.round(e.defaultAmountUsd * exchangeRate),
      selected: true,
      isRequired: e.isRequired,
      notes: e.notes,
    }));
    setExpenseItems(mapped);
  };

  const handleCorridorChange = (newId: string) => {
    setCorridorId(newId);
    if (newId === "custom") {
      setExpenseItems([]);
      return;
    }
    const c = CROSS_BORDER_CORRIDORS.find((x) => x.id === newId);
    if (c) {
      applyCorridor(c);
    }
  };

  const handleRateChange = (newRate: number) => {
    setExchangeRate(newRate);
    setExpenseItems((prev) =>
      prev.map((item) => ({
        ...item,
        amountTzs: Math.round(item.amountUsd * newRate),
      }))
    );
  };

  const toggleExpense = (id: string) => {
    setExpenseItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const selectAllExpenses = () => {
    setExpenseItems((prev) => prev.map((item) => ({ ...item, selected: true })));
  };

  const selectRequiredOnly = () => {
    setExpenseItems((prev) =>
      prev.map((item) => ({ ...item, selected: item.isRequired }))
    );
  };

  const updateExpenseAmount = (id: string, val: number) => {
    setExpenseItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (currencyMode === "USD") {
          return {
            ...item,
            amountUsd: val,
            amountTzs: Math.round(val * exchangeRate),
          };
        } else {
          return {
            ...item,
            amountTzs: val,
            amountUsd: Number((val / exchangeRate).toFixed(2)),
          };
        }
      })
    );
  };

  const addCustomExpenseRow = () => {
    const customId = `custom_${Date.now()}`;
    const defaultUsd = 25;
    setExpenseItems((prev) => [
      ...prev,
      {
        id: customId,
        title: "Additional Road Expense / Stamp",
        category: "receipt",
        amountUsd: defaultUsd,
        amountTzs: Math.round(defaultUsd * exchangeRate),
        selected: true,
        isRequired: false,
        notes: "Custom transit expense added by dispatcher",
      },
    ]);
  };

  const selectedCorridor = CROSS_BORDER_CORRIDORS.find((c) => c.id === corridorId);
  const activeSelectedExpenses = expenseItems.filter((e) => e.selected);
  const totalSelectedUsd = activeSelectedExpenses.reduce((sum, e) => sum + e.amountUsd, 0);
  const totalSelectedTzs = activeSelectedExpenses.reduce((sum, e) => sum + e.amountTzs, 0);

  const onMachineChange = (machineId: string) => {
    const m = machines.find((x) => x.id === machineId);
    setForm({
      ...form,
      machine_id: machineId,
      start_odo: m?.current_odometer_km != null ? String(m.current_odometer_km) : "",
    });
  };

  const selectedMachine = machines.find((m) => m.id === form.machine_id);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!form.machine_id) return toast.error("Please pick a vehicle");
    if (!form.destination.trim()) return toast.error("Please specify destination ('Where car go')");
    setSubmitting(true);

    const now = new Date();
    const estHours = form.roundtrip_hours_est ? Number(form.roundtrip_hours_est) : null;
    let estReturnAt: string | null = null;
    if (estHours && form.start_now) {
      estReturnAt = new Date(now.getTime() + estHours * 3600 * 1000).toISOString();
    }

    const cleanExpensesPayload = activeSelectedExpenses.map((exp) => ({
      id: exp.id,
      title: exp.title,
      category: exp.category,
      amountUsd: exp.amountUsd,
      amountTzs: exp.amountTzs,
      amount: currencyMode === "USD" ? exp.amountUsd : exp.amountTzs,
      currency: currencyMode,
      notes: exp.notes || null,
    }));

    const billingAmountNum = form.client_billing_amount.trim() ? Number(form.client_billing_amount) : null;
    const taxPercentNum = form.tax_percent.trim() ? Number(form.tax_percent) : 0;

    const cargoMeta = {
      client: form.client_name.trim() || null,
      order_no: form.client_order_no.trim() || null,
      client_billing_amount: billingAmountNum,
      billing_currency: currencyMode,
      payment_terms: form.payment_terms.trim() || "Upon Delivery & Offloading",
      tax_percent: taxPercentNum,
      include_statutory_tolls: true,
      est_hours: estHours,
      is_round_trip: form.is_round_trip,
      purpose: form.purpose.trim() || null,
      cargo: form.cargo_description.trim() || null,
      route_notes: form.route_notes.trim() || null,
      estimated_return_at: estReturnAt,
      corridor_id: selectedCorridor?.id || null,
      corridor_name: selectedCorridor?.name || null,
      border_post: selectedCorridor?.borderPost || null,
      currency: currencyMode,
      exchange_rate: exchangeRate,
      expenses: cleanExpensesPayload,
    };

    const safePayload: any = {
      organisation_id: profile.organisation_id,
      machine_id: form.machine_id,
      driver_id: form.driver_id || null,
      purpose:
        form.purpose.trim() ||
        (selectedCorridor ? selectedCorridor.name : null) ||
        (form.client_name.trim() ? `Client: ${form.client_name.trim()}` : null),
      origin: form.origin.trim() || null,
      destination: form.destination.trim() || null,
      cargo_description: JSON.stringify(cargoMeta),
      start_odo: form.start_odo === "" ? null : Number(form.start_odo),
      status: form.start_now ? "in_progress" : "planned",
      start_at: form.start_now ? now.toISOString() : null,
      created_by: user?.id,
      cost: totalSelectedTzs > 0 ? totalSelectedTzs : null,
    };

    const { data: newTrip, error } = await supabase
      .from("trips")
      .insert(safePayload)
      .select("id")
      .single();

    if (error) {
      setSubmitting(false);
      return toast.error(error.message);
    }

    // Insert itemized expenses into public.trip_expenses if any were selected
    if (newTrip?.id && cleanExpensesPayload.length > 0) {
      const expenseInsertRows = cleanExpensesPayload.map((exp) => ({
        trip_id: newTrip.id,
        machine_id: form.machine_id,
        organisation_id: profile.organisation_id,
        driver_id: form.driver_id || null,
        expense_type: exp.category,
        title: exp.title,
        amount: exp.amount,
        currency: currencyMode,
        notes: exp.notes
          ? `${exp.notes}${selectedCorridor ? ` · [${selectedCorridor.name}]` : ""}`
          : selectedCorridor
          ? `[${selectedCorridor.name}]`
          : null,
        occurred_at: now.toISOString(),
        created_by: user?.id ?? null,
      }));

      const { error: expErr } = await (supabase as any)
        .from("trip_expenses")
        .insert(expenseInsertRows);

      if (expErr) {
        console.warn("Direct trip_expenses insert error (safely retained in trip dossier):", expErr);
      }
    }

    // Update vehicle odometer if dispatched now
    if (form.start_now && safePayload.start_odo != null) {
      await supabase
        .from("machines")
        .update({
          current_odometer_km: safePayload.start_odo,
          current_hours: safePayload.start_odo,
        })
        .eq("id", form.machine_id);
    }

    setSubmitting(false);
    toast.success(
      form.start_now
        ? `Trip dispatched with ${cleanExpensesPayload.length} automated corridor expenses!`
        : `Trip scheduled with ${cleanExpensesPayload.length} automated corridor expenses!`,
      {
        action: {
          label: "View Client Receipt",
          onClick: () => {
            if (newTrip?.id) onOpenReceipt?.(newTrip.id);
          },
        },
      }
    );
    onOpenChange(false);
    onSaved(newTrip?.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5 text-primary" />
            Plan New Trip & Cross-Border Freight Order
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Vehicle & Equipment */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Vehicle & Equipment *</Label>
              <SearchableVehicleSelect
                vehicles={machines}
                value={form.machine_id ?? ""}
                onChange={onMachineChange}
                placeholder="Search plate number, vehicle name, trailer, or model..."
              />
              {selectedMachine && selectedMachine.has_trailer && (
                <p className="text-[11px] text-primary font-medium flex items-center gap-1">
                  <Check className="h-3 w-3 text-emerald-600 shrink-0" />
                  <span>
                    Attached Trailer: {selectedMachine.trailer_plate || "Hitched"}
                    {selectedMachine.total_tank_capacity_l
                      ? ` (Total Tank: ${selectedMachine.total_tank_capacity_l} L)`
                      : ""}
                  </span>
                </p>
              )}
            </div>

            {/* Assigned Driver */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Assigned Driver</Label>
              <SearchableDriverSelect
                drivers={drivers}
                value={form.driver_id ?? ""}
                onChange={(v) => setForm({ ...form, driver_id: v })}
                placeholder="Search driver name, DRV code, or phone number..."
              />
            </div>

            {/* Cross-Border Transit Route & Corridor Presets */}
            <div className="space-y-2 sm:col-span-2 rounded-xl border border-primary/25 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Globe2 className="h-4 w-4 text-primary" />
                  Cross-Border Route & Statutory Fee Corridor
                </Label>
                {onOpenCatalog && (
                  <button
                    type="button"
                    onClick={onOpenCatalog}
                    className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
                  >
                    Browse Complete Corridor Catalog
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              <Select value={corridorId} onValueChange={handleCorridorChange}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select corridor to populate route, tolls, & expenses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom / Domestic Route (No template)</SelectItem>
                  {CROSS_BORDER_CORRIDORS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.expenses.length} statutory fees)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedCorridor && (
                <div className="text-[11px] text-muted-foreground flex items-center gap-2 pt-0.5">
                  <span>Border Post: <strong className="text-foreground">{selectedCorridor.borderPost}</strong></span>
                  <span>·</span>
                  <span>Est. Turnaround: <strong className="text-foreground">{formatTurnaroundDuration(selectedCorridor.estimatedRoundtripHours)}</strong></span>
                </div>
              )}
            </div>

            {/* CORRIDOR STATUTORY EXPENSES PANEL */}
            {selectedCorridor && expenseItems.length > 0 && (
              <div className="sm:col-span-2 rounded-2xl border border-primary/30 bg-card p-4 space-y-3 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <span>Corridor Statutory & Transit Expenses</span>
                      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 font-medium">
                        {selectedCorridor.country}
                      </Badge>
                    </h4>
                    <span className="text-[11px] text-muted-foreground">
                      Statutory road tolls, transit permits, border clearance, and driver allowances. Toggle items or adjust fees.
                    </span>
                  </div>

                  {/* Dual Currency Switcher & Rate */}
                  <div className="flex items-center gap-2">
                    <div className="flex rounded-md bg-muted p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setCurrencyMode("USD")}
                        className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                          currencyMode === "USD"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        USD ($)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrencyMode("TZS")}
                        className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                          currencyMode === "TZS"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        TZS (Tsh)
                      </button>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono pl-1 border-l border-border">
                      <span>1 USD =</span>
                      <input
                        type="number"
                        value={exchangeRate}
                        onChange={(e) =>
                          handleRateChange(Number(e.target.value) || DEFAULT_USD_TO_TZS_RATE)
                        }
                        className="w-16 h-7 px-1 text-xs font-mono rounded border border-input bg-background"
                      />
                      <span>TZS</span>
                    </div>
                  </div>
                </div>

                {/* Filter and Add actions */}
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllExpenses}
                      className="text-primary hover:underline font-semibold"
                    >
                      Select All ({expenseItems.length})
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={selectRequiredOnly}
                      className="text-muted-foreground hover:underline"
                    >
                      Required Only ({expenseItems.filter((e) => e.isRequired).length})
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={addCustomExpenseRow}
                    className="text-primary font-semibold hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add Custom Expense Line
                  </button>
                </div>

                {/* Items List */}
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 border border-border rounded-xl p-2 bg-muted/10 divide-y divide-border/40">
                  {expenseItems.map((item) => (
                    <div
                      key={item.id}
                      className={`pt-1.5 first:pt-0 flex items-center justify-between gap-3 text-xs ${
                        item.selected ? "opacity-100" : "opacity-45"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => toggleExpense(item.id)}
                          className="rounded border-input text-primary shrink-0 h-4 w-4"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-foreground truncate">{item.title}</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize">
                              {item.category}
                            </Badge>
                            {item.isRequired && (
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                                Required
                              </span>
                            )}
                          </div>
                          {item.notes && (
                            <p className="text-[10px] text-muted-foreground line-clamp-1">{item.notes}</p>
                          )}
                        </div>
                      </div>

                      {/* Fee input & Conversion display */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {currencyMode === "USD" ? "$" : "TZS"}
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={currencyMode === "USD" ? "0.01" : "100"}
                            value={currencyMode === "USD" ? item.amountUsd : item.amountTzs}
                            onChange={(e) =>
                              updateExpenseAmount(item.id, Number(e.target.value) || 0)
                            }
                            className="w-24 h-7 text-xs font-mono font-semibold text-right px-1.5 rounded border border-input bg-background"
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono w-28 text-right hidden sm:inline-block">
                          {currencyMode === "USD"
                            ? `≈ ${Math.round(item.amountUsd * exchangeRate).toLocaleString()} TZS`
                            : `≈ $${(item.amountTzs / exchangeRate).toFixed(2)} USD`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary Box */}
                <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-foreground">
                      {activeSelectedExpenses.length} of {expenseItems.length} expenses selected
                    </span>
                    <span className="text-muted-foreground block text-[10px]">
                      Will be automatically posted as trip expenses upon dispatch
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-sm text-primary font-mono">
                      ${totalSelectedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </div>
                    <div className="text-[11px] font-semibold text-muted-foreground font-mono">
                      ≈ {Math.round(totalSelectedTzs).toLocaleString()} TZS
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Client Order & Freight Billing Section */}
            <div className="sm:col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" /> Client & Billing (For Receipt & Waybill)
                </h4>
                <Badge variant="outline" className="text-[10px] bg-background">
                  Client Receipt Ready
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Client / Customer Name</Label>
                  <Input
                    value={form.client_name}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                    placeholder="e.g. TotalEnergies / Bakhresa / Puma Energy"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Client Order / DO / Sales Order Number</Label>
                  <Input
                    value={form.client_order_no}
                    onChange={(e) => setForm({ ...form, client_order_no: e.target.value })}
                    placeholder="e.g. DO-9021-TZ / SO-4401"
                    className="h-9 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Cargo / Consignment Specification</Label>
                  <Input
                    value={form.cargo_description}
                    onChange={(e) => setForm({ ...form, cargo_description: e.target.value })}
                    placeholder="e.g. 40,000 Litres Diesel (AGO) / Bulk Wheat Flour"
                    className="h-9 text-sm"
                  />
                </div>

                {/* Freight Price to Pay & Payment Terms */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground">
                      Client Freight Price ({currencyMode})
                    </Label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {form.client_billing_amount && Number(form.client_billing_amount) > 0 ? (
                        currencyMode === "USD"
                          ? `≈ ${Math.round(Number(form.client_billing_amount) * exchangeRate).toLocaleString()} TZS`
                          : `≈ $${(Number(form.client_billing_amount) / exchangeRate).toFixed(2)} USD`
                      ) : null}
                    </span>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      step="any"
                      value={form.client_billing_amount}
                      onChange={(e) => setForm({ ...form, client_billing_amount: e.target.value })}
                      placeholder={currencyMode === "USD" ? "e.g. 2800" : "e.g. 7280000"}
                      className="h-9 text-sm font-mono font-bold pr-14"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-semibold text-muted-foreground pointer-events-none">
                      {currencyMode}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <PaymentTermsInput
                    value={form.payment_terms}
                    onChange={(val) => setForm({ ...form, payment_terms: val })}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Applicable VAT / Tax Rate</span>
                    <span className="font-mono font-semibold">{form.tax_percent}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={form.tax_percent === "0" ? "default" : "outline"}
                      className="h-7 text-xs flex-1"
                      onClick={() => setForm({ ...form, tax_percent: "0" })}
                    >
                      0% (Zero-rated Cross-Border Export)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={form.tax_percent === "18" ? "default" : "outline"}
                      className="h-7 text-xs flex-1"
                      onClick={() => setForm({ ...form, tax_percent: "18" })}
                    >
                      18% Standard VAT
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-background/80 border border-border p-2.5 text-[11px] text-muted-foreground flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>
                  Company branding and payment accounts (CRDB, Stanbic, M-Pesa / Tigo Pesa Lipa Namba) are included on official receipts.
                </span>
              </div>
            </div>

            {/* Route & Destination */}
            <div className="sm:col-span-2 rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Route Transit & Waypoints
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Origin (Start Point) *</Label>
                  <Input
                    value={form.origin}
                    onChange={(e) => setForm({ ...form, origin: e.target.value })}
                    placeholder="e.g. Dar es Salaam Depot / Kurasini"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-primary">Destination (Where Car Go) *</Label>
                  <Input
                    value={form.destination}
                    onChange={(e) => setForm({ ...form, destination: e.target.value })}
                    placeholder="e.g. Lusaka / Ndola via Nakonde"
                    className="h-9 text-sm border-primary/40"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Route Notes & Stopovers</Label>
                  <Input
                    value={form.route_notes}
                    onChange={(e) => setForm({ ...form, route_notes: e.target.value })}
                    placeholder="e.g. Transit via Morogoro, Mbeya, Tunduma; Offload at Lusaka client depot"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Roundtrip Time in Days & Hours */}
            <div className="space-y-1.5 sm:col-span-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Estimated Turnaround Duration</Label>
                <Badge variant="outline" className="text-[10px] font-mono text-primary bg-primary/5 py-0 px-1.5">
                  {formatTurnaroundDuration(Number(form.roundtrip_hours_est) || 0)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      value={hoursToDaysAndHours(Number(form.roundtrip_hours_est) || 0).days}
                      onChange={(e) => {
                        const newDays = Math.max(0, parseInt(e.target.value) || 0);
                        const currentHours = hoursToDaysAndHours(Number(form.roundtrip_hours_est) || 0).hours;
                        setForm({ ...form, roundtrip_hours_est: String(newDays * 24 + currentHours) });
                      }}
                      className="pr-12 text-center"
                      placeholder="0"
                    />
                    <span className="absolute right-2.5 top-2.5 text-xs text-muted-foreground font-medium pointer-events-none">
                      Days
                    </span>
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={hoursToDaysAndHours(Number(form.roundtrip_hours_est) || 0).hours}
                      onChange={(e) => {
                        const newHours = Math.max(0, parseInt(e.target.value) || 0);
                        const currentDays = hoursToDaysAndHours(Number(form.roundtrip_hours_est) || 0).days;
                        setForm({ ...form, roundtrip_hours_est: String(currentDays * 24 + newHours) });
                      }}
                      className="pr-12 text-center"
                      placeholder="0"
                    />
                    <span className="absolute right-2.5 top-2.5 text-xs text-muted-foreground font-medium pointer-events-none">
                      Hours
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                {[
                  { label: "1 Day", hours: 24 },
                  { label: "2 Days", hours: 48 },
                  { label: "4 Days", hours: 96 },
                  { label: "6 Days", hours: 144 },
                  { label: "9 Days", hours: 216 },
                ].map((p) => (
                  <button
                    key={p.hours}
                    type="button"
                    onClick={() => setForm({ ...form, roundtrip_hours_est: String(p.hours) })}
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border transition-colors",
                      Number(form.roundtrip_hours_est) === p.hours
                        ? "bg-primary/10 border-primary text-primary font-bold"
                        : "bg-muted/40 border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Start odometer (km)</Label>
              <Input
                type="number"
                min={0}
                value={form.start_odo}
                onChange={(e) => setForm({ ...form, start_odo: e.target.value })}
                placeholder="Current vehicle km"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Trip Purpose / Notes</Label>
              <Input
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                placeholder="e.g. Cross-border transit delivery"
              />
            </div>

            <div className="sm:col-span-2 flex items-center justify-between pt-1 border-t border-border">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_round_trip}
                  onChange={(e) => setForm({ ...form, is_round_trip: e.target.checked })}
                  className="rounded border-input text-primary"
                />
                <span className="font-medium">Roundtrip (Car returns to base depot)</span>
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.start_now}
                  onChange={(e) => setForm({ ...form, start_now: e.target.checked })}
                  className="rounded border-input text-primary"
                />
                <span className="font-semibold text-primary">Start & Dispatch now</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {form.start_now ? "Start & Dispatch Trip" : "Save Planned Trip"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type CloseTripForm = { end_odo: string | number; fuel_used_l: string; cost: string };

function CloseTripDialog({ trip, onOpenChange, onSaved, expensesSummary }: {
  trip: Trip | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  expensesSummary?: ExpenseSummary;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CloseTripForm>({ end_odo: "", fuel_used_l: "", cost: "" });

  useEffect(() => {
    if (trip) {
      setForm({ end_odo: trip.start_odo ?? "", fuel_used_l: "", cost: "" });
    }
  }, [trip]);

  if (!trip) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endOdo = form.end_odo === "" ? null : Number(form.end_odo);
    if (endOdo == null) return toast.error("Enter closing odometer reading");
    if (trip.start_odo != null && endOdo < trip.start_odo) return toast.error("End odometer must be at or greater than start reading");

    setSubmitting(true);
    const fuelUsed = form.fuel_used_l === "" ? null : Number(form.fuel_used_l);
    const cost = form.cost === "" ? null : Number(form.cost);

    let fuelLogId: string | null = null;
    if (fuelUsed && fuelUsed > 0) {
      const { data: fl, error: flErr } = await supabase
        .from("fuel_logs")
        .insert({
          machine_id: trip.machine_id,
          recorded_at: new Date().toISOString().slice(0, 10),
          odometer: endOdo,
          fuel_litres: fuelUsed,
          fuel_cost: cost ?? 0,
          notes: `Auto-logged from trip (${trip.origin || "Origin"} → ${trip.destination || "Destination"})`,
        })
        .select("id")
        .single();
      if (flErr) {
        setSubmitting(false);
        return toast.error(`Failed to log fuel: ${flErr.message}`);
      }
      fuelLogId = fl.id;
    }

    const { error } = await supabase
      .from("trips")
      .update({
        status: "completed",
        end_at: new Date().toISOString(),
        end_odo: endOdo,
        fuel_used_l: fuelUsed,
        cost,
        fuel_log_id: fuelLogId,
      })
      .eq("id", trip.id);

    if (error) {
      setSubmitting(false);
      return toast.error(error.message);
    }

    await supabase.from("machines").update({ current_odometer_km: endOdo }).eq("id", trip.machine_id);

    setSubmitting(false);
    toast.success(fuelLogId ? "Trip closed and fuel logged" : "Trip successfully completed");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={!!trip} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Complete & Close Trip</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>End odometer (km) *</Label>
              <Input type="number" min={trip.start_odo ?? 0} value={form.end_odo ?? ""} onChange={(e) => setForm({ ...form, end_odo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Fuel used (litres)</Label>
              <Input type="number" min={0} step="0.01" value={form.fuel_used_l ?? ""} onChange={(e) => setForm({ ...form, fuel_used_l: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Fuel cost (TZS)</Label>
              <Input type="number" min={0} step="0.01" value={form.cost ?? ""} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            If fuel used is greater than 0, an automated fuel log is generated for the vehicle.
          </p>

          {/* Driver Cost Calculation Breakdown */}
          <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Fuel cost:</span>
              <span className="font-medium text-foreground">{formatMoney(Number(form.cost) || 0)}</span>
            </div>
            {expensesSummary && expensesSummary.total > 0 ? (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Receipt className="h-3 w-3 text-blue-500" /> Receipts & other:
                  </span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {formatMoney(expensesSummary.receipts)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <AlertOctagon className="h-3 w-3 text-rose-500" /> Traffic fines:
                  </span>
                  <span className="font-medium text-rose-600 dark:text-rose-400">
                    {formatMoney(expensesSummary.fines)}
                  </span>
                </div>
              </>
            ) : null}
            <div className="flex justify-between border-t border-border pt-1.5 font-semibold text-sm">
              <span className="text-foreground">Total Driver Cost Used:</span>
              <span className="text-primary font-bold">
                {formatMoney((Number(form.cost) || 0) + (expensesSummary?.total || 0))}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Close trip
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TripDetailDialog({
  trip,
  machine,
  driver,
  expenseSummary,
  open,
  onOpenChange,
  onStart,
  onCloseTrip,
  onOpenReceipt,
  canManage,
  onDelete,
}: {
  trip: Trip;
  machine?: Machine;
  driver?: Driver;
  expenseSummary?: ExpenseSummary;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStart: () => void;
  onCloseTrip: () => void;
  onOpenReceipt?: () => void;
  canManage?: boolean;
  onDelete?: () => void;
}) {
  const rt = calculateRoundtripDisplay(trip);
  const totalCost = (Number(trip.cost) || 0) + (expenseSummary?.total || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Route className="h-5 w-5 text-primary" /> Trip Dossier
            </DialogTitle>
            <span className={`rounded-md px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_CLASS[trip.status]}`}>
              {trip.status.replace("_", " ")}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Cross-Border Corridor Banner (if present) */}
          {trip.corridor_name && (
            <div className="rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-background p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-primary" />
                  <span className="font-bold text-sm text-foreground">{trip.corridor_name}</span>
                </div>
                {trip.border_post && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 text-rose-500" />
                    <span>Border Post: <strong className="text-foreground">{trip.border_post}</strong></span>
                    {trip.exchange_rate && (
                      <>
                        <span>·</span>
                        <span>Rate: 1 USD = <strong>{trip.exchange_rate} TZS</strong></span>
                      </>
                    )}
                  </div>
                )}
              </div>
              {trip.expenses && trip.expenses.length > 0 && (
                <Badge className="bg-primary text-primary-foreground text-xs px-2.5 py-1">
                  {trip.expenses.length} Corridor Fees Pre-loaded
                </Badge>
              )}
            </div>
          )}

          {/* Route & Destination (Where Car Go) Banner */}
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border">
              <span className="font-semibold uppercase tracking-wider text-primary">Where Car Go (Route & Turnaround)</span>
              <span>{trip.is_round_trip !== false ? "Roundtrip Run" : "One-Way"}</span>
            </div>
            <div className="flex items-center gap-2 mt-3 text-base font-bold text-foreground">
              <MapPin className="h-5 w-5 text-rose-500 shrink-0" />
              <span>{trip.origin || "Origin Depot"}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-primary">{trip.destination || "Destination Client"}</span>
            </div>
            {trip.route_notes && (
              <p className="text-xs text-muted-foreground mt-2 bg-background p-2 rounded border border-border">
                {trip.route_notes}
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-border text-xs">
              <div>
                <span className="text-muted-foreground block">Roundtrip Turnaround:</span>
                <span className="font-bold text-foreground text-sm flex items-center gap-1 mt-0.5">
                  <Clock className="h-3.5 w-3.5 text-primary" /> {rt.label}
                </span>
                <span className="text-[10px] text-muted-foreground">{rt.sub}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Departure Time:</span>
                <span className="font-medium text-foreground">
                  {trip.start_at ? formatDate(trip.start_at) : "Pending start"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Closing / Return Time:</span>
                <span className="font-medium text-foreground">
                  {trip.end_at ? formatDate(trip.end_at) : (trip.estimated_return_at ? `Est: ${formatDate(trip.estimated_return_at)}` : "In progress")}
                </span>
              </div>
            </div>
          </div>

          {/* Client Order Card */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Building2 className="h-4 w-4" /> Client Order & Billing
              </div>
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs font-semibold px-2.5"
                onClick={() => {
                  onOpenChange(false);
                  onOpenReceipt?.();
                }}
              >
                <FileText className="h-3.5 w-3.5" /> Official Waybill & Invoice
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Client / Customer:</span>
                <span className="font-bold text-foreground">{trip.client_name || "Internal Operational Movement"}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Order / DO Reference:</span>
                <span className="font-mono font-semibold text-foreground">{trip.client_order_no || "—"}</span>
              </div>
              {trip.cargo_description && !trip.cargo_description.trim().startsWith("{") && (
                <div className="sm:col-span-2">
                  <span className="text-xs text-muted-foreground block">Cargo Description:</span>
                  <span className="text-foreground">{trip.cargo_description}</span>
                </div>
              )}
              {trip.client_billing_amount != null && trip.client_billing_amount > 0 && (
                <div className="sm:col-span-2 rounded-lg bg-background p-2.5 border border-primary/20 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase font-semibold">Agreed Freight Price</span>
                    <span className="font-black text-sm text-primary font-mono">
                      {trip.billing_currency === "USD"
                        ? `$${trip.client_billing_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                        : `${Math.round(trip.client_billing_amount).toLocaleString()} TZS`}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-2 font-mono">
                      {trip.billing_currency === "USD"
                        ? `(≈ ${Math.round(trip.client_billing_amount * (trip.exchange_rate || 2600)).toLocaleString()} TZS)`
                        : `(≈ $${(trip.client_billing_amount / (trip.exchange_rate || 2600)).toFixed(2)} USD)`}
                    </span>
                  </div>
                  {trip.payment_terms && (
                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground block uppercase font-semibold">Terms</span>
                      <span className="text-xs font-medium text-foreground">{trip.payment_terms}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Vehicle & Trailer Card */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-primary" /> Vehicle & Equipment
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Vehicle Head:</span>
                <span className="font-bold text-foreground">{machine?.name || "—"} ({machine?.plate_number || "—"})</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Attached Trailer:</span>
                {machine?.has_trailer && machine.trailer_plate ? (
                  <span className="font-semibold text-primary">{machine.trailer_plate} ({machine.trailer_make_model || "Trailer unit"})</span>
                ) : (
                  <span className="text-muted-foreground">No trailer hitched</span>
                )}
              </div>
              {machine?.total_tank_capacity_l ? (
                <div className="sm:col-span-2 text-xs text-muted-foreground">
                  Tank Capacity: <strong className="text-foreground">{formatNumber(machine.total_tank_capacity_l)} L Total</strong>
                  {machine.head_tank_capacity_l ? ` (Head: ${formatNumber(machine.head_tank_capacity_l)}L` : ""}
                  {machine.trailer_tank_capacity_l ? ` · Trailer: ${formatNumber(machine.trailer_tank_capacity_l)}L)` : ")"}
                </div>
              ) : null}
            </div>
          </div>

          {/* Driver & Emergency Contact Card */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="h-4 w-4 text-primary" /> Driver & Safety Contact
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Driver Name:</span>
                <span className="font-bold text-foreground">{driver?.full_name || "Not assigned"}</span>
                {driver?.phone && (
                  <a href={`tel:${driver.phone}`} className="text-xs text-primary font-medium flex items-center gap-1 mt-0.5 hover:underline">
                    <Phone className="h-3 w-3" /> {driver.phone}
                  </a>
                )}
              </div>

              {driver?.next_of_kin_name && (
                <div className="rounded-lg bg-rose-500/10 p-2.5 border border-rose-500/20 text-xs">
                  <span className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                    <HeartHandshake className="h-3.5 w-3.5" /> Next of Kin Emergency:
                  </span>
                  <div className="font-bold text-foreground mt-0.5">{driver.next_of_kin_name}</div>
                  {driver.next_of_kin_phone && (
                    <a href={`tel:${driver.next_of_kin_phone}`} className="text-primary font-medium hover:underline flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" /> {driver.next_of_kin_phone}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Financials & Fuel Card */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2 text-xs">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-primary" /> Mileage & Operational Expenses
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div>
                <span className="text-muted-foreground block">Distance:</span>
                <span className="font-bold text-foreground text-sm">
                  {trip.start_odo != null && trip.end_odo != null ? `${formatNumber(trip.end_odo - trip.start_odo)} km` : "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Fuel Litres:</span>
                <span className="font-bold text-foreground text-sm">
                  {trip.fuel_used_l != null ? `${formatNumber(trip.fuel_used_l)} L` : "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Fuel Cost:</span>
                <span className="font-bold text-foreground text-sm">
                  {trip.cost != null ? formatMoney(trip.cost) : "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Total Trip Cost:</span>
                <span className="font-bold text-primary text-sm">
                  {totalCost > 0 ? formatMoney(totalCost) : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Statutory Corridor Expense Breakdown (if present) */}
          {trip.expenses && trip.expenses.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs pb-1 border-b border-border">
                <span className="font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-primary" /> Statutory Corridor Fees ({trip.expenses.length})
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  Standard Pre-loaded Transit Costs
                </span>
              </div>
              <div className="max-h-52 overflow-y-auto space-y-1.5 divide-y divide-border/40 pr-1 text-xs">
                {trip.expenses.map((e: any, idx: number) => {
                  const isUsd = (e.currency || trip.currency || "").toUpperCase() === "USD";
                  const amt = Number(e.amount ?? e.amountUsd ?? e.amountTzs) || 0;
                  const rate = trip.exchange_rate || 2600;
                  return (
                    <div key={e.id || idx} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-foreground">{e.title}</span>
                          {e.category && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize">
                              {e.category}
                            </Badge>
                          )}
                        </div>
                        {e.notes && (
                          <div className="text-[10px] text-muted-foreground line-clamp-1">{e.notes}</div>
                        )}
                      </div>
                      <div className="text-right font-mono shrink-0">
                        <span className="font-bold text-foreground">
                          {isUsd ? `$${amt.toFixed(2)} USD` : `${Math.round(amt).toLocaleString()} TZS`}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-1.5 hidden sm:inline">
                          ({isUsd ? `≈ ${Math.round(amt * rate).toLocaleString()} TZS` : `≈ $${(amt / rate).toFixed(2)} USD`})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {trip.status === "planned" && (
              <Button onClick={onStart} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Play className="h-3.5 w-3.5" /> Start Trip
              </Button>
            )}
            {trip.status === "in_progress" && (
              <Button onClick={onCloseTrip} size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
                <Square className="h-3.5 w-3.5" /> Close & Complete Trip
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onOpenReceipt?.();
              }}
              className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            >
              <FileText className="h-4 w-4" /> Client Receipt
            </Button>
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onDelete?.();
                }}
                className="gap-1.5 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" /> Delete Trip
              </Button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
