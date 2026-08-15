import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { formatDate } from "@/lib/format";
import { DOWNTIME_REASONS, REASON_MAP } from "@/lib/production-constants";
import { ArrowLeft, AlertOctagon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { cn } from "@/lib/utils";

function monthBounds(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { startISO: start.toISOString().slice(0, 10), endISO: end.toISOString().slice(0, 10) };
}

function durationLabel(mins: number) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function ProductionDowntime() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [events, setEvents] = useState<any[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "planned" | "unplanned">("all");

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { startISO, endISO } = monthBounds(month);
      const { data, error } = await (supabase as any)
        .from("production_downtime_events")
        .select("*, machines(name)")
        .eq("organisation_id", profile.organisation_id)
        .gte("record_date", startISO)
        .lt("record_date", endISO)
        .order("record_date", { ascending: false });
      if (error) console.error(error);
      setEvents(data ?? []);
      setLoading(false);
    })();
  }, [profile, month]);

  const filtered = useMemo(() => {
    if (categoryFilter === "all") return events;
    return events.filter((e) => REASON_MAP.get(e.reason_code)?.category === categoryFilter);
  }, [events, categoryFilter]);

  const totalMinutes = filtered.reduce((s, e) => s + Number(e.duration_minutes ?? 0), 0);
  const plannedMinutes = events.filter((e) => REASON_MAP.get(e.reason_code)?.category === "planned").reduce((s, e) => s + Number(e.duration_minutes ?? 0), 0);
  const unplannedMinutes = events.filter((e) => REASON_MAP.get(e.reason_code)?.category === "unplanned").reduce((s, e) => s + Number(e.duration_minutes ?? 0), 0);

  const byReason = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((e) => map.set(e.reason_code, (map.get(e.reason_code) ?? 0) + Number(e.duration_minutes ?? 0)));
    return DOWNTIME_REASONS
      .map((r) => ({ code: r.code, label: r.label, category: r.category, minutes: map.get(r.code) ?? 0 }))
      .filter((r) => r.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);
  }, [filtered]);

  const byMachine = useMemo(() => {
    const map = new Map<string, { name: string; minutes: number }>();
    filtered.forEach((e) => {
      const key = e.machine_id ?? "none";
      const name = e.machines?.name ?? "Unassigned";
      const entry = map.get(key) ?? { name, minutes: 0 };
      entry.minutes += Number(e.duration_minutes ?? 0);
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.minutes - a.minutes).slice(0, 10);
  }, [filtered]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/production/overview" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Production Overview
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Downtime</h1>
          <p className="text-sm text-muted-foreground">Downtime by reason, machine and line — for real root-cause analysis, not just a shift-level number.</p>
        </div>
        <div className="flex gap-2">
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as any)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">All categories</option>
            <option value="unplanned">Unplanned only</option>
            <option value="planned">Planned only</option>
          </select>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total downtime</div>
          <div className="mt-1 text-2xl font-semibold">{durationLabel(totalMinutes)}</div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-red-700">Unplanned</div>
          <div className="mt-1 text-2xl font-semibold text-red-700">{durationLabel(unplannedMinutes)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Planned</div>
          <div className="mt-1 text-2xl font-semibold">{durationLabel(plannedMinutes)}</div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<AlertOctagon className="h-5 w-5" />} title="No downtime this month" description="Nothing logged for this filter — good sign." />
      ) : (
        <>
          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground">By reason</h2>
            <div className="rounded-xl border border-border bg-card p-4">
              <ResponsiveContainer width="100%" height={Math.max(200, byReason.length * 36)}>
                <BarChart data={byReason} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `${v}m`} />
                  <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => durationLabel(v)} />
                  <Bar dataKey="minutes" radius={[0, 4, 4, 0]}>
                    {byReason.map((r) => (
                      <Cell key={r.code} fill={r.category === "unplanned" ? "#ef4444" : "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {byMachine.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-foreground">By machine</h2>
              <div className="rounded-xl border border-border bg-card p-4">
                <ResponsiveContainer width="100%" height={Math.max(200, byMachine.length * 36)}>
                  <BarChart data={byMachine} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `${v}m`} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => durationLabel(v)} />
                    <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Events</h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">Reason</th>
                      <th className="px-5 py-3 font-medium">Machine</th>
                      <th className="px-5 py-3 font-medium">Duration</th>
                      <th className="px-5 py-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e) => (
                      <tr key={e.id} className="border-t border-border">
                        <td className="px-5 py-3 text-muted-foreground">{formatDate(e.record_date)}</td>
                        <td className="px-5 py-3">
                          <span className={cn("rounded-md px-2 py-0.5 text-xs", REASON_MAP.get(e.reason_code)?.category === "unplanned" ? "bg-red-50 text-red-700" : "bg-muted text-muted-foreground")}>
                            {REASON_MAP.get(e.reason_code)?.label ?? e.reason_code}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{e.machines?.name ?? "—"}</td>
                        <td className="px-5 py-3">{durationLabel(Number(e.duration_minutes ?? 0))}</td>
                        <td className="px-5 py-3 text-muted-foreground">{e.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
