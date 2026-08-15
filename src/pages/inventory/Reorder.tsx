import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ShoppingCart, TrendingUp, Loader2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/format";

export default function Reorder() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [available, setAvailable] = useState<Record<string, number>>({});
  const [usage, setUsage] = useState<Record<string, { last30: number; prev30: number }>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [qty, setQty] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const since60 = new Date();
    since60.setDate(since60.getDate() - 60);
    const [{ data: i, error: e1 }, { data: bal, error: e2 }, { data: txns, error: e3 }] = await Promise.all([
      supabase.from("inventory_items").select("id, name, part_number, unit, unit_cost, reorder_level, reorder_quantity, safety_stock, lead_time_days, avg_monthly_consumption, criticality, status").eq("status", "active"),
      (supabase as any).from("stock_balances").select("item_id, available_stock"),
      (supabase as any).from("stock_transactions").select("item_id, quantity, transaction_type, created_at").in("transaction_type", ["issue", "consumption", "scrap", "damage"]).gte("created_at", since60.toISOString()),
    ]);
    const err = e1 || e2 || e3;
    if (err) toast.error(err.message);
    setItems(i ?? []);

    const av: Record<string, number> = {};
    (bal ?? []).forEach((b: any) => { av[b.item_id] = (av[b.item_id] ?? 0) + Number(b.available_stock); });
    setAvailable(av);

    const day30 = new Date();
    day30.setDate(day30.getDate() - 30);
    const u: Record<string, { last30: number; prev30: number }> = {};
    (txns ?? []).forEach((t: any) => {
      const e = u[t.item_id] ?? { last30: 0, prev30: 0 };
      const qtyAbs = Math.abs(Number(t.quantity));
      if (new Date(t.created_at) >= day30) e.last30 += qtyAbs; else e.prev30 += qtyAbs;
      u[t.item_id] = e;
    });
    setUsage(u);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const recommend = (item: any) => {
    const avail = available[item.id] ?? 0;
    if (item.reorder_quantity && Number(item.reorder_quantity) > 0) return Number(item.reorder_quantity);
    const monthly = Number(item.avg_monthly_consumption ?? usage[item.id]?.last30 ?? 0);
    const leadMonths = Number(item.lead_time_days ?? 30) / 30;
    const target = Number(item.safety_stock ?? 0) + monthly * leadMonths;
    return Math.max(1, Math.ceil(target - avail), Math.ceil(Number(item.reorder_level ?? 0) - avail));
  };

  const needsReorder = useMemo(() => {
    return items
      .filter((i) => (available[i.id] ?? 0) <= Number(i.reorder_level ?? 0))
      .map((i) => ({ item: i, available: available[i.id] ?? 0, recommended: recommend(i) }))
      .sort((a, b) => a.available - b.available);
  }, [items, available, usage]);

  const trending = useMemo(() => {
    return items
      .map((i) => {
        const u = usage[i.id] ?? { last30: 0, prev30: 0 };
        const change = u.prev30 > 0 ? ((u.last30 - u.prev30) / u.prev30) * 100 : (u.last30 > 0 ? 100 : 0);
        return { item: i, ...u, change };
      })
      .filter((r) => r.last30 > 0 && (r.change >= 20 || (r.prev30 === 0 && r.last30 > 0)))
      .sort((a, b) => b.change - a.change)
      .slice(0, 10);
  }, [items, usage]);

  const criticalOut = needsReorder.filter((r) => r.item.criticality === "critical" && r.available <= 0).length;

  useEffect(() => {
    const q: Record<string, string> = {};
    needsReorder.forEach((r) => { q[r.item.id] = String(r.recommended); });
    setQty((prev) => ({ ...q, ...prev }));
  }, [needsReorder.length]);

  const selectedRows = needsReorder.filter((r) => selected[r.item.id]);

  const createRequests = async () => {
    if (selectedRows.length === 0) return;
    setSaving(true);
    const hasCritical = selectedRows.some((r) => r.item.criticality === "critical" && r.available <= 0);
    const { data: req, error } = await (supabase as any).from("purchase_requests").insert({
      organisation_id: profile?.organisation_id,
      requested_by: user?.id,
      department: "Inventory",
      reason: "Automatic reorder — items at or below reorder point",
      priority: hasCritical ? "critical" : "high",
      status: "pending",
    }).select().single();
    if (error || !req) { setSaving(false); return toast.error(error?.message ?? "Failed"); }

    const rows = selectedRows.map((r) => ({
      purchase_request_id: req.id,
      item_id: r.item.id,
      quantity: Number(qty[r.item.id]) || r.recommended,
      estimated_unit_price: r.item.unit_cost || null,
    }));
    const { error: itemsErr } = await (supabase as any).from("purchase_request_items").insert(rows);
    setSaving(false);
    if (itemsErr) return toast.error(itemsErr.message);
    toast.success(`Purchase request created for ${rows.length} item${rows.length === 1 ? "" : "s"}`);
    setConfirmOpen(false);
    setSelected({});
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reorder &amp; insights</h1>
        <p className="text-sm text-muted-foreground">What's at or below its reorder point, what's trending, and what to do about it.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Below reorder point</div>
          <div className={`mt-1 text-2xl font-semibold ${needsReorder.length > 0 ? "text-amber-600" : ""}`}>{needsReorder.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Critical spares out of stock</div>
          <div className={`mt-1 text-2xl font-semibold ${criticalOut > 0 ? "text-red-600" : ""}`}>{criticalOut}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Items trending up in usage</div>
          <div className="mt-1 text-2xl font-semibold">{trending.length}</div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Reorder recommendations</h2>
          <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={selectedRows.length === 0}>
            <ShoppingCart className="mr-1.5 h-3.5 w-3.5" /> Create purchase request ({selectedRows.length})
          </Button>
        </div>

        {needsReorder.length === 0 ? (
          <EmptyState icon={<PackageCheck className="h-5 w-5" />} title="Everything is above its reorder point" description="Nothing needs reordering right now." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3"></th>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Available</th>
                  <th className="px-4 py-3 font-medium">Reorder point</th>
                  <th className="px-4 py-3 font-medium">Recommended order</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {needsReorder.map((r) => (
                  <tr key={r.item.id} className="border-t border-border">
                    <td className="px-4 py-3"><input type="checkbox" checked={!!selected[r.item.id]} onChange={(e) => setSelected((s) => ({ ...s, [r.item.id]: e.target.checked }))} /></td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.item.name}</div>
                      {r.item.part_number && <div className="text-xs text-muted-foreground">{r.item.part_number}</div>}
                    </td>
                    <td className="px-4 py-3">{formatNumber(r.available)} {r.item.unit}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatNumber(r.item.reorder_level)} {r.item.unit}</td>
                    <td className="px-4 py-3">
                      <Input type="number" min={1} step="any" value={qty[r.item.id] ?? String(r.recommended)}
                        onChange={(e) => setQty((q) => ({ ...q, [r.item.id]: e.target.value }))} className="h-8 w-24" />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${r.available <= 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {r.available <= 0 ? "Out of stock" : "Low stock"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Demand trend (last 30 days vs prior 30)</h2>
        <p className="text-xs text-muted-foreground">A recommended signal based on actual consumption, not a guaranteed prediction — review before acting.</p>
        {trending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No item's usage has risen noticeably in the last 30 days.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Prior 30 days</th>
                  <th className="px-4 py-3 font-medium">Last 30 days</th>
                  <th className="px-4 py-3 font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {trending.map((r) => (
                  <tr key={r.item.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{r.item.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatNumber(r.prev30)} {r.item.unit}</td>
                    <td className="px-4 py-3">{formatNumber(r.last30)} {r.item.unit}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-amber-700"><TrendingUp className="h-3.5 w-3.5" /> {r.prev30 > 0 ? `+${r.change.toFixed(0)}%` : "New demand"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create purchase request</DialogTitle></DialogHeader>
          <div className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {selectedRows.map((r) => (
              <div key={r.item.id} className="flex items-center justify-between">
                <span>{r.item.name}</span>
                <span className="text-muted-foreground">{qty[r.item.id] ?? r.recommended} {r.item.unit}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={createRequests} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
