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
import { CalendarDays, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700", confirmed: "bg-teal-100 text-teal-700", completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700", no_show: "bg-slate-100 text-slate-600",
};

function toLocalTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function GarageCalendar() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [appointments, setAppointments] = useState<any[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const start = new Date(`${date}T00:00:00`).toISOString();
    const end = new Date(`${date}T23:59:59`).toISOString();
    const { data, error } = await (supabase as any)
      .from("garage_appointments")
      .select("*, garage_customers(name, phone), garage_vehicles(make, model, registration_number), garage_mechanics(name)")
      .gte("scheduled_at", start).lte("scheduled_at", end)
      .order("scheduled_at");
    if (error) toast.error(error.message);
    setAppointments(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile, date]);

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

  const grouped = useMemo(() => appointments, [appointments]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">Appointments for the day — book, reschedule, or turn one into a job.</p>
        </div>
        <div className="flex gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
          <Button onClick={() => setNewOpen(true)}><Plus className="mr-2 h-4 w-4" />New appointment</Button>
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : grouped.length === 0 ? (
        <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Nothing booked" description="No appointments scheduled for this day." />
      ) : (
        <div className="space-y-2">
          {grouped.map((a: any) => (
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
                <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_BADGE[a.status]}`}>{a.status.replace("_", " ")}</span>
                {a.status === "scheduled" && <Button size="sm" variant="outline" onClick={() => setStatus(a.id, "confirmed")} disabled={busyId === a.id}>Confirm</Button>}
                {["scheduled", "confirmed"].includes(a.status) && !a.job_id && (
                  <Button size="sm" onClick={() => convertToJob(a)} disabled={busyId === a.id}>{busyId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Convert to job"}</Button>
                )}
                {["scheduled", "confirmed"].includes(a.status) && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setStatus(a.id, "no_show")} disabled={busyId === a.id}>No-show</Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => setStatus(a.id, "cancelled")} disabled={busyId === a.id}>Cancel</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewAppointmentDialog open={newOpen} setOpen={setNewOpen} defaultDate={date} orgId={profile?.organisation_id} userId={user?.id} onSaved={load} />
    </div>
  );
}

function NewAppointmentDialog({ open, setOpen, defaultDate, orgId, userId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ customer_id: "", vehicle_id: "", mechanic_id: "", date: defaultDate, time: "09:00", duration_minutes: "60", purpose: "", notes: "" });

  useEffect(() => {
    if (open) {
      setForm({ customer_id: "", vehicle_id: "", mechanic_id: "", date: defaultDate, time: "09:00", duration_minutes: "60", purpose: "", notes: "" });
      Promise.all([
        (supabase as any).from("garage_customers").select("id, name").order("name"),
        (supabase as any).from("garage_mechanics").select("id, name").eq("status", "active").order("name"),
      ]).then(([{ data: c }, { data: m }]) => { setCustomers(c ?? []); setMechanics(m ?? []); });
    }
  }, [open, defaultDate]);

  useEffect(() => {
    if (!form.customer_id) { setVehicles([]); return; }
    (supabase as any).from("garage_vehicles").select("id, make, model, registration_number").eq("customer_id", form.customer_id).order("created_at", { ascending: false })
      .then(({ data }: any) => setVehicles(data ?? []));
  }, [form.customer_id]);

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
