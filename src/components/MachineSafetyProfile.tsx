import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldAlert, Save } from "lucide-react";
import { toast } from "sonner";

interface Props {
  machineId: string;
}

const FIELDS: { key: "hazards" | "energy_sources" | "required_ppe" | "required_competencies" | "required_permit_types"; label: string; placeholder: string }[] = [
  { key: "hazards", label: "Hazards", placeholder: "Electrical, Mechanical, Rotating equipment" },
  { key: "energy_sources", label: "Energy sources", placeholder: "Electrical, Pneumatic, Mechanical" },
  { key: "required_ppe", label: "Required PPE", placeholder: "Safety shoes, Gloves, Eye protection" },
  { key: "required_competencies", label: "Required competencies", placeholder: "Machine-specific training, LOTO" },
  { key: "required_permit_types", label: "Required permit types", placeholder: "Electrical work, Hot work" },
];

const emptyProfile = (machineId: string, orgId: string) => ({
  machine_id: machineId,
  organisation_id: orgId,
  hazards: [] as string[],
  energy_sources: [] as string[],
  required_ppe: [] as string[],
  required_competencies: [] as string[],
  required_permit_types: [] as string[],
  loto_procedure_url: "",
  emergency_stop_installed: false,
  safety_guards_installed: false,
  notes: "",
});

export function MachineSafetyProfile({ machineId }: Props) {
  const { profile } = useAuth();
  const { isManager } = useUserRole();
  const canEdit = isManager || profile?.department === "safety";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [text, setText] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("machine_safety_profiles")
        .select("*")
        .eq("machine_id", machineId)
        .maybeSingle();
      const p = data ?? emptyProfile(machineId, profile.organisation_id);
      setForm(p);
      const t: Record<string, string> = {};
      FIELDS.forEach((f) => { t[f.key] = (p[f.key] ?? []).join(", "); });
      setText(t);
      setLoading(false);
    })();
  }, [machineId, profile]);

  const save = async () => {
    if (!form || !profile) return;
    setSaving(true);
    const payload = {
      machine_id: machineId,
      organisation_id: profile.organisation_id,
      hazards: text.hazards.split(",").map((s) => s.trim()).filter(Boolean),
      energy_sources: text.energy_sources.split(",").map((s) => s.trim()).filter(Boolean),
      required_ppe: text.required_ppe.split(",").map((s) => s.trim()).filter(Boolean),
      required_competencies: text.required_competencies.split(",").map((s) => s.trim()).filter(Boolean),
      required_permit_types: text.required_permit_types.split(",").map((s) => s.trim()).filter(Boolean),
      loto_procedure_url: form.loto_procedure_url || null,
      emergency_stop_installed: form.emergency_stop_installed,
      safety_guards_installed: form.safety_guards_installed,
      notes: form.notes || null,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    };
    const { error } = await (supabase as any)
      .from("machine_safety_profiles")
      .upsert(payload, { onConflict: "machine_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Safety profile saved");
  };

  if (loading || !form) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium">
        <ShieldAlert className="h-4 w-4 text-amber-600" /> Machine safety profile
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.key === "hazards" || f.key === "energy_sources" ? "" : ""}>
            <Label className="text-xs">{f.label}</Label>
            <Input
              disabled={!canEdit}
              value={text[f.key] ?? ""}
              onChange={(e) => setText({ ...text, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              className="mt-1"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Comma-separated</p>
          </div>
        ))}
        <div>
          <Label className="text-xs">LOTO procedure / SOP link</Label>
          <Input disabled={!canEdit} value={form.loto_procedure_url ?? ""} onChange={(e) => setForm({ ...form, loto_procedure_url: e.target.value })} className="mt-1" placeholder="https://…" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox disabled={!canEdit} checked={form.emergency_stop_installed} onCheckedChange={(v) => setForm({ ...form, emergency_stop_installed: !!v })} />
          Emergency stop installed
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox disabled={!canEdit} checked={form.safety_guards_installed} onCheckedChange={(v) => setForm({ ...form, safety_guards_installed: !!v })} />
          Safety guards installed
        </label>
      </div>

      <div className="mt-4">
        <Label className="text-xs">Notes</Label>
        <Textarea disabled={!canEdit} rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" />
      </div>

      {canEdit && (
        <Button size="sm" className="mt-4 gap-1.5" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save safety profile
        </Button>
      )}
    </div>
  );
}
