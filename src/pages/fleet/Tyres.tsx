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
import { StatusBadge } from "@/components/StatusBadge";
import { CircleDot, Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatNumber } from "@/lib/format";
import { tyreStatus } from "@/lib/fleet-constants";

const POSITIONS = ["FL", "FR", "RL", "RR", "RL2", "RR2", "RL3", "RR3", "Spare1", "Spare2"];

type Machine = { id: string; name: string; plate_number: string | null; current_odometer_km: number | null };

type Tyre = {
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
};

export default function Tyres() {
  const { profile } = useAuth();
  const { canWrite } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>("");
  const [fitOpen, setFitOpen] = useState(false);
  const [fitPosition, setFitPosition] = useState<string>("");
  const [confirmRemove, setConfirmRemove] = useState<Tyre | null>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: m }, { data: t, error: tErr }] = await Promise.all([
      supabase.from("machines").select("id, name, plate_number, current_odometer_km").order("name"),
      supabase.from("tyres").select("*").order("created_at", { ascending: false }),
    ]);
    if (tErr) toast.error(tErr.message);
    setMachines((m ?? []) as Machine[]);
    setTyres((t ?? []) as Tyre[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  useEffect(() => {
    if (!selectedMachine && machines.length > 0) setSelectedMachine(machines[0].id);
  }, [machines, selectedMachine]);

  const machineMap = useMemo(() => new Map(machines.map((m) => [m.id, m])), [machines]);
  const vehicleLabel = (machineId: string) => {
    const m = machineMap.get(machineId);
    if (!m) return "Vehicle";
    return m.plate_number ? `${m.name} (${m.plate_number})` : m.name;
  };

  const currentMachine = machineMap.get(selectedMachine);
  const activeTyresByPosition = useMemo(() => {
    const map = new Map<string, Tyre>();
    for (const t of tyres) {
      if (t.machine_id === selectedMachine && !t.removed_at) map.set(t.position, t);
    }
    return map;
  }, [tyres, selectedMachine]);

  const history = useMemo(
    () => tyres.filter((t) => t.machine_id === selectedMachine && t.removed_at),
    [tyres, selectedMachine],
  );

  const alerts = useMemo(() => {
    return tyres
      .filter((t) => !t.removed_at)
      .map((t) => ({ tyre: t, status: tyreStatus(t, machineMap.get(t.machine_id)?.current_odometer_km ?? null) }))
      .filter((x) => x.status !== "ok");
  }, [tyres, machineMap]);

  const handleRemoveTyre = async () => {
    if (!confirmRemove) return;
    const { error } = await supabase
      .from("tyres")
      .update({ removed_at: new Date().toISOString().slice(0, 10) })
      .eq("id", confirmRemove.id);
    if (error) return toast.error(error.message);
    toast.success("Tyre removed");
    setConfirmRemove(null);
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tyres</h1>
          <p className="text-sm text-muted-foreground">Per-vehicle tyre positions and replacement history.</p>
        </div>
        <Select value={selectedMachine} onValueChange={setSelectedMachine}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Pick a vehicle" /></SelectTrigger>
          <SelectContent>
            {machines.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.plate_number ? `${m.name} (${m.plate_number})` : m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800">
            <AlertTriangle className="h-4 w-4" /> {alerts.length} tyre{alerts.length === 1 ? "" : "s"} need attention across your fleet
          </div>
          <div className="space-y-1.5">
            {alerts.slice(0, 5).map(({ tyre, status }) => (
              <div key={tyre.id} className="flex items-center justify-between text-sm">
                <span>{vehicleLabel(tyre.machine_id)} · {tyre.position} {tyre.brand ? `(${tyre.brand})` : ""}</span>
                <StatusBadge status={status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {machines.length === 0 ? (
        <EmptyState icon={<CircleDot className="h-5 w-5" />} title="No vehicles yet" description="Add a vehicle in Machines before tracking tyres." />
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">
                Tyre positions — {currentMachine ? vehicleLabel(currentMachine.id) : "—"}
              </h2>
              {currentMachine?.current_odometer_km != null && (
                <span className="text-xs text-muted-foreground">Current odometer: {formatNumber(currentMachine.current_odometer_km)} km</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {POSITIONS.map((pos) => {
                const tyre = activeTyresByPosition.get(pos);
                const status = tyre ? tyreStatus(tyre, currentMachine?.current_odometer_km ?? null) : null;
                return (
                  <div key={pos} className="rounded-lg border border-border p-3 text-center">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{pos}</div>
                    {tyre ? (
                      <div className="mt-2 space-y-1">
                        <CircleDot className="mx-auto h-6 w-6 text-primary" />
                        <div className="text-xs font-medium">{tyre.brand ?? "—"}</div>
                        <div className="text-[11px] text-muted-foreground">{tyre.size ?? ""}</div>
                        {status && <StatusBadge status={status} className="text-[10px]" />}
                        {canWrite && (
                          <Button variant="ghost" size="sm" className="h-6 px-1 text-[11px] text-destructive" onClick={() => setConfirmRemove(tyre)}>
                            <Trash2 className="mr-1 h-3 w-3" /> Remove
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 space-y-1">
                        <CircleDot className="mx-auto h-6 w-6 text-muted-foreground/40" />
                        <div className="text-[11px] text-muted-foreground">Empty</div>
                        {canWrite && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1 text-[11px]"
                            onClick={() => { setFitPosition(pos); setFitOpen(true); }}
                            disabled={!selectedMachine}
                          >
                            <Plus className="mr-1 h-3 w-3" /> Fit
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-medium text-foreground">Replacement history</h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tyres removed from this vehicle yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Position</th>
                      <th className="py-2 pr-4 font-medium">Brand / size</th>
                      <th className="py-2 pr-4 font-medium">Fitted</th>
                      <th className="py-2 pr-4 font-medium">Removed</th>
                      <th className="py-2 pr-4 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((t) => (
                      <tr key={t.id} className="border-t border-border">
                        <td className="py-2 pr-4">{t.position}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{t.brand ?? "—"} {t.size ? `· ${t.size}` : ""}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{formatDate(t.fitted_at)}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{formatDate(t.removed_at)}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{t.removed_reason ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <FitTyreDialog
        open={fitOpen}
        onOpenChange={setFitOpen}
        machineId={selectedMachine}
        position={fitPosition}
        currentOdo={currentMachine?.current_odometer_km ?? null}
        onSaved={load}
      />
      <ConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(v) => !v && setConfirmRemove(null)}
        title="Remove this tyre?"
        description="It will be marked as removed and moved to replacement history."
        confirmLabel="Remove"
        onConfirm={async () => { await handleRemoveTyre(); }}
      />
    </div>
  );
}

function FitTyreDialog({ open, onOpenChange, machineId, position, currentOdo, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machineId: string;
  position: string;
  currentOdo: number | null;
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    brand: "",
    size: "",
    serial: "",
    fitted_at: new Date().toISOString().slice(0, 10),
    fitted_odo: "",
    current_tread_mm: "",
    target_replace_km: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        brand: "",
        size: "",
        serial: "",
        fitted_at: new Date().toISOString().slice(0, 10),
        fitted_odo: currentOdo != null ? String(currentOdo) : "",
        current_tread_mm: "",
        target_replace_km: "",
        notes: "",
      });
    }
  }, [open, currentOdo]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !machineId) return;
    setSubmitting(true);
    const payload = {
      organisation_id: profile.organisation_id,
      machine_id: machineId,
      position,
      brand: form.brand || null,
      size: form.size || null,
      serial: form.serial || null,
      fitted_at: form.fitted_at || null,
      fitted_odo: form.fitted_odo === "" ? null : Number(form.fitted_odo),
      current_tread_mm: form.current_tread_mm === "" ? null : Number(form.current_tread_mm),
      target_replace_km: form.target_replace_km === "" ? null : Number(form.target_replace_km),
      notes: form.notes || null,
    };
    const { error } = await supabase.from("tyres").insert(payload);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Tyre fitted");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Fit tyre — {position}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Size</Label>
              <Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="e.g. 295/80R22.5" />
            </div>
            <div className="space-y-1.5">
              <Label>Serial</Label>
              <Input value={form.serial} onChange={(e) => setForm({ ...form, serial: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Fitted on</Label>
              <Input type="date" value={form.fitted_at} onChange={(e) => setForm({ ...form, fitted_at: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Fitted at odometer (km)</Label>
              <Input type="number" min={0} value={form.fitted_odo} onChange={(e) => setForm({ ...form, fitted_odo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Current tread (mm)</Label>
              <Input type="number" min={0} step="0.1" value={form.current_tread_mm} onChange={(e) => setForm({ ...form, current_tread_mm: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Target replace at (km)</Label>
              <Input type="number" min={0} value={form.target_replace_km} onChange={(e) => setForm({ ...form, target_replace_km: e.target.value })} placeholder="e.g. 60000" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes</Label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Fit tyre
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
