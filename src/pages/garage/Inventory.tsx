import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Boxes, Plus, Loader2, Pencil, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatNumber, formatDate } from "@/lib/format";

const ITEM_TYPES = ["spare_part", "consumable", "tool", "other"];

export default function GarageInventory() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"parts" | "purchases">("parts");
  const [items, setItems] = useState<any[]>([]);
  const [available, setAvailable] = useState<Record<string, number>>({});
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: i, error: e1 }, { data: b, error: e2 }, { data: s, error: e3 }, { data: po, error: e4 }] = await Promise.all([
      supabase.from("inventory_items").select("*").eq("status", "active").order("name"),
      (supabase as any).from("stock_balances").select("item_id, available_stock"),
      (supabase as any).from("suppliers").select("id, name").eq("active", true).order("name"),
      (supabase as any).from("purchase_orders").select("*, suppliers(name), purchase_order_items(quantity, unit_price)").order("created_at", { ascending: false }).limit(50),
    ]);
    const err = e1 || e2 || e3 || e4;
    if (err) toast.error(err.message);
    setItems(i ?? []);
    const av: Record<string, number> = {};
    (b ?? []).forEach((row: any) => { av[row.item_id] = (av[row.item_id] ?? 0) + Number(row.available_stock); });
    setAvailable(av);
    setSuppliers(s ?? []);
    setPurchases(po ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((i) => i.name?.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q) || i.part_number?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q));
  }, [items, search]);

  const lowStock = useMemo(() => items.filter((i) => (available[i.id] ?? 0) <= Number(i.reorder_level ?? 0)), [items, available]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Parts &amp; stock</h1>
          <p className="text-sm text-muted-foreground">Parts, consumables and tools — what you have, what it costs, and what to charge.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPurchaseOpen(true)}><ShoppingCart className="mr-2 h-4 w-4" />Record purchase</Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="mr-2 h-4 w-4" />Add part</Button>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {lowStock.length} item{lowStock.length === 1 ? "" : "s"} at or below minimum stock: {lowStock.slice(0, 5).map((i) => i.name).join(", ")}{lowStock.length > 5 ? "…" : ""}
        </div>
      )}

      <div className="flex gap-1.5">
        {[{ value: "parts", label: "Parts" }, { value: "purchases", label: "Purchase history" }].map((t) => (
          <button key={t.value} onClick={() => setTab(t.value as any)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${tab === t.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted/60"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "parts" ? (
        <>
          <Input placeholder="Search by name, SKU or category…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          {filtered.length === 0 ? (
            <EmptyState icon={<Boxes className="h-5 w-5" />} title={items.length === 0 ? "No parts added yet" : "No matches"} description={items.length === 0 ? "Add your commonly used parts so MachineCare can track stock and job costs." : "Try a different search."} />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Part</th>
                    <th className="px-5 py-3 font-medium">Category</th>
                    <th className="px-5 py-3 font-medium">Stock</th>
                    <th className="px-5 py-3 font-medium">Cost</th>
                    <th className="px-5 py-3 font-medium">Sell price</th>
                    <th className="px-5 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => {
                    const stock = available[i.id] ?? 0;
                    const low = stock <= Number(i.reorder_level ?? 0);
                    return (
                      <tr key={i.id} className="border-t border-border">
                        <td className="px-5 py-3">
                          <div className="font-medium">{i.name}</div>
                          {i.sku && <div className="text-xs text-muted-foreground">{i.sku}</div>}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{i.category ?? "—"}</td>
                        <td className="px-5 py-3">
                          <span className={low ? "font-medium text-red-600" : ""}>{formatNumber(stock)} {i.unit}</span>
                          {low && <span className="ml-1.5 text-xs text-muted-foreground">(min {formatNumber(i.reorder_level)})</span>}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{formatMoney(i.unit_cost)}</td>
                        <td className="px-5 py-3">{i.selling_price != null ? formatMoney(i.selling_price) : "—"}</td>
                        <td className="px-5 py-3 text-right">
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(i); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        purchases.length === 0 ? (
          <EmptyState icon={<ShoppingCart className="h-5 w-5" />} title="No purchases recorded" description="Record a purchase when you buy parts from a supplier." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Supplier</th>
                  <th className="px-5 py-3 font-medium">Items</th>
                  <th className="px-5 py-3 font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((po: any) => {
                  const total = (po.purchase_order_items ?? []).reduce((s: number, it: any) => s + Number(it.quantity) * Number(it.unit_price), 0);
                  return (
                    <tr key={po.id} className="border-t border-border">
                      <td className="px-5 py-3 text-muted-foreground">{formatDate(po.created_at)}</td>
                      <td className="px-5 py-3">{po.suppliers?.name ?? "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{(po.purchase_order_items ?? []).length}</td>
                      <td className="px-5 py-3">{formatMoney(total)}</td>
                      <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${po.status === "received" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{po.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      <PartFormDialog open={formOpen} setOpen={setFormOpen} editing={editing} orgId={profile?.organisation_id} userId={user?.id} onSaved={load} />
      <RecordPurchaseDialog open={purchaseOpen} setOpen={setPurchaseOpen} items={items} suppliers={suppliers} onSaved={load} />
    </div>
  );
}

function PartFormDialog({ open, setOpen, editing, orgId, userId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ name: "", sku: "", category: "", brand: "", unit: "pcs", item_type: "spare_part", unit_cost: "0", selling_price: "", reorder_level: "0", initial_stock: "0", notes: "" });

  useEffect(() => {
    if (open) {
      setForm(editing ? {
        name: editing.name ?? "", sku: editing.sku ?? "", category: editing.category ?? "", brand: editing.brand ?? "",
        unit: editing.unit ?? "pcs", item_type: editing.item_type ?? "spare_part", unit_cost: String(editing.unit_cost ?? 0),
        selling_price: editing.selling_price != null ? String(editing.selling_price) : "", reorder_level: String(editing.reorder_level ?? 0), initial_stock: "0", notes: editing.notes ?? "",
      } : { name: "", sku: "", category: "", brand: "", unit: "pcs", item_type: "spare_part", unit_cost: "0", selling_price: "", reorder_level: "0", initial_stock: "0", notes: "" });
    }
  }, [open, editing]);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload = {
      name: form.name.trim(), sku: form.sku.trim() || null, category: form.category.trim() || null, brand: form.brand.trim() || null,
      unit: form.unit.trim() || "pcs", item_type: form.item_type, unit_cost: Number(form.unit_cost) || 0,
      selling_price: form.selling_price === "" ? null : Number(form.selling_price), reorder_level: Number(form.reorder_level) || 0, notes: form.notes.trim() || null,
    };
    if (editing) {
      const { error } = await supabase.from("inventory_items").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Part updated");
    } else {
      const { data: item, error } = await supabase.from("inventory_items").insert({ ...payload, organisation_id: orgId }).select().single();
      if (error) { setSaving(false); return toast.error(error.message); }
      const initial = Number(form.initial_stock) || 0;
      if (initial > 0) {
        const { data: loc } = await (supabase as any).from("stock_locations").select("id").eq("organisation_id", orgId).eq("is_default", true).maybeSingle();
        if (loc) {
          await (supabase as any).rpc("record_stock_transaction", {
            _item_id: item.id, _location_id: loc.id, _transaction_type: "receipt", _quantity: initial, _reason: "Initial stock",
          });
        }
      }
      setSaving(false);
      toast.success("Part added");
    }
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit part" : "Add part"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" placeholder="Toyota Oil Filter" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>SKU / part number</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="mt-1" /></div>
            <div><Label>Brand</Label><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1" placeholder="Engine, Brakes…" /></div>
            <div><Label>Type</Label>
              <select value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {ITEM_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Cost price</Label><Input type="number" min={0} value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} className="mt-1" /></div>
            <div><Label>Selling price</Label><Input type="number" min={0} value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} className="mt-1" /></div>
            <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Minimum stock</Label><Input type="number" min={0} value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} className="mt-1" /></div>
            {!editing && <div><Label>Initial stock</Label><Input type="number" min={0} value={form.initial_stock} onChange={(e) => setForm({ ...form, initial_stock: e.target.value })} className="mt-1" /></div>}
          </div>
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

function RecordPurchaseDialog({ open, setOpen, items, suppliers, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [received, setReceived] = useState(true);
  const [rows, setRows] = useState<{ item_id: string; quantity: string; unit_price: string }[]>([{ item_id: "", quantity: "1", unit_price: "0" }]);

  useEffect(() => {
    if (open) { setSupplierId(suppliers[0]?.id ?? ""); setReceived(true); setRows([{ item_id: "", quantity: "1", unit_price: "0" }]); }
  }, [open]);

  const updateRow = (i: number, patch: any) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const addRow = () => setRows((r) => [...r, { item_id: "", quantity: "1", unit_price: "0" }]);

  const submit = async () => {
    if (!supplierId) return toast.error("Select a supplier");
    const valid = rows.filter((r) => r.item_id && Number(r.quantity) > 0);
    if (valid.length === 0) return toast.error("Add at least one item");
    setSaving(true);
    const { error } = await (supabase as any).rpc("record_garage_purchase", {
      _supplier_id: supplierId,
      _items: valid.map((r) => ({ item_id: r.item_id, quantity: Number(r.quantity), unit_price: Number(r.unit_price) || 0 })),
      _received: received,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Purchase recorded");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Record purchase</DialogTitle></DialogHeader>
        {suppliers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add a supplier first.</p>
        ) : (
          <div className="grid gap-3">
            <div><Label>Supplier *</Label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <Label>Items</Label>
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr,60px,90px] gap-2">
                <select value={row.item_id} onChange={(e) => updateRow(i, { item_id: e.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="">Select part…</option>
                  {items.map((it: any) => <option key={it.id} value={it.id}>{it.name}</option>)}
                </select>
                <Input type="number" min={0} value={row.quantity} onChange={(e) => updateRow(i, { quantity: e.target.value })} className="h-9" placeholder="Qty" />
                <Input type="number" min={0} value={row.unit_price} onChange={(e) => updateRow(i, { unit_price: e.target.value })} className="h-9" placeholder="Cost" />
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={addRow}><Plus className="mr-1.5 h-3.5 w-3.5" /> Add row</Button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={received} onChange={(e) => setReceived(e.target.checked)} />
              Already received — add to stock now
            </label>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || suppliers.length === 0}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
