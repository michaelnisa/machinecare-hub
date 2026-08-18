import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { CalendarDays, Plus, Loader2, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700", confirmed: "bg-teal-100 text-teal-700", completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700", no_show: "bg-slate-100 text-slate-600",
};
const STATUS_BLOCK: Record<string, string> = {
  scheduled: "bg-blue-100 border-blue-300 text-blue-800", confirmed: "bg-teal-100 border-teal-300 text-teal-800",
  completed: "bg-emerald-100 border-emerald-300 text-emerald-800", cancelled: "bg-red-100 border-red-300 text-red-700 line-through opacity-70",
  no_show: "bg-slate-100 border-slate-300 text-slate-500 opacity-70",
};

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 19;
const HOUR_PX = 56;

function toDateKey(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function toLocalTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}

type View = "month" | "week" | "day";

export default function GarageCalendar() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(() => new Date());
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [appointments, setAppointments] = useState<any[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [newDefaults, setNewDefaults] = useState<{ date: string; time?: string }>({ date: toDateKey(new Date()) });
  const [busyId, setBusyId] = useState<string | null>(null);

  const rangeStart = useMemo(() => {
    if (view === "month") return new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    if (view === "week") return startOfWeek(cursor);
    return new Date(`${date}T00:00:00`);
  }, [view, cursor, date]);
  const rangeEnd = useMemo(() => {
    if (view === "month") return new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    if (view === "week") { const e = new Date(rangeStart); e.setDate(e.getDate() + 7); return e; }
    const e = new Date(rangeStart); e.setDate(e.getDate() + 1); return e;
  }, [view, cursor, rangeStart, date]);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("garage_appointments")
      .select("*, garage_customers(name, phone), garage_vehicles(make, model, registration_number), garage_mechanics(name)")
      .gte("scheduled_at", rangeStart.toISOString()).lt("scheduled_at", rangeEnd.toISOString())
      .order("scheduled_at");
    if (error) toast.error(error.message);
    setAppointments(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile, rangeStart.getTime(), rangeEnd.getTime()]);

  const byDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of appointments) {
      const key = toDateKey(new Date(a.scheduled_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [appointments]);

  const setStatus = async (id: string, status: string) => {
    setBusyId(id);
    const { error } = await (supabase as any).from("garage_appointments").update({ status }).eq("id", id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    load();
  };

  const convertToJob = async (appt: any) => {
    if (!appt.vehicle_id) return toast.error("This appointment has no vehicle on file — add one to the customer first");
    setBusyId(appt.id);
    const { data: job, error } = await (supabase as any).from("garage_jobs").insert({
      organisation_id: profile?.organisation_id, customer_id: appt.customer_id, vehicle_id: appt.vehicle_id,
      mechanic_id: appt.mechanic_id, reported_problem: appt.purpose || "Scheduled appointment", created_by: user?.id,
    }).select().single();
    if (!error && job) {
      await (supabase as any).from("garage_appointments").update({ job_id: job.id, status: "completed" }).eq("id", appt.id);
    }
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Job created");
    navigate(`/garage/jobs/${job.id}`);
  };

  const goToday = () => { const t = new Date(); setCursor(t); setDate(toDateKey(t)); };
  const nav = (dir: -1 | 1) => {
    if (view === "month") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1));
    else if (view === "week") { const c = new Date(cursor); c.setDate(c.getDate() + dir * 7); setCursor(c); }
    else { const d = new Date(`${date}T00:00:00`); d.setDate(d.getDate() + dir); setDate(toDateKey(d)); setCursor(d); }
  };
  const openDay = (key: string) => { setDate(key); setCursor(new Date(`${key}T00:00:00`)); setView("day"); };

  const label = view === "month"
    ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : view === "week"
    ? `${rangeStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${new Date(rangeEnd.getTime() - 86400000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">Appointments — book, reschedule, or turn one into a job.</p>
        </div>
        <Button onClick={() => { setNewDefaults({ date: view === "day" ? date : toDateKey(new Date()) }); setNewOpen(true); }}><Plus className="mr-2 h-4 w-4" />New appointment</Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => nav(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
          <Button variant="outline" size="icon" onClick={() => nav(1)}><ChevronRight className="h-4 w-4" /></Button>
          <div className="ml-2 min-w-[180px] text-sm font-medium">{label}</div>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-card p-0.5">
          {(["month", "week", "day"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={cn("rounded-md px-3 py-1.5 text-xs font-medium capitalize", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {loading ? <PageLoader /> : view === "month" ? (
        <MonthGrid cursor={cursor} byDay={byDay} onSelectDay={openDay} />
      ) : view === "week" ? (
        <WeekGrid rangeStart={rangeStart} byDay={byDay} onSelectDay={openDay} onSlotClick={(key, time) => { setNewDefaults({ date: key, time }); setNewOpen(true); }} />
      ) : (
        <DayAgenda
          date={date}
          appts={byDay.get(date) ?? []}
          busyId={busyId}
          onConfirm={(id) => setStatus(id, "confirmed")}
          onNoShow={(id) => setStatus(id, "no_show")}
          onCancel={(id) => setStatus(id, "cancelled")}
          onConvert={convertToJob}
        />
      )}

      <NewAppointmentDialog
        open={newOpen}
        setOpen={setNewOpen}
        defaults={newDefaults}
        orgId={profile?.organisation_id}
        userId={user?.id}
        onSaved={load}
      />
    </div>
  );
}

function MonthGrid({ cursor, byDay, onSelectDay }: { cursor: Date; byDay: Map<string, any[]>; onSelectDay: (key: string) => void }) {
  const days = useMemo(() => {
    const year = cursor.getFullYear(), month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { date: Date | null }[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d) });
    while (cells.length % 7 !== 0) cells.push({ date: null });
    return cells;
  }, [cursor]);
  const todayKey = toDateKey(new Date());

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="px-2 py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((cell, idx) => {
          if (!cell.date) return <div key={idx} className="min-h-[92px] border-b border-r border-border last:border-r-0 bg-muted/20" />;
          const key = toDateKey(cell.date);
          const dayAppts = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <button type="button" key={idx} onClick={() => onSelectDay(key)}
              className="min-h-[92px] border-b border-r border-border p-1.5 text-left align-top last:border-r-0 hover:bg-accent">
              <div className={cn("mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs", isToday && "bg-primary text-primary-foreground font-semibold")}>
                {cell.date.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayAppts.slice(0, 3).map((a) => (
                  <div key={a.id} className={cn("truncate rounded border px-1 py-0.5 text-[10px] font-medium", STATUS_BLOCK[a.status])}>
                    {toLocalTime(a.scheduled_at)} {a.garage_customers?.name}
                  </div>
                ))}
                {dayAppts.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayAppts.length - 3} more</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({ rangeStart, byDay, onSelectDay, onSlotClick }: {
  rangeStart: Date; byDay: Map<string, any[]>; onSelectDay: (key: string) => void; onSlotClick: (key: string, time: string) => void;
}) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(rangeStart); d.setDate(d.getDate() + i); return d; }), [rangeStart]);
  const hours = useMemo(() => Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i), []);
  const todayKey = toDateKey(new Date());
  const gridHeight = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_PX;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-border text-center text-xs font-medium text-muted-foreground">
        <div />
        {days.map((d) => {
          const key = toDateKey(d);
          return (
            <button key={key} onClick={() => onSelectDay(key)} className="border-l border-border px-1 py-2 hover:bg-accent">
              <div className="uppercase tracking-wide">{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
              <div className={cn("mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm", key === todayKey && "bg-primary font-semibold text-primary-foreground")}>
                {d.getDate()}
              </div>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-[48px_repeat(7,1fr)]">
        <div style={{ height: gridHeight }} className="relative">
          {hours.map((h) => (
            <div key={h} style={{ top: (h - DAY_START_HOUR) * HOUR_PX }} className="absolute -translate-y-2 pr-1.5 text-right text-[10px] text-muted-foreground">
              {h % 12 === 0 ? 12 : h % 12}{h < 12 ? "am" : "pm"}
            </div>
          ))}
        </div>
        {days.map((d) => {
          const key = toDateKey(d);
          const dayAppts = byDay.get(key) ?? [];
          return (
            <div key={key} style={{ height: gridHeight }} className="relative border-l border-border">
              {hours.map((h) => (
                <button key={h} style={{ top: (h - DAY_START_HOUR) * HOUR_PX, height: HOUR_PX }}
                  onClick={() => onSlotClick(key, `${String(h).padStart(2, "0")}:00`)}
                  className="absolute w-full border-t border-border/60 hover:bg-accent/40" />
              ))}
              {dayAppts.map((a) => {
                const start = new Date(a.scheduled_at);
                const minutesFromStart = Math.max(0, (start.getHours() - DAY_START_HOUR) * 60 + start.getMinutes());
                const top = (minutesFromStart / 60) * HOUR_PX;
                const height = Math.max(18, (Number(a.duration_minutes || 60) / 60) * HOUR_PX - 2);
                return (
                  <button
                    key={a.id}
                    onClick={() => onSelectDay(key)}
                    style={{ top, height }}
                    className={cn("absolute left-0.5 right-0.5 overflow-hidden rounded border px-1 py-0.5 text-left text-[10px] leading-tight", STATUS_BLOCK[a.status])}
                  >
                    <div className="font-medium">{toLocalTime(a.scheduled_at)} {a.garage_customers?.name}</div>
                    {a.garage_mechanics?.name && <div className="opacity-80">{a.garage_mechanics.name}</div>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayAgenda({ date, appts, busyId, onConfirm, onNoShow, onCancel, onConvert }: {
  date: string; appts: any[]; busyId: string | null;
  onConfirm: (id: string) => void; onNoShow: (id: string) => void; onCancel: (id: string) => void; onConvert: (a: any) => void;
}) {
  if (appts.length === 0) {
    return <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Nothing booked" description="No appointments scheduled for this day." />;
  }
  return (
    <div className="space-y-2">
      {appts.map((a: any) => (
        <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="w-16 shrink-0 text-sm font-medium">{toLocalTime(a.scheduled_at)}</div>
            <div>
              <div className="font-medium">
                {a.garage_customers?.name}
                {a.garage_vehicles && <span className="ml-1.5 text-muted-foreground">— {[a.garage_vehicles.make, a.garage_vehicles.model].filter(Boolean).join(" ")}{a.garage_vehicles.registration_number ? ` (${a.garage_vehicles.registration_number})` : ""}</span>}
              </div>
              <div className="text-xs text-muted-foreground">{a.purpose || "No purpose noted"}{a.garage_mechanics?.name ? ` · ${a.garage_mechanics.name}` : ""}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-xs capitalize", STATUS_BADGE[a.status])}>{a.status.replace("_", " ")}</span>
            {a.status === "scheduled" && <Button size="sm" variant="outline" onClick={() => onConfirm(a.id)} disabled={busyId === a.id}>Confirm</Button>}
            {["scheduled", "confirmed"].includes(a.status) && !a.job_id && (
              <Button size="sm" onClick={() => onConvert(a)} disabled={busyId === a.id}>{busyId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Convert to job"}</Button>
            )}
            {["scheduled", "confirmed"].includes(a.status) && (
              <>
                <Button size="sm" variant="outline" onClick={() => onNoShow(a.id)} disabled={busyId === a.id}>No-show</Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => onCancel(a.id)} disabled={busyId === a.id}>Cancel</Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function NewAppointmentDialog({ open, setOpen, defaults, orgId, userId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [conflict, setConflict] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ customer_id: "", vehicle_id: "", mechanic_id: "", date: defaults.date, time: defaults.time ?? "09:00", duration_minutes: "60", purpose: "", notes: "" });

  useEffect(() => {
    if (open) {
      setForm({ customer_id: "", vehicle_id: "", mechanic_id: "", date: defaults.date, time: defaults.time ?? "09:00", duration_minutes: "60", purpose: "", notes: "" });
      setConflict(null);
      Promise.all([
        (supabase as any).from("garage_customers").select("id, name").order("name"),
        (supabase as any).from("garage_mechanics").select("id, name").eq("status", "active").order("name"),
      ]).then(([{ data: c }, { data: m }]) => { setCustomers(c ?? []); setMechanics(m ?? []); });
    }
  }, [open, defaults.date, defaults.time]);

  useEffect(() => {
    if (!form.customer_id) { setVehicles([]); return; }
    (supabase as any).from("garage_vehicles").select("id, make, model, registration_number").eq("customer_id", form.customer_id).order("created_at", { ascending: false })
      .then(({ data }: any) => setVehicles(data ?? []));
  }, [form.customer_id]);

  // Double-booking check: same mechanic, overlapping time window on the same day.
  useEffect(() => {
    setConflict(null);
    if (!form.mechanic_id || !form.date || !form.time) return;
    const start = new Date(`${form.date}T${form.time}:00`);
    const end = new Date(start.getTime() + (Number(form.duration_minutes) || 60) * 60000);
    const dayStart = new Date(`${form.date}T00:00:00`).toISOString();
    const dayEnd = new Date(`${form.date}T23:59:59`).toISOString();
    (supabase as any)
      .from("garage_appointments")
      .select("scheduled_at, duration_minutes, status, garage_customers(name)")
      .eq("mechanic_id", form.mechanic_id)
      .gte("scheduled_at", dayStart).lte("scheduled_at", dayEnd)
      .not("status", "in", "(cancelled,no_show)")
      .then(({ data }: any) => {
        const clash = (data ?? []).find((a: any) => {
          const aStart = new Date(a.scheduled_at);
          const aEnd = new Date(aStart.getTime() + Number(a.duration_minutes || 60) * 60000);
          return start < aEnd && end > aStart;
        });
        if (clash) setConflict(`This mechanic already has ${clash.garage_customers?.name ?? "another appointment"} at ${toLocalTime(clash.scheduled_at)} — you can still book, but double-check availability.`);
      });
  }, [form.mechanic_id, form.date, form.time, form.duration_minutes]);

  const submit = async () => {
    if (!form.customer_id) return toast.error("Select a customer");
    if (!form.date || !form.time) return toast.error("Set a date and time");
    setSaving(true);
    const { error } = await (supabase as any).from("garage_appointments").insert({
      organisation_id: orgId,
      customer_id: form.customer_id,
      vehicle_id: form.vehicle_id || null,
      mechanic_id: form.mechanic_id || null,
      scheduled_at: new Date(`${form.date}T${form.time}:00`).toISOString(),
      duration_minutes: Number(form.duration_minutes) || 60,
      purpose: form.purpose.trim() || null,
      notes: form.notes.trim() || null,
      created_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Appointment booked");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New appointment</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Customer *</Label>
            <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value, vehicle_id: "" })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select…</option>
              {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><Label>Vehicle (optional)</Label>
            <select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })} disabled={!form.customer_id} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50">
              <option value="">Not sure yet</option>
              {vehicles.map((v: any) => <option key={v.id} value={v.id}>{[v.make, v.model].filter(Boolean).join(" ") || "Vehicle"}{v.registration_number ? ` · ${v.registration_number}` : ""}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1" /></div>
            <div><Label>Time</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="mt-1" /></div>
            <div><Label>Duration (min)</Label><Input type="number" min={15} step={15} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} className="mt-1" /></div>
          </div>
          <div><Label>Purpose</Label><Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className="mt-1" placeholder="e.g. Brake inspection" /></div>
          <div><Label>Mechanic</Label>
            <select value={form.mechanic_id} onChange={(e) => setForm({ ...form, mechanic_id: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Unassigned</option>
              {mechanics.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          {conflict && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {conflict}
            </div>
          )}
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Book"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
