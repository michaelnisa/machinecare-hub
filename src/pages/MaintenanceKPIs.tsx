import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Wrench } from "lucide-react";
import { MaintenanceAlerts } from "@/components/MaintenanceAlerts";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function monthBounds(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

export default function MaintenanceKPIs() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [machines, setMachines] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [downtime, setDowntime] = useState<any[]>([]);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { startISO, endISO } = monthBounds(month);
    const [{ data: m }, { data: sl }, { data: wo }, { data: sch }, { data: prod }] = await Promise.all([
      supabase.from("machines").select("id, name, status"),
      supabase.from("service_logs").select("*, machines(name)").gte("performed_at", startISO.slice(0, 10)).lt("performed_at", endISO.slice(0, 10)),
      supabase.from("work_orders").select("*").gte("created_at", startISO).lt("created_at", endISO),
      supabase.from("service_schedules").select("*"),
      supabase.from("production_kpis").select("machine_id, downtime_minutes, record_date").gte("record_date", startISO.slice(0, 10)).lt("record_date", endISO.slice(0, 10)),
    ]);
    setMachines(m ?? []);
    setServices(sl ?? []);
    setWorkOrders(wo ?? []);
    setSchedules(sch ?? []);
    setDowntime(prod ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile, month]);

  const stats = useMemo(() => {
    const repairs = services.filter((s) => s.service_type === "repair").length;
    const totalDownMin = downtime.reduce((s, x) => s + (x.downtime_minutes || 0), 0);
    const totalDownHrs = totalDownMin / 60;
    const [y, m] = month.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const operatingHrs = daysInMonth * 24 * Math.max(1, machines.length);
    const mtbf = repairs > 0 ? operatingHrs / repairs : operatingHrs;
    const mttr = repairs > 0 ? totalDownHrs / repairs : 0;
    const overdue = schedules.filter((s) => s.next_due_date && new Date(s.next_due_date) < new Date()).length;
    const totalSch = schedules.length;
    const pmComp = totalSch > 0 ? ((totalSch - overdue) / totalSch * 100) : 100;
    const closedStatuses = new Set(["done", "completed", "closed", "cancelled"]);
    const woOpen = workOrders.filter((w) => !closedStatuses.has(w.status)).length;
    const woCompleted = workOrders.filter((w) => w.status === "done" || w.status === "completed").length;
    const woComp = workOrders.length > 0 ? (woCompleted / workOrders.length * 100) : 0;
    // Planned vs unplanned by work_type
    const planned = workOrders.filter((w) => ["preventive", "inspection"].includes(w.work_type)).length;
    const unplanned = workOrders.filter((w) => ["breakdown", "repair"].includes(w.work_type)).length;
    const plannedRatio = planned + unplanned > 0 ? (planned / (planned + unplanned)) * 100 : 0;
    const cost = services.reduce((s, x) => s + (Number(x.cost) || 0), 0);
    return { repairs, totalDownHrs, mtbf, mttr, pmComp, overdue, woOpen, woCompleted, woComp, planned, unplanned, plannedRatio, cost };
  }, [services, downtime, machines, schedules, workOrders, month]);

  const perMachine = useMemo(() => {
    const map: Record<string, any> = {};
    machines.forEach((m) => { map[m.id] = { name: m.name, repairs: 0, downtimeHrs: 0, services: 0, cost: 0 }; });
    services.forEach((s) => {
      if (!map[s.machine_id]) return;
      map[s.machine_id].services++;
      if (s.service_type === "repair") map[s.machine_id].repairs++;
      map[s.machine_id].cost += Number(s.cost) || 0;
    });
    downtime.forEach((d) => { if (map[d.machine_id]) map[d.machine_id].downtimeHrs += (d.downtime_minutes || 0) / 60; });
    return Object.values(map).filter((r: any) => r.services + r.downtimeHrs > 0);
  }, [machines, services, downtime]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Maintenance KPIs</h1>
          <p className="text-sm text-muted-foreground">MTBF, MTTR, PM compliance and backlog.</p>
        </div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
      </div>

      <MaintenanceAlerts />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "MTBF (hrs)", value: stats.mtbf.toFixed(1), hint: "Mean time between failures" },
          { label: "MTTR (hrs)", value: stats.mttr.toFixed(2), hint: "Mean time to repair" },
          { label: "PM compliance", value: `${stats.pmComp.toFixed(0)}%`, hint: `${stats.overdue} overdue` },
          { label: "Downtime (hrs)", value: stats.totalDownHrs.toFixed(1), hint: `${stats.repairs} repairs` },
          { label: "Work orders open", value: stats.woOpen, hint: `${stats.woCompleted} done` },
          { label: "Planned ratio", value: `${stats.plannedRatio.toFixed(0)}%`, hint: `${stats.planned} planned / ${stats.unplanned} unplanned` },
          { label: "Repairs", value: stats.repairs, hint: "" },
          { label: "Maint. cost", value: stats.cost.toLocaleString(undefined, { maximumFractionDigits: 0 }), hint: "" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold">{s.value}</div>
            {s.hint && <div className="text-xs text-muted-foreground">{s.hint}</div>}
          </div>
        ))}
      </div>

      {perMachine.length === 0 ? (
        <EmptyState icon={<Wrench className="h-5 w-5" />} title="No data this month" description="Pick another month or log activity." />
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 text-sm font-medium">Downtime & repairs by machine</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perMachine}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="downtimeHrs" fill="#ef4444" name="Downtime (hrs)" />
                  <Bar dataKey="repairs" fill="hsl(var(--primary))" name="Repairs" />
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
                  <th className="px-5 py-3 font-medium">Repairs</th>
                  <th className="px-5 py-3 font-medium">Downtime (hrs)</th>
                  <th className="px-5 py-3 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {perMachine.map((r: any) => (
                  <tr key={r.name} className="border-t border-border">
                    <td className="px-5 py-3 font-medium">{r.name}</td>
                    <td className="px-5 py-3">{r.services}</td>
                    <td className="px-5 py-3">{r.repairs}</td>
                    <td className="px-5 py-3">{r.downtimeHrs.toFixed(1)}</td>
                    <td className="px-5 py-3">{r.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
