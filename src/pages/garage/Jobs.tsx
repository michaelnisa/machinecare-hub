import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ClipboardList, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { STATUS_FLOW, STATUS_LABEL, STATUS_BADGE, PRIORITY_BORDER, formatJobNumber } from "@/lib/garage-constants";

const TABS = [{ value: "all", label: "All" }, ...STATUS_FLOW.map((s) => ({ value: s, label: STATUS_LABEL[s] }))];

export default function GarageJobs() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [tab, setTab] = useState(params.get("status") ?? "all");
  const [newOpen, setNewOpen] = useState(false);

  const changeTab = (v: string) => { setTab(v); setParams(v === "all" ? {} : { status: v }); };

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("garage_jobs")
      .select("*, garage_customers(id, name), garage_vehicles(id, make, model, registration_number), garage_mechanics(id, name)")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setJobs(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const filtered = useMemo(() => (tab === "all" ? jobs : jobs.filter((j) => j.status === tab)), [jobs, tab]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: jobs.length };
    jobs.forEach((j) => { c[j.status] = (c[j.status] ?? 0) + 1; });
    return c;
  }, [jobs]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-sm text-muted-foreground">Every repair and service job, start to finish.</p>
        </div>
        <Button onClick={() => setNewOpen(true)}><Plus className="mr-2 h-4 w-4" />Create job</Button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.value} onClick={() => changeTab(t.value)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${tab === t.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted/60"}`}>
            {t.label} {counts[t.value] ? <span className="opacity-70">({counts[t.value]})</span> : ""}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-5 w-5" />} title={jobs.length === 0 ? "No jobs yet" : "Nothing in this status"} description={jobs.length === 0 ? "Create your first job when a customer's vehicle comes in." : "Try a different tab."} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((j) => (
            <button key={j.id} onClick={() => navigate(`/garage/jobs/${j.id}`)}
              className={`rounded-xl border border-l-4 ${PRIORITY_BORDER[j.priority] ?? "border-l-slate-400"} border-border bg-card p-4 text-left hover:border-primary/50`}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-medium text-muted-foreground">{formatJobNumber(j)}</div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[j.status]}`}>{STATUS_LABEL[j.status]}</span>
              </div>
              <div className="mt-1.5 font-medium">
                {[j.garage_vehicles?.make, j.garage_vehicles?.model].filter(Boolean).join(" ") || "Vehicle"}
                {j.garage_vehicles?.registration_number && <span className="ml-1.5 text-xs text-muted-foreground">{j.garage_vehicles.registration_number}</span>}
              </div>
              <div className="text-xs text-muted-foreground">{j.garage_customers?.name}</div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{j.reported_problem}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{j.garage_mechanics?.name ?? "Unassigned"}</span>
                <span>{formatDate(j.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <NewJobDialog open={newOpen} setOpen={setNewOpen} orgId={profile?.organisation_id} userId={user?.id} onSaved={load} />
    </div>
  );
}

function NewJobDialog({ open, setOpen, orgId, userId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ customer_id: "", vehicle_id: "", reported_problem: "", mileage_at_intake: "", mechanic_id: "", priority: "normal", expected_completion: "", notes: "" });

  useEffect(() => {
    if (open) {
      setForm({ customer_id: "", vehicle_id: "", reported_problem: "", mileage_at_intake: "", mechanic_id: "", priority: "normal", expected_completion: "", notes: "" });
      Promise.all([
        (supabase as any).from("garage_customers").select("id, name").order("name"),
        (supabase as any).from("garage_mechanics").select("id, name").eq("status", "active").order("name"),
      ]).then(([{ data: c }, { data: m }]) => { setCustomers(c ?? []); setMechanics(m ?? []); });
    }
  }, [open]);

  useEffect(() => {
    if (!form.customer_id) { setVehicles([]); return; }
    (supabase as any).from("garage_vehicles").select("id, make, model, registration_number, mileage").eq("customer_id", form.customer_id).order("created_at", { ascending: false })
      .then(({ data }: any) => setVehicles(data ?? []));
  }, [form.customer_id]);

  const onVehicleChange = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    setForm((f: any) => ({ ...f, vehicle_id: id, mileage_at_intake: v ? String(v.mileage ?? 0) : f.mileage_at_intake }));
  };

  const submit = async () => {
    if (!form.customer_id) return toast.error("Select a customer");
    if (!form.vehicle_id) return toast.error("Select a vehicle");
    if (!form.reported_problem.trim()) return toast.error("Describe the reported problem");
    setSaving(true);
    const { error } = await (supabase as any).from("garage_jobs").insert({
      organisation_id: orgId,
      customer_id: form.customer_id,
      vehicle_id: form.vehicle_id,
      mechanic_id: form.mechanic_id || null,
      reported_problem: form.reported_problem.trim(),
      mileage_at_intake: form.mileage_at_intake ? Number(form.mileage_at_intake) : null,
      priority: form.priority,
      expected_completion: form.expected_completion || null,
      notes: form.notes.trim() || null,
      created_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Job created");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create job</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Customer *</Label>
            <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value, vehicle_id: "" })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select…</option>
              {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><Label>Vehicle *</Label>
            <select value={form.vehicle_id} onChange={(e) => onVehicleChange(e.target.value)} disabled={!form.customer_id} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50">
              <option value="">{form.customer_id ? "Select…" : "Select a customer first"}</option>
              {vehicles.map((v: any) => <option key={v.id} value={v.id}>{[v.make, v.model].filter(Boolean).join(" ") || "Vehicle"}{v.registration_number ? ` · ${v.registration_number}` : ""}</option>)}
            </select>
          </div>
          <div><Label>Reported problem *</Label><Textarea rows={2} value={form.reported_problem} onChange={(e) => setForm({ ...form, reported_problem: e.target.value })} className="mt-1" placeholder="What the customer says is wrong" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Mileage at intake (km)</Label><Input type="number" min={0} value={form.mileage_at_intake} onChange={(e) => setForm({ ...form, mileage_at_intake: e.target.value })} className="mt-1" /></div>
            <div><Label>Priority</Label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {["low", "normal", "high", "urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Mechanic</Label>
              <select value={form.mechanic_id} onChange={(e) => setForm({ ...form, mechanic_id: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Unassigned</option>
                {mechanics.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div><Label>Expected completion</Label><Input type="date" value={form.expected_completion} onChange={(e) => setForm({ ...form, expected_completion: e.target.value })} className="mt-1" /></div>
          </div>
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create job"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
