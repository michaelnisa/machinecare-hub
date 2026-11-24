import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { FileBarChart, Download, Printer, LayoutDashboard, FileText, Package, AlertTriangle, TrendingUp, Layers, Calendar, ShieldCheck, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatMoney, formatNumber } from "@/lib/format";
import { ReportDocumentWrapper } from "@/components/reports/ReportDocumentWrapper";

function monthBounds(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

export default function InventoryReports() {
  const { profile, organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [viewMode, setViewMode] = useState<"dashboard" | "document">("dashboard");
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
      supabase
        .from("inventory_items")
        .select(
          "id, name, category, item_type, unit_cost, reorder_level, criticality, status",
        ),
      (supabase as any)
        .from("stock_balances")
        .select("item_id, physical_stock, available_stock"),
      (supabase as any)
        .from("stock_transactions")
        .select(
          "item_id, transaction_type, quantity, reference, machine_id, machines(name), inventory_items(name, unit_cost)",
        )
        .gte("created_at", startISO)
        .lt("created_at", endISO),
      (supabase as any)
        .from("stock_transactions")
        .select("item_id, created_at")
        .order("created_at", { ascending: false })
        .limit(3000),
      (supabase as any)
        .from("purchase_orders")
        .select("id, status, supplier_id, created_at, suppliers(name)")
        .gte("created_at", startISO)
        .lt("created_at", endISO),
      (supabase as any)
        .from("purchase_order_items")
        .select("purchase_order_id, quantity, unit_price"),
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
    (recent ?? []).forEach((r: any) => {
      if (!last[r.item_id]) last[r.item_id] = r.created_at;
    });
    setLastMovement(last);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [profile, month]);

  const perItemStock = useMemo(() => {
    const map: Record<string, number> = {};
    balances.forEach((b: any) => {
      map[b.item_id] = (map[b.item_id] ?? 0) + Number(b.physical_stock);
    });
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
      e.qty += qty;
      e.value += value;
      byCategory[key] = e;
    });
    return {
      total,
      byCategory: Object.entries(byCategory)
        .map(([category, v]) => ({ category, ...v }))
        .sort((a, b) => b.value - a.value),
    };
  }, [activeItems, perItemStock]);

  const stockHealth = useMemo(() => {
    let low = 0,
      out = 0,
      critical = 0,
      criticalMissing = 0;
    activeItems.forEach((i) => {
      const qty = perItemStock[i.id] ?? 0;
      if (qty <= 0) out += 1;
      else if (qty <= Number(i.reorder_level || 0)) low += 1;
      if (i.criticality === "critical") {
        critical += 1;
        if (qty <= 0) criticalMissing += 1;
      }
    });
    return { low, out, critical, criticalMissing };
  }, [activeItems, perItemStock]);

  const movement = useMemo(() => {
    const byType: Record<string, { count: number; qty: number }> = {};
    txns.forEach((t: any) => {
      const e = byType[t.transaction_type] ?? { count: 0, qty: 0 };
      e.count += 1;
      e.qty += Math.abs(Number(t.quantity));
      byType[t.transaction_type] = e;
    });
    return Object.entries(byType)
      .map(([type, v]) => ({ type, ...v }))
      .sort((a, b) => b.qty - a.qty);
  }, [txns]);

  const maintenanceByMachine = useMemo(() => {
    const map: Record<string, number> = {};
    txns
      .filter(
        (t: any) =>
          ["issue", "consumption"].includes(t.transaction_type) &&
          t.machine_id &&
          !t.reference?.startsWith("production_kpi:"),
      )
      .forEach((t: any) => {
        const name = t.machines?.name ?? "Unassigned";
        map[name] =
          (map[name] ?? 0) +
          Math.abs(Number(t.quantity)) *
            Number(t.inventory_items?.unit_cost ?? 0);
      });
    return Object.entries(map)
      .map(([machine, cost]) => ({ machine, cost }))
      .sort((a, b) => b.cost - a.cost);
  }, [txns]);

  const productionConsumption = useMemo(() => {
    return txns
      .filter(
        (t: any) =>
          t.transaction_type === "consumption" &&
          t.reference?.startsWith("production_kpi:"),
      )
      .reduce(
        (s: number, t: any) =>
          s +
          Math.abs(Number(t.quantity)) *
            Number(t.inventory_items?.unit_cost ?? 0),
        0,
      );
  }, [txns]);

  const adjustments = useMemo(() => {
    const rows = txns.filter(
      (t: any) => t.transaction_type === "count_adjustment",
    );
    const value = rows.reduce(
      (s: number, t: any) =>
        s +
        Math.abs(Number(t.quantity)) *
          Number(t.inventory_items?.unit_cost ?? 0),
      0,
    );
    return { count: rows.length, value };
  }, [txns]);

  const deadStock = useMemo(() => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return activeItems
      .map((i) => ({
        item: i,
        qty: perItemStock[i.id] ?? 0,
        last: lastMovement[i.id],
      }))
      .filter((r) => r.qty > 0 && (!r.last || new Date(r.last) < sixMonthsAgo))
      .map((r) => ({ ...r, value: r.qty * Number(r.item.unit_cost || 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 25);
  }, [activeItems, perItemStock, lastMovement]);

  const purchasing = useMemo(() => {
    const spendByPo: Record<string, number> = {};
    poItems.forEach((it: any) => {
      spendByPo[it.purchase_order_id] =
        (spendByPo[it.purchase_order_id] ?? 0) +
        Number(it.quantity) * Number(it.unit_price);
    });
    const bySupplier: Record<string, { orders: number; spend: number }> = {};
    let total = 0;
    purchaseOrders.forEach((po: any) => {
      const spend = spendByPo[po.id] ?? 0;
      total += spend;
      const name = po.suppliers?.name ?? "—";
      const e = bySupplier[name] ?? { orders: 0, spend: 0 };
      e.orders += 1;
      e.spend += spend;
      bySupplier[name] = e;
    });
    return {
      total,
      orders: purchaseOrders.length,
      bySupplier: Object.entries(bySupplier)
        .map(([supplier, v]) => ({ supplier, ...v }))
        .sort((a, b) => b.spend - a.spend),
    };
  }, [purchaseOrders, poItems]);

  const exportCSV = () => {
    const rows: string[][] = [];
    rows.push([
      "MachineCare Inventory Report",
      organisation?.name ?? "",
      month,
    ]);
    rows.push([]);
    rows.push(["Stock valuation", formatMoney(valuation.total)]);
    rows.push(["Category", "Qty", "Value"]);
    valuation.byCategory.forEach((c) =>
      rows.push([c.category, String(c.qty), c.value.toFixed(2)]),
    );
    rows.push([]);
    rows.push(["Stock health"]);
    rows.push(["Low stock", String(stockHealth.low)]);
    rows.push(["Out of stock", String(stockHealth.out)]);
    rows.push([
      "Critical spares missing",
      String(stockHealth.criticalMissing),
      "of",
      String(stockHealth.critical),
    ]);
    rows.push([]);
    rows.push(["Movement this month", "Type", "Count", "Qty"]);
    movement.forEach((m) =>
      rows.push(["", m.type, String(m.count), String(m.qty)]),
    );
    rows.push([]);
    rows.push(["Maintenance parts cost by machine"]);
    maintenanceByMachine.forEach((m) =>
      rows.push([m.machine, m.cost.toFixed(2)]),
    );
    rows.push([]);
    rows.push([
      "Production material consumption",
      productionConsumption.toFixed(2),
    ]);
    rows.push([
      "Stock adjustments",
      String(adjustments.count),
      adjustments.value.toFixed(2),
    ]);
    rows.push([]);
    rows.push([
      "Purchasing",
      "Orders",
      String(purchasing.orders),
      "Spend",
      purchasing.total.toFixed(2),
    ]);
    purchasing.bySupplier.forEach((s) =>
      rows.push([s.supplier, String(s.orders), s.spend.toFixed(2)]),
    );
    rows.push([]);
    rows.push(["Dead stock (no movement 6+ months)"]);
    rows.push(["Item", "Qty", "Value", "Last movement"]);
    deadStock.forEach((d) =>
      rows.push([
        d.item.name,
        String(d.qty),
        d.value.toFixed(2),
        d.last ?? "never",
      ]),
    );
    const csv = rows
      .map((r) =>
        r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `machinecare-inventory-report-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <PageLoader />;

  if (viewMode === "document") {
    const deadStockVal = deadStock.reduce((s, d) => s + d.value, 0);
    return (
      <div className="space-y-6 animate-fade-in pb-16">
        {/* Document Action Controls (hidden in print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-xs print:hidden">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode("dashboard")}
              className="gap-1.5 font-semibold text-xs"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-muted-foreground" />
              Interactive Dashboard
            </Button>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Month:</span>
            </div>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="gap-1.5 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/5"
            >
              <Printer className="h-3.5 w-3.5 text-primary" />
              Print / Save PDF
            </Button>
            <Button size="sm" onClick={exportCSV} className="gap-1.5 text-xs font-semibold">
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Formal Document Container */}
        <ReportDocumentWrapper
          title="Inventory Audit & Stock Valuation Certificate"
          subtitle={`Formal valuation certificate, central storehouse inventory audit, critical spares risk registry, and commercial supplier outlays for period ${month}.`}
          documentNumber={`REF-INV-${month.replace("-", "")}-001`}
          classification="OFFICIAL AUDIT REPORT"
          dateGenerated={new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
          periodBanner={`Audit Cycle: ${month} · Central Stores & Spares Warehouses`}
          metadata={[
            { label: "Audit Cycle", value: month },
            { label: "Active SKUs Monitored", value: `${activeItems.length} SKUs` },
            { label: "Total Physical Valuation", value: formatMoney(valuation.total) },
            { label: "Low / Out of Stock", value: `${stockHealth.low} Low / ${stockHealth.out} Zero` },
            { label: "Critical Spares Missing", value: `${stockHealth.criticalMissing} of ${stockHealth.critical} SKUs` },
            { label: "Monthly Procurement Spend", value: formatMoney(purchasing.total) },
            { label: "Capital in Dead Stock", value: formatMoney(deadStockVal) },
          ]}
          signers={[
            { role: "Prepared By", name: profile?.full_name || "Stores & Inventory Officer", title: "Lead Stores & Inventory Controller" },
            { role: "Reviewed By", name: "Warehouse & Logistics Manager", title: "Head of Supply Chain & Spares Inventory" },
            { role: "Approved By", name: "Internal Financial Controller", title: "Director of Finance & Operations Audit" },
          ]}
        >
          {/* Section 1: Stores Valuation & Safety Stock Metrics */}
          <section className="mb-8">
            <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2 mb-4">
              <Package className="h-5 w-5 text-slate-800" />
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-900">
                1. Executive Stores Valuation & Safety Thresholds
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border border-slate-300 bg-slate-50/70">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Current Stock Valuation</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{formatMoney(valuation.total)}</div>
                <div className="text-xs text-slate-600 mt-0.5">{activeItems.length} active catalog items</div>
              </div>
              <div className="p-4 rounded-lg border border-slate-300 bg-slate-50/70">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Critical Stockout Risk</div>
                <div className={`text-2xl font-black mt-1 ${stockHealth.criticalMissing > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                  {stockHealth.criticalMissing} / {stockHealth.critical}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">Critical plant spares with 0 stock</div>
              </div>
              <div className="p-4 rounded-lg border border-slate-300 bg-slate-50/70">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Reorder Level Alerts</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {stockHealth.low} <span className="text-sm font-semibold text-slate-500">({stockHealth.out} empty)</span>
                </div>
                <div className="text-xs text-slate-600 mt-0.5">Below designated safety stock</div>
              </div>
              <div className="p-4 rounded-lg border border-slate-300 bg-slate-50/70">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Procurement Outlay</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{formatMoney(purchasing.total)}</div>
                <div className="text-xs text-slate-600 mt-0.5">{purchasing.orders} purchase orders executed</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div className="p-3.5 rounded-lg border border-slate-300 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Production Material Consumption</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">{formatMoney(productionConsumption)}</div>
                </div>
                <span className="text-[11px] font-semibold text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded border border-slate-300">
                  Manufacturing KPI Link
                </span>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-300 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Stock Count Adjustments</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    {adjustments.count} variance events · {formatMoney(adjustments.value)}
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                  Physical Audit Variance
                </span>
              </div>
            </div>
          </section>

          {/* Section 2: Stock Valuation by Category */}
          <section className="mb-8">
            <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2 mb-4">
              <Layers className="h-5 w-5 text-slate-800" />
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-900">
                2. Inventory Valuation by Category
              </h2>
            </div>
            {valuation.byCategory.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 border border-slate-200 rounded-lg">
                No active inventory valuation records available.
              </div>
            ) : (
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-slate-800">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold uppercase text-[10px] text-slate-700 tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Category / Classification</th>
                      <th className="px-4 py-2.5 text-right">Physical Quantity (Units)</th>
                      <th className="px-4 py-2.5 text-right">Valuation (TZS)</th>
                      <th className="px-4 py-2.5 text-right">Balance Sheet Share (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {valuation.byCategory.map((c) => {
                      const sharePct = valuation.total > 0 ? ((c.value / valuation.total) * 100).toFixed(1) : "0.0";
                      return (
                        <tr key={c.category} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-slate-900">{c.category}</td>
                          <td className="px-4 py-2.5 text-right text-slate-700 font-medium">{formatNumber(c.qty)}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">{formatMoney(c.value)}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-600">{sharePct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 border-t border-slate-300 font-bold text-slate-900">
                    <tr>
                      <td className="px-4 py-2.5 uppercase">Consolidated Inventory Value</td>
                      <td className="px-4 py-2.5 text-right">
                        {formatNumber(valuation.byCategory.reduce((s, c) => s + c.qty, 0))}
                      </td>
                      <td className="px-4 py-2.5 text-right">{formatMoney(valuation.total)}</td>
                      <td className="px-4 py-2.5 text-right">100.0%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* Section 3: Material Movements & Machine Consumption */}
          <section className="mb-8">
            <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2 mb-4">
              <TrendingUp className="h-5 w-5 text-slate-800" />
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-900">
                3. Material Movement & Plant Maintenance Consumption
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Movements by Type */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <div className="bg-slate-100 border-b border-slate-300 px-4 py-2 font-bold text-[11px] uppercase tracking-wider text-slate-700">
                  Stock Movements by Transaction Type
                </div>
                {movement.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">No stock movements recorded.</div>
                ) : (
                  <table className="w-full text-xs text-slate-800">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-600">
                      <tr>
                        <th className="px-4 py-2 text-left">Transaction Type</th>
                        <th className="px-4 py-2 text-center">Events</th>
                        <th className="px-4 py-2 text-right">Total Units</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {movement.map((m) => (
                        <tr key={m.type} className="hover:bg-slate-50">
                          <td className="px-4 py-2 capitalize font-medium text-slate-900">{m.type.replace("_", " ")}</td>
                          <td className="px-4 py-2 text-center text-slate-600">{m.count}</td>
                          <td className="px-4 py-2 text-right font-bold text-slate-900">{formatNumber(m.qty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Maintenance by Machine */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <div className="bg-slate-100 border-b border-slate-300 px-4 py-2 font-bold text-[11px] uppercase tracking-wider text-slate-700">
                  Top Machinery Spare Consumption
                </div>
                {maintenanceByMachine.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">No machine maintenance parts consumed.</div>
                ) : (
                  <table className="w-full text-xs text-slate-800">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-600">
                      <tr>
                        <th className="px-4 py-2 text-left">Machine / Asset</th>
                        <th className="px-4 py-2 text-right">Spares Value Consumed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {maintenanceByMachine.slice(0, 8).map((m, idx) => (
                        <tr key={m.machine} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium text-slate-900">
                            <span className="text-slate-400 mr-2">{idx + 1}.</span>
                            {m.machine}
                          </td>
                          <td className="px-4 py-2 text-right font-bold text-slate-900">{formatMoney(m.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>

          {/* Section 4: Supplier Procurement Outlays */}
          <section className="mb-8">
            <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2 mb-4">
              <ShoppingCart className="h-5 w-5 text-slate-800" />
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-900">
                4. Supplier Procurement & Purchase Order Commitments
              </h2>
            </div>
            {purchasing.bySupplier.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 border border-slate-200 rounded-lg">
                No supplier purchase orders issued for audit cycle {month}.
              </div>
            ) : (
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-slate-800">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold uppercase text-[10px] text-slate-700 tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Vendor / Supplier Name</th>
                      <th className="px-4 py-2.5 text-center">Purchase Orders</th>
                      <th className="px-4 py-2.5 text-right">Total Procurement Commitment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {purchasing.bySupplier.map((s) => (
                      <tr key={s.supplier} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-bold text-slate-900">{s.supplier}</td>
                        <td className="px-4 py-2.5 text-center text-slate-600 font-semibold">{s.orders}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">{formatMoney(s.spend)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 border-t border-slate-300 font-bold text-slate-900">
                    <tr>
                      <td className="px-4 py-2.5 uppercase">Consolidated Procurement Spend</td>
                      <td className="px-4 py-2.5 text-center">{purchasing.orders}</td>
                      <td className="px-4 py-2.5 text-right">{formatMoney(purchasing.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* Section 5: Aging & Dead Stock Audit */}
          <section className="mb-6">
            <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2 mb-4">
              <ShieldCheck className="h-5 w-5 text-slate-800" />
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-900">
                5. Aging Spares & Dormant Stock Audit (No Movement in 6+ Months)
              </h2>
            </div>
            {deadStock.length === 0 ? (
              <div className="p-6 text-center text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg font-medium">
                Excellent Inventory Velocity: No inactive stock exceeding 180 days identified in warehouse.
              </div>
            ) : (
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-slate-800">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold uppercase text-[10px] text-slate-700 tracking-wider">
                    <tr>
                      <th className="px-4 py-2 text-left">Dormant Item Description</th>
                      <th className="px-4 py-2 text-right">Physical Units</th>
                      <th className="px-4 py-2 text-right">Tied-Up Capital (TZS)</th>
                      <th className="px-4 py-2 text-right">Last Recorded Movement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {deadStock.map((d) => (
                      <tr key={d.item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-900">{d.item.name}</td>
                        <td className="px-4 py-2 text-right text-slate-700">{formatNumber(d.qty)}</td>
                        <td className="px-4 py-2 text-right font-bold text-slate-900">{formatMoney(d.value)}</td>
                        <td className="px-4 py-2 text-right text-slate-500">{d.last ? d.last.slice(0, 10) : "Never"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 border-t border-slate-300 font-bold text-slate-900">
                    <tr>
                      <td className="px-4 py-2 uppercase">Total Dormant Capital Risk</td>
                      <td className="px-4 py-2 text-right">
                        {formatNumber(deadStock.reduce((s, d) => s + d.qty, 0))}
                      </td>
                      <td className="px-4 py-2 text-right font-black text-rose-800">{formatMoney(deadStockVal)}</td>
                      <td className="px-4 py-2 text-right">{deadStock.length} Flagged SKUs</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </ReportDocumentWrapper>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Header Bar */}
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Inventory & Valuation Reports</h1>
            <Badge variant="outline" className="text-xs font-semibold bg-primary/10 text-primary border-primary/20">
              Stores & Spares
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Valuation, movement, machine consumption, purchasing & dormant stock audit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-muted/80 p-0.5 rounded-lg border border-border text-xs mr-1">
            <button
              type="button"
              onClick={() => setViewMode("dashboard")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
                viewMode === "dashboard"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setViewMode("document")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
                viewMode === "document"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-primary" />
              Document View
            </button>
          </div>

          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode("document")}
            className="gap-1.5 font-semibold text-xs border-primary/30 text-primary hover:bg-primary/5"
            title="Open official printable inventory valuation certificate"
          >
            <Printer className="h-3.5 w-3.5" />
            Formal Document
          </Button>
          <Button size="sm" onClick={exportCSV} className="gap-1.5 font-semibold text-xs">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Stock value (now)", value: formatMoney(valuation.total) },
          {
            label: "Low / out of stock",
            value: `${stockHealth.low} / ${stockHealth.out}`,
          },
          {
            label: "Critical spares missing",
            value: `${stockHealth.criticalMissing} of ${stockHealth.critical}`,
          },
          {
            label: "Purchasing spend",
            value: formatMoney(purchasing.total),
            hint: `${purchasing.orders} orders`,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-card p-4 shadow-2xs"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              {s.label}
            </div>
            <div className="mt-1 text-2xl font-bold">{s.value}</div>
            {s.hint && (
              <div className="text-xs text-muted-foreground mt-0.5">{s.hint}</div>
            )}
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          Stock valuation by category
        </h2>
        {valuation.byCategory.length === 0 ? (
          <EmptyState
            icon={<FileBarChart className="h-5 w-5" />}
            title="No stock"
            description="No active items with stock."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Category</th>
                    <th className="px-5 py-3 font-semibold">Qty</th>
                    <th className="px-5 py-3 font-semibold text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {valuation.byCategory.map((c) => (
                    <tr key={c.category} className="hover:bg-muted/30">
                      <td className="px-5 py-3 font-medium">{c.category}</td>
                      <td className="px-5 py-3">{formatNumber(c.qty)}</td>
                      <td className="px-5 py-3 text-right font-medium">{formatMoney(c.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          Movement this month, by type
        </h2>
        {movement.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No movement recorded this month.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Type</th>
                    <th className="px-5 py-3 font-semibold">Transactions</th>
                    <th className="px-5 py-3 font-semibold text-right">Total qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {movement.map((m) => (
                    <tr key={m.type} className="hover:bg-muted/30">
                      <td className="px-5 py-3 capitalize font-medium">
                        {m.type.replace("_", " ")}
                      </td>
                      <td className="px-5 py-3">{m.count}</td>
                      <td className="px-5 py-3 text-right font-medium">{formatNumber(m.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
            Production material consumption (this month)
          </div>
          <div className="mt-1 text-2xl font-bold">
            {formatMoney(productionConsumption)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
            Stock adjustments (this month)
          </div>
          <div className="mt-1 text-2xl font-bold">
            {adjustments.count}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              · {formatMoney(adjustments.value)}
            </span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          Maintenance parts cost by machine (this month)
        </h2>
        {maintenanceByMachine.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No maintenance issues recorded this month.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {maintenanceByMachine.slice(0, 10).map((m, idx) => (
                    <tr
                      key={m.machine}
                      className="border-t border-border first:border-t-0 hover:bg-muted/30"
                    >
                      <td className="px-5 py-3 text-muted-foreground w-8">
                        {idx + 1}.
                      </td>
                      <td className="px-5 py-3 font-medium">{m.machine}</td>
                      <td className="px-5 py-3 text-right font-semibold">
                        {formatMoney(m.cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          Supplier spend (this month)
        </h2>
        {purchasing.bySupplier.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No purchase orders this month.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Supplier</th>
                    <th className="px-5 py-3 font-semibold">Orders</th>
                    <th className="px-5 py-3 font-semibold text-right">Spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {purchasing.bySupplier.map((s) => (
                    <tr key={s.supplier} className="hover:bg-muted/30">
                      <td className="px-5 py-3 font-medium">{s.supplier}</td>
                      <td className="px-5 py-3">{s.orders}</td>
                      <td className="px-5 py-3 text-right font-semibold">{formatMoney(s.spend)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          Dead stock — no movement in 6+ months
        </h2>
        {deadStock.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing flagged.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Item</th>
                    <th className="px-5 py-3 font-semibold">Qty</th>
                    <th className="px-5 py-3 font-semibold">Value</th>
                    <th className="px-5 py-3 font-semibold text-right">Last movement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deadStock.map((d) => (
                    <tr key={d.item.id} className="hover:bg-muted/30">
                      <td className="px-5 py-3 font-medium">{d.item.name}</td>
                      <td className="px-5 py-3">{formatNumber(d.qty)}</td>
                      <td className="px-5 py-3 font-medium">{formatMoney(d.value)}</td>
                      <td className="px-5 py-3 text-muted-foreground text-right">
                        {d.last ? d.last.slice(0, 10) : "never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
