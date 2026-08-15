import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatDate } from "@/lib/format";
import { ArrowLeft, ClipboardList, Plus, Trash2, Loader2, Play, CheckCircle2, XCircle, Rocket } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function formatPoNumber(year: number | null | undefined, n: number | null | undefined) {
  if (!n) return "—";
  const y = year ?? new Date().getFullYear();
  return `PO-${y}-${String(n).padStart(4, "0")}`;
}

const STATUS_TABS = ["all", "planned", "released", "in_progress", "completed", "cancelled"] as const;
const STATUS_LABEL: Record<string, string> = {
  planned: "Planned", released: "Released", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled",
};
const STATUS_PILL: Record<string, string> = {
  planned: "status-inactive", released: "status-due", in_progress: "status-maintenance", completed: "status-ok", cancelled: "status-inactive",
};
const PRIORITY_LABEL: Record<string, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };
const PRIORITY_COLOR: Record<string, string> = {
  low: "text-muted-foreground", normal: "text-sky-600", high: "text-amber-600", urgent: "text-red-600",
};

export default function ProductionOrders() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("production_orders").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setOrders(data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (profile) load(); }, [profile]);

  const filtered = useMemo(() => (tab === "all" ? orders : orders.filter((o) => o.status === tab)), [orders, tab]);

  const setStatus = async (order: any, status: string, extra: Record<string, any> = {}) => {
    setBusyId(order.id);
    const { error } = await supabase.from("production_orders").update({ status, ...extra }).eq("id", order.id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(`Order ${STATUS_LABEL[status].toLowerCase()}`);
    load();
  };

  const updateQuantityProduced = async (order: any, value: number) => {
    const { error } = await supabase.from("production_orders").update({ quantity_produced: value }).eq("id", order.id);
    if (error) return toast.error(error.message);
    load();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from("production_orders").delete().eq("id", confirmDelete);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Order deleted");
    setConfirmDelete(null);
    load();
  };

  const handleCancel = async () => {
    if (!confirmCancel) return;
    const order = orders.find((o) => o.id === confirmCancel);
    if (order) await setStatus(order, "cancelled");
    setConfirmCancel(null);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/production/overview" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Production Overview
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Production Orders</h1>
          <p className="text-sm text-muted-foreground">What to produce, how much, on which line, by when — tracked start to finish.</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New order
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
              tab === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            {s === "all" ? "All" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No production orders"
          description="Create an order to plan and track a production run from start to finish."
          action={<Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> New order</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">Line</th>
                  <th className="px-5 py-3 font-medium">Progress</th>
                  <th className="px-5 py-3 font-medium">Priority</th>
                  <th className="px-5 py-3 font-medium">Planned</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const pct = o.quantity_ordered > 0 ? Math.min(100, (o.quantity_produced / o.quantity_ordered) * 100) : 0;
                  return (
                    <tr key={o.id} className="border-t border-border">
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{formatPoNumber(o.po_year, o.po_number)}</td>
                      <td className="px-5 py-3 font-medium">{o.product}</td>
                      <td className="px-5 py-3 text-muted-foreground">{o.production_line || "—"}{o.shift ? ` · ${o.shift}` : ""}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                          <input
                            type="number"
                            min={0}
                            defaultValue={o.quantity_produced}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (v !== o.quantity_produced) updateQuantityProduced(o, v);
                            }}
                            className="h-7 w-16 rounded border border-input bg-background px-1 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">/ {o.quantity_ordered}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn("text-xs font-semibold uppercase", PRIORITY_COLOR[o.priority])}>{PRIORITY_LABEL[o.priority]}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {o.planned_start_date ? formatDate(o.planned_start_date) : "—"}
                        {o.planned_end_date ? ` – ${formatDate(o.planned_end_date)}` : ""}
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn("status-pill", STATUS_PILL[o.status])}>{STATUS_LABEL[o.status]}</span>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {o.status === "planned" && (
                          <Button variant="ghost" size="icon" title="Release" disabled={busyId === o.id} onClick={() => setStatus(o, "released")}>
                            <Rocket className="h-4 w-4" />
                          </Button>
                        )}
                        {o.status === "released" && (
                          <Button variant="ghost" size="icon" title="Start" disabled={busyId === o.id} onClick={() => setStatus(o, "in_progress", { actual_start_date: new Date().toISOString().slice(0, 10) })}>
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        {o.status === "in_progress" && (
                          <Button variant="ghost" size="icon" title="Complete" disabled={busyId === o.id} onClick={() => setStatus(o, "completed", { actual_end_date: new Date().toISOString().slice(0, 10) })}>
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                        {(o.status === "planned" || o.status === "released" || o.status === "in_progress") && (
                          <Button variant="ghost" size="icon" title="Cancel order" onClick={() => setConfirmCancel(o.id)}>
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                        {o.status === "planned" && (
                          <Button variant="ghost" size="icon" title="Delete" onClick={() => setConfirmDelete(o.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
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

      <OrderDialog open={dialogOpen} onOpenChange={setDialogOpen} orgId={profile?.organisation_id} userId={profile?.id} onSaved={load} />
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Delete this order?"
        description="This cannot be undone."
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={!!confirmCancel}
        onOpenChange={(v) => !v && setConfirmCancel(null)}
        title="Cancel this order?"
        description="The order will be marked cancelled. This can't be undone."
        confirmLabel="Cancel order"
        onConfirm={handleCancel}
      />
    </div>
  );
}

function OrderDialog({ open, onOpenChange, orgId, userId, onSaved }: any) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (open) {
      setForm({
        product: "", production_line: "", shift: "", quantity_ordered: "",
        priority: "normal", planned_start_date: "", planned_end_date: "", notes: "",
      });
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product?.trim()) return toast.error("Product is required");
    if (!form.quantity_ordered || Number(form.quantity_ordered) <= 0) return toast.error("Quantity ordered must be greater than 0");
    setSubmitting(true);
    const { error } = await supabase.from("production_orders").insert({
      organisation_id: orgId,
      created_by: userId,
      product: form.product.trim(),
      production_line: form.production_line?.trim() || null,
      shift: form.shift?.trim() || null,
      quantity_ordered: Number(form.quantity_ordered),
      priority: form.priority || "normal",
      planned_start_date: form.planned_start_date || null,
      planned_end_date: form.planned_end_date || null,
      notes: form.notes?.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Production order created");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New production order</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Product *</Label>
              <Input value={form.product ?? ""} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="What are we producing?" />
            </div>
            <div className="space-y-1.5">
              <Label>Production line</Label>
              <Input value={form.production_line ?? ""} onChange={(e) => setForm({ ...form, production_line: e.target.value })} placeholder="e.g. Line 1" />
            </div>
            <div className="space-y-1.5">
              <Label>Shift</Label>
              <Input value={form.shift ?? ""} onChange={(e) => setForm({ ...form, shift: e.target.value })} placeholder="e.g. Day" />
            </div>
            <div className="space-y-1.5">
              <Label>Quantity ordered *</Label>
              <Input type="number" min={1} value={form.quantity_ordered ?? ""} onChange={(e) => setForm({ ...form, quantity_ordered: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <select value={form.priority ?? "normal"} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {Object.entries(PRIORITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Planned start</Label>
              <Input type="date" value={form.planned_start_date ?? ""} onChange={(e) => setForm({ ...form, planned_start_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Planned end</Label>
              <Input type="date" value={form.planned_end_date ?? ""} onChange={(e) => setForm({ ...form, planned_end_date: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
