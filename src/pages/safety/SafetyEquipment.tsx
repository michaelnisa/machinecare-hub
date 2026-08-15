import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Flame, Plus, Loader2, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

const TYPES = ["fire_extinguisher", "fire_alarm", "emergency_shower", "eye_wash_station", "first_aid_kit", "emergency_light", "gas_detector", "safety_barrier", "other"];
const CONDITIONS = ["good", "fair", "needs_attention", "out_of_service"];
const CONDITION_CLASS: Record<string, string> = {
  good: "bg-emerald-100 text-emerald-700",
  fair: "bg-blue-100 text-blue-700",
  needs_attention: "bg-amber-100 text-amber-700",
  out_of_service: "bg-red-100 text-red-700",
};

export default function SafetyEquipment() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [inspectTarget, setInspectTarget] = useState<any>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await (supabase as any).from("safety_equipment").select("*").order("next_inspection_date", { ascending: true, nullsFirst: false });
    if (error) toast.error(error.message);
    setEquipment(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const stats = useMemo(() => ({
    overdue: equipment.filter((e) => e.next_inspection_date && e.next_inspection_date < today).length,
    dueSoon: equipment.filter((e) => e.next_inspection_date && e.next_inspection_date >= today && e.next_inspection_date <= in7).length,
    outOfService: equipment.filter((e) => e.condition === "out_of_service").length,
  }), [equipment]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Safety equipment</h1>
          <p className="text-sm text-muted-foreground">Fire extinguishers, alarms, gas detectors and other life-safety assets.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />Add equipment</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Overdue for inspection", value: stats.overdue, tone: stats.overdue > 0 ? "text-red-600" : "" },
          { label: "Due within 7 days", value: stats.dueSoon, tone: stats.dueSoon > 0 ? "text-amber-600" : "" },
          { label: "Out of service", value: stats.outOfService, tone: stats.outOfService > 0 ? "text-red-600" : "" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className={`mt-1 text-2xl font-semibold ${s.tone ?? ""}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {equipment.length === 0 ? (
        <EmptyState icon={<Flame className="h-5 w-5" />} title="No safety equipment tracked yet" description="Add fire extinguishers, alarms and other life-safety assets." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Asset</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Location</th>
                <th className="px-5 py-3 font-medium">Last inspected</th>
                <th className="px-5 py-3 font-medium">Next due</th>
                <th className="px-5 py-3 font-medium">Condition</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {equipment.map((e) => {
                const overdue = e.next_inspection_date && e.next_inspection_date < today;
                return (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-5 py-3">
                      <div className="font-medium">{e.name}</div>
                      {e.asset_tag && <div className="text-xs text-muted-foreground">{e.asset_tag}</div>}
                    </td>
                    <td className="px-5 py-3 capitalize text-muted-foreground">{e.equipment_type.replace(/_/g, " ")}</td>
                    <td className="px-5 py-3 text-muted-foreground">{e.location ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{e.last_inspection_date ? formatDate(e.last_inspection_date) : "—"}</td>
                    <td className={`px-5 py-3 ${overdue ? "font-medium text-red-600" : "text-muted-foreground"}`}>{e.next_inspection_date ? formatDate(e.next_inspection_date) : "—"}</td>
                    <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${CONDITION_CLASS[e.condition]}`}>{e.condition.replace(/_/g, " ")}</span></td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setInspectTarget(e)} className="gap-1.5">
                        <ClipboardCheck className="h-3.5 w-3.5" /> Log inspection
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddEquipmentDialog open={addOpen} setOpen={setAddOpen} userId={user?.id} orgId={profile?.organisation_id} onSaved={load} />
      <InspectDialog target={inspectTarget} onClose={() => setInspectTarget(null)} userId={user?.id} orgId={profile?.organisation_id} onSaved={load} />
    </div>
  );
}

function AddEquipmentDialog({ open, setOpen, userId, orgId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ name: "", asset_tag: "", equipment_type: "fire_extinguisher", location: "", inspection_frequency_days: 30, certificate_expiry: "" });

  useEffect(() => { if (open) setForm({ name: "", asset_tag: "", equipment_type: "fire_extinguisher", location: "", inspection_frequency_days: 30, certificate_expiry: "" }); }, [open]);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    setSaving(true);
    const { error } = await (supabase as any).from("safety_equipment").insert({
      organisation_id: orgId,
      name: form.name.trim(),
      asset_tag: form.asset_tag || null,
      equipment_type: form.equipment_type,
      location: form.location || null,
      inspection_frequency_days: Number(form.inspection_frequency_days) || 30,
      certificate_expiry: form.certificate_expiry || null,
      created_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Equipment added");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add safety equipment</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" placeholder="e.g. Fire extinguisher — Workshop east wall" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Asset tag</Label><Input value={form.asset_tag} onChange={(e) => setForm({ ...form, asset_tag: e.target.value })} className="mt-1" /></div>
            <div><Label>Type</Label>
              <select value={form.equipment_type} onChange={(e) => setForm({ ...form, equipment_type: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1" /></div>
            <div><Label>Inspection every (days)</Label><Input type="number" min={1} value={form.inspection_frequency_days} onChange={(e) => setForm({ ...form, inspection_frequency_days: e.target.value })} className="mt-1" /></div>
          </div>
          <div><Label>Certificate expiry</Label><Input type="date" value={form.certificate_expiry} onChange={(e) => setForm({ ...form, certificate_expiry: e.target.value })} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InspectDialog({ target, onClose, userId, orgId, onSaved }: any) {
  const [condition, setCondition] = useState("good");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (target) { setCondition(target.condition ?? "good"); setNotes(""); } }, [target]);

  if (!target) return null;

  const submit = async () => {
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await (supabase as any).from("safety_equipment").update({
      last_inspection_date: today,
      condition,
      notes: notes || target.notes,
    }).eq("id", target.id);

    if (!error && (condition === "needs_attention" || condition === "out_of_service")) {
      await (supabase as any).from("corrective_actions").insert({
        organisation_id: orgId,
        source_type: "equipment",
        source_id: target.id,
        description: `${target.name} found "${condition.replace(/_/g, " ")}" during inspection${notes ? `: ${notes}` : ""}`,
        department: "safety",
        priority: condition === "out_of_service" ? "high" : "medium",
        status: "open",
        created_by: userId,
      });
    }

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(condition === "good" ? "Inspection logged" : "Inspection logged — corrective action created");
    onClose();
    onSaved();
  };

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Log inspection — {target.name}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Condition found</Label>
            <select value={condition} onChange={(e) => setCondition(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {CONDITIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div><Label>Notes</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" placeholder="Anything found during inspection" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save inspection"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
