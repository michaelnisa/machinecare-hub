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
} from "lucide-react";
import { TripExpensesListDialog } from "@/components/TripExpensesListDialog";
import { toast } from "sonner";
import { formatDate, formatNumber, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import {
  SAFE_MACHINE_COLUMNS,
  SAFE_DRIVER_COLUMNS,
  parseMachine,
  parseDriver,
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

  if (raw.cargo_description && typeof raw.cargo_description === "string" && raw.cargo_description.startsWith("{") && raw.cargo_description.endsWith("}")) {
    try {
      const parsed = JSON.parse(raw.cargo_description);
      if (parsed.client) client_name = parsed.client;
      if (parsed.order_no) client_order_no = parsed.order_no;
      if (parsed.est_hours != null) roundtrip_hours_est = Number(parsed.est_hours);
      if (parsed.is_round_trip != null) is_round_trip = Boolean(parsed.is_round_trip);
      if (parsed.purpose) purpose = parsed.purpose;
      if (parsed.cargo) cargo_description = parsed.cargo;
      if (parsed.route_notes) route_notes = parsed.route_notes;
      if (parsed.estimated_return_at) estimated_return_at = parsed.estimated_return_at;
    } catch {}
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
        sub: t.roundtrip_hours_est ? `Est. RT: ${t.roundtrip_hours_est}h` : "In transit",
        isDone: false,
      };
    }
  }

  if (t.roundtrip_hours_est) {
    return {
      label: `${t.roundtrip_hours_est} hrs`,
      sub: t.is_round_trip !== false ? "Estimated roundtrip" : "Est. one-way",
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
  const { profile } = useAuth();
  const { canWrite } = useUserRole();
  const { t: i18n } = useI18n();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [closeTrip, setCloseTrip] = useState<Trip | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [expenseSummaries, setExpenseSummaries] = useState<Map<string, ExpenseSummary>>(new Map());
  const [expensesTrip, setExpensesTrip] = useState<Trip | null>(null);
  const [detailTrip, setDetailTrip] = useState<Trip | null>(null);

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
      (supabase as any).from("trip_expenses").select("id, trip_id, expense_type, amount"),
    ]);

    if (tErr) toast.error(tErr.message);
    setTrips((t ?? []).map(parseTripRecord));
    setMachines((m ?? []).map(parseMachine));
    setDrivers((d ?? []).map(parseDriver));

    const expMap = new Map<string, ExpenseSummary>();
    (exp ?? []).forEach((e: any) => {
      const current = expMap.get(e.trip_id) || { total: 0, fines: 0, receipts: 0, count: 0 };
      const amt = Number(e.amount) || 0;
      current.total += amt;
      current.count += 1;
      if (e.expense_type === "fine") {
        current.fines += amt;
      } else {
        current.receipts += amt;
      }
      expMap.set(e.trip_id, current);
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

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{i18n.fleet.tripsTitle}</h1>
          <p className="text-sm text-muted-foreground">{i18n.fleet.tripsSub}</p>
        </div>
        {canWrite && (
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> {i18n.fleet.newTrip}
          </Button>
        )}
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
                            {t.cargo_description && (
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
                            {expCost > 0 && (
                              <div className="text-[10px] text-muted-foreground">
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

      <NewTripDialog open={newOpen} onOpenChange={setNewOpen} machines={machines} drivers={drivers} onSaved={load} />

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
    </div>
  );
}

type NewTripForm = {
  machine_id: string;
  driver_id: string;
  client_name: string;
  client_order_no: string;
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

function NewTripDialog({ open, onOpenChange, machines, drivers, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machines: Machine[];
  drivers: Driver[];
  onSaved: () => void;
}) {
  const { profile, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<NewTripForm>(EMPTY_NEW_TRIP);

  useEffect(() => {
    if (open) setForm(EMPTY_NEW_TRIP);
  }, [open]);

  const onMachineChange = (machineId: string) => {
    const m = machines.find((x) => x.id === machineId);
    setForm({ ...form, machine_id: machineId, start_odo: m?.current_odometer_km != null ? String(m.current_odometer_km) : "" });
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

    const cargoMeta = {
      client: form.client_name.trim() || null,
      order_no: form.client_order_no.trim() || null,
      est_hours: estHours,
      is_round_trip: form.is_round_trip,
      purpose: form.purpose.trim() || null,
      cargo: form.cargo_description.trim() || null,
      route_notes: form.route_notes.trim() || null,
      estimated_return_at: estReturnAt,
    };

    // Use confirmed schema columns for public.trips; extended client order and route metadata
    // are stored safely in cargo_description JSON matching parseTripRecord and serializeTripPayload.
    const safePayload = {
      organisation_id: profile.organisation_id,
      machine_id: form.machine_id,
      driver_id: form.driver_id || null,
      purpose: form.purpose.trim() || (form.client_name.trim() ? `Client: ${form.client_name.trim()}` : null),
      origin: form.origin.trim() || null,
      destination: form.destination.trim() || null,
      cargo_description: JSON.stringify(cargoMeta),
      start_odo: form.start_odo === "" ? null : Number(form.start_odo),
      status: form.start_now ? "in_progress" : "planned",
      start_at: form.start_now ? now.toISOString() : null,
      created_by: user?.id,
    };

    const { error } = await supabase.from("trips").insert(safePayload);

    if (!error && form.start_now && safePayload.start_odo != null) {
      await supabase
        .from("machines")
        .update({ current_odometer_km: safePayload.start_odo, current_hours: safePayload.start_odo })
        .eq("id", form.machine_id);
    }

    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(form.start_now ? "Trip dispatched and active" : "Trip scheduled successfully");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Plan New Trip & Client Order</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Vehicle & Equipment *</Label>
              <Select value={form.machine_id ?? ""} onValueChange={onMachineChange}>
                <SelectTrigger><SelectValue placeholder="Select vehicle for trip" /></SelectTrigger>
                <SelectContent>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.plate_number ? `${m.name} (${m.plate_number})` : m.name}
                      {m.has_trailer && m.trailer_plate ? ` + Trailer [${m.trailer_plate}]` : ""}
                      {m.total_tank_capacity_l ? ` · Tank: ${m.total_tank_capacity_l}L` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedMachine && selectedMachine.has_trailer && (
                <p className="text-[11px] text-primary font-medium">
                  ✓ Attached Trailer: {selectedMachine.trailer_plate || "Hitched"}
                  {selectedMachine.total_tank_capacity_l ? ` (Total Tank: ${selectedMachine.total_tank_capacity_l} L)` : ""}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Assigned Driver</Label>
              <Select value={form.driver_id ?? ""} onValueChange={(v) => setForm({ ...form, driver_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pick an active licensed driver" /></SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.driver_code ? `[${d.driver_code}] ` : ""}{d.full_name} {d.phone ? `(${d.phone})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Client Order Information Section */}
            <div className="sm:col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Client & Order Information
              </h4>
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
              </div>
            </div>

            {/* Where Car Go (Route & Destination) */}
            <div className="sm:col-span-2 rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4 text-rose-500" /> Route: Where Car Go
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
                    placeholder="e.g. Mwanza Fuel Depot / Client Site"
                    className="h-9 text-sm border-primary/40"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Route Notes & Stopovers</Label>
                  <Input
                    value={form.route_notes}
                    onChange={(e) => setForm({ ...form, route_notes: e.target.value })}
                    placeholder="e.g. Transit via Morogoro, Dodoma; Offload at client tank 4"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Roundtrip Time & Odometer */}
            <div className="space-y-1.5">
              <Label>Estimated Roundtrip Time (Hours)</Label>
              <Input
                type="number"
                min={1}
                value={form.roundtrip_hours_est}
                onChange={(e) => setForm({ ...form, roundtrip_hours_est: e.target.value })}
                placeholder="e.g. 48 hours (2 days)"
              />
              <span className="text-[10px] text-muted-foreground">Expected total return turnaround</span>
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
                placeholder="e.g. Cross-country bulk delivery"
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
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
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
}: {
  trip: Trip;
  machine?: Machine;
  driver?: Driver;
  expenseSummary?: ExpenseSummary;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStart: () => void;
  onCloseTrip: () => void;
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
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Building2 className="h-4 w-4" /> Client Order Information
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
              {trip.cargo_description && (
                <div className="sm:col-span-2">
                  <span className="text-xs text-muted-foreground block">Cargo Description:</span>
                  <span className="text-foreground">{trip.cargo_description}</span>
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
        </div>

        <DialogFooter className="flex sm:justify-between items-center gap-2">
          <div>
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
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
