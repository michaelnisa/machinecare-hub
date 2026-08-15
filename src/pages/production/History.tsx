import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { formatDate } from "@/lib/format";
import { ArrowLeft, History, Target, Gauge, Star } from "lucide-react";
import { cn } from "@/lib/utils";

function monthBounds(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { startISO: start.toISOString().slice(0, 10), endISO: end.toISOString().slice(0, 10) };
}

type TimelineItem = {
  id: string;
  date: string;
  kind: "production" | "oee" | "quality";
  title: string;
  subtitle: string;
  line?: string | null;
  shift?: string | null;
};

export default function ProductionHistory() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [lineFilter, setLineFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState<"all" | TimelineItem["kind"]>("all");

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { startISO, endISO } = monthBounds(month);
      const orgId = profile.organisation_id;
      const [{ data: prod }, { data: oee }, { data: quality }] = await Promise.all([
        supabase.from("production_kpis").select("id, record_date, shift, production_line, product, target_units, actual_units, scrap_units, downtime_minutes, machines(name)").eq("organisation_id", orgId).gte("record_date", startISO).lt("record_date", endISO),
        supabase.from("oee_records").select("id, record_date, shift, availability, performance, quality, machines(name)").eq("organisation_id", orgId).gte("record_date", startISO).lt("record_date", endISO),
        supabase.from("quality_reports").select("id, report_date, product, yield_percent, units_inspected, units_defective, machines(name)").eq("organisation_id", orgId).gte("report_date", startISO).lt("report_date", endISO),
      ]);

      const prodItems: TimelineItem[] = (prod ?? []).map((p: any) => ({
        id: `prod-${p.id}`,
        date: p.record_date,
        kind: "production",
        title: `${p.actual_units ?? 0} / ${p.target_units ?? 0} units${p.product ? ` · ${p.product}` : ""}`,
        subtitle: `${p.machines?.name ?? p.production_line ?? "—"}${p.scrap_units ? ` · ${p.scrap_units} scrap` : ""}${p.downtime_minutes ? ` · ${p.downtime_minutes}m downtime` : ""}`,
        line: p.production_line,
        shift: p.shift,
      }));

      const oeeItems: TimelineItem[] = (oee ?? []).map((o: any) => {
        const oeeVal = ((Number(o.availability ?? 0) * Number(o.performance ?? 0) * Number(o.quality ?? 0)) / 10000).toFixed(0);
        return {
          id: `oee-${o.id}`,
          date: o.record_date,
          kind: "oee",
          title: `OEE ${oeeVal}%`,
          subtitle: `${o.machines?.name ?? "—"} · A ${Math.round(o.availability ?? 0)}% · P ${Math.round(o.performance ?? 0)}% · Q ${Math.round(o.quality ?? 0)}%`,
          shift: o.shift,
        };
      });

      const qualityItems: TimelineItem[] = (quality ?? []).map((q: any) => ({
        id: `quality-${q.id}`,
        date: q.report_date,
        kind: "quality",
        title: `Yield ${q.yield_percent != null ? Math.round(q.yield_percent) : "—"}%${q.product ? ` · ${q.product}` : ""}`,
        subtitle: `${q.machines?.name ?? "—"} · ${q.units_inspected ?? 0} inspected, ${q.units_defective ?? 0} defective`,
      }));

      const all = [...prodItems, ...oeeItems, ...qualityItems].sort((a, b) => (a.date < b.date ? 1 : -1));
      setItems(all);
      setLoading(false);
    })();
  }, [profile, month]);

  const lines = useMemo(() => Array.from(new Set(items.map((i) => i.line).filter(Boolean))) as string[], [items]);
  const shifts = useMemo(() => Array.from(new Set(items.map((i) => i.shift).filter(Boolean))) as string[], [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (kindFilter !== "all" && i.kind !== kindFilter) return false;
      if (lineFilter !== "all" && i.line !== lineFilter) return false;
      if (shiftFilter !== "all" && i.shift !== shiftFilter) return false;
      return true;
    });
  }, [items, kindFilter, lineFilter, shiftFilter]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/production/overview" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Production Overview
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Production History</h1>
          <p className="text-sm text-muted-foreground">Every production, OEE and quality entry, in one chronological timeline.</p>
        </div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as any)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All types</option>
          <option value="production">Production</option>
          <option value="oee">OEE</option>
          <option value="quality">Quality</option>
        </select>
        {lines.length > 0 && (
          <select value={lineFilter} onChange={(e) => setLineFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">All lines</option>
            {lines.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        {shifts.length > 0 && (
          <select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">All shifts</option>
            {shifts.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<History className="h-5 w-5" />} title="No entries" description="Nothing recorded for this filter." />
      ) : (
        <ol className="space-y-2">
          {filtered.map((it) => (
            <li key={it.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <div className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                it.kind === "production" && "bg-primary-soft text-primary",
                it.kind === "oee" && "bg-sky-50 text-sky-600",
                it.kind === "quality" && "bg-amber-50 text-amber-600",
              )}>
                {it.kind === "production" && <Target className="h-4 w-4" />}
                {it.kind === "oee" && <Gauge className="h-4 w-4" />}
                {it.kind === "quality" && <Star className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{it.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{it.subtitle}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    {formatDate(it.date)}{it.shift ? ` · ${it.shift}` : ""}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
