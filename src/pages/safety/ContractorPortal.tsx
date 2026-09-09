import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import {
  HardHat,
  ShieldCheck,
  ShieldAlert,
  ClipboardList,
  AlertTriangle,
  Users,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  Clock,
  Printer,
  Sparkles,
  Loader2,
  Plus,
  Flame,
  FileBarChart,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { formatWoNumber } from "@/components/WorkOrderPreview";
import { HsePerformanceReport } from "@/components/safety/HsePerformanceReport";

const TBT_TOPICS = [
  "Working at Heights & Fall Protection",
  "Lockout / Tagout (LOTO) Energy Isolation",
  "Hot Work & Fire Prevention Precautions",
  "Confined Space Entry & Atmospheric Testing",
  "Hand Tools, PPE & Pinch Point Safety",
  "Chemical Handling & COSHH / SDS Review",
  "Slips, Trips & Floor Housekeeping",
  "Excavation & Heavy Machinery Clearances",
];

const SUSPENSION_CATEGORIES = [
  { id: "unsafe_condition", label: "Unsafe Physical / Structural Condition" },
  { id: "missing_permit", label: "Missing or Expired Permit to Work (PTW)" },
  { id: "gas_alarm", label: "Gas Detection / Atmospheric Hazard" },
  { id: "loto_failure", label: "Energy Isolation / LOTO Not Verified" },
  { id: "equipment_defect", label: "Defective Contractor Tools or Plant Machine" },
  { id: "weather", label: "Adverse Weather / Lightning / Heavy Rain" },
  { id: "other", label: "Other Immediate Safety Violation" },
];

export default function ContractorPortal() {
  const { id: contractorIdParam } = useParams<{ id: string }>();
  const { profile, user, organisation } = useAuth();

  const [loading, setLoading] = useState(true);
  const [contractors, setContractors] = useState<any[]>([]);
  const [selectedContractorId, setSelectedContractorId] = useState<string>("");

  const [activeTab, setActiveTab] = useState<"toolbox" | "works" | "hse_report">("toolbox");

  // Data states
  const [toolboxTalks, setToolboxTalks] = useState<any[]>([]);
  const [contractorWorkers, setContractorWorkers] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [suspensions, setSuspensions] = useState<any[]>([]);

  // Dialogs
  const [tbtDialogOpen, setTbtDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [selectedWoForSuspension, setSelectedWoForSuspension] = useState<any>(null);

  const orgId = profile?.organisation_id || organisation?.id;

  const loadContractors = async () => {
    setLoading(true);
    let query = supabase.from("contractors").select("*").order("company_name");
    if (orgId) {
      query = query.eq("organisation_id", orgId);
    }
    const { data } = await query;
    const list = data || [];
    setContractors(list);

    const initialId = contractorIdParam || list[0]?.id || "";
    setSelectedContractorId(initialId);
    setLoading(false);
  };

  useEffect(() => {
    loadContractors();
  }, [orgId, contractorIdParam]);

  const currentContractor = useMemo(
    () => contractors.find((c) => c.id === selectedContractorId),
    [contractors, selectedContractorId]
  );

  const loadContractorData = async () => {
    if (!selectedContractorId) return;

    const [
      { data: tbt },
      { data: workers },
      woRes,
      { data: susp },
    ] = await Promise.all([
      supabase
        .from("contractor_toolbox_talks")
        .select("*")
        .eq("contractor_id", selectedContractorId)
        .order("created_at", { ascending: false }),
      supabase
        .from("contractor_workers")
        .select("*, inductees(id, full_name)")
        .eq("contractor_id", selectedContractorId)
        .eq("is_active", true)
        .order("full_name"),
      supabase
        .from("work_orders")
        .select("id, title, wo_number, wo_year, status, plant_area, is_suspended, suspension_reason, machine_id, machines(name), permit_hot_work, permit_confined_space, permit_isolation")
        .eq("contractor_id", selectedContractorId)
        .order("created_at", { ascending: false }),
      supabase
        .from("contractor_work_suspensions")
        .select("*")
        .eq("contractor_id", selectedContractorId)
        .order("suspended_at", { ascending: false }),
    ]);

    let woData = woRes?.data;
    if (woRes?.error) {
      if (woRes.error.message?.toLowerCase().includes("is_suspended") || woRes.error.message?.toLowerCase().includes("does not exist")) {
        const { data: fallbackWo } = await supabase
          .from("work_orders")
          .select("id, title, wo_number, wo_year, status, plant_area, machine_id, machines(name), permit_hot_work, permit_confined_space, permit_isolation")
          .eq("contractor_id", selectedContractorId)
          .order("created_at", { ascending: false });
        woData = fallbackWo;
      }
    }

    setToolboxTalks(tbt || []);
    setContractorWorkers(workers || []);
    setWorkOrders(woData || []);
    setSuspensions(susp || []);
  };

  useEffect(() => {
    if (selectedContractorId) {
      loadContractorData();
    }
  }, [selectedContractorId]);

  // Automated HSE Performance Metrics Calculation
  const hseMetrics = useMemo(() => {
    const totalTbt = toolboxTalks.length;
    const totalManHours = toolboxTalks.reduce(
      (acc, talk) => acc + Number(talk.man_hours || 0),
      0
    );
    const activeWorkers = contractorWorkers.length;
    const totalJobs = workOrders.length;
    const suspendedJobs = workOrders.filter((w) => w.is_suspended).length;
    const completedJobs = workOrders.filter((w) => w.status === "completed" || w.status === "closed").length;

    return {
      totalTbt,
      totalManHours,
      activeWorkers,
      totalJobs,
      suspendedJobs,
      completedJobs,
      incidentFreeRate: totalTbt > 0 ? "100%" : "—",
      complianceScore: Math.min(
        100,
        Math.max(70, Math.round(90 + (totalTbt > 0 ? 10 : 0) - suspendedJobs * 5))
      ),
    };
  }, [toolboxTalks, contractorWorkers, workOrders]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Contractor Switcher */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-[#00A651]/15 text-[#00A651] flex items-center justify-center font-black">
              <HardHat className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Contractor Safety Portal
              </h1>
              <p className="text-xs text-muted-foreground">
                Toolbox Talks, active jobs, work suspension notices &amp; automated HSE compliance.
              </p>
            </div>
          </div>
        </div>

        {/* Contractor Company Selector */}
        {contractors.length > 1 && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Contractor:</Label>
            <select
              value={selectedContractorId}
              onChange={(e) => setSelectedContractorId(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00A651]"
            >
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {contractors.length === 0 ? (
        <EmptyState
          icon={<HardHat className="h-6 w-6" />}
          title="No Contractor Companies Registered Yet"
          description="Register contractor companies in the Safety Contractor Registry to start recording their Toolbox Talks, tracking site works, and generating HSE reports."
          action={
            <Link to="/safety/contractors">
              <Button className="bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-bold gap-1.5 mt-2">
                Open Contractor Registry
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-border pb-1">
        <button
          onClick={() => setActiveTab("toolbox")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === "toolbox"
              ? "bg-[#00A651] text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Users className="h-4 w-4" /> Daily Toolbox Talks ({toolboxTalks.length})
        </button>

        <button
          onClick={() => setActiveTab("works")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === "works"
              ? "bg-[#00A651] text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <ClipboardList className="h-4 w-4" /> My Works &amp; Suspensions ({workOrders.length})
        </button>

        <button
          onClick={() => setActiveTab("hse_report")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === "hse_report"
              ? "bg-[#00A651] text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <FileBarChart className="h-4 w-4" /> Automated HSE Performance Report
        </button>
      </div>

      {/* TAB 1: TOOLBOX TALKS */}
      {activeTab === "toolbox" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">Shift Toolbox Talks (TBT)</h2>
              <p className="text-xs text-muted-foreground">
                Daily pre-start hazard briefings conducted by contractor supervisors before starting work.
              </p>
            </div>
            <Button
              onClick={() => setTbtDialogOpen(true)}
              className="bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-bold gap-1.5"
            >
              <Plus className="h-4 w-4" /> Conduct Toolbox Talk
            </Button>
          </div>

          {toolboxTalks.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No Toolbox Talks Recorded Today"
              description="Click 'Conduct Toolbox Talk' to brief your team, record attendees, and log shift safety man-hours."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {toolboxTalks.map((tbt) => (
                <div
                  key={tbt.id}
                  className="rounded-xl border border-border bg-card p-4 space-y-2.5 shadow-sm hover:border-[#00A651]/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-xs text-foreground line-clamp-1">
                      {tbt.topic}
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-[#00A651] border-emerald-500/20 font-bold">
                      {tbt.man_hours} hrs
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-[#00A651]" /> {formatDate(tbt.talk_date)}
                    </div>
                    <div>Supervisor: <span className="font-medium text-foreground">{tbt.supervisor_name}</span></div>
                    <div>Attendees: <span className="font-medium text-foreground">{tbt.attendee_count} crew members</span></div>
                  </div>

                  {tbt.controls_agreed && (
                    <div className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/50 line-clamp-2">
                      <strong>Controls:</strong> {tbt.controls_agreed}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY WORKS & SUSPENSIONS */}
      {activeTab === "works" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">Active Assigned Tasks &amp; Works</h2>
              <p className="text-xs text-muted-foreground">
                Work orders assigned to this contractor. Stop or suspend work immediately if hazards arise.
              </p>
            </div>
          </div>

          {workOrders.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="h-6 w-6" />}
              title="No Work Orders Assigned"
              description="Your supervisor or plant manager will assign work orders here."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-5 py-3 font-medium">Job / Work Order</th>
                    <th className="px-5 py-3 font-medium">Machine &amp; Location</th>
                    <th className="px-5 py-3 font-medium">Safety Permits Required</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrders.map((wo) => {
                    const isSuspended = wo.is_suspended;
                    return (
                      <tr key={wo.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-sm text-foreground">
                            {formatWoNumber(wo.wo_year, wo.wo_number)} — {wo.title}
                          </div>
                          {isSuspended && (
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-red-700 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-200">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              <span>Suspended: {wo.suspension_reason}</span>
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-xs text-muted-foreground">
                          <div className="font-semibold text-foreground">
                            {wo.machines?.name || "General Facility"}
                          </div>
                          <div>{wo.plant_area || "Site Floor"}</div>
                        </td>

                        <td className="px-5 py-3.5 text-xs">
                          <div className="flex flex-wrap gap-1">
                            {wo.permit_hot_work && (
                              <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300">
                                Hot Work
                              </Badge>
                            )}
                            {wo.permit_confined_space && (
                              <Badge variant="outline" className="text-[10px] text-purple-600 border-purple-300">
                                Confined Space
                              </Badge>
                            )}
                            {wo.permit_isolation && (
                              <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300">
                                LOTO
                              </Badge>
                            )}
                            {!wo.permit_hot_work && !wo.permit_confined_space && !wo.permit_isolation && (
                              <span className="text-muted-foreground text-[11px]">Standard Safety Controls</span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          {isSuspended ? (
                            <Badge className="bg-red-100 text-red-700 border-red-200 text-xs font-bold gap-1">
                              <PauseCircle className="h-3 w-3" /> SUSPENDED
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs font-bold gap-1">
                              <PlayCircle className="h-3 w-3" /> {wo.status?.replace(/_/g, " ")}
                            </Badge>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          {isSuspended ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResumeWork(wo)}
                              className="text-xs gap-1 border-emerald-600 text-[#00A651]"
                            >
                              <PlayCircle className="h-3.5 w-3.5" /> Request Resume
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedWoForSuspension(wo);
                                setSuspendDialogOpen(true);
                              }}
                              className="text-xs gap-1"
                            >
                              <PauseCircle className="h-3.5 w-3.5" /> Suspend Work
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AUTOMATED HSE PERFORMANCE REPORT */}
      {activeTab === "hse_report" && (
        <HsePerformanceReport
          contractorId={selectedContractorId}
          contractorName={currentContractor?.company_name}
          onRefreshParent={loadContractorData}
        />
      )}
        </>
      )}

      {/* Conduct Toolbox Talk Dialog */}
      <ConductToolboxDialog
        open={tbtDialogOpen}
        onOpenChange={setTbtDialogOpen}
        contractor={currentContractor}
        workers={contractorWorkers}
        workOrders={workOrders}
        onSaved={loadContractorData}
      />

      {/* Suspend Work Dialog */}
      <SuspendWorkDialog
        open={suspendDialogOpen}
        onOpenChange={setSuspendDialogOpen}
        workOrder={selectedWoForSuspension}
        contractor={currentContractor}
        onSuspended={loadContractorData}
      />
    </div>
  );

  async function handleResumeWork(wo: any) {
    const { error } = await supabase
      .from("work_orders")
      .update({ is_suspended: false, suspension_reason: null })
      .eq("id", wo.id);
    if (error) return toast.error(error.message);

    // Update active suspension records
    const { error: suspErr } = await supabase
      .from("contractor_work_suspensions")
      .update({
        status: "resumed",
        resumed_at: new Date().toISOString(),
        resumed_by_name: user?.email || "Contractor Lead",
      })
      .eq("work_order_id", wo.id)
      .eq("status", "suspended");

    if (suspErr && !suspErr.message?.toLowerCase().includes("schema cache")) {
      console.warn("contractor_work_suspensions update error:", suspErr.message);
    }

    toast.success("Work resumed. Safety Supervisor notified.");
    loadContractorData();
  }
}

function ConductToolboxDialog({ open, onOpenChange, contractor, workers, workOrders, onSaved }: any) {
  const [topic, setTopic] = useState(TBT_TOPICS[0]);
  const [supervisorName, setSupervisorName] = useState(contractor?.contact_name || "");
  const [location, setLocation] = useState("");
  const [selectedWoId, setSelectedWoId] = useState("");
  const [hazards, setHazards] = useState("");
  const [controls, setControls] = useState("");
  const [hours, setHours] = useState(2);
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (workers?.length) {
      setSelectedWorkers(workers.map((w: any) => w.id));
    }
  }, [workers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisorName.trim()) return toast.error("Supervisor name required");
    setSubmitting(true);

    const attendeeCount = selectedWorkers.length || 1;
    const totalManHours = Number(hours || 1) * attendeeCount;

    const payload = {
      organisation_id: contractor?.organisation_id,
      contractor_id: contractor?.id,
      work_order_id: selectedWoId || null,
      talk_date: new Date().toISOString().slice(0, 10),
      topic,
      supervisor_name: supervisorName,
      location: location || "Site Plant",
      attendee_count: attendeeCount,
      man_hours: totalManHours,
      hazards_discussed: hazards || "General shift hazards reviewed",
      controls_agreed: controls || "PPE and safe work practices confirmed",
      attendees: selectedWorkers.map((id) => {
        const w = workers.find((item: any) => item.id === id);
        return { id, name: w?.full_name || "Worker" };
      }),
    };

    const { error } = await supabase.from("contractor_toolbox_talks").insert(payload);
    setSubmitting(false);

    if (error) return toast.error(error.message);
    toast.success("Toolbox Talk recorded! Safe man-hours added to HSE report.");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-[#00A651]" />
            Conduct Shift Toolbox Talk (TBT)
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 py-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Safety Topic *</Label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-xs font-medium"
            >
              {TBT_TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Supervisor / Leader Name *</Label>
              <Input
                required
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Estimated Shift Hours</Label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Work Order (Optional)</Label>
              <select
                value={selectedWoId}
                onChange={(e) => setSelectedWoId(e.target.value)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-xs"
              >
                <option value="">No specific work order</option>
                {workOrders?.map((wo: any) => (
                  <option key={wo.id} value={wo.id}>
                    {formatWoNumber(wo.wo_year, wo.wo_number)} — {wo.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Location / Cell</Label>
              <Input
                placeholder="e.g. Tank Farm, Line 1"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Workers Attending Checklist */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Attending Crew Members ({selectedWorkers.length})</span>
            </div>
            <div className="max-h-32 overflow-y-auto rounded-lg border border-border p-2 space-y-1 bg-muted/20">
              {workers?.map((w: any) => (
                <label key={w.id} className="flex items-center gap-2 text-xs cursor-pointer hover:text-foreground">
                  <input
                    type="checkbox"
                    checked={selectedWorkers.includes(w.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedWorkers([...selectedWorkers, w.id]);
                      } else {
                        setSelectedWorkers(selectedWorkers.filter((id) => id !== w.id));
                      }
                    }}
                    className="rounded border-input text-[#00A651] focus:ring-[#00A651]"
                  />
                  <span>{w.full_name} ({w.role_title || "Worker"})</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Specific Hazards Identified</Label>
            <Input
              placeholder="e.g. Slippery surface near drainage, overhead crane moving"
              value={hazards}
              onChange={(e) => setHazards(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Controls Agreed with Team</Label>
            <Input
              placeholder="e.g. Warning signs erected, spotter assigned, harness checked"
              value={controls}
              onChange={(e) => setControls(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-bold gap-1.5"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Save &amp; Sign Toolbox Talk
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SuspendWorkDialog({ open, onOpenChange, workOrder, contractor, onSuspended }: any) {
  const [category, setCategory] = useState("unsafe_condition");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return toast.error("Please explain why work is being stopped");
    setSubmitting(true);

    try {
      // 1. Update work order
      const { error: woErr } = await supabase
        .from("work_orders")
        .update({
          is_suspended: true,
          suspension_reason: reason.trim(),
        })
        .eq("id", workOrder?.id);

      if (woErr) throw woErr;

      // 2. Insert suspension log
      const { error: suspErr } = await supabase
        .from("contractor_work_suspensions")
        .insert({
          organisation_id: contractor?.organisation_id,
          work_order_id: workOrder?.id,
          contractor_id: contractor?.id,
          suspended_by_type: "contractor",
          suspended_by_name: contractor?.contact_name || "Contractor Supervisor",
          suspension_reason: reason.trim(),
          category,
          status: "suspended",
        });

      if (suspErr) {
        if (suspErr.message?.toLowerCase().includes("schema cache") || (suspErr as any).code === "PGRST205") {
          toast.warning("Work order marked suspended on site. Run the latest database migration to enable full suspension logs.");
          onOpenChange(false);
          onSuspended();
          return;
        }
        throw suspErr;
      }

      toast.success("Work stopped. Safety Supervisor alerted of suspension.");
      onOpenChange(false);
      onSuspended();
    } catch (err: any) {
      toast.error(err.message || "Failed to suspend work");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-600">
            <PauseCircle className="h-5 w-5" />
            Stop / Suspend Work Order
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSuspend} className="space-y-3.5 py-2">
          <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs">
            <div className="font-bold text-foreground">
              {formatWoNumber(workOrder?.wo_year, workOrder?.wo_number)} — {workOrder?.title}
            </div>
            <div className="text-muted-foreground mt-0.5">
              Exercising Stop Work Authority protects human life. All suspensions are logged for supervisor review.
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Suspension Category *</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-xs font-medium"
            >
              {SUSPENSION_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Exact Safety Reason / What is Unsafe *</Label>
            <Textarea
              required
              rows={3}
              placeholder="Explain the hazard or condition requiring work to stop immediately..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              variant="destructive"
              className="text-xs font-bold gap-1.5"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PauseCircle className="h-3.5 w-3.5" />}
              Confirm Stop Work
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
