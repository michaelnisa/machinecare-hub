import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ShoppingCart, Plus, Loader2, CheckCircle2, XCircle, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatNumber } from "@/lib/format";
import { useSearchParams } from "react-router-dom";

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  converted_to_po: "bg-blue-100 text-blue-700",
  cancelled: "bg-slate-100 text-slate-600",
};

export default function PurchaseRequests() {
  const { profile, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [filter, setFilter] = useState("pending");
  const [open, setOpen] = useState(false);
  const [convertTarget, setConvertTarget] = useState<any>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("purchase_requests")
      .select("*, purchase_request_items(*, inventory_items(name, part_number, unit))")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRequests(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);
  useEffect(() => { if (searchParams.get("new") === "1") setOpen(true); }, [searchParams]);

  const filtered = useMemo(() => filter === "all" ? requests : requests.filter((r) => r.status === filter), [requests, filter]);

  const totalOf = (r: any) => (r.purchase_request_items ?? []).reduce((s: number, it: any) => s + Number(it.quantity) * Number(it.estimated_unit_price ?? 0), 0);

  const review = async (id: string, decision: "approved" | "rejected") => {
    const { error } = await (supabase as any).rpc("review_purchase_request", { _pr_id: id, _decision: decision });
    if (error) return toast.error(error.message);
    toast.success(decision === "approved" ? "Approved" : "Rejected");
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Purchase requests</h1>
          <p className="text-sm text-muted-foreground">What needs buying, and why.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />New request</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", "pending", "approved", "rejected", "converted_to_po", "cancelled"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${filter === s ? "bg-primary text-primary-foreground" : "border-border bg-card"}`}>
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ShoppingCart className="h-5 w-5" />} title="No purchase requests" description="Nothing here right now." />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">PR-{r.pr_year}-{String(r.pr_number).padStart(4, "0")}</div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_CLASS[r.status]}`}>{r.status.replace(/_/g, " ")}</span>
                  {r.status === "pending" && (
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={() => review(r.id, "approved")} className="gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => review(r.id, "rejected")}><XCircle className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                  {r.status === "approved" && (
                    <Button size="sm" variant="outline" onClick={() => setConvertTarget(r)} className="gap-1.5">
                      Convert to PO <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {r.department && `${r.department} · `}priority {r.priority}{r.required_date && ` · needed by ${r.required_date}`} · est. total {formatMoney(totalOf(r))}
              </div>
              {r.reason && <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>}
              <div className="mt-2 space-y-1">
                {(r.purchase_request_items ?? []).map((it: any) => (
                  <div key={it.id} className="rounded bg-muted/40 px-2 py-1 text-xs">
                    {it.inventory_items?.name ?? it.item_description} — {formatNumber(it.quantity)} {it.inventory_items?.unit ?? ""}
                    {it.estimated_unit_price != null && ` @ ${formatMoney(it.estimated_unit_price)}`}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewRequestDialog open={open} setOpen={setOpen} userId={user?.id} orgId={profile?.organisation_id} onSaved={load} />
      <ConvertToPoDialog request={convertTarget} onClose={() => setConvertTarget(null)} onSaved={load} />
    </div>
  );
}

function NewRequestDialog({ open, setOpen, userId, orgId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ department: "", reason: "", priority: "normal", required_date: "" });
  const [rows, setRows] = useState<{ item_id: string; quantity: string; estimated_unit_price: string }[]>([{ item_id: "", quantity: "1", estimated_unit_price: "" }]);

  useEffect(() => {
    if (open) {
      setForm({ department: "", reason: "", priority: "normal", required_date: "" });
      setRows([{ item_id: "", quantity: "1", estimated_unit_price: "" }]);
      supabase.from("inventory_items").select("id, name, part_number, unit, unit_cost").order("name").then(({ data }) => setItems(data ?? []));
    }
  }, [open]);

  const updateRow = (i: number, patch: any) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const submit = async () => {
    const valid = rows.filter((r) => r.item_id && Number(r.quantity) > 0);
    if (valid.length === 0) return toast.error("Add at least one item");
    setSaving(true);
    const { data: req, error } = await (supabase as any).from("purchase_requests").insert({
      organisation_id: orgId,
      requested_by: userId,
      department: form.department || null,
      reason: form.reason || null,
      priority: form.priority,
      required_date: form.required_date || null,
      status: "pending",
    }).select().single();
    if (error || !req) { setSaving(false); return toast.error(error?.message ?? "Failed"); }

    const itemRows = valid.map((r) => ({
      purchase_request_id: req.id,
      item_id: r.item_id,
      quantity: Number(r.quantity),
      estimated_unit_price: r.estimated_unit_price === "" ? null : Number(r.estimated_unit_price),
    }));
    const { error: itemsErr } = await (supabase as any).from("purchase_request_items").insert(itemRows);
    setSaving(false);
    if (itemsErr) return toast.error(itemsErr.message);
    toast.success("Purchase request submitted");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New purchase request</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="mt-1" /></div>
            <div><Label>Priority</Label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {["low", "normal", "high", "critical"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div><Label>Required by</Label><Input type="date" value={form.required_date} onChange={(e) => setForm({ ...form, required_date: e.target.value })} className="mt-1" /></div>
          <div><Label>Reason</Label><Textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="mt-1" /></div>

          <Label>Items</Label>
          {rows.map((row, i) => (
            <div key={i} className="flex items-start gap-2">
              <select value={row.item_id} onChange={(e) => {
                const it = items.find((x) => x.id === e.target.value);
                updateRow(i, { item_id: e.target.value, estimated_unit_price: it ? String(it.unit_cost ?? "") : "" });
              }} className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select part…</option>
                {items.map((it: any) => <option key={it.id} value={it.id}>{it.name}{it.part_number ? ` · ${it.part_number}` : ""}</option>)}
              </select>
              <Input type="number" min={1} value={row.quantity} onChange={(e) => updateRow(i, { quantity: e.target.value })} className="w-20" placeholder="Qty" />
              <Input type="number" min={0} value={row.estimated_unit_price} onChange={(e) => updateRow(i, { estimated_unit_price: e.target.value })} className="w-28" placeholder="Unit price" />
              {rows.length > 1 && (
                <Button size="icon" variant="ghost" onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setRows((r) => [...r, { item_id: "", quantity: "1", estimated_unit_price: "" }])}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add another item
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit request"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvertToPoDialog({ request, onClose, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ supplier_id: "", delivery_date: "", payment_terms: "" });

  useEffect(() => {
    if (request) {
      setForm({ supplier_id: "", delivery_date: "", payment_terms: "" });
      supabase.from("suppliers" as any).select("id, name").eq("active", true).order("name").then(({ data }: any) => setSuppliers(data ?? []));
    }
  }, [request]);

  if (!request) return null;

  const submit = async () => {
    if (!form.supplier_id) return toast.error("Select a supplier");
    setSaving(true);
    const { data, error } = await (supabase as any).rpc("convert_purchase_request_to_po", {
      _pr_id: request.id,
      _supplier_id: form.supplier_id,
      _delivery_date: form.delivery_date || null,
      _payment_terms: form.payment_terms || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Converted to purchase order");
    onClose();
    onSaved();
  };

  return (
    <Dialog open={!!request} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Convert to purchase order</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Supplier *</Label>
            <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select…</option>
              {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Delivery date</Label><Input type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} className="mt-1" /></div>
            <div><Label>Payment terms</Label><Input value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} className="mt-1" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Convert"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
