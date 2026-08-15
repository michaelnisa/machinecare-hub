import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ClipboardList, CheckCircle2, XCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Props {
  wo: any;
  onSaved: () => void;
}

const RISK_CLASS: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  pending_approval: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

function riskLevel(likelihood: number, severity: number) {
  const score = (likelihood || 0) * (severity || 0);
  if (score >= 16) return "critical";
  if (score >= 10) return "high";
  if (score >= 5) return "medium";
  if (score > 0) return "low";
  return "";
}

type Item = {
  hazard: string;
  consequence: string;
  likelihood: number;
  severity: number;
  control_measure: string;
  residual_likelihood: number;
  residual_severity: number;
};

const emptyItem = (): Item => ({
  hazard: "",
  consequence: "",
  likelihood: 3,
  severity: 3,
  control_measure: "",
  residual_likelihood: 1,
  residual_severity: 1,
});

export function WorkOrderRiskAssessmentCard({ wo, onSaved }: Props) {
  const { profile } = useAuth();
  const { isManager } = useUserRole();
  const [assessment, setAssessment] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewNote, setReviewNote] = useState("");

  const canReview = isManager || profile?.department === "safety";

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("risk_assessments")
      .select("*")
      .eq("work_order_id", wo.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setAssessment(data ?? null);
    if (data) {
      const { data: its } = await (supabase as any)
        .from("risk_assessment_items")
        .select("*")
        .eq("risk_assessment_id", data.id)
        .order("order_index");
      setItems(its ?? []);
      const ids = [data.created_by, data.reviewed_by].filter(Boolean) as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => { map[p.id] = p.full_name ?? "—"; });
        setNames(map);
      }
    } else {
      setItems([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [wo.id]);

  const submitForApproval = async () => {
    if (!assessment) return;
    setSubmitting(true);
    const { error } = await (supabase as any)
      .from("risk_assessments")
      .update({ status: "pending_approval", submitted_at: new Date().toISOString() })
      .eq("id", assessment.id);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Submitted for Safety approval");
    load();
    onSaved();
  };

  const review = async (status: "approved" | "rejected") => {
    if (!assessment) return;
    setReviewing(true);
    const { error } = await (supabase as any)
      .from("risk_assessments")
      .update({ status, reviewed_by: profile?.id, reviewed_at: new Date().toISOString(), review_note: reviewNote.trim() || null })
      .eq("id", assessment.id);
    setReviewing(false);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Risk assessment approved" : "Risk assessment rejected");
    setReviewNote("");
    load();
    onSaved();
  };

  if (loading) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ClipboardList className="h-4 w-4 text-primary" /> Risk Assessment / JSA
        </div>
        {assessment && (
          <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_CLASS[assessment.status]}`}>
            {assessment.status.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {!assessment && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">No risk assessment has been done for this job yet.</p>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New risk assessment
          </Button>
        </div>
      )}

      {assessment && (
        <div className="space-y-3">
          {assessment.overall_risk && (
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs capitalize ${RISK_CLASS[assessment.overall_risk]}`}>
              Overall risk: {assessment.overall_risk}
            </span>
          )}

          {items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-left uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Hazard</th>
                    <th className="px-3 py-2 font-medium">Consequence</th>
                    <th className="px-3 py-2 font-medium">Initial risk</th>
                    <th className="px-3 py-2 font-medium">Control measure</th>
                    <th className="px-3 py-2 font-medium">Residual risk</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-t border-border">
                      <td className="px-3 py-2">{it.hazard}</td>
                      <td className="px-3 py-2 text-muted-foreground">{it.consequence || "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 capitalize ${RISK_CLASS[it.initial_risk] ?? ""}`}>{it.initial_risk}</span>
                      </td>
                      <td className="px-3 py-2">{it.control_measure || "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 capitalize ${RISK_CLASS[it.residual_risk] ?? ""}`}>{it.residual_risk}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {assessment.status === "draft" && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              Draft — not yet sent to Safety.
              <Button size="sm" onClick={submitForApproval} disabled={submitting}>
                {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Submit for approval
              </Button>
            </div>
          )}

          {assessment.status === "pending_approval" && (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                Pending Safety approval — submitted by {names[assessment.created_by ?? ""] ?? "—"}
                {assessment.submitted_at && ` ${formatDistanceToNow(new Date(assessment.submitted_at), { addSuffix: true })}`}.
                Work can't start until this is approved.
              </div>
              {canReview && (
                <div className="space-y-2">
                  <Textarea rows={2} placeholder="Review note (optional)" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => review("approved")} disabled={reviewing} className="gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => review("rejected")} disabled={reviewing} className="gap-1.5">
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {(assessment.status === "approved" || assessment.status === "rejected") && (
            <div className={assessment.status === "approved" ? "rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800" : "rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800"}>
              {assessment.status === "approved" ? "Approved" : "Rejected"} by {names[assessment.reviewed_by ?? ""] ?? "—"}
              {assessment.reviewed_at && ` ${formatDistanceToNow(new Date(assessment.reviewed_at), { addSuffix: true })}`}
              {assessment.review_note && <div className="mt-1 rounded bg-white/60 p-2">{assessment.review_note}</div>}
              {assessment.status === "rejected" && (
                <div className="mt-2">
                  <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> New risk assessment
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <NewAssessmentDialog open={open} setOpen={setOpen} wo={wo} userId={profile?.id} onSaved={() => { load(); onSaved(); }} />
    </div>
  );
}

function NewAssessmentDialog({ open, setOpen, wo, userId, onSaved }: any) {
  const [title, setTitle] = useState("");
  const [activity, setActivity] = useState(wo.title ?? "");
  const [rows, setRows] = useState<Item[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setTitle(""); setActivity(wo.title ?? ""); setRows([emptyItem()]); }
  }, [open]);

  const updateRow = (i: number, patch: Partial<Item>) => {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  };

  const save = async () => {
    if (!title.trim()) return toast.error("Title is required");
    if (rows.some((r) => !r.hazard.trim())) return toast.error("Every row needs a hazard");
    setSaving(true);

    const risks = rows.map((r) => riskLevel(r.likelihood, r.severity));
    const overall = risks.includes("critical") ? "critical" : risks.includes("high") ? "high" : risks.includes("medium") ? "medium" : "low";

    const { data: ra, error } = await (supabase as any)
      .from("risk_assessments")
      .insert({
        organisation_id: wo.organisation_id,
        work_order_id: wo.id,
        machine_id: wo.machine_id ?? null,
        title: title.trim(),
        activity: activity.trim() || null,
        overall_risk: overall,
        created_by: userId,
      })
      .select()
      .single();

    if (error || !ra) { setSaving(false); return toast.error(error?.message ?? "Failed to save"); }

    const itemRows = rows.map((r, idx) => ({
      risk_assessment_id: ra.id,
      order_index: idx,
      hazard: r.hazard.trim(),
      consequence: r.consequence.trim() || null,
      likelihood: r.likelihood,
      severity: r.severity,
      initial_risk: riskLevel(r.likelihood, r.severity),
      control_measure: r.control_measure.trim() || null,
      residual_likelihood: r.residual_likelihood,
      residual_severity: r.residual_severity,
      residual_risk: riskLevel(r.residual_likelihood, r.residual_severity),
    }));

    const { error: itemsErr } = await (supabase as any).from("risk_assessment_items").insert(itemRows);
    setSaving(false);
    if (itemsErr) return toast.error(itemsErr.message);
    toast.success("Risk assessment saved as draft");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New risk assessment</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" placeholder="e.g. Replace filler motor" /></div>
          <div><Label>Activity</Label><Input value={activity} onChange={(e) => setActivity(e.target.value)} className="mt-1" /></div>
        </div>

        <div className="mt-4 space-y-3">
          <Label>Hazards &amp; controls</Label>
          {rows.map((row, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <Input placeholder="Hazard *" value={row.hazard} onChange={(e) => updateRow(i, { hazard: e.target.value })} />
                  <Input placeholder="Consequence" value={row.consequence} onChange={(e) => updateRow(i, { consequence: e.target.value })} />
                </div>
                {rows.length > 1 && (
                  <Button size="icon" variant="ghost" onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <div>
                  <Label className="text-xs">Likelihood (1-5)</Label>
                  <Input type="number" min={1} max={5} value={row.likelihood} onChange={(e) => updateRow(i, { likelihood: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Severity (1-5)</Label>
                  <Input type="number" min={1} max={5} value={row.severity} onChange={(e) => updateRow(i, { severity: Number(e.target.value) })} />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Initial risk</Label>
                  <div className={`mt-1 rounded-md px-2 py-2 text-center text-xs font-medium capitalize ${RISK_CLASS[riskLevel(row.likelihood, row.severity)] ?? "bg-muted"}`}>
                    {riskLevel(row.likelihood, row.severity) || "—"}
                  </div>
                </div>
              </div>
              <Textarea rows={2} placeholder="Control measure (e.g. Isolate power + LOTO + verify zero energy)" value={row.control_measure} onChange={(e) => updateRow(i, { control_measure: e.target.value })} />
              <div className="grid gap-2 sm:grid-cols-4">
                <div>
                  <Label className="text-xs">Residual likelihood</Label>
                  <Input type="number" min={1} max={5} value={row.residual_likelihood} onChange={(e) => updateRow(i, { residual_likelihood: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Residual severity</Label>
                  <Input type="number" min={1} max={5} value={row.residual_severity} onChange={(e) => updateRow(i, { residual_severity: Number(e.target.value) })} />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Residual risk</Label>
                  <div className={`mt-1 rounded-md px-2 py-2 text-center text-xs font-medium capitalize ${RISK_CLASS[riskLevel(row.residual_likelihood, row.residual_severity)] ?? "bg-muted"}`}>
                    {riskLevel(row.residual_likelihood, row.residual_severity) || "—"}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setRows((r) => [...r, emptyItem()])}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add hazard
          </Button>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save as draft"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
