import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Building2, Plus, Loader2, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";

export default function GarageSuppliers() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [spend, setSpend] = useState<Record<string, { orders: number; total: number }>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: s, error: e1 }, { data: pos, error: e2 }, { data: items, error: e3 }] = await Promise.all([
      (supabase as any).from("suppliers").select("*").order("name"),
      (supabase as any).from("purchase_orders").select("id, supplier_id"),
      (supabase as any).from("purchase_order_items").select("purchase_order_id, quantity, unit_price"),
    ]);
    const err = e1 || e2 || e3;
    if (err) toast.error(err.message);
    setSuppliers(s ?? []);

    const spendByPo: Record<string, number> = {};
    (items ?? []).forEach((it: any) => { spendByPo[it.purchase_order_id] = (spendByPo[it.purchase_order_id] ?? 0) + Number(it.quantity) * Number(it.unit_price); });
    const bySupplier: Record<string, { orders: number; total: number }> = {};
    (pos ?? []).forEach((po: any) => {
      const e = bySupplier[po.supplier_id] ?? { orders: 0, total: 0 };
      e.orders += 1; e.total += spendByPo[po.id] ?? 0;
      bySupplier[po.supplier_id] = e;
    });
    setSpend(bySupplier);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Who you buy parts from, and how much you've spent with them.</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="mr-2 h-4 w-4" />Add supplier</Button>
      </div>

      {suppliers.length === 0 ? (
        <EmptyState icon={<Building2 className="h-5 w-5" />} title="No suppliers yet" description="Add the shops and distributors you buy parts from." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => {
            const sp = spend[s.id];
            return (
              <button key={s.id} onClick={() => { setEditing(s); setFormOpen(true); }} className="rounded-xl border border-border bg-card p-4 text-left hover:border-primary/50">
                <div className="font-medium">{s.name}</div>
                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {s.phone && <div className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</div>}
                  {s.email && <div className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{s.email}</div>}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">{sp?.orders ?? 0} purchase{sp?.orders === 1 ? "" : "s"} · {formatMoney(sp?.total ?? 0)} total</div>
              </button>
            );
          })}
        </div>
      )}

      <SupplierFormDialog open={formOpen} setOpen={setFormOpen} editing={editing} orgId={profile?.organisation_id} userId={user?.id} onSaved={load} />
    </div>
  );
}

function SupplierFormDialog({ open, setOpen, editing, orgId, userId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", notes: "" });

  useEffect(() => {
    if (open) setForm(editing ? { name: editing.name ?? "", phone: editing.phone ?? "", email: editing.email ?? "", address: editing.address ?? "", notes: editing.notes ?? "" } : { name: "", phone: "", email: "", address: "", notes: "" });
  }, [open, editing]);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload = { name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null, address: form.address.trim() || null, notes: form.notes.trim() || null };
    const { error } = editing
      ? await (supabase as any).from("suppliers").update(payload).eq("id", editing.id)
      : await (supabase as any).from("suppliers").insert({ ...payload, organisation_id: orgId, created_by: userId });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Supplier updated" : "Supplier added");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Edit supplier" : "Add supplier"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" /></div>
          </div>
          <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1" /></div>
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
