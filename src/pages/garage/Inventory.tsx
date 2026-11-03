import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Boxes, Plus, Loader2, Pencil, ShoppingCart, Trash2, Layers, Sparkles } from "lucide-react";
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
    return items.filter(
      (i) =>
        i.name?.toLowerCase().includes(q) ||
        i.sku?.toLowerCase().includes(q) ||
        i.part_number?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q) ||
        i.vehicle_model?.toLowerCase().includes(q) ||
        i.brand?.toLowerCase().includes(q)
    );
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
          <Input placeholder="Search by name, SKU, model or category…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
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
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium">{i.name}</span>
                            {i.vehicle_model && (
                              <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                                {i.vehicle_model}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {i.sku && <span>SKU: {i.sku}</span>}
                            {i.brand && <span>· Brand: {i.brand}</span>}
                          </div>
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

interface VariantRow {
  model: string;
  sku: string;
  cost: string;
  selling_price: string;
  reorder_level: string;
  initial_stock: string;
}

function PartFormDialog({ open, setOpen, editing, orgId, userId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [quickInput, setQuickInput] = useState("");
  const [rows, setRows] = useState<VariantRow[]>([
    { model: "", sku: "", cost: "0", selling_price: "", reorder_level: "0", initial_stock: "0" },
  ]);

  const [form, setForm] = useState<any>({
    name: "",
    vehicle_model: "",
    sku: "",
    category: "",
    brand: "",
    unit: "pcs",
    item_type: "spare_part",
    unit_cost: "0",
    selling_price: "",
    reorder_level: "0",
    initial_stock: "0",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setMode("single");
      setQuickInput("");
      if (editing) {
        setForm({
          name: editing.name ?? "",
          vehicle_model: editing.vehicle_model ?? "",
          sku: editing.sku ?? "",
          category: editing.category ?? "",
          brand: editing.brand ?? "",
          unit: editing.unit ?? "pcs",
          item_type: editing.item_type ?? "spare_part",
          unit_cost: String(editing.unit_cost ?? 0),
          selling_price: editing.selling_price != null ? String(editing.selling_price) : "",
          reorder_level: String(editing.reorder_level ?? 0),
          initial_stock: "0",
          notes: editing.notes ?? "",
        });
      } else {
        setForm({
          name: "",
          vehicle_model: "",
          sku: "",
          category: "",
          brand: "",
          unit: "pcs",
          item_type: "spare_part",
          unit_cost: "0",
          selling_price: "",
          reorder_level: "0",
          initial_stock: "0",
          notes: "",
        });
        setRows([
          { model: "", sku: "", cost: "0", selling_price: "", reorder_level: "0", initial_stock: "0" },
        ]);
      }
    }
  }, [open, editing]);

  const handleGenerateRows = () => {
    if (!quickInput.trim()) return toast.error("Enter at least one vehicle model");
    const rawList = quickInput
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (rawList.length === 0) return toast.error("No valid models found");

    const newRows: VariantRow[] = rawList.map((modelName) => ({
      model: modelName,
      sku: "",
      cost: form.unit_cost || "0",
      selling_price: form.selling_price || "",
      reorder_level: form.reorder_level || "0",
      initial_stock: "0",
    }));

    // If the only existing row is empty, replace it; otherwise append
    const existingAreEmpty = rows.length === 1 && !rows[0].model.trim() && !rows[0].sku.trim();
    if (existingAreEmpty) {
      setRows(newRows);
    } else {
      setRows([...rows, ...newRows]);
    }
    setQuickInput("");
    toast.success(`Generated ${newRows.length} model rows`);
  };

  const updateRow = (index: number, patch: Partial<VariantRow>) => {
    setRows((curr) => curr.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) {
      setRows([{ model: "", sku: "", cost: form.unit_cost, selling_price: form.selling_price, reorder_level: form.reorder_level, initial_stock: "0" }]);
      return;
    }
    setRows((curr) => curr.filter((_, i) => i !== index));
  };

  const addEmptyRow = () => {
    setRows((curr) => [
      ...curr,
      { model: "", sku: "", cost: form.unit_cost || "0", selling_price: form.selling_price || "", reorder_level: form.reorder_level || "0", initial_stock: "0" },
    ]);
  };

  const submitSingle = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      vehicle_model: form.vehicle_model.trim() || null,
      sku: form.sku.trim() || null,
      category: form.category.trim() || null,
      brand: form.brand.trim() || null,
      unit: form.unit.trim() || "pcs",
      item_type: form.item_type,
      unit_cost: Number(form.unit_cost) || 0,
      selling_price: form.selling_price === "" ? null : Number(form.selling_price),
      reorder_level: Number(form.reorder_level) || 0,
      notes: form.notes.trim() || null,
    };

    if (editing) {
      const { error } = await supabase.from("inventory_items").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Part updated");
    } else {
      const { data: item, error } = await supabase
        .from("inventory_items")
        .insert({ ...payload, organisation_id: orgId })
        .select()
        .single();
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
      const initial = Number(form.initial_stock) || 0;
      if (initial > 0) {
        const { data: loc } = await (supabase as any)
          .from("stock_locations")
          .select("id")
          .eq("organisation_id", orgId)
          .eq("is_default", true)
          .maybeSingle();
        if (loc) {
          await (supabase as any).rpc("record_stock_transaction", {
            _item_id: item.id,
            _location_id: loc.id,
            _transaction_type: "receipt",
            _quantity: initial,
            _reason: "Initial stock",
          });
        }
      }
      setSaving(false);
      toast.success("Part added");
    }
    setOpen(false);
    onSaved();
  };

  const submitBatch = async () => {
    const baseName = form.name.trim();
    if (!baseName) return toast.error("Base part name is required (e.g. Brake Pad)");

    const validRows = rows.filter((r) => r.model.trim() || r.sku.trim());
    if (validRows.length === 0) {
      return toast.error("Add at least one model or SKU in the table");
    }

    setSaving(true);

    const payloads = validRows.map((r) => {
      const model = r.model.trim();
      const sku = r.sku.trim();
      const fullName = model ? `${baseName} - ${model}` : `${baseName} (${sku})`;

      return {
        name: fullName,
        vehicle_model: model || null,
        sku: sku || null,
        part_number: sku || null,
        category: form.category.trim() || null,
        brand: form.brand.trim() || null,
        unit: form.unit.trim() || "pcs",
        item_type: form.item_type,
        unit_cost: Number(r.cost || form.unit_cost) || 0,
        selling_price:
          r.selling_price === ""
            ? form.selling_price === ""
              ? null
              : Number(form.selling_price)
            : Number(r.selling_price),
        reorder_level: Number(r.reorder_level || form.reorder_level) || 0,
        notes: form.notes.trim() || null,
        organisation_id: orgId,
      };
    });

    const { data: insertedItems, error } = await supabase
      .from("inventory_items")
      .insert(payloads)
      .select("id, name");

    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    // Process initial stock receipts for rows with initial stock > 0
    const hasInitialStock = validRows.some((r) => Number(r.initial_stock) > 0);
    if (hasInitialStock && insertedItems && insertedItems.length > 0) {
      const { data: loc } = await (supabase as any)
        .from("stock_locations")
        .select("id")
        .eq("organisation_id", orgId)
        .eq("is_default", true)
        .maybeSingle();

      if (loc) {
        const stockPromises = insertedItems.map((item, idx) => {
          const qty = Number(validRows[idx]?.initial_stock) || 0;
          if (qty > 0) {
            return (supabase as any).rpc("record_stock_transaction", {
              _item_id: item.id,
              _location_id: loc.id,
              _transaction_type: "receipt",
              _quantity: qty,
              _reason: "Initial stock batch",
            });
          }
          return Promise.resolve();
        });
        await Promise.all(stockPromises);
      }
    }

    setSaving(false);
    toast.success(`Successfully added ${insertedItems?.length ?? payloads.length} models of "${baseName}"!`);
    setOpen(false);
    onSaved();
  };

  const totalBatchStock = rows.reduce((sum, r) => sum + (Number(r.initial_stock) || 0), 0);
  const validRowCount = rows.filter((r) => r.model.trim() || r.sku.trim()).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className={mode === "batch" && !editing ? "max-w-4xl max-h-[90vh] overflow-y-auto" : "max-w-lg max-h-[85vh] overflow-y-auto"}>
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <DialogTitle>
              {editing ? "Edit part" : mode === "batch" ? "Add part with multiple models / SKUs" : "Add part"}
            </DialogTitle>
            {!editing && (
              <div className="flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setMode("single")}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    mode === "single" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Single part
                </button>
                <button
                  type="button"
                  onClick={() => setMode("batch")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${
                    mode === "batch" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Multiple models (Batch)
                </button>
              </div>
            )}
          </div>
        </DialogHeader>

        {mode === "single" || editing ? (
          <div className="grid gap-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1"
                placeholder="e.g. Brake Pad or Toyota Oil Filter"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vehicle model / fitment</Label>
                <Input
                  value={form.vehicle_model}
                  onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })}
                  className="mt-1"
                  placeholder="e.g. Toyota Hilux 2016-2022"
                />
              </div>
              <div>
                <Label>SKU / part number</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="mt-1"
                  placeholder="e.g. BP-TY-01"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Brand</Label>
                <Input
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  className="mt-1"
                  placeholder="e.g. Bosch, OEM, Brembo"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-1"
                  placeholder="e.g. Brakes, Engine, Suspension"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <select
                  value={form.item_type}
                  onChange={(e) => setForm({ ...form, item_type: e.target.value })}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Unit</Label>
                <Input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="mt-1"
                  placeholder="pcs, set, pair"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cost price</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.unit_cost}
                  onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Selling price</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.selling_price}
                  onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Minimum stock</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.reorder_level}
                  onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
                  className="mt-1"
                />
              </div>
              {!editing && (
                <div>
                  <Label>Initial stock</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.initial_stock}
                    onChange={(e) => setForm({ ...form, initial_stock: e.target.value })}
                    className="mt-1"
                  />
                </div>
              )}
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-1"
                placeholder="Optional notes, specifications or shelf location..."
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step 1: Base Part Shared Information */}
            <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                1. Shared Part Information (applies to all models)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <Label>Base part name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1"
                    placeholder="e.g. Brake Pad, Oil Filter, Wiper"
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="mt-1"
                    placeholder="e.g. Brakes, Engine, Filtration"
                  />
                </div>
                <div>
                  <Label>Brand</Label>
                  <Input
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="mt-1"
                    placeholder="e.g. Bosch, OEM, Brembo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label>Unit</Label>
                  <Input
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="mt-1"
                    placeholder="set, pcs, pair"
                  />
                </div>
                <div>
                  <Label>Default cost price</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.unit_cost}
                    onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
                    className="mt-1"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Default selling price</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.selling_price}
                    onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                    className="mt-1"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Default min stock</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.reorder_level}
                    onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
                    className="mt-1"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Quick Model Generator */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Quick-Add Vehicle Models (Paste or comma-separated)
              </div>
              <p className="text-xs text-muted-foreground">
                Paste your vehicle models separated by commas or new lines. They will automatically populate as individual rows in the table below.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Input
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  placeholder="e.g. Toyota Hilux, Toyota Prado, Nissan Patrol, Isuzu D-Max, Mitsubishi Pajero"
                  className="flex-1 bg-background"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleGenerateRows();
                    }
                  }}
                />
                <Button type="button" variant="secondary" onClick={handleGenerateRows} className="shrink-0">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Generate Rows
                </Button>
              </div>
            </div>

            {/* Step 3: Models & SKUs Matrix Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  2. Models, SKUs &amp; Quantities ({validRowCount} configured)
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addEmptyRow}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add row
                </Button>
              </div>

              <div className="max-h-[300px] overflow-x-auto overflow-y-auto rounded-lg border border-border bg-card">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80 text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium min-w-[180px]">Vehicle Model *</th>
                      <th className="px-3 py-2 text-left font-medium min-w-[130px]">SKU / Part #</th>
                      <th className="px-3 py-2 text-left font-medium min-w-[90px]">Cost</th>
                      <th className="px-3 py-2 text-left font-medium min-w-[90px]">Sell Price</th>
                      <th className="px-3 py-2 text-left font-medium min-w-[80px]">Initial Stock</th>
                      <th className="px-3 py-2 text-left font-medium min-w-[80px]">Min Stock</th>
                      <th className="px-2 py-2 text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/40 transition-colors">
                        <td className="p-2">
                          <Input
                            value={row.model}
                            onChange={(e) => updateRow(idx, { model: e.target.value })}
                            placeholder="e.g. Toyota Hilux 2016+"
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={row.sku}
                            onChange={(e) => updateRow(idx, { sku: e.target.value })}
                            placeholder="e.g. BP-TY-01"
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={0}
                            value={row.cost}
                            onChange={(e) => updateRow(idx, { cost: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={0}
                            value={row.selling_price}
                            onChange={(e) => updateRow(idx, { selling_price: e.target.value })}
                            placeholder={form.selling_price || "0"}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={0}
                            value={row.initial_stock}
                            onChange={(e) => updateRow(idx, { initial_stock: e.target.value })}
                            className="h-8 text-xs font-semibold"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={0}
                            value={row.reorder_level}
                            onChange={(e) => updateRow(idx, { reorder_level: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRow(idx)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalBatchStock > 0 && (
                <div className="text-right text-xs text-muted-foreground">
                  Total initial stock across all models: <span className="font-semibold text-foreground">{totalBatchStock} {form.unit || "pcs"}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={mode === "batch" && !editing ? submitBatch : submitSingle}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : editing ? (
              "Save changes"
            ) : mode === "batch" ? (
              `Save all ${validRowCount > 0 ? validRowCount : ""} models`
            ) : (
              "Add part"
            )}
          </Button>
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
