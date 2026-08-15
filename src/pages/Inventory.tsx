import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link as RouterLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Package, Plus, Pencil, Trash2, Loader2, AlertTriangle, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatNumber } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const CATEGORIES = ["filter", "oil", "belt", "tyre", "battery", "fluid", "electrical", "ppe", "other"];
const UNITS = ["pcs", "litres", "kg", "metres", "set"];
const ITEM_TYPES = ["spare_part", "consumable", "raw_material", "production_material", "tool", "ppe", "safety_equipment", "chemical", "lubricant", "electrical_component", "mechanical_component", "other"];
const CRITICALITIES = ["low", "medium", "high", "critical"];
const STATUSES = ["active", "inactive", "discontinued"];
const CRITICALITY_CLASS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

export default function Inventory() {
  const { profile } = useAuth();
  const { isManager } = useUserRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get("filter") ?? "all";
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [available, setAvailable] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [machinesFor, setMachinesFor] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: bal }] = await Promise.all([
      supabase.from("inventory_items").select("*").order("name"),
      (supabase as any).from("stock_balances").select("item_id, available_stock"),
    ]);
    if (error) toast.error(error.message);
    else setItems(data ?? []);
    const map: Record<string, number> = {};
    (bal ?? []).forEach((b: any) => { map[b.item_id] = (map[b.item_id] ?? 0) + Number(b.available_stock); });
    setAvailable(map);
    setLoading(false);
  };
  useEffect(() => { if (profile) load(); }, [profile]);

  const filtered = useMemo(() => {
    let out = items;
    if (filterParam === "low_stock") out = out.filter((i) => { const a = available[i.id] ?? 0; return a > 0 && a <= Number(i.reorder_level); });
    else if (filterParam === "out_of_stock") out = out.filter((i) => (available[i.id] ?? 0) <= 0);
    else if (filterParam === "critical") out = out.filter((i) => i.criticality === "critical");
    else if (filterParam === "inactive") out = out.filter((i) => i.status === "inactive" || i.status === "discontinued");
    else if (filterParam === "healthy") out = out.filter((i) => { const a = available[i.id] ?? 0; return a > Number(i.reorder_level); });

    if (!search.trim()) return out;
    const q = search.toLowerCase();
    return out.filter((i) =>
      i.name.toLowerCase().includes(q) ||
      (i.part_number ?? "").toLowerCase().includes(q) ||
      (i.sku ?? "").toLowerCase().includes(q) ||
      (i.category ?? "").toLowerCase().includes(q)
    );
  }, [items, search, filterParam, available]);

  const lowStock = items.filter((i) => Number(i.quantity) <= Number(i.reorder_level)).length;

  const handleDelete = async () => {
    if (!confirm) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", confirm);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setConfirm(null);
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Parts inventory</h1>
          <p className="text-sm text-muted-foreground">Track stock and auto-deduct when parts are used in service logs.</p>
        </div>
        {isManager && (
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add part
          </Button>
        )}
      </div>

      {lowStock > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {lowStock} {lowStock === 1 ? "item is" : "items are"} at or below reorder level.</span>
          <RouterLink to="/inventory/purchase-requests?new=1" className="text-amber-900 underline">Create purchase request</RouterLink>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search parts..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
        {filterParam !== "all" && (
          <button onClick={() => setSearchParams({})} className="flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs capitalize text-primary">
            Filter: {filterParam.replace(/_/g, " ")} ✕
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Package className="h-5 w-5" />} title="No parts in stock" description="Add parts you commonly use so they can be auto-deducted from service logs." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Part</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Criticality</th>
                <th className="px-5 py-3 font-medium">In stock</th>
                <th className="px-5 py-3 font-medium">Reorder at</th>
                <th className="px-5 py-3 font-medium">Order status</th>
                <th className="px-5 py-3 font-medium">Unit cost</th>
                <th className="px-5 py-3 font-medium">Supplier</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const low = Number(i.quantity) <= Number(i.reorder_level);
                const status = i.order_status ?? "none";
                const statusLabel: Record<string, string> = {
                  none: "—", requested: "Requested", ordered: "Ordered",
                  in_transit: "In transit", received: "Received",
                };
                const statusClass: Record<string, string> = {
                  none: "text-muted-foreground",
                  requested: "text-amber-700 bg-amber-50 border-amber-200",
                  ordered: "text-blue-700 bg-blue-50 border-blue-200",
                  in_transit: "text-indigo-700 bg-indigo-50 border-indigo-200",
                  received: "text-emerald-700 bg-emerald-50 border-emerald-200",
                };
                return (
                  <tr key={i.id} className="border-t border-border">
                    <td className="px-5 py-3">
                      <div className="font-medium">{i.name}</div>
                      {i.part_number && <div className="text-xs text-muted-foreground">{i.part_number}</div>}
                    </td>
                    <td className="px-5 py-3 capitalize">{i.category ?? "—"}</td>
                    <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${CRITICALITY_CLASS[i.criticality ?? "low"]}`}>{i.criticality ?? "low"}</span></td>
                    <td className={`px-5 py-3 font-medium ${low ? "text-amber-600" : ""}`}>
                      {formatNumber(i.quantity)} {i.unit}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{formatNumber(i.reorder_level)}</td>
                    <td className="px-5 py-3">
                      {status === "none" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${statusClass[status] ?? ""}`}>
                          {statusLabel[status]}
                        </span>
                      )}
                      {i.order_note && <div className="text-xs text-muted-foreground mt-1">{i.order_note}</div>}
                      {i.order_expected_at && <div className="text-xs text-muted-foreground">ETA {i.order_expected_at}</div>}
                    </td>
                    <td className="px-5 py-3">{formatMoney(i.unit_cost)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{i.supplier ?? "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => setMachinesFor(i)} title="Machines using this part">
                        <Wrench className="h-4 w-4" />
                      </Button>
                      {isManager && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(i); setOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setConfirm(i.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <InventoryDialog open={open} onOpenChange={setOpen} item={editing} onSaved={load} />
      <ConfirmDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)} title="Delete this part?" description="This action cannot be undone." onConfirm={async () => { await handleDelete(); }} />
      <ItemMachinesDialog item={machinesFor} onClose={() => setMachinesFor(null)} />
    </div>
  );
}

function InventoryDialog({ open, onOpenChange, item, onSaved }: any) {
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (open) {
      setForm(item ?? {
        name: "", part_number: "", category: "filter", unit: "pcs",
        quantity: 0, reorder_level: 0, unit_cost: 0, supplier: "", location: "", notes: "",
        order_status: "none", order_note: "", ordered_at: "", order_expected_at: "",
        sku: "", manufacturer_part_number: "", manufacturer: "", brand: "", barcode: "",
        item_type: "spare_part", criticality: "low", status: "active",
        max_stock: "", reorder_quantity: "", safety_stock: "", lead_time_days: "",
        avg_monthly_consumption: "", backup_supplier: "", technical_specs: "",
      });
    }
  }, [open, item]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!form.name?.trim()) return toast.error("Name required");
    setSubmitting(true);
    const payload: any = {
      organisation_id: profile.organisation_id,
      name: form.name.trim(),
      part_number: form.part_number || null,
      category: form.category || null,
      unit: form.unit,
      quantity: Number(form.quantity) || 0,
      reorder_level: Number(form.reorder_level) || 0,
      unit_cost: Number(form.unit_cost) || 0,
      supplier: form.supplier || null,
      location: form.location || null,
      notes: form.notes || null,
      order_status: form.order_status || "none",
      order_note: form.order_note || null,
      ordered_at: form.ordered_at || null,
      order_expected_at: form.order_expected_at || null,
      sku: form.sku || null,
      manufacturer_part_number: form.manufacturer_part_number || null,
      manufacturer: form.manufacturer || null,
      brand: form.brand || null,
      barcode: form.barcode || null,
      item_type: form.item_type || "spare_part",
      criticality: form.criticality || "low",
      status: form.status || "active",
      max_stock: form.max_stock === "" ? null : Number(form.max_stock),
      reorder_quantity: form.reorder_quantity === "" ? null : Number(form.reorder_quantity),
      safety_stock: form.safety_stock === "" ? null : Number(form.safety_stock),
      lead_time_days: form.lead_time_days === "" ? null : Number(form.lead_time_days),
      avg_monthly_consumption: form.avg_monthly_consumption === "" ? null : Number(form.avg_monthly_consumption),
      backup_supplier: form.backup_supplier || null,
      technical_specs: form.technical_specs || null,
    };
    const { error } = item
      ? await supabase.from("inventory_items").update(payload).eq("id", item.id)
      : await supabase.from("inventory_items").insert(payload);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(item ? "Updated" : "Added");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{item ? "Edit part" : "Add part"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Name *</Label>
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={150} />
            </div>
            <div className="space-y-1.5">
              <Label>Part #</Label>
              <Input value={form.part_number ?? ""} onChange={(e) => setForm({ ...form, part_number: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <select value={form.category ?? "filter"} onChange={(e) => setForm({ ...form, category: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity in stock</Label>
              <Input type="number" step="any" value={form.quantity ?? 0} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <select value={form.unit ?? "pcs"} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Reorder level</Label>
              <Input type="number" step="any" value={form.reorder_level ?? 0} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Unit cost</Label>
              <Input type="number" step="any" value={form.unit_cost ?? 0} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Input value={form.supplier ?? ""} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Shelf, bin..." />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="text-sm font-medium">Item master details</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Item type</Label>
                <select value={form.item_type ?? "spare_part"} onChange={(e) => setForm({ ...form, item_type: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {ITEM_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Criticality</Label>
                <select value={form.criticality ?? "low"} onChange={(e) => setForm({ ...form, criticality: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {CRITICALITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select value={form.status ?? "active"} onChange={(e) => setForm({ ...form, status: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>SKU</Label>
                <Input value={form.sku ?? ""} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Manufacturer part number</Label>
                <Input value={form.manufacturer_part_number ?? ""} onChange={(e) => setForm({ ...form, manufacturer_part_number: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Barcode</Label>
                <Input value={form.barcode ?? ""} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Manufacturer</Label>
                <Input value={form.manufacturer ?? ""} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Brand</Label>
                <Input value={form.brand ?? ""} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Backup supplier</Label>
                <Input value={form.backup_supplier ?? ""} onChange={(e) => setForm({ ...form, backup_supplier: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Technical specifications</Label>
                <Textarea rows={2} value={form.technical_specs ?? ""} onChange={(e) => setForm({ ...form, technical_specs: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="text-sm font-medium">Stock planning</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Maximum stock</Label>
                <Input type="number" step="any" value={form.max_stock ?? ""} onChange={(e) => setForm({ ...form, max_stock: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Reorder quantity</Label>
                <Input type="number" step="any" value={form.reorder_quantity ?? ""} onChange={(e) => setForm({ ...form, reorder_quantity: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Safety stock</Label>
                <Input type="number" step="any" value={form.safety_stock ?? ""} onChange={(e) => setForm({ ...form, safety_stock: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Lead time (days)</Label>
                <Input type="number" value={form.lead_time_days ?? ""} onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Average monthly consumption</Label>
                <Input type="number" step="any" value={form.avg_monthly_consumption ?? ""} onChange={(e) => setForm({ ...form, avg_monthly_consumption: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="text-sm font-medium">On-order tracking</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  value={form.order_status ?? "none"}
                  onChange={(e) => setForm({ ...form, order_status: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="none">Not on order</option>
                  <option value="requested">Requested</option>
                  <option value="ordered">Ordered</option>
                  <option value="in_transit">In transit</option>
                  <option value="received">Received</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Ordered on</Label>
                <Input type="date" value={form.ordered_at ?? ""} onChange={(e) => setForm({ ...form, ordered_at: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Expected by</Label>
                <Input type="date" value={form.order_expected_at ?? ""} onChange={(e) => setForm({ ...form, order_expected_at: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Where is the part / notes</Label>
                <Input
                  value={form.order_note ?? ""}
                  onChange={(e) => setForm({ ...form, order_note: e.target.value })}
                  placeholder="e.g. PO#1234 at Mantrac, picking up Tue"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ItemMachinesDialog({ item, onClose }: { item: any; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<any[]>([]);

  useEffect(() => {
    if (!item) return;
    setLoading(true);
    (supabase as any)
      .from("machine_parts")
      .select("id, is_required, quantity_per_unit, machines(id, name)")
      .eq("item_id", item.id)
      .then(({ data }: any) => { setLinks(data ?? []); setLoading(false); });
  }, [item]);

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("machine_parts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setLinks((l) => l.filter((x) => x.id !== id));
  };

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Machines using {item?.name}</DialogTitle></DialogHeader>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not linked to any machine yet. Link it from a machine's "Spare parts" tab.</p>
        ) : (
          <ul className="space-y-2">
            {links.map((l) => (
              <li key={l.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span>{l.machines?.name}{l.is_required && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-700">required</span>}</span>
                <Button variant="ghost" size="icon" onClick={() => remove(l.id)}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
