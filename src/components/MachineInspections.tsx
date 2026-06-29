import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ClipboardCheck, Play, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { StartInspectionDialog } from "@/components/StartInspectionDialog";

interface Props {
  machineId: string;
  machineCategory?: string | null;
}

export function MachineInspections({ machineId, machineCategory }: Props) {
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startOpen, setStartOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("checklist_executions")
      .select("id, status, performed_at, performed_by_name, template_version, template_id, checklist_templates(name)")
      .eq("machine_id", machineId)
      .order("performed_at", { ascending: false })
      .limit(20);
    setExecutions(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [machineId]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Inspections</h3>
          <p className="text-xs text-muted-foreground">Formal inspections run against an approved template.</p>
        </div>
        <Button size="sm" onClick={() => setStartOpen(true)}>
          <Play className="mr-1 h-4 w-4" /> Start inspection
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
      ) : executions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
          <ClipboardCheck className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No inspections yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {executions.map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{e.checklist_templates?.name ?? "Inspection"}</p>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px]">v{e.template_version}</span>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium capitalize ${e.status === "completed" ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>
                    {e.status === "completed" ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Completed</span> : e.status.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(e.performed_at)} · {e.performed_by_name ?? "—"}</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to={`/inspections/${e.id}`}>{e.status === "completed" ? "View" : "Continue"}</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}

      <StartInspectionDialog open={startOpen} onOpenChange={(v) => { setStartOpen(v); if (!v) load(); }} machineId={machineId} machineCategory={machineCategory} />
    </div>
  );
}
