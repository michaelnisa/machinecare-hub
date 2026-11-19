import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import {
  ClipboardCheck,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
  QrCode,
  Wrench,
  AlertOctagon,
  Search,
  Filter,
  Layers,
  TrendingUp,
  FileText,
  Camera,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Zap,
  Phone,
  MapPin,
  Clock,
  ArrowRight,
  Check,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { MachineQrDialog } from "@/components/MachineQrDialog";
import { DriverComplaintModal } from "@/components/fleet/DriverComplaintModal";
import { SmartPartsFinderModal } from "@/components/fleet/SmartPartsFinderModal";
import {
  getDriverComplaints,
  updateComplaintFindings,
  convertComplaintToWorkOrder,
  detectRecurringFailures,
  SUBSYSTEM_CATEGORIES,
  type DriverComplaintRecord,
  type RecurringFailureAlert,
  type SubsystemCategory,
} from "@/services/complaintsService";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { FLEET_AND_ASSET_CATEGORIES } from "@/lib/fleet-metadata";

type Machine = { id: string; name: string; plate_number: string | null; organisation_id: string; current_odometer_km?: number | null; category?: string };
type Driver = { id: string; full_name: string };
type Execution = {
  id: string;
  machine_id: string;
  driver_id: string | null;
  performed_by_name: string | null;
  performed_at: string;
  overall_result: string | null;
  defect_notes?: string;
};

const RESULT_CLASS: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  attention: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
};

