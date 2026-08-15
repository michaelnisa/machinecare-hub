import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ScheduleFormDialog } from "@/components/ScheduleFormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatDate } from "@/lib/format";
import {
  estimateUsageRate,
  predictScheduleDue,
  formatDaysRemaining,
  type DrivenBy,
} from "@/lib/pm-prediction";
import {
  Calendar,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  Wrench,
  Gauge,
  CalendarClock,
  GitMerge,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DRIVEN_BY_ICON: Record<DrivenBy, any> = {
  usage: Gauge,
  calendar: CalendarClock,
  both: GitMerge,
  none: Calendar,
};

const DRIVEN_BY_LABEL: Record<DrivenBy, string> = {
  usage: "Usage-based",
  calendar: "Calendar-based",
  both: "Usage + calendar",
  none: "No estimate",
};

export default function PMSchedules() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [machines, setMachines] = useState<
    { id: string; name: string; current_hours: number | null }[]
  >([]);
  const [readingsByMachine, setReadingsByMachine] = useState<
    Record<string, { reading: number; reading_date: string }[]>
  >({});
  const [filter, setFilter] = useState<"all" | "due_soon" | "overdue">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: s, error }, { data: m }, { data: readings }] =
      await Promise.all([
        supabase
          .from("service_schedules")
          .select(
            "*, machines!inner(id, name, category, status, current_hours)",
          )
          .order("next_due_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("machines")
          .select("id, name, current_hours")
          .order("name"),
        supabase
          .from("meter_readings")
          .select("machine_id, reading, reading_date")
          .order("reading_date", { ascending: false })
          .limit(1000),
      ]);
    if (error) console.error(error);
    setSchedules(s ?? []);
    setMachines(m ?? []);
    const grouped: Record<string, { reading: number; reading_date: string }[]> =
      {};
    (readings ?? []).forEach((r: any) => {
      (grouped[r.machine_id] ??= []).push({
        reading: r.reading,
        reading_date: r.reading_date,
      });
    });
    setReadingsByMachine(grouped);
    setLoading(false);
  };

  useEffect(() => {
    if (profile) load();
  }, [profile]);

  const enriched = useMemo(
    () =>
      schedules.map((s) => {
        const usage = estimateUsageRate(
          readingsByMachine[s.machines?.id] ?? [],
        );
        const prediction = predictScheduleDue({
          nextDueDate: s.next_due_date,
          nextDueHours: s.next_due_hours,
          currentHours: s.machines?.current_hours,
          usage,
        });
        return { ...s, _prediction: prediction, _status: prediction.status };
      }),
    [schedules, readingsByMachine],
  );

  const filtered = useMemo(() => {
    const list =
      filter === "all"
        ? enriched
        : enriched.filter((s) => s._status === filter);
    return [...list].sort((a, b) => {
      const da = a._prediction.daysRemaining;
      const db = b._prediction.daysRemaining;
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
  }, [enriched, filter]);

  const overdueCount = enriched.filter((s) => s._status === "overdue").length;
  const dueSoonCount = enriched.filter((s) => s._status === "due_soon").length;

  const generateWo = async (s: any) => {
    if (!profile) return;
    const { error } = await supabase.from("work_orders").insert({
      organisation_id: profile.organisation_id,
      machine_id: s.machines.id,
      schedule_id: s.id,
      title: `PM: ${s.name}`,
      description: `Scheduled ${s.service_type} service${s.next_due_date ? ` (due ${s.next_due_date})` : ""}.`,
      priority: s._status === "overdue" ? "high" : "normal",
      status: "open",
      due_date: s.next_due_date,
    });
    if (error) return toast.error(error.message);
    toast.success("Work order created");
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase
      .from("service_schedules")
      .delete()
      .eq("id", confirmDelete);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Schedule deleted");
    setConfirmDelete(null);
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            PM Schedules
          </h1>
          <p className="text-sm text-muted-foreground">
            Predicted due dates blend the calendar interval with actual usage
            rate from meter readings — sorted by what needs attention first.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All schedules</option>
            <option value="overdue">Overdue</option>
            <option value="due_soon">Due soon</option>
          </select>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> New plan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Total schedules
          </div>
          <div className="mt-1 text-2xl font-semibold">{enriched.length}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-amber-700">
            Due soon
          </div>
          <div className="mt-1 text-2xl font-semibold text-amber-700">
            {dueSoonCount}
          </div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-red-700">
            Overdue
          </div>
          <div className="mt-1 text-2xl font-semibold text-red-700">
            {overdueCount}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-5 w-5" />}
          title="No schedules found"
          description="Create a PM plan for a machine to start tracking due dates."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> New plan
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Machine</th>
                  <th className="px-5 py-3 font-medium">Schedule</th>
                  <th className="px-5 py-3 font-medium">Interval</th>
                  <th className="px-5 py-3 font-medium">Last done</th>
                  <th className="px-5 py-3 font-medium">Predicted due</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const interval =
                    [
                      s.interval_days ? `${s.interval_days} d` : null,
                      s.interval_hours ? `${s.interval_hours} hr` : null,
                    ]
                      .filter(Boolean)
                      .join(" / ") || "—";
                  const pred = s._prediction;
                  const DrivenIcon = DRIVEN_BY_ICON[pred.drivenBy as DrivenBy];
                  return (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-5 py-3">
                        <Link
                          to={`/machines/${s.machines?.id}`}
                          className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {s.machines?.name ?? "—"}{" "}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        {s.name}
                        <span className="ml-2 rounded-md bg-muted px-2 py-0.5 text-xs">
                          {s.service_type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {interval}
                      </td>
                      <td className="px-5 py-3">
                        {formatDate(s.last_service_date)}
                      </td>
                      <td className="px-5 py-3">
                        <div
                          className={cn(
                            "font-medium",
                            pred.status === "overdue" && "text-red-600",
                            pred.status === "due_soon" && "text-amber-600",
                          )}
                        >
                          {formatDaysRemaining(pred.daysRemaining)}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <DrivenIcon className="h-3 w-3" />
                          {DRIVEN_BY_LABEL[pred.drivenBy as DrivenBy]}
                          {pred.drivenBy !== "calendar" &&
                            pred.usageConfidence !== "none" && (
                              <span className="capitalize">
                                · {pred.usageConfidence} confidence
                              </span>
                            )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={s._status} />
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => generateWo(s)}
                          title="Generate work order"
                        >
                          <Wrench className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(s);
                            setDialogOpen(true);
                          }}
                          title="Edit schedule"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmDelete(s.id)}
                          title="Delete schedule"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ScheduleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        machineId={editing?.machine_id}
        machines={machines}
        schedule={editing}
        onSaved={load}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Delete this schedule?"
        description="This cannot be undone."
        onConfirm={handleDelete}
      />
    </div>
  );
}
