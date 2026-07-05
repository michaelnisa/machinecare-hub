import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ClipboardCheck, Plus, Loader2, CheckCircle2, XCircle, MinusCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Machine = { id: string; name: string; plate_number: string | null; organisation_id: string };
type Driver = { id: string; full_name: string };
type Execution = {
  id: string;
  machine_id: string;
  driver_id: string | null;
  performed_by_name: string | null;
  performed_at: string;
  overall_result: string | null;
};

const RESULT_CLASS: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700",
  attention: "bg-red-100 text-red-700",
};

export default function Inspections() {
  const { profile } = useAuth();
  const { canWrite } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [resultFilter, setResultFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [newOpen, setNewOpen] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data: templates, error: tErr } = await supabase
      .from("checklist_templates")
      .select("id")
      .eq("is_fleet_pre_start", true);
    if (tErr) toast.error(tErr.message);
    const templateIds = (templates ?? []).map((t) => t.id);

    const [{ data: m }, { data: d }] = await Promise.all([
      supabase.from("machines").select("id, name, plate_number, organisation_id").eq("category", "Vehicle"),
      supabase.from("drivers").select("id, full_name").eq("status", "active"),
    ]);
    setMachines((m ?? []) as Machine[]);
    setDrivers((d ?? []) as Driver[]);

    if (templateIds.length === 0) {
      setExecutions([]);
      setLoading(false);
      return;
    }

    const { data: ex, error: exErr } = await supabase
      .from("checklist_executions")
      .select("id, machine_id, driver_id, performed_by_name, performed_at, overall_result")
      .in("template_id", templateIds)
      .order("performed_at", { ascending: false })
      .limit(200);
    if (exErr) toast.error(exErr.message);
    setExecutions((ex ?? []) as Execution[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const machineMap = useMemo(() => new Map(machines.map((m) => [m.id, m])), [machines]);
  const driverMap = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);
  const vehicleLabel = (machineId: string) => {
    const m = machineMap.get(machineId);
    if (!m) return "Vehicle";
    return m.plate_number ? `${m.name} (${m.plate_number})` : m.name;
  };

  const filtered = useMemo(() => {
    return executions.filter((e) => {
      if (resultFilter !== "all" && (e.overall_result ?? "ok") !== resultFilter) return false;
      if (vehicleFilter !== "all" && e.machine_id !== vehicleFilter) return false;
      if (driverFilter !== "all" && e.driver_id !== driverFilter) return false;
      return true;
    });
  }, [executions, resultFilter, vehicleFilter, driverFilter]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inspections</h1>
          <p className="text-sm text-muted-foreground">Submitted pre-start inspections across your fleet.</p>
        </div>
        {canWrite && machines.length > 0 && (
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Record inspection
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={resultFilter} onValueChange={setResultFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All results</SelectItem>
            <SelectItem value="ok">OK</SelectItem>
            <SelectItem value="attention">Needs attention</SelectItem>
          </SelectContent>
        </Select>
        <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All vehicles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vehicles</SelectItem>
            {machines.map((m) => <SelectItem key={m.id} value={m.id}>{vehicleLabel(m.id)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={driverFilter} onValueChange={setDriverFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All drivers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All drivers</SelectItem>
            {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-5 w-5" />}
          title="No inspections submitted yet"
          description="Mark a checklist template as the fleet pre-start template, then drivers can submit inspections by scanning a vehicle's QR code — or record one manually here."
          action={
            canWrite && machines.length > 0 ? (
              <Button onClick={() => setNewOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Record inspection
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Vehicle</th>
                <th className="px-5 py-3 font-medium">Driver</th>
                <th className="px-5 py-3 font-medium">Submitted</th>
                <th className="px-5 py-3 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-5 py-3 font-medium">{vehicleLabel(e.machine_id)}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {e.driver_id ? driverMap.get(e.driver_id)?.full_name ?? e.performed_by_name : e.performed_by_name ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{formatDate(e.performed_at)}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${RESULT_CLASS[e.overall_result ?? "ok"] ?? "bg-muted"}`}>
                      {(e.overall_result ?? "ok") === "attention" ? "Needs attention" : "OK"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewInspectionDialog open={newOpen} onOpenChange={setNewOpen} machines={machines} drivers={drivers} onSaved={load} />
    </div>
  );
}

type TemplateItem = { item_id: string; item_text: string; item_sort_order: number; item_severity: string };
type Result = "ok" | "not_ok" | "not_relevant";

function NewInspectionDialog({ open, onOpenChange, machines, drivers, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machines: Machine[];
  drivers: Driver[];
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [machineId, setMachineId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [performedByName, setPerformedByName] = useState("");
  const [template, setTemplate] = useState<{ id: string; name: string; version: number } | null>(null);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [responses, setResponses] = useState<Record<string, { result: Result; comment: string }>>({});
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMachineId("");
      setDriverId("");
      setPerformedByName("");
      setTemplate(null);
      setItems([]);
      setResponses({});
    }
  }, [open]);

  useEffect(() => {
    if (!machineId) { setTemplate(null); setItems([]); return; }
    setLoadingTemplate(true);
    setResponses({});
    supabase.rpc("get_fleet_pre_start_template", { _machine_id: machineId }).then(({ data, error }) => {
      setLoadingTemplate(false);
      if (error) return toast.error(error.message);
      if (!data || data.length === 0) { setTemplate(null); setItems([]); return; }
      setTemplate({ id: data[0].template_id, name: data[0].template_name, version: data[0].template_version });
      setItems(
        data
          .map((r) => ({ item_id: r.item_id, item_text: r.item_text, item_sort_order: r.item_sort_order, item_severity: r.item_severity }))
          .sort((a, b) => a.item_sort_order - b.item_sort_order),
      );
    });
  }, [machineId]);

  const setResult = (itemId: string, result: Result) => {
    setResponses((prev) => ({ ...prev, [itemId]: { result, comment: prev[itemId]?.comment ?? "" } }));
  };
  const setComment = (itemId: string, comment: string) => {
    setResponses((prev) => ({ ...prev, [itemId]: { result: prev[itemId]?.result ?? "not_relevant", comment } }));
  };

  const allAnswered = items.length > 0 && items.every((it) => responses[it.item_id]?.result);
  const notOkCount = items.filter((it) => responses[it.item_id]?.result === "not_ok").length;
  const machine = machines.find((m) => m.id === machineId);

  const submit = async () => {
    if (!machine || !template) return;
    const driverName = drivers.find((d) => d.id === driverId)?.full_name;
    const name = driverName || performedByName.trim();
    if (!name) return toast.error("Enter who performed the inspection");
    setSubmitting(true);
    const executionId = crypto.randomUUID();
    const overallResult = notOkCount > 0 ? "attention" : "ok";

    const { error: execErr } = await supabase.from("checklist_executions").insert({
      id: executionId,
      organisation_id: machine.organisation_id,
      machine_id: machine.id,
      template_id: template.id,
      template_version: template.version,
      driver_id: driverId || null,
      performed_by: user?.id ?? null,
      performed_by_name: name,
      status: "completed",
      overall_result: overallResult,
    });
    if (execErr) {
      setSubmitting(false);
      return toast.error(execErr.message);
    }

    const rows = items.map((it, i) => ({
      execution_id: executionId,
      item_id: it.item_id,
      item_text_snapshot: it.item_text,
      item_type: "tri_state",
      severity_snapshot: it.item_severity,
      result: responses[it.item_id]?.result ?? "not_relevant",
      notes: responses[it.item_id]?.comment || null,
      sort_order: i,
    }));
    const { error: respErr } = await supabase.from("checklist_execution_responses").insert(rows);
    setSubmitting(false);
    if (respErr) return toast.error(respErr.message);

    toast.success(notOkCount > 0 ? `Inspection recorded — ${notOkCount} item(s) flagged` : "Inspection recorded — all OK");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Record a pre-start inspection</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Vehicle *</label>
              <Select value={machineId} onValueChange={setMachineId}>
                <SelectTrigger><SelectValue placeholder="Pick a vehicle" /></SelectTrigger>
                <SelectContent>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.plate_number ? `${m.name} (${m.plate_number})` : m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Driver</label>
              {drivers.length > 0 ? (
                <Select value={driverId} onValueChange={setDriverId}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <input
                  value={performedByName}
                  onChange={(e) => setPerformedByName(e.target.value)}
                  placeholder="Who performed this inspection"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              )}
            </div>
          </div>

          {loadingTemplate && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {!loadingTemplate && machineId && !template && (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No fleet pre-start template is set up for this organisation yet. Mark a checklist template as the fleet pre-start template first.
            </div>
          )}

          {!loadingTemplate && template && items.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{template.name}</p>
              {items.map((it, i) => {
                const r = responses[it.item_id]?.result;
                return (
                  <div key={it.item_id} className="rounded-xl border border-border p-3">
                    <p className="mb-2.5 text-sm font-medium">{i + 1}. {it.item_text}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setResult(it.item_id, "ok")}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border-2 py-2 text-xs font-medium transition-colors",
                          r === "ok" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-border text-muted-foreground hover:bg-accent",
                        )}
                      >
                        <CheckCircle2 className="h-4 w-4" /> OK
                      </button>
                      <button
                        type="button"
                        onClick={() => setResult(it.item_id, "not_ok")}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border-2 py-2 text-xs font-medium transition-colors",
                          r === "not_ok" ? "border-red-500 bg-red-50 text-red-700" : "border-border text-muted-foreground hover:bg-accent",
                        )}
                      >
                        <XCircle className="h-4 w-4" /> Not OK
                      </button>
                      <button
                        type="button"
                        onClick={() => setResult(it.item_id, "not_relevant")}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border-2 py-2 text-xs font-medium transition-colors",
                          r === "not_relevant" ? "border-slate-400 bg-slate-100 text-slate-700" : "border-border text-muted-foreground hover:bg-accent",
                        )}
                      >
                        <MinusCircle className="h-4 w-4" /> N/A
                      </button>
                    </div>
                    {r === "not_ok" && (
                      <textarea
                        placeholder="What's wrong? (optional)"
                        value={responses[it.item_id]?.comment ?? ""}
                        onChange={(e) => setComment(it.item_id, e.target.value)}
                        rows={2}
                        className="mt-2.5 w-full rounded-md border border-input bg-background p-2 text-sm"
                      />
                    )}
                  </div>
                );
              })}
              {notOkCount > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {notOkCount} item{notOkCount === 1 ? "" : "s"} flagged — a fault report will be created automatically.
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={!allAnswered || submitting} onClick={submit}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save inspection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
