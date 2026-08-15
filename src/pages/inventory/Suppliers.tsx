import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Building2, Plus, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";

export default function Suppliers() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [perf, setPerf] = useState<Record<string, { orders: number; spend: number; onTimePct: number | null }>>({});
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: s, error: e1 }, { data: pos, error: e2 }, { data: items }] = await Promise.all([
      (supabase as any).from("suppliers").select("*").order("name"),
      (supabase as any).from("purchase_orders").select("id, supplier_id, status, delivery_date, created_at").in("status", ["received", "partially_received", "sent"]),
      (supabase as any).from("purchase_order_items").select("purchase_order_id, quantity, unit_price"),
    ]);
    const err = e1 || e2;
    if (err) toast.error(err.message);
    setSuppliers(s ?? []);

    const spendByPo: Record<string, number> = {};
    (items ?? []).forEach((it: any) => { spendByPo[it.purchase_order_id] = (spendByPo[it.purchase_order_id] ?? 0) + Number(it.quantity) * Number(it.unit_price); });

    const p: Record<string, { orders: number; spend: number; onTime: number; delivered: number }> = {};
    (pos ?? []).forEach((po: any) => {
      const e = p[po.supplier_id] ?? { orders: 0, spend: 0, onTime: 0, delivered: 0 };
      e.orders += 1;
      e.spend += spendByPo[po.id] ?? 0;
      p[po.supplier_id] = e;
    });
    const out: Record<string, { orders: number; spend: number; onTimePct: number | null }> = {};
    Object.entries(p).forEach(([id, e]) => { out[id] = { orders: e.orders, spend: e.spend, onTimePct: null }; });
    setPerf(out);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Who supplies parts and materials — distinct from Vendors (outsourced repair shops).</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Add supplier</Button>
      </div>

      {suppliers.length === 0 ? (
        <EmptyState icon={<Building2 className="h-5 w-5" />} title="No suppliers yet" description="Add a supplier to start creating purchase orders." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => {
            const p = perf[s.id];
            return (
              <div key={s.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{s.name}</div>
                  {s.rating != null && (
                    <span className="flex items-center gap-1 text-xs text-amber-600"><Star className="h-3 w-3 fill-current" /> {s.rating}</span>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{s.contact_name}{s.phone && ` · ${s.phone}`}</div>
                {s.categories?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.categories.map((c: string) => <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{c}</span>)}
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>{p?.orders ?? 0} orders</div>
                  <div>{formatMoney(p?.spend ?? 0)} spend</div>
                  <div>Lead time: {s.lead_time_days ?? "—"}d</div>
                  <div>Terms: {s.payment_terms ?? "—"}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewSupplierDialog open={open} setOpen={setOpen} userId={user?.id} orgId={profile?.organisation_id} onSaved={load} />
    </div>
  );
}

function NewSupplierDialog({ open, setOpen, userId, orgId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ name: "", contact_name: "", phone: "", email: "", address: "", categories: "", payment_terms: "", currency: "TZS", lead_time_days: "", notes: "" });

  useEffect(() => { if (open) setForm({ name: "", contact_name: "", phone: "", email: "", address: "", categories: "", payment_terms: "", currency: "TZS", lead_time_days: "", notes: "" }); }, [open]);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    setSaving(true);
    const { error } = await (supabase as any).from("suppliers").insert({
      organisation_id: orgId,
      name: form.name.trim(),
      contact_name: form.contact_name || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      categories: form.categories.split(",").map((s: string) => s.trim()).filter(Boolean),
      payment_terms: form.payment_terms || null,
      currency: form.currency || "TZS",
      lead_time_days: form.lead_time_days === "" ? null : Number(form.lead_time_days),
      notes: form.notes || null,
      created_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Supplier added");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add supplier</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Contact name</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="mt-1" /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" /></div>
            <div><Label>Categories (comma-separated)</Label><Input value={form.categories} onChange={(e) => setForm({ ...form, categories: e.target.value })} className="mt-1" placeholder="Bearings, Electrical" /></div>
          </div>
          <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Payment terms</Label><Input value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} className="mt-1" placeholder="Net 30" /></div>
            <div><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="mt-1" /></div>
            <div><Label>Lead time (days)</Label><Input type="number" value={form.lead_time_days} onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })} className="mt-1" /></div>
          </div>
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
