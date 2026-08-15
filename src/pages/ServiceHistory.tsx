import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { formatWoNumber } from "@/components/WorkOrderPreview";
import { History, Wrench, ClipboardList, AlertOctagon, Gauge, ExternalLink } from "lucide-react";

type TimelineItem = {
  id: string;
  date: string;
  kind: "service" | "wo" | "downtime" | "reading";
  title: string;
  subtitle?: string;
  status?: string;
  href?: string;
};

export default function ServiceHistory() {
  const { profile } = useAuth();
  const [loadingMachines, setLoadingMachines] = useState(true);
  const [machines, setMachines] = useState<{ id: string; name: string; category: string }[]>([]);
  const [machineId, setMachineId] = useState<string>("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<"all" | TimelineItem["kind"]>("all");

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoadingMachines(true);
      const { data } = await supabase.from("machines").select("id, name, category").order("name");
      setMachines(data ?? []);
      setLoadingMachines(false);
    })();
  }, [profile]);

  useEffect(() => {
    if (!machineId) {
      setItems([]);
      return;
    }
    (async () => {
      setLoadingHistory(true);
      const [{ data: logs }, { data: wos }, { data: downtime }, { data: readings }] = await Promise.all([
        supabase.from("service_logs").select("*").eq("machine_id", machineId).order("performed_at", { ascending: false }),
        supabase.from("work_orders").select("id, title, status, due_date, completed_at, created_at, wo_number, wo_year").eq("machine_id", machineId).order("created_at", { ascending: false }),
        (supabase as any).from("machine_downtime_events").select("*").eq("machine_id", machineId).order("started_at", { ascending: false }),
        supabase.from("meter_readings").select("*").eq("machine_id", machineId).order("reading_date", { ascending: false }).limit(20),
      ]);

      const serviceItems: TimelineItem[] = (logs ?? []).map((l: any) => ({
        id: `svc-${l.id}`,
        date: l.performed_at,
        kind: "service",
        title: l.title,
        subtitle: `${l.service_type}${l.cost ? ` · ${formatMoney(l.cost, l.currency ?? "TZS")}` : ""}${l.performed_by ? ` · by ${l.performed_by}` : ""}`,
        status: l.status,
      }));

      const woItems: TimelineItem[] = (wos ?? []).map((w: any) => ({
        id: `wo-${w.id}`,
        date: w.completed_at ?? w.due_date ?? w.created_at,
        kind: "wo",
        title: `${formatWoNumber(w.wo_year, w.wo_number)} · ${w.title}`,
        subtitle: w.completed_at ? `Completed ${formatDate(w.completed_at)}` : `Created ${formatDate(w.created_at)}`,
        status: w.status,
        href: `/work-orders/${w.id}`,
      }));

      const downtimeItems: TimelineItem[] = (downtime ?? []).map((d: any) => ({
        id: `dt-${d.id}`,
        date: d.started_at,
        kind: "downtime",
        title: `Breakdown: ${d.reason}`,
        subtitle: d.ended_at ? `Resolved ${formatDate(d.ended_at)}` : "Ongoing",
        status: d.ended_at ? "completed" : "overdue",
      }));

      const readingItems: TimelineItem[] = (readings ?? []).map((r: any) => ({
        id: `rd-${r.id}`,
        date: r.reading_date,
        kind: "reading",
        title: `Reading: ${formatNumber(r.reading)}`,
        subtitle: r.notes ?? undefined,
      }));

      const all = [...serviceItems, ...woItems, ...downtimeItems, ...readingItems].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      setItems(all);
      setLoadingHistory(false);
    })();
  }, [machineId]);

  const filtered = useMemo(() => {
    if (typeFilter === "all") return items;
    return items.filter((i) => i.kind === typeFilter);
  }, [items, typeFilter]);

  const selectedMachine = machines.find((m) => m.id === machineId);

  if (loadingMachines) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Service History</h1>
          <p className="text-sm text-muted-foreground">
            Every service, work order, breakdown and reading for one machine, in a single timeline.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select a machine…</option>
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {machineId && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All events</option>
              <option value="service">Services</option>
              <option value="wo">Work orders</option>
              <option value="downtime">Downtime</option>
              <option value="reading">Readings</option>
            </select>
          )}
        </div>
      </div>

      {!machineId ? (
        <EmptyState
          icon={<History className="h-5 w-5" />}
          title="Pick a machine"
          description="Choose a machine above to see its full service history."
        />
      ) : loadingHistory ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<History className="h-5 w-5" />} title="No history yet" description={`No recorded events for ${selectedMachine?.name ?? "this machine"}.`} />
      ) : (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Link to={`/machines/${machineId}`} className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1">
              Open {selectedMachine?.name} <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <ol className="space-y-3">
            {filtered.map((it) => (
              <li key={it.id} className="flex gap-3 rounded-xl border border-border bg-card p-4">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  {it.kind === "service" && <Wrench className="h-4 w-4" />}
                  {it.kind === "wo" && <ClipboardList className="h-4 w-4" />}
                  {it.kind === "downtime" && <AlertOctagon className="h-4 w-4" />}
                  {it.kind === "reading" && <Gauge className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      {it.href ? (
                        <Link to={it.href} className="truncate font-medium text-primary hover:underline">{it.title}</Link>
                      ) : (
                        <div className="truncate font-medium">{it.title}</div>
                      )}
                      {it.subtitle && <div className="truncate text-xs text-muted-foreground">{it.subtitle}</div>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {it.status && <StatusBadge status={it.status} />}
                      <span className="text-xs text-muted-foreground">{formatDate(it.date)}</span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
