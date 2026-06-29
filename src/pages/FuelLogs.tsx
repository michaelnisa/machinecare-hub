import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Fuel, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";

export default function FuelLogs() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string }[]>([]);
  const [machineFilter, setMachineFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: l }, { data: m }] = await Promise.all([
      supabase.from("fuel_logs").select("*, machines(name)").order("recorded_at", { ascending: false }).limit(500),
      supabase.from("machines").select("id, name").order("name"),
    ]);
    setLogs(l ?? []);
    setMachines(m ?? []);
    setLoading(false);
  };
  useEffect(() => { if (profile) load(); }, [profile]);

  const filtered = useMemo(
    () => (machineFilter === "all" ? logs : logs.filter((l) => l.machine_id === machineFilter)),
    [logs, machineFilter],
  );

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
    filtered.forEach((l) => { litres += Number(l.fuel_litres ?? 0); cost += Number(l.fuel_cost ?? 0); });
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

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fuel & odometer</h1>
          <p className="text-sm text-muted-foreground">Track fuel consumption and km/hours over time.</p>
        </div>
        <div className="flex gap-2">
          <select value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">All machines</option>
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Log fuel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Records" value={formatNumber(filtered.length)} />
        <Stat label="Total litres" value={formatNumber(totals.litres)} />
        <Stat label="Total cost" value={formatMoney(totals.cost)} />
      </div>

      {chartData.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Recent fuel usage</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
              <XAxis dataKey="date" stroke="hsl(215 14% 45%)" fontSize={12} />
              <YAxis stroke="hsl(215 14% 45%)" fontSize={12} />
              <Tooltip contentStyle={{ borderRadius: 8 }} />
              <Line type="monotone" dataKey="litres" stroke="hsl(161 70% 36%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={<Fuel className="h-5 w-5" />} title="No fuel records" description="Log fuel fill-ups and odometer readings to track consumption." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Machine</th>
                <th className="px-5 py-3 font-medium">Odometer</th>
                <th className="px-5 py-3 font-medium">Litres</th>
                <th className="px-5 py-3 font-medium">Cost</th>
                <th className="px-5 py-3 font-medium">Station</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-5 py-3">{formatDate(l.recorded_at)}</td>
                  <td className="px-5 py-3 font-medium">{l.machines?.name ?? "—"}</td>
                  <td className="px-5 py-3">{l.odometer ? formatNumber(l.odometer) : "—"}</td>
                  <td className="px-5 py-3">{l.fuel_litres ? formatNumber(l.fuel_litres) : "—"}</td>
                  <td className="px-5 py-3">{formatMoney(l.fuel_cost, l.currency ?? "TZS")}</td>
                  <td className="px-5 py-3 text-muted-foreground">{l.station ?? "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => setConfirm(l.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FuelDialog open={open} onOpenChange={setOpen} machines={machines} userId={user?.id} onSaved={load} />
      <ConfirmDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)} title="Delete fuel log?" description="This cannot be undone." onConfirm={async () => { await handleDelete(); }} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function FuelDialog({ open, onOpenChange, machines, userId, onSaved }: any) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (open) setForm({ machine_id: "", recorded_at: new Date().toISOString().slice(0, 10), odometer: "", fuel_litres: "", fuel_cost: "", currency: "TZS", station: "", notes: "" });
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.machine_id) return toast.error("Pick a machine");
    setSubmitting(true);
    const payload: any = {
      machine_id: form.machine_id,
      recorded_at: form.recorded_at,
      odometer: form.odometer === "" ? null : Number(form.odometer),
      fuel_litres: form.fuel_litres === "" ? null : Number(form.fuel_litres),
      fuel_cost: Number(form.fuel_cost) || 0,
      currency: form.currency,
      station: form.station || null,
      notes: form.notes || null,
      created_by: userId,
    };
    const { error } = await supabase.from("fuel_logs").insert(payload);
    // also update machine current_hours/odometer
    if (!error && payload.odometer != null) {
      await supabase.from("machines").update({ current_hours: payload.odometer }).eq("id", payload.machine_id);
    }
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Logged");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Log fuel / odometer</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Machine *</Label>
              <select value={form.machine_id ?? ""} onChange={(e) => setForm({ ...form, machine_id: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select machine</option>
                {machines.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.recorded_at ?? ""} onChange={(e) => setForm({ ...form, recorded_at: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Odometer (km/hours)</Label>
              <Input type="number" step="any" value={form.odometer ?? ""} onChange={(e) => setForm({ ...form, odometer: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Fuel (litres)</Label>
              <Input type="number" step="any" value={form.fuel_litres ?? ""} onChange={(e) => setForm({ ...form, fuel_litres: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Cost</Label>
              <div className="flex gap-2">
                <Input type="number" step="any" value={form.fuel_cost ?? ""} onChange={(e) => setForm({ ...form, fuel_cost: e.target.value })} />
                <select value={form.currency ?? "TZS"} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="TZS">TZS</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="KES">KES</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Station / supplier</Label>
              <Input value={form.station ?? ""} onChange={(e) => setForm({ ...form, station: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
