import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { scheduleStatus } from "@/lib/machine-constants";
import { estimateUsageRate, predictScheduleDue } from "@/lib/pm-prediction";
import { formatWoNumber } from "@/components/WorkOrderPreview";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Wrench, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type CalEvent = {
  id: string;
  kind: "pm" | "wo";
  date: string; // yyyy-mm-dd
  title: string;
  machineName: string;
  machineId: string;
  status: "overdue" | "due_soon" | "ok";
  href: string;
};

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function MaintenanceCalendar() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const [{ data: schedules }, { data: workOrders }, { data: readingsRaw }] = await Promise.all([
        supabase
          .from("service_schedules")
          .select("id, name, next_due_date, next_due_hours, machines!inner(id, name, current_hours)"),
        supabase
          .from("work_orders")
          .select("id, title, due_date, status, wo_number, wo_year, machines(id, name)")
          .not("due_date", "is", null)
          .neq("status", "closed")
          .neq("status", "done"),
        supabase.from("meter_readings").select("machine_id, reading, reading_date").order("reading_date", { ascending: false }).limit(1000),
      ]);

      const readingsByMachine: Record<string, { reading: number; reading_date: string }[]> = {};
      (readingsRaw ?? []).forEach((r: any) => {
        (readingsByMachine[r.machine_id] ??= []).push({ reading: r.reading, reading_date: r.reading_date });
      });

      const pmEvents: CalEvent[] = (schedules ?? [])
        .map((s: any): CalEvent | null => {
          const usage = estimateUsageRate(readingsByMachine[s.machines?.id] ?? []);
          const pred = predictScheduleDue({
            nextDueDate: s.next_due_date,
            nextDueHours: s.next_due_hours,
            currentHours: s.machines?.current_hours,
            usage,
          });
          if (!pred.estimatedDueDate) return null;
          return {
            id: `pm-${s.id}`,
            kind: "pm",
            date: toDateKey(pred.estimatedDueDate),
            title: s.name,
            machineName: s.machines?.name ?? "—",
            machineId: s.machines?.id,
            status: pred.status,
            href: `/machines/${s.machines?.id}`,
          };
        })
        .filter((e): e is CalEvent => e !== null);

      const woEvents: CalEvent[] = (workOrders ?? []).map((w: any) => ({
        id: `wo-${w.id}`,
        kind: "wo",
        date: w.due_date,
        title: `${formatWoNumber(w.wo_year, w.wo_number)} · ${w.title}`,
        machineName: w.machines?.name ?? "—",
        machineId: w.machines?.id,
        status: scheduleStatus(w.due_date),
        href: `/work-orders/${w.id}`,
      }));

      setEvents([...pmEvents, ...woEvents]);
      setLoading(false);
    })();
  }, [profile]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const key = ev.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = firstOfMonth.getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { date: Date | null }[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d) });
    while (cells.length % 7 !== 0) cells.push({ date: null });
    return cells;
  }, [cursor]);

  const todayKey = toDateKey(new Date());
  const selectedEvents = selectedDate ? eventsByDay.get(selectedDate) ?? [] : [];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Maintenance Calendar</h1>
          <p className="text-sm text-muted-foreground">
            PM schedules and open work-order due dates, in one view.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[140px] text-center text-sm font-medium">{monthLabel}</div>
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Overdue</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Due soon</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> On track</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-7 border-b border-border text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-2 py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((cell, idx) => {
            if (!cell.date) return <div key={idx} className="min-h-[92px] border-b border-r border-border last:border-r-0 bg-muted/20" />;
            const key = toDateKey(cell.date);
            const dayEvents = eventsByDay.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <button
                type="button"
                key={idx}
                onClick={() => setSelectedDate(key)}
                className={cn(
                  "min-h-[92px] border-b border-r border-border p-1.5 text-left align-top last:border-r-0 hover:bg-accent",
                  selectedDate === key && "bg-accent",
                )}
              >
                <div className={cn("mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs", isToday && "bg-primary text-primary-foreground font-semibold")}>
                  {cell.date.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[10px] font-medium",
                        ev.status === "overdue" && "bg-red-100 text-red-700",
                        ev.status === "due_soon" && "bg-amber-100 text-amber-700",
                        ev.status === "ok" && "bg-emerald-100 text-emerald-700",
                      )}
                    >
                      {ev.kind === "pm" ? "PM: " : "WO: "}{ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">
            {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </h2>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing due this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {ev.kind === "pm" ? <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" /> : <Wrench className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{ev.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{ev.machineName}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={ev.status} />
                    <Link to={ev.href} className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">
                      Open <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
