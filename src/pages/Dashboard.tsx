import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { CATEGORY_ICONS, scheduleStatus } from "@/lib/machine-constants";
import { formatDate, formatMoney } from "@/lib/format";
import { Plus, Wrench, AlertTriangle, CheckCircle2, Activity, Clock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { MachineFormDialog } from "@/components/MachineFormDialog";
import { ServiceLogDialog } from "@/components/ServiceLogDialog";
import { MaintenanceAlerts } from "@/components/MaintenanceAlerts";

interface Stats {
  total: number;
  active: number;
  due_soon: number;
  overdue: number;
}

interface UpcomingRow {
  id: string;
  name: string;
  next_due_date: string | null;
  machine_id: string;
  machine_name: string;
  status: "ok" | "due_soon" | "overdue";
}

interface ActivityRow {
  id: string;
  title: string;
  performed_at: string;
  cost: number | null;
  currency: string | null;
  service_type: string;
  machine_id: string;
  machine_name: string;
}

import { isPlatformAdmin } from "@/lib/admin";

export default function Dashboard() {
  const { user, profile } = useAuth();
  const isAdmin = isPlatformAdmin(user?.email || profile?.email);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, due_soon: 0, overdue: 0 });
  const [upcoming, setUpcoming] = useState<UpcomingRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string; category: string }[]>([]);
  const [machineDialog, setMachineDialog] = useState(false);
  const [logDialog, setLogDialog] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: machinesData, error: mErr } = await supabase
        .from("machines")
        .select("id, name, category, status")
        .order("created_at", { ascending: false });
      if (mErr) throw mErr;

      const { data: schedules, error: sErr } = await supabase
        .from("service_schedules")
        .select("id, name, next_due_date, machine_id, machines(name)")
        .order("next_due_date", { ascending: true, nullsFirst: false })
        .limit(50);
      if (sErr) throw sErr;

      const { data: logs, error: lErr } = await supabase
        .from("service_logs")
        .select("id, title, performed_at, cost, currency, service_type, machine_id, machines(name)")
        .order("performed_at", { ascending: false })
        .limit(5);
      if (lErr) throw lErr;

      const total = machinesData?.length ?? 0;
      const active = (machinesData ?? []).filter((m) => m.status === "active").length;
      const enriched: UpcomingRow[] = (schedules ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
        next_due_date: s.next_due_date,
        machine_id: s.machine_id,
        machine_name: s.machines?.name ?? "—",
        status: scheduleStatus(s.next_due_date),
      }));
      const due_soon = enriched.filter((e) => e.status === "due_soon").length;
      const overdue = enriched.filter((e) => e.status === "overdue").length;

      setStats({ total, active, due_soon, overdue });
      setUpcoming(enriched.slice(0, 10));
      setActivity(
        (logs ?? []).map((l: any) => ({
          id: l.id,
          title: l.title,
          performed_at: l.performed_at,
          cost: l.cost,
          currency: l.currency,
          service_type: l.service_type,
          machine_id: l.machine_id,
          machine_name: l.machines?.name ?? "—",
        })),
      );
      setMachines((machinesData ?? []).map((m: any) => ({ id: m.id, name: m.name, category: m.category })));
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) load();
  }, [profile]);

  if (loading) return <PageLoader />;

  const cards = [
    {
      label: "Total Machines",
      value: stats.total,
      sub: `${stats.active} active · ${stats.total - stats.active} inactive`,
      icon: Wrench,
      tone: "default",
    },
    {
      label: "Active",
      value: stats.active,
      sub: stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}% of fleet` : "No machines yet",
      icon: CheckCircle2,
      tone: "success",
    },
    {
      label: "Due for Service",
      value: stats.due_soon,
      sub: stats.due_soon > 0 ? "Within 30 days — schedule now" : "Nothing due soon",
      icon: Clock,
      tone: "warning",
    },
    {
      label: "Overdue",
      value: stats.overdue,
      sub: stats.overdue > 0 ? "Immediate attention required" : "All services on track",
      icon: AlertTriangle,
      tone: "destructive",
    },
  ] as const;

  const toneClasses: Record<string, string> = {
    default: "bg-primary-soft text-primary",
    success: "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]",
    warning: "bg-[hsl(var(--warning)/0.15)] text-[hsl(38_92%_38%)]",
    destructive: "bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))]",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assets & Maintenance</h1>
          <p className="text-sm text-muted-foreground">Fleet overview, service schedules and recent maintenance activity.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLogDialog(true)} disabled={machines.length === 0}>
            <Activity className="mr-2 h-4 w-4" /> Log service
          </Button>
          <Button onClick={() => setMachineDialog(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add machine
          </Button>
        </div>
      </div>

      <MaintenanceAlerts />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{c.label}</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight">{c.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{c.sub}</div>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClasses[c.tone]}`}>
                <c.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming services + Recent activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-foreground">Upcoming Services</h2>
            </div>
            <Link to="/machines" className="text-xs font-medium text-primary hover:underline">View all machines</Link>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState
              icon={<Clock className="h-5 w-5" />}
              title="No upcoming services"
              description="Add a service schedule to a machine to see it here."
            />
          ) : (
            <div className="space-y-2">
              {upcoming.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div>
                    <Link to={`/machines/${r.machine_id}`} className="font-medium hover:text-primary">{r.machine_name}</Link>
                    <div className="text-xs text-muted-foreground">{r.name}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{formatDate(r.next_due_date)}</span>
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">Recent Activity</h2>
          </div>
          {activity.length === 0 ? (
            <EmptyState icon={<Activity className="h-5 w-5" />} title="No activity yet" description="Logged services will appear here." />
          ) : (
            <div className="space-y-2">
              {activity.map((a) => (
                <div key={a.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="font-medium truncate">{a.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    <Link to={`/machines/${a.machine_id}`} className="hover:text-primary">{a.machine_name}</Link>
                    {" · "}{formatDate(a.performed_at)}
                    {a.cost ? <span className="ml-1 font-medium text-foreground">{formatMoney(a.cost, a.currency ?? "TZS")}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <MachineFormDialog open={machineDialog} onOpenChange={setMachineDialog} onSaved={load} />
      <ServiceLogDialog open={logDialog} onOpenChange={setLogDialog} machines={machines} onSaved={load} />
    </div>
  );
}
