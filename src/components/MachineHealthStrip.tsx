import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, ClipboardList, Wrench, Gauge, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { UpdateReadingDialog } from "@/components/UpdateReadingDialog";
import { useI18n } from "@/i18n/I18nProvider";

interface Props {
  machineId: string;
  currentHours: number | null;
  onChanged?: () => void;
}

interface Stats {
  nextDueDate: string | null;
  openWoCount: number;
  lastServiceDate: string | null;
}

function daysFromToday(date: string | null) {
  if (!date) return null;
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function MachineHealthStrip({ machineId, currentHours, onChanged }: Props) {
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats>({ nextDueDate: null, openWoCount: 0, lastServiceDate: null });
  const [readingOpen, setReadingOpen] = useState(false);

  const load = async () => {
    const [sched, wo, logs] = await Promise.all([
      supabase
        .from("service_schedules")
        .select("next_due_date")
        .eq("machine_id", machineId)
        .not("next_due_date", "is", null)
        .order("next_due_date", { ascending: true })
        .limit(1),
      supabase
        .from("work_orders")
        .select("id", { count: "exact", head: true })
        .eq("machine_id", machineId)
        .in("status", ["open", "in_progress", "waiting_parts"]),
      supabase
        .from("service_logs")
        .select("performed_at")
        .eq("machine_id", machineId)
        .order("performed_at", { ascending: false })
        .limit(1),
    ]);
    setStats({
      nextDueDate: sched.data?.[0]?.next_due_date ?? null,
      openWoCount: wo.count ?? 0,
      lastServiceDate: logs.data?.[0]?.performed_at ?? null,
    });
  };

  useEffect(() => { load(); }, [machineId]);

  const days = daysFromToday(stats.nextDueDate);
  let nextTone = "text-foreground";
  if (days != null) {
    if (days < 0) nextTone = "text-destructive";
    else if (days < 14) nextTone = "text-amber-600 dark:text-amber-400";
  }
  const nextSub =
    days == null ? t.machine.noSchedule :
    days < 0 ? `${Math.abs(days)} ${t.machine.daysOverdue}` :
    days === 0 ? t.machine.dueToday :
    `${days} ${t.machine.daysLeft}`;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<Calendar className="h-4 w-4" />}
          label={t.machine.nextService}
          value={stats.nextDueDate ? formatDate(stats.nextDueDate) : "—"}
          sub={nextSub}
          tone={nextTone}
        />
        <Link to={`/work-orders?machine=${machineId}`} className="block focus:outline-none">
          <Stat
            icon={<ClipboardList className="h-4 w-4" />}
            label={t.machine.openWO}
            value={String(stats.openWoCount)}
            sub={t.machine.viewList}
            interactive
          />
        </Link>
        <Stat
          icon={<Wrench className="h-4 w-4" />}
          label={t.machine.lastService}
          value={stats.lastServiceDate ? formatDate(stats.lastServiceDate) : "—"}
          sub=""
        />
        <Stat
          icon={<Gauge className="h-4 w-4" />}
          label={t.machine.currentHours}
          value={currentHours != null ? formatNumber(currentHours) : "—"}
          sub={
            <Button variant="ghost" size="sm" className="-ml-2 h-6 px-2 text-xs" onClick={() => setReadingOpen(true)}>
              <Plus className="mr-1 h-3 w-3" /> {t.machine.updateReading}
            </Button>
          }
        />
      </div>
      <UpdateReadingDialog
        open={readingOpen}
        onOpenChange={setReadingOpen}
        machineId={machineId}
        currentHours={currentHours}
        onSaved={() => { load(); onChanged?.(); }}
      />
    </>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  tone = "text-foreground",
  interactive = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: React.ReactNode;
  tone?: string;
  interactive?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${interactive ? "transition-colors hover:border-primary/40" : ""}`}>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`mt-1.5 text-xl font-semibold ${tone}`}>{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
