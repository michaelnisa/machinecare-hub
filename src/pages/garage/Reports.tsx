import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { FileBarChart, Download, Printer, LayoutDashboard, FileText, Wrench, DollarSign, Users, Truck, ShoppingCart, Calendar, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatMoney, formatNumber } from "@/lib/format";
import { invoiceTotal } from "@/lib/garage-money";
import { ReportDocumentWrapper } from "@/components/reports/ReportDocumentWrapper";

function monthBounds(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { startISO: start.toISOString(), endISO: end.toISOString() };
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
  const [viewMode, setViewMode] = useState<"dashboard" | "document">("dashboard");
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
      { data: allPay, error: e11 },
    ] = await Promise.all([
      (supabase as any).from("garage_jobs").select("*, garage_customers(name), garage_vehicles(make, model, registration_number)").gte("created_at", startISO).lt("created_at", endISO),
      (supabase as any).from("garage_jobs").select("id, status, mechanic_id"),
      (supabase as any).from("garage_invoices").select("*, garage_invoice_items(*), garage_jobs(mechanic_id, garage_customers(name), garage_vehicles(make, model, registration_number))").gte("issued_at", startISO).lt("issued_at", endISO),
      (supabase as any).from("garage_invoices").select("*, garage_invoice_items(*)"),
      (supabase as any).from("garage_payments").select("*").gte("paid_at", startISO).lt("paid_at", endISO),
      (supabase as any).from("garage_mechanics").select("id, name").eq("status", "active").order("name"),
      supabase.from("inventory_items").select("id, reorder_level").eq("status", "active"),
      (supabase as any).from("stock_balances").select("item_id, available_stock"),
      (supabase as any).from("purchase_orders").select("id, supplier_id, created_at, suppliers(name)").gte("created_at", startISO).lt("created_at", endISO),
      (supabase as any).from("purchase_order_items").select("purchase_order_id, quantity, unit_price"),
      // All payments (for outstanding invoices calculation) — was a serial query after Promise.all; now parallel
      (supabase as any).from("garage_payments").select("invoice_id, amount, type"),
    ]);
    const err = e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8 || e9 || e10 || e11;
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

  const mechanicPerformance = useMemo(() => {
    return mechanics.map((m) => {
      const activeJobs   = allOpenJobs.filter((j) => j.mechanic_id === m.id).length;
      const completedJobs = jobs.filter((j) => j.mechanic_id === m.id && j.status === "closed").length;
      const totalThisMonth = jobs.filter((j) => j.mechanic_id === m.id).length;
      const mechanicInvoices = invoices.filter((inv) => inv.garage_jobs?.mechanic_id === m.id);
      const revenue = mechanicInvoices.reduce((s, inv) => s + invoiceTotal(inv), 0);
      const avgValue = mechanicInvoices.length > 0 ? revenue / mechanicInvoices.length : 0;
      const completionRate = totalThisMonth > 0 ? Math.round((completedJobs / totalThisMonth) * 100) : null;
      return { id: m.id, name: m.name, activeJobs, completedJobs, totalThisMonth, revenue, avgValue, completionRate };
    }).filter((r) => r.activeJobs + r.totalThisMonth > 0);
  }, [mechanics, allOpenJobs, jobs, invoices]);

  // keep old for CSV export compat
  const mechanicWorkload = mechanicPerformance;

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
    rows.push(["Mechanic", "Active jobs", "Completed this month", "Revenue", "Avg job value", "Completion %"]);
    mechanicPerformance.forEach((m) => rows.push([m.name, String(m.activeJobs), String(m.completedJobs), m.revenue.toFixed(2), m.avgValue.toFixed(2), m.completionRate !== null ? String(m.completionRate) + "%" : ""]));
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

  if (viewMode === "document") {
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
          title="Workshop Commercial & Repair Performance Statement"
          subtitle={`Consolidated commercial repair billing, job card execution, technician labor output, and spare parts procurement for ${month}.`}
          documentNumber={`REF-WKS-${month.replace("-", "")}-001`}
          classification="OFFICIAL WORKSHOP STATEMENT"
          dateGenerated={new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
          periodBanner={`Billing Cycle: ${month} · Automotive Workshop & Commercial Repair Bays`}
          metadata={[
            { label: "Billing Cycle", value: month },
            { label: "Completed Jobs", value: `${stats.completed} Closed (${allOpenJobs.length} Open)` },
            { label: "Total Invoiced Revenue", value: formatMoney(stats.revenue) },
            { label: "Parts Revenue", value: formatMoney(stats.partsRevenue) },
            { label: "Labour Revenue", value: formatMoney(stats.labourRevenue) },
            { label: "Estimated Gross Profit", value: formatMoney(stats.profit) },
            { label: "Outstanding Receivables", value: formatMoney(stats.outstanding) },
            { label: "Realized Collections", value: formatMoney(stats.collected) },
          ]}
          signers={[
            { role: "Prepared By", name: profile?.full_name || "Workshop Service Advisor", title: "Commercial Workshop Supervisor" },
            { role: "Reviewed By", name: "Technical Workshop Manager", title: "Head of Garage Operations" },
            { role: "Approved By", name: "Managing Director", title: "Commercial Operations & Finance VP" },
          ]}
        >
          {/* Section 1: Financial Performance Summary */}
          <section className="mb-8">
            <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2 mb-4">
              <DollarSign className="h-5 w-5 text-slate-800" />
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-900">
                1. Commercial Billing & Profitability Summary
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border border-slate-300 bg-slate-50/70">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Gross Invoiced Revenue</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{formatMoney(stats.revenue)}</div>
                <div className="text-xs text-slate-600 mt-0.5">{invoices.length} invoices issued</div>
              </div>
              <div className="p-4 rounded-lg border border-slate-300 bg-slate-50/70">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Parts Billings</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{formatMoney(stats.partsRevenue)}</div>
                <div className="text-xs text-slate-600 mt-0.5">Spares & consumables markup</div>
              </div>
              <div className="p-4 rounded-lg border border-slate-300 bg-slate-50/70">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Technician Labour</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{formatMoney(stats.labourRevenue)}</div>
                <div className="text-xs text-slate-600 mt-0.5">Billed mechanic workshop hours</div>
              </div>
              <div className="p-4 rounded-lg border border-slate-300 bg-slate-50/70">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Estimated Gross Margin</div>
                <div className={`text-2xl font-black mt-1 ${stats.profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {formatMoney(stats.profit)}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">Net parts, labor & other costs</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div className="p-3.5 rounded-lg border border-slate-300 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Cash Collections Realized</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">{formatMoney(stats.collected)}</div>
                </div>
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                  Cleared Funds
                </span>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-300 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Outstanding Receivables</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">{formatMoney(stats.outstanding)}</div>
                </div>
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                  Uncollected AR
                </span>
              </div>
            </div>
          </section>

          {/* Section 2: Top Clients & Serviced Fleet */}
          <section className="mb-8">
            <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2 mb-4">
              <Users className="h-5 w-5 text-slate-800" />
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-900">
                2. Key Account Revenue & Vehicle Utilisation
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Customers */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <div className="bg-slate-100 border-b border-slate-300 px-4 py-2 font-bold text-[11px] uppercase tracking-wider text-slate-700">
                  Top Commercial Accounts
                </div>
                {topCustomers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">No account billing recorded.</div>
                ) : (
                  <table className="w-full text-xs text-slate-800">
                    <tbody className="divide-y divide-slate-200">
                      {topCustomers.map((c, idx) => (
                        <tr key={c.name} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-slate-500 w-8">{idx + 1}.</td>
                          <td className="px-4 py-2.5 font-semibold text-slate-900">{c.name}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">{formatMoney(c.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Top Vehicles */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <div className="bg-slate-100 border-b border-slate-300 px-4 py-2 font-bold text-[11px] uppercase tracking-wider text-slate-700">
                  Top Serviced Fleet Units
                </div>
                {topVehicles.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">No vehicle repair billing recorded.</div>
                ) : (
                  <table className="w-full text-xs text-slate-800">
                    <tbody className="divide-y divide-slate-200">
                      {topVehicles.map((v, idx) => (
                        <tr key={v.label} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-slate-500 w-8">{idx + 1}.</td>
                          <td className="px-4 py-2.5 font-semibold text-slate-900">{v.label}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">{formatMoney(v.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>

          {/* Section 3: Mechanic Performance Scorecard */}
          <section className="mb-8">
            <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2 mb-4">
              <Wrench className="h-5 w-5 text-slate-800" />
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-900">
                3. Mechanic & Bay Productivity Scorecard
              </h2>
            </div>
            {mechanicPerformance.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 border border-slate-200 rounded-lg">
                No technician job allocations recorded for this billing cycle.
              </div>
            ) : (
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-slate-800">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold uppercase text-[10px] text-slate-700 tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Mechanic Name</th>
                      <th className="px-4 py-2.5 text-center">Active Jobs</th>
                      <th className="px-4 py-2.5 text-center">Completed Jobs</th>
                      <th className="px-4 py-2.5 text-center">Completion Rate</th>
                      <th className="px-4 py-2.5 text-right">Invoiced Revenue</th>
                      <th className="px-4 py-2.5 text-right">Avg Job Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {mechanicPerformance.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-bold text-slate-900">{m.name}</td>
                        <td className="px-4 py-2.5 text-center text-slate-600">{m.activeJobs}</td>
                        <td className="px-4 py-2.5 text-center font-semibold text-slate-900">{m.completedJobs}</td>
                        <td className="px-4 py-2.5 text-center">
                          {m.completionRate !== null ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                              {m.completionRate}%
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">{formatMoney(m.revenue)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">
                          {m.avgValue > 0 ? formatMoney(m.avgValue) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 border-t border-slate-300 font-bold text-slate-900">
                    <tr>
                      <td className="px-4 py-2.5 uppercase">Consolidated Workshop Total</td>
                      <td className="px-4 py-2.5 text-center">
                        {mechanicPerformance.reduce((s, m) => s + m.activeJobs, 0)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {mechanicPerformance.reduce((s, m) => s + m.completedJobs, 0)}
                      </td>
                      <td className="px-4 py-2.5 text-center">—</td>
                      <td className="px-4 py-2.5 text-right">
                        {formatMoney(mechanicPerformance.reduce((s, m) => s + m.revenue, 0))}
                      </td>
                      <td className="px-4 py-2.5 text-right">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* Section 4: Spares Procurement & Supplier Spending */}
          <section className="mb-6">
            <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2 mb-4">
              <ShoppingCart className="h-5 w-5 text-slate-800" />
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-900">
                4. Spares Procurement & Supplier Outlays
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="p-3.5 rounded-lg border border-slate-300 bg-slate-50/70">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Critical Low Stock Reorder Items</div>
                <div className="text-xl font-black text-rose-700 mt-1">{formatNumber(lowStockCount)} parts</div>
                <div className="text-xs text-slate-600 mt-0.5">Below designated safety inventory thresholds</div>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-300 bg-slate-50/70">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Monthly Procurement Spend</div>
                <div className="text-xl font-black text-slate-900 mt-1">
                  {formatMoney(supplierSpend.reduce((s, r) => s + r.spend, 0))}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">{purchaseOrders.length} purchase orders processed</div>
              </div>
            </div>

            {supplierSpend.length > 0 && (
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-slate-800">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold uppercase text-[10px] text-slate-700 tracking-wider">
                    <tr>
                      <th className="px-4 py-2 text-left">Vendor / Supplier Name</th>
                      <th className="px-4 py-2 text-right">Invoiced Procurement Spend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {supplierSpend.map((s) => (
                      <tr key={s.supplier} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-900">{s.supplier}</td>
                        <td className="px-4 py-2 text-right font-bold text-slate-900">{formatMoney(s.spend)}</td>
                      </tr>
                    ))}
                  </tbody>
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
            <h1 className="text-2xl font-bold tracking-tight">Workshop Commercial Reports</h1>
            <Badge variant="outline" className="text-xs font-semibold bg-primary/10 text-primary border-primary/20">
              Commercial Garage
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Revenue, job turnaround, mechanic output & profitability for the selected billing cycle.
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
            title="Open formal printable workshop document view"
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

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Revenue (invoiced)", value: formatMoney(stats.revenue) },
          { label: "Jobs completed", value: stats.completed, hint: `${allOpenJobs.length} currently in progress` },
          { label: "Outstanding (current)", value: formatMoney(stats.outstanding) },
          { label: "Average job value", value: formatMoney(stats.avgJobValue) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{s.label}</div>
            <div className="mt-1 text-2xl font-bold">{s.value}</div>
            {s.hint && <div className="text-xs text-muted-foreground mt-0.5">{s.hint}</div>}
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Revenue breakdown</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <div className="text-xs text-muted-foreground font-semibold">Parts revenue</div>
            <div className="mt-1 text-lg font-bold">{formatMoney(stats.partsRevenue)}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <div className="text-xs text-muted-foreground font-semibold">Labour revenue</div>
            <div className="mt-1 text-lg font-bold">{formatMoney(stats.labourRevenue)}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <div className="text-xs text-muted-foreground font-semibold">Estimated gross profit</div>
            <div className={`mt-1 text-lg font-bold ${stats.profit < 0 ? "text-destructive" : "text-emerald-600"}`}>
              {formatMoney(stats.profit)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <div className="text-xs text-muted-foreground font-semibold">Collected this month</div>
            <div className="mt-1 text-lg font-bold">{formatMoney(stats.collected)}</div>
          </div>
        </div>
      </section>

      {invoices.length === 0 ? (
        <EmptyState icon={<FileBarChart className="h-5 w-5" />} title="No invoices this month" description="Pick another month or issue an invoice." />
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-foreground">Top customers</h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
              <table className="w-full text-sm">
                <tbody>
                  {topCustomers.map((c, idx) => (
                    <tr key={c.name} className="border-t border-border first:border-t-0 hover:bg-muted/30">
                      <td className="px-5 py-3 text-muted-foreground w-8">{idx + 1}.</td>
                      <td className="px-5 py-3 font-medium">{c.name}</td>
                      <td className="px-5 py-3 text-right font-semibold">{formatMoney(c.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-foreground">Top vehicles</h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
              <table className="w-full text-sm">
                <tbody>
                  {topVehicles.map((v, idx) => (
                    <tr key={v.label} className="border-t border-border first:border-t-0 hover:bg-muted/30">
                      <td className="px-5 py-3 text-muted-foreground w-8">{idx + 1}.</td>
                      <td className="px-5 py-3 font-medium">{v.label}</td>
                      <td className="px-5 py-3 text-right font-semibold">{formatMoney(v.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Mechanic performance</h2>
        {mechanicPerformance.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs assigned to mechanics yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
                <tr>
                  <th className="px-5 py-3 font-semibold">Mechanic</th>
                  <th className="px-5 py-3 font-semibold">Active</th>
                  <th className="px-5 py-3 font-semibold">Completed</th>
                  <th className="px-5 py-3 font-semibold">Completion %</th>
                  <th className="px-5 py-3 font-semibold text-right">Revenue</th>
                  <th className="px-5 py-3 font-semibold text-right">Avg job</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mechanicPerformance.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3 font-medium">{m.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{m.activeJobs}</td>
                    <td className="px-5 py-3 font-medium">{m.completedJobs}</td>
                    <td className="px-5 py-3">
                      {m.completionRate !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${m.completionRate}%` }} />
                          </div>
                          <span className="text-xs font-medium">{m.completionRate}%</span>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold">{formatMoney(m.revenue)}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{m.avgValue > 0 ? formatMoney(m.avgValue) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Low stock parts (current)</div>
          <div className="mt-1 text-2xl font-bold">{formatNumber(lowStockCount)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Supplier spend this month</div>
          <div className="mt-1 text-2xl font-bold">{formatMoney(supplierSpend.reduce((s, r) => s + r.spend, 0))}</div>
        </div>
      </section>

      {supplierSpend.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Supplier spending</h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
                <tr>
                  <th className="px-5 py-3 font-semibold">Supplier</th>
                  <th className="px-5 py-3 font-semibold text-right">Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {supplierSpend.map((s) => (
                  <tr key={s.supplier} className="hover:bg-muted/30">
                    <td className="px-5 py-3 font-medium">{s.supplier}</td>
                    <td className="px-5 py-3 text-right font-semibold">{formatMoney(s.spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
