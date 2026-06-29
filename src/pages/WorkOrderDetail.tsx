import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { toast } from "sonner";
import { StatusPipelineBar, type WoStatus } from "@/components/StatusPipelineBar";
import { WorkOrderPreview, formatWoNumber } from "@/components/WorkOrderPreview";
import { WorkOrderJobLog } from "@/components/WorkOrderJobLog";
import { WorkOrderTasks } from "@/components/WorkOrderTasks";
import { formatDate } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [wo, setWo] = useState<any>(null);
  const [machine, setMachine] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [assignee, setAssignee] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [createdBy, setCreatedBy] = useState<any>(null);
  const [checklist, setChecklist] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: w } = await supabase.from("work_orders").select("*").eq("id", id).maybeSingle();
    if (!w) { setLoading(false); return; }
    setWo(w);
    const [{ data: m }, { data: o }, { data: a }, { data: v }, { data: cb }, { data: ct }, { data: h }] = await Promise.all([
      supabase.from("machines").select("*").eq("id", w.machine_id).maybeSingle(),
      supabase.from("organisations").select("*").eq("id", w.organisation_id).maybeSingle(),
      w.assignee_id ? supabase.from("profiles").select("id,full_name").eq("id", w.assignee_id).maybeSingle() : Promise.resolve({ data: null }),
      w.vendor_id ? supabase.from("vendors").select("*").eq("id", w.vendor_id).maybeSingle() : Promise.resolve({ data: null }),
      w.created_by ? supabase.from("profiles").select("id,full_name").eq("id", w.created_by).maybeSingle() : Promise.resolve({ data: null }),
      w.checklist_template_id ? supabase.from("checklist_templates").select("id,name").eq("id", w.checklist_template_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("wo_status_history").select("*").eq("work_order_id", id).order("changed_at", { ascending: true }),
    ]);
    setMachine(m); setOrg(o); setAssignee(a); setVendor(v); setCreatedBy(cb); setChecklist(ct);
    setHistory(h ?? []);
    const userIds = Array.from(new Set((h ?? []).map((r: any) => r.changed_by).filter(Boolean)));
    if (userIds.length) {
      const { data: users } = await supabase.from("profiles").select("id,full_name").in("id", userIds);
      const map: Record<string, string> = {};
      (users ?? []).forEach((u: any) => { map[u.id] = u.full_name ?? "—"; });
      setUserMap(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const onTransition = async (to: WoStatus, note?: string) => {
    const { error } = await supabase.rpc("transition_wo", { _wo_id: id!, _to: to, _note: note ?? null });
    if (error) { toast.error(error.message); return; }
    // Auto-stamp start/finish times if not already set
    const patch: any = {};
    if (to === "in_progress" && !wo?.started_at) patch.started_at = new Date().toISOString();
    if (to === "done" && !wo?.finished_at) patch.finished_at = new Date().toISOString();
    if (Object.keys(patch).length > 0) {
      await supabase.from("work_orders").update(patch).eq("id", id!);
    }
    toast.success(`Moved to ${to.replace("_", " ")}`);
    await load();
  };

  if (loading) return <PageLoader />;
  if (!wo) return <div className="p-8 text-center"><p className="text-muted-foreground">Work order not found.</p><Link to="/work-orders" className="text-primary hover:underline">Back</Link></div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <Link to="/work-orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to work orders
        </Link>
        <Button variant="outline" asChild>
          <Link to={`/work-orders/${id}/print`}><Printer className="mr-2 h-4 w-4" /> Print / Download</Link>
        </Button>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{formatWoNumber(wo.wo_year, wo.wo_number)}</div>
        <h1 className="text-2xl font-semibold tracking-tight">{wo.title}</h1>
        <div className="mt-1 text-xs text-muted-foreground">
          {wo.work_type} · created {formatDate(wo.created_at)} {wo.due_date && <>· due {formatDate(wo.due_date)}</>}
        </div>
      </div>

      <StatusPipelineBar status={wo.status as WoStatus} onTransition={onTransition} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <WorkOrderPreview
            data={{
              ...wo,
              machine: machine ?? undefined,
              org: org ?? undefined,
              assignee: assignee ?? undefined,
              vendor: vendor ?? undefined,
              createdBy: createdBy ?? undefined,
              checklist: checklist ?? undefined,
            }}
            compact
          />

          <WorkOrderTasks workOrderId={wo.id} organisationId={wo.organisation_id} workType={wo.work_type} />

          <WorkOrderJobLog wo={wo} onSaved={load} />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 text-sm font-medium">Status timeline</div>
          <ol className="relative space-y-3 border-l border-border pl-4">
            {history.map((h) => (
              <li key={h.id} className="relative">
                <div className="absolute -left-[21px] mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                <div className="text-sm font-medium">
                  {h.from_status ? <>{h.from_status.replace("_", " ")} → </> : null}
                  {h.to_status.replace("_", " ")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {(h.changed_by && userMap[h.changed_by]) ?? "—"} · {formatDistanceToNow(new Date(h.changed_at), { addSuffix: true })}
                </div>
                {h.note && <div className="mt-1 rounded-md bg-muted p-2 text-xs">{h.note}</div>}
              </li>
            ))}
            {history.length === 0 && <li className="text-xs text-muted-foreground">No transitions yet.</li>}
          </ol>
        </div>
      </div>
    </div>
  );
}
