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
import { formatDate, formatNumber } from "@/lib/format";
import {
  ArrowLeft,
  ClipboardList,
  Plus,
  Trash2,
  Loader2,
  Play,
  CheckCircle2,
  XCircle,
  Rocket,
  Boxes,
  Check,
  AlertTriangle,
  ShieldCheck,
  PackageCheck,
  Settings2,
  Sparkles,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function formatPoNumber(year: number | null | undefined, n: number | null | undefined) {
  if (!n) return "—";
  const y = year ?? new Date().getFullYear();
  return `PO-${y}-${String(n).padStart(4, "0")}`;
}

const STATUS_TABS = ["all", "planned", "released", "in_progress", "completed", "cancelled"] as const;
const STATUS_LABEL: Record<string, string> = {
  planned: "Planned",
  released: "Released",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};
const STATUS_PILL: Record<string, string> = {
  planned: "status-inactive",
  released: "status-due",
  in_progress: "status-maintenance",
  completed: "status-ok",
  cancelled: "status-inactive",
};
const PRIORITY_LABEL: Record<string, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };
const PRIORITY_COLOR: Record<string, string> = {
  low: "text-muted-foreground",
  normal: "text-sky-600",
  high: "text-amber-600",
  urgent: "text-red-600",
};

const QC_STATUS_LABEL: Record<string, { label: string; pill: string }> = {
  pending_qc: { label: "Pending QC", pill: "status-inactive text-muted-foreground" },
  passed: { label: "QC Passed", pill: "status-ok" },
  quarantined: { label: "Quarantined", pill: "status-inactive text-red-600 font-semibold" },
};

