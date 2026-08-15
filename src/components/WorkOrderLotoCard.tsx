import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader2, Lock, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

interface Props {
  wo: any;
  onSaved: () => void;
}

const ENERGY_TYPES = ["electrical", "mechanical", "pneumatic", "hydraulic", "thermal", "other"];

const STATUS_CLASS: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-600",
  in_progress: "bg-amber-100 text-amber-700",
  verified: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-100 text-slate-600",
};

export function WorkOrderLotoCard({ wo, onSaved }: Props) {
  const { profile } = useAuth();
  const [checklist, setChecklist] = useState<any>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("wo_loto_checklists")
      .select("*")
      .eq("work_order_id", wo.id)
      .maybeSingle();
    setChecklist(data ?? null);
    if (data) {
      const { data: es } = await (supabase as any)
        .from("wo_loto_energy_sources")
        .select("*")
        .eq("checklist_id", data.id)
        .order("energy_type");
      setSources(es ?? []);
    } else {
      setSources([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [wo.id]);

  const start = async () => {
    setSaving(true);
    const { data, error } = await (supabase as any)
      .from("wo_loto_checklists")
      .insert({ organisation_id: wo.organisation_id, work_order_id: wo.id, status: "not_started", created_by: profile?.id })
      .select()
      .single();
    setSaving(false);
    if (error || !data) return toast.error(error?.message ?? "Failed to start LOTO");
    setChecklist(data);
    toast.success("LOTO checklist started");
    onSaved();
  };

  const addSource = async (energy_type: string) => {
    if (!checklist) return;
    const { error } = await (supabase as any).from("wo_loto_energy_sources").insert({ checklist_id: checklist.id, energy_type });
    if (error) return toast.error(error.message);
    load();
  };

  const updateSource = async (id: string, patch: any) => {
    const { error } = await (supabase as any).from("wo_loto_energy_sources").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const setStep = async (patch: any) => {
    if (!checklist) return;
    setSaving(true);
    const { error } = await (supabase as any).from("wo_loto_checklists").update(patch).eq("id", checklist.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    load();
    onSaved();
  };

  const allIsolated = sources.length > 0 && sources.every((s) => s.isolated);
  const allVerified = sources.length > 0 && sources.every((s) => s.verified);

  const verifyZeroEnergy = () => setStep({
    status: "verified",
    verified_zero_energy_at: new Date().toISOString(),
    verified_by: profile?.id,
    authorized_by: profile?.id,
  });

  const restore = () => setStep({
    status: "closed",
    restored_at: new Date().toISOString(),
    locks_removed_at: new Date().toISOString(),
  });

  if (loading) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Lock className="h-4 w-4 text-amber-600" /> Lockout / Tagout (LOTO)
        </div>
        {checklist && (
          <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_CLASS[checklist.status]}`}>
            {checklist.status.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {!checklist && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">This job doesn't have a LOTO checklist. Start one if energy isolation is required.</p>
          <Button size="sm" variant="outline" onClick={start} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Start LOTO
          </Button>
        </div>
      )}

      {checklist && checklist.status !== "closed" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
            Work can't start until every energy source below is isolated and verified at zero energy.
          </div>

          <div className="space-y-2">
            {sources.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-2 text-xs">
                <span className="w-24 shrink-0 font-medium capitalize">{s.energy_type}</span>
                <label className="flex items-center gap-1.5">
                  <Checkbox checked={s.isolated} onCheckedChange={(v) => updateSource(s.id, { isolated: !!v, isolated_by: profile?.id, isolated_at: new Date().toISOString() })} />
                  Isolated
                </label>
                <Input placeholder="Lock ID" defaultValue={s.lock_id ?? ""} onBlur={(e) => e.target.value !== (s.lock_id ?? "") && updateSource(s.id, { lock_id: e.target.value || null })} className="h-7 w-28 text-xs" />
                <Input placeholder="Tag ID" defaultValue={s.tag_id ?? ""} onBlur={(e) => e.target.value !== (s.tag_id ?? "") && updateSource(s.id, { tag_id: e.target.value || null })} className="h-7 w-28 text-xs" />
                <label className="flex items-center gap-1.5">
                  <Checkbox checked={s.verified} disabled={!s.isolated} onCheckedChange={(v) => updateSource(s.id, { verified: !!v, verified_by: profile?.id, verified_at: new Date().toISOString() })} />
                  Verified
                </label>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {ENERGY_TYPES.filter((t) => !sources.some((s) => s.energy_type === t)).map((t) => (
              <button key={t} onClick={() => addSource(t)} className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs capitalize text-muted-foreground hover:border-primary hover:text-primary">
                <Plus className="mr-1 inline h-3 w-3" />{t}
              </button>
            ))}
          </div>

          {checklist.status !== "verified" && (
            <Button size="sm" onClick={verifyZeroEnergy} disabled={!allIsolated || !allVerified || saving} className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Confirm zero energy — authorize work
            </Button>
          )}

          {checklist.status === "verified" && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800">
              Zero energy verified{checklist.verified_zero_energy_at && ` on ${formatDate(checklist.verified_zero_energy_at)}`}. Work may start.
              <div className="mt-2">
                <Button size="sm" variant="outline" onClick={restore} disabled={saving}>Restore energy &amp; remove locks</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {checklist?.status === "closed" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          Energy restored and locks removed{checklist.restored_at && ` on ${formatDate(checklist.restored_at)}`}.
        </div>
      )}
    </div>
  );
}
