import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { UserCog, Plus, Loader2, Phone } from "lucide-react";
import { toast } from "sonner";

const ACTIVE_STATUSES = new Set(["received", "diagnosing", "estimate", "awaiting_approval", "approved", "in_progress", "quality_check", "ready"]);

export default function GarageMechanics() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [jobCounts, setJobCounts] = useState<Record<string, { active: number; completed: number }>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: m, error: e1 }, { data: j, error: e2 }] = await Promise.all([
      (supabase as any).from("garage_mechanics").select("*").order("name"),
      (supabase as any).from("garage_jobs").select("mechanic_id, status").not("mechanic_id", "is", null),
    ]);
    const err = e1 || e2;
    if (err) toast.error(err.message);
    setMechanics(m ?? []);
    const counts: Record<string, { active: number; completed: number }> = {};
    (j ?? []).forEach((row: any) => {
      const e = counts[row.mechanic_id] ?? { active: 0, completed: 0 };
      if (ACTIVE_STATUSES.has(row.status)) e.active += 1; else if (row.status !== "cancelled") e.completed += 1;
      counts[row.mechanic_id] = e;
    });
    setJobCounts(counts);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const active = useMemo(() => mechanics.filter((m) => m.status === "active"), [mechanics]);
  const inactive = useMemo(() => mechanics.filter((m) => m.status !== "active"), [mechanics]);

  if (loading) return <PageLoader />;

  const Row = ({ m }: { m: any }) => {
    const c = jobCounts[m.id] ?? { active: 0, completed: 0 };
    return (
      <div key={m.id} className="rounded-xl border border-border bg-card p-4 cursor-pointer hover:border-primary/50" onClick={() => { setEditing(m); setFormOpen(true); }}>
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium">{m.name}</div>
          <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${m.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{m.status}</span>
        </div>
        {m.specialization && <div className="mt-1 text-xs text-muted-foreground">{m.specialization}</div>}
        {m.phone && <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{m.phone}</div>}
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <span>{c.active} active job{c.active === 1 ? "" : "s"}</span>
          <span>{c.completed} completed</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mechanics</h1>
          <p className="text-sm text-muted-foreground">Your workshop team — who's working what, and how much they've completed.</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="mr-2 h-4 w-4" />Add mechanic</Button>
      </div>

      {mechanics.length === 0 ? (
        <EmptyState icon={<UserCog className="h-5 w-5" />} title="No mechanics yet" description="Add your team so you can assign jobs to them." />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((m) => <Row key={m.id} m={m} />)}
          </div>
          {inactive.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">Inactive</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {inactive.map((m) => <Row key={m.id} m={m} />)}
              </div>
            </div>
          )}
        </div>
      )}

      <MechanicFormDialog open={formOpen} setOpen={setFormOpen} editing={editing} orgId={profile?.organisation_id} userId={user?.id} onSaved={load} />
    </div>
  );
}

function MechanicFormDialog({ open, setOpen, editing, orgId, userId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", specialization: "", status: "active", notes: "" });

  useEffect(() => {
    if (open) setForm(editing ? { name: editing.name ?? "", phone: editing.phone ?? "", specialization: editing.specialization ?? "", status: editing.status ?? "active", notes: editing.notes ?? "" } : { name: "", phone: "", specialization: "", status: "active", notes: "" });
  }, [open, editing]);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload = { name: form.name.trim(), phone: form.phone.trim() || null, specialization: form.specialization.trim() || null, status: form.status, notes: form.notes.trim() || null };
    const { error } = editing
      ? await (supabase as any).from("garage_mechanics").update(payload).eq("id", editing.id)
      : await (supabase as any).from("garage_mechanics").insert({ ...payload, organisation_id: orgId, created_by: userId });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Mechanic updated" : "Mechanic added");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Edit mechanic" : "Add mechanic"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" /></div>
            <div><Label>Specialization</Label><Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} className="mt-1" placeholder="e.g. Engine, Electrical" /></div>
          </div>
          {editing && (
            <div><Label>Status</Label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
