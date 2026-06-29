import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { format, parseISO, subMonths, startOfMonth } from "date-fns";
import { BarChart2 } from "lucide-react";
import { formatMoney } from "@/lib/format";

const COLORS = ["hsl(161 70% 36%)", "hsl(217 91% 55%)", "hsl(38 92% 50%)", "hsl(280 70% 55%)", "hsl(0 75% 55%)"];

type Range = "3m" | "6m" | "1y" | "all";

export default function Analytics() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [range, setRange] = useState<Range>("1y");

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    supabase.from("service_logs").select("id, performed_at, cost, currency, service_type, machine_id, machines(name)")
      .order("performed_at", { ascending: false }).limit(2000)
      .then(({ data, error }) => {
        if (!error) setLogs(data ?? []);
        setLoading(false);
      });
  }, [profile]);

  const filtered = useMemo(() => {
    if (range === "all") return logs;
    const months = range === "3m" ? 3 : range === "6m" ? 6 : 12;
    const cutoff = subMonths(new Date(), months);
    return logs.filter((l) => new Date(l.performed_at) >= cutoff);
  }, [logs, range]);

  const perMonth = useMemo(() => {
    const map = new Map<string, number>();
    const start = startOfMonth(subMonths(new Date(), 11));
    for (let i = 0; i < 12; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      map.set(format(d, "yyyy-MM"), 0);
    }
    filtered.forEach((l) => {
      const key = format(parseISO(l.performed_at), "yyyy-MM");
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([k, v]) => ({ month: format(parseISO(k + "-01"), "MMM"), services: v }));
  }, [filtered]);

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((l) => {
      const k = l.service_type;
      map.set(k, (map.get(k) ?? 0) + Number(l.cost ?? 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  }, [filtered]);

  const mostServiced = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    filtered.forEach((l: any) => {
      const id = l.machine_id;
      const name = l.machines?.name ?? "—";
      const cur = map.get(id) ?? { name, count: 0 };
      cur.count += 1;
      map.set(id, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [filtered]);

  const mostExpensive = useMemo(() => {
    const map = new Map<string, { name: string; cost: number }>();
    filtered.forEach((l: any) => {
      const id = l.machine_id;
      const name = l.machines?.name ?? "—";
      const cur = map.get(id) ?? { name, cost: 0 };
      cur.cost += Number(l.cost ?? 0);
      map.set(id, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost).slice(0, 5);
  }, [filtered]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">Trends across your fleet's maintenance.</p>
        </div>
        <select value={range} onChange={(e) => setRange(e.target.value as Range)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="3m">Last 3 months</option>
          <option value="6m">Last 6 months</option>
          <option value="1y">Last 12 months</option>
          <option value="all">All time</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<BarChart2 className="h-5 w-5" />} title="No data yet" description="Log services to see analytics here." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Services per month">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={perMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="month" stroke="hsl(215 14% 45%)" fontSize={12} />
                <YAxis stroke="hsl(215 14% 45%)" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(220 13% 91%)" }} />
                <Bar dataKey="services" fill="hsl(161 70% 36%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Cost by service type">
            {byType.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={2}>
                    {byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatMoney(Number(v))} contentStyle={{ borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="Most serviced machines">
            {mostServiced.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={mostServiced} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                  <XAxis type="number" allowDecimals={false} stroke="hsl(215 14% 45%)" fontSize={12} />
                  <YAxis type="category" dataKey="name" stroke="hsl(215 14% 45%)" fontSize={12} width={120} />
                  <Tooltip contentStyle={{ borderRadius: 8 }} />
                  <Bar dataKey="count" fill="hsl(217 91% 55%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="Most expensive to maintain">
            {mostExpensive.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={mostExpensive} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                  <XAxis type="number" stroke="hsl(215 14% 45%)" fontSize={12} />
                  <YAxis type="category" dataKey="name" stroke="hsl(215 14% 45%)" fontSize={12} width={120} />
                  <Tooltip formatter={(v: any) => formatMoney(Number(v))} contentStyle={{ borderRadius: 8 }} />
                  <Bar dataKey="cost" fill="hsl(38 92% 50%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </div>
  );
}
function EmptyChart() { return <p className="py-10 text-center text-sm text-muted-foreground">No data in this range.</p>; }
