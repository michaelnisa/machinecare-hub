import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { FileBarChart, Download } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatNumber } from "@/lib/format";

function monthBounds(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

export default function InventoryReports() {
  const { profile, organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [items, setItems] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [lastMovement, setLastMovement] = useState<Record<string, string>>({});
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [poItems, setPoItems] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { startISO, endISO } = monthBounds(month);
    const [
      { data: i, error: e1 },
      { data: b, error: e2 },
      { data: t, error: e3 },
      { data: recent, error: e4 },
      { data: po, error: e5 },
      { data: poi, error: e6 },
      { data: sup, error: e7 },
    ] = await Promise.all([
      supabase.from("inventory_items").select("id, name, category, item_type, unit_cost, reorder_level, criticality, status"),
      (supabase as any).from("stock_balances").select("item_id, physical_stock, available_stock"),
      (supabase as any).from("stock_transactions").select("item_id, transaction_type, quantity, reference, machine_id, machines(name), inventory_items(name, unit_cost)").gte("created_at", startISO).lt("created_at", endISO),
      (supabase as any).from("stock_transactions").select("item_id, created_at").order("created_at", { ascending: false }).limit(3000),
      (supabase as any).from("purchase_orders").select("id, status, supplier_id, created_at, suppliers(name)").gte("created_at", startISO).lt("created_at", endISO),
      (supabase as any).from("purchase_order_items").select("purchase_order_id, quantity, unit_price"),
      (supabase as any).from("suppliers").select("id, name"),
    ]);
    const err = e1 || e2 || e3 || e4 || e5 || e6 || e7;
    if (err) toast.error(err.message);
    setItems(i ?? []);
    setBalances(b ?? []);
    setTxns(t ?? []);
    setPurchaseOrders(po ?? []);
    setPoItems(poi ?? []);
    setSuppliers(sup ?? []);

    const last: Record<string, string> = {};
    (recent ?? []).forEach((r: any) => { if (!last[r.item_id]) last[r.item_id] = r.created_at; });
    setLastMovement(last);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile, month]);

  const perItemStock = useMemo(() => {
    const map: Record<string, number> = {};
    balances.forEach((b: any) => { map[b.item_id] = (map[b.item_id] ?? 0) + Number(b.physical_stock); });
    return map;
  }, [balances]);

  const activeItems = items.filter((i) => i.status === "active");

  const valuation = useMemo(() => {
    const byCategory: Record<string, { qty: number; value: number }> = {};
    let total = 0;
    activeItems.forEach((i) => {
      const qty = perItemStock[i.id] ?? 0;
      const value = qty * Number(i.unit_cost || 0);
      total += value;
      const key = i.category || "Uncategorised";
      const e = byCategory[key] ?? { qty: 0, value: 0 };
      e.qty += qty; e.value += value;
      byCategory[key] = e;
    });
    return { total, byCategory: Object.entries(byCategory).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.value - a.value) };
  }, [activeItems, perItemStock]);

  const stockHealth = useMemo(() => {
    let low = 0, out = 0, critical = 0, criticalMissing = 0;
    activeItems.forEach((i) => {
      const qty = perItemStock[i.id] ?? 0;
      if (qty <= 0) out += 1;
      else if (qty <= Number(i.reorder_level || 0)) low += 1;
      if (i.criticality === "critical") { critical += 1; if (qty <= 0) criticalMissing += 1; }
    });
    return { low, out, critical, criticalMissing };
  }, [activeItems, perItemStock]);

  const movement = useMemo(() => {
    const byType: Record<string, { count: number; qty: number }> = {};
    txns.forEach((t: any) => {
      const e = byType[t.transaction_type] ?? { count: 0, qty: 0 };
      e.count += 1; e.qty += Math.abs(Number(t.quantity));
      byType[t.transaction_type] = e;
    });
    return Object.entries(byType).map(([type, v]) => ({ type, ...v })).sort((a, b) => b.qty - a.qty);
  }, [txns]);

  const maintenanceByMachine = useMemo(() => {
    const map: Record<string, number> = {};
    txns.filter((t: any) => ["issue", "consumption"].includes(t.transaction_type) && t.machine_id && !t.reference?.startsWith("production_kpi:")).forEach((t: any) => {
      const name = t.machines?.name ?? "Unassigned";
      map[name] = (map[name] ?? 0) + Math.abs(Number(t.quantity)) * Number(t.inventory_items?.unit_cost ?? 0);
    });
    return Object.entries(map).map(([machine, cost]) => ({ machine, cost })).sort((a, b) => b.cost - a.cost);
  }, [txns]);

  const productionConsumption = useMemo(() => {
    return txns.filter((t: any) => t.transaction_type === "consumption" && t.reference?.startsWith("production_kpi:"))
      .reduce((s: number, t: any) => s + Math.abs(Number(t.quantity)) * Number(t.inventory_items?.unit_cost ?? 0), 0);
  }, [txns]);

  const adjustments = useMemo(() => {
    const rows = txns.filter((t: any) => t.transaction_type === "count_adjustment");
    const value = rows.reduce((s: number, t: any) => s + Math.abs(Number(t.quantity)) * Number(t.inventory_items?.unit_cost ?? 0), 0);
    return { count: rows.length, value };
  }, [txns]);

  const deadStock = useMemo(() => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return activeItems
      .map((i) => ({ item: i, qty: perItemStock[i.id] ?? 0, last: lastMovement[i.id] }))
      .filter((r) => r.qty > 0 && (!r.last || new Date(r.last) < sixMonthsAgo))
      .map((r) => ({ ...r, value: r.qty * Number(r.item.unit_cost || 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 25);
  }, [activeItems, perItemStock, lastMovement]);

  const purchasing = useMemo(() => {
    const spendByPo: Record<string, number> = {};
    poItems.forEach((it: any) => { spendByPo[it.purchase_order_id] = (spendByPo[it.purchase_order_id] ?? 0) + Number(it.quantity) * Number(it.unit_price); });
    const bySupplier: Record<string, { orders: number; spend: number }> = {};
    let total = 0;
    purchaseOrders.forEach((po: any) => {
      const spend = spendByPo[po.id] ?? 0;
      total += spend;
      const name = po.suppliers?.name ?? "—";
      const e = bySupplier[name] ?? { orders: 0, spend: 0 };
      e.orders += 1; e.spend += spend;
      bySupplier[name] = e;
    });
    return { total, orders: purchaseOrders.length, bySupplier: Object.entries(bySupplier).map(([supplier, v]) => ({ supplier, ...v })).sort((a, b) => b.spend - a.spend) };
  }, [purchaseOrders, poItems]);

  const exportCSV = () => {
    const rows: string[][] = [];
    rows.push(["MachineCare Inventory Report", organisation?.name ?? "", month]);
    rows.push([]);
    rows.push(["Stock valuation", formatMoney(valuation.total)]);
    rows.push(["Category", "Qty", "Value"]);
    valuation.byCategory.forEach((c) => rows.push([c.category, String(c.qty), c.value.toFixed(2)]));
    rows.push([]);
    rows.push(["Stock health"]);
    rows.push(["Low stock", String(stockHealth.low)]);
    rows.push(["Out of stock", String(stockHealth.out)]);
    rows.push(["Critical spares missing", String(stockHealth.criticalMissing), "of", String(stockHealth.critical)]);
    rows.push([]);
    rows.push(["Movement this month", "Type", "Count", "Qty"]);
    movement.forEach((m) => rows.push(["", m.type, String(m.count), String(m.qty)]));
    rows.push([]);
    rows.push(["Maintenance parts cost by machine"]);
    maintenanceByMachine.forEach((m) => rows.push([m.machine, m.cost.toFixed(2)]));
    rows.push([]);
    rows.push(["Production material consumption", productionConsumption.toFixed(2)]);
    rows.push(["Stock adjustments", String(adjustments.count), adjustments.value.toFixed(2)]);
    rows.push([]);
    rows.push(["Purchasing", "Orders", String(purchasing.orders), "Spend", purchasing.total.toFixed(2)]);
    purchasing.bySupplier.forEach((s) => rows.push([s.supplier, String(s.orders), s.spend.toFixed(2)]));
    rows.push([]);
    rows.push(["Dead stock (no movement 6+ months)"]);
    rows.push(["Item", "Qty", "Value", "Last movement"]);
    deadStock.forEach((d) => rows.push([d.item.name, String(d.qty), d.value.toFixed(2), d.last ?? "never"]));
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `machinecare-inventory-report-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory reports</h1>
          <p className="text-sm text-muted-foreground">Valuation, movement, consumption and purchasing — for the selected month.</p>
        </div>
        <div className="flex gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
          <Button onClick={exportCSV}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Stock value (now)", value: formatMoney(valuation.total) },
          { label: "Low / out of stock", value: `${stockHealth.low} / ${stockHealth.out}` },
          { label: "Critical spares missing", value: `${stockHealth.criticalMissing} of ${stockHealth.critical}` },
          { label: "Purchasing spend", value: formatMoney(purchasing.total), hint: `${purchasing.orders} orders` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold">{s.value}</div>
            {s.hint && <div className="text-xs text-muted-foreground">{s.hint}</div>}
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground">Stock valuation by category</h2>
        {valuation.byCategory.length === 0 ? <EmptyState icon={<FileBarChart className="h-5 w-5" />} title="No stock" description="No active items with stock." /> : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Category</th><th className="px-5 py-3 font-medium">Qty</th><th className="px-5 py-3 font-medium">Value</th></tr></thead>
              <tbody>{valuation.byCategory.map((c) => (
                <tr key={c.category} className="border-t border-border"><td className="px-5 py-3 font-medium">{c.category}</td><td className="px-5 py-3">{formatNumber(c.qty)}</td><td className="px-5 py-3">{formatMoney(c.value)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground">Movement this month, by type</h2>
        {movement.length === 0 ? <p className="text-sm text-muted-foreground">No movement recorded this month.</p> : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Type</th><th className="px-5 py-3 font-medium">Transactions</th><th className="px-5 py-3 font-medium">Total qty</th></tr></thead>
              <tbody>{movement.map((m) => (
                <tr key={m.type} className="border-t border-border"><td className="px-5 py-3 capitalize">{m.type.replace("_", " ")}</td><td className="px-5 py-3">{m.count}</td><td className="px-5 py-3">{formatNumber(m.qty)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Production material consumption (this month)</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoney(productionConsumption)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Stock adjustments (this month)</div>
          <div className="mt-1 text-2xl font-semibold">{adjustments.count} <span className="text-sm font-normal text-muted-foreground">· {formatMoney(adjustments.value)}</span></div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground">Maintenance parts cost by machine (this month)</h2>
        {maintenanceByMachine.length === 0 ? <p className="text-sm text-muted-foreground">No maintenance issues recorded this month.</p> : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <tbody>{maintenanceByMachine.slice(0, 10).map((m, idx) => (
                <tr key={m.machine} className="border-t border-border first:border-t-0"><td className="px-5 py-3 text-muted-foreground">{idx + 1}.</td><td className="px-5 py-3">{m.machine}</td><td className="px-5 py-3 text-right font-medium">{formatMoney(m.cost)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground">Supplier spend (this month)</h2>
        {purchasing.bySupplier.length === 0 ? <p className="text-sm text-muted-foreground">No purchase orders this month.</p> : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Supplier</th><th className="px-5 py-3 font-medium">Orders</th><th className="px-5 py-3 font-medium">Spend</th></tr></thead>
              <tbody>{purchasing.bySupplier.map((s) => (
                <tr key={s.supplier} className="border-t border-border"><td className="px-5 py-3 font-medium">{s.supplier}</td><td className="px-5 py-3">{s.orders}</td><td className="px-5 py-3">{formatMoney(s.spend)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground">Dead stock — no movement in 6+ months</h2>
        {deadStock.length === 0 ? <p className="text-sm text-muted-foreground">Nothing flagged.</p> : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Item</th><th className="px-5 py-3 font-medium">Qty</th><th className="px-5 py-3 font-medium">Value</th><th className="px-5 py-3 font-medium">Last movement</th></tr></thead>
              <tbody>{deadStock.map((d) => (
                <tr key={d.item.id} className="border-t border-border">
                  <td className="px-5 py-3 font-medium">{d.item.name}</td>
                  <td className="px-5 py-3">{formatNumber(d.qty)}</td>
                  <td className="px-5 py-3">{formatMoney(d.value)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{d.last ? d.last.slice(0, 10) : "never"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
