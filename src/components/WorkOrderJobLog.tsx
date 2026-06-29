import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

interface Props {
  wo: any;
  onSaved: () => void;
}

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string) {
  if (!v) return null;
  return new Date(v).toISOString();
}

export function WorkOrderJobLog({ wo, onSaved }: Props) {
  const [startedAt, setStartedAt] = useState(toLocalInput(wo.started_at));
  const [finishedAt, setFinishedAt] = useState(toLocalInput(wo.finished_at));
  const [timeReceived, setTimeReceived] = useState(toLocalInput(wo.time_received));
  const [laborCost, setLaborCost] = useState<string>(wo.labor_cost?.toString() ?? "");
  const [currency, setCurrency] = useState<string>(wo.cost_currency ?? "TZS");
  const [remarks, setRemarks] = useState<string>(wo.remarks ?? "");
  const [techComment, setTechComment] = useState<string>(wo.technician_comment ?? "");
  const [actualWorkDone, setActualWorkDone] = useState<string>(wo.actual_work_done ?? "");
  const [inspectedBy, setInspectedBy] = useState<string>(wo.inspected_by_name ?? "");
  const [inspectedAt, setInspectedAt] = useState<string>(toLocalInput(wo.inspected_at));
  const [handedBy, setHandedBy] = useState<string>(wo.handed_over_by_name ?? "");
  const [handedAt, setHandedAt] = useState<string>(toLocalInput(wo.handed_over_at));
  const [acceptedBy, setAcceptedBy] = useState<string>(wo.accepted_by_name ?? "");
  const [acceptedAt, setAcceptedAt] = useState<string>(toLocalInput(wo.accepted_at));
  const [saving, setSaving] = useState(false);

  const setNow = (field: "started_at" | "finished_at" | "time_received") => {
    const now = toLocalInput(new Date().toISOString());
    if (field === "started_at") setStartedAt(now);
    else if (field === "finished_at") setFinishedAt(now);
    else setTimeReceived(now);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("work_orders")
      .update({
        started_at: fromLocalInput(startedAt),
        finished_at: fromLocalInput(finishedAt),
        time_received: fromLocalInput(timeReceived),
        labor_cost: laborCost === "" ? null : Number(laborCost),
        cost_currency: laborCost === "" ? null : currency,
        remarks: remarks || null,
        technician_comment: techComment || null,
        actual_work_done: actualWorkDone || null,
        inspected_by_name: inspectedBy || null,
        inspected_at: fromLocalInput(inspectedAt),
        handed_over_by_name: handedBy || null,
        handed_over_at: fromLocalInput(handedAt),
        accepted_by_name: acceptedBy || null,
        accepted_at: fromLocalInput(acceptedAt),
      })
      .eq("id", wo.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Job log saved");
    onSaved();
  };

  const duration = (() => {
    if (!startedAt || !finishedAt) return null;
    const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
    if (ms <= 0) return null;
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return `${h}h ${m}m`;
  })();

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Job log</h3>
          <p className="text-xs text-muted-foreground">Start/finish times, cost, remarks & technician comment.</p>
        </div>
        {duration && <span className="rounded-md bg-muted px-2 py-0.5 text-xs">Duration: {duration}</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Time received</Label>
            <button type="button" onClick={() => setNow("time_received")} className="text-[11px] text-primary hover:underline">Now</button>
          </div>
          <Input type="datetime-local" value={timeReceived} onChange={(e) => setTimeReceived(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Started at</Label>
            <button type="button" onClick={() => setNow("started_at")} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
              <Play className="h-3 w-3" /> Now
            </button>
          </div>
          <Input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Finished at</Label>
            <button type="button" onClick={() => setNow("finished_at")} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
              <Square className="h-3 w-3" /> Now
            </button>
          </div>
          <Input type="datetime-local" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Labour / in-house cost</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={laborCost}
            onChange={(e) => setLaborCost(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {["TZS", "USD", "EUR", "KES", "UGX"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Manager remarks</Label>
        <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Internal notes, instructions, observations…" maxLength={2000} />
      </div>

      <div className="space-y-1.5">
        <Label>Actual work done</Label>
        <Textarea rows={4} value={actualWorkDone} onChange={(e) => setActualWorkDone(e.target.value)} placeholder="Diagnosis, work performed, parts replaced, measurements…" maxLength={4000} />
      </div>

      <div className="space-y-1.5">
        <Label>Technician comment <span className="text-xs text-muted-foreground">(after finishing)</span></Label>
        <Textarea rows={3} value={techComment} onChange={(e) => setTechComment(e.target.value)} placeholder="Recommendations, follow-ups, parts ordered…" maxLength={2000} />
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sign-offs</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Job inspected by</Label>
            <Input value={inspectedBy} onChange={(e) => setInspectedBy(e.target.value)} placeholder="Inspector name" />
          </div>
          <div className="space-y-1.5">
            <Label>Inspected at</Label>
            <Input type="datetime-local" value={inspectedAt} onChange={(e) => setInspectedAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Handed over by</Label>
            <Input value={handedBy} onChange={(e) => setHandedBy(e.target.value)} placeholder="Technician name" />
          </div>
          <div className="space-y-1.5">
            <Label>Handed over at</Label>
            <Input type="datetime-local" value={handedAt} onChange={(e) => setHandedAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Accepted by</Label>
            <Input value={acceptedBy} onChange={(e) => setAcceptedBy(e.target.value)} placeholder="Operations / Manager name" />
          </div>
          <div className="space-y-1.5">
            <Label>Accepted at</Label>
            <Input type="datetime-local" value={acceptedAt} onChange={(e) => setAcceptedAt(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground">
          {wo.updated_at && <>Last updated {formatDate(wo.updated_at)}</>}
        </div>
        <Button onClick={save} disabled={saving} size="sm">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save job log
        </Button>
      </div>
    </div>
  );
}