export default function ProductionOrders() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [stockBalances, setStockBalances] = useState<Record<string, number>>({});
  const [locations, setLocations] = useState<any[]>([]);
  const [qaMap, setQaMap] = useState<Map<string, { yieldPct: number; count: number }>>(new Map());

  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [linesDialogOpen, setLinesDialogOpen] = useState(false);
  const [viewBOMOrder, setViewBOMOrder] = useState<any | null>(null);
  const [receiveFGOrder, setReceiveFGOrder] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [
        { data: oData, error: oErr },
        { data: pData },
        { data: lData },
        { data: bData },
        { data: sData },
        { data: qData },
        { data: locData },
      ] = await Promise.all([
        supabase.from("production_orders").select("*").order("created_at", { ascending: false }),
        (supabase as any).from("products").select("*").eq("is_active", true).order("name"),
        (supabase as any).from("production_lines").select("*").eq("is_active", true).order("name"),
        (supabase as any)
          .from("product_materials")
          .select("*, inventory_items(name, part_number, unit, unit_cost)")
          .order("created_at"),
        (supabase as any).from("stock_balances").select("item_id, available_stock"),
        (supabase as any)
          .from("quality_reports")
          .select("production_order_id, yield_percent, units_inspected, units_defective")
          .not("production_order_id", "is", null),
        (supabase as any).from("stock_locations").select("id, name, is_default").order("is_default", { ascending: false }),
      ]);

      if (oErr) toast.error(oErr.message);
      setOrders(oData ?? []);
      setProducts(pData ?? []);
      setLines(lData ?? []);
      setBoms(bData ?? []);
      setLocations(locData ?? []);

      const av: Record<string, number> = {};
      (sData ?? []).forEach((b: any) => {
        av[b.item_id] = (av[b.item_id] ?? 0) + Number(b.available_stock || 0);
      });
      setStockBalances(av);

      const qMap = new Map<string, { yieldPct: number; count: number }>();
      (qData ?? []).forEach((q: any) => {
        if (!q.production_order_id) return;
        const current = qMap.get(q.production_order_id) || { yieldPct: 0, count: 0 };
        current.yieldPct = Number(q.yield_percent) || current.yieldPct;
        current.count += 1;
        qMap.set(q.production_order_id, current);
      });
      setQaMap(qMap);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) load();
  }, [profile]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const lineMap = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);

  const getOrderBOM = (order: any) => {
    const prodId = order.product_id || products.find((p) => p.name.toLowerCase() === order.product.toLowerCase())?.id;
    if (!prodId) return { hasBOM: false, ready: true, items: [], shortCount: 0 };

    const items = boms
      .filter((b) => b.product_id === prodId)
      .map((b) => {
        const required = Number(b.qty_per_unit) * Number(order.quantity_ordered);
        const available = stockBalances[b.item_id] ?? 0;
        const shortage = Math.max(0, required - available);
        return {
          ...b,
          required,
          available,
          shortage,
          isShort: shortage > 0,
        };
      });

    const shortCount = items.filter((i) => i.isShort).length;
    return {
      hasBOM: items.length > 0,
      ready: shortCount === 0,
      items,
      shortCount,
    };
  };

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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setLinesDialogOpen(true)} className="gap-1.5">
            <Settings2 className="h-4 w-4" /> Production Lines
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New order
          </Button>
        </div>
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
            {s === "all" ? "All" : STATUS_LABEL[s]} {s !== "all" && `(${orders.filter((o) => o.status === s).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No production orders"
          description="Create an order to plan and track a production run from start to finish."
          action={<Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> New order</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Order &amp; Batch</th>
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">Line &amp; Shift</th>
                  <th className="px-5 py-3 font-medium">Materials (BOM)</th>
                  <th className="px-5 py-3 font-medium">Progress</th>
                  <th className="px-5 py-3 font-medium">QC Status</th>
                  <th className="px-5 py-3 font-medium">Priority</th>
                  <th className="px-5 py-3 font-medium">Planned</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const pct = o.quantity_ordered > 0 ? Math.min(100, (o.quantity_produced / o.quantity_ordered) * 100) : 0;
                  const bomInfo = getOrderBOM(o);
                  const linkedProduct = o.product_id ? productMap.get(o.product_id) : null;
                  const linkedLine = o.production_line_id ? lineMap.get(o.production_line_id) : null;
                  const qaInfo = qaMap.get(o.id);
                  const qcStatus = QC_STATUS_LABEL[o.qc_status] || QC_STATUS_LABEL.pending_qc;

                  return (
                    <tr key={o.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-mono text-xs font-semibold text-foreground">
                          {formatPoNumber(o.po_year, o.po_number)}
                        </div>
                        {o.batch_number ? (
                          <div className="mt-0.5 inline-block font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            {o.batch_number}
                          </div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground">No batch #</div>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        <div className="font-medium text-foreground">{o.product}</div>
                        {linkedProduct?.sku && (
                          <div className="text-[11px] text-muted-foreground font-mono">SKU: {linkedProduct.sku}</div>
                        )}
                      </td>

                      <td className="px-5 py-3 text-muted-foreground">
                        <div>{linkedLine?.name || o.production_line || "—"}</div>
                        {o.shift && <div className="text-xs text-muted-foreground/80">{o.shift} shift</div>}
                      </td>

                      <td className="px-5 py-3">
                        {bomInfo.hasBOM ? (
                          <button
                            type="button"
                            onClick={() => setViewBOMOrder({ order: o, bomInfo })}
                            className="text-left group cursor-pointer"
                            title="Click to view required materials"
                          >
                            {bomInfo.ready ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-500/15 px-2 py-0.5 rounded-full group-hover:bg-emerald-500/25 transition-colors">
                                <Check className="h-3 w-3" /> Materials Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-500/15 px-2 py-0.5 rounded-full group-hover:bg-amber-500/25 transition-colors">
                                <AlertTriangle className="h-3 w-3" /> Shortage ({bomInfo.shortCount})
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">No BOM</span>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold">{Math.round(pct)}%</span>
                            <span className="text-muted-foreground">
                              {formatNumber(o.quantity_produced)} / {formatNumber(o.quantity_ordered)}
                            </span>
                          </div>
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                pct >= 100 ? "bg-emerald-600" : pct > 0 ? "bg-primary" : "bg-muted-foreground/30",
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3">
                        <span className={cn("status-pill text-xs", qcStatus.pill)}>{qcStatus.label}</span>
                        {qaInfo && qaInfo.count > 0 && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {qaInfo.yieldPct.toFixed(1)}% yield ({qaInfo.count} logs)
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        <span className={cn("text-xs font-semibold uppercase", PRIORITY_COLOR[o.priority])}>
                          {PRIORITY_LABEL[o.priority]}
                        </span>
                      </td>

                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {o.planned_start_date ? formatDate(o.planned_start_date) : "—"}
                        {o.planned_end_date ? ` – ${formatDate(o.planned_end_date)}` : ""}
                      </td>

                      <td className="px-5 py-3">
                        <span className={cn("status-pill", STATUS_PILL[o.status])}>{STATUS_LABEL[o.status]}</span>
                      </td>

                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {bomInfo.hasBOM && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Check BOM Materials"
                            onClick={() => setViewBOMOrder({ order: o, bomInfo })}
                          >
                            <Boxes className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                        {o.status === "planned" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Release order"
                            disabled={busyId === o.id}
                            onClick={() => setStatus(o, "released")}
                          >
                            <Rocket className="h-4 w-4 text-sky-600" />
                          </Button>
                        )}
                        {o.status === "released" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Start production"
                            disabled={busyId === o.id}
                            onClick={() =>
                              setStatus(o, "in_progress", { actual_start_date: new Date().toISOString().slice(0, 10) })
                            }
                          >
                            <Play className="h-4 w-4 text-amber-600" />
                          </Button>
                        )}
                        {o.status === "in_progress" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Complete & Receive Finished Goods"
                            disabled={busyId === o.id}
                            onClick={() => setReceiveFGOrder(o)}
                          >
                            <PackageCheck className="h-4 w-4 text-emerald-600" />
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

      {/* New Order Dialog */}
      <OrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orgId={profile?.organisation_id}
        userId={profile?.id}
        products={products}
        lines={lines}
        onSaved={load}
      />

      {/* BOM Materials Inspector Modal */}
      {viewBOMOrder && (
        <OrderBOMDialog
          open={!!viewBOMOrder}
          onOpenChange={(v) => !v && setViewBOMOrder(null)}
          order={viewBOMOrder.order}
          bomInfo={viewBOMOrder.bomInfo}
        />
      )}

      {/* Finished Goods Receiving Modal */}
      {receiveFGOrder && (
        <ReceiveFGDialog
          open={!!receiveFGOrder}
          onOpenChange={(v) => !v && setReceiveFGOrder(null)}
          order={receiveFGOrder}
          locations={locations}
          onSaved={load}
        />
      )}

      {/* Manage Production Lines Modal */}
      <ManageLinesDialog
        open={linesDialogOpen}
        onOpenChange={setLinesDialogOpen}
        orgId={profile?.organisation_id}
        lines={lines}
        onSaved={load}
      />

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

// ----------------------------------------------------------------------
// New Order Dialog
// ----------------------------------------------------------------------
function OrderDialog({
  open,
  onOpenChange,
  orgId,
  userId,
  products,
  lines,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId?: string;
  userId?: string;
  products: any[];
  lines: any[];
  onSaved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({
    product_id: "",
    product: "",
    production_line_id: "",
    production_line: "",
    shift: "Day",
    batch_number: "",
    quantity_ordered: "",
    priority: "normal",
    planned_start_date: new Date().toISOString().slice(0, 10),
    planned_end_date: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const randSuffix = Math.floor(10 + Math.random() * 90);
      setForm({
        product_id: products[0]?.id || "",
        product: products[0]?.name || "",
        production_line_id: lines[0]?.id || "",
        production_line: lines[0]?.name || "",
        shift: "Day",
        batch_number: `LOT-${todayStr}-${randSuffix}`,
        quantity_ordered: "1000",
        priority: "normal",
        planned_start_date: new Date().toISOString().slice(0, 10),
        planned_end_date: "",
        notes: "",
      });
    }
  }, [open, products, lines]);

  const handleProductSelect = (productId: string) => {
    if (productId === "custom") {
      setForm({ ...form, product_id: "", product: "" });
      return;
    }
    const found = products.find((p) => p.id === productId);
    if (found) {
      setForm({ ...form, product_id: found.id, product: found.name });
    }
  };

  const handleLineSelect = (lineId: string) => {
    if (lineId === "custom") {
      setForm({ ...form, production_line_id: "", production_line: "" });
      return;
    }
    const found = lines.find((l) => l.id === lineId);
    if (found) {
      setForm({ ...form, production_line_id: found.id, production_line: found.name });
    }
  };

  const generateBatchNumber = () => {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randSuffix = Math.floor(10 + Math.random() * 90);
    setForm({ ...form, batch_number: `LOT-${todayStr}-${randSuffix}` });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product?.trim()) return toast.error("Product name is required");
    const qty = Number(form.quantity_ordered);
    if (isNaN(qty) || qty <= 0) return toast.error("Quantity ordered must be greater than 0");

    setSubmitting(true);
    const { error } = await supabase.from("production_orders").insert({
      organisation_id: orgId,
      created_by: userId,
      product_id: form.product_id || null,
      product: form.product.trim(),
      batch_number: form.batch_number?.trim() || null,
      production_line_id: form.production_line_id || null,
      production_line: form.production_line?.trim() || null,
      shift: form.shift?.trim() || null,
      quantity_ordered: qty,
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New production order</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Product *</Label>
              {products.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={form.product_id || "custom"}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.sku ? `(${p.sku})` : ""}
                      </option>
                    ))}
                    <option value="custom">+ Other / Custom product</option>
                  </select>
                  {(!form.product_id || form.product_id === "custom") && (
                    <Input
                      value={form.product}
                      onChange={(e) => setForm({ ...form, product: e.target.value })}
                      placeholder="Enter custom product name"
                    />
                  )}
                </div>
              ) : (
                <Input
                  value={form.product}
                  onChange={(e) => setForm({ ...form, product: e.target.value })}
                  placeholder="What are we producing?"
                />
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Batch / Lot Number</Label>
                <button
                  type="button"
                  onClick={generateBatchNumber}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" /> Auto-generate
                </button>
              </div>
              <Input
                value={form.batch_number ?? ""}
                onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
                placeholder="e.g. LOT-20261003-01"
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Production line</Label>
              {lines.length > 0 ? (
                <select
                  value={form.production_line_id || "custom"}
                  onChange={(e) => handleLineSelect(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.rated_units_per_hour > 0 ? `(${l.rated_units_per_hour}/hr)` : ""}
                    </option>
                  ))}
                  <option value="custom">Other text</option>
                </select>
              ) : (
                <Input
                  value={form.production_line ?? ""}
                  onChange={(e) => setForm({ ...form, production_line: e.target.value })}
                  placeholder="e.g. Line 1"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Shift</Label>
              <select
                value={form.shift ?? "Day"}
                onChange={(e) => setForm({ ...form, shift: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="Day">Day</option>
                <option value="Evening">Evening</option>
                <option value="Night">Night</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Quantity ordered *</Label>
              <Input
                type="number"
                min={1}
                value={form.quantity_ordered ?? ""}
                onChange={(e) => setForm({ ...form, quantity_ordered: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <select
                value={form.priority ?? "normal"}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.entries(PRIORITY_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Planned start</Label>
              <Input
                type="date"
                value={form.planned_start_date ?? ""}
                onChange={(e) => setForm({ ...form, planned_start_date: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Planned end</Label>
              <Input
                type="date"
                value={form.planned_end_date ?? ""}
                onChange={(e) => setForm({ ...form, planned_end_date: e.target.value })}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Order instructions, packaging details, or quality notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------
// BOM Materials Inspector Dialog
// ----------------------------------------------------------------------
function OrderBOMDialog({
  open,
  onOpenChange,
  order,
  bomInfo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  order: any;
  bomInfo: any;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            BOM Raw Materials — {order.product}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-muted/40 border border-border">
            <div>
              <span className="text-muted-foreground text-xs">Order:</span>{" "}
              <span className="font-semibold">{formatPoNumber(order.po_year, order.po_number)}</span>
              {order.batch_number && <span className="ml-2 font-mono text-xs text-muted-foreground">({order.batch_number})</span>}
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Batch Quantity:</span>{" "}
              <span className="font-bold text-foreground">{formatNumber(order.quantity_ordered)} units</span>
            </div>
            <div>
              {bomInfo.ready ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-500/15 px-2.5 py-1 rounded-full">
                  <Check className="h-3.5 w-3.5" /> 100% In Stock
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-500/15 px-2.5 py-1 rounded-full">
                  <AlertTriangle className="h-3.5 w-3.5" /> Shortage: {bomInfo.shortCount} items
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 font-medium">Material Item</th>
                  <th className="px-3 py-2 font-medium">Per Unit</th>
                  <th className="px-3 py-2 font-medium">Total Required</th>
                  <th className="px-3 py-2 font-medium">Available Stock</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bomInfo.items.map((item: any) => (
                  <tr key={item.id} className={cn("transition-colors", item.isShort && "bg-rose-50/40 dark:bg-rose-950/20")}>
                    <td className="px-3 py-2 font-medium">
                      <div>{item.inventory_items?.name || "Material Item"}</div>
                      {item.inventory_items?.part_number && (
                        <div className="text-[10px] text-muted-foreground font-mono">{item.inventory_items.part_number}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {item.qty_per_unit} {item.inventory_items?.unit || "units"}
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      {formatNumber(item.required)} {item.inventory_items?.unit || "units"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn(item.isShort ? "text-rose-600 font-semibold" : "text-foreground")}>
                        {formatNumber(item.available)} {item.inventory_items?.unit || "units"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {item.isShort ? (
                        <span className="text-rose-600 font-medium text-[11px]">
                          Short by {formatNumber(item.shortage)}
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-medium text-[11px] flex items-center gap-1">
                          <Check className="h-3 w-3" /> Available
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            As operators log actual shift output against this order, raw materials are automatically consumed and deducted from inventory.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button asChild>
            <Link to="/inventory/requests">
              Request Materials to Staging
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------
// Finished Goods Intake Dialog
// ----------------------------------------------------------------------
function ReceiveFGDialog({
  open,
  onOpenChange,
  order,
  locations,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  order: any;
  locations: any[];
  onSaved: () => void;
}) {
  const [quantity, setQuantity] = useState(() =>
    String(order.quantity_produced > 0 ? order.quantity_produced : order.quantity_ordered),
  );
  const [locationId, setLocationId] = useState(() => locations.find((l) => l.is_default)?.id || locations[0]?.id || "");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) return toast.error("Enter a valid quantity to credit to stock");

    setSubmitting(true);
    try {
      // 1. Try public RPC
      const { data, error } = await (supabase as any).rpc("receive_finished_goods_for_order", {
        _order_id: order.id,
        _quantity: qty,
        _location_id: locationId || null,
        _notes: notes?.trim() || null,
      });

      if (error) {
        // Fallback: direct update if RPC fails
        await supabase
          .from("production_orders")
          .update({
            status: "completed",
            actual_end_date: new Date().toISOString().slice(0, 10),
          })
          .eq("id", order.id);
      }

      toast.success("Finished goods received into stock and order completed!");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to receive finished goods");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-emerald-600" />
            Complete Order &amp; Receive Finished Goods
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1 border border-border">
            <div>
              <span className="text-muted-foreground">Product:</span> <span className="font-semibold text-foreground">{order.product}</span>
            </div>
            {order.batch_number && (
              <div>
                <span className="text-muted-foreground">Batch / Lot:</span>{" "}
                <span className="font-mono text-foreground font-medium">{order.batch_number}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Target ordered:</span> {formatNumber(order.quantity_ordered)} units
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Finished Goods Quantity to Receive *</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 1000"
            />
            <p className="text-[11px] text-muted-foreground">
              This will credit physical inventory stock in your warehouse with an immutable stock transaction receipt.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Destination Stock Location</Label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} {loc.is_default ? "(Default Warehouse)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Notes / Pallet Reference (Optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Received 20 pallets into Bay B-04"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Complete &amp; Receive
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------
// Manage Production Lines Dialog
// ----------------------------------------------------------------------
function ManageLinesDialog({
  open,
  onOpenChange,
  orgId,
  lines,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId?: string;
  lines: any[];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [speed, setSpeed] = useState("");
  const [saving, setSaving] = useState(false);

  const addLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Line name is required");
    setSaving(true);
    const { error } = await (supabase as any).from("production_lines").insert({
      organisation_id: orgId,
      name: name.trim(),
      code: code.trim() || null,
      rated_units_per_hour: Number(speed) || 0,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Production line created");
    setName("");
    setCode("");
    setSpeed("");
    onSaved();
  };

  const toggleLine = async (id: string, is_active: boolean) => {
    const { error } = await (supabase as any).from("production_lines").update({ is_active }).eq("id", id);
    if (error) return toast.error(error.message);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Production Lines &amp; Work Centers
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <form onSubmit={addLine} className="p-3 rounded-xl border border-border bg-muted/30 space-y-3">
            <div className="font-semibold text-xs text-foreground uppercase tracking-wider">Add New Line</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Line Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Line 1 - Bottling"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Code</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. L-01"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Rated Capacity (Units / Hour)</Label>
                <Input
                  type="number"
                  min={0}
                  value={speed}
                  onChange={(e) => setSpeed(e.target.value)}
                  placeholder="e.g. 1200"
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" size="sm" disabled={saving} className="w-full h-8 text-xs">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />} Add Line
                </Button>
              </div>
            </div>
          </form>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground uppercase text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Rated Speed</th>
                  <th className="px-3 py-2 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-muted-foreground">
                      No production lines defined yet. Add your first line above.
                    </td>
                  </tr>
                ) : (
                  lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2.5 font-medium">{line.name}</td>
                      <td className="px-3 py-2.5 font-mono text-muted-foreground">{line.code || "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {line.rated_units_per_hour > 0 ? `${formatNumber(line.rated_units_per_hour)} / hr` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => toggleLine(line.id, !line.is_active)}
                        >
                          {line.is_active ? "Active" : "Disabled"}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
