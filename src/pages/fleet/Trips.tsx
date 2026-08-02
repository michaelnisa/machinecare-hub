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
import { Route, Plus, Play, Square, Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatNumber, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";

type Machine = { id: string; name: string; plate_number: string | null; current_odometer_km: number | null };
type Driver = { id: string; full_name: string };

type Trip = {
  id: string;
  machine_id: string;
  driver_id: string | null;
  purpose: string | null;
  origin: string | null;
  destination: string | null;
  cargo_description: string | null;
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

export default function Trips() {
  const { profile } = useAuth();
  const { canWrite } = useUserRole();
  const { t: i18n } = useI18n();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  const [newOpen, setNewOpen] = useState(false);
  const [closeTrip, setCloseTrip] = useState<Trip | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: t, error: tErr }, { data: m }, { data: d }] = await Promise.all([
      supabase.from("trips").select("*").order("created_at", { ascending: false }),
      supabase.from("machines").select("id, name, plate_number, current_odometer_km").order("name"),
      supabase.from("drivers").select("id, full_name").eq("status", "active").order("full_name"),
    ]);
    if (tErr) toast.error(tErr.message);
    setTrips((t ?? []) as Trip[]);
    setMachines((m ?? []) as Machine[]);
    setDrivers((d ?? []) as Driver[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const machineMap = useMemo(() => new Map(machines.map((m) => [m.id, m])), [machines]);
  const driverMap = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);

  const filtered = useMemo(
    () => (tab === "all" ? trips : trips.filter((t) => t.status === tab)),
    [trips, tab],
  );

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

      {filtered.length === 0 ? (
        <EmptyState icon={<Route className="h-5 w-5" />} title="No trips" description="Create a trip to start tracking vehicle movements and fuel use." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Vehicle</th>
                  <th className="px-5 py-3 font-medium">Driver</th>
                  <th className="px-5 py-3 font-medium">Route</th>
                  <th className="px-5 py-3 font-medium">Start</th>
                  <th className="px-5 py-3 font-medium">Odo (start → end)</th>
                  <th className="px-5 py-3 font-medium">Fuel / Cost</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-5 py-3 font-medium">{vehicleLabel(t.machine_id)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{t.driver_id ? driverMap.get(t.driver_id)?.full_name ?? "—" : "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <div>{t.origin ?? "—"} → {t.destination ?? "—"}</div>
                      {t.purpose && <div className="text-xs">{t.purpose}</div>}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{t.start_at ? formatDate(t.start_at) : "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {t.start_odo != null ? formatNumber(t.start_odo) : "—"} → {t.end_odo != null ? formatNumber(t.end_odo) : "—"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {t.fuel_used_l != null ? `${formatNumber(t.fuel_used_l)} L` : "—"} {t.cost != null ? `· ${formatMoney(t.cost)}` : ""}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${STATUS_CLASS[t.status]}`}>
                        {t.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {canWrite && t.status === "planned" && (
                        <>
                          <Button variant="ghost" size="icon" title={i18n.fleet.startTrip} onClick={() => startTrip(t)}>
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Cancel trip" onClick={() => setConfirmCancel(t.id)}>
                            <Ban className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {canWrite && t.status === "in_progress" && (
                        <>
                          <Button variant="ghost" size="icon" title="Close trip" onClick={() => setCloseTrip(t)}>
                            <Square className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Cancel trip" onClick={() => setConfirmCancel(t.id)}>
                            <Ban className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NewTripDialog open={newOpen} onOpenChange={setNewOpen} machines={machines} drivers={drivers} onSaved={load} />
      <CloseTripDialog trip={closeTrip} onOpenChange={(v) => !v && setCloseTrip(null)} onSaved={load} />
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
  purpose: string;
  origin: string;
  destination: string;
  cargo_description: string;
  start_odo: string;
  start_now: boolean;
};

const EMPTY_NEW_TRIP: NewTripForm = {
  machine_id: "",
  driver_id: "",
  purpose: "",
  origin: "",
  destination: "",
  cargo_description: "",
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!form.machine_id) return toast.error("Pick a vehicle");
    setSubmitting(true);
    const payload = {
      organisation_id: profile.organisation_id,
      machine_id: form.machine_id,
      driver_id: form.driver_id || null,
      purpose: form.purpose || null,
      origin: form.origin || null,
      destination: form.destination || null,
      cargo_description: form.cargo_description || null,
      start_odo: form.start_odo === "" ? null : Number(form.start_odo),
      status: form.start_now ? "in_progress" : "planned",
      start_at: form.start_now ? new Date().toISOString() : null,
      created_by: user?.id,
    };
    const { error } = await supabase.from("trips").insert(payload);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(form.start_now ? "Trip started" : "Trip planned");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>New trip</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Vehicle *</Label>
              <Select value={form.machine_id ?? ""} onValueChange={onMachineChange}>
                <SelectTrigger><SelectValue placeholder="Pick a vehicle" /></SelectTrigger>
                <SelectContent>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.plate_number ? `${m.name} (${m.plate_number})` : m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Driver</Label>
              <Select value={form.driver_id ?? ""} onValueChange={(v) => setForm({ ...form, driver_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pick a driver" /></SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Origin</Label>
              <Input value={form.origin ?? ""} onChange={(e) => setForm({ ...form, origin: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Destination</Label>
              <Input value={form.destination ?? ""} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Purpose</Label>
              <Input value={form.purpose ?? ""} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="e.g. Delivery to client, depot run" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Cargo description</Label>
              <Input value={form.cargo_description ?? ""} onChange={(e) => setForm({ ...form, cargo_description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Start odometer (km)</Label>
              <Input type="number" min={0} value={form.start_odo ?? ""} onChange={(e) => setForm({ ...form, start_odo: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 self-end pb-1.5 text-sm">
              <input type="checkbox" checked={!!form.start_now} onChange={(e) => setForm({ ...form, start_now: e.target.checked })} />
              Start now
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {form.start_now ? "Start trip" : "Save planned trip"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type CloseTripForm = { end_odo: string | number; fuel_used_l: string; cost: string };

function CloseTripDialog({ trip, onOpenChange, onSaved }: {
  trip: Trip | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
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
    if (endOdo == null) return toast.error("Enter the closing odometer reading");
    if (trip.start_odo != null && endOdo < trip.start_odo) return toast.error("End odometer must be at or after the start reading");

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
          notes: `Auto-logged from trip${trip.origin ? ` (${trip.origin} → ${trip.destination ?? ""})` : ""}`,
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
    toast.success(fuelLogId ? "Trip closed and fuel logged" : "Trip closed");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={!!trip} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Close trip</DialogTitle></DialogHeader>
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
            If fuel used is greater than 0, a fuel log is created automatically for this vehicle.
          </p>
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
