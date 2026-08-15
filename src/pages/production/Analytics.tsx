import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO, subMonths, startOfMonth } from "date-fns";
import { ArrowLeft, BarChart2 } from "lucide-react";

type Range = "3m" | "6m" | "1y";

export default function ProductionAnalytics() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("6m");
  const [prod, setProd] = useState<any[]>([]);
  const [oee, setOee] = useState<any[]>([]);
  const [quality, setQuality] = useState<any[]>([]);

  const months = range === "3m" ? 3 : range === "6m" ? 6 : 12;

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const cutoff = subMonths(new Date(), months).toISOString().slice(0, 10);
      const orgId = profile.organisation_id;
      const [{ data: p }, { data: o }, { data: q }] = await Promise.all([
        supabase.from("production_kpis").select("record_date, target_units, actual_units, scrap_units, downtime_minutes, production_line").eq("organisation_id", orgId).gte("record_date", cutoff),
        supabase.from("oee_records").select("record_date, availability, performance, quality").eq("organisation_id", orgId).gte("record_date", cutoff),
        supabase.from("quality_reports").select("report_date, yield_percent, units_inspected, units_defective").eq("organisation_id", orgId).gte("report_date", cutoff),
      ]);
      setProd(p ?? []);
      setOee(o ?? []);
      setQuality(q ?? []);
      setLoading(false);
    })();
  }, [profile, months]);

  const monthKeys = useMemo(() => {
    const start = startOfMonth(subMonths(new Date(), months - 1));
    return Array.from({ length: months }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      return format(d, "yyyy-MM");
    });
  }, [months]);

  const attainmentTrend = useMemo(() => {
    const map = new Map<string, { target: number; actual: number }>();
    monthKeys.forEach((k) => map.set(k, { target: 0, actual: 0 }));
    prod.forEach((r) => {
      const key = format(parseISO(r.record_date), "yyyy-MM");
      const entry = map.get(key);
      if (entry) {
        entry.target += Number(r.target_units ?? 0);
        entry.actual += Number(r.actual_units ?? 0);
      }
    });
    return monthKeys.map((k) => {
      const e = map.get(k)!;
      return { month: format(parseISO(`${k}-01`), "MMM"), target: e.target, actual: e.actual, attainment: e.target > 0 ? Math.round((e.actual / e.target) * 100) : 0 };
    });
  }, [prod, monthKeys]);

  const oeeTrend = useMemo(() => {
    const map = new Map<string, { availability: number[]; performance: number[]; quality: number[] }>();
    monthKeys.forEach((k) => map.set(k, { availability: [], performance: [], quality: [] }));
    oee.forEach((r) => {
      const key = format(parseISO(r.record_date), "yyyy-MM");
      const entry = map.get(key);
      if (entry) {
        entry.availability.push(Number(r.availability ?? 0));
        entry.performance.push(Number(r.performance ?? 0));
        entry.quality.push(Number(r.quality ?? 0));
      }
    });
    const avg = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
    return monthKeys.map((k) => {
      const e = map.get(k)!;
      const availability = avg(e.availability), performance = avg(e.performance), quality = avg(e.quality);
      return { month: format(parseISO(`${k}-01`), "MMM"), oee: Math.round((availability * performance * quality) / 10000), availability: Math.round(availability), performance: Math.round(performance), quality: Math.round(quality) };
    });
  }, [oee, monthKeys]);

  const downtimeScrapTrend = useMemo(() => {
    const map = new Map<string, { downtime: number; scrap: number }>();
    monthKeys.forEach((k) => map.set(k, { downtime: 0, scrap: 0 }));
    prod.forEach((r) => {
      const key = format(parseISO(r.record_date), "yyyy-MM");
      const entry = map.get(key);
      if (entry) {
        entry.downtime += Number(r.downtime_minutes ?? 0);
        entry.scrap += Number(r.scrap_units ?? 0);
      }
    });
    return monthKeys.map((k) => ({ month: format(parseISO(`${k}-01`), "MMM"), ...map.get(k)! }));
  }, [prod, monthKeys]);

  const qualityTrend = useMemo(() => {
    const map = new Map<string, number[]>();
    monthKeys.forEach((k) => map.set(k, []));
    quality.forEach((r) => {
      const key = format(parseISO(r.report_date), "yyyy-MM");
      map.get(key)?.push(Number(r.yield_percent ?? 0));
    });
    return monthKeys.map((k) => {
      const arr = map.get(k)!;
      const avgYield = arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null;
      return { month: format(parseISO(`${k}-01`), "MMM"), yieldPercent: avgYield };
    });
  }, [quality, monthKeys]);

  const byLine = useMemo(() => {
    const map = new Map<string, { line: string; target: number; actual: number }>();
    prod.forEach((r) => {
      const key = r.production_line || "Unassigned";
      const entry = map.get(key) ?? { line: key, target: 0, actual: 0 };
      entry.target += Number(r.target_units ?? 0);
      entry.actual += Number(r.actual_units ?? 0);
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.actual - a.actual).slice(0, 8);
  }, [prod]);

  const hasData = prod.length > 0 || oee.length > 0 || quality.length > 0;

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/production/overview" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Production Overview
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Production Analytics</h1>
          <p className="text-sm text-muted-foreground">Attainment, OEE, downtime, scrap and quality trends over time.</p>
        </div>
        <select value={range} onChange={(e) => setRange(e.target.value as Range)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="3m">Last 3 months</option>
          <option value="6m">Last 6 months</option>
          <option value="1y">Last 12 months</option>
        </select>
      </div>

      {!hasData ? (
        <EmptyState icon={<BarChart2 className="h-5 w-5" />} title="No production data yet" description="Log production, OEE or quality entries to see trends here." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Attainment trend">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={attainmentTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="target" fill="#94a3b8" name="Target" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" fill="hsl(var(--primary))" name="Actual" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="OEE trend">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={oeeTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="oee" stroke="hsl(var(--primary))" strokeWidth={2} name="OEE %" />
                <Line type="monotone" dataKey="availability" stroke="#38bdf8" strokeWidth={1.5} name="Availability %" />
                <Line type="monotone" dataKey="performance" stroke="#a855f7" strokeWidth={1.5} name="Performance %" />
                <Line type="monotone" dataKey="quality" stroke="#f59e0b" strokeWidth={1.5} name="Quality %" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Downtime & scrap trend">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={downtimeScrapTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="downtime" fill="#ef4444" name="Downtime (min)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="scrap" fill="#f59e0b" name="Scrap (units)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Quality yield trend">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={qualityTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="yieldPercent" stroke="#10b981" strokeWidth={2} name="Yield %" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {byLine.length > 0 && (
            <Card title="Target vs actual by line">
              <ResponsiveContainer width="100%" height={Math.max(220, byLine.length * 40)}>
                <BarChart data={byLine} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="line" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="target" fill="#94a3b8" name="Target" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="actual" fill="hsl(var(--primary))" name="Actual" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
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
