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
import { CircleDot, Plus, Trash2, Loader2, AlertTriangle, Flame } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatNumber } from "@/lib/format";
import { tyreStatus, normalizeTyrePosition as normalizePosition } from "@/lib/fleet-constants";
import { useI18n } from "@/i18n/I18nProvider";

// Axles are named front-to-back: A = steer/front axle(s), B = rear axle(s).
// A1 is the foremost axle; B1 is the first rear axle, B2 the second, etc.
// Each axle has a Left and Right wheel position, e.g. A1L / A1R, B2L / B2R.
const AXLES = [
  { id: "A1", label: "Front axle (A1)" },
  { id: "B1", label: "Rear axle 1 (B1)" },
  { id: "B2", label: "Rear axle 2 (B2)" },
  { id: "B3", label: "Rear axle 3 (B3)" },
] as const;
const SPARE_POSITIONS = ["Spare1", "Spare2"];

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
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>("");
  const [fitOpen, setFitOpen] = useState(false);
  const [fitPosition, setFitPosition] = useState<string>("");
  const [confirmRemove, setConfirmRemove] = useState<Tyre | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [changeAfterRemove, setChangeAfterRemove] = useState(false);

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
      if (t.machine_id === selectedMachine && !t.removed_at) map.set(normalizePosition(t.position), t);
    }
    return map;
  }, [tyres, selectedMachine]);

  const vehicleTyres = useMemo(() => tyres.filter((t) => t.machine_id === selectedMachine), [tyres, selectedMachine]);

  const history = useMemo(() => vehicleTyres.filter((t) => t.removed_at), [vehicleTyres]);

  // How many times a tyre has been fitted at each axle position (current + past) —
  // the highest count is the axle chewing through tyres fastest on this vehicle.
  const usageCountByPosition = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of vehicleTyres) {
      const pos = normalizePosition(t.position);
      map.set(pos, (map.get(pos) ?? 0) + 1);
    }
    return map;
  }, [vehicleTyres]);
  const maxUsageCount = Math.max(0, ...AXLES.flatMap((a) => [usageCountByPosition.get(`${a.id}L`) ?? 0, usageCountByPosition.get(`${a.id}R`) ?? 0]));
  const mostUsedPositions = useMemo(() => {
    if (maxUsageCount <= 1) return [];
    return AXLES.flatMap((a) => [`${a.id}L`, `${a.id}R`]).filter((pos) => (usageCountByPosition.get(pos) ?? 0) === maxUsageCount);
  }, [maxUsageCount, usageCountByPosition]);

  const selectedTyre = selectedPosition ? activeTyresByPosition.get(selectedPosition) ?? null : null;
  const selectedPositionHistory = useMemo(
    () => (selectedPosition ? history.filter((t) => normalizePosition(t.position) === selectedPosition) : []),
    [selectedPosition, history],
  );

  const alerts = useMemo(() => {
    return tyres
      .filter((t) => !t.removed_at)
      .map((t) => ({ tyre: t, status: tyreStatus(t, machineMap.get(t.machine_id)?.current_odometer_km ?? null) }))
      .filter((x) => x.status !== "ok");
  }, [tyres, machineMap]);

  const handleRemoveTyre = async () => {
    if (!confirmRemove) return;
    const position = normalizePosition(confirmRemove.position);
    const { error } = await supabase
      .from("tyres")
      .update({ removed_at: new Date().toISOString().slice(0, 10) })
      .eq("id", confirmRemove.id);
    if (error) return toast.error(error.message);
    toast.success("Tyre removed");
    setConfirmRemove(null);
    await load();
    if (changeAfterRemove) {
      setChangeAfterRemove(false);
      setSelectedPosition(null);
      setFitPosition(position);
      setFitOpen(true);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.fleet.tyresTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.fleet.tyresSub}</p>
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
                <span>{vehicleLabel(tyre.machine_id)} · {normalizePosition(tyre.position)} {tyre.brand ? `(${tyre.brand})` : ""}</span>
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
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-foreground">
                {t.fleet.axleDiagram} — {currentMachine ? vehicleLabel(currentMachine.id) : "—"}
              </h2>
              {currentMachine?.current_odometer_km != null && (
                <span className="text-xs text-muted-foreground">Current odometer: {formatNumber(currentMachine.current_odometer_km)} km</span>
              )}
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              A = front/steer axle, B = rear axles, numbered front to back. Click a wheel to view or change that tyre.
            </p>

            {mostUsedPositions.length > 0 && (
              <div className="mb-4 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                <Flame className="h-3.5 w-3.5" />
                Most-replaced position{mostUsedPositions.length > 1 ? "s" : ""}: {mostUsedPositions.join(", ")} — {maxUsageCount} tyres fitted here over time
              </div>
            )}

            <div className="mx-auto flex max-w-xs flex-col items-center gap-4">
              {AXLES.map((axle) => {
                const leftPos = `${axle.id}L`;
                const rightPos = `${axle.id}R`;
                return (
                  <div key={axle.id} className="flex w-full flex-col items-center gap-2 rounded-xl border border-border p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{axle.label}</div>
                    <div className="flex items-center gap-5">
                      <TyreWheel
                        position={leftPos}
                        tyre={activeTyresByPosition.get(leftPos) ?? null}
                        currentOdo={currentMachine?.current_odometer_km ?? null}
                        usageCount={usageCountByPosition.get(leftPos) ?? 0}
                        isMostUsed={mostUsedPositions.includes(leftPos)}
                        onClick={() => setSelectedPosition(leftPos)}
                      />
                      <div className="h-0.5 w-8 rounded bg-border" />
                      <TyreWheel
                        position={rightPos}
                        tyre={activeTyresByPosition.get(rightPos) ?? null}
                        currentOdo={currentMachine?.current_odometer_km ?? null}
                        usageCount={usageCountByPosition.get(rightPos) ?? 0}
                        isMostUsed={mostUsedPositions.includes(rightPos)}
                        onClick={() => setSelectedPosition(rightPos)}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center gap-5 pt-1">
                {SPARE_POSITIONS.map((pos) => (
                  <TyreWheel
                    key={pos}
                    position={pos}
                    tyre={activeTyresByPosition.get(pos) ?? null}
                    currentOdo={currentMachine?.current_odometer_km ?? null}
                    usageCount={usageCountByPosition.get(pos) ?? 0}
                    isMostUsed={false}
                    onClick={() => setSelectedPosition(pos)}
                    small
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-medium text-foreground">{t.fleet.replacementHistory}</h2>
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
                        <td className="py-2 pr-4">{normalizePosition(t.position)}</td>
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
        onChange={() => {
          if (!selectedTyre) return;
          setChangeAfterRemove(true);
          setConfirmRemove(selectedTyre);
        }}
      />

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
        onOpenChange={(v) => { if (!v) { setConfirmRemove(null); setChangeAfterRemove(false); } }}
        title={changeAfterRemove ? "Change this tyre?" : "Remove this tyre?"}
        description={
          changeAfterRemove
            ? "The current tyre will be marked as removed and you'll immediately fit its replacement at the same position."
            : "It will be marked as removed and moved to replacement history."
        }
        confirmLabel={changeAfterRemove ? t.fleet.changeTyre : t.fleet.removeTyre}
        onConfirm={async () => { await handleRemoveTyre(); }}
      />
    </div>
  );
}

function TyreWheel({ position, tyre, currentOdo, usageCount, isMostUsed, onClick, small }: {
  position: string;
  tyre: Tyre | null;
  currentOdo: number | null;
  usageCount: number;
  isMostUsed: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  const status = tyre ? tyreStatus(tyre, currentOdo) : null;
  const ringClass =
    status === "overdue" ? "border-red-400 bg-red-50 text-red-700" :
    status === "due_soon" ? "border-amber-400 bg-amber-50 text-amber-700" :
    tyre ? "border-emerald-400 bg-emerald-50 text-emerald-700" :
    "border-dashed border-muted-foreground/30 text-muted-foreground/50";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-center gap-1 ${small ? "w-14" : "w-16"}`}
      title={`${position}${tyre ? ` — ${tyre.brand ?? "tyre fitted"}` : " — empty"}`}
    >
      <span className={`relative flex ${small ? "h-9 w-9" : "h-11 w-11"} items-center justify-center rounded-full border-2 transition-transform group-hover:scale-105 ${ringClass}`}>
        <CircleDot className={small ? "h-4 w-4" : "h-5 w-5"} />
        {isMostUsed && <Flame className="absolute -right-1 -top-1 h-3.5 w-3.5 text-amber-600" />}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">{position}</span>
      {tyre ? (
        <span className="line-clamp-1 max-w-full text-center text-[10px] text-muted-foreground">{tyre.brand ?? "Fitted"}</span>
      ) : (
        <span className="text-[10px] text-muted-foreground">Empty</span>
      )}
      {usageCount > 1 && <span className="text-[9px] text-muted-foreground">{usageCount} fits</span>}
    </button>
  );
}

function PositionDetailDialog({ open, onOpenChange, position, tyre, positionHistory, currentOdo, canWrite, onFit, onChange }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  position: string | null;
  tyre: Tyre | null;
  positionHistory: Tyre[];
  currentOdo: number | null;
  canWrite: boolean;
  onFit: () => void;
  onChange: () => void;
}) {
  const { t } = useI18n();
  if (!position) return null;
  const status = tyre ? tyreStatus(tyre, currentOdo) : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Axle position {position}</DialogTitle></DialogHeader>
        {tyre ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{tyre.brand ?? "Unbranded tyre"}</div>
                <div className="text-xs text-muted-foreground">{tyre.size ?? "—"} {tyre.serial ? `· S/N ${tyre.serial}` : ""}</div>
              </div>
              {status && <StatusBadge status={status} />}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><div className="text-muted-foreground">Fitted</div><div>{formatDate(tyre.fitted_at)}</div></div>
              <div><div className="text-muted-foreground">Fitted at odo</div><div>{tyre.fitted_odo != null ? `${formatNumber(tyre.fitted_odo)} km` : "—"}</div></div>
              <div><div className="text-muted-foreground">Current tread</div><div>{tyre.current_tread_mm != null ? `${tyre.current_tread_mm} mm` : "—"}</div></div>
              <div><div className="text-muted-foreground">Target replace</div><div>{tyre.target_replace_km != null ? `${formatNumber(tyre.target_replace_km)} km` : "—"}</div></div>
            </div>
            {tyre.notes && <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">{tyre.notes}</p>}
            {canWrite && (
              <Button className="w-full" onClick={onChange}>
                <Trash2 className="mr-2 h-4 w-4" /> {t.fleet.changeTyre}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">No tyre currently fitted at this position.</p>
            {canWrite && (
              <Button className="w-full" onClick={onFit}>
                <Plus className="mr-2 h-4 w-4" /> {t.fleet.fitTyre}
              </Button>
            )}
          </div>
        )}
        {positionHistory.length > 0 && (
          <div className="border-t border-border pt-3">
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Previous tyres at this position</div>
            <ul className="space-y-1.5">
              {positionHistory.map((h) => (
                <li key={h.id} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{h.brand ?? "—"} {h.size ? `· ${h.size}` : ""}</span>
                  <span>{formatDate(h.fitted_at)} – {formatDate(h.removed_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
  const { t } = useI18n();
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
        <DialogHeader><DialogTitle>{t.fleet.fitTyre} — {position}</DialogTitle></DialogHeader>
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
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t.fleet.fitTyre}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
