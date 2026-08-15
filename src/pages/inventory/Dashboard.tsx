import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/PageLoader";
import { Boxes, MapPin, Warehouse, ShieldAlert, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatNumber } from "@/lib/format";
import { Link } from "react-router-dom";

export default function InventoryDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [topMachines, setTopMachines] = useState<{ name: string; cost: number }[]>([]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const [{ data: i, error: e1 }, { data: b, error: e2 }, { data: txns, error: e3 }] = await Promise.all([
        supabase.from("inventory_items").select("id, name, unit_cost, reorder_level, criticality, item_type, status"),
        (supabase as any).from("stock_balances").select("item_id, physical_stock, reserved_stock, quarantine_stock, damaged_stock, available_stock"),
        (supabase as any)
          .from("stock_transactions")
          .select("quantity, machine_id, machines(name), inventory_items(unit_cost)")
          .in("transaction_type", ["issue", "consumption"])
          .not("machine_id", "is", null)
          .gte("created_at", monthStart.toISOString()),
      ]);
      const err = e1 || e2 || e3;
      if (err) toast.error(err.message);
      setItems(i ?? []);
      setBalances(b ?? []);
      const costMap: Record<string, { name: string; cost: number }> = {};
      (txns ?? []).forEach((t: any) => {
        const cost = Math.abs(Number(t.quantity)) * Number(t.inventory_items?.unit_cost ?? 0);
        const e = costMap[t.machine_id] ?? { name: t.machines?.name ?? "—", cost: 0 };
        e.cost += cost;
        costMap[t.machine_id] = e;
      });
      setTopMachines(Object.values(costMap).sort((a, b2) => b2.cost - a.cost).slice(0, 5));
      setLoading(false);
    })();
  }, [profile]);

  const perItem = useMemo(() => {
    const map: Record<string, { physical: number; reserved: number; available: number }> = {};
    balances.forEach((b: any) => {
      const e = map[b.item_id] ?? { physical: 0, reserved: 0, available: 0 };
      e.physical += Number(b.physical_stock);
      e.reserved += Number(b.reserved_stock);
      e.available += Number(b.available_stock);
      map[b.item_id] = e;
    });
    return map;
  }, [balances]);

  const activeItems = items.filter((i) => i.status !== "discontinued" && i.status !== "inactive");

  const stats = useMemo(() => {
    let stockValue = 0, availableTotal = 0, reservedTotal = 0, lowStock = 0, outOfStock = 0, criticalCount = 0, healthy = 0, inactive = 0;
    activeItems.forEach((i) => {
      const bal = perItem[i.id] ?? { physical: 0, reserved: 0, available: 0 };
      stockValue += bal.physical * Number(i.unit_cost || 0);
      availableTotal += bal.available;
      reservedTotal += bal.reserved;
      const reorder = Number(i.reorder_level || 0);
      if (bal.available <= 0) outOfStock += 1;
      else if (bal.available <= reorder) lowStock += 1;
      else healthy += 1;
      if (i.criticality === "critical") criticalCount += 1;
    });
    inactive = items.length - activeItems.length;
    return { stockValue, availableTotal, reservedTotal, lowStock, outOfStock, criticalCount, healthy, inactive, totalItems: activeItems.length };
  }, [activeItems, perItem, items.length]);

  const criticalMissing = useMemo(() => {
    return activeItems.filter((i) => i.criticality === "critical" && (perItem[i.id]?.available ?? 0) <= 0).length;
  }, [activeItems, perItem]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory dashboard</h1>
          <p className="text-sm text-muted-foreground">What we have, where it is, and what needs attention.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/inventory/locations" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted/60"><MapPin className="h-4 w-4" /> Locations</Link>
          <Link to="/inventory/stock" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted/60"><Warehouse className="h-4 w-4" /> Stock</Link>
          <Link to="/inventory/critical-spares" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted/60"><ShieldAlert className="h-4 w-4" /> Critical spares</Link>
          <Link to="/inventory/reorder" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted/60"><TrendingUp className="h-4 w-4" /> Reorder & insights</Link>
          <Link to="/inventory/items" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"><Boxes className="h-4 w-4" /> Items & spare parts</Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total items", value: formatNumber(stats.totalItems) },
          { label: "Stock value", value: formatMoney(stats.stockValue) },
          { label: "Available stock (units)", value: formatNumber(stats.availableTotal) },
          { label: "Reserved stock (units)", value: formatNumber(stats.reservedTotal) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-foreground">Stock health</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/inventory/items?filter=healthy" className="rounded-xl border border-border bg-card p-4 hover:border-primary/50">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Healthy</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-600">{formatNumber(stats.healthy)}</div>
          </Link>
          <Link to="/inventory/items?filter=low_stock" className="rounded-xl border border-border bg-card p-4 hover:border-primary/50">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Low stock</div>
            <div className="mt-1 text-2xl font-semibold text-amber-600">{formatNumber(stats.lowStock)}</div>
          </Link>
          <Link to="/inventory/items?filter=out_of_stock" className="rounded-xl border border-border bg-card p-4 hover:border-primary/50">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Out of stock</div>
            <div className="mt-1 text-2xl font-semibold text-red-600">{formatNumber(stats.outOfStock)}</div>
          </Link>
          <Link to="/inventory/items?filter=inactive" className="rounded-xl border border-border bg-card p-4 hover:border-primary/50">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Inactive</div>
            <div className="mt-1 text-2xl font-semibold text-slate-500">{formatNumber(stats.inactive)}</div>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/inventory/items?filter=critical" className="rounded-xl border border-border bg-card p-4 hover:border-primary/50">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Critical spare parts</div>
          <div className="mt-1 text-2xl font-semibold">{formatNumber(stats.criticalCount)}</div>
          {criticalMissing > 0 && <div className="mt-1 text-xs text-red-600">{criticalMissing} critical item{criticalMissing === 1 ? "" : "s"} unavailable right now</div>}
        </Link>
      </div>

      {topMachines.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-foreground">Top machines by spare parts cost (this month)</h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <tbody>
                {topMachines.map((m, idx) => (
                  <tr key={m.name} className="border-t border-border first:border-t-0">
                    <td className="px-5 py-3 text-muted-foreground">{idx + 1}.</td>
                    <td className="px-5 py-3">{m.name}</td>
                    <td className="px-5 py-3 text-right font-medium">{formatMoney(m.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
