import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Settings2, Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const MATCH_FIELDS = [
  { value: "work_type", label: "Work order type" },
  { value: "machine_category", label: "Machine category" },
];

export default function SafetyRules() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await (supabase as any).from("safety_rules").select("*").order("name");
    if (error) toast.error(error.message);
    setRules(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const toggleActive = async (id: string, is_active: boolean) => {
    const { error } = await (supabase as any).from("safety_rules").update({ is_active }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async () => {
    if (!confirm) return;
    const { error } = await (supabase as any).from("safety_rules").delete().eq("id", confirm);
    setConfirm(null);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Safety rules</h1>
          <p className="text-sm text-muted-foreground">
            Define what a job needs based on its type — e.g. "electrical work requires a Risk Assessment, LOTO, and Electrical Safety competency."
            These show as a requirements banner when a matching work order is created.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />New rule</Button>
      </div>

      {rules.length === 0 ? (
        <EmptyState icon={<Settings2 className="h-5 w-5" />} title="No safety rules defined" description="Add rules so job requirements aren't hardcoded — Safety can edit them here." />
      ) : (
        <div className="grid gap-3">
          {rules.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{r.name}</span>
                  {!r.is_active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">inactive</span>}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  When {MATCH_FIELDS.find((f) => f.value === r.match_field)?.label.toLowerCase()} = <span className="font-medium">{r.match_value}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.requires_risk_assessment && <Tag label="Risk assessment" />}
                  {r.requires_loto && <Tag label="LOTO" />}
                  {r.requires_ptw && <Tag label="Permit to work" />}
                  {r.requires_competency && <Tag label={`Competency: ${r.requires_competency}`} />}
                  {(r.required_ppe ?? []).map((p: string) => <Tag key={p} label={p} />)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox checked={r.is_active} onCheckedChange={(v) => toggleActive(r.id, !!v)} /> Active
                </label>
                <Button size="icon" variant="ghost" onClick={() => setConfirm(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <NewRuleDialog open={open} setOpen={setOpen} userId={user?.id} orgId={profile?.organisation_id} onSaved={load} />
      <ConfirmDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)} title="Delete this rule?" description="This cannot be undone." onConfirm={async () => { await remove(); }} />
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">{label}</span>;
}

function NewRuleDialog({ open, setOpen, userId, orgId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    name: "", match_field: "work_type", match_value: "",
    requires_risk_assessment: false, requires_loto: false, requires_ptw: false,
    requires_competency: "", required_ppe: "",
  });

  useEffect(() => {
    if (open) setForm({ name: "", match_field: "work_type", match_value: "", requires_risk_assessment: false, requires_loto: false, requires_ptw: false, requires_competency: "", required_ppe: "" });
  }, [open]);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    if (!form.match_value.trim()) return toast.error("Match value required");
    setSaving(true);
    const { error } = await (supabase as any).from("safety_rules").insert({
      organisation_id: orgId,
      name: form.name.trim(),
      match_field: form.match_field,
      match_value: form.match_value.trim().toLowerCase(),
      requires_risk_assessment: !!form.requires_risk_assessment,
      requires_loto: !!form.requires_loto,
      requires_ptw: !!form.requires_ptw,
      requires_competency: form.requires_competency.trim() || null,
      required_ppe: form.required_ppe.split(",").map((s: string) => s.trim()).filter(Boolean),
      created_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Rule created");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New safety rule</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Rule name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" placeholder="e.g. Electrical work" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Match on</Label>
              <select value={form.match_field} onChange={(e) => setForm({ ...form, match_field: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {MATCH_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div><Label>Equals *</Label><Input value={form.match_value} onChange={(e) => setForm({ ...form, match_value: e.target.value })} className="mt-1" placeholder="e.g. electrical" /></div>
          </div>
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Requirements</Label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.requires_risk_assessment} onCheckedChange={(v) => setForm({ ...form, requires_risk_assessment: !!v })} /> Risk assessment</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.requires_loto} onCheckedChange={(v) => setForm({ ...form, requires_loto: !!v })} /> LOTO</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.requires_ptw} onCheckedChange={(v) => setForm({ ...form, requires_ptw: !!v })} /> Permit to work</label>
          </div>
          <div><Label>Required competency (optional)</Label><Input value={form.requires_competency} onChange={(e) => setForm({ ...form, requires_competency: e.target.value })} className="mt-1" placeholder="Must match a competency name exactly" /></div>
          <div><Label>Required PPE (comma-separated, optional)</Label><Input value={form.required_ppe} onChange={(e) => setForm({ ...form, required_ppe: e.target.value })} className="mt-1" placeholder="Helmet, Gloves, Eye protection" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
