import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { FileText, Download, Printer } from "lucide-react";
import { formatDate } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Monthly reports</h1>
          <p className="text-sm text-muted-foreground">Maintenance and performance summary.</p>
        </div>
        <div className="flex gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
          <Button onClick={exportCSV}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        </div>
      </div>

      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">{organisation?.name ?? "MachineCare"} — Monthly Report</h1>
        <p className="text-sm">{month}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Work orders", value: stats.woTotal, hint: `${stats.woCompleted} completed` },
          { label: "Services performed", value: stats.services, hint: "" },
          { label: "Service cost", value: stats.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 }), hint: "" },
          { label: "Notifications", value: stats.notifs, hint: `${stats.critical} critical` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold">{s.value}</div>
            {s.hint && <div className="text-xs text-muted-foreground">{s.hint}</div>}
          </div>
        ))}
      </div>

      {perMachine.length === 0 ? (
        <EmptyState icon={<FileText className="h-5 w-5" />} title="No activity this month" description="Pick another month or log activity." />
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 text-sm font-medium">Activity by machine</div>
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

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Machine</th>
                  <th className="px-5 py-3 font-medium">Services</th>
                  <th className="px-5 py-3 font-medium">Work orders</th>
                  <th className="px-5 py-3 font-medium">Service cost</th>
                  <th className="px-5 py-3 font-medium">Avg OEE</th>
                </tr>
              </thead>
              <tbody>
                {perMachine.map((r) => (
                  <tr key={r.name} className="border-t border-border">
                    <td className="px-5 py-3 font-medium">{r.name}</td>
                    <td className="px-5 py-3">{r.services}</td>
                    <td className="px-5 py-3">{r.workOrders}</td>
                    <td className="px-5 py-3">{r.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="px-5 py-3">{r.oeeN > 0 ? `${r.oeeAvg.toFixed(1)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {services.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3 text-sm font-medium">Service logs ({services.length})</div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Machine</th>
                <th className="px-5 py-3 font-medium">Title</th>
                <th className="px-5 py-3 font-medium">Performed by</th>
                <th className="px-5 py-3 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-5 py-3">{formatDate(s.performed_at)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{s.machines?.name ?? "—"}</td>
                  <td className="px-5 py-3">{s.title}</td>
                  <td className="px-5 py-3 text-muted-foreground">{s.performed_by ?? "—"}</td>
                  <td className="px-5 py-3">{Number(s.cost || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
