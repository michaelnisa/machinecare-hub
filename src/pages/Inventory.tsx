import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Package, Plus, Pencil, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatNumber } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const CATEGORIES = ["filter", "oil", "belt", "tyre", "battery", "fluid", "electrical", "other"];
const UNITS = ["pcs", "litres", "kg", "metres", "set"];

export default function Inventory() {
  const { profile } = useAuth();
  const { isManager } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("inventory_items").select("*").order("name");
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { if (profile) load(); }, [profile]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((i) =>
      i.name.toLowerCase().includes(q) ||
      (i.part_number ?? "").toLowerCase().includes(q) ||
      (i.category ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);

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
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          {lowStock} {lowStock === 1 ? "item is" : "items are"} at or below reorder level.
        </div>
      )}

      <Input placeholder="Search parts..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />

      {filtered.length === 0 ? (
        <EmptyState icon={<Package className="h-5 w-5" />} title="No parts in stock" description="Add parts you commonly use so they can be auto-deducted from service logs." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Part</th>
                <th className="px-5 py-3 font-medium">Category</th>
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
