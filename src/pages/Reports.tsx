import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { FileText, Download, Printer, LayoutDashboard, Wrench, ShieldCheck, CheckCircle2, AlertTriangle, Calendar, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ReportDocumentWrapper } from "@/components/reports/ReportDocumentWrapper";

function monthBounds(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { startISO: start.toISOString().slice(0, 10), endISO: end.toISOString().slice(0, 10) };
}

export default function Reports() {
  const { profile, organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [viewMode, setViewMode] = useState<"dashboard" | "document">("dashboard");
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [oee, setOee] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { startISO, endISO } = monthBounds(month);
    const [{ data: wo }, { data: sl }, { data: mn }, { data: oeeData }, { data: mach }] = await Promise.all([
      supabase.from("work_orders").select("*").gte("created_at", startISO).lt("created_at", endISO),
      supabase.from("service_logs").select("*, machines(name)").gte("performed_at", startISO).lt("performed_at", endISO),
      supabase.from("maintenance_notifications").select("*").gte("created_at", startISO).lt("created_at", endISO),
      supabase.from("oee_records").select("*, machines(name)").gte("record_date", startISO).lt("record_date", endISO),
      supabase.from("machines").select("id, name"),
    ]);
    const machineMap = new Map((mach ?? []).map((machine) => [machine.id, machine.name]));
    setWorkOrders((wo ?? []).map((order) => ({
      ...order,
      machine_name: machineMap.get(order.machine_id) ?? null,
    })));
    setServices(sl ?? []);
    setNotifications(mn ?? []);
    setOee(oeeData ?? []);
    setMachines(mach ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile, month]);

  const stats = useMemo(() => {
    const completed = workOrders.filter((w) => w.status === "completed").length;
    const open = workOrders.filter((w) => w.status !== "completed" && w.status !== "cancelled").length;
    const totalCost = services.reduce((s, x) => s + (Number(x.cost) || 0), 0);
    const critical = notifications.filter((n) => n.severity === "critical").length;
    return { woTotal: workOrders.length, woCompleted: completed, woOpen: open, services: services.length, totalCost, notifs: notifications.length, critical };
  }, [workOrders, services, notifications]);

  const perMachine = useMemo(() => {
    const map: Record<string, { name: string; services: number; workOrders: number; cost: number; oeeAvg: number; oeeN: number }> = {};
    machines.forEach((m) => { map[m.id] = { name: m.name, services: 0, workOrders: 0, cost: 0, oeeAvg: 0, oeeN: 0 }; });
    services.forEach((s) => { if (map[s.machine_id]) { map[s.machine_id].services++; map[s.machine_id].cost += Number(s.cost) || 0; } });
    workOrders.forEach((w) => { if (map[w.machine_id]) map[w.machine_id].workOrders++; });
    oee.forEach((r) => {
      const m = map[r.machine_id];
      if (m) {
        const v = Number(r.availability) * Number(r.performance) * Number(r.quality) / 10000;
        m.oeeAvg = (m.oeeAvg * m.oeeN + v) / (m.oeeN + 1);
        m.oeeN++;
      }
    });
    return Object.values(map).filter((r) => r.services + r.workOrders + r.oeeN > 0);
  }, [machines, services, workOrders, oee]);

  const exportCSV = () => {
    const rows: string[][] = [];
    rows.push(["MachineCare Monthly Report", organisation?.name ?? "", month]);
    rows.push([]);
    rows.push(["Summary"]);
    rows.push(["Work orders (total)", String(stats.woTotal)]);
    rows.push(["Work orders completed", String(stats.woCompleted)]);
    rows.push(["Work orders open/in-progress", String(stats.woOpen)]);
    rows.push(["Services performed", String(stats.services)]);
    rows.push(["Total service cost", stats.totalCost.toFixed(2)]);
    rows.push(["Notifications raised", String(stats.notifs)]);
    rows.push(["Critical notifications", String(stats.critical)]);
    rows.push([]);
    rows.push(["Per machine"]);
    rows.push(["Machine", "Services", "Work orders", "Service cost", "Avg OEE %"]);
    perMachine.forEach((r) => rows.push([r.name, String(r.services), String(r.workOrders), r.cost.toFixed(2), r.oeeN > 0 ? r.oeeAvg.toFixed(1) : "—"]));
    rows.push([]);
    rows.push(["Service logs"]);
    rows.push(["Date", "Machine", "Type", "Title", "Performed by", "Cost"]);
    services.forEach((s) => rows.push([s.performed_at ?? "", s.machines?.name ?? "", s.service_type ?? "", s.title ?? "", s.performed_by ?? "", String(s.cost ?? "")]));
    rows.push([]);
    rows.push(["Work orders"]);
    rows.push(["Created", "Machine", "Title", "Priority", "Status", "Due"]);
    workOrders.forEach((w) => rows.push([(w.created_at ?? "").slice(0, 10), w.machine_name ?? "", w.title ?? "", w.priority ?? "", w.status ?? "", w.due_date ?? ""]));
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `machinecare-report-${month}.csv`;
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
          title="Monthly Maintenance & Asset Performance Statement"
          subtitle={`Consolidated operational log, equipment reliability indices, service costs, and maintenance work orders for period ${month}.`}
          documentNumber={`REF-MNT-${month.replace("-", "")}-001`}
          classification="OFFICIAL AUDIT REPORT"
          dateGenerated={new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
          periodBanner={`Reporting Cycle: ${month} · Plantwide Production Lines & Equipment`}
          metadata={[
            { label: "Reporting Period", value: month },
            { label: "Monitored Assets", value: `${machines.length} Units` },
            { label: "Total Work Orders", value: `${stats.woTotal} (${stats.woCompleted} Closed)` },
            { label: "Resolution Rate", value: `${stats.woTotal > 0 ? Math.round((stats.woCompleted / stats.woTotal) * 100) : 100}%` },
            { label: "Direct Service Cost", value: formatMoney(stats.totalCost) },
            { label: "Critical Incidents", value: `${stats.critical} Alerts` },
          ]}
          signers={[
            { role: "Prepared By", name: profile?.full_name || "Lead Maintenance Technician", title: "Plant Maintenance Supervisor" },
            { role: "Reviewed By", name: "Operations Director", title: "Head of Plant Engineering" },
            { role: "Approved By", name: "General Manager", title: "Managing Director & Operations VP" },
          ]}
        >
          {/* Section 1: Executive KPI Metrics */}
          <section className="mb-8">
            <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2 mb-4">
              <Wrench className="h-5 w-5 text-slate-800" />
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-900">
                1. Executive Operational & Cost Summary
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border border-slate-300 bg-slate-50/70">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Total Work Orders</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{stats.woTotal}</div>
                <div className="text-xs text-slate-600 mt-0.5">{stats.woCompleted} completed · {stats.woOpen} pending</div>
              </div>
              <div className="p-4 rounded-lg border border-slate-300 bg-slate-50/70">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Services Executed</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{stats.services}</div>
                <div className="text-xs text-slate-600 mt-0.5">Preventative & corrective interventions</div>
              </div>
              <div className="p-4 rounded-lg border border-slate-300 bg-slate-50/70">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Total Service Spend</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{formatMoney(stats.totalCost)}</div>
                <div className="text-xs text-slate-600 mt-0.5">Labor, spares & outsourced repairs</div>
              </div>
              <div className="p-4 rounded-lg border border-slate-300 bg-slate-50/70">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Incident Alerts</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{stats.notifs}</div>
                <div className="text-xs text-rose-600 font-semibold mt-0.5">{stats.critical} critical urgency</div>
              </div>
            </div>
          </section>

          {/* Section 2: Machine Reliability & Activity Breakdown */}
          <section className="mb-8">
            <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2 mb-4">
              <Layers className="h-5 w-5 text-slate-800" />
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-900">
                2. Asset Activity & Reliability Matrix
              </h2>
            </div>
            {perMachine.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 border border-slate-200 rounded-lg">
                No asset maintenance activity recorded for cycle {month}.
              </div>
            ) : (
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-slate-800">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold uppercase text-[10px] text-slate-700 tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Equipment / Machine</th>
                      <th className="px-4 py-2.5 text-center">Services</th>
                      <th className="px-4 py-2.5 text-center">Work Orders</th>
                      <th className="px-4 py-2.5 text-right">Service Cost</th>
                      <th className="px-4 py-2.5 text-center">Avg OEE</th>
                      <th className="px-4 py-2.5 text-right">Operating Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {perMachine.map((r) => {
                      const oeeVal = r.oeeN > 0 ? r.oeeAvg : null;
                      return (
                        <tr key={r.name} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-slate-900">{r.name}</td>
                          <td className="px-4 py-2.5 text-center">{r.services}</td>
                          <td className="px-4 py-2.5 text-center">{r.workOrders}</td>
                          <td className="px-4 py-2.5 text-right font-medium">{formatMoney(r.cost)}</td>
                          <td className="px-4 py-2.5 text-center font-bold">
                            {oeeVal !== null ? `${oeeVal.toFixed(1)}%` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Active / Monitored
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 border-t border-slate-300 font-bold text-slate-900">
                    <tr>
                      <td className="px-4 py-2.5 uppercase">Consolidated Total</td>
                      <td className="px-4 py-2.5 text-center">{stats.services}</td>
                      <td className="px-4 py-2.5 text-center">{stats.woTotal}</td>
                      <td className="px-4 py-2.5 text-right">{formatMoney(stats.totalCost)}</td>
                      <td className="px-4 py-2.5 text-center">—</td>
                      <td className="px-4 py-2.5 text-right">{perMachine.length} Active Machines</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* Section 3: Completed Service Logs */}
          <section className="mb-8">
            <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2 mb-4">
              <CheckCircle2 className="h-5 w-5 text-slate-800" />
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-900">
                3. Maintenance Interventions & Service Logs ({services.length})
              </h2>
            </div>
            {services.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 border border-slate-200 rounded-lg">
                No individual service logs executed in period {month}.
              </div>
            ) : (
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-slate-800">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold uppercase text-[10px] text-slate-700 tracking-wider">
                    <tr>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Machine / Asset</th>
                      <th className="px-4 py-2 text-left">Intervention Title</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Technician / Vendor</th>
                      <th className="px-4 py-2 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {services.slice(0, 30).map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 whitespace-nowrap">{formatDate(s.performed_at)}</td>
                        <td className="px-4 py-2 font-semibold text-slate-900">{s.machines?.name ?? "—"}</td>
                        <td className="px-4 py-2 text-slate-800">{s.title}</td>
                        <td className="px-4 py-2 capitalize text-slate-600">{s.service_type || "Routine"}</td>
                        <td className="px-4 py-2 text-slate-600">{s.performed_by ?? "—"}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatMoney(Number(s.cost) || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {services.length > 30 && (
                  <div className="px-4 py-2 bg-slate-50 text-[11px] text-slate-500 italic text-center border-t border-slate-200">
                    Displaying first 30 of {services.length} recorded service logs. Full ledger available in CSV export.
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Section 4: Work Orders Register */}
          <section className="mb-6">
            <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2 mb-4">
              <ShieldCheck className="h-5 w-5 text-slate-800" />
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-900">
                4. Work Orders Operational Register ({workOrders.length})
              </h2>
            </div>
            {workOrders.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 border border-slate-200 rounded-lg">
                No work orders registered in cycle {month}.
              </div>
            ) : (
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-slate-800">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold uppercase text-[10px] text-slate-700 tracking-wider">
                    <tr>
                      <th className="px-4 py-2 text-left">Created</th>
                      <th className="px-4 py-2 text-left">Machine</th>
                      <th className="px-4 py-2 text-left">Work Order Title</th>
                      <th className="px-4 py-2 text-center">Priority</th>
                      <th className="px-4 py-2 text-center">Status</th>
                      <th className="px-4 py-2 text-right">Target Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {workOrders.slice(0, 25).map((w) => (
                      <tr key={w.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 whitespace-nowrap">{(w.created_at ?? "").slice(0, 10)}</td>
                        <td className="px-4 py-2 font-semibold text-slate-900">{w.machine_name ?? "—"}</td>
                        <td className="px-4 py-2 text-slate-800">{w.title}</td>
                        <td className="px-4 py-2 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              w.priority === "critical" || w.priority === "high"
                                ? "bg-rose-100 text-rose-800 border border-rose-300"
                                : "bg-slate-100 text-slate-800 border border-slate-300"
                            }`}
                          >
                            {w.priority || "normal"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              w.status === "completed"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}
                          >
                            {w.status || "open"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-slate-600">{w.due_date ? formatDate(w.due_date) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {workOrders.length > 25 && (
                  <div className="px-4 py-2 bg-slate-50 text-[11px] text-slate-500 italic text-center border-t border-slate-200">
                    Displaying first 25 of {workOrders.length} work orders. Full ledger available in CSV export.
                  </div>
                )}
              </div>
            )}
          </section>
        </ReportDocumentWrapper>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header Bar */}
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Monthly Maintenance Reports</h1>
            <Badge variant="outline" className="text-xs font-semibold bg-primary/10 text-primary border-primary/20">
              Plant Operations
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Consolidated maintenance performance, asset availability & cost audit.
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
            title="Open board-ready printable corporate document view"
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
          { label: "Work orders", value: stats.woTotal, hint: `${stats.woCompleted} completed · ${stats.woOpen} open` },
          { label: "Services performed", value: stats.services, hint: "Total maintenance tasks" },
          { label: "Total service cost", value: formatMoney(stats.totalCost), hint: "Labor, spares & outsourced" },
          { label: "Notifications raised", value: stats.notifs, hint: `${stats.critical} critical severity` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{s.label}</div>
            <div className="mt-1 text-2xl font-bold">{s.value}</div>
            {s.hint && <div className="text-xs text-muted-foreground mt-0.5">{s.hint}</div>}
          </div>
        ))}
      </div>

      {perMachine.length === 0 ? (
        <EmptyState icon={<FileText className="h-5 w-5" />} title="No activity this month" description="Pick another month or log activity." />
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <div className="mb-2 text-sm font-semibold">Activity & Services by Machine</div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perMachine}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="services" fill="hsl(var(--primary))" name="Services" />
                  <Bar dataKey="workOrders" fill="#f59e0b" name="Work orders" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
            <div className="border-b border-border px-5 py-3 text-sm font-semibold">
              Machine Breakdown & Average OEE ({perMachine.length})
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
                <tr>
                  <th className="px-5 py-3 font-semibold">Machine</th>
                  <th className="px-5 py-3 font-semibold">Services</th>
                  <th className="px-5 py-3 font-semibold">Work orders</th>
                  <th className="px-5 py-3 font-semibold">Service cost</th>
                  <th className="px-5 py-3 font-semibold">Avg OEE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {perMachine.map((r) => (
                  <tr key={r.name} className="hover:bg-muted/30">
                    <td className="px-5 py-3 font-medium">{r.name}</td>
                    <td className="px-5 py-3">{r.services}</td>
                    <td className="px-5 py-3">{r.workOrders}</td>
                    <td className="px-5 py-3 font-medium">{formatMoney(r.cost)}</td>
                    <td className="px-5 py-3">{r.oeeN > 0 ? `${r.oeeAvg.toFixed(1)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {services.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
          <div className="border-b border-border px-5 py-3 text-sm font-semibold">
            Recorded Service Logs ({services.length})
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
              <tr>
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold">Machine</th>
                <th className="px-5 py-3 font-semibold">Title</th>
                <th className="px-5 py-3 font-semibold">Performed by</th>
                <th className="px-5 py-3 font-semibold text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3">{formatDate(s.performed_at)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{s.machines?.name ?? "—"}</td>
                  <td className="px-5 py-3 font-medium">{s.title}</td>
                  <td className="px-5 py-3 text-muted-foreground">{s.performed_by ?? "—"}</td>
                  <td className="px-5 py-3 text-right font-medium">{formatMoney(Number(s.cost) || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
