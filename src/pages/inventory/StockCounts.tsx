import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ClipboardCheck, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatNumber, formatMoney } from "@/lib/format";

const TYPE_LABEL: Record<string, string> = {
  full: "Full stocktake",
  cycle: "Cycle count",
  category: "Category count",
  location: "Location count",
  critical_spares: "Critical spares count",
};

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  submitted: "bg-amber-100 text-amber-700",
  applied: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function StockCounts() {
  const { profile, user } = useAuth();
  const { isManager } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: c, error: e1 }, { data: l, error: e2 }] = await Promise.all([
      (supabase as any).from("stock_counts").select("*, stock_locations(name), stock_count_items(id, variance, expected_quantity, physical_quantity, inventory_items(unit_cost))").order("created_at", { ascending: false }),
      (supabase as any).from("stock_locations").select("id, name").order("name"),
    ]);
    const err = e1 || e2;
    if (err) toast.error(err.message);
    setCounts(c ?? []);
    setLocations(l ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const withStats = useMemo(() => counts.map((c) => {
    const lines = c.stock_count_items ?? [];
    const counted = lines.filter((l: any) => l.physical_quantity !== null).length;
    const varianceValue = lines.reduce((s: number, l: any) => s + Math.abs(Number(l.variance ?? 0)) * Number(l.inventory_items?.unit_cost ?? 0), 0);
    return { ...c, lineCount: lines.length, counted, varianceValue };
  }), [counts]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock counts</h1>
          <p className="text-sm text-muted-foreground">Reconcile physical stock against the system, with reasons and variance-value approval.</p>
        </div>
        <Button onClick={() => setNewOpen(true)}><Plus className="mr-2 h-4 w-4" />New count</Button>
      </div>

      {withStats.length === 0 ? (
        <EmptyState icon={<ClipboardCheck className="h-5 w-5" />} title="No stock counts yet" description="Start a cycle count, a location count, or a full stocktake." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Scope</th>
                <th className="px-5 py-3 font-medium">Progress</th>
                <th className="px-5 py-3 font-medium">Variance value</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {withStats.map((c) => (
                <tr key={c.id} className="cursor-pointer border-t border-border hover:bg-muted/40" onClick={() => setDetail(c)}>
                  <td className="px-5 py-3 font-medium">{TYPE_LABEL[c.count_type] ?? c.count_type}</td>
                  <td className="px-5 py-3 text-muted-foreground">{c.stock_locations?.name ?? c.category ?? "All"}</td>
                  <td className="px-5 py-3">{c.counted}/{c.lineCount} counted</td>
                  <td className="px-5 py-3">{c.varianceValue > 0 ? formatMoney(c.varianceValue) : "—"}</td>
                  <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_CLASS[c.status]}`}>{c.status}</span></td>
                  <td className="px-5 py-3 text-muted-foreground">{formatDate(c.created_at)}</td>
                  <td className="px-5 py-3 text-right"><Button size="sm" variant="outline">Open</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewCountDialog open={newOpen} setOpen={setNewOpen} locations={locations} orgId={profile?.organisation_id} userId={user?.id} onSaved={(c: any) => { load(); setDetail(c); }} />
      <CountDetailDialog count={detail} onClose={() => setDetail(null)} canManage={isManager} onSaved={load} />
    </div>
  );
}

function NewCountDialog({ open, setOpen, locations, orgId, userId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ count_type: "cycle", location_id: "", category: "" });

  useEffect(() => { if (open) setForm({ count_type: "cycle", location_id: "", category: "" }); }, [open]);

  const submit = async () => {
    if (form.count_type === "location" && !form.location_id) return toast.error("Select a location");
    if (form.count_type === "category" && !form.category.trim()) return toast.error("Enter a category");
    setSaving(true);

    const { data: count, error } = await (supabase as any).from("stock_counts").insert({
      organisation_id: orgId,
      count_type: form.count_type,
      location_id: form.count_type === "location" ? form.location_id : null,
      category: form.count_type === "category" ? form.category.trim() : null,
      created_by: userId,
    }).select().single();
    if (error || !count) { setSaving(false); return toast.error(error?.message ?? "Failed"); }

    if (form.count_type !== "cycle") {
      let query = (supabase as any).from("stock_balances").select("item_id, location_id, physical_stock, inventory_items!inner(status, category, criticality)").eq("inventory_items.status", "active");
      if (form.count_type === "location") query = query.eq("location_id", form.location_id);
      if (form.count_type === "category") query = query.eq("inventory_items.category", form.category.trim());
      if (form.count_type === "critical_spares") query = query.eq("inventory_items.criticality", "critical");
      const { data: balances, error: balErr } = await query;
      if (balErr) { setSaving(false); return toast.error(balErr.message); }
      if (balances?.length) {
        const rows = balances.map((b: any) => ({
          stock_count_id: count.id, item_id: b.item_id, location_id: b.location_id, expected_quantity: b.physical_stock,
        }));
        const { error: rowsErr } = await (supabase as any).from("stock_count_items").insert(rows);
        if (rowsErr) { setSaving(false); return toast.error(rowsErr.message); }
      }
    }

    setSaving(false);
    toast.success("Stock count created");
    setOpen(false);
    onSaved(count);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New stock count</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Type</Label>
            <select value={form.count_type} onChange={(e) => setForm({ ...form, count_type: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="cycle">Cycle count (add items manually)</option>
              <option value="location">Location count</option>
              <option value="category">Category count</option>
              <option value="critical_spares">Critical spares count</option>
              <option value="full">Full stocktake (every active item)</option>
            </select>
          </div>
          {form.count_type === "location" && (
            <div><Label>Location *</Label>
              <select value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select…</option>
                {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
          {form.count_type === "category" && (
            <div><Label>Category *</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1" placeholder="e.g. bearings" /></div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CountDetailDialog({ count, onClose, canManage, onSaved }: any) {
  const [lines, setLines] = useState<any[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    if (!count) return;
    setLoadingLines(true);
    const { data, error } = await (supabase as any).from("stock_count_items").select("*, inventory_items(name, part_number, unit, unit_cost), stock_locations(name)").eq("stock_count_id", count.id).order("id");
    if (error) toast.error(error.message);
    setLines(data ?? []);
    setLoadingLines(false);
  };
  useEffect(() => { load(); }, [count?.id]);

  const updateLine = async (id: string, patch: any) => {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const { error } = await (supabase as any).from("stock_count_items").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const submitCount = async () => {
    if (lines.length === 0) return toast.error("Add at least one item");
    setBusy(true);
    const { error } = await (supabase as any).from("stock_counts").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", count.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Count submitted");
    onSaved();
    onClose();
  };

  const applyCount = async () => {
    setBusy(true);
    const { error } = await (supabase as any).rpc("apply_stock_count", { _count_id: count.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Count applied — stock updated");
    onSaved();
    onClose();
  };

  if (!count) return null;
  const isDraft = count.status === "draft";
  const varianceValue = lines.reduce((s, l) => s + Math.abs(Number(l.variance ?? 0)) * Number(l.inventory_items?.unit_cost ?? 0), 0);

  return (
    <Dialog open={!!count} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{TYPE_LABEL[count.count_type] ?? count.count_type} — {count.stock_locations?.name ?? count.category ?? "All items"}</DialogTitle>
        </DialogHeader>

        {isDraft && (
          <div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => setAddOpen(true)}><Plus className="mr-1.5 h-3.5 w-3.5" /> Add item</Button></div>
        )}

        {loadingLines ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : lines.length === 0 ? (
          <EmptyState icon={<ClipboardCheck className="h-5 w-5" />} title="No items yet" description="Add items to count." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-4 py-2 font-medium">Location</th>
                  <th className="px-4 py-2 font-medium">Expected</th>
                  <th className="px-4 py-2 font-medium">Physical</th>
                  <th className="px-4 py-2 font-medium">Variance</th>
                  <th className="px-4 py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <div className="font-medium">{l.inventory_items?.name}</div>
                      {l.inventory_items?.part_number && <div className="text-xs text-muted-foreground">{l.inventory_items.part_number}</div>}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{l.stock_locations?.name}</td>
                    <td className="px-4 py-2">{formatNumber(l.expected_quantity)}</td>
                    <td className="px-4 py-2">
                      {isDraft ? (
                        <Input type="number" step="any" defaultValue={l.physical_quantity ?? ""} className="h-8 w-24"
                          onBlur={(e) => { const v = e.target.value === "" ? null : Number(e.target.value); if (v !== l.physical_quantity) updateLine(l.id, { physical_quantity: v }); }} />
                      ) : formatNumber(l.physical_quantity)}
                    </td>
                    <td className={`px-4 py-2 font-medium ${Number(l.variance) > 0 ? "text-emerald-600" : Number(l.variance) < 0 ? "text-red-600" : ""}`}>
                      {l.variance === null ? "—" : formatNumber(l.variance)}
                    </td>
                    <td className="px-4 py-2">
                      {isDraft ? (
                        <Input defaultValue={l.reason ?? ""} className="h-8 w-40" placeholder={Number(l.variance) !== 0 ? "Required" : "Optional"}
                          onBlur={(e) => { if (e.target.value !== (l.reason ?? "")) updateLine(l.id, { reason: e.target.value || null }); }} />
                      ) : (l.reason ?? "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {count.status === "submitted" && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
            Variance value: {formatMoney(varianceValue)}. {!canManage && "This may need a manager to apply, depending on the org's approval threshold."}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {isDraft && <Button onClick={submitCount} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit for apply"}</Button>}
          {count.status === "submitted" && <Button onClick={applyCount} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply to stock"}</Button>}
        </DialogFooter>

        <AddLineDialog open={addOpen} setOpen={setAddOpen} countId={count.id} onSaved={load} />
      </DialogContent>
    </Dialog>
  );
}

function AddLineDialog({ open, setOpen, countId, onSaved }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [form, setForm] = useState({ item_id: "", location_id: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ item_id: "", location_id: "" });
      Promise.all([
        supabase.from("inventory_items").select("id, name, part_number").eq("status", "active").order("name"),
        (supabase as any).from("stock_locations").select("id, name").order("name"),
      ]).then(([{ data: i }, { data: l }]) => { setItems(i ?? []); setLocations(l ?? []); });
    }
  }, [open]);

  const submit = async () => {
    if (!form.item_id || !form.location_id) return toast.error("Select an item and location");
    setSaving(true);
    const { data: bal } = await (supabase as any).from("stock_balances").select("physical_stock").eq("item_id", form.item_id).eq("location_id", form.location_id).maybeSingle();
    const { error } = await (supabase as any).from("stock_count_items").insert({
      stock_count_id: countId, item_id: form.item_id, location_id: form.location_id, expected_quantity: bal?.physical_stock ?? 0,
    });
    setSaving(false);
    if (error) return toast.error(error.code === "23505" ? "Already on this count" : error.message);
    toast.success("Item added");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Add item to count</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Item *</Label>
            <select value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select…</option>
              {items.map((i: any) => <option key={i.id} value={i.id}>{i.name}{i.part_number ? ` · ${i.part_number}` : ""}</option>)}
            </select>
          </div>
          <div><Label>Location *</Label>
            <select value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select…</option>
              {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
