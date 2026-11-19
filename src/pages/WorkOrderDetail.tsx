import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Receipt, Truck, Wrench, UserCog, CheckCircle2, Gauge } from "lucide-react";
import { toast } from "sonner";
import { CreateReceiptModal } from "@/components/accounting/CreateReceiptModal";
import { StatusPipelineBar, type WoStatus } from "@/components/StatusPipelineBar";
import { WorkOrderPreview, formatWoNumber, getCleanRemarks } from "@/components/WorkOrderPreview";
import { WorkOrderJobLog } from "@/components/WorkOrderJobLog";
import { WorkOrderTasks } from "@/components/WorkOrderTasks";
import { WorkOrderPtwCard } from "@/components/WorkOrderPtwCard";
import { WorkOrderCloseApprovalCard } from "@/components/WorkOrderCloseApprovalCard";
import { WorkOrderRiskAssessmentCard } from "@/components/WorkOrderRiskAssessmentCard";
import { WorkOrderLotoCard } from "@/components/WorkOrderLotoCard";
import { WorkOrderMaterialRequestCard } from "@/components/WorkOrderMaterialRequestCard";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { useIndustry } from "@/hooks/useIndustry";
import { isLogistixwareAccount } from "@/services/customerService";
import { formatDistanceToNow } from "date-fns";
import { Layers, Building2, MapPin, ShieldCheck } from "lucide-react";

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { organisation: authOrg } = useAuth();
  const { isFleet } = useIndustry();
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
  const [fromBreakdown, setFromBreakdown] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

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
    const { data: dt } = await (supabase as any)
      .from("production_downtime_events")
      .select("id")
      .eq("work_order_id", id)
      .limit(1)
      .maybeSingle();
    setFromBreakdown(!!dt);
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

  const isVehicleWo = useMemo(() => {
    if (machine?.category === "Vehicle" || machine?.category === "Trailer") return true;
    try {
      if (wo?.remarks) {
        const parsed = JSON.parse(wo.remarks);
        if (parsed.created_via === "fleet_workshop_flow" || parsed.technician_name || parsed.service_odometer_km) return true;
      }
    } catch {}
    return false;
  }, [machine, wo]);

  const isFleetMode = useMemo(() => {
    return isFleet || authOrg?.industry_profile === "fleet_logistics" || isVehicleWo;
  }, [isFleet, authOrg, isVehicleWo]);

  const isDigitalJobCardMode = useMemo(() => {
    return isFleetMode;
  }, [isFleetMode]);

  const extractedComponent = useMemo(() => {
    const text = `${wo?.proposed_remedy ?? ""} ${wo?.description ?? ""}`;
    const match = text.match(/\[COMPONENT:\s*([^\]]+)\]/);
    return match ? match[1].trim() : null;
  }, [wo]);

  const extractedLocation = useMemo(() => {
    const text = `${wo?.proposed_remedy ?? ""} ${wo?.description ?? ""}`;
    const match = text.match(/\[LOCATION:\s*([^\]]+)\]/);
    return match ? match[1].trim() : null;
  }, [wo]);

  const hasPermitsOrLoto = useMemo(() => {
    if (!wo) return false;
    return !!(
      wo.permit_cold_work ||
      wo.permit_hot_work ||
      wo.permit_isolation ||
      wo.permit_confined_space ||
      wo.permit_jsea
    );
  }, [wo]);

  const parsedFleetMetadata = useMemo(() => {
    let metadata: any = null;
    if (wo?.remarks && wo.remarks.trim().startsWith("{")) {
      try {
        const obj = JSON.parse(wo.remarks);
        if (obj && typeof obj === "object") {
          metadata = { ...obj };
        }
      } catch {}
    }

    if (!metadata && wo?.description) {
      const odoMatch = wo.description.match(/\[Vehicle Service Odometer\]:\s*([0-9,.]+)\s*km/);
      const techMatch = wo.description.match(/\[Assigned Workshop Technician\]:\s*([^(]+)(?:\(([^)]+)\))?/);
      if (odoMatch || techMatch) {
        metadata = {
          technician_name: techMatch ? techMatch[1].trim() : null,
          technician_specialization: techMatch && techMatch[2] ? techMatch[2].trim() : null,
          service_odometer_km: odoMatch ? odoMatch[1].replace(/,/g, "") : null,
          service_category: wo.title,
          manager_remarks: getCleanRemarks(wo.remarks) || null,
        };
      }
    }

    if (metadata) {
      metadata.manager_remarks = getCleanRemarks(metadata.manager_remarks || wo?.remarks);
    }

    return metadata;
  }, [wo]);

  if (loading) return <PageLoader />;
  if (!wo) return <div className="p-8 text-center"><p className="text-muted-foreground">Work order not found.</p><Link to="/work-orders" className="text-primary hover:underline">Back</Link></div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/work-orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {isDigitalJobCardMode ? "Back to Job Cards" : "Back to work orders"}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {isDigitalJobCardMode && (
            <Button variant="outline" asChild className="border-blue-500/30 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30">
              <Link to={`/fleet/approvals?new=1&type=spare_parts&work_order_id=${wo.id}&vehicle=${encodeURIComponent(machine?.plate_number || machine?.name || "")}&title=${encodeURIComponent(`Parts Requisition: ${wo.title}`)}`}>
                <ShieldCheck className="mr-2 h-4 w-4 text-blue-600" /> Request Spares / Approval
              </Link>
            </Button>
          )}
          {(isVehicleWo || isDigitalJobCardMode) && (
            <Button variant="outline" asChild>
              <Link to={`/work-orders/${id}/print?view=jobcard`}><Printer className="mr-2 h-4 w-4" /> Print as Job Card</Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to={`/work-orders/${id}/print`}><Printer className="mr-2 h-4 w-4" /> Print / Download</Link>
          </Button>
          <Button variant="outline" onClick={() => setReceiptModalOpen(true)}>
            <Receipt className="mr-2 h-4 w-4 text-emerald-600" /> Payment Receipt
          </Button>
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide font-mono font-semibold text-primary">
          {isDigitalJobCardMode
            ? `Fleet Job Card JC-${wo.wo_year}-${String(wo.wo_number).padStart(4, "0")}`
            : formatWoNumber(wo.wo_year, wo.wo_number)}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{wo.title}</h1>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {machine && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold bg-muted text-foreground border border-border">
              {isFleet ? <Truck className="h-3 w-3 text-primary" /> : null}
              {machine.reg_number || machine.name || machine.code}
            </span>
          )}
          {isDigitalJobCardMode && extractedComponent && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary border border-primary/20">
              <Layers className="h-3 w-3" />
              {extractedComponent}
            </span>
          )}
          {isDigitalJobCardMode && extractedLocation && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-medium border ${
              extractedLocation === "onsite"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40"
                : extractedLocation === "offsite"
                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40"
                : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40"
            }`}>
              {extractedLocation === "onsite" ? <Building2 className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
              {extractedLocation === "onsite" ? "Onsite Workshop" : extractedLocation === "offsite" ? "Offsite Field Breakdown" : "Outsourced Dealership"}
            </span>
          )}
          <span className="text-muted-foreground">
            {wo.work_type} · created {formatDate(wo.created_at)} {wo.due_date && <>· due {formatDate(wo.due_date)}</>}
            {fromBreakdown && <> · <span className="text-amber-600">created from breakdown alert</span></>}
          </span>
        </div>
      </div>

      <StatusPipelineBar status={wo.status as WoStatus} onTransition={onTransition} />

      {parsedFleetMetadata && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/10 pb-2">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm text-foreground">
                Fleet Workshop Service Details
              </span>
              {parsedFleetMetadata.service_category && (
                <span className="text-xs rounded-full bg-primary/10 text-primary px-2.5 py-0.5 font-medium">
                  {parsedFleetMetadata.service_category}
                </span>
              )}
            </div>
            {parsedFleetMetadata.service_odometer_km != null && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <Gauge className="h-3.5 w-3.5 text-primary" />
                <span>Service Odometer: {Number(parsedFleetMetadata.service_odometer_km).toLocaleString()} km</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {parsedFleetMetadata.technician_name && (
              <div className="flex items-center gap-2">
                <UserCog className="h-4 w-4 text-primary/70 shrink-0" />
                <div>
                  <span className="text-muted-foreground">Assigned Technician: </span>
                  <span className="font-medium text-foreground">
                    {parsedFleetMetadata.technician_name}
                  </span>
                  {parsedFleetMetadata.technician_specialization && (
                    <span className="text-muted-foreground"> ({parsedFleetMetadata.technician_specialization})</span>
                  )}
                  {parsedFleetMetadata.technician_phone && (
                    <span className="text-muted-foreground"> · {parsedFleetMetadata.technician_phone}</span>
                  )}
                </div>
              </div>
            )}
            {parsedFleetMetadata.manager_remarks && (
              <div>
                <span className="text-muted-foreground">Workshop Notes: </span>
                <span className="text-foreground">{parsedFleetMetadata.manager_remarks}</span>
              </div>
            )}
          </div>

          {Array.isArray(parsedFleetMetadata.pm_tasks) && parsedFleetMetadata.pm_tasks.length > 0 && (
            <div className="pt-1">
              <span className="text-xs font-medium text-muted-foreground block mb-1.5">
                Service Checklist Scope ({parsedFleetMetadata.pm_tasks.length} tasks):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                {parsedFleetMetadata.pm_tasks.map((task: string, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{task}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(!isVehicleWo || hasPermitsOrLoto) && (
        <>
          <WorkOrderRiskAssessmentCard wo={wo} onSaved={load} />
          <WorkOrderLotoCard wo={wo} onSaved={load} />
          <WorkOrderPtwCard wo={wo} onSaved={load} />
        </>
      )}

      <WorkOrderMaterialRequestCard wo={wo} onSaved={load} />
      <WorkOrderCloseApprovalCard wo={wo} onSaved={load} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <WorkOrderPreview
            data={{
              ...wo,
              machine: machine ?? undefined,
              org: org ?? authOrg ?? undefined,
              logo_url: org?.logo_url ?? authOrg?.logo_url ?? undefined,
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

      {wo && (
        <CreateReceiptModal
          open={receiptModalOpen}
          onOpenChange={setReceiptModalOpen}
          defaultMachineId={wo.machine_id}
          defaultWorkOrderId={wo.id}
          defaultCategory="maintenance_service"
        />
      )}
    </div>
  );
}
