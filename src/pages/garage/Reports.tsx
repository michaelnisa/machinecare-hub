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

function invoiceTotal(inv: any) {
  const itemsTotal = (inv.garage_invoice_items ?? []).reduce((s: number, it: any) => s + Number(it.line_total ?? it.quantity * it.unit_price), 0);
  return itemsTotal + Number(inv.labour_cost || 0) + Number(inv.other_cost || 0) - Number(inv.discount || 0);
}
function invoicePartsCost(inv: any) {
  return (inv.garage_invoice_items ?? []).reduce((s: number, it: any) => s + Number(it.quantity) * Number(it.unit_cost || 0), 0);
}
function invoicePartsRevenue(inv: any) {
  return (inv.garage_invoice_items ?? []).reduce((s: number, it: any) => s + Number(it.line_total ?? it.quantity * it.unit_price), 0);
}

const OPEN_STATUSES = new Set(["received", "diagnosing", "estimate", "awaiting_approval", "approved", "in_progress", "quality_check", "ready"]);

export default function GarageReports() {
  const { profile, organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [jobs, setJobs] = useState<any[]>([]);
  const [allOpenJobs, setAllOpenJobs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [outstandingInvoices, setOutstandingInvoices] = useState<any[]>([]);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { startISO, endISO } = monthBounds(month);
    const [
      { data: j, error: e1 }, { data: openJobs, error: e2 },
      { data: inv, error: e3 }, { data: allInv, error: e4 },
      { data: pay, error: e5 }, { data: m, error: e6 },
      { data: items, error: e7 }, { data: balances, error: e8 },
      { data: po, error: e9 }, { data: poItems, error: e10 },
    ] = await Promise.all([
      (supabase as any).from("garage_jobs").select("*, garage_customers(name), garage_vehicles(make, model, registration_number)").gte("created_at", startISO).lt("created_at", endISO),
      (supabase as any).from("garage_jobs").select("id, status, mechanic_id"),
      (supabase as any).from("garage_invoices").select("*, garage_invoice_items(*), garage_jobs(garage_customers(name), garage_vehicles(make, model, registration_number))").gte("issued_at", startISO).lt("issued_at", endISO),
      (supabase as any).from("garage_invoices").select("*, garage_invoice_items(*)"),
      (supabase as any).from("garage_payments").select("*").gte("paid_at", startISO).lt("paid_at", endISO),
      (supabase as any).from("garage_mechanics").select("id, name").eq("status", "active").order("name"),
      supabase.from("inventory_items").select("id, reorder_level").eq("status", "active"),
      (supabase as any).from("stock_balances").select("item_id, available_stock"),
      (supabase as any).from("purchase_orders").select("id, supplier_id, created_at, suppliers(name)").gte("created_at", startISO).lt("created_at", endISO),
      (supabase as any).from("purchase_order_items").select("purchase_order_id, quantity, unit_price"),
    ]);
    const err = e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8 || e9 || e10;
    if (err) toast.error(err.message);
    setJobs(j ?? []);
    setAllOpenJobs((openJobs ?? []).filter((x: any) => OPEN_STATUSES.has(x.status)));
    setInvoices(inv ?? []);
    setMechanics(m ?? []);
    setPayments(pay ?? []);
    setPurchaseOrders((po ?? []).map((p: any) => ({ ...p, spend: (poItems ?? []).filter((it: any) => it.purchase_order_id === p.id).reduce((s: number, it: any) => s + Number(it.quantity) * Number(it.unit_price), 0) })));

    const av: Record<string, number> = {};
    (balances ?? []).forEach((b: any) => { av[b.item_id] = (av[b.item_id] ?? 0) + Number(b.available_stock); });
    setLowStockCount((items ?? []).filter((i: any) => (av[i.id] ?? 0) <= Number(i.reorder_level ?? 0)).length);

    const allInvList = allInv ?? [];
    const paidByInvoice: Record<string, number> = {};
    const { data: allPay } = await (supabase as any).from("garage_payments").select("invoice_id, amount, type");
    (allPay ?? []).forEach((p: any) => {
      const sign = p.type === "refund" ? -1 : 1;
      paidByInvoice[p.invoice_id] = (paidByInvoice[p.invoice_id] ?? 0) + sign * Number(p.amount);
    });
    setOutstandingInvoices(allInvList.map((iv: any) => ({ inv: iv, outstanding: invoiceTotal(iv) - (paidByInvoice[iv.id] ?? 0) })).filter((r: any) => r.outstanding > 0));

    setLoading(false);
  };
  useEffect(() => { load(); }, [profile, month]);

  const stats = useMemo(() => {
    const completed = jobs.filter((j) => j.status === "closed").length;
    const revenue = invoices.reduce((s, inv) => s + invoiceTotal(inv), 0);
    const partsRevenue = invoices.reduce((s, inv) => s + invoicePartsRevenue(inv), 0);
    const partsCost = invoices.reduce((s, inv) => s + invoicePartsCost(inv), 0);
    const labourRevenue = invoices.reduce((s, inv) => s + Number(inv.labour_cost || 0), 0);
    const otherCost = invoices.reduce((s, inv) => s + Number(inv.other_cost || 0), 0);
    const profit = revenue - partsCost - labourRevenue - otherCost;
    const avgJobValue = invoices.length > 0 ? revenue / invoices.length : 0;
    const outstanding = outstandingInvoices.reduce((s, r) => s + r.outstanding, 0);
    const collected = payments.filter((p) => p.type === "payment").reduce((s, p) => s + Number(p.amount), 0) - payments.filter((p) => p.type === "refund").reduce((s, p) => s + Number(p.amount), 0);
    return { completed, revenue, partsRevenue, labourRevenue, profit, avgJobValue, outstanding, collected };
  }, [jobs, invoices, outstandingInvoices, payments]);

  const topCustomers = useMemo(() => {
    const map: Record<string, { name: string; revenue: number }> = {};
    invoices.forEach((inv) => {
      const name = inv.garage_jobs?.garage_customers?.name ?? "—";
      const e = map[name] ?? { name, revenue: 0 };
      e.revenue += invoiceTotal(inv);
      map[name] = e;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [invoices]);

  const topVehicles = useMemo(() => {
    const map: Record<string, { label: string; revenue: number }> = {};
    invoices.forEach((inv) => {
      const v = inv.garage_jobs?.garage_vehicles;
      const label = v ? `${[v.make, v.model].filter(Boolean).join(" ")}${v.registration_number ? ` (${v.registration_number})` : ""}` : "—";
      const e = map[label] ?? { label, revenue: 0 };
      e.revenue += invoiceTotal(inv);
      map[label] = e;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [invoices]);

  const mechanicWorkload = useMemo(() => {
    return mechanics.map((m) => {
      const mine = allOpenJobs.filter((j) => j.mechanic_id === m.id);
      const completedThisMonth = jobs.filter((j) => j.mechanic_id === m.id && j.status === "closed").length;
      return { name: m.name, active: mine.length, completed: completedThisMonth };
    }).filter((r) => r.active + r.completed > 0);
  }, [mechanics, allOpenJobs, jobs]);

  const supplierSpend = useMemo(() => {
    const map: Record<string, number> = {};
    purchaseOrders.forEach((po) => { const name = po.suppliers?.name ?? "—"; map[name] = (map[name] ?? 0) + po.spend; });
    return Object.entries(map).map(([supplier, spend]) => ({ supplier, spend })).sort((a, b) => b.spend - a.spend);
  }, [purchaseOrders]);

  const exportCSV = () => {
    const rows: string[][] = [];
    rows.push(["MachineCare Workshop Report", organisation?.name ?? "", month]);
    rows.push([]);
    rows.push(["Jobs completed", String(stats.completed)]);
    rows.push(["Jobs in progress (current)", String(allOpenJobs.length)]);
    rows.push(["Revenue", stats.revenue.toFixed(2)]);
    rows.push(["Parts revenue", stats.partsRevenue.toFixed(2)]);
    rows.push(["Labour revenue", stats.labourRevenue.toFixed(2)]);
    rows.push(["Estimated gross profit", stats.profit.toFixed(2)]);
    rows.push(["Average job value", stats.avgJobValue.toFixed(2)]);
    rows.push(["Outstanding (current)", stats.outstanding.toFixed(2)]);
    rows.push(["Collected this month", stats.collected.toFixed(2)]);
    rows.push([]);
    rows.push(["Top customers", "Revenue"]);
    topCustomers.forEach((c) => rows.push([c.name, c.revenue.toFixed(2)]));
    rows.push([]);
    rows.push(["Top vehicles", "Revenue"]);
    topVehicles.forEach((v) => rows.push([v.label, v.revenue.toFixed(2)]));
    rows.push([]);
    rows.push(["Mechanic", "Active jobs", "Completed this month"]);
    mechanicWorkload.forEach((m) => rows.push([m.name, String(m.active), String(m.completed)]));
    rows.push([]);
    rows.push(["Supplier", "Spend this month"]);
    supplierSpend.forEach((s) => rows.push([s.supplier, s.spend.toFixed(2)]));
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workshop-report-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Revenue, jobs, and profitability for the selected month.</p>
        </div>
        <div className="flex gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
          <Button onClick={exportCSV}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Revenue (invoiced)", value: formatMoney(stats.revenue) },
          { label: "Jobs completed", value: stats.completed, hint: `${allOpenJobs.length} currently in progress` },
          { label: "Outstanding (current)", value: formatMoney(stats.outstanding) },
          { label: "Average job value", value: formatMoney(stats.avgJobValue) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold">{s.value}</div>
            {s.hint && <div className="text-xs text-muted-foreground">{s.hint}</div>}
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground">Revenue breakdown</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">Parts revenue</div><div className="mt-1 text-lg font-semibold">{formatMoney(stats.partsRevenue)}</div></div>
          <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">Labour revenue</div><div className="mt-1 text-lg font-semibold">{formatMoney(stats.labourRevenue)}</div></div>
          <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">Estimated gross profit</div><div className={`mt-1 text-lg font-semibold ${stats.profit < 0 ? "text-destructive" : ""}`}>{formatMoney(stats.profit)}</div></div>
          <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">Collected this month</div><div className="mt-1 text-lg font-semibold">{formatMoney(stats.collected)}</div></div>
        </div>
      </section>

      {invoices.length === 0 ? (
        <EmptyState icon={<FileBarChart className="h-5 w-5" />} title="No invoices this month" description="Pick another month or issue an invoice." />
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-sm font-medium text-foreground">Top customers</h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm"><tbody>
                {topCustomers.map((c, idx) => (
                  <tr key={c.name} className="border-t border-border first:border-t-0"><td className="px-5 py-3 text-muted-foreground">{idx + 1}.</td><td className="px-5 py-3">{c.name}</td><td className="px-5 py-3 text-right font-medium">{formatMoney(c.revenue)}</td></tr>
                ))}
              </tbody></table>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium text-foreground">Top vehicles</h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm"><tbody>
                {topVehicles.map((v, idx) => (
                  <tr key={v.label} className="border-t border-border first:border-t-0"><td className="px-5 py-3 text-muted-foreground">{idx + 1}.</td><td className="px-5 py-3">{v.label}</td><td className="px-5 py-3 text-right font-medium">{formatMoney(v.revenue)}</td></tr>
                ))}
              </tbody></table>
            </div>
          </section>
        </>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground">Mechanic workload</h2>
        {mechanicWorkload.length === 0 ? <p className="text-sm text-muted-foreground">No jobs assigned to a mechanic.</p> : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Mechanic</th><th className="px-5 py-3 font-medium">Active jobs</th><th className="px-5 py-3 font-medium">Completed this month</th></tr></thead>
              <tbody>{mechanicWorkload.map((m) => (
                <tr key={m.name} className="border-t border-border"><td className="px-5 py-3 font-medium">{m.name}</td><td className="px-5 py-3">{m.active}</td><td className="px-5 py-3">{m.completed}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Low stock parts (current)</div>
          <div className="mt-1 text-2xl font-semibold">{formatNumber(lowStockCount)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Supplier spend this month</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoney(supplierSpend.reduce((s, r) => s + r.spend, 0))}</div>
        </div>
      </section>

      {supplierSpend.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-foreground">Supplier spending</h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Supplier</th><th className="px-5 py-3 font-medium">Spend</th></tr></thead>
              <tbody>{supplierSpend.map((s) => (
                <tr key={s.supplier} className="border-t border-border"><td className="px-5 py-3 font-medium">{s.supplier}</td><td className="px-5 py-3">{formatMoney(s.spend)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
