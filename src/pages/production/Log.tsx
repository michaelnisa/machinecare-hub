import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Target, Plus, Loader2, X, CheckCircle2, Pencil, Trash2, Download, ChevronLeft, AlertTriangle, Wrench } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { DOWNTIME_REASONS, REASON_MAP, SCRAP_REASONS } from "@/lib/production-constants";

function formatPoNumber(year: number | null | undefined, n: number | null | undefined) {
  if (!n) return "—";
  const y = year ?? new Date().getFullYear();
  return `PO-${y}-${String(n).padStart(4, "0")}`;
}

function monthBounds(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { startISO: start.toISOString().slice(0, 10), endISO: end.toISOString().slice(0, 10) };
}

const SHIFTS = ["Day", "Evening", "Night"];
const LINE_STORAGE_KEY = "production.lastLine";

function triggerProductionAlert(productionKpiId: string) {
  supabase.functions.invoke("send-production-alert", { body: { productionKpiId } })
    .catch((e) => console.error("send-production-alert failed", e));
}

export default function ProductionLog() {
  const { profile, user, organisation } = useAuth();
  const { isOwner, isManager, isEngineer } = useUserRole();
  const canApprove = isOwner || isManager || isEngineer;
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [downtimeEvents, setDowntimeEvents] = useState<any[]>([]);
  const [linkedWorkOrders, setLinkedWorkOrders] = useState<any[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [prodLines, setProdLines] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [month, setMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [machineFilter, setMachineFilter] = useState<string>("all");

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { startISO, endISO } = monthBounds(month);
    const [
      { data: i, error: e1 },
      { data: m, error: e2 },
      { data: dt, error: e3 },
      { data: pr, error: e5 },
      { data: poData },
      { data: plData },
    ] = await Promise.all([
      (supabase as any).from("production_kpis").select("*, machines(name), production_orders(id, po_number, po_year)").gte("record_date", startISO).lt("record_date", endISO).order("record_date", { ascending: false }).limit(2000),
      supabase.from("machines").select("id, name").order("name"),
      supabase.from("production_downtime_events").select("*").gte("record_date", startISO).lt("record_date", endISO).order("record_date", { ascending: false }).limit(5000),
      (supabase as any).from("products").select("*").eq("is_active", true).order("name"),
      (supabase as any).from("production_orders").select("id, po_number, po_year, product, product_id, batch_number, production_line, production_line_id, quantity_ordered, quantity_produced, status").in("status", ["planned", "released", "in_progress"]).order("created_at", { ascending: false }),
      (supabase as any).from("production_lines").select("*").eq("is_active", true).order("name"),
    ]);
    const err = e1 || e2 || e3 || e5;
    if (err) toast.error((err as any).message);
    setItems(i ?? []);
    setMachines(m ?? []);
    setDowntimeEvents(dt ?? []);
    setProducts(pr ?? []);
    setActiveOrders(poData ?? []);
    setProdLines(plData ?? []);

    const woIds = Array.from(new Set((dt ?? []).map((e: any) => e.work_order_id).filter(Boolean)));
    if (woIds.length) {
      const { data: wos } = await supabase.from("work_orders").select("id, machine_id, started_at, finished_at").in("id", woIds);
      setLinkedWorkOrders(wos ?? []);
    } else {
      setLinkedWorkOrders([]);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile, month]);

  const filteredItems = useMemo(
    () => (machineFilter === "all" ? items : items.filter((x) => x.machine_id === machineFilter)),
    [items, machineFilter]
  );
  const filteredDowntimeEvents = useMemo(
    () => (machineFilter === "all" ? downtimeEvents : downtimeEvents.filter((e) => e.machine_id === machineFilter)),
    [downtimeEvents, machineFilter]
  );
  const productionLines = useMemo(
    () => Array.from(new Set(items.map((x) => x.production_line).filter(Boolean))).sort() as string[],
    [items]
  );

  const unlinkedBreakdowns = useMemo(() => {
    return filteredDowntimeEvents.filter((e) => e.category === "unplanned" && !e.work_order_id && e.machine_id);
  }, [filteredDowntimeEvents]);

  const raiseWorkOrderForDowntime = async (event: any) => {
    if (!profile || !event.machine_id) return;
    const machine = machines.find((m: any) => m.id === event.machine_id);
    const reason = REASON_MAP.get(event.reason_code)?.label ?? event.reason_code;
    const { data: wo, error: woError } = await supabase.from("work_orders").insert({
      organisation_id: profile.organisation_id,
      machine_id: event.machine_id,
      title: `Unplanned Downtime (${reason}) — ${machine?.name ?? "Machine"}`,
      description: `Raised from Production Downtime Log on ${event.record_date} (${event.duration_minutes} min). Reason: ${reason}.`,
      priority: "high",
      status: "open",
      work_type: "repair",
      created_by: user?.id ?? null,
    } as any).select("id").maybeSingle();
    if (woError || !wo) { toast.error(`Failed: ${woError?.message}`); return; }
    await supabase.from("production_downtime_events").update({ work_order_id: wo.id } as any).eq("id", event.id);
    await supabase.from("maintenance_notifications").insert({
      organisation_id: profile.organisation_id,
      machine_id: event.machine_id,
      title: `Breakdown Work Order Raised — ${machine?.name ?? "Machine"}`,
      description: `Production reported ${event.duration_minutes}m downtime due to ${reason}. Work order created.`,
      severity: "high",
      reported_by: user?.id ?? null,
      work_order_id: wo.id,
    } as any);
    toast.success("Work order raised and maintenance notified!");
    load();
  };

  const approveLog = async (id: string) => {
    const { error } = await supabase.from("production_kpis").update({ log_status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Log approved");
    load();
  };

  const deleteLog = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("production_kpis").delete().eq("id", deleteTarget.id);
    if (error) return toast.error(error.message);
    toast.success("Log deleted");
    load();
  };

  const exportCSV = () => {
    const rows: string[][] = [];
    rows.push(["MachineCare Production Log", organisation?.name ?? "", month]);
    rows.push([]);
    rows.push(["Date", "Shift", "Machine", "Line", "Product", "Operator", "Target", "Actual", "Scrap", "Downtime (min)", "Attainment %", "Status"]);
    filteredItems.forEach((x) => rows.push([
      x.record_date, x.shift ?? "", x.machines?.name ?? "", x.production_line ?? "", x.product ?? "", x.operator ?? "",
      String(x.target_units ?? 0), String(x.actual_units ?? 0), String(x.scrap_units ?? 0), String(x.downtime_minutes ?? 0),
      Number(x.attainment_percent || 0).toFixed(1), x.log_status ?? "",
    ]));
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `production-log-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/production" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-3.5 w-3.5" /> Production Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Production Log</h1>
          <p className="text-sm text-muted-foreground">Add, review, and approve shift logs for the selected period.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
          <select value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">All machines</option>
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <Button variant="outline" onClick={exportCSV} disabled={filteredItems.length === 0}>
            <Download className="mr-2 h-4 w-4" />Export CSV
          </Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Log production
          </Button>
        </div>
      </div>

      {unlinkedBreakdowns.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-50/60 p-4 dark:bg-amber-950/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Unplanned Downtime Without Work Orders ({unlinkedBreakdowns.length})
              </span>
            </div>
            <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">Maintenance Andon Bridge</span>
          </div>
          <div className="divide-y divide-amber-200/50 dark:divide-amber-800/50">
            {unlinkedBreakdowns.slice(0, 5).map((evt: any) => {
              const mName = machines.find((m: any) => m.id === evt.machine_id)?.name ?? "Machine";
              const rLabel = REASON_MAP.get(evt.reason_code)?.label ?? evt.reason_code;
              return (
                <div key={evt.id} className="flex flex-wrap items-center justify-between py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{mName}</span>
                    <span className="text-muted-foreground">· {formatDate(evt.record_date)}</span>
                    <span className="rounded bg-amber-200/70 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
                      {rLabel} ({evt.duration_minutes}m)
                    </span>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400 bg-background hover:bg-amber-100 dark:hover:bg-amber-900/50" onClick={() => raiseWorkOrderForDowntime(evt)}>
                    <Wrench className="mr-1 h-3 w-3 text-amber-600" /> Raise Work Order
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filteredItems.length === 0 ? (
        <EmptyState icon={<Target className="h-5 w-5" />} title="No production logs" description="Click 'Log production' to record the first shift for this period." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Shift</th>
                <th className="px-5 py-3 font-medium">Machine</th>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Target</th>
                <th className="px-5 py-3 font-medium">Actual</th>
                <th className="px-5 py-3 font-medium">Scrap</th>
                <th className="px-5 py-3 font-medium">Downtime</th>
                <th className="px-5 py-3 font-medium">Attainment</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((x) => (
                <tr key={x.id} className="border-t border-border">
                  <td className="px-5 py-3">{formatDate(x.record_date)}</td>
                  <td className="px-5 py-3">{x.shift ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{x.machines?.name ?? "—"}</td>
                  <td className="px-5 py-3">
                    <div className="font-medium text-foreground">{x.product ?? "—"}</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                      {x.production_orders && (
                        <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary">
                          {formatPoNumber(x.production_orders.po_year, x.production_orders.po_number)}
                        </span>
                      )}
                      {x.batch_number && (
                        <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Lot: {x.batch_number}</span>
                      )}
                      {x.production_line && <span className="text-[11px] text-muted-foreground/80">{x.production_line}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3">{x.target_units}</td>
                  <td className="px-5 py-3">{x.actual_units}</td>
                  <td className="px-5 py-3">{x.scrap_units}</td>
                  <td className="px-5 py-3">{x.downtime_minutes}m</td>
                  <td className="px-5 py-3 font-medium">{Number(x.attainment_percent || 0).toFixed(1)}%</td>
                  <td className="px-5 py-3">
                    {x.log_status === "approved" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">
                        <CheckCircle2 className="h-3 w-3" /> Approved
                      </span>
                    ) : canApprove ? (
                      <Button size="sm" variant="outline" onClick={() => approveLog(x.id)}>Approve</Button>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">Submitted</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {x.log_status !== "approved" && (
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(x); setOpen(true); }} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {isManager && (
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(x)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LogDialog open={open} setOpen={setOpen} machines={machines} products={products} orgId={profile?.organisation_id} onSaved={load} editing={editing} productionLines={productionLines} activeOrders={activeOrders} prodLines={prodLines} />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete this production log?"
        description={deleteTarget ? `${formatDate(deleteTarget.record_date)}${deleteTarget.shift ? ` · ${deleteTarget.shift}` : ""} — this can't be undone.` : undefined}
        onConfirm={deleteLog}
      />
    </div>
  );
}

function LogDialog({ open, setOpen, machines, products, orgId, onSaved, editing, productionLines, activeOrders = [], prodLines = [] }: any) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const defaultForm = {
    record_date: new Date().toISOString().slice(0, 10),
    shift: "Day", machine_id: "", product: "", product_id: "", operator: "",
    production_order_id: "", batch_number: "", production_line_id: "",
    target_units: 0, actual_units: 0, scrap_units: 0, downtime_minutes: 0, notes: "",
    planned_minutes: "", ideal_cycle_seconds: "", production_line: "",
  };
  const [f, setF] = useState<any>(defaultForm);
  const [breakdown, setBreakdown] = useState<{ reason_code: string; minutes: string }[]>([]);
  const [scrapBreakdown, setScrapBreakdown] = useState<{ reason_code: string; qty: string }[]>([]);

  useEffect(() => {
    if (open && editing) {
      setF({
        record_date: editing.record_date, shift: editing.shift ?? "Day", machine_id: editing.machine_id ?? "",
        product: editing.product ?? "", product_id: editing.product_id ?? "", operator: editing.operator ?? "",
        production_order_id: editing.production_order_id ?? "", batch_number: editing.batch_number ?? "",
        production_line_id: editing.production_line_id ?? "",
        target_units: editing.target_units ?? 0, actual_units: editing.actual_units ?? 0,
        scrap_units: editing.scrap_units ?? 0, downtime_minutes: editing.downtime_minutes ?? 0,
        notes: editing.notes ?? "", planned_minutes: editing.planned_minutes ?? "", ideal_cycle_seconds: editing.ideal_cycle_seconds ?? "",
        production_line: editing.production_line ?? "",
      });
      setBreakdown([]); setScrapBreakdown([]);
    } else if (open) {
      setF({ ...defaultForm, production_line: localStorage.getItem(LINE_STORAGE_KEY) ?? "" });
      setBreakdown([]); setScrapBreakdown([]);
    }
  }, [open, editing]);

  const breakdownTotal = breakdown.reduce((s, b) => s + (Number(b.minutes) || 0), 0);
  const scrapTotal = scrapBreakdown.reduce((s, b) => s + (Number(b.qty) || 0), 0);
  useEffect(() => { if (breakdown.length > 0) setF((prev: any) => ({ ...prev, downtime_minutes: breakdownTotal })); }, [breakdownTotal, breakdown.length]);
  useEffect(() => { if (scrapBreakdown.length > 0) setF((prev: any) => ({ ...prev, scrap_units: scrapTotal })); }, [scrapTotal, scrapBreakdown.length]);

  const onProductChange = (productId: string) => {
    const p = products.find((x: any) => x.id === productId);
    setF((prev: any) => ({ ...prev, product_id: productId, product: p?.name ?? prev.product, ideal_cycle_seconds: p?.ideal_cycle_seconds ?? prev.ideal_cycle_seconds }));
  };

  const onOrderChange = (orderId: string) => {
    if (!orderId) { setF((prev: any) => ({ ...prev, production_order_id: "", batch_number: "" })); return; }
    const order = (activeOrders ?? []).find((o: any) => o.id === orderId);
    if (order) setF((prev: any) => ({
      ...prev,
      production_order_id: order.id,
      batch_number: order.batch_number || prev.batch_number,
      product: order.product || prev.product,
      product_id: order.product_id || prev.product_id,
      production_line_id: order.production_line_id || prev.production_line_id,
      production_line: order.production_line || prev.production_line,
      target_units: Math.max(0, (order.quantity_ordered || 0) - (order.quantity_produced || 0)) || prev.target_units,
    }));
  };

  const submit = async () => {
    if (breakdown.some((b) => !b.minutes || Number(b.minutes) <= 0)) return toast.error("Every downtime reason needs minutes > 0");
    if (scrapBreakdown.some((b) => !b.qty || Number(b.qty) <= 0)) return toast.error("Every scrap reason needs a quantity > 0");
    setSaving(true);
    if (f.production_line?.trim()) localStorage.setItem(LINE_STORAGE_KEY, f.production_line.trim());

    const payload: any = {
      machine_id: f.machine_id || null, record_date: f.record_date, shift: f.shift || null,
      product: f.product || null, product_id: f.product_id || null, operator: f.operator || null,
      target_units: Number(f.target_units) || 0, actual_units: Number(f.actual_units) || 0,
      scrap_units: Number(f.scrap_units) || 0, downtime_minutes: Number(f.downtime_minutes) || 0,
      notes: f.notes || null, planned_minutes: f.planned_minutes === "" ? null : Number(f.planned_minutes),
      ideal_cycle_seconds: f.ideal_cycle_seconds === "" ? null : Number(f.ideal_cycle_seconds),
      production_line: f.production_line?.trim() || null,
      production_order_id: f.production_order_id || null,
      batch_number: f.batch_number?.trim() || null,
      production_line_id: f.production_line_id || null,
    };

    if (editing) {
      const { error } = await supabase.from("production_kpis").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Updated"); setOpen(false); onSaved(); triggerProductionAlert(editing.id);
      return;
    }

    const { data: inserted, error } = await supabase.from("production_kpis").insert({ ...payload, organisation_id: orgId }).select("id").maybeSingle();

    if (!error && inserted && breakdown.length > 0) {
      const dtRows = breakdown.map((b) => ({
        organisation_id: orgId, production_kpi_id: inserted.id, machine_id: f.machine_id || null,
        record_date: f.record_date, category: REASON_MAP.get(b.reason_code)?.category ?? "unplanned",
        reason_code: b.reason_code, duration_minutes: Number(b.minutes), created_by: user?.id ?? null,
      }));
      const { data: insertedDt, error: dtError } = await supabase.from("production_downtime_events").insert(dtRows).select("id, reason_code");
      if (dtError) toast.error(`Saved, but downtime breakdown failed: ${dtError.message}`);
      else if (f.machine_id) {
        const bdIds = (insertedDt ?? []).filter((r: any) => r.reason_code === "breakdown").map((r: any) => r.id);
        if (bdIds.length > 0) {
          const machineName = machines.find((m: any) => m.id === f.machine_id)?.name ?? "machine";
          const { data: wo, error: woErr } = await supabase.from("work_orders").insert({
            organisation_id: orgId, machine_id: f.machine_id,
            title: `Breakdown — ${machineName} (${f.record_date}${f.shift ? " " + f.shift : ""})`,
            description: f.notes || "Auto-created from a production breakdown log.",
            priority: "high", status: "open", work_type: "repair", created_by: user?.id ?? null,
          } as any).select("id").maybeSingle();
          if (!woErr && wo) {
            await supabase.from("production_downtime_events").update({ work_order_id: wo.id } as any).in("id", bdIds);
            await supabase.from("maintenance_notifications").insert({
              organisation_id: orgId, machine_id: f.machine_id,
              title: `Breakdown reported — ${machineName}`,
              description: `Work order created from the production log for ${f.record_date}${f.shift ? " " + f.shift : ""}.`,
              severity: "high", reported_by: user?.id ?? null, work_order_id: wo.id,
            });
          }
        }
      }
    }

    if (!error && inserted && scrapBreakdown.length > 0) {
      const scRows = scrapBreakdown.map((b) => ({
        organisation_id: orgId, production_kpi_id: inserted.id, machine_id: f.machine_id || null,
        record_date: f.record_date, reason_code: b.reason_code, quantity: Number(b.qty), created_by: user?.id ?? null,
      }));
      const { error: scErr } = await (supabase as any).from("production_scrap_events").insert(scRows);
      if (scErr) toast.error(`Saved, but scrap breakdown failed: ${scErr.message}`);
    }

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); onSaved();
    if (inserted) triggerProductionAlert(inserted.id);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit production log" : "Log production"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {!editing && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs font-semibold text-primary">Link to Active Production Order (Optional)</Label>
              </div>
              <select value={f.production_order_id || ""} onChange={(e) => onOrderChange(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-medium">
                <option value="">— Standalone Shift Log (No Order) —</option>
                {(activeOrders ?? []).map((ord: any) => (
                  <option key={ord.id} value={ord.id}>{formatPoNumber(ord.po_year, ord.po_number)} · {ord.product} {ord.batch_number ? `(Lot ${ord.batch_number})` : ""} · {ord.quantity_produced || 0}/{ord.quantity_ordered}</option>
                ))}
              </select>
            </div>
          )}
          <div><Label>Date</Label><Input type="date" value={f.record_date} onChange={(e) => setF({ ...f, record_date: e.target.value })} className="mt-1" /></div>
          <div><Label>Shift</Label>
            <select value={f.shift} onChange={(e) => setF({ ...f, shift: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><Label>Machine</Label>
            <select value={f.machine_id} onChange={(e) => setF({ ...f, machine_id: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">—</option>
              {machines.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Production line</Label>
            <select value={f.production_line_id || ""} onChange={(e) => { const l = prodLines.find((x: any) => x.id === e.target.value); setF({ ...f, production_line_id: e.target.value || null, production_line: l ? l.name : f.production_line }); }} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">— Registered line or type below —</option>
              {prodLines.map((l: any) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
            </select>
            <Input placeholder="Or custom line name" list="prod-line-opts" value={f.production_line} onChange={(e) => setF({ ...f, production_line: e.target.value, production_line_id: "" })} className="mt-1.5" />
            <datalist id="prod-line-opts">{(productionLines ?? []).map((l: string) => <option key={l} value={l} />)}</datalist>
          </div>
          <div>
            <Label>Product</Label>
            <select value={f.product_id} onChange={(e) => onProductChange(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">— select or type below —</option>
              {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>)}
            </select>
            <Input placeholder="Or type a product name" value={f.product} onChange={(e) => setF({ ...f, product: e.target.value, product_id: "" })} className="mt-1.5" />
          </div>
          <div><Label>Batch / Lot # (optional)</Label><Input placeholder="e.g. LOT-20261003-01" value={f.batch_number} onChange={(e) => setF({ ...f, batch_number: e.target.value })} className="mt-1" /></div>
          <div><Label>Operator</Label><Input value={f.operator} onChange={(e) => setF({ ...f, operator: e.target.value })} className="mt-1" /></div>
          <div><Label>Target units</Label><Input type="number" min={0} value={f.target_units} onChange={(e) => setF({ ...f, target_units: e.target.value })} className="mt-1" /></div>
          <div><Label>Actual units</Label><Input type="number" min={0} value={f.actual_units} onChange={(e) => setF({ ...f, actual_units: e.target.value })} className="mt-1" /></div>
          <div><Label>Scrap units</Label><Input type="number" min={0} value={f.scrap_units} onChange={(e) => setF({ ...f, scrap_units: e.target.value })} disabled={scrapBreakdown.length > 0} className="mt-1" />{scrapBreakdown.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">Auto-summed from reasons below.</p>}</div>
          <div><Label>Downtime (min)</Label><Input type="number" min={0} value={f.downtime_minutes} onChange={(e) => setF({ ...f, downtime_minutes: e.target.value })} disabled={breakdown.length > 0} className="mt-1" />{breakdown.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">Auto-summed from reasons below.</p>}</div>
        </div>

        {editing && <p className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">Editing updates the summary numbers only. Downtime/scrap breakdown detail and the auto-created work order (if any) stay as originally logged.</p>}

        {!editing && (
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <Label>Downtime breakdown (optional)</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setBreakdown((r) => [...r, { reason_code: DOWNTIME_REASONS[0].code, minutes: "" }])}><Plus className="mr-1 h-3.5 w-3.5" /> Add reason</Button>
            </div>
            {breakdown.length === 0 ? <p className="text-xs text-muted-foreground">Break the downtime total down by reason. Choosing "Breakdown / fault" auto-creates a work order for maintenance.</p> : (
              <div className="space-y-2">
                {breakdown.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select value={b.reason_code} onChange={(e) => setBreakdown((rows) => rows.map((r, idx) => idx === i ? { ...r, reason_code: e.target.value } : r))} className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm">
                      <optgroup label="Unplanned">{DOWNTIME_REASONS.filter((r) => r.category === "unplanned").map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}</optgroup>
                      <optgroup label="Planned">{DOWNTIME_REASONS.filter((r) => r.category === "planned").map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}</optgroup>
                    </select>
                    <Input type="number" min={0} placeholder="min" value={b.minutes} onChange={(e) => setBreakdown((rows) => rows.map((r, idx) => idx === i ? { ...r, minutes: e.target.value } : r))} className="w-24" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setBreakdown((rows) => rows.filter((_, idx) => idx !== i))}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!editing && (
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <Label>Scrap breakdown (optional)</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setScrapBreakdown((r) => [...r, { reason_code: SCRAP_REASONS[0].code, qty: "" }])}><Plus className="mr-1 h-3.5 w-3.5" /> Add reason</Button>
            </div>
            {scrapBreakdown.length === 0 ? <p className="text-xs text-muted-foreground">Break scrap down by cause instead of one raw number.</p> : (
              <div className="space-y-2">
                {scrapBreakdown.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select value={b.reason_code} onChange={(e) => setScrapBreakdown((rows) => rows.map((r, idx) => idx === i ? { ...r, reason_code: e.target.value } : r))} className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm">
                      {SCRAP_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                    </select>
                    <Input type="number" min={0} placeholder="qty" value={b.qty} onChange={(e) => setScrapBreakdown((rows) => rows.map((r, idx) => idx === i ? { ...r, qty: e.target.value } : r))} className="w-24" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setScrapBreakdown((rows) => rows.filter((_, idx) => idx !== i))}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-lg border border-dashed border-border p-3">
          <p className="mb-2 text-xs text-muted-foreground">Optional — fill these in to automatically feed today's OEE record for this machine.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Planned run time (min)</Label><Input type="number" min={0} placeholder="e.g. 480" value={f.planned_minutes} onChange={(e) => setF({ ...f, planned_minutes: e.target.value })} className="mt-1" /></div>
            <div><Label>Ideal cycle time (sec/unit)</Label><Input type="number" min={0} step="0.01" placeholder="e.g. 12.5" value={f.ideal_cycle_seconds} onChange={(e) => setF({ ...f, ideal_cycle_seconds: e.target.value })} className="mt-1" /></div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Save changes" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
