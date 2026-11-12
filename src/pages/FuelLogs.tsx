import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Fuel, Plus, Trash2, Loader2, Truck, Calendar, MapPin, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";

export default function FuelLogs() {
  const { profile, user } = useAuth();
  const { isManager } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string; plate_number?: string | null }[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [machineFilter, setMachineFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: l }, { data: m }, { data: t }] = await Promise.all([
      supabase.from("fuel_logs").select("*, machines(name, plate_number)").order("recorded_at", { ascending: false }).limit(500),
      supabase.from("machines").select("id, name, plate_number").order("name"),
      supabase.from("trips").select("id, machine_id, origin, destination, status, client_name, client_order_no, cargo_description, created_at").order("created_at", { ascending: false }).limit(200),
    ]);
    setLogs(l ?? []);
    setMachines(m ?? []);
    setTrips(t ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (profile) load();
  }, [profile]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (machineFilter !== "all" && l.machine_id !== machineFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const mName = (l.machines?.name || "").toLowerCase();
        const mPlate = (l.machines?.plate_number || "").toLowerCase();
        const notes = (l.notes || "").toLowerCase();
        const station = (l.station || "").toLowerCase();
        if (!mName.includes(q) && !mPlate.includes(q) && !notes.includes(q) && !station.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [logs, machineFilter, search]);

  const chartData = useMemo(() => {
    return [...filtered]
      .reverse()
      .filter((l) => l.fuel_litres)
      .slice(-30)
      .map((l) => ({
        date: format(parseISO(l.recorded_at), "d MMM"),
        litres: Number(l.fuel_litres),
        cost: Number(l.fuel_cost ?? 0),
      }));
  }, [filtered]);

  const totals = useMemo(() => {
    let litres = 0, cost = 0;
    filtered.forEach((l) => {
      litres += Number(l.fuel_litres ?? 0);
      cost += Number(l.fuel_cost ?? 0);
    });
    return { litres, cost };
  }, [filtered]);

  const handleDelete = async () => {
    if (!confirm) return;
    const { error } = await supabase.from("fuel_logs").delete().eq("id", confirm);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setConfirm(null);
    load();
  };

  const parseTripFromNotes = (notes: string | null) => {
    if (!notes) return null;
    const match = notes.match(/\[Trip:\s*([^\]]+)\]/);
    return match ? match[1] : null;
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Fuel className="h-6 w-6 text-primary" />
            Fuel & Odometers
          </h1>
          <p className="text-sm text-muted-foreground">
            Track fuel fill-ups, journey top-ups, and km/odometer readings per vehicle & trip.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search fuel logs, trips..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
          <select
            value={machineFilter}
            onChange={(e) => setMachineFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs"
          >
            <option value="all">All Vehicles & Machines</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.plate_number ? `${m.name} (${m.plate_number})` : m.name}
              </option>
            ))}
          </select>
          <Button onClick={() => setOpen(true)} className="gap-1.5 h-9 text-xs">
            <Plus className="h-4 w-4" /> Add Fuel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total Fill-up Records" value={formatNumber(filtered.length)} />
        <Stat label="Total Litres Consumed" value={`${formatNumber(totals.litres)} L`} />
        <Stat label="Total Fuel Cost" value={formatMoney(totals.cost)} />
      </div>

      {chartData.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold text-sm">Recent fuel usage trend</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
              <XAxis dataKey="date" stroke="hsl(215 14% 45%)" fontSize={11} />
              <YAxis stroke="hsl(215 14% 45%)" fontSize={11} />
              <Tooltip contentStyle={{ borderRadius: 8 }} />
              <Line type="monotone" dataKey="litres" stroke="hsl(161 70% 36%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Fuel className="h-5 w-5" />}
          title="No fuel records found"
          description="Click 'Add Fuel' to record a fuel top-up for a vehicle or active trip."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-left uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Vehicle / Machine</th>
                  <th className="px-4 py-3 font-semibold">Associated Trip</th>
                  <th className="px-4 py-3 font-semibold text-right">Odometer</th>
                  <th className="px-4 py-3 font-semibold text-right">Litres</th>
                  <th className="px-4 py-3 font-semibold text-right">Cost</th>
                  <th className="px-4 py-3 font-semibold">Station / Notes</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((l) => {
                  const tripRef = parseTripFromNotes(l.notes);
                  const cleanNotes = l.notes?.replace(/\[Trip:\s*[^\]]+\]/, "").trim();

                  return (
                    <tr key={l.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{formatDate(l.recorded_at)}</td>
                      <td className="px-4 py-3 font-semibold">
                        {l.machines?.name ?? "—"}
                        {l.machines?.plate_number && (
                          <span className="text-[11px] font-normal text-muted-foreground ml-1">
                            ({l.machines.plate_number})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {tripRef ? (
                          <Badge variant="outline" className="text-[11px] bg-primary/5 text-primary border-primary/30 gap-1 font-normal">
                            <Truck className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[200px]">{tripRef}</span>
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">General Refuel</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {l.odometer ? `${formatNumber(l.odometer)} km` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                        {l.fuel_litres ? `${formatNumber(l.fuel_litres)} L` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground whitespace-nowrap">
                        {formatMoney(l.fuel_cost, l.currency ?? "TZS")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                        {l.station && <strong className="text-foreground mr-1.5">{l.station}</strong>}
                        {cleanNotes && <span>{cleanNotes}</span>}
                        {!l.station && !cleanNotes && "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isManager && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setConfirm(l.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FuelDialog
        open={open}
        onOpenChange={setOpen}
        machines={machines}
        trips={trips}
        userId={user?.id}
        onSaved={load}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Delete fuel log record?"
        description="This action cannot be undone."
        onConfirm={async () => {
          await handleDelete();
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-black text-foreground">{value}</div>
    </div>
  );
}

function FuelDialog({ open, onOpenChange, machines, trips = [], userId, onSaved }: any) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string>("none");
  const [form, setForm] = useState<any>({
    machine_id: "",
    recorded_at: new Date().toISOString().slice(0, 10),
    odometer: "",
    fuel_litres: "",
    fuel_cost: "",
    currency: "TZS",
    station: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        machine_id: "",
        recorded_at: new Date().toISOString().slice(0, 10),
        odometer: "",
        fuel_litres: "",
        fuel_cost: "",
        currency: "TZS",
        station: "",
        notes: "",
      });
      setSelectedTripId("none");
    }
  }, [open]);

  // Filter trips if machine is already selected
  const availableTripsForMachine = useMemo(() => {
    if (!form.machine_id) return trips;
    return trips.filter((t: any) => t.machine_id === form.machine_id);
  }, [trips, form.machine_id]);

  const handleTripChange = (tripId: string) => {
    setSelectedTripId(tripId);
    if (tripId !== "none") {
      const chosenTrip = trips.find((t: any) => t.id === tripId);
      if (chosenTrip && chosenTrip.machine_id && chosenTrip.machine_id !== form.machine_id) {
        setForm((prev: any) => ({ ...prev, machine_id: chosenTrip.machine_id }));
      }
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.machine_id) return toast.error("Please pick a vehicle / machine");
    setSubmitting(true);

    let notesText = form.notes || "";
    if (selectedTripId !== "none") {
      const chosen = trips.find((t: any) => t.id === selectedTripId);
      if (chosen) {
        const tripHeader = `[Trip: ${chosen.origin || "Origin"} ➔ ${chosen.destination || "Destination"} #${chosen.id.slice(0, 8)}]`;
        notesText = `${tripHeader} ${notesText}`.trim();
      }
    }

    const payload: any = {
      machine_id: form.machine_id,
      recorded_at: form.recorded_at,
      odometer: form.odometer === "" ? null : Number(form.odometer),
      fuel_litres: form.fuel_litres === "" ? null : Number(form.fuel_litres),
      fuel_cost: Number(form.fuel_cost) || 0,
      currency: form.currency,
      station: form.station || null,
      notes: notesText || null,
      created_by: userId,
    };

    const { error } = await supabase.from("fuel_logs").insert(payload);

    // Update machine current odometer / hours if provided
    if (!error && payload.odometer != null) {
      await supabase
        .from("machines")
        .update({ current_hours: payload.odometer, current_odometer_km: payload.odometer })
        .eq("id", payload.machine_id);
    }

    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Fuel record added successfully");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5 text-primary" />
            Add Fuel & Odometer
          </DialogTitle>
          <DialogDescription>
            Record fuel refill, liters, cost, and associate with an ongoing or recent trip.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-1">
          {/* Machine Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Vehicle / Machine *</Label>
            <select
              value={form.machine_id ?? ""}
              onChange={(e) => setForm({ ...form, machine_id: e.target.value })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              required
            >
              <option value="">Select vehicle / machine</option>
              {machines.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.plate_number ? `${m.name} (${m.plate_number})` : m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Associated Trip Selector (Allows adding fuel multiple times to the same trip) */}
          <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5" />
                Associated Fleet Trip (Optional)
              </Label>
              <span className="text-[10px] text-muted-foreground">Multiple fuel top-ups supported</span>
            </div>

            <select
              value={selectedTripId}
              onChange={(e) => handleTripChange(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
            >
              <option value="none">— General Refuel / No Specific Trip —</option>
              {availableTripsForMachine.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.origin || "Origin"} ➔ {t.destination || "Destination"} ({t.client_name || "General Freight"} · {t.status === "in_progress" ? "In Transit" : t.status})
                </option>
              ))}
            </select>

            {selectedTripId !== "none" && (
              <p className="text-[11px] text-primary/80 pt-0.5">
                ✓ Fuel cost will be tagged to this trip route. You can add fuel two times or more for the same trip as the vehicle progresses.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Date</Label>
              <Input
                type="date"
                value={form.recorded_at ?? ""}
                onChange={(e) => setForm({ ...form, recorded_at: e.target.value })}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Odometer / Hours</Label>
              <Input
                type="number"
                step="any"
                placeholder="Current km reading"
                value={form.odometer ?? ""}
                onChange={(e) => setForm({ ...form, odometer: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Fuel Litres (L)</Label>
              <Input
                type="number"
                step="any"
                placeholder="Litres filled"
                value={form.fuel_litres ?? ""}
                onChange={(e) => setForm({ ...form, fuel_litres: e.target.value })}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Fuel Cost</Label>
              <div className="flex gap-1.5">
                <Input
                  type="number"
                  step="any"
                  placeholder="Amount"
                  value={form.fuel_cost ?? ""}
                  onChange={(e) => setForm({ ...form, fuel_cost: e.target.value })}
                  className="h-9 text-xs flex-1"
                  required
                />
                <select
                  value={form.currency ?? "TZS"}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="TZS">TZS</option>
                  <option value="USD">USD</option>
                  <option value="ZMW">ZMW</option>
                  <option value="KES">KES</option>
                  <option value="ZAR">ZAR</option>
                </select>
              </div>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-medium">Fuel Station / Vendor</Label>
              <Input
                placeholder="e.g. TotalEnergies Kurasini, Puma Mbeya, Oryx Nakonde"
                value={form.station ?? ""}
                onChange={(e) => setForm({ ...form, station: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-medium">Notes / Receipt Ref</Label>
              <Input
                placeholder="Receipt number, pump price, or driver note"
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting} className="gap-1.5">
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add Fuel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
