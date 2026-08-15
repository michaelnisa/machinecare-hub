import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Warehouse, Plus, Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/format";

export default function Stock() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [locationFilter, setLocationFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<any>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [
      { data: b, error: e1 },
      { data: i, error: e2 },
      { data: l, error: e3 },
    ] = await Promise.all([
      (supabase as any)
        .from("stock_balances")
        .select(
          "*, inventory_items(name, part_number, unit, reorder_level), stock_locations(name)",
        )
        .order("updated_at", { ascending: false }),
      supabase
        .from("inventory_items")
        .select("id, name, part_number, unit")
        .order("name"),
      (supabase as any)
        .from("stock_locations")
        .select("id, name")
        .order("name"),
    ]);
    const err = e1 || e2 || e3;
    if (err) toast.error(err.message);
    setBalances(b ?? []);
    setItems(i ?? []);
    setLocations(l ?? []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, [profile]);

  const filtered = useMemo(() => {
    let out = balances;
    if (locationFilter !== "all")
      out = out.filter((b) => b.location_id === locationFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (b) =>
          b.inventory_items?.name?.toLowerCase().includes(q) ||
          b.inventory_items?.part_number?.toLowerCase().includes(q),
      );
    }
    return out;
  }, [balances, locationFilter, search]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock</h1>
          <p className="text-sm text-muted-foreground">
            Physical, reserved, quarantine, damaged and available quantity per
            item, per location.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Stock an item
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search item..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All locations</option>
          {locations.map((l: any) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Warehouse className="h-5 w-5" />}
          title="No stock records"
          description="Stock an item to a location to get started."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Item</th>
                  <th className="px-5 py-3 font-medium">Location</th>
                  <th className="px-5 py-3 font-medium">Bin</th>
                  <th className="px-5 py-3 font-medium">Physical</th>
                  <th className="px-5 py-3 font-medium">Reserved</th>
                  <th className="px-5 py-3 font-medium">Quarantine</th>
                  <th className="px-5 py-3 font-medium">Damaged</th>
                  <th className="px-5 py-3 font-medium">Available</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const low =
                    Number(b.available_stock) <=
                    Number(b.inventory_items?.reorder_level ?? 0);
                  return (
                    <tr key={b.id} className="border-t border-border">
                      <td className="px-5 py-3">
                        <div className="font-medium">
                          {b.inventory_items?.name}
                        </div>
                        {b.inventory_items?.part_number && (
                          <div className="text-xs text-muted-foreground">
                            {b.inventory_items.part_number}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {b.stock_locations?.name}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {b.bin ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        {formatNumber(b.physical_stock)}{" "}
                        {b.inventory_items?.unit}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatNumber(b.reserved_stock)}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatNumber(b.quarantine_stock)}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatNumber(b.damaged_stock)}
                      </td>
                      <td
                        className={`px-5 py-3 font-medium ${low ? "text-amber-600" : ""}`}
                      >
                        {formatNumber(b.available_stock)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAdjustTarget(b)}
                          className="gap-1.5"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddStockDialog
        open={addOpen}
        setOpen={setAddOpen}
        items={items}
        locations={locations}
        onSaved={load}
      />
      <AdjustStockDialog
        target={adjustTarget}
        onClose={() => setAdjustTarget(null)}
        onSaved={load}
      />
    </div>
  );
}

function AddStockDialog({ open, setOpen, items, locations, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    item_id: "",
    location_id: "",
    bin: "",
    quantity: "",
  });

  useEffect(() => {
    if (open) setForm({ item_id: "", location_id: "", bin: "", quantity: "" });
  }, [open]);

  const submit = async () => {
    if (!form.item_id || !form.location_id)
      return toast.error("Pick an item and a location");
    const qty = Number(form.quantity);
    if (!qty || qty <= 0)
      return toast.error("Enter a quantity greater than zero");
    setSaving(true);
    const { error } = await (supabase as any).rpc("record_stock_transaction", {
      _item_id: form.item_id,
      _location_id: form.location_id,
      _transaction_type: "receipt",
      _quantity: qty,
      _reason: "Initial stocking",
    });
    if (!error && form.bin) {
      await (supabase as any)
        .from("stock_balances")
        .update({ bin: form.bin })
        .eq("item_id", form.item_id)
        .eq("location_id", form.location_id);
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Stock recorded");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Stock an item</DialogTitle>
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
            <Label>Location *</Label>
            <select
              value={form.location_id}
              onChange={(e) =>
                setForm({ ...form, location_id: e.target.value })
              }
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select…</option>
              {locations.map((l: any) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Bin (optional)</Label>
              <Input
                value={form.bin}
                onChange={(e) => setForm({ ...form, bin: e.target.value })}
                className="mt-1"
                placeholder="A3-B-4-07"
              />
            </div>
            <div>
              <Label>Quantity *</Label>
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustStockDialog({ target, onClose, onSaved }: any) {
  const [newPhysical, setNewPhysical] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setNewPhysical(String(target.physical_stock));
      setReason("");
    }
  }, [target]);
  if (!target) return null;

  const delta =
    newPhysical === ""
      ? 0
      : Number(newPhysical) - Number(target.physical_stock);

  const submit = async () => {
    if (delta === 0)
      return toast.error("New count matches current stock — nothing to adjust");
    if (!reason.trim())
      return toast.error("A reason is required for stock adjustments");
    setSaving(true);
    const { error } = await (supabase as any).rpc("record_stock_transaction", {
      _item_id: target.item_id,
      _location_id: target.location_id,
      _transaction_type: "adjustment",
      _quantity: delta,
      _reason: reason.trim(),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Stock adjusted");
    onClose();
    onSaved();
  };

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Adjust stock — {target.inventory_items?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="text-xs text-muted-foreground">
            Current physical stock: {formatNumber(target.physical_stock)}{" "}
            {target.inventory_items?.unit} at {target.stock_locations?.name}
          </p>
          <div>
            <Label>New physical count *</Label>
            <Input
              type="number"
              value={newPhysical}
              onChange={(e) => setNewPhysical(e.target.value)}
              className="mt-1"
            />
          </div>
          {delta !== 0 && (
            <p
              className={`text-xs ${delta > 0 ? "text-emerald-600" : "text-red-600"}`}
            >
              {delta > 0 ? "+" : ""}
              {formatNumber(delta)} change
            </p>
          )}
          <div>
            <Label>Reason *</Label>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1"
              placeholder="Damaged, lost, wrong entry, unrecorded issue/receipt…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save adjustment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
