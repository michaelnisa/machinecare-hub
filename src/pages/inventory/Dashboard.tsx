import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/PageLoader";
import {
  Boxes,
  MapPin,
  Warehouse,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatNumber } from "@/lib/format";
import { Link } from "react-router-dom";

export default function InventoryDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [topMachines, setTopMachines] = useState<
    { name: string; cost: number }[]
  >([]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const [
        { data: i, error: e1 },
        { data: b, error: e2 },
        { data: txns, error: e3 },
      ] = await Promise.all([
        supabase
          .from("inventory_items")
          .select(
            "id, name, unit_cost, reorder_level, criticality, item_type, status",
          ),
        (supabase as any)
          .from("stock_balances")
          .select(
            "item_id, physical_stock, reserved_stock, quarantine_stock, damaged_stock, available_stock",
          ),
        (supabase as any)
          .from("stock_transactions")
          .select(
            "quantity, machine_id, machines(name), inventory_items(unit_cost)",
          )
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
        const cost =
          Math.abs(Number(t.quantity)) *
          Number(t.inventory_items?.unit_cost ?? 0);
        const e = costMap[t.machine_id] ?? {
          name: t.machines?.name ?? "—",
          cost: 0,
        };
        e.cost += cost;
        costMap[t.machine_id] = e;
      });
      setTopMachines(
        Object.values(costMap)
          .sort((a, b2) => b2.cost - a.cost)
          .slice(0, 5),
      );
      setLoading(false);
    })();
  }, [profile]);

  const perItem = useMemo(() => {
    const map: Record<
      string,
      { physical: number; reserved: number; available: number }
    > = {};
    balances.forEach((b: any) => {
      const e = map[b.item_id] ?? { physical: 0, reserved: 0, available: 0 };
      e.physical += Number(b.physical_stock);
      e.reserved += Number(b.reserved_stock);
      e.available += Number(b.available_stock);
      map[b.item_id] = e;
    });
    return map;
  }, [balances]);

  const activeItems = items.filter(
    (i) => i.status !== "discontinued" && i.status !== "inactive",
  );

  const stats = useMemo(() => {
    let stockValue = 0,
      availableTotal = 0,
      reservedTotal = 0,
      lowStock = 0,
      outOfStock = 0,
      criticalCount = 0,
      healthy = 0,
      inactive = 0;
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
    return {
      stockValue,
      availableTotal,
      reservedTotal,
      lowStock,
      outOfStock,
      criticalCount,
      healthy,
      inactive,
      totalItems: activeItems.length,
    };
  }, [activeItems, perItem, items.length]);

  const criticalMissing = useMemo(() => {
    return activeItems.filter(
      (i) =>
        i.criticality === "critical" && (perItem[i.id]?.available ?? 0) <= 0,
    ).length;
  }, [activeItems, perItem]);

  if (loading) return <PageLoader />;

  const kpiCards = [
    {
      label: "Active Items",
      value: formatNumber(stats.totalItems),
      sub: stats.inactive > 0 ? `${stats.inactive} inactive / discontinued` : "All items active",
      icon: Boxes,
      tone: "default",
    },
    {
      label: "Stock Value",
      value: formatMoney(stats.stockValue),
      sub: `${formatNumber(stats.availableTotal)} available units`,
      icon: TrendingUp,
      tone: "success",
    },
    {
      label: "Low / Out of Stock",
      value: String(stats.lowStock + stats.outOfStock),
      sub: stats.outOfStock > 0 ? `${stats.outOfStock} out of stock — order now` : stats.lowStock > 0 ? `${stats.lowStock} below reorder level` : "All items sufficiently stocked",
      icon: ShieldAlert,
      tone: stats.outOfStock > 0 ? "destructive" : stats.lowStock > 0 ? "warning" : "success",
    },
    {
      label: "Critical Spares",
      value: formatNumber(stats.criticalCount),
      sub: criticalMissing > 0 ? `${criticalMissing} critical item${criticalMissing === 1 ? "" : "s"} unavailable` : "All critical spares stocked",
      icon: ShieldAlert,
      tone: criticalMissing > 0 ? "destructive" : "success",
    },
  ] as const;

  const toneClasses: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    destructive: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory Dashboard</h1>
          <p className="text-sm text-muted-foreground">Stock levels, valuation, and critical spare parts status.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/inventory/locations" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted/60">
            <MapPin className="h-4 w-4" /> Locations
          </Link>
          <Link to="/inventory/stock" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted/60">
            <Warehouse className="h-4 w-4" /> Stock
          </Link>
          <Link to="/inventory/critical-spares" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted/60">
            <ShieldAlert className="h-4 w-4" /> Critical spares
          </Link>
          <Link to="/inventory/reorder" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted/60">
            <TrendingUp className="h-4 w-4" /> Reorder
          </Link>
          <Link to="/inventory/items" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90">
            <Boxes className="h-4 w-4" /> Items & spare parts
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{c.label}</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight">{c.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{c.sub}</div>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClasses[c.tone]}`}>
                <c.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stock health breakdown + Top machines — side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Stock health */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Warehouse className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">Stock Health</h2>
          </div>
          <div className="space-y-2">
            {[
              { label: "Healthy", value: stats.healthy, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20", href: "/inventory/items?filter=healthy" },
              { label: "Low stock", value: stats.lowStock, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20", href: "/inventory/items?filter=low_stock" },
              { label: "Out of stock", value: stats.outOfStock, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20", href: "/inventory/items?filter=out_of_stock" },
              { label: "Inactive / discontinued", value: stats.inactive, color: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-900/30", href: "/inventory/items?filter=inactive" },
            ].map((row) => (
              <Link
                key={row.label}
                to={row.href}
                className={`flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm ${row.bg} hover:border-primary/40 transition-colors`}
              >
                <span className="font-medium">{row.label}</span>
                <span className={`text-xl font-bold tabular-nums ${row.color}`}>{formatNumber(row.value)}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Top machines by cost */}
        {topMachines.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-foreground">Top Machines by Parts Cost <span className="text-xs font-normal text-muted-foreground">(this month)</span></h2>
            </div>
            <div className="space-y-2">
              {topMachines.map((m, idx) => (
                <div key={m.name} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold shrink-0">{idx + 1}</span>
                    <span className="font-medium">{m.name}</span>
                  </div>
                  <span className="text-muted-foreground font-medium">{formatMoney(m.cost)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-foreground">Top Machines by Parts Cost</h2>
            </div>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <TrendingUp className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No parts issued this month</p>
              <p className="text-xs text-muted-foreground mt-1">Issue stock to machines to see cost rankings here.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
