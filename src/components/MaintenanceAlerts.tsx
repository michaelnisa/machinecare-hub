import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, Settings2, X, Wrench, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Thresholds {
  mttrHrs: number;
  pmCompliancePct: number;
  dueSoonDays: number;
}

const DEFAULTS: Thresholds = { mttrHrs: 4, pmCompliancePct: 90, dueSoonDays: 7 };

function loadThresholds(orgId?: string): Thresholds {
  if (!orgId) return DEFAULTS;
  try {
    const raw = localStorage.getItem(`mc.thresholds.${orgId}`);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function saveThresholds(orgId: string, t: Thresholds) {
  localStorage.setItem(`mc.thresholds.${orgId}`, JSON.stringify(t));
}

function loadDismissed(orgId?: string): Record<string, string> {
  if (!orgId) return {};
  try {
    return JSON.parse(localStorage.getItem(`mc.alerts.dismissed.${orgId}`) || "{}");
  } catch {
    return {};
  }
}

export function MaintenanceAlerts({ compact = false }: { compact?: boolean }) {
  const { profile } = useAuth();
  const orgId = profile?.organisation_id;
  const [thresholds, setThresholds] = useState<Thresholds>(() => loadThresholds(orgId));
  const [schedules, setSchedules] = useState<any[]>([]);
  const [recentRepairs, setRecentRepairs] = useState<any[]>([]);
  const [recentDowntime, setRecentDowntime] = useState<any[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Record<string, string>>(() => loadDismissed(orgId));

  useEffect(() => {
    setThresholds(loadThresholds(orgId));
    setDismissed(loadDismissed(orgId));
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceISO = since.toISOString().slice(0, 10);
    (async () => {
      const [{ data: sch }, { data: sl }, { data: pk }] = await Promise.all([
        supabase.from("service_schedules").select("id, name, next_due_date, machine_id, machines(name)"),
        supabase.from("service_logs").select("id, service_type, performed_at").eq("service_type", "repair").gte("performed_at", sinceISO),
        supabase.from("production_kpis").select("downtime_minutes").gte("record_date", sinceISO),
      ]);
      setSchedules(sch ?? []);
      setRecentRepairs(sl ?? []);
      setRecentDowntime(pk ?? []);
    })();
  }, [orgId]);

  const alerts = useMemo(() => {
    const list: { id: string; level: "warn" | "danger"; icon: any; title: string; detail: string; to?: string }[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const horizon = new Date(today); horizon.setDate(horizon.getDate() + thresholds.dueSoonDays);

    const overdue = schedules.filter((s) => s.next_due_date && new Date(s.next_due_date) < today);
    const dueSoon = schedules.filter((s) => s.next_due_date && new Date(s.next_due_date) >= today && new Date(s.next_due_date) <= horizon);

    if (overdue.length > 0) {
      list.push({
        id: "pm-overdue",
        level: "danger",
        icon: AlertTriangle,
        title: `${overdue.length} preventive maintenance ${overdue.length === 1 ? "task is" : "tasks are"} overdue`,
        detail: overdue.slice(0, 3).map((s) => `${(s as any).machines?.name ?? "—"} · ${s.name}`).join(" • "),
        to: "/machines",
      });
    }
    if (dueSoon.length > 0) {
      list.push({
        id: "pm-due-soon",
        level: "warn",
        icon: Clock,
        title: `${dueSoon.length} PM ${dueSoon.length === 1 ? "task" : "tasks"} due within ${thresholds.dueSoonDays} days`,
        detail: dueSoon.slice(0, 3).map((s) => `${(s as any).machines?.name ?? "—"} · ${s.name}`).join(" • "),
        to: "/machines",
      });
    }

    // PM compliance
    if (schedules.length > 0) {
      const compliance = ((schedules.length - overdue.length) / schedules.length) * 100;
      if (compliance < thresholds.pmCompliancePct) {
        list.push({
          id: "pm-compliance",
          level: "warn",
          icon: AlertTriangle,
          title: `PM compliance ${compliance.toFixed(0)}% — below target ${thresholds.pmCompliancePct}%`,
          detail: `${overdue.length} of ${schedules.length} schedules are overdue.`,
          to: "/maintenance-kpis",
        });
      }
    }

    // MTTR (last 30 days)
    if (recentRepairs.length > 0) {
      const downHrs = recentDowntime.reduce((s, x) => s + (x.downtime_minutes || 0), 0) / 60;
      const mttr = downHrs / recentRepairs.length;
      if (mttr > thresholds.mttrHrs) {
        list.push({
          id: "mttr",
          level: "warn",
          icon: Wrench,
          title: `MTTR ${mttr.toFixed(1)}h — above target ${thresholds.mttrHrs}h`,
          detail: `${recentRepairs.length} repairs over last 30 days.`,
          to: "/maintenance-kpis",
        });
      }
    }

    return list.filter((a) => dismissed[a.id] !== new Date().toISOString().slice(0, 10));
  }, [schedules, recentRepairs, recentDowntime, thresholds, dismissed]);

  const dismiss = (id: string) => {
    if (!orgId) return;
    const next = { ...dismissed, [id]: new Date().toISOString().slice(0, 10) };
    setDismissed(next);
    localStorage.setItem(`mc.alerts.dismissed.${orgId}`, JSON.stringify(next));
  };

  if (alerts.length === 0 && !compact) {
    return (
      <div className="flex items-center justify-end">
        <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)} className="text-muted-foreground">
          <Settings2 className="mr-2 h-4 w-4" />Alert thresholds
        </Button>
        <SettingsDlg open={settingsOpen} setOpen={setSettingsOpen} thresholds={thresholds} setThresholds={(t) => { setThresholds(t); if (orgId) saveThresholds(orgId, t); }} />
      </div>
    );
  }
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a) => {
        const Icon = a.icon;
        const colors = a.level === "danger"
          ? "border-red-200 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-200 dark:border-red-900"
          : "border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900";
        return (
          <div key={a.id} className={`flex items-start gap-3 rounded-xl border p-3 ${colors}`}>
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{a.title}</div>
              {a.detail && <div className="text-xs opacity-80">{a.detail}</div>}
            </div>
            <div className="flex items-center gap-1">
              {a.to && (
                <Link to={a.to} className="rounded-md px-2 py-1 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10">
                  View
                </Link>
              )}
              <button onClick={() => dismiss(a.id)} aria-label="Dismiss"
                className="rounded-md p-1 hover:bg-black/5 dark:hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
      {!compact && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)} className="text-muted-foreground">
            <Settings2 className="mr-2 h-4 w-4" />Alert thresholds
          </Button>
        </div>
      )}
      <SettingsDlg open={settingsOpen} setOpen={setSettingsOpen} thresholds={thresholds} setThresholds={(t) => { setThresholds(t); if (orgId) saveThresholds(orgId, t); }} />
    </div>
  );
}

function SettingsDlg({ open, setOpen, thresholds, setThresholds }: any) {
  const [f, setF] = useState<Thresholds>(thresholds);
  useEffect(() => { setF(thresholds); }, [thresholds, open]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Alert thresholds</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>MTTR target (hours)</Label>
            <Input type="number" min={0} step={0.5} value={f.mttrHrs}
              onChange={(e) => setF({ ...f, mttrHrs: Number(e.target.value) || 0 })} className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">Alert when mean time to repair exceeds this.</p>
          </div>
          <div>
            <Label>PM compliance target (%)</Label>
            <Input type="number" min={0} max={100} value={f.pmCompliancePct}
              onChange={(e) => setF({ ...f, pmCompliancePct: Number(e.target.value) || 0 })} className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">Alert when compliance drops below this.</p>
          </div>
          <div>
            <Label>PM due-soon window (days)</Label>
            <Input type="number" min={1} max={60} value={f.dueSoonDays}
              onChange={(e) => setF({ ...f, dueSoonDays: Number(e.target.value) || 0 })} className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">Warn when preventive maintenance is due within this many days.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { setThresholds(f); setOpen(false); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
