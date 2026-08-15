import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { formatDate, formatTZS } from "@/lib/format";
import { SCRAP_REASONS, SCRAP_REASON_MAP } from "@/lib/production-constants";
import { ArrowLeft, Recycle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function monthBounds(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { startISO: start.toISOString().slice(0, 10), endISO: end.toISOString().slice(0, 10) };
}

export default function ProductionMaterialWaste() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [events, setEvents] = useState<any[]>([]);
  const [costPerUnit, setCostPerUnit] = useState<number | null>(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { startISO, endISO } = monthBounds(month);
      const [{ data, error }, { data: org }] = await Promise.all([
        (supabase as any)
          .from("production_scrap_events")
          .select("*, machines(name)")
          .eq("organisation_id", profile.organisation_id)
          .gte("record_date", startISO)
          .lt("record_date", endISO)
          .order("record_date", { ascending: false }),
        (supabase as any).from("organisations").select("production_cost_per_scrap_unit").eq("id", profile.organisation_id).maybeSingle(),
      ]);
      if (error) console.error(error);
      setEvents(data ?? []);
      setCostPerUnit(org?.production_cost_per_scrap_unit ?? null);
      setLoading(false);
    })();
  }, [profile, month]);

  const totalUnits = events.reduce((s, e) => s + Number(e.quantity ?? 0), 0);
  const totalCost = costPerUnit != null ? totalUnits * costPerUnit : null;

  const byReason = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach((e) => map.set(e.reason_code, (map.get(e.reason_code) ?? 0) + Number(e.quantity ?? 0)));
    return SCRAP_REASONS
      .map((r) => ({ code: r.code, label: r.label, units: map.get(r.code) ?? 0 }))
      .filter((r) => r.units > 0)
      .sort((a, b) => b.units - a.units);
  }, [events]);

  const byMachine = useMemo(() => {
    const map = new Map<string, { name: string; units: number }>();
    events.forEach((e) => {
      const key = e.machine_id ?? "none";
      const name = e.machines?.name ?? "Unassigned";
      const entry = map.get(key) ?? { name, units: 0 };
      entry.units += Number(e.quantity ?? 0);
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.units - a.units).slice(0, 10);
  }, [events]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/production/overview" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Production Overview
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Material &amp; Waste</h1>
          <p className="text-sm text-muted-foreground">Scrap by reason and machine, with cost if configured.</p>
        </div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Scrap units</div>
          <div className="mt-1 text-2xl font-semibold">{totalUnits.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-amber-700">Estimated cost</div>
          <div className="mt-1 text-2xl font-semibold text-amber-700">{totalCost != null ? formatTZS(totalCost) : "—"}</div>
          {costPerUnit == null && <div className="mt-1 text-xs text-amber-700/70">Set cost per scrap unit in Settings to see this.</div>}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Events logged</div>
          <div className="mt-1 text-2xl font-semibold">{events.length}</div>
        </div>
      </div>

      {events.length === 0 ? (
        <EmptyState icon={<Recycle className="h-5 w-5" />} title="No waste logged this month" description="Nothing recorded — good sign." />
      ) : (
        <>
          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground">By reason</h2>
            <div className="rounded-xl border border-border bg-card p-4">
              <ResponsiveContainer width="100%" height={Math.max(200, byReason.length * 36)}>
                <BarChart data={byReason} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="units" fill="#f59e0b" radius={[0, 4, 4, 0]} />
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
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="units" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
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
                      <th className="px-5 py-3 font-medium">Units</th>
                      <th className="px-5 py-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.id} className="border-t border-border">
                        <td className="px-5 py-3 text-muted-foreground">{formatDate(e.record_date)}</td>
                        <td className="px-5 py-3">
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {SCRAP_REASON_MAP.get(e.reason_code)?.label ?? e.reason_code}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{e.machines?.name ?? "—"}</td>
                        <td className="px-5 py-3 font-medium">{Number(e.quantity ?? 0).toLocaleString()}</td>
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
