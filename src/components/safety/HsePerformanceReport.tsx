import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Printer,
  Calendar,
  Sparkles,
  Plus,
  CheckCircle2,
  HardHat,
  ShieldAlert,
  Save,
  RotateCcw,
  Building2,
  Loader2,
  FileCheck
} from "lucide-react";

interface HsePerformanceReportProps {
  contractorId?: string;
  contractorName?: string;
  onRefreshParent?: () => void;
}

export function HsePerformanceReport({
  contractorId,
  contractorName,
  onRefreshParent,
}: HsePerformanceReportProps) {
  const { organisation, profile } = useAuth();
  const orgId = organisation?.id || profile?.organisation_id;

  // Selected Month (YYYY-MM)
  const currentMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [loading, setLoading] = useState(true);

  // Raw Database Data
  const [toolboxTalks, setToolboxTalks] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [correctiveActions, setCorrectiveActions] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [inductions, setInductions] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [walkthroughs, setWalkthroughs] = useState<any[]>([]);

  // Metadata Fields (editable and auto-saved per contractor + month)
  const [location, setLocation] = useState("Main Plant Facility / Berth 3");
  const [workScope, setWorkScope] = useState("Contractor Mechanical & Structural Works");
  const [compiledBy, setCompiledBy] = useState(profile?.full_name || "Contractor EHS Lead");

  // Additional customizable/manual fields for EPC/DP World report items
  const [manualFields, setManualFields] = useState({
    consultantManhoursMonthly: 0,
    consultantManhoursCumulative: 0,
    projectTeamManhoursMonthly: 0,
    projectTeamManhoursCumulative: 0,
    kmsDrivenMonthly: 0,
    kmsDrivenCumulative: 0,
    emergencyDrillsMonthly: 0,
    emergencyDrillsCumulative: 0,
    hseMeetingsMonthly: 0,
    hseMeetingsCumulative: 0,
    gembaWalksMonthly: 0,
    gembaWalksCumulative: 0,
  });

  // Quick Action Dialogs to let contractors/supervisors log activities that update the report immediately
  const [quickTbtOpen, setQuickTbtOpen] = useState(false);
  const [quickHazardOpen, setQuickHazardOpen] = useState(false);
  const [quickGembaOpen, setQuickGembaOpen] = useState(false);
  const [savingAction, setSavingAction] = useState(false);

  // Quick TBT Form
  const [tbtForm, setTbtForm] = useState({
    topic: "Working at Height & Fall Arrest Verification",
    supervisor_name: profile?.full_name || "Lead Supervisor",
    attendee_count: 6,
    man_hours: 12, // 6 workers x 2 hours
    location: "Plant Area A",
  });

  // Quick Hazard Form
  const [hazardForm, setHazardForm] = useState({
    description: "Unsecured high-pressure hydraulic line near gangway.",
    incident_type: "hazard", // 'hazard' | 'near_miss'
    severity: "medium",
    location: "Berth 3 Maintenance Bay",
  });

  // Quick Walkthrough Form
  const [gembaForm, setGembaForm] = useState({
    auditor: profile?.full_name || "Safety Supervisor",
    notes: "Routine GEMBA walk completed. 100% PPE compliance noted.",
    location: "Plant Operations Floor",
  });

  // Load Metadata from LocalStorage for persistence
  useEffect(() => {
    const storageKey = `hse_report_meta_${orgId}_${contractorId || "all"}_${selectedMonth}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.location) setLocation(parsed.location);
        if (parsed.workScope) setWorkScope(parsed.workScope);
        if (parsed.compiledBy) setCompiledBy(parsed.compiledBy);
        if (parsed.manualFields) setManualFields(parsed.manualFields);
      }
    } catch (_e) {
      // ignore parsing error
    }
  }, [orgId, contractorId, selectedMonth]);

  const saveMetadata = (overrides?: any) => {
    const storageKey = `hse_report_meta_${orgId}_${contractorId || "all"}_${selectedMonth}`;
    const payload = {
      location,
      workScope,
      compiledBy,
      manualFields: overrides || manualFields,
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (_e) {
      // ignore
    }
  };

  // Month Range (Start and End dates for filtering)
  const monthDates = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return {
      startISO: startDate.toISOString(),
      endISO: endDate.toISOString(),
      startDay: `${year}-${String(month).padStart(2, "0")}-01`,
      endDay: `${year}-${String(month).padStart(2, "0")}-${String(endDate.getUTCDate()).padStart(2, "0")}`,
    };
  }, [selectedMonth]);

  // Load All System Activity Data
  const loadReportData = async () => {
    if (!orgId) return;
    setLoading(true);

    try {
      // 1. Fetch Toolbox Talks
      let tbtQuery = supabase
        .from("contractor_toolbox_talks")
        .select("*")
        .eq("organisation_id", orgId);
      if (contractorId) {
        tbtQuery = tbtQuery.eq("contractor_id", contractorId);
      }

      // 2. Fetch Safety Incidents
      const incQuery = supabase
        .from("safety_incidents")
        .select("*")
        .eq("organisation_id", orgId);

      // 3. Fetch Corrective Actions
      const caQuery = supabase
        .from("corrective_actions")
        .select("id, status, due_date, created_at, closed_at")
        .eq("organisation_id", orgId);

      // 4. Fetch Inspections / Checklist completions
      const inspQuery = supabase
        .from("checklist_completions")
        .select("id, completed_at, status")
        .eq("organisation_id", orgId);

      // 5. Fetch Inductions
      const indQuery = supabase
        .from("induction_records")
        .select("id, completed_at, status")
        .eq("organisation_id", orgId);

      // 6. Fetch Fleet Trips (for KM driven)
      const tripsQuery = (supabase as any)
        .from("fleet_trips")
        .select("id, distance_km, start_time")
        .eq("organisation_id", orgId);

      // 7. Fetch GEMBA walks / suspensions
      let suspQuery = supabase
        .from("contractor_work_suspensions")
        .select("*")
        .eq("organisation_id", orgId);
      if (contractorId) {
        suspQuery = suspQuery.eq("contractor_id", contractorId);
      }

      const [
        { data: tbtData },
        { data: incData },
        { data: caData },
        { data: inspData },
        { data: indData },
        { data: tripsData },
        { data: suspData },
      ] = await Promise.all([
        tbtQuery,
        incQuery,
        caQuery,
        inspQuery,
        indQuery,
        tripsQuery,
        suspQuery,
      ]);

      setToolboxTalks(tbtData || []);
      setIncidents(incData || []);
      setCorrectiveActions(caData || []);
      setInspections(inspData || []);
      setInductions(indData || []);
      setTrips(tripsData || []);
      setWalkthroughs(suspData || []);
    } catch (err: any) {
      console.warn("HSE report data load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [orgId, contractorId, selectedMonth]);

  // =========================================================================
  // AUTOMATED HSE PERFORMANCE METRIC CALCULATIONS
  // Calculates both:
  //   1) Monthly Report (strictly within selectedMonth)
  //   2) Project Cumulative (from day 0 up to end of selectedMonth)
  // =========================================================================
  const metrics = useMemo(() => {
    const { startDay, endDay, endISO } = monthDates;

    // Filter helper: cumulative means <= end of the chosen month
    const isMonthly = (dateStr?: string | null) => {
      if (!dateStr) return false;
      const d = dateStr.slice(0, 10);
      return d >= startDay && d <= endDay;
    };

    const isCumulative = (dateStr?: string | null) => {
      if (!dateStr) return false;
      const d = dateStr.slice(0, 10);
      return d <= endDay;
    };

    // 1. TOOLBOX TALKS & CONTRACTOR MANHOURS
    const monthlyTbts = toolboxTalks.filter((t) => isMonthly(t.talk_date || t.created_at));
    const cumulativeTbts = toolboxTalks.filter((t) => isCumulative(t.talk_date || t.created_at));

    const tbtCountMonthly = monthlyTbts.length;
    const tbtCountCumulative = cumulativeTbts.length;

    const contractorManhoursMonthly = monthlyTbts.reduce(
      (acc, t) => acc + Number(t.man_hours || (Number(t.attendee_count || 1) * 1)),
      0
    );
    const contractorManhoursCumulative = cumulativeTbts.reduce(
      (acc, t) => acc + Number(t.man_hours || (Number(t.attendee_count || 1) * 1)),
      0
    );

    // 2. PROJECT TEAM & CONSULTANT MANHOURS
    const projectTeamManhoursMonthly = manualFields.projectTeamManhoursMonthly || Math.round(contractorManhoursMonthly * 0.25);
    const projectTeamManhoursCumulative = manualFields.projectTeamManhoursCumulative || Math.round(contractorManhoursCumulative * 0.25);

    const consultantManhoursMonthly = manualFields.consultantManhoursMonthly || 0;
    const consultantManhoursCumulative = manualFields.consultantManhoursCumulative || 0;

    const totalManhoursMonthly =
      contractorManhoursMonthly + projectTeamManhoursMonthly + consultantManhoursMonthly;
    const totalManhoursCumulative =
      contractorManhoursCumulative + projectTeamManhoursCumulative + consultantManhoursCumulative;

    // 3. SAFETY OBSERVATIONS (HAZARDS & NEAR MISSES)
    const monthlyIncidents = incidents.filter((i) => isMonthly(i.occurred_at));
    const cumulativeIncidents = incidents.filter((i) => isCumulative(i.occurred_at));

    const hazardsMonthly = monthlyIncidents.filter((i) => i.incident_type === "hazard" || i.incident_type === "near_miss").length;
    const hazardsCumulative = cumulativeIncidents.filter((i) => i.incident_type === "hazard" || i.incident_type === "near_miss").length;

    // 4. HSE MEETINGS UNDERTAKEN
    const hseMeetingsMonthly = (manualFields.hseMeetingsMonthly || 0) + tbtCountMonthly;
    const hseMeetingsCumulative = (manualFields.hseMeetingsCumulative || 0) + tbtCountCumulative;

    // 5. MANAGEMENT WALKTHROUGHS / GEMBA WALKS
    const gembaMonthly = (manualFields.gembaWalksMonthly || 0) + walkthroughs.filter((w) => isMonthly(w.suspended_at || w.created_at)).length;
    const gembaCumulative = (manualFields.gembaWalksCumulative || 0) + walkthroughs.filter((w) => isCumulative(w.suspended_at || w.created_at)).length;

    // 6. SAFETY INSPECTIONS & AUDITS
    const inspectionsMonthly = inspections.filter((i) => isMonthly(i.completed_at)).length;
    const inspectionsCumulative = inspections.filter((i) => isCumulative(i.completed_at)).length;

    const auditsMonthly = Math.max(1, Math.floor(inspectionsMonthly / 3));
    const auditsCumulative = Math.max(1, Math.floor(inspectionsCumulative / 3));

    // 7. NUMBER OF CORRECTIVE ACTIONS OVERDUE
    const today = new Date().toISOString().slice(0, 10);
    const overdueCapas = correctiveActions.filter(
      (c) => c.status !== "closed" && c.due_date && c.due_date < today
    ).length;

    // 8. HOURS OF HSE TRAINING COMPLETED
    // Each completed induction counts as 2 training hours
    const trainingMonthly = inductions.filter((ind) => isMonthly(ind.completed_at)).length * 2;
    const trainingCumulative = inductions.filter((ind) => isCumulative(ind.completed_at)).length * 2;

    // 9. COMPLETED MANHOURS WITHOUT LTI
    // If any incident has lost_time_hours > 0 or incident_type === 'lost_time'
    const ltiIncidents = cumulativeIncidents.filter((i) => i.incident_type === "lost_time" || Number(i.lost_time_hours || 0) > 0);
    const completedManhoursWithoutLti = ltiIncidents.length === 0 ? totalManhoursCumulative : Math.max(0, totalManhoursCumulative - (ltiIncidents.length * 1500));

    // 10. KM's DRIVEN
    const tripsMonthly = trips.filter((tr) => isMonthly(tr.start_time)).reduce((acc, tr) => acc + Number(tr.distance_km || 0), 0);
    const tripsCumulative = trips.filter((tr) => isCumulative(tr.start_time)).reduce((acc, tr) => acc + Number(tr.distance_km || 0), 0);
    const kmsDrivenMonthly = manualFields.kmsDrivenMonthly || Math.round(tripsMonthly);
    const kmsDrivenCumulative = manualFields.kmsDrivenCumulative || Math.round(tripsCumulative);

    // 11. EMERGENCY DRILLS
    const emergencyDrillsMonthly = manualFields.emergencyDrillsMonthly || 0;
    const emergencyDrillsCumulative = manualFields.emergencyDrillsCumulative || 0;

    // =========================================================================
    // LAGGING INDICATORS
    // =========================================================================
    const fatalitiesMonthly = monthlyIncidents.filter((i) => i.incident_type === "fatality" || i.description?.toLowerCase().includes("fatal")).length;
    const fatalitiesCumulative = cumulativeIncidents.filter((i) => i.incident_type === "fatality" || i.description?.toLowerCase().includes("fatal")).length;

    const seriousInjuriesMonthly = monthlyIncidents.filter((i) => i.severity === "critical" && i.incident_type !== "fatality").length;
    const seriousInjuriesCumulative = cumulativeIncidents.filter((i) => i.severity === "critical" && i.incident_type !== "fatality").length;

    const mtiMonthly = monthlyIncidents.filter((i) => i.incident_type === "accident" && i.severity === "high").length;
    const mtiCumulative = cumulativeIncidents.filter((i) => i.incident_type === "accident" && i.severity === "high").length;

    const facMonthly = monthlyIncidents.filter((i) => i.incident_type === "first_aid").length;
    const facCumulative = cumulativeIncidents.filter((i) => i.incident_type === "first_aid").length;

    const ltiMonthly = monthlyIncidents.filter((i) => i.incident_type === "lost_time" || Number(i.lost_time_hours || 0) > 0).length;
    const ltiCumulative = cumulativeIncidents.filter((i) => i.incident_type === "lost_time" || Number(i.lost_time_hours || 0) > 0).length;

    const rwcMonthly = monthlyIncidents.filter((i) => i.incident_type === "restricted_work" || i.description?.toLowerCase().includes("restricted")).length;
    const rwcCumulative = cumulativeIncidents.filter((i) => i.incident_type === "restricted_work" || i.description?.toLowerCase().includes("restricted")).length;

    const nearMissMonthly = monthlyIncidents.filter((i) => i.incident_type === "near_miss").length;
    const nearMissCumulative = cumulativeIncidents.filter((i) => i.incident_type === "near_miss").length;

    const envMonthly = monthlyIncidents.filter((i) => i.incident_type === "environmental" || i.description?.toLowerCase().includes("spill")).length;
    const envCumulative = cumulativeIncidents.filter((i) => i.incident_type === "environmental" || i.description?.toLowerCase().includes("spill")).length;

    const propertyDamageMonthly = monthlyIncidents.filter((i) => i.incident_type === "property_damage" || i.description?.toLowerCase().includes("damage")).length;
    const propertyDamageCumulative = cumulativeIncidents.filter((i) => i.incident_type === "property_damage" || i.description?.toLowerCase().includes("damage")).length;

    return {
      leading: [
        { label: "Safety Observations (Hazards Submitted)", monthly: hazardsMonthly, cumulative: hazardsCumulative, auto: true },
        { label: "HSE Meetings Undertaken", monthly: hseMeetingsMonthly, cumulative: hseMeetingsCumulative, key: "hseMeetings" },
        { label: "Management Walkthroughs/ GEMBA Walks", monthly: gembaMonthly, cumulative: gembaCumulative, key: "gembaWalks" },
        { label: "No. of Toolbox Talks Completed", monthly: tbtCountMonthly, cumulative: tbtCountCumulative, auto: true },
        { label: "No. of Safety Inspections completed", monthly: inspectionsMonthly, cumulative: inspectionsCumulative, auto: true },
        { label: "No. of Audits completed", monthly: auditsMonthly, cumulative: auditsCumulative, auto: true },
        { label: "Number of corrective actions overdue", monthly: overdueCapas, cumulative: overdueCapas, auto: true },
        { label: "Hours of HSE training completed", monthly: trainingMonthly, cumulative: trainingCumulative, auto: true },
        { label: "Total Man hrs. worked (Employees & Contractors)", monthly: totalManhoursMonthly, cumulative: totalManhoursCumulative, auto: true },
        { label: "DPW-Project Team manhours (Engineering & Operations)", monthly: projectTeamManhoursMonthly, cumulative: projectTeamManhoursCumulative, key: "projectTeamManhours" },
        { label: "Consultant Total manhours worked", monthly: consultantManhoursMonthly, cumulative: consultantManhoursCumulative, key: "consultantManhours" },
        { label: "Contractor Total manhours worked", monthly: contractorManhoursMonthly, cumulative: contractorManhoursCumulative, auto: true },
        { label: "Completed manhours without LTI", monthly: totalManhoursMonthly, cumulative: completedManhoursWithoutLti, auto: true },
        { label: "KM's Driven", monthly: kmsDrivenMonthly, cumulative: kmsDrivenCumulative, key: "kmsDriven" },
        { label: "Emergency Drills", monthly: emergencyDrillsMonthly, cumulative: emergencyDrillsCumulative, key: "emergencyDrills" },
      ],
      lagging: [
        { label: "Fatality", monthly: fatalitiesMonthly, cumulative: fatalitiesCumulative },
        { label: "Serious Injuries", monthly: seriousInjuriesMonthly, cumulative: seriousInjuriesCumulative },
        { label: "Medical Treatment Injury (MTI)", monthly: mtiMonthly, cumulative: mtiCumulative },
        { label: "First Aid Case (FAC)", monthly: facMonthly, cumulative: facCumulative },
        { label: "Lost Time Injury (LTI)", monthly: ltiMonthly, cumulative: ltiCumulative },
        { label: "Restricted Work Case (RWC)", monthly: rwcMonthly, cumulative: rwcCumulative },
        { label: "Near Misses", monthly: nearMissMonthly, cumulative: nearMissCumulative },
        { label: "Environmental Incidents", monthly: envMonthly, cumulative: envCumulative },
        { label: "Property Damage Cases", monthly: propertyDamageMonthly, cumulative: propertyDamageCumulative },
      ],
      summary: {
        tbtCountMonthly,
        contractorManhoursMonthly,
        completedManhoursWithoutLti,
        hazardsMonthly,
      },
    };
  }, [toolboxTalks, incidents, correctiveActions, inspections, inductions, trips, walkthroughs, monthDates, manualFields]);

  // =========================================================================
  // QUICK ACTIONS: Directly triggers self-updating actions on the report
  // =========================================================================
  const handleQuickTbt = async () => {
    if (!contractorId) return toast.error("Please select an active contractor");
    setSavingAction(true);
    try {
      const { error } = await supabase.from("contractor_toolbox_talks").insert({
        organisation_id: orgId,
        contractor_id: contractorId,
        talk_date: new Date().toISOString().slice(0, 10),
        topic: tbtForm.topic,
        supervisor_name: tbtForm.supervisor_name,
        location: tbtForm.location,
        attendee_count: Number(tbtForm.attendee_count) || 1,
        man_hours: Number(tbtForm.man_hours) || 2,
        hazards_discussed: "Job hazards, site speed limits, mandatory PPE checked.",
        controls_agreed: "100% tie-off, barricading, continuous supervisory oversight.",
      });

      if (error) throw error;
      toast.success("Toolbox Talk logged! HSE Report updated automatically.");
      setQuickTbtOpen(false);
      loadReportData();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      toast.error(err.message || "Failed to log Toolbox Talk");
    } finally {
      setSavingAction(false);
    }
  };

  const handleQuickHazard = async () => {
    setSavingAction(true);
    try {
      const { error } = await supabase.from("safety_incidents").insert({
        organisation_id: orgId,
        reported_by: profile?.id || null,
        incident_type: hazardForm.incident_type,
        severity: hazardForm.severity,
        occurred_at: new Date().toISOString(),
        location: hazardForm.location,
        description: hazardForm.description,
        immediate_action: "Area cordoned off, supervisor informed.",
      });

      if (error) throw error;
      toast.success("Safety Observation logged! HSE Report updated automatically.");
      setQuickHazardOpen(false);
      loadReportData();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      toast.error(err.message || "Failed to log Hazard");
    } finally {
      setSavingAction(false);
    }
  };

  const handleQuickGemba = () => {
    const updated = {
      ...manualFields,
      gembaWalksMonthly: (manualFields.gembaWalksMonthly || 0) + 1,
      gembaWalksCumulative: (manualFields.gembaWalksCumulative || 0) + 1,
      hseMeetingsMonthly: (manualFields.hseMeetingsMonthly || 0) + 1,
      hseMeetingsCumulative: (manualFields.hseMeetingsCumulative || 0) + 1,
    };
    setManualFields(updated);
    saveMetadata(updated);
    toast.success("Management GEMBA Walk recorded! HSE Report updated.");
    setQuickGembaOpen(false);
  };

  const handleFieldChange = (key: string, type: "monthly" | "cumulative", val: number) => {
    const fieldKey = `${key}${type === "monthly" ? "Monthly" : "Cumulative"}` as keyof typeof manualFields;
    const updated = {
      ...manualFields,
      [fieldKey]: val,
    };
    setManualFields(updated);
    saveMetadata(updated);
  };

  // Month selector options (Last 12 months)
  const monthOptions = useMemo(() => {
    const list: { label: string; value: string }[] = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      const target = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const val = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
      const lbl = target.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      list.push({ label: lbl, value: val });
    }
    return list;
  }, []);

  return (
    <div className="space-y-4">
      {/* Top Action & Controls Bar (Hidden during print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border p-4 rounded-xl shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-[#00A651]" />
            <span className="text-xs font-semibold text-foreground">Reporting Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-bold text-foreground focus:ring-1 focus:ring-[#00A651]"
            >
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <Badge className="bg-[#00A651]/15 text-[#00A651] border-[#00A651]/30 text-[10px] font-bold gap-1">
            <Sparkles className="h-3 w-3" /> LIVE SELF-UPDATING
          </Badge>
        </div>

        {/* Action Triggers that immediately demonstrate auto-updates */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setQuickTbtOpen(true)}
            className="h-8 text-xs bg-[#00A651] hover:bg-[#008f45] text-white font-bold gap-1"
            title="Log shift Toolbox Talk to automatically add safe man-hours and talks to this report"
          >
            <Plus className="h-3.5 w-3.5" /> Log Toolbox Talk
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setQuickHazardOpen(true)}
            className="h-8 text-xs gap-1 border-amber-600/30 text-amber-700 dark:text-amber-400 font-semibold"
            title="Submit a Safety Observation or Near-Miss to update leading indicators"
          >
            <ShieldAlert className="h-3.5 w-3.5" /> Submit Hazard
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setQuickGembaOpen(true)}
            className="h-8 text-xs gap-1 border-blue-600/30 text-blue-700 dark:text-blue-400 font-semibold"
            title="Log Management GEMBA site walk"
          >
            <FileCheck className="h-3.5 w-3.5" /> Log GEMBA Walk
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            className="h-8 text-xs gap-1.5 border-black/30 font-bold"
          >
            <Printer className="h-3.5 w-3.5" /> Print / Export PDF
          </Button>
        </div>
      </div>

      {/* Live Self-Updating Notification Banner */}
      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-lg flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-300 print:hidden">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#00A651] shrink-0" />
          <span>
            <strong>Real-Time Dynamic Synchronisation:</strong> Every Toolbox Talk logged, hazard submitted, or worker inducted instantly updates the respective monthly and cumulative cells below without manual entry.
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={loadReportData}
          className="h-7 text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 gap-1 font-bold"
        >
          <RotateCcw className="h-3 w-3" /> Refresh
        </Button>
      </div>

      {/* =====================================================================
          OFFICIAL HSE PERFORMANCE REPORT DOCUMENT (Matches Image Layout Exactly)
         ===================================================================== */}
      <div className="bg-white text-black p-6 sm:p-8 rounded-xl border-2 border-slate-900 shadow-md print:border-none print:p-0 print:shadow-none font-sans">
        {/* Document Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-4">
          <div className="flex items-center gap-3">
            {organisation?.logo_url ? (
              <img
                src={organisation.logo_url}
                alt="Company Logo"
                className="h-12 w-auto max-w-[140px] object-contain"
              />
            ) : (
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-lg bg-emerald-600 text-white font-black flex items-center justify-center text-lg shadow-sm">
                  DP
                </div>
                <div className="font-black text-xl tracking-tight uppercase text-slate-900">
                  {organisation?.name || "DP WORLD"}
                </div>
              </div>
            )}
          </div>

          <div className="text-right">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {contractorName || organisation?.name || "Company Name"}
            </div>
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-slate-900 mt-0.5">
              HSE PERFORMANCE REPORT
            </h1>
          </div>
        </div>

        {/* Metadata Grid Table */}
        <div className="border border-slate-900 mb-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-900">
            <div className="p-2 flex items-center gap-2">
              <span className="font-bold text-slate-700 min-w-[70px]">Location:</span>
              <input
                type="text"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  saveMetadata();
                }}
                className="w-full bg-transparent border-b border-dashed border-slate-400 focus:border-slate-900 outline-none text-slate-900 px-1 font-semibold"
                placeholder="e.g. Berth 3 / Main Manufacturing Bay"
              />
            </div>
            <div className="p-2 flex items-center gap-2">
              <span className="font-bold text-slate-700 min-w-[85px]">Work scope:</span>
              <input
                type="text"
                value={workScope}
                onChange={(e) => {
                  setWorkScope(e.target.value);
                  saveMetadata();
                }}
                className="w-full bg-transparent border-b border-dashed border-slate-400 focus:border-slate-900 outline-none text-slate-900 px-1 font-semibold"
                placeholder="e.g. Mechanical maintenance, electrical overhaul"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-900 border-t border-slate-900">
            <div className="p-2 flex items-center gap-2">
              <span className="font-bold text-slate-700 min-w-[120px]">Report compiled by:</span>
              <input
                type="text"
                value={compiledBy}
                onChange={(e) => {
                  setCompiledBy(e.target.value);
                  saveMetadata();
                }}
                className="w-full bg-transparent border-b border-dashed border-slate-400 focus:border-slate-900 outline-none text-slate-900 px-1 font-semibold"
                placeholder="Full Name / Designation"
              />
            </div>
            <div className="p-2 flex items-center gap-2">
              <span className="font-bold text-slate-700 min-w-[85px]">Month:</span>
              <span className="font-black text-slate-900 px-1 uppercase tracking-wide">
                {new Date(selectedMonth + "-01").toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Main Indicators Table */}
        <div className="border-2 border-slate-900 overflow-hidden">
          <table className="w-full border-collapse text-xs text-left">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-900 font-black text-slate-900">
                <th className="p-2.5 uppercase tracking-wide w-[60%] border-r border-slate-900">
                  LEADING INDICATORS
                </th>
                <th className="p-2.5 uppercase tracking-wide text-center w-[20%] border-r border-slate-900">
                  Monthly Report
                </th>
                <th className="p-2.5 uppercase tracking-wide text-center w-[20%]">
                  Project Cumulative
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-400 text-slate-900">
              {metrics.leading.map((row, idx) => (
                <tr
                  key={row.label}
                  className={`hover:bg-slate-50 transition-colors ${
                    idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                  }`}
                >
                  <td className="p-2 border-r border-slate-900 font-medium flex items-center justify-between gap-2">
                    <span>{row.label}</span>
                    {row.auto && (
                      <span className="print:hidden text-[9px] uppercase font-bold text-[#00A651] bg-emerald-50 border border-emerald-200 px-1 rounded">
                        Auto
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-center border-r border-slate-900 font-bold">
                    {row.key ? (
                      <input
                        type="number"
                        value={row.monthly}
                        onChange={(e) =>
                          handleFieldChange(row.key!, "monthly", Number(e.target.value) || 0)
                        }
                        className="w-16 text-center font-bold bg-transparent border-b border-dashed border-slate-400 focus:border-slate-900 outline-none"
                      />
                    ) : (
                      <span>{row.monthly}</span>
                    )}
                  </td>
                  <td className="p-2 text-center font-black">
                    {row.key ? (
                      <input
                        type="number"
                        value={row.cumulative}
                        onChange={(e) =>
                          handleFieldChange(row.key!, "cumulative", Number(e.target.value) || 0)
                        }
                        className="w-16 text-center font-bold bg-transparent border-b border-dashed border-slate-400 focus:border-slate-900 outline-none"
                      />
                    ) : (
                      <span>{row.cumulative}</span>
                    )}
                  </td>
                </tr>
              ))}

              {/* LAGGING INDICATORS HEADER */}
              <tr className="bg-slate-100 border-t-2 border-b-2 border-slate-900 font-black text-slate-900">
                <th className="p-2.5 uppercase tracking-wide border-r border-slate-900">
                  LAGGING INDICATORS
                </th>
                <th className="p-2.5 text-center border-r border-slate-900" />
                <th className="p-2.5 text-center" />
              </tr>

              {metrics.lagging.map((row, idx) => (
                <tr
                  key={row.label}
                  className={`hover:bg-slate-50 transition-colors ${
                    idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                  }`}
                >
                  <td className="p-2 border-r border-slate-900 font-medium">
                    {row.label}
                  </td>
                  <td className="p-2 text-center border-r border-slate-900 font-bold">
                    <span className={row.monthly > 0 ? "text-red-600 font-black" : ""}>
                      {row.monthly}
                    </span>
                  </td>
                  <td className="p-2 text-center font-black">
                    <span className={row.cumulative > 0 ? "text-red-600 font-black" : ""}>
                      {row.cumulative}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Verification Signatures Footer */}
        <div className="mt-8 pt-4 border-t-2 border-slate-900 grid grid-cols-2 sm:grid-cols-3 gap-6 text-xs">
          <div>
            <div className="font-bold uppercase text-slate-500 mb-6">Prepared By:</div>
            <div className="border-b border-slate-900 pb-1 font-semibold">{compiledBy}</div>
            <div className="text-[10px] text-slate-500 mt-1">Contractor EHS Representative</div>
          </div>
          <div>
            <div className="font-bold uppercase text-slate-500 mb-6">Verified By:</div>
            <div className="border-b border-slate-900 pb-1 font-semibold">Site Safety Supervisor</div>
            <div className="text-[10px] text-slate-500 mt-1">Client EHS Department</div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <div className="font-bold uppercase text-slate-500 mb-6">Date of Submission:</div>
            <div className="border-b border-slate-900 pb-1 font-semibold">
              {new Date().toLocaleDateString("en-US", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Audit Trail Timestamp</div>
          </div>
        </div>
      </div>

      {/* QUICK LOG TOOLBOX TALK MODAL */}
      <Dialog open={quickTbtOpen} onOpenChange={setQuickTbtOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardHat className="h-5 w-5 text-[#00A651]" />
              Quick Log Shift Toolbox Talk (TBT)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Topic *</Label>
              <Input
                value={tbtForm.topic}
                onChange={(e) => setTbtForm({ ...tbtForm, topic: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Attendees Count *</Label>
                <Input
                  type="number"
                  min={1}
                  value={tbtForm.attendee_count}
                  onChange={(e) =>
                    setTbtForm({ ...tbtForm, attendee_count: Number(e.target.value) || 1 })
                  }
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Total Man-Hours *</Label>
                <Input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={tbtForm.man_hours}
                  onChange={(e) =>
                    setTbtForm({ ...tbtForm, man_hours: Number(e.target.value) || 0 })
                  }
                  className="mt-1 text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Supervisor / Lead Name *</Label>
              <Input
                value={tbtForm.supervisor_name}
                onChange={(e) => setTbtForm({ ...tbtForm, supervisor_name: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Plant Location</Label>
              <Input
                value={tbtForm.location}
                onChange={(e) => setTbtForm({ ...tbtForm, location: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setQuickTbtOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleQuickTbt}
              disabled={savingAction}
              className="bg-[#00A651] hover:bg-[#008f45] text-white font-bold"
            >
              {savingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & Update Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QUICK LOG SAFETY OBSERVATION (HAZARD) MODAL */}
      <Dialog open={quickHazardOpen} onOpenChange={setQuickHazardOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              Submit Safety Observation / Hazard
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Observation Type</Label>
                <select
                  value={hazardForm.incident_type}
                  onChange={(e) => setHazardForm({ ...hazardForm, incident_type: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="hazard">Hazard Observation</option>
                  <option value="near_miss">Near Miss</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Severity</Label>
                <select
                  value={hazardForm.severity}
                  onChange={(e) => setHazardForm({ ...hazardForm, severity: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Location</Label>
              <Input
                value={hazardForm.location}
                onChange={(e) => setHazardForm({ ...hazardForm, location: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Description *</Label>
              <Textarea
                rows={3}
                value={hazardForm.description}
                onChange={(e) => setHazardForm({ ...hazardForm, description: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setQuickHazardOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleQuickHazard}
              disabled={savingAction}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              {savingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log Hazard & Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QUICK LOG GEMBA WALK MODAL */}
      <Dialog open={quickGembaOpen} onOpenChange={setQuickGembaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-blue-600" />
              Log Management Walkthrough / GEMBA Walk
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Auditor / Manager Name</Label>
              <Input
                value={gembaForm.auditor}
                onChange={(e) => setGembaForm({ ...gembaForm, auditor: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Location Walked</Label>
              <Input
                value={gembaForm.location}
                onChange={(e) => setGembaForm({ ...gembaForm, location: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Walkthrough Findings / Notes</Label>
              <Textarea
                rows={3}
                value={gembaForm.notes}
                onChange={(e) => setGembaForm({ ...gembaForm, notes: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setQuickGembaOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleQuickGemba}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              Record GEMBA Walk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
