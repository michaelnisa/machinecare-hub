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
import { ConfirmDialog } from "@/components/ConfirmDialog";

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
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", confirmDelete.id);
    if (error) {
      // If foreign key constraint or dependency, fallback to archiving so historical records stay intact
      const { error: softErr } = await supabase.from("inventory_items").update({ status: "archived" }).eq("id", confirmDelete.id);
      if (softErr) {
        toast.error(error.message);
        return;
      }
      toast.success("Part archived and removed from active inventory");
    } else {
      toast.success("Part deleted");
    }
    setConfirmDelete(null);
    load();
  };

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
                    const modelBadge = i.vehicle_model || (i.name?.includes(" - ") ? i.name.split(" - ").slice(1).join(" - ").trim() : null);
                    return (
                      <tr key={i.id} className="border-t border-border">
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium">{i.name}</span>
                            {modelBadge && (
                              <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                                {modelBadge}
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
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditing(i); setFormOpen(true); }} title="Edit part">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setConfirmDelete(i)}
                              title="Delete part"
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      <PartFormDialog
        open={formOpen}
        setOpen={setFormOpen}
        editing={editing}
        orgId={profile?.organisation_id}
        userId={user?.id}
        onSaved={load}
        onDelete={(item: any) => {
          setConfirmDelete(item);
          setFormOpen(false);
        }}
      />
      <RecordPurchaseDialog open={purchaseOpen} setOpen={setPurchaseOpen} items={items} suppliers={suppliers} onSaved={load} />
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.name ?? "part"}?`}
        description="Are you sure you want to delete this part from inventory? If it has historical repair records, it will be safely archived."
        confirmLabel="Delete part"
        onConfirm={handleDelete}
      />
    </div>
  );
}

interface ModelRow {
  model: string;
  quantity: string;
}

function PartFormDialog({ open, setOpen, editing, orgId, userId, onSaved, onDelete }: any) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [models, setModels] = useState<ModelRow[]>([{ model: "", quantity: "1" }]);
  const [quickInput, setQuickInput] = useState("");

  // Edit-only field
  const [editModel, setEditModel] = useState("");

  useEffect(() => {
    if (open) {
      setQuickInput("");
      if (editing) {
        setName(editing.name ?? "");
        setEditModel(editing.sku ?? editing.part_number ?? editing.vehicle_model ?? "");
        setBrand(editing.brand ?? "");
        setUnitCost(editing.unit_cost != null ? String(editing.unit_cost) : "");
        setSellingPrice(editing.selling_price != null ? String(editing.selling_price) : "");
        setNotes(editing.notes ?? "");
      } else {
        setName("");
        setBrand("");
        setUnitCost("");
        setSellingPrice("");
        setNotes("");
        setEditModel("");
        setModels([{ model: "", quantity: "1" }]);
      }
    }
  }, [open, editing]);

  const addModelRow = () => {
    setModels((prev) => [...prev, { model: "", quantity: "1" }]);
  };

  const updateModel = (idx: number, patch: Partial<ModelRow>) => {
    setModels((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const removeModel = (idx: number) => {
    if (models.length <= 1) {
      setModels([{ model: "", quantity: "1" }]);
      return;
    }
    setModels((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleQuickAdd = () => {
    if (!quickInput.trim()) return;
    const parts = quickInput
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (parts.length === 0) return;

    const newRows: ModelRow[] = parts.map((m) => ({ model: m, quantity: "1" }));
    const firstIsEmpty = models.length === 1 && !models[0].model.trim();

    if (firstIsEmpty) {
      setModels(newRows);
    } else {
      setModels((prev) => [...prev, ...newRows]);
    }
    setQuickInput("");
    toast.success(`Added ${newRows.length} models to list`);
  };

  const totalPcs = models.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  const validModelCount = models.filter((r) => r.model.trim()).length;

  const submit = async () => {
    const baseName = name.trim();
    if (!baseName) {
      return toast.error("Please enter the part name (e.g. Brakepad)");
    }

    setSaving(true);

    if (editing) {
      // Single edit flow
      const code = editModel.trim();
      const payload: any = {
        name: baseName,
        sku: code || null,
        part_number: code || null,
        vehicle_model: code || null,
        brand: brand.trim() || null,
        category: editing.category || "spare_part",
        unit: editing.unit || "pcs",
        unit_cost: Number(unitCost) || 0,
        selling_price: sellingPrice === "" ? null : Number(sellingPrice),
        notes: notes.trim() || null,
      };

      let { error } = await supabase.from("inventory_items").update(payload).eq("id", editing.id);
      if (error && (error.message?.includes("vehicle_model") || error.code === "PGRST204")) {
        const { vehicle_model, ...fallback } = payload;
        const res = await supabase.from("inventory_items").update(fallback).eq("id", editing.id);
        error = res.error;
      }
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Part updated");
      setOpen(false);
      onSaved();
      return;
    }

    // Adding flow (can be 1 model or multiple models)
    const validRows = models.filter((r) => r.model.trim());
    const rowsToProcess = validRows.length > 0 ? validRows : [{ model: "", quantity: "0" }];

    const payloads = rowsToProcess.map((r) => {
      const code = r.model.trim();
      const fullName = code ? `${baseName} - ${code}` : baseName;
      return {
        name: fullName,
        sku: code || null,
        part_number: code || null,
        vehicle_model: code || null,
        brand: brand.trim() || null,
        category: "spare_part",
        item_type: "spare_part",
        unit: "pcs",
        unit_cost: Number(unitCost) || 0,
        selling_price: sellingPrice === "" ? null : Number(sellingPrice),
        reorder_level: 0,
        notes: notes.trim() || null,
        organisation_id: orgId,
      };
    });

    let { data: insertedItems, error } = await supabase
      .from("inventory_items")
      .insert(payloads)
      .select("id, name");

    if (error && (error.message?.includes("vehicle_model") || error.code === "PGRST204")) {
      const fallbackPayloads = payloads.map(({ vehicle_model, ...rest }: any) => rest);
      const res = await supabase
        .from("inventory_items")
        .insert(fallbackPayloads)
        .select("id, name");
      insertedItems = res.data;
      error = res.error;
    }

    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    // Record stock for items with quantity > 0
    const hasInitialStock = rowsToProcess.some((r) => Number(r.quantity) > 0);
    if (hasInitialStock && insertedItems && insertedItems.length > 0) {
      const { data: loc } = await (supabase as any)
        .from("stock_locations")
        .select("id")
        .eq("organisation_id", orgId)
        .eq("is_default", true)
        .maybeSingle();

      if (loc) {
        const promises = insertedItems.map((item, idx) => {
          const qty = Number(rowsToProcess[idx]?.quantity) || 0;
          if (qty > 0) {
            return (supabase as any).rpc("record_stock_transaction", {
              _item_id: item.id,
              _location_id: loc.id,
              _transaction_type: "receipt",
              _quantity: qty,
              _reason: "Initial stock",
            });
          }
          return Promise.resolve();
        });
        await Promise.all(promises);
      }
    }

    setSaving(false);
    toast.success(
      rowsToProcess.length > 1
        ? `Added ${rowsToProcess.length} models of ${baseName} (${totalPcs} pcs total)!`
        : `Added ${baseName} (${totalPcs} pcs)!`
    );
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {editing ? "Edit Spare Part (Badili Spea)" : "Add Spare Part (Weka Spea)"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {editing
              ? "Update details or price of this part."
              : "Enter the part name, price, and all models/numbers with their pieces."}
          </p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Part Name */}
          <div>
            <Label className="text-xs font-semibold">Part Name (Jina la Spea) *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-10 text-sm font-medium"
              placeholder="e.g. Brakepad, Oil filter, Plug"
              autoFocus
            />
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Buying Price (Bei ya Kununua)</Label>
              <Input
                type="number"
                min={0}
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="mt-1 h-10 text-sm"
                placeholder="e.g. 20000"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Selling Price (Bei ya Kuuza)</Label>
              <Input
                type="number"
                min={0}
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="mt-1 h-10 text-sm font-semibold"
                placeholder="e.g. 35000"
              />
            </div>
          </div>

          {/* Optional Car / Brand */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground">
              Car / Brand (Gari au Brand) — <span className="font-normal italic">Optional</span>
            </Label>
            <Input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="mt-1 h-9 text-sm"
              placeholder="e.g. Toyota, Bosch, Isuzu"
            />
          </div>

          {editing ? (
            /* Editing single model */
            <div>
              <Label className="text-xs font-medium">Model / Part Number (Namba ya Spea)</Label>
              <Input
                value={editModel}
                onChange={(e) => setEditModel(e.target.value)}
                className="mt-1 h-10 text-sm"
                placeholder="e.g. 3455"
              />
            </div>
          ) : (
            /* Adding Models and Pcs */
            <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    Models / Numbers &amp; Pieces (Modeli na Idadi)
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Put every model number (e.g. 3455) and how many pcs you have.
                  </p>
                </div>
              </div>

              {/* Models List */}
              <div className="space-y-2 pt-1 max-h-[220px] overflow-y-auto pr-1">
                {models.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder={`Model ${idx + 1} (e.g. ${idx === 0 ? "3455" : idx === 1 ? "4567" : "3456"})`}
                        value={row.model}
                        onChange={(e) => updateModel(idx, { model: e.target.value })}
                        className="h-9 text-xs font-medium bg-background"
                      />
                    </div>
                    <div className="w-24 flex items-center gap-1 shrink-0">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Qty"
                        value={row.quantity}
                        onChange={(e) => updateModel(idx, { quantity: e.target.value })}
                        className="h-9 text-xs font-semibold text-center bg-background"
                      />
                      <span className="text-[11px] text-muted-foreground font-medium">pcs</span>
                    </div>
                    {models.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeModel(idx)}
                        className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add row button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addModelRow}
                className="w-full text-xs gap-1.5 h-8 border-dashed"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Another Model (Ongeza Namba Nyingine)
              </Button>

              {/* Quick type box */}
              <div className="pt-2 border-t border-border/60">
                <div className="text-[11px] text-muted-foreground mb-1">
                  Or type numbers separated by comma (Mfano: 3455, 4567, 3456):
                </div>
                <div className="flex gap-1.5">
                  <Input
                    value={quickInput}
                    onChange={(e) => setQuickInput(e.target.value)}
                    placeholder="3455, 4567, 3456..."
                    className="h-8 text-xs bg-background"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleQuickAdd();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleQuickAdd}
                    className="h-8 text-xs shrink-0"
                  >
                    + Add
                  </Button>
                </div>
              </div>

              {/* Summary line */}
              <div className="pt-1 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>{validModelCount > 0 ? `${validModelCount} models configured` : "1 model"}</span>
                <span>Total stock: <strong className="text-foreground">{totalPcs} pcs</strong></span>
              </div>
            </div>
          )}

          {/* Optional Notes */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground">
              Notes / Location (Rafu / Eneo) — <span className="font-normal italic">Optional</span>
            </Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 h-8 text-xs"
              placeholder="e.g. Shelf A2, Box 4"
            />
          </div>
        </div>

        <DialogFooter className="mt-4 flex flex-wrap items-center justify-between gap-2 sm:justify-between pt-2 border-t border-border">
          {editing ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onDelete?.(editing)}
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete part
            </Button>
          ) : <div />}
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving} className="font-medium">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editing ? (
                "Save changes"
              ) : validModelCount > 1 ? (
                `Save All ${validModelCount} Models`
              ) : (
                "Save Part"
              )}
            </Button>
          </div>
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
