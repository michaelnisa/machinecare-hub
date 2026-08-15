import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/PageLoader";
import { formatTZS } from "@/lib/format";
import {
  Target, Gauge, AlertTriangle, Star, Zap, CalendarRange, ClipboardList,
  AlertOctagon, Recycle, BarChart2, History, FileText, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

function pct(n: number) {
  return `${Math.round(n)}%`;
}

function colorFor(value: number, good = 85, warn = 65) {
  if (value >= good) return "text-emerald-600";
  if (value >= warn) return "text-amber-600";
  return "text-red-600";
}

function StatCard({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <div className={cn("mt-2 text-3xl font-semibold", accent)}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function SectionLink({ to, icon: Icon, label, description, comingSoon }: { to: string; icon: any; label: string; description: string; comingSoon?: boolean }) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
          {comingSoon && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">Soon</span>}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

export default function ProductionOverview() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [prodToday, setProdToday] = useState<any[]>([]);
  const [oee7d, setOee7d] = useState<any[]>([]);
  const [qualityToday, setQualityToday] = useState<any[]>([]);
  const [utilitiesToday, setUtilitiesToday] = useState<any[]>([]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const today = new Date().toISOString().slice(0, 10);
      const d7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const [{ data: prod }, { data: oee }, { data: quality }, { data: utils }] = await Promise.all([
        supabase.from("production_kpis").select("target_units, actual_units, scrap_units, downtime_minutes, production_line").eq("organisation_id", profile.organisation_id).eq("record_date", today),
        supabase.from("oee_records").select("availability, performance, quality").eq("organisation_id", profile.organisation_id).gte("record_date", d7),
        supabase.from("quality_reports").select("units_inspected, units_defective, units_scrap, units_rework, yield_percent").eq("organisation_id", profile.organisation_id).eq("report_date", today),
        (supabase as any).from("utilities_kpis").select("utility_type, consumption, cost, unit").eq("organisation_id", profile.organisation_id).eq("record_date", today),
      ]);
      setProdToday(prod ?? []);
      setOee7d(oee ?? []);
      setQualityToday(quality ?? []);
      setUtilitiesToday(utils ?? []);
      setLoading(false);
    })();
  }, [profile]);

  const stats = useMemo(() => {
    const actual = prodToday.reduce((s, r) => s + Number(r.actual_units ?? 0), 0);
    const target = prodToday.reduce((s, r) => s + Number(r.target_units ?? 0), 0);
    const scrap = prodToday.reduce((s, r) => s + Number(r.scrap_units ?? 0), 0);
    const downtime = prodToday.reduce((s, r) => s + Number(r.downtime_minutes ?? 0), 0);
    const attainment = target > 0 ? (actual / target) * 100 : 0;
    const lines = new Set(prodToday.map((r) => r.production_line).filter(Boolean)).size;

    const avg = (k: "availability" | "performance" | "quality") =>
      oee7d.length ? oee7d.reduce((s, r) => s + Number(r[k] ?? 0), 0) / oee7d.length : 0;
    const availability = avg("availability");
    const performance = avg("performance");
    const qualityFactor = avg("quality");
    const oee = (availability * performance * qualityFactor) / 10000;

    const inspected = qualityToday.reduce((s, r) => s + Number(r.units_inspected ?? 0), 0);
    const yieldPct = qualityToday.length
      ? qualityToday.reduce((s, r) => s + Number(r.yield_percent ?? 0), 0) / qualityToday.length
      : 0;

    const utilCost = utilitiesToday.reduce((s: number, r: any) => s + Number(r.cost ?? 0), 0);

    return { actual, target, scrap, downtime, attainment, lines, oee, inspected, yieldPct, utilCost };
  }, [prodToday, oee7d, qualityToday, utilitiesToday]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Production Overview</h1>
        <p className="text-sm text-muted-foreground">Today's status across every line, at a glance.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Target}
          label="Attainment (today)"
          value={pct(stats.attainment)}
          sub={`${stats.actual.toLocaleString()} / ${stats.target.toLocaleString()} units${stats.lines ? ` · ${stats.lines} lines` : ""}`}
          accent={colorFor(stats.attainment, 95, 75)}
        />
        <StatCard
          icon={Gauge}
          label="OEE (7d avg)"
          value={pct(stats.oee)}
          accent={colorFor(stats.oee, 85, 60)}
        />
        <StatCard
          icon={AlertTriangle}
          label="Downtime (today)"
          value={`${Math.floor(stats.downtime / 60)}h ${stats.downtime % 60}m`}
          sub={`${stats.scrap.toLocaleString()} scrap units`}
          accent={stats.downtime === 0 ? "text-emerald-600" : "text-amber-600"}
        />
        <StatCard
          icon={Star}
          label="Quality yield (today)"
          value={stats.inspected > 0 ? pct(stats.yieldPct) : "—"}
          sub={stats.inspected > 0 ? `${stats.inspected.toLocaleString()} inspected` : "No inspections logged"}
          accent={colorFor(stats.yieldPct, 98, 90)}
        />
      </div>

      {stats.utilCost > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <Zap className="mr-2 inline h-4 w-4 text-amber-500" />
          Utilities cost today: <span className="font-medium text-foreground">{formatTZS(stats.utilCost)}</span>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Production</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SectionLink to="/production/planning" icon={CalendarRange} label="Production Planning" description="Set daily/shift targets ahead of time." />
          <SectionLink to="/production/orders" icon={ClipboardList} label="Production Orders" description="What to produce, how much, by when." />
          <SectionLink to="/production" icon={Target} label="Production KPI" description="Log daily production, targets and scrap." />
          <SectionLink to="/oee" icon={Gauge} label="OEE" description="Availability, performance, quality." />
          <SectionLink to="/production/downtime" icon={AlertOctagon} label="Downtime" description="Downtime by reason, machine and line." />
          <SectionLink to="/quality" icon={Star} label="Quality" description="Inspections, defects, yield." />
          <SectionLink to="/production/material-waste" icon={Recycle} label="Material & Waste" description="Scrap and material consumption." />
          <SectionLink to="/utilities" icon={Zap} label="Utilities" description="Electricity, fuel and water vs budget." />
          <SectionLink to="/production/analytics" icon={BarChart2} label="Analytics" description="Attainment, OEE, downtime, scrap and quality trends." />
          <SectionLink to="/production/history" icon={History} label="Production History" description="Full chronological production log." />
          <SectionLink to="/reports" icon={FileText} label="Reports" description="Monthly report export." />
        </div>
      </div>
    </div>
  );
}
