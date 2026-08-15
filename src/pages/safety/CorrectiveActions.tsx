import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ListChecks, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

const PRIORITIES = ["low", "medium", "high", "critical"];
const STATUSES = ["open", "in_progress", "pending_verification", "closed"];
const SOURCES = ["incident", "near_miss", "inspection", "risk_assessment", "audit", "other"];

const PRIORITY_CLASS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};
const STATUS_CLASS: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  in_progress: "bg-amber-100 text-amber-700",
  pending_verification: "bg-blue-100 text-blue-700",
  closed: "bg-emerald-100 text-emerald-700",
};

export default function CorrectiveActions() {
  const { profile, user } = useAuth();
  const { isManager } = useUserRole();
  const canReview = isManager || profile?.department === "safety";
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("corrective_actions")
      .select("*")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems(data ?? []);
    const ids = [...new Set((data ?? []).map((x: any) => x.responsible_person).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { map[p.id] = p.full_name ?? "—"; });
      setNames(map);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const today = new Date().toISOString().slice(0, 10);
  const displayStatus = (x: any) => (x.status !== "closed" && x.due_date && x.due_date < today ? "overdue" : x.status);

  const filtered = useMemo(() => filter === "all" ? items : items.filter((x) => displayStatus(x) === filter), [items, filter]);

  const stats = useMemo(() => ({
    open: items.filter((x) => x.status === "open").length,
    overdue: items.filter((x) => displayStatus(x) === "overdue").length,
    pendingVerification: items.filter((x) => x.status === "pending_verification").length,
    closed: items.filter((x) => x.status === "closed").length,
  }), [items]);

  const updateStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "closed") { patch.closed_at = new Date().toISOString(); patch.verified_by = profile?.id; patch.verified_at = new Date().toISOString(); }
    const { error } = await (supabase as any).from("corrective_actions").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Corrective actions</h1>
          <p className="text-sm text-muted-foreground">Actions raised from incidents, near-misses, inspections and risk assessments.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />New action</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Open", value: stats.open },
          { label: "Overdue", value: stats.overdue },
          { label: "Pending verification", value: stats.pendingVerification },
          { label: "Closed", value: stats.closed },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", ...STATUSES, "overdue"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${filter === s ? "bg-primary text-primary-foreground" : "border-border bg-card"}`}>
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ListChecks className="h-5 w-5" />} title="No corrective actions" description="Nothing outstanding right now." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">Source</th>
                <th className="px-5 py-3 font-medium">Priority</th>
                <th className="px-5 py-3 font-medium">Responsible</th>
                <th className="px-5 py-3 font-medium">Due</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((x) => (
                <tr key={x.id} className="border-t border-border">
                  <td className="px-5 py-3 max-w-md">{x.description}</td>
                  <td className="px-5 py-3 capitalize text-muted-foreground">{x.source_type?.replace(/_/g, " ")}</td>
                  <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${PRIORITY_CLASS[x.priority]}`}>{x.priority}</span></td>
                  <td className="px-5 py-3 text-muted-foreground">{names[x.responsible_person] ?? "Unassigned"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{x.due_date ? formatDate(x.due_date) : "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_CLASS[displayStatus(x)] ?? "bg-red-100 text-red-700"}`}>
                      {displayStatus(x).replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {x.status !== "closed" && (
                      <select value={x.status} onChange={(e) => updateStatus(x.id, e.target.value)}
                        disabled={x.status === "pending_verification" && !canReview}
                        className="rounded border border-input bg-background px-2 py-1 text-xs">
                        {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewActionDialog open={open} setOpen={setOpen} userId={user?.id} orgId={profile?.organisation_id} onSaved={load} />
    </div>
  );
}

function NewActionDialog({ open, setOpen, userId, orgId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ source_type: "other", description: "", priority: "medium", due_date: "", department: "" });

  const submit = async () => {
    if (!form.description.trim()) return toast.error("Description required");
    setSaving(true);
    const { error } = await (supabase as any).from("corrective_actions").insert({
      organisation_id: orgId,
      source_type: form.source_type,
      description: form.description.trim(),
      priority: form.priority,
      due_date: form.due_date || null,
      department: form.department || null,
      status: "open",
      created_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Corrective action created");
    setOpen(false);
    setForm({ source_type: "other", description: "", priority: "medium", due_date: "", department: "" });
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New corrective action</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Description *</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Source</Label>
              <select value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div><Label>Priority</Label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="mt-1" /></div>
            <div><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="mt-1" placeholder="e.g. maintenance" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
