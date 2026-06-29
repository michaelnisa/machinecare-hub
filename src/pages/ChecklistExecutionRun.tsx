import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/PageLoader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ArrowLeft, Check, X, MinusCircle, CheckCircle2, AlertTriangle, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

const SEVERITY_COLORS: Record<string, string> = {
  minor: "bg-muted text-muted-foreground",
  major: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  critical: "bg-destructive/15 text-destructive",
};

export default function ChecklistExecutionRun() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [exec, setExec] = useState<any>(null);
  const [machine, setMachine] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [notes, setNotes] = useState("");

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: e } = await supabase.from("checklist_executions").select("*").eq("id", id).maybeSingle();
    setExec(e);
    setNotes(e?.notes ?? "");
    if (e) {
      const [{ data: m }, { data: t }, { data: rs }] = await Promise.all([
        supabase.from("machines").select("id, name, category").eq("id", e.machine_id).maybeSingle(),
        supabase.from("checklist_templates").select("id, name, version").eq("id", e.template_id).maybeSingle(),
        supabase.from("checklist_execution_responses").select("*").eq("execution_id", id).order("sort_order"),
      ]);
      setMachine(m);
      setTemplate(t);
      setResponses(rs ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <PageLoader />;
  if (!exec) return (
    <div className="space-y-4">
      <Link to="/checklist-templates" className="text-sm text-primary hover:underline">← Back</Link>
      <p className="text-muted-foreground">Inspection not found.</p>
    </div>
  );

  const isCompleted = exec.status === "completed";
  const totals = responses.reduce(
    (acc, r) => {
      if (r.result === "pass") acc.pass++;
      else if (r.result === "fail") acc.fail++;
      else if (r.result === "na") acc.na++;
      else acc.pending++;
      return acc;
    },
    { pass: 0, fail: 0, na: 0, pending: 0 }
  );

  const updateResponse = async (resId: string, patch: any) => {
    setResponses((prev) => prev.map((r) => (r.id === resId ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("checklist_execution_responses").update(patch).eq("id", resId);
    if (error) toast.error(error.message);
  };

  const complete = async () => {
    setCompleting(true);
    const { error } = await supabase
      .from("checklist_executions")
      .update({ status: "completed", notes: notes.trim() || null })
      .eq("id", exec.id);
    setCompleting(false);
    setConfirmComplete(false);
    if (error) return toast.error(error.message);
    if (totals.fail > 0) toast.success(`Inspection complete. ${totals.fail} work order(s) created from failed items.`);
    else toast.success("Inspection complete");
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to={machine ? `/machines/${machine.id}` : "/checklist-templates"} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{template?.name ?? "Inspection"}</h1>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs">v{exec.template_version}</span>
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${isCompleted ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>
              {exec.status.replace("_", " ")}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {machine?.name} · {formatDate(exec.performed_at)} · By {exec.performed_by_name ?? "—"}
            {exec.hours_at_execution != null && ` · ${exec.hours_at_execution} hrs/km`}
          </p>
        </div>
        {!isCompleted && (
          <Button onClick={() => setConfirmComplete(true)} disabled={totals.pending > 0}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Complete inspection
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Passed" value={totals.pass} tone="primary" />
        <Stat label="Failed" value={totals.fail} tone="destructive" />
        <Stat label="N/A" value={totals.na} tone="muted" />
        <Stat label="Pending" value={totals.pending} tone="amber" />
      </div>

      <ol className="space-y-3">
        {responses.map((r, idx) => (
          <li key={r.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">{idx + 1}</span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{r.item_text_snapshot}</p>
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${SEVERITY_COLORS[r.severity_snapshot]}`}>
                    {r.severity_snapshot}
                  </span>
                  {r.work_order_id && (
                    <Link to="/work-orders" className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] text-primary hover:underline">
                      <Wrench className="h-3 w-3" /> Work order created
                    </Link>
                  )}
                </div>

                {/* Pass / Fail / NA buttons */}
                {!isCompleted && (
                  <div className="flex flex-wrap gap-2">
                    <ResultButton active={r.result === "pass"} onClick={() => updateResponse(r.id, { result: "pass" })} tone="pass"><Check className="h-3.5 w-3.5" /> Pass</ResultButton>
                    <ResultButton active={r.result === "fail"} onClick={() => updateResponse(r.id, { result: "fail" })} tone="fail"><X className="h-3.5 w-3.5" /> Fail</ResultButton>
                    <ResultButton active={r.result === "na"} onClick={() => updateResponse(r.id, { result: "na" })} tone="na"><MinusCircle className="h-3.5 w-3.5" /> N/A</ResultButton>
                  </div>
                )}
                {isCompleted && r.result && (
                  <p className="text-xs capitalize text-muted-foreground">Result: <span className={r.result === "fail" ? "font-medium text-destructive" : r.result === "pass" ? "font-medium text-primary" : "font-medium"}>{r.result}</span></p>
                )}

                {r.item_type === "measurement" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Measured value</Label>
                      <Input
                        type="number"
                        disabled={isCompleted}
                        defaultValue={r.measured_value ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          if (v !== r.measured_value) updateResponse(r.id, { measured_value: v });
                        }}
                      />
                    </div>
                  </div>
                )}
                {(r.item_type === "text") && (
                  <Textarea
                    rows={2}
                    placeholder="Answer / observation"
                    disabled={isCompleted}
                    defaultValue={r.text_response ?? ""}
                    onBlur={(e) => e.target.value !== (r.text_response ?? "") && updateResponse(r.id, { text_response: e.target.value || null })}
                  />
                )}

                <Textarea
                  rows={2}
                  placeholder="Notes (optional)"
                  disabled={isCompleted}
                  defaultValue={r.notes ?? ""}
                  onBlur={(e) => e.target.value !== (r.notes ?? "") && updateResponse(r.id, { notes: e.target.value || null })}
                />

                {r.result === "fail" && !isCompleted && (
                  <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3" /> A work order will be created when this inspection is completed.
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {!isCompleted && (
        <div className="rounded-xl border border-border bg-card p-5">
          <Label htmlFor="ins-notes" className="text-sm font-semibold">Inspection notes</Label>
          <Textarea id="ins-notes" rows={3} className="mt-2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Overall observations" />
        </div>
      )}

      <ConfirmDialog
        open={confirmComplete}
        onOpenChange={setConfirmComplete}
        title="Complete inspection?"
        description={totals.fail > 0
          ? `${totals.fail} failed item(s) will automatically create open work orders. This cannot be undone.`
          : "Mark this inspection as complete. This cannot be undone."}
        onConfirm={async () => { await complete(); }}
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "primary" | "destructive" | "muted" | "amber" }) {
  const toneClass: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    destructive: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
    amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  };
  return (
    <div className={`rounded-xl border border-border bg-card p-4`}>
      <div className={`inline-flex rounded-md px-2 py-0.5 text-xs ${toneClass[tone]}`}>{label}</div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ResultButton({ active, onClick, tone, children }: { active: boolean; onClick: () => void; tone: "pass" | "fail" | "na"; children: React.ReactNode }) {
  const tones = {
    pass: active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-primary/10",
    fail: active ? "bg-destructive text-destructive-foreground" : "bg-muted hover:bg-destructive/10",
    na: active ? "bg-foreground text-background" : "bg-muted hover:bg-foreground/10",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${tones[tone]}`}
    >
      {children}
    </button>
  );
}
