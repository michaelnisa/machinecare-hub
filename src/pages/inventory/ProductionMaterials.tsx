import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Boxes, Plus, Loader2, Trash2, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/format";

export default function ProductionMaterials() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any[]>([]);
  const [available, setAvailable] = useState<Record<string, number>>({});
  const [onOrder, setOnOrder] = useState<Record<string, number>>({});
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedProduct, setSelectedProduct] = useState("");
  const [open, setOpen] = useState(false);
  const [prItem, setPrItem] = useState<any>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [
      { data: pr, error: e1 },
      { data: bm, error: e2 },
      { data: bal, error: e3 },
    ] = await Promise.all([
      (supabase as any)
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name"),
      (supabase as any)
        .from("product_materials")
        .select("*, inventory_items(name, part_number, unit, unit_cost)")
        .order("created_at"),
      (supabase as any)
        .from("stock_balances")
        .select("item_id, available_stock, on_order_stock"),
    ]);
    const err = e1 || e2 || e3;
    if (err) toast.error(err.message);
    setProducts(pr ?? []);
    setBoms(bm ?? []);
    if (!selectedProduct && pr?.length) setSelectedProduct(pr[0].id);

    const av: Record<string, number> = {};
    const oo: Record<string, number> = {};
    (bal ?? []).forEach((b: any) => {
      av[b.item_id] = (av[b.item_id] ?? 0) + Number(b.available_stock);
      oo[b.item_id] = (oo[b.item_id] ?? 0) + Number(b.on_order_stock);
    });
    setAvailable(av);
    setOnOrder(oo);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    (supabase as any)
      .from("production_kpis")
      .select("product_id, target_units")
      .eq("record_date", date)
      .then(({ data, error }: any) => {
        if (error) toast.error(error.message);
        setKpis(data ?? []);
      });
  }, [profile, date]);

  const requirements = useMemo(() => {
    const targetByProduct: Record<string, number> = {};
    kpis.forEach((k: any) => {
      if (k.product_id)
        targetByProduct[k.product_id] =
          (targetByProduct[k.product_id] ?? 0) + Number(k.target_units);
    });

    const byItem: Record<string, { item: any; required: number }> = {};
    boms.forEach((line: any) => {
      const target = targetByProduct[line.product_id];
      if (!target) return;
      const required = Number(line.qty_per_unit) * target;
      const entry = byItem[line.item_id] ?? {
        item: line.inventory_items,
        required: 0,
      };
      entry.required += required;
      byItem[line.item_id] = entry;
    });

    return Object.entries(byItem)
      .map(([itemId, v]) => {
        const avail = available[itemId] ?? 0;
        const order = onOrder[itemId] ?? 0;
        const shortfall = Math.max(0, v.required - avail - order);
        return {
          itemId,
          name: v.item?.name,
          unit: v.item?.unit,
          part_number: v.item?.part_number,
          required: v.required,
          available: avail,
          onOrder: order,
          shortfall,
        };
      })
      .sort((a, b) => b.shortfall - a.shortfall);
  }, [kpis, boms, available, onOrder]);

  const bomsForProduct = boms.filter((b) => b.product_id === selectedProduct);

  const removeLine = async (id: string) => {
    const { error } = await (supabase as any)
      .from("product_materials")
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Production materials
        </h1>
        <p className="text-sm text-muted-foreground">
          What today's production plan needs, against what's actually in stock —
          plus the bill of materials behind that calculation.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Material requirements</h2>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />
        </div>

        {requirements.length === 0 ? (
          <EmptyState
            icon={<PackageSearch className="h-5 w-5" />}
            title="No planned materials"
            description="No production is logged for this date with a product that has a bill of materials."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Item</th>
                    <th className="px-5 py-3 font-medium">Required</th>
                    <th className="px-5 py-3 font-medium">Available</th>
                    <th className="px-5 py-3 font-medium">On order</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.map((r) => (
                    <tr key={r.itemId} className="border-t border-border">
                      <td className="px-5 py-3">
                        <div className="font-medium">{r.name}</div>
                        {r.part_number && (
                          <div className="text-xs text-muted-foreground">
                            {r.part_number}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {formatNumber(r.required)} {r.unit}
                      </td>
                      <td className="px-5 py-3">
                        {formatNumber(r.available)} {r.unit}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatNumber(r.onOrder)} {r.unit}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${r.shortfall > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}
                        >
                          {r.shortfall > 0
                            ? `Short ${formatNumber(r.shortfall)}`
                            : "Covered"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {r.shortfall > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPrItem(r)}
                          >
                            Create purchase request
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Bill of materials</h2>
          <div className="flex items-center gap-2">
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.sku ? ` (${p.sku})` : ""}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpen(true)}
              disabled={!selectedProduct}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add material
            </Button>
          </div>
        </div>

        {products.length === 0 ? (
          <EmptyState
            icon={<Boxes className="h-5 w-5" />}
            title="No products yet"
            description="Add a product from the Production page before defining its materials."
          />
        ) : bomsForProduct.length === 0 ? (
          <EmptyState
            icon={<Boxes className="h-5 w-5" />}
            title="No materials defined"
            description="Add the items this product consumes per unit produced."
          />
        ) : (
          <ul className="space-y-2">
            {bomsForProduct.map((line: any) => (
              <li
                key={line.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
              >
                <div>
                  <div className="font-medium">
                    {line.inventory_items?.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(line.qty_per_unit)}{" "}
                    {line.inventory_items?.unit} per unit produced
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLine(line.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Logging actual production against a product with materials defined
          automatically deducts stock — no separate consumption entry needed.
        </p>
      </section>

      <AddMaterialDialog
        open={open}
        setOpen={setOpen}
        productId={selectedProduct}
        orgId={profile?.organisation_id}
        onSaved={load}
      />
      <PurchaseRequestDialog
        item={prItem}
        onClose={() => setPrItem(null)}
        orgId={profile?.organisation_id}
        userId={user?.id}
      />
    </div>
  );
}

function AddMaterialDialog({ open, setOpen, productId, orgId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({
    item_id: "",
    qty_per_unit: "1",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({ item_id: "", qty_per_unit: "1", notes: "" });
      supabase
        .from("inventory_items")
        .select("id, name, part_number")
        .eq("status", "active")
        .order("name")
        .then(({ data }) => setItems(data ?? []));
    }
  }, [open]);

  const submit = async () => {
    if (!form.item_id) return toast.error("Select an item");
    setSaving(true);
    const { error } = await (supabase as any).from("product_materials").insert({
      organisation_id: orgId,
      product_id: productId,
      item_id: form.item_id,
      qty_per_unit: Number(form.qty_per_unit) || 0,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error)
      return toast.error(
        error.code === "23505"
          ? "This item is already on the bill of materials"
          : error.message,
      );
    toast.success("Material added");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add material to bill of materials</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Item *</Label>
            <select
              value={form.item_id}
              onChange={(e) => setForm({ ...form, item_id: e.target.value })}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select…</option>
              {items.map((i: any) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                  {i.part_number ? ` · ${i.part_number}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Quantity per unit produced</Label>
            <Input
              type="number"
              min={0}
              step="any"
              value={form.qty_per_unit}
              onChange={(e) =>
                setForm({ ...form, qty_per_unit: e.target.value })
              }
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseRequestDialog({ item, onClose, orgId, userId }: any) {
  const [saving, setSaving] = useState(false);
  const [qty, setQty] = useState("");
  useEffect(() => {
    if (item) setQty(String(Math.ceil(item.shortfall)));
  }, [item]);

  const submit = async () => {
    setSaving(true);
    const { data: req, error } = await (supabase as any)
      .from("purchase_requests")
      .insert({
        organisation_id: orgId,
        requested_by: userId,
        department: "Production",
        reason: `Shortfall for planned production — ${item.name}`,
        priority: "high",
        status: "pending",
      })
      .select()
      .single();
    if (error || !req) {
      setSaving(false);
      return toast.error(error?.message ?? "Failed");
    }
    const { error: itemErr } = await (supabase as any)
      .from("purchase_request_items")
      .insert({
        purchase_request_id: req.id,
        item_id: item.itemId,
        quantity: Number(qty) || 0,
      });
    setSaving(false);
    if (itemErr) return toast.error(itemErr.message);
    toast.success("Purchase request submitted");
    onClose();
  };

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create purchase request</DialogTitle>
        </DialogHeader>
        {item && (
          <div className="grid gap-3">
            <div className="text-sm text-muted-foreground">
              {item.name} — short {formatNumber(item.shortfall)} {item.unit}
            </div>
            <div>
              <Label>Quantity to request</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
