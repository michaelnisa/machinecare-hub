import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, ListChecks, Wrench } from "lucide-react";
import { toast } from "sonner";

interface Props {
  workOrderId: string;
  organisationId: string;
  workType?: string | null;
  canWrite?: boolean;
}

interface Task {
  id: string;
  label: string;
  source: string;
  is_done: boolean;
  position: number;
  notes: string | null;
  done_at: string | null;
}

export function WorkOrderTasks({ workOrderId, organisationId, workType, canWrite = true }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("work_order_tasks")
      .select("id,label,source,is_done,position,notes,done_at")
      .eq("work_order_id", workOrderId)
      .order("position");
    if (error) toast.error(error.message);
    setTasks((data ?? []) as Task[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [workOrderId]);

  const populate = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("populate_wo_tasks_from_pm", { _wo_id: workOrderId });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Added ${data ?? 0} required service task${data === 1 ? "" : "s"}`);
    load();
  };

  const toggle = async (t: Task) => {
    const next = !t.is_done;
    setTasks((arr) => arr.map((x) => (x.id === t.id ? { ...x, is_done: next } : x)));
    const { error } = await supabase
      .from("work_order_tasks")
      .update({
        is_done: next,
        done_at: next ? new Date().toISOString() : null,
        done_by: next ? (await supabase.auth.getUser()).data.user?.id ?? null : null,
      })
      .eq("id", t.id);
    if (error) { toast.error(error.message); load(); }
  };

  const updateNotes = async (id: string, notes: string) => {
    await supabase.from("work_order_tasks").update({ notes: notes || null }).eq("id", id);
  };

  const add = async () => {
    const label = newLabel.trim();
    if (!label) return;
    const position = (tasks[tasks.length - 1]?.position ?? 0) + 1;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("work_order_tasks").insert({
      work_order_id: workOrderId,
      organisation_id: organisationId,
      label,
      source: "manual",
      position,
      created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    setNewLabel("");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("work_order_tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setTasks((arr) => arr.filter((x) => x.id !== id));
  };

  const isService = workType === "preventive" || workType === "inspection";
  const doneCount = tasks.filter((t) => t.is_done).length;
  const total = tasks.length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium flex items-center gap-2">
            <ListChecks className="h-4 w-4" /> Required service tasks
          </h3>
          <p className="text-xs text-muted-foreground">
            {isService
              ? "Pulled from this machine's PM schedule and parts. Technician ticks each off."
              : "Tasks for this job. Technician ticks each off as they go."}
          </p>
        </div>
        {canWrite && tasks.length === 0 && (
          <Button size="sm" variant="outline" onClick={populate} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            <Wrench className="mr-1 h-3 w-3" /> Pull from PM
          </Button>
        )}
      </div>

      {total > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{doneCount} of {total} done</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center text-xs text-muted-foreground">Loading…</div>
      ) : tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
          No tasks yet. {isService && canWrite && "Click \"Pull from PM\" to load required services for this machine."}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((t) => (
            <li key={t.id} className="rounded-md border border-border bg-background p-2.5">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={t.is_done}
                  onChange={() => canWrite && toggle(t)}
                  disabled={!canWrite}
                  className="mt-1 h-4 w-4 rounded border-input"
                />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm ${t.is_done ? "line-through text-muted-foreground" : ""}`}>
                    {t.label}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5">{t.source.replace("_", " ")}</span>
                    {t.is_done && t.done_at && <span>done {new Date(t.done_at).toLocaleString()}</span>}
                  </div>
                  {canWrite && (
                    <Input
                      defaultValue={t.notes ?? ""}
                      onBlur={(e) => updateNotes(t.id, e.target.value)}
                      placeholder="Notes (optional)"
                      className="mt-2 h-7 text-xs"
                      maxLength={500}
                    />
                  )}
                </div>
                {canWrite && (
                  <Button size="icon" variant="ghost" onClick={() => remove(t.id)} title="Remove">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <div className="flex gap-2 pt-1">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder="Add a task…"
            className="h-9 text-sm"
            maxLength={200}
          />
          <Button size="sm" onClick={add} disabled={!newLabel.trim()}>
            <Plus className="mr-1 h-3 w-3" /> Add
          </Button>
        </div>
      )}
    </div>
  );
}