export default function Inspections() {
  const { profile, organisation, user } = useAuth();
  const { canWrite } = useUserRole();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"walkarounds" | "complaints" | "recurring">("complaints");
  const [loading, setLoading] = useState(true);

  // Walkaround executions state
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [resultFilter, setResultFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [newOpen, setNewOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrMachine, setQrMachine] = useState<Machine | null>(null);

  // Slide 10: Complaints & Findings state
  const [complaints, setComplaints] = useState<DriverComplaintRecord[]>([]);
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [complaintTypeFilter, setComplaintTypeFilter] = useState("all");
  const [complaintSubsystemFilter, setComplaintSubsystemFilter] = useState("all");
  const [complaintStatusFilter, setComplaintStatusFilter] = useState("all");
  const [complaintVehicleFilter, setComplaintVehicleFilter] = useState("all");
  const [complaintSearch, setComplaintSearch] = useState("");

  // Slide 11: Recurring Failures state
  const [recurringAlerts, setRecurringAlerts] = useState<RecurringFailureAlert[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);

  // Slide 14: Smart Parts Finder state
  const [smartPartsOpen, setSmartPartsOpen] = useState(false);
  const [smartPartsModel, setSmartPartsModel] = useState<string>("ALL");

  // Workshop Findings Dialog state
  const [findingsModalOpen, setFindingsModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<DriverComplaintRecord | null>(null);
  const [findingsResult, setFindingsResult] = useState("");
  const [defectAnalysis, setDefectAnalysis] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [inspectorName, setInspectorName] = useState("");
  const [savingFindings, setSavingFindings] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const orgId = profile?.organisation_id || organisation?.id || "";

  const load = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      const { data: templates, error: tErr } = await supabase
        .from("checklist_templates")
        .select("id")
        .eq("is_fleet_pre_start", true);
      if (tErr) console.warn("Checklist templates query:", tErr.message);
      let templateIds = (templates ?? []).map((tmpl) => tmpl.id);

      const [{ data: m }, { data: d }, { data: woData }] = await Promise.all([
        supabase.from("machines").select("id, name, plate_number, organisation_id, current_odometer_km, category").in("category", FLEET_AND_ASSET_CATEGORIES as any),
        supabase.from("drivers").select("id, full_name").eq("status", "active"),
        supabase.from("work_orders").select("id, title, description, proposed_remedy, machine_id, created_at, status, machine:machines(id, name, plate_number)").eq("organisation_id", orgId).order("created_at", { ascending: false }).limit(200),
      ]);

      const vehicleList = (m ?? []) as Machine[];
      setMachines(vehicleList);
      setDrivers((d ?? []) as Driver[]);
      setWorkOrders(woData ?? []);

      // If no fleet pre-start template exists in this organisation, auto-seed one
      if (templateIds.length === 0 && orgId) {
        try {
          const { data: createdTmpl } = await supabase.from("checklist_templates").insert({
            organisation_id: orgId,
            name: "Daily Vehicle Pre-Trip Walkaround",
            description: "Standard daily walkaround inspection for fleet vehicles and trucks.",
            is_fleet_pre_start: true,
            status: "approved",
            version: 1,
          }).select("id").single();

          if (createdTmpl?.id) {
            templateIds = [createdTmpl.id];
            await supabase.from("checklist_template_items").insert([
              { template_id: createdTmpl.id, text: "Foot Brake & Parking Handbrake Operation", sort_order: 1, severity: "critical", item_type: "tri_state" },
              { template_id: createdTmpl.id, text: "Tyres Tread Depth, Inflation & Wheel Lug Nuts", sort_order: 2, severity: "critical", item_type: "tri_state" },
              { template_id: createdTmpl.id, text: "Engine Oil, Coolant & Brake Fluid Levels", sort_order: 3, severity: "major", item_type: "tri_state" },
              { template_id: createdTmpl.id, text: "Headlights, Tail Lights, Brake Lights & Indicators", sort_order: 4, severity: "major", item_type: "tri_state" },
              { template_id: createdTmpl.id, text: "Mirrors, Windscreen, Wipers & Washer Fluid", sort_order: 5, severity: "minor", item_type: "tri_state" },
              { template_id: createdTmpl.id, text: "Seatbelt, Fire Extinguisher & Warning Triangles", sort_order: 6, severity: "critical", item_type: "tri_state" },
            ]);
          }
        } catch (e) {
          console.warn("Could not auto-create standard fleet checklist template:", e);
        }
      }

      const machineIds = vehicleList.map((v) => v.id);

      // Fetch executions
      let query = supabase
        .from("checklist_executions")
        .select("id, machine_id, driver_id, performed_by_name, performed_at, overall_result")
        .order("performed_at", { ascending: false })
        .limit(200);

      if (templateIds.length > 0 && machineIds.length > 0) {
        query = query.or(`template_id.in.(${templateIds.join(",")}),machine_id.in.(${machineIds.join(",")})`);
      } else if (templateIds.length > 0) {
        query = query.in("template_id", templateIds);
      } else if (machineIds.length > 0) {
        query = query.in("machine_id", machineIds);
      }

      const { data: ex } = await query;
      setExecutions((ex ?? []) as Execution[]);

      // Fetch driver complaints (Slide 10)
      if (orgId) {
        const complaintsData = await getDriverComplaints(orgId);
        setComplaints(complaintsData);

        // Calculate recurring failures across all 11 subsystems (Slide 11)
        const alerts = detectRecurringFailures(complaintsData, woData ?? []);
        setRecurringAlerts(alerts);
      }
    } catch (err: any) {
      console.error("Error loading inspections and complaints:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [profile, orgId]);

  const machineMap = useMemo(() => new Map(machines.map((m) => [m.id, m])), [machines]);
  const driverMap = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);

  const vehicleLabel = (machineId: string) => {
    const m = machineMap.get(machineId);
    if (!m) return "Vehicle";
    return m.plate_number ? `${m.name} (${m.plate_number})` : m.name;
  };

  // Filtered Walkarounds
  const filteredExecutions = useMemo(() => {
    return executions.filter((e) => {
      if (resultFilter !== "all" && (e.overall_result ?? "ok") !== resultFilter) return false;
      if (vehicleFilter !== "all" && e.machine_id !== vehicleFilter) return false;
      if (driverFilter !== "all" && e.driver_id !== driverFilter) return false;
      return true;
    });
  }, [executions, resultFilter, vehicleFilter, driverFilter]);

  // Filtered Complaints (Slide 10)
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (complaintTypeFilter !== "all" && c.complaint_type !== complaintTypeFilter) return false;
      if (complaintSubsystemFilter !== "all" && c.subsystem !== complaintSubsystemFilter) return false;
      if (complaintStatusFilter !== "all" && c.status !== complaintStatusFilter) return false;
      if (complaintVehicleFilter !== "all" && c.machine_id !== complaintVehicleFilter) return false;
      if (complaintSearch.trim() !== "") {
        const q = complaintSearch.toLowerCase().trim();
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesDesc = c.description.toLowerCase().includes(q);
        const matchesPlate = c.vehicle_plate.toLowerCase().includes(q);
        const matchesReporter = c.reporter_name.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesPlate && !matchesReporter) return false;
      }
      return true;
    });
  }, [complaints, complaintTypeFilter, complaintSubsystemFilter, complaintStatusFilter, complaintVehicleFilter, complaintSearch]);

  // Subsystem failure distribution for Slide 11 Pareto analytics
  const subsystemStats = useMemo(() => {
    const stats: Record<SubsystemCategory, number> = {
      "Engine System": 0,
      "Fuel System": 0,
      "Brake System": 0,
      "Suspension System": 0,
      "Steering System": 0,
      "Transmission System": 0,
      "Electrical System": 0,
      "Electronics System": 0,
      "Air System": 0,
      "Body Works": 0,
      "Accident Repairs": 0,
    };

    complaints.forEach((c) => {
      if (stats[c.subsystem] !== undefined) {
        stats[c.subsystem]++;
      }
    });

    workOrders.forEach((wo) => {
      const match = `${wo.proposed_remedy || ""} ${wo.description || ""}`.match(/\[COMPONENT:\s*([^\]]+)\]/);
      if (match && stats[match[1].trim() as SubsystemCategory] !== undefined) {
        stats[match[1].trim() as SubsystemCategory]++;
      }
    });

    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);

    return { counts: stats, total, sorted };
  }, [complaints, workOrders]);

  // Open findings editor
  const handleOpenFindings = (complaint: DriverComplaintRecord) => {
    setSelectedComplaint(complaint);
    setFindingsResult(complaint.findings?.inspection_result || "");
    setDefectAnalysis(complaint.findings?.defect_analysis || "");
    setRecommendations(complaint.findings?.recommendations || "");
    setInspectorName(complaint.findings?.inspector_name || profile?.full_name || "");
    setFindingsModalOpen(true);
  };

  const handleSaveFindings = async () => {
    if (!selectedComplaint) return;
    setSavingFindings(true);
    try {
      await updateComplaintFindings(orgId, selectedComplaint.id, {
        inspection_result: findingsResult,
        defect_analysis: defectAnalysis,
        recommendations: recommendations,
        inspector_name: inspectorName,
      });
      toast.success("Workshop inspection findings & defect analysis saved");
      setFindingsModalOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to save findings");
    } finally {
      setSavingFindings(false);
    }
  };

  const handleConvertToJobCard = async (complaint: DriverComplaintRecord) => {
    setConvertingId(complaint.id);
    try {
      const res = await convertComplaintToWorkOrder(orgId, complaint.id, user?.id);
      toast.success(`Digital Job Card #${res.woNumber} raised for ${complaint.vehicle_plate}!`);
      await load();
      navigate(`/work-orders/${res.workOrderId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to raise job card");
    } finally {
      setConvertingId(null);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Quick Action Buttons */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ClipboardCheck className="h-7 w-7 text-primary" />
            Inspections, Driver Complaints & Subsystem Tracking
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Mega Beverages Slides 10 & 11: Defect reporting, workshop findings triage, component-based repair classification & recurring failure radar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Smart Parts Finder Button (Slide 14) */}
          <Button
            variant="outline"
            className="gap-1.5 border-border bg-card hover:bg-muted/60 text-xs font-semibold"
            onClick={() => {
              setSmartPartsModel("ALL");
              setSmartPartsOpen(true);
            }}
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            Smart Parts Finder (Slide 14)
          </Button>

          {/* Report Breakdown / Defect Button (Slide 10) */}
          <Button
            className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs"
            onClick={() => setComplaintModalOpen(true)}
          >
            <AlertOctagon className="h-3.5 w-3.5" />
            Report Breakdown / Defect
          </Button>

          {/* Record Walkaround Button */}
          {canWrite && machines.length > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setNewOpen(true)}
              className="gap-1.5 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" /> Record Walkaround
            </Button>
          )}
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid grid-cols-3 w-full sm:w-[680px] bg-muted/60 p-1">
          <TabsTrigger value="complaints" className="gap-2 text-xs font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Driver Complaints (Slide 10)
            {complaints.filter((c) => c.status === "open").length > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">
                {complaints.filter((c) => c.status === "open").length}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="recurring" className="gap-2 text-xs font-semibold">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            Recurring Failures (Slide 11)
            {recurringAlerts.length > 0 && (
              <Badge className="ml-1 h-4 px-1 text-[10px] bg-red-600 text-white">
                {recurringAlerts.length}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="walkarounds" className="gap-2 text-xs font-semibold">
            <ClipboardCheck className="h-3.5 w-3.5 text-emerald-500" />
            Pre-Trip QR Walkarounds
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* TAB 1: DRIVER COMPLAINTS & INSPECTION FINDINGS (SLIDE 10)                */}
        {/* ========================================================================= */}
        <TabsContent value="complaints" className="space-y-4 mt-4">
          {/* 4 Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Open Complaints</span>
              <div className="text-2xl font-bold text-foreground mt-1">
                {complaints.filter((c) => c.status === "open").length}
              </div>
              <span className="text-[11px] text-muted-foreground">Awaiting workshop triage</span>
            </div>

            <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 shadow-xs">
              <span className="text-xs text-rose-600 dark:text-rose-400 uppercase tracking-wider font-semibold">Active Breakdowns</span>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {complaints.filter((c) => c.complaint_type === "breakdown_report" && c.status !== "converted_to_wo" && c.status !== "dismissed").length}
              </div>
              <span className="text-[11px] text-muted-foreground">Corridor / road emergency</span>
            </div>

            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 shadow-xs">
              <span className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider font-semibold">Under Inspection</span>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {complaints.filter((c) => c.status === "under_inspection").length}
              </div>
              <span className="text-[11px] text-muted-foreground">Defect analysis documented</span>
            </div>

            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 shadow-xs">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-semibold">Converted to Job Cards</span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {complaints.filter((c) => c.status === "converted_to_wo").length}
              </div>
              <span className="text-[11px] text-muted-foreground">Digital Job Card raised</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2.5 bg-muted/40 p-3 rounded-xl border border-border">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search complaints, symptoms, driver..."
                value={complaintSearch}
                onChange={(e) => setComplaintSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>

            {/* Nature of Complaint */}
            <Select value={complaintTypeFilter} onValueChange={setComplaintTypeFilter}>
              <SelectTrigger className="w-40 h-8 text-xs bg-background">
                <SelectValue placeholder="All Natures" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Natures</SelectItem>
                <SelectItem value="reported_defect">Reported Defects</SelectItem>
                <SelectItem value="abnormal_condition">Abnormal Conditions</SelectItem>
                <SelectItem value="breakdown_report">Breakdown Reports</SelectItem>
              </SelectContent>
            </Select>

            {/* Subsystem Category */}
            <Select value={complaintSubsystemFilter} onValueChange={setComplaintSubsystemFilter}>
              <SelectTrigger className="w-44 h-8 text-xs bg-background">
                <SelectValue placeholder="All Subsystems" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All 11 Subsystems</SelectItem>
                {SUBSYSTEM_CATEGORIES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status */}
            <Select value={complaintStatusFilter} onValueChange={setComplaintStatusFilter}>
              <SelectTrigger className="w-36 h-8 text-xs bg-background">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="under_inspection">Under Inspection</SelectItem>
                <SelectItem value="converted_to_wo">Job Card Created</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>

            {/* Vehicle */}
            <Select value={complaintVehicleFilter} onValueChange={setComplaintVehicleFilter}>
              <SelectTrigger className="w-44 h-8 text-xs bg-background">
                <SelectValue placeholder="All Vehicles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vehicles & Plant</SelectItem>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{vehicleLabel(m.id)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Complaints List */}
          {filteredComplaints.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="h-6 w-6" />}
              title="No driver complaints found"
              description="No defects or breakdown reports match your current filter criteria."
              action={
                <Button onClick={() => setComplaintModalOpen(true)} className="gap-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Report New Complaint
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredComplaints.map((item) => {
                const isBreakdown = item.complaint_type === "breakdown_report";
                const isAbnormal = item.complaint_type === "abnormal_condition";
                const isConverted = item.status === "converted_to_wo";

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-border bg-card shadow-xs hover:border-primary/40 transition-colors space-y-3"
                  >
                    {/* Top Row: Plate, Nature Badge, Subsystem, Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm bg-muted/80 px-2 py-0.5 rounded border border-border">
                          {item.vehicle_plate}
                        </span>
                        <span className="text-xs text-muted-foreground">{item.vehicle_name}</span>

                        {/* Nature Badge */}
                        {isBreakdown ? (
                          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[10px] gap-1">
                            <AlertOctagon className="h-3 w-3" /> Breakdown Report
                          </Badge>
                        ) : isAbnormal ? (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] gap-1">
                            <AlertTriangle className="h-3 w-3" /> Abnormal Condition
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px] gap-1">
                            <FileText className="h-3 w-3" /> Reported Defect
                          </Badge>
                        )}

                        {/* Subsystem Tag */}
                        <Badge variant="outline" className="text-[10px] bg-muted/40 font-medium">
                          {item.subsystem}
                        </Badge>
                      </div>

                      {/* Status & Date */}
                      <div className="flex items-center gap-2 text-xs">
                        {isConverted ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Job Card Raised
                          </Badge>
                        ) : item.status === "under_inspection" ? (
                          <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30 text-[10px] gap-1">
                            <Search className="h-3 w-3" /> Under Inspection
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] gap-1">
                            <Clock className="h-3 w-3" /> Open
                          </Badge>
                        )}
                        <span className="text-muted-foreground">{formatDate(item.created_at)}</span>
                      </div>
                    </div>

                    {/* Complaint Details */}
                    <div>
                      <h3 className="font-bold text-sm text-foreground">{item.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                        {item.description}
                      </p>
                    </div>

                    {/* Symptoms & Metadata Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      {item.abnormal_symptoms?.map((sym) => (
                        <span
                          key={sym}
                          className="px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border"
                        >
                          {sym}
                        </span>
                      ))}

                      {item.gps_location && (
                        <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium ml-1">
                          <MapPin className="h-3 w-3" />
                          {item.gps_location}
                        </span>
                      )}

                      {item.odometer_km && (
                        <span className="text-muted-foreground ml-1">
                          · {item.odometer_km.toLocaleString()} km
                        </span>
                      )}

                      <span className="text-muted-foreground ml-auto flex items-center gap-1">
                        Reported by: <span className="font-semibold text-foreground">{item.reporter_name}</span> ({item.reporter_phone})
                      </span>
                    </div>

                    {/* Attachments Section */}
                    {item.attachments && item.attachments.length > 0 && (
                      <div className="pt-2 border-t border-border/60">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          Supporting Attachments ({item.attachments.length})
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {item.attachments.map((att, idx) => (
                            <a
                              key={idx}
                              href={att.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-muted/30 text-xs hover:bg-muted transition-colors text-foreground"
                            >
                              {att.file_type === "photo" ? (
                                <Camera className="h-3.5 w-3.5 text-blue-500" />
                              ) : (
                                <FileText className="h-3.5 w-3.5 text-amber-500" />
                              )}
                              <span>{att.name}</span>
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Workshop Inspection Findings Section (Slide 10) */}
                    <div className="pt-2 border-t border-border/60 bg-muted/20 p-3 rounded-lg space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground flex items-center gap-1">
                          <Wrench className="h-3 w-3 text-primary" />
                          Workshop Inspection Findings & Recommendations (Slide 10)
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[11px] gap-1 text-primary hover:text-primary"
                          onClick={() => handleOpenFindings(item)}
                        >
                          <Sparkles className="h-3 w-3" />
                          {item.findings?.defect_analysis ? "Edit Defect Analysis" : "Add Workshop Findings"}
                        </Button>
                      </div>

                      {item.findings?.defect_analysis ? (
                        <div className="space-y-1 text-xs">
                          {item.findings.inspection_result && (
                            <div>
                              <span className="font-semibold text-foreground">Workshop Result: </span>
                              <span className="text-muted-foreground">{item.findings.inspection_result}</span>
                            </div>
                          )}
                          <div>
                            <span className="font-semibold text-foreground">Defect Analysis: </span>
                            <span className="text-muted-foreground">{item.findings.defect_analysis}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Recommendation: </span>
                            <span className="text-muted-foreground">{item.findings.recommendations}</span>
                          </div>
                          {item.findings.inspector_name && (
                            <div className="text-[10px] text-muted-foreground italic">
                              Inspector: {item.findings.inspector_name} {item.findings.inspected_at && `· ${formatDate(item.findings.inspected_at)}`}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">
                          No workshop inspection findings or defect analysis recorded yet. Click above to triage and document engineering recommendations.
                        </p>
                      )}
                    </div>

                    {/* Actions Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            setSmartPartsModel(item.vehicle_name || "ALL");
                            setSmartPartsOpen(true);
                          }}
                        >
                          <Zap className="h-3 w-3 text-amber-500" />
                          Check Compatible Spares
                        </Button>
                      </div>

                      <div>
                        {isConverted && item.work_order_id ? (
                          <Link
                            to={`/work-orders/${item.work_order_id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            <span>Open Digital Job Card</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
                            disabled={convertingId === item.id}
                            onClick={() => handleConvertToJobCard(item)}
                          >
                            {convertingId === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Wrench className="h-3 w-3" />
                            )}
                            Raise Digital Job Card (WO)
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: 11-SUBSYSTEM RECURRING FAILURE RADAR (SLIDE 11)                   */}
        {/* ========================================================================= */}
        <TabsContent value="recurring" className="space-y-5 mt-4">
          {/* Executive Overview Banner */}
          <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-1">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" />
              Component-Based Maintenance Tracking & Trend Analytics (Slide 11)
            </h3>
            <p className="text-xs text-muted-foreground">
              Automated failure detection across all 11 subsystems: Engine, Fuel, Brake, Suspension, Steering, Transmission, Electrical, Electronics, Air, Body Works, and Accident Repairs. Identifies chronic recurring breakdowns (≥2 incidents within 90 days) to prevent repeat downtime.
            </p>
          </div>

          {/* Active Recurring Breakdown Alerts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-rose-500" />
                Active Recurring Failure Radar ({recurringAlerts.length})
              </h4>
              <span className="text-[11px] text-muted-foreground">Threshold: ≥2 incidents in 90 days</span>
            </div>

            {recurringAlerts.length === 0 ? (
              <div className="p-8 rounded-xl border border-border bg-card text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                <h4 className="font-semibold text-sm">No Chronic Failures Detected</h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Fleet components are performing within normal reliability thresholds with zero repeat breakdowns on identical subsystems in the last 90 days.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recurringAlerts.map((alert, idx) => {
                  const isChronic = alert.risk_level === "chronic";
                  const isHigh = alert.risk_level === "high";

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "p-4 rounded-xl border space-y-3 shadow-xs",
                        isChronic
                          ? "border-rose-500/40 bg-rose-500/5 dark:bg-rose-950/20"
                          : isHigh
                          ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20"
                          : "border-blue-500/40 bg-blue-500/5 dark:bg-blue-950/20"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-sm bg-background px-2 py-0.5 rounded border border-border">
                            {alert.vehicle_plate}
                          </span>
                          <Badge variant="outline" className="text-[10px] font-semibold bg-background">
                            {alert.subsystem}
                          </Badge>
                        </div>

                        {/* Risk Badge */}
                        {isChronic ? (
                          <Badge className="bg-rose-600 text-white text-[10px] uppercase font-bold animate-pulse">
                            Chronic Repeat ({alert.incident_count}x)
                          </Badge>
                        ) : isHigh ? (
                          <Badge className="bg-amber-600 text-white text-[10px] uppercase font-bold">
                            High Risk ({alert.incident_count}x)
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-600 text-white text-[10px] uppercase font-bold">
                            Moderate ({alert.incident_count}x)
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs space-y-1">
                        <div className="text-muted-foreground">
                          Detected <span className="font-bold text-foreground">{alert.incident_count} repeat incidents</span> between{" "}
                          <span className="font-medium text-foreground">{formatDate(alert.first_incident_at)}</span> and{" "}
                          <span className="font-medium text-foreground">{formatDate(alert.last_incident_at)}</span>.
                        </div>

                        {/* Root-cause Engineering Guidance */}
                        <div className="mt-2 p-2.5 rounded bg-background/80 border border-border/60 text-xs">
                          <span className="font-semibold text-rose-600 dark:text-rose-400 block mb-0.5">
                            Engineering Recommendation:
                          </span>
                          <span className="text-muted-foreground leading-relaxed">
                            {alert.recommendation}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 bg-background"
                          onClick={() => {
                            setSmartPartsModel(alert.vehicle_name || "ALL");
                            setSmartPartsOpen(true);
                          }}
                        >
                          <Zap className="h-3 w-3 text-amber-500" />
                          View Compatible Spares
                        </Button>

                        <Link
                          to={`/work-orders/new?machine=${alert.machine_id}&reason=${encodeURIComponent(`Chronic ${alert.subsystem} repeat failure (${alert.incident_count}x incidents in 90 days). ${alert.recommendation}`)}&priority=urgent`}
                          className="inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
                        >
                          <Wrench className="h-3 w-3" />
                          Raise Overhaul Job Card
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 11-Subsystem Pareto Breakdown Distribution */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-primary" />
                  11-Subsystem Defect Pareto Distribution
                </h4>
                <p className="text-xs text-muted-foreground">
                  Breakdown of all {subsystemStats.total} historical defects and job card repairs by vehicle component.
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-muted-foreground">
                Total Tracked: {subsystemStats.total}
              </span>
            </div>

            <div className="space-y-3 pt-2">
              {subsystemStats.sorted.map(([name, count], rank) => {
                const pct = subsystemStats.total > 0 ? Math.round((count / subsystemStats.total) * 100) : 0;
                return (
                  <div key={name} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-muted-foreground">#{rank + 1}</span>
                        {name}
                        {rank === 0 && count > 0 && (
                          <Badge className="bg-rose-500/20 text-rose-700 dark:text-rose-400 border-none text-[9px] py-0 px-1 font-bold">
                            Leading Cause
                          </Badge>
                        )}
                      </span>
                      <span className="font-mono text-muted-foreground font-medium">
                        {count} incidents ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          rank === 0 ? "bg-rose-500" : rank === 1 ? "bg-amber-500" : rank === 2 ? "bg-blue-500" : "bg-primary/70"
                        )}
                        style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: PRE-TRIP QR WALKAROUNDS                                            */}
        {/* ========================================================================= */}
        <TabsContent value="walkarounds" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-3">
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="w-44 h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All results</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="attention">Needs attention</SelectItem>
              </SelectContent>
            </Select>
            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
              <SelectTrigger className="w-52 h-8 text-xs bg-background"><SelectValue placeholder="All vehicles" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All vehicles</SelectItem>
                {machines.map((m) => <SelectItem key={m.id} value={m.id}>{vehicleLabel(m.id)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={driverFilter} onValueChange={setDriverFilter}>
              <SelectTrigger className="w-52 h-8 text-xs bg-background"><SelectValue placeholder="All drivers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All drivers</SelectItem>
                {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {filteredExecutions.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="h-5 w-5" />}
              title="No walkarounds submitted yet"
              description="Drivers can submit pre-start inspections by scanning the vehicle's QR code or record one manually here."
              action={
                canWrite && machines.length > 0 ? (
                  <Button onClick={() => setNewOpen(true)} className="gap-1.5 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Record inspection
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <table className="w-full text-xs">
                <thead className="text-left uppercase tracking-wider text-muted-foreground bg-muted/60 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Vehicle</th>
                    <th className="px-4 py-3 font-semibold">Driver</th>
                    <th className="px-4 py-3 font-semibold">Submitted</th>
                    <th className="px-4 py-3 font-semibold">Result</th>
                    <th className="px-4 py-3 font-semibold text-right">QR Inspection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredExecutions.map((e) => {
                    const vehicleObj = machineMap.get(e.machine_id);
                    return (
                      <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          <Link to={`/fleet/vehicles/${e.machine_id}`} className="hover:underline text-foreground">
                            {vehicleLabel(e.machine_id)}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {e.driver_id ? driverMap.get(e.driver_id)?.full_name ?? e.performed_by_name : e.performed_by_name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(e.performed_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${RESULT_CLASS[e.overall_result ?? "ok"] ?? "bg-muted"}`}>
                              {(e.overall_result ?? "ok") === "attention" ? "Needs attention" : "OK"}
                            </span>
                            {(e.overall_result ?? "ok") === "attention" && (
                              <Link
                                to={`/work-orders/new?machine=${e.machine_id}&reason=${encodeURIComponent(e.defect_notes || "Pre-trip inspection defect flagged by driver")}&priority=urgent&source=pre_trip_inspection`}
                                className="inline-flex items-center gap-1 rounded bg-red-500/10 hover:bg-red-500/20 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400 transition-colors"
                                title="Raise Digital Job Card for this inspection defect (Slide 10)"
                              >
                                <Wrench className="h-3 w-3" />
                                Raise Job Card
                              </Link>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {vehicleObj && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setQrMachine(vehicleObj);
                                setQrOpen(true);
                              }}
                              className="h-7 gap-1 text-xs text-primary"
                              title="View / Print Driver QR Inspection Sticker"
                            >
                              <QrCode className="h-3.5 w-3.5" /> QR Code
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
        </TabsContent>
      </Tabs>

      {/* Slide 10: Driver Complaint & Breakdown Modal */}
      <DriverComplaintModal
        open={complaintModalOpen}
        onOpenChange={setComplaintModalOpen}
        vehicles={machines}
        onCreated={load}
      />

      {/* Slide 14: Smart Parts Finder Modal */}
      <SmartPartsFinderModal
        open={smartPartsOpen}
        onOpenChange={setSmartPartsOpen}
        initialVehicleModel={smartPartsModel}
      />

      {/* Slide 10: Workshop Inspection Findings & Defect Analysis Dialog */}
      <Dialog open={findingsModalOpen} onOpenChange={setFindingsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              Workshop Findings & Defect Analysis (Slide 10)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Document root-cause analysis, defect findings, and preventive recommendations for {selectedComplaint?.vehicle_plate}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-semibold text-muted-foreground block mb-1">
                Workshop Inspection Result
              </label>
              <Input
                placeholder="e.g. Confirmed damaged high-pressure airline at relay valve..."
                value={findingsResult}
                onChange={(e) => setFindingsResult(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-muted-foreground block mb-1">
                Root-Cause Defect Analysis (Slide 10)
              </label>
              <Textarea
                rows={3}
                placeholder="e.g. Mechanical fatigue and stone chip impact along rough corridor detour; lack of protective spiral sleeve..."
                value={defectAnalysis}
                onChange={(e) => setDefectAnalysis(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-muted-foreground block mb-1">
                Engineering Recommendations (Slide 10)
              </label>
              <Textarea
                rows={2}
                placeholder="e.g. Replace airline with braided high-pressure hose; install reinforced gravel guard..."
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-muted-foreground block mb-1">
                Inspector / Workshop Engineer Name
              </label>
              <Input
                placeholder="e.g. Fundi Emmanuel / Workshop Supervisor"
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFindingsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={savingFindings}
              onClick={handleSaveFindings}
            >
              {savingFindings ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
              Save Inspection Findings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pre-Trip Walkaround Dialog */}
      <NewInspectionDialog open={newOpen} onOpenChange={setNewOpen} machines={machines} drivers={drivers} onSaved={load} />

      {/* Machine QR Sticker Dialog */}
      {qrMachine && (
        <MachineQrDialog
          open={qrOpen}
          onOpenChange={setQrOpen}
          machineId={qrMachine.id}
          machineName={qrMachine.name}
          qrEnabled={true}
          plateNumber={qrMachine.plate_number}
          currentHours={qrMachine.current_odometer_km}
          category={qrMachine.category || "Vehicle"}
          organisationName={organisation?.name}
          organisationLogoUrl={organisation?.logo_url}
        />
      )}
    </div>
  );
}

type TemplateItem = { item_id: string; item_text: string; item_sort_order: number; item_severity: string };
type Result = "ok" | "not_ok" | "not_relevant";

function NewInspectionDialog({ open, onOpenChange, machines, drivers, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machines: Machine[];
  drivers: Driver[];
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [machineId, setMachineId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [performedByName, setPerformedByName] = useState("");
  const [template, setTemplate] = useState<{ id: string; name: string; version: number } | null>(null);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [responses, setResponses] = useState<Record<string, { result: Result; comment: string }>>({});
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMachineId("");
      setDriverId("");
      setPerformedByName("");
      setTemplate(null);
      setItems([]);
      setResponses({});
    }
  }, [open]);

  useEffect(() => {
    if (!machineId) { setTemplate(null); setItems([]); return; }
    setLoadingTemplate(true);
    setResponses({});
    supabase.rpc("get_fleet_pre_start_template", { _machine_id: machineId }).then(({ data, error }) => {
      setLoadingTemplate(false);
      if (error) return toast.error(error.message);
      if (!data || data.length === 0) { setTemplate(null); setItems([]); return; }
      setTemplate({ id: data[0].template_id, name: data[0].template_name, version: data[0].template_version });
      setItems(
        data
          .map((r) => ({ item_id: r.item_id, item_text: r.item_text, item_sort_order: r.item_sort_order, item_severity: r.item_severity }))
          .sort((a, b) => a.item_sort_order - b.item_sort_order),
      );
    });
  }, [machineId]);

  const setResult = (itemId: string, result: Result) => {
    setResponses((prev) => ({ ...prev, [itemId]: { result, comment: prev[itemId]?.comment ?? "" } }));
  };
  const setComment = (itemId: string, comment: string) => {
    setResponses((prev) => ({ ...prev, [itemId]: { result: prev[itemId]?.result ?? "not_relevant", comment } }));
  };

  const allAnswered = items.length > 0 && items.every((it) => responses[it.item_id]?.result);
  const notOkCount = items.filter((it) => responses[it.item_id]?.result === "not_ok").length;
  const machine = machines.find((m) => m.id === machineId);

  const submit = async () => {
    if (!machine || !template) return;
    const driverName = drivers.find((d) => d.id === driverId)?.full_name;
    const name = driverName || performedByName.trim();
    if (!name) return toast.error("Enter who performed the inspection");
    setSubmitting(true);
    const executionId = crypto.randomUUID();
    const overallResult = notOkCount > 0 ? "attention" : "ok";

    const { error: execErr } = await supabase.from("checklist_executions").insert({
      id: executionId,
      organisation_id: machine.organisation_id,
      machine_id: machine.id,
      template_id: template.id,
      template_version: template.version,
      driver_id: driverId || null,
      performed_by: user?.id ?? null,
      performed_by_name: name,
      status: "completed",
      overall_result: overallResult,
    });
    if (execErr) {
      setSubmitting(false);
      return toast.error(execErr.message);
    }

    const rows = items.map((it, i) => ({
      execution_id: executionId,
      item_id: it.item_id,
      item_text_snapshot: it.item_text,
      item_type: "tri_state",
      severity_snapshot: it.item_severity,
      result: responses[it.item_id]?.result ?? "not_relevant",
      notes: responses[it.item_id]?.comment || null,
      sort_order: i,
    }));
    const { error: respErr } = await supabase.from("checklist_execution_responses").insert(rows);
    setSubmitting(false);
    if (respErr) return toast.error(respErr.message);

    toast.success(notOkCount > 0 ? `Inspection recorded — ${notOkCount} item(s) flagged` : "Inspection recorded — all OK");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Record a pre-start inspection</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Vehicle *</label>
              <Select value={machineId} onValueChange={setMachineId}>
                <SelectTrigger><SelectValue placeholder="Pick a vehicle" /></SelectTrigger>
                <SelectContent>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.plate_number ? `${m.name} (${m.plate_number})` : m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Driver</label>
              {drivers.length > 0 ? (
                <Select value={driverId} onValueChange={setDriverId}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <input
                  value={performedByName}
                  onChange={(e) => setPerformedByName(e.target.value)}
                  placeholder="Who performed this inspection"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              )}
            </div>
          </div>

          {loadingTemplate && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {!loadingTemplate && machineId && !template && (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No fleet pre-start template is set up for this organisation yet. Mark a checklist template as the fleet pre-start template first.
            </div>
          )}

          {!loadingTemplate && template && items.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{template.name}</p>
              {items.map((it, i) => {
                const r = responses[it.item_id]?.result;
                return (
                  <div key={it.item_id} className="rounded-xl border border-border p-3">
                    <p className="mb-2.5 text-sm font-medium">{i + 1}. {it.item_text}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setResult(it.item_id, "ok")}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border-2 py-2 text-xs font-medium transition-colors",
                          r === "ok" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-border text-muted-foreground hover:bg-accent",
                        )}
                      >
                        <CheckCircle2 className="h-4 w-4" /> OK
                      </button>
                      <button
                        type="button"
                        onClick={() => setResult(it.item_id, "not_ok")}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border-2 py-2 text-xs font-medium transition-colors",
                          r === "not_ok" ? "border-red-500 bg-red-50 text-red-700" : "border-border text-muted-foreground hover:bg-accent",
                        )}
                      >
                        <XCircle className="h-4 w-4" /> Not OK
                      </button>
                      <button
                        type="button"
                        onClick={() => setResult(it.item_id, "not_relevant")}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border-2 py-2 text-xs font-medium transition-colors",
                          r === "not_relevant" ? "border-slate-400 bg-slate-100 text-slate-700" : "border-border text-muted-foreground hover:bg-accent",
                        )}
                      >
                        <MinusCircle className="h-4 w-4" /> N/A
                      </button>
                    </div>
                    {r === "not_ok" && (
                      <textarea
                        placeholder="What's wrong? (optional)"
                        value={responses[it.item_id]?.comment ?? ""}
                        onChange={(e) => setComment(it.item_id, e.target.value)}
                        rows={2}
                        className="mt-2.5 w-full rounded-md border border-input bg-background p-2 text-sm"
                      />
                    )}
                  </div>
                );
              })}
              {notOkCount > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {notOkCount} item{notOkCount === 1 ? "" : "s"} flagged — a fault report will be created automatically.
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={!allAnswered || submitting} onClick={submit}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save inspection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
