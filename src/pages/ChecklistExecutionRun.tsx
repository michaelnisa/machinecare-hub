import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/PageLoader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  ArrowLeft, Check, X, MinusCircle, CheckCircle2, AlertTriangle,
  Loader2, Wrench, ClipboardCheck, Camera, Hash, FileText,
  TrendingUp, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { enqueue, errorMessage, looksOffline, listPending } from "@/lib/offlineQueue";
import { cn } from "@/lib/utils";

const SEVERITY_COLORS: Record<string, string> = {
  minor: "bg-muted text-muted-foreground",
  major: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  critical: "bg-destructive/15 text-destructive",
};

const ITEM_TYPE_ICON: Record<string, React.ReactNode> = {
  pass_fail: <ClipboardCheck className="h-3.5 w-3.5" />,
  tri_state: <ClipboardCheck className="h-3.5 w-3.5" />,
  measurement: <TrendingUp className="h-3.5 w-3.5" />,
  text: <FileText className="h-3.5 w-3.5" />,
  photo_required: <Camera className="h-3.5 w-3.5" />,
};

export default function ChecklistExecutionRun() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [exec, setExec] = useState<any>(null);
  const [machine, setMachine] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notes, setNotes] = useState("");
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    if (!id) return;
    const refresh = async () => {
      const ops = await listPending();
      const count = ops.filter((op) => {
        if (op.kind === "checklist_complete") return (op.payload as any)?.executionId === id;
        if (op.kind === "checklist_response_update") {
          return responses.some((r) => r.id === (op.payload as any)?.responseId);
        }
        return false;
      }).length;
      setPendingSync(count);
    };
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [id, responses]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: e } = await supabase.from("checklist_executions").select("*").eq("id", id).maybeSingle();
    setExec(e);
    setNotes(e?.notes ?? "");
    if (e) {
      const [{ data: m }, { data: t }, { data: rs }] = await Promise.all([
        supabase.from("machines").select("id, name, category, organisation_id").eq("id", e.machine_id).maybeSingle(),
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
      if (r.result === "pass" || r.result === "ok") acc.pass++;
      else if (r.result === "fail" || r.result === "not_ok") acc.fail++;
      else if (r.result === "na" || r.result === "not_relevant") acc.na++;
      else acc.pending++;
      return acc;
    },
    { pass: 0, fail: 0, na: 0, pending: 0 },
  );

  const allAnswered = totals.pending === 0 && responses.length > 0;
  const failedItems = responses.filter(r => r.result === "fail" || r.result === "not_ok");

  const updateResponse = async (resId: string, patch: any) => {
    setResponses((prev) => prev.map((r) => (r.id === resId ? { ...r, ...patch } : r)));
    try {
      const { error } = await supabase.from("checklist_execution_responses").update(patch).eq("id", resId);
      if (error) throw error;
    } catch (err) {
      if (looksOffline(err)) {
        await enqueue("checklist_response_update", { responseId: resId, patch });
        toast.message("Saved offline — will sync when connection returns");
      } else {
        toast.error(errorMessage(err, "Failed to save"));
      }
    }
  };

  // ─── CORE FIX: actually create work orders for failed items ───────────────
  const complete = async () => {
    setCompleting(true);
    const overallResult = failedItems.length > 0 ? "fail" : "pass";
    const patch = { status: "completed", notes: notes.trim() || null, overall_result: overallResult };

    try {
      const { error } = await supabase.from("checklist_executions").update(patch).eq("id", exec.id);
      if (error) throw error;

      // Create a work order for each failed item
      if (failedItems.length > 0 && machine && profile) {
        for (const r of failedItems) {
          const { data: wo } = await supabase
            .from("work_orders")
            .insert({
              organisation_id: profile.organisation_id,
              machine_id: machine.id,
              title: `Inspection defect: ${r.item_text_snapshot}`,
              description: r.notes
                ? `Failed during inspection "${template?.name ?? "Inspection"}". Notes: ${r.notes}`
                : `Failed during inspection "${template?.name ?? "Inspection"}". Performed by: ${exec.performed_by_name ?? "Inspector"}.`,
              priority: r.severity_snapshot === "critical" ? "high" : r.severity_snapshot === "major" ? "medium" : "low",
              status: "open",
              work_type: "corrective",
              created_by: profile.id ?? null,
              requested_by_name: exec.performed_by_name ?? null,
              nature_of_problem: r.item_text_snapshot,
            })
            .select("id")
            .single();

          // Link the work order back to the response row
          if (wo?.id) {
            await supabase
              .from("checklist_execution_responses")
              .update({ work_order_id: wo.id })
              .eq("id", r.id);
          }
        }
      }

      setCompleting(false);
      setConfirmComplete(false);
      if (failedItems.length > 0) {
        toast.success(`Inspection complete — ${failedItems.length} work order${failedItems.length === 1 ? "" : "s"} created for defects.`);
      } else {
        toast.success("Inspection complete — all items passed ✓");
      }
      load();
    } catch (err) {
      setCompleting(false);
      setConfirmComplete(false);
      if (looksOffline(err)) {
        await enqueue("checklist_complete", { executionId: exec.id, patch });
        toast.message("No connection — inspection will be marked complete once you're back online");
      } else {
        toast.error(errorMessage(err, "Failed to complete inspection"));
      }
    }
  };

  const handleDeleteDraft = async () => {
    if (!exec) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("checklist_executions").delete().eq("id", exec.id);
      if (error) throw error;
      toast.success("Inspection draft discarded");
      navigate(machine ? `/machines/${machine.id}` : "/checklist-templates");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete inspection"));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  // Overall result badge
  const overallResultBadge = isCompleted ? (
    exec.overall_result === "fail" || exec.overall_result === "attention" ? (
      <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
        <AlertTriangle className="h-3.5 w-3.5" /> Defects Found
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> All Passed
      </span>
    )
  ) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to={machine ? `/machines/${machine.id}` : "/checklist-templates"} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{template?.name ?? "Inspection"}</h1>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs">v{exec.template_version}</span>
            <span className={cn(
              "rounded-md px-2 py-0.5 text-xs font-medium capitalize",
              isCompleted ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
            )}>
              {exec.status.replace("_", " ")}
            </span>
            {overallResultBadge}
            {pendingSync > 0 && (
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                {pendingSync} change{pendingSync === 1 ? "" : "s"} pending sync
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {machine?.name} · {formatDate(exec.performed_at)} · By {exec.performed_by_name ?? "—"}
            {exec.hours_at_execution != null && ` · ${exec.hours_at_execution} hrs/km`}
          </p>
        </div>
        {!isCompleted && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="text-muted-foreground hover:text-destructive"
              disabled={completing || deleting}
            >
              Discard draft
            </Button>
            <Button onClick={() => setConfirmComplete(true)} disabled={!allAnswered || completing || deleting}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Complete inspection
            </Button>
          </div>
        )}
      </div>

      {/* Progress warning when items are unanswered */}
      {!isCompleted && totals.pending > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{totals.pending} item{totals.pending === 1 ? "" : "s"} still need{totals.pending === 1 ? "s" : ""} a response before you can complete this inspection.</span>
        </div>
      )}

      {/* KPI Summary */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Passed" value={totals.pass} tone="success" icon={<Check className="h-4 w-4" />} />
        <StatCard label="Failed" value={totals.fail} tone="destructive" icon={<X className="h-4 w-4" />} />
        <StatCard label="N/A" value={totals.na} tone="muted" icon={<MinusCircle className="h-4 w-4" />} />
        <StatCard label="Pending" value={totals.pending} tone="amber" icon={<AlertCircle className="h-4 w-4" />} />
      </div>

      {/* Failed items summary (post-completion) */}
      {isCompleted && failedItems.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {failedItems.length} defect{failedItems.length === 1 ? "" : "s"} found — work orders auto-created
          </div>
          <ul className="space-y-1">
            {failedItems.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-foreground">• {r.item_text_snapshot}</span>
                {r.work_order_id ? (
                  <Link
                    to="/work-orders"
                    className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] text-primary hover:underline"
                  >
                    <Wrench className="h-3 w-3" /> WO created
                  </Link>
                ) : (
                  <span className="text-[11px] text-muted-foreground">No WO</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Checklist items */}
      <ol className="space-y-3">
        {responses.map((r, idx) => {
          const isFail = r.result === "fail" || r.result === "not_ok";
          const isPass = r.result === "pass" || r.result === "ok";
          const isNA = r.result === "na" || r.result === "not_relevant";
          return (
            <li
              key={r.id}
              className={cn(
                "rounded-xl border bg-card p-4 transition-colors",
                isFail && !isCompleted ? "border-destructive/40" : "border-border",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  {/* Item header */}
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="flex-1">
                      <p className="font-medium leading-snug">{r.item_text_snapshot}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-muted-foreground">{ITEM_TYPE_ICON[r.item_type] ?? <Hash className="h-3.5 w-3.5" />}</span>
                      <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-medium", SEVERITY_COLORS[r.severity_snapshot])}>
                        {r.severity_snapshot}
                      </span>
                    </div>
                  </div>

                  {/* Pass / Fail / NA buttons */}
                  {!isCompleted && (
                    <div className="flex flex-wrap gap-2">
                      <ResultButton active={isPass} onClick={() => updateResponse(r.id, { result: "pass" })} tone="pass">
                        <Check className="h-3.5 w-3.5" /> Pass
                      </ResultButton>
                      <ResultButton active={isFail} onClick={() => updateResponse(r.id, { result: "fail" })} tone="fail">
                        <X className="h-3.5 w-3.5" /> Fail
                      </ResultButton>
                      <ResultButton active={isNA} onClick={() => updateResponse(r.id, { result: "na" })} tone="na">
                        <MinusCircle className="h-3.5 w-3.5" /> N/A
                      </ResultButton>
                    </div>
                  )}

                  {/* Completed result display */}
                  {isCompleted && r.result && (
                    <p className="text-xs text-muted-foreground">
                      Result:{" "}
                      <span className={cn(
                        "font-semibold",
                        isFail ? "text-destructive" : isPass ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
                      )}>
                        {r.result === "not_ok" ? "Fail" : r.result === "not_relevant" ? "N/A" : r.result.toUpperCase()}
                      </span>
                    </p>
                  )}

                  {/* Measurement input */}
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

                  {/* Text answer */}
                  {r.item_type === "text" && (
                    <Textarea
                      rows={2}
                      placeholder="Answer / observation"
                      disabled={isCompleted}
                      defaultValue={r.text_response ?? ""}
                      onBlur={(e) => e.target.value !== (r.text_response ?? "") && updateResponse(r.id, { text_response: e.target.value || null })}
                    />
                  )}

                  {/* Fail notes — show input on fail, show value when completed */}
                  {isFail && !isCompleted && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Defect notes (describe what's wrong)</Label>
                      <Textarea
                        rows={2}
                        placeholder="e.g. Left rear tyre sidewall cracked, oil leak at sump plug…"
                        disabled={isCompleted}
                        defaultValue={r.notes ?? ""}
                        onBlur={(e) => e.target.value !== (r.notes ?? "") && updateResponse(r.id, { notes: e.target.value || null })}
                        className="mt-1"
                      />
                    </div>
                  )}
                  {isCompleted && r.notes && (
                    <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                      Notes: {r.notes}
                    </p>
                  )}

                  {/* Work order link */}
                  {r.work_order_id && (
                    <Link to="/work-orders" className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] text-primary hover:underline">
                      <Wrench className="h-3 w-3" /> Work order created
                    </Link>
                  )}

                  {/* Warning: work order will be created on fail */}
                  {isFail && !isCompleted && !r.work_order_id && (
                    <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3 shrink-0" /> A work order will be auto-created when you complete this inspection.
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Overall inspection notes */}
      {!isCompleted && (
        <div className="rounded-xl border border-border bg-card p-5">
          <Label htmlFor="ins-notes" className="text-sm font-semibold">Inspection notes</Label>
          <Textarea id="ins-notes" rows={3} className="mt-2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Overall observations from this inspection run" />
        </div>
      )}
      {isCompleted && exec.notes && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Inspection Notes</p>
          <p className="text-sm">{exec.notes}</p>
        </div>
      )}

      <ConfirmDialog
        open={confirmComplete}
        onOpenChange={setConfirmComplete}
        title="Complete inspection?"
        description={failedItems.length > 0
          ? `${failedItems.length} failed item${failedItems.length === 1 ? "" : "s"} will automatically create open work orders in the maintenance queue. This cannot be undone.`
          : "Mark this inspection as complete. All items passed. This cannot be undone."}
        confirmLabel={failedItems.length > 0 ? `Complete & create ${failedItems.length} WO${failedItems.length === 1 ? "" : "s"}` : "Complete inspection"}
        confirmVariant="default"
        onConfirm={async () => { await complete(); }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Discard inspection draft?"
        description="This will delete this in-progress inspection run and its recorded responses. This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={async () => { await handleDeleteDraft(); }}
      />
    </div>
  );
}

function StatCard({ label, value, tone, icon }: { label: string; value: number; tone: "success" | "destructive" | "muted" | "amber"; icon: React.ReactNode }) {
  const toneClasses: Record<string, string> = {
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    destructive: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
    amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneClasses[tone])}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function ResultButton({ active, onClick, tone, children }: { active: boolean; onClick: () => void; tone: "pass" | "fail" | "na"; children: React.ReactNode }) {
  const tones = {
    pass: active
      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      : "border-border bg-card text-muted-foreground hover:border-emerald-400 hover:bg-emerald-50/50",
    fail: active
      ? "border-destructive bg-destructive/10 text-destructive"
      : "border-border bg-card text-muted-foreground hover:border-destructive/50 hover:bg-destructive/5",
    na: active
      ? "border-slate-400 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
      : "border-border bg-card text-muted-foreground hover:border-slate-400 hover:bg-slate-50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all",
        tones[tone],
      )}
    >
      {children}
    </button>
  );
}
