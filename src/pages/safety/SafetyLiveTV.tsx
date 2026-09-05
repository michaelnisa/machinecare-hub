import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { PageLoader } from "@/components/PageLoader";
import {
  ShieldCheck,
  Activity,
  Maximize2,
  Minimize2,
  Users,
  ClipboardCheck,
  Flame,
  PhoneCall,
  Sparkles,
  Award,
  Radio,
  Clock,
  CheckCircle2,
  FileWarning,
  Settings2,
  Edit3,
  Save,
  UserCheck,
  Heart,
  Plus,
  Trash2,
} from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type SafetyKpis = {
  daysWithoutLti: number;
  recordLtiDays: number;
  activeContractors: number;
  pendingRiskAssessments: number;
  activeApprovedPermits: number;
  ppeComplianceRate: number;
  openIncidents: number;
  expiringInductions: number;
  emergencyFirstAidersOnDuty: number;
  fireWardensOnDuty: number;
};

export type DutyRoster = {
  chiefSafetyOfficer: { name: string; phone: string };
  firstAidOfficer: { name: string; phone: string };
  safetyOfficerOnDuty: { name: string; phone: string };
};

export type SafetyTvFeedConfig = {
  roster: DutyRoster;
  bulletinNotices?: string[];
  recordLtiDays?: number | null;
  complianceTargetRate?: number | null;
  baselineLtiDays?: number | null;
};

const initialKpis: SafetyKpis = {
  daysWithoutLti: 0,
  recordLtiDays: 0,
  activeContractors: 0,
  pendingRiskAssessments: 0,
  activeApprovedPermits: 0,
  ppeComplianceRate: 100,
  openIncidents: 0,
  expiringInductions: 0,
  emergencyFirstAidersOnDuty: 0,
  fireWardensOnDuty: 0,
};

const defaultRoster: DutyRoster = {
  chiefSafetyOfficer: { name: "", phone: "" },
  firstAidOfficer: { name: "", phone: "" },
  safetyOfficerOnDuty: { name: "", phone: "" },
};

export default function SafetyLiveTV() {
  const { user, loading, organisation, profile } = useAuth();
  const { isManager, isOwner } = useUserRole();
  const canManageFeed = isManager || isOwner || profile?.department === "safety";

  const [kpis, setKpis] = useState<SafetyKpis>(initialKpis);
  const [roster, setRoster] = useState<DutyRoster>(defaultRoster);
  const [feedConfig, setFeedConfig] = useState<SafetyTvFeedConfig | null>(null);
  const [bulletinMessages, setBulletinMessages] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; full_name: string; phone: string | null; department: string | null }>>([]);

  const [feedModalOpen, setFeedModalOpen] = useState(false);
  const [savingFeed, setSavingFeed] = useState(false);

  // Form state for the feed configuration modal
  const [formRoster, setFormRoster] = useState<DutyRoster>(defaultRoster);
  const [formRecordDays, setFormRecordDays] = useState<string>("");
  const [formBaselineDays, setFormBaselineDays] = useState<string>("");
  const [formComplianceRate, setFormComplianceRate] = useState<string>("");
  const [formBulletins, setFormBulletins] = useState<string>("");

  const [now, setNow] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const orgId = organisation?.id || profile?.organisation_id;
  const storageKey = orgId ? `machinecare_safety_live_feed_${orgId}` : null;

  // Real-time Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Screen Wake Lock — Keep Safety TV display awake indefinitely
  const wakeLockRef = useRef<any>(null);
  useEffect(() => {
    const request = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        }
      } catch {
        // wake lock unsupported or denied
      }
    };
    request();
    const onVis = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      try {
        wakeLockRef.current?.release?.();
      } catch {
        // ignore
      }
    };
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Load feed configuration from Supabase and/or localStorage
  const loadFeedConfig = useCallback(async () => {
    if (!orgId) return;

    let loaded: SafetyTvFeedConfig | null = null;

    // 1. Try local cache first for instant render
    if (storageKey) {
      try {
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          loaded = JSON.parse(cached);
        }
      } catch {
        // ignore JSON parse error
      }
    }

    // 2. Fetch from Supabase safety_rules table
    try {
      const { data } = await (supabase as any)
        .from("safety_rules")
        .select("match_value")
        .eq("organisation_id", orgId)
        .eq("name", "SAFETY_LIVE_TV_FEED")
        .maybeSingle();

      if (data?.match_value) {
        const parsed = JSON.parse(data.match_value);
        loaded = parsed;
        if (storageKey) {
          localStorage.setItem(storageKey, data.match_value);
        }
      }
    } catch {
      // ignore
    }

    if (loaded) {
      setFeedConfig(loaded);
      if (loaded.roster) {
        setRoster(loaded.roster);
      }
      if (loaded.bulletinNotices && loaded.bulletinNotices.length > 0) {
        setBulletinMessages(loaded.bulletinNotices);
      }
    }
  }, [orgId, storageKey]);

  // Fetch real-time safety stats strictly scoped to this account
  const refreshData = useCallback(async () => {
    if (!orgId) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString();

      const [
        { data: incidents },
        { count: pendingRaCount },
        { count: approvedRaCount },
        { count: approvedPtwCount },
        { count: expCount },
        { count: contractorCount },
        { count: contractorWorkersCount },
        { data: competencies },
        { data: inspections },
        { data: profiles },
      ] = await Promise.all([
        supabase
          .from("safety_incidents")
          .select("occurred_at, incident_type, severity, status, lost_time_hours")
          .eq("organisation_id", orgId)
          .order("occurred_at", { ascending: false }),
        (supabase as any)
          .from("risk_assessments")
          .select("id", { count: "exact", head: true })
          .eq("organisation_id", orgId)
          .eq("status", "pending_approval"),
        (supabase as any)
          .from("risk_assessments")
          .select("id", { count: "exact", head: true })
          .eq("organisation_id", orgId)
          .eq("status", "approved"),
        (supabase as any)
          .from("wo_safety_approvals")
          .select("id", { count: "exact", head: true })
          .eq("organisation_id", orgId)
          .eq("status", "approved"),
        (supabase as any)
          .from("induction_records")
          .select("id", { count: "exact", head: true })
          .eq("organisation_id", orgId)
          .lte("expires_at", in30)
          .gte("expires_at", today),
        (supabase as any)
          .from("contractors")
          .select("id", { count: "exact", head: true })
          .eq("organisation_id", orgId)
          .eq("status", "active"),
        (supabase as any)
          .from("contractor_workers")
          .select("id", { count: "exact", head: true })
          .eq("organisation_id", orgId)
          .eq("is_active", true),
        (supabase as any)
          .from("employee_competencies")
          .select("competency_name, status, expiry_date")
          .eq("organisation_id", orgId)
          .neq("status", "revoked"),
        (supabase as any)
          .from("safety_inspections")
          .select("overall_result, inspected_at")
          .eq("organisation_id", orgId)
          .order("inspected_at", { ascending: false })
          .limit(20),
        supabase
          .from("profiles")
          .select("id, full_name, phone, department")
          .eq("organisation_id", orgId)
          .order("full_name"),
      ]);

      if (profiles) {
        setTeamMembers(
          profiles.map((p) => ({
            id: p.id,
            full_name: p.full_name || "Staff Member",
            phone: p.phone,
            department: p.department,
          }))
        );
      }

      // Calculate real continuous days without LTI
      const ltiList = (incidents ?? []).filter(
        (x: any) =>
          x.incident_type === "lost_time" ||
          x.incident_type === "accident" ||
          Number(x.lost_time_hours || 0) > 0
      );

      let daysWithoutLti = 0;
      if (ltiList.length > 0) {
        const lastLti = new Date(ltiList[0].occurred_at);
        daysWithoutLti = Math.max(0, Math.floor((Date.now() - lastLti.getTime()) / 86400000));
      } else if (feedConfig?.baselineLtiDays != null && feedConfig.baselineLtiDays > 0) {
        daysWithoutLti = feedConfig.baselineLtiDays;
      } else if (organisation?.created_at) {
        const created = new Date(organisation.created_at);
        daysWithoutLti = Math.max(0, Math.floor((Date.now() - created.getTime()) / 86400000));
      }

      // Real Site Record LTI Days (from feed benchmark or current continuous run)
      const fedRecord = feedConfig?.recordLtiDays;
      const recordLtiDays = fedRecord ? Math.max(fedRecord, daysWithoutLti) : Math.max(daysWithoutLti, 0);

      // Real Active Permits count (approved RAMS + approved PTW)
      const activeApprovedPermits = (approvedRaCount ?? 0) + (approvedPtwCount ?? 0);

      // Real Active Contractor Personnel on site
      const activeContractors = (contractorWorkersCount ?? 0) > 0
        ? (contractorWorkersCount ?? 0)
        : (contractorCount ?? 0);

      // Real Emergency Certified Personnel from employee competencies
      const validCompetencies = (competencies ?? []).filter((c: any) => {
        if (c.expiry_date && c.expiry_date < today) return false;
        return true;
      });

      const firstAidersCount = validCompetencies.filter((c: any) =>
        c.competency_name?.toLowerCase().includes("first aid")
      ).length;

      const fireWardensCount = validCompetencies.filter((c: any) =>
        c.competency_name?.toLowerCase().includes("fire")
      ).length;

      // Real PPE & Inspection compliance percentage
      let complianceRate = feedConfig?.complianceTargetRate ?? 100;
      if (inspections && inspections.length > 0) {
        const passed = inspections.filter(
          (i: any) => i.overall_result === "pass" || i.overall_result === "passed"
        ).length;
        complianceRate = Math.round((passed / inspections.length) * 1000) / 10;
      }

      // Auto-suggest duty roster if not configured yet from safety department profiles
      if (!feedConfig?.roster?.chiefSafetyOfficer?.name) {
        const safetyProfiles = (profiles ?? []).filter(
          (p) => p.department?.toLowerCase() === "safety" || p.department?.toLowerCase().includes("ehs")
        );
        if (safetyProfiles.length > 0) {
          setRoster((prev) => ({
            chiefSafetyOfficer: prev.chiefSafetyOfficer.name
              ? prev.chiefSafetyOfficer
              : { name: safetyProfiles[0].full_name || "Safety Lead", phone: safetyProfiles[0].phone || organisation?.phone || "" },
            firstAidOfficer: prev.firstAidOfficer.name
              ? prev.firstAidOfficer
              : { name: safetyProfiles[1]?.full_name || "", phone: safetyProfiles[1]?.phone || "" },
            safetyOfficerOnDuty: prev.safetyOfficerOnDuty.name
              ? prev.safetyOfficerOnDuty
              : { name: safetyProfiles[2]?.full_name || safetyProfiles[0].full_name || "", phone: safetyProfiles[2]?.phone || safetyProfiles[0].phone || "" },
          }));
        }
      }

      setKpis({
        daysWithoutLti,
        recordLtiDays,
        activeContractors,
        pendingRiskAssessments: pendingRaCount ?? 0,
        activeApprovedPermits,
        ppeComplianceRate: complianceRate,
        openIncidents: (incidents ?? []).filter((x: any) => x.status !== "closed").length,
        expiringInductions: expCount ?? 0,
        emergencyFirstAidersOnDuty: firstAidersCount,
        fireWardensOnDuty: fireWardensCount,
      });

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to load real safety data:", err);
    }
  }, [orgId, feedConfig, organisation?.created_at, organisation?.phone]);

  // Initial load
  useEffect(() => {
    loadFeedConfig();
  }, [loadFeedConfig]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 15000); // 15s live poll
    return () => clearInterval(interval);
  }, [refreshData]);

  // Real-time Supabase Broadcast Channel for multi-screen sync
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase.channel(`safety-live-tv:${orgId}`);
    channel
      .on("broadcast", { event: "feed_updated" }, (payload) => {
        if (payload?.payload) {
          setFeedConfig(payload.payload);
          if (payload.payload.roster) setRoster(payload.payload.roster);
          if (payload.payload.bulletinNotices) setBulletinMessages(payload.payload.bulletinNotices);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "safety_incidents", filter: `organisation_id=eq.${orgId}` }, () => refreshData())
      .on("postgres_changes", { event: "*", schema: "public", table: "risk_assessments", filter: `organisation_id=eq.${orgId}` }, () => refreshData())
      .on("postgres_changes", { event: "*", schema: "public", table: "safety_inspections", filter: `organisation_id=eq.${orgId}` }, () => refreshData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, refreshData]);

  // Open feed configuration modal and populate initial values
  const openFeedModal = () => {
    setFormRoster({
      chiefSafetyOfficer: {
        name: roster.chiefSafetyOfficer.name || "",
        phone: roster.chiefSafetyOfficer.phone || "",
      },
      firstAidOfficer: {
        name: roster.firstAidOfficer.name || "",
        phone: roster.firstAidOfficer.phone || "",
      },
      safetyOfficerOnDuty: {
        name: roster.safetyOfficerOnDuty.name || "",
        phone: roster.safetyOfficerOnDuty.phone || "",
      },
    });
    setFormRecordDays(feedConfig?.recordLtiDays ? String(feedConfig.recordLtiDays) : "");
    setFormBaselineDays(feedConfig?.baselineLtiDays ? String(feedConfig.baselineLtiDays) : "");
    setFormComplianceRate(feedConfig?.complianceTargetRate ? String(feedConfig.complianceTargetRate) : "");
    setFormBulletins(
      bulletinMessages.length > 0
        ? bulletinMessages.join("\n")
        : ""
    );
    setFeedModalOpen(true);
  };

  // Save feed configuration to Supabase & localStorage, then broadcast
  const saveFeedConfiguration = async () => {
    if (!orgId) return;
    setSavingFeed(true);
    try {
      const parsedBulletins = formBulletins
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const newConfig: SafetyTvFeedConfig = {
        roster: formRoster,
        bulletinNotices: parsedBulletins.length > 0 ? parsedBulletins : undefined,
        recordLtiDays: formRecordDays ? parseInt(formRecordDays, 10) || null : null,
        baselineLtiDays: formBaselineDays ? parseInt(formBaselineDays, 10) || null : null,
        complianceTargetRate: formComplianceRate ? parseFloat(formComplianceRate) || null : null,
      };

      const payload = JSON.stringify(newConfig);

      // 1. Save to local storage for instant access
      if (storageKey) {
        localStorage.setItem(storageKey, payload);
      }

      // 2. Persist to Supabase safety_rules table
      const { data: existing } = await (supabase as any)
        .from("safety_rules")
        .select("id")
        .eq("organisation_id", orgId)
        .eq("name", "SAFETY_LIVE_TV_FEED")
        .maybeSingle();

      if (existing?.id) {
        await (supabase as any)
          .from("safety_rules")
          .update({
            match_value: payload,
            is_active: true,
            match_field: "live_config",
          })
          .eq("id", existing.id);
      } else {
        await (supabase as any)
          .from("safety_rules")
          .insert({
            organisation_id: orgId,
            name: "SAFETY_LIVE_TV_FEED",
            match_field: "live_config",
            match_value: payload,
            is_active: true,
            required_ppe: [],
          });
      }

      // 3. Broadcast to all other open Live TV kiosks in real time
      const channel = supabase.channel(`safety-live-tv:${orgId}`);
      channel.send({
        type: "broadcast",
        event: "feed_updated",
        payload: newConfig,
      });

      // 4. Update current state
      setFeedConfig(newConfig);
      setRoster(newConfig.roster);
      if (parsedBulletins.length > 0) {
        setBulletinMessages(parsedBulletins);
      }

      toast.success("Safety Live TV feed & duty roster updated");
      setFeedModalOpen(false);
      refreshData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save feed configuration");
    } finally {
      setSavingFeed(false);
    }
  };

  // Dynamic live ticker messages (uses feeded bulletins or real account data)
  const activeBulletins = useMemo(() => {
    if (bulletinMessages.length > 0) return bulletinMessages;
    return [
      `🚨 ZERO HARM: ${organisation?.name ?? "Workplace"} operating incident-free today (${kpis.daysWithoutLti} days without LTI).`,
      `📋 PERMITS TO WORK: ${kpis.activeApprovedPermits} active authorized permits on site today.`,
      `👷 CONTRACTORS: ${kpis.activeContractors} contractor personnel verified and active on site.`,
      `🛡️ DUTY ROSTER: Chief Safety: ${roster.chiefSafetyOfficer.name || "EHS Dept"} (${roster.chiefSafetyOfficer.phone || "On duty"}) | Officer on Duty: ${roster.safetyOfficerOnDuty.name || "Safety Desk"} (${roster.safetyOfficerOnDuty.phone || "Radio ch 1"}).`,
      `⚠️ HAZARD ALERT: Report all near misses, hazards and unisolated machinery immediately via MachineCare Hub.`,
    ];
  }, [bulletinMessages, organisation?.name, kpis, roster]);

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;

  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen w-full bg-[#0a0e1a] bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.15),transparent_50%),radial-gradient(ellipse_at_bottom,rgba(168,85,247,0.12),transparent_50%)] text-white font-sans">
      {/* Top Broadcast Navigation & Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0e1a]/90 backdrop-blur-md px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {organisation?.logo_url ? (
              <img
                src={organisation.logo_url}
                alt={organisation.name || "Company Logo"}
                className="h-12 w-12 rounded-2xl object-contain bg-white/10 p-1.5 border border-white/20 shadow-lg"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 border border-emerald-500/30 shadow-lg shadow-emerald-500/20 text-white font-black text-xl">
                {organisation?.name?.charAt(0) || <ShieldCheck className="h-7 w-7" />}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-wider text-white uppercase">
                  {organisation?.name ?? "MachineCare"}
                </span>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  SAFETY CARE LIVE TV
                </span>
              </div>
              <div className="text-xs text-white/60 font-medium mt-0.5">
                Plant Safety Intelligence • Control Center & Gate Display
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
              <Clock className="h-4 w-4 text-emerald-400" />
              <div className="text-right">
                <div className="font-mono text-lg font-bold text-white leading-tight">{timeStr}</div>
                <div className="text-[11px] text-white/50">{dateStr}</div>
              </div>
            </div>

            {canManageFeed && (
              <button
                onClick={openFeedModal}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition-colors shadow-sm"
              >
                <Edit3 className="h-4 w-4" />
                <span>Feed Data & Roster</span>
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-white/10 transition-colors"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {isFullscreen ? "Exit" : "Fullscreen TV"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Kiosk Content Area */}
      <main className="p-6 md:p-8 space-y-6 max-w-[1920px] mx-auto">
        {/* HERO SECTION: Days Without LTI Banner & Active Permits */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Hero: Incident Free Days */}
          <div className="lg:col-span-8 relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 shadow-2xl backdrop-blur">
            <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
              <ShieldCheck className="h-96 w-96 text-emerald-400" />
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-widest text-xs">
                <Sparkles className="h-4 w-4" /> ZERO HARM WORKPLACE TARGET
              </div>
              <div className="flex items-center gap-2 text-xs text-white/60 font-mono">
                <Award className="h-4 w-4 text-amber-400" /> SITE RECORD: {kpis.recordLtiDays} DAYS
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-8 space-y-2">
                <div className="text-white/70 text-sm font-semibold uppercase tracking-wider">
                  Continuous Operation Without Lost Time Injury (LTI)
                </div>
                <div className="text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-white">
                  {kpis.daysWithoutLti}
                </div>
                <div className="text-base text-emerald-400 font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  All production lines and workshop cells operating incident-free today
                </div>
              </div>

              <div className="md:col-span-4 bg-black/40 border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="text-xs uppercase font-bold text-white/60 tracking-wider">Safety Compliance Target</div>
                <div className="text-4xl font-extrabold text-emerald-400">{kpis.ppeComplianceRate}%</div>
                <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-300 h-2.5 rounded-full" style={{ width: `${Math.min(100, Math.max(0, kpis.ppeComplianceRate))}%` }} />
                </div>
                <div className="text-[11px] text-white/60 font-mono">
                  {kpis.openIncidents === 0 ? "Zero Open High-Risk Incidents" : `${kpis.openIncidents} Active Incidents Under Review`}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Critical Radar: Active Permits & Workforce */}
          <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 shadow-2xl backdrop-blur relative overflow-hidden">
              <div className="flex items-center justify-between text-blue-400 text-xs font-bold uppercase tracking-wider">
                <span>Active Permits to Work</span>
                <ClipboardCheck className="h-5 w-5 text-blue-400" />
              </div>
              <div className="mt-2 text-5xl font-black text-blue-300">{kpis.activeApprovedPermits}</div>
              <div className="mt-2 text-xs text-white/60">
                Live authorized permits for current shift (Hot Work, Heights, Confined Space)
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 shadow-2xl backdrop-blur relative overflow-hidden">
              <div className="flex items-center justify-between text-purple-400 text-xs font-bold uppercase tracking-wider">
                <span>Verified Site Contractors</span>
                <Users className="h-5 w-5 text-purple-400" />
              </div>
              <div className="mt-2 text-5xl font-black text-purple-300">{kpis.activeContractors}</div>
              <div className="mt-2 text-xs text-white/60">
                Badge scanned & inducted personnel across workshops and plant gates
              </div>
            </div>
          </div>
        </div>

        {/* SECONDARY METRIC GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between text-white/60 text-xs font-bold uppercase">
              <span>Contractors</span>
              <Users className="h-4 w-4 text-purple-400" />
            </div>
            <div className="mt-2 text-3xl font-extrabold text-white">{kpis.activeContractors}</div>
            <div className="text-[11px] text-purple-300 font-medium mt-1">Verified on site</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between text-white/60 text-xs font-bold uppercase">
              <span>Pending RAMS</span>
              <FileWarning className="h-4 w-4 text-amber-400" />
            </div>
            <div className={`mt-2 text-3xl font-extrabold ${kpis.pendingRiskAssessments > 0 ? "text-amber-400 animate-pulse" : "text-white"}`}>
              {kpis.pendingRiskAssessments}
            </div>
            <div className="text-[11px] text-amber-400 font-medium mt-1">Awaiting Safety review</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between text-white/60 text-xs font-bold uppercase">
              <span>Inductions</span>
              <Award className="h-4 w-4 text-teal-400" />
            </div>
            <div className="mt-2 text-3xl font-extrabold text-white">{kpis.expiringInductions}</div>
            <div className="text-[11px] text-white/60 font-medium mt-1">Expiring in 30 days</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between text-white/60 text-xs font-bold uppercase">
              <span>First Aiders</span>
              <Heart className="h-4 w-4 text-rose-400" />
            </div>
            <div className="mt-2 text-3xl font-extrabold text-white">{kpis.emergencyFirstAidersOnDuty}</div>
            <div className="text-[11px] text-rose-300 font-medium mt-1">Active certified on duty</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between text-white/60 text-xs font-bold uppercase">
              <span>Fire Wardens</span>
              <Flame className="h-4 w-4 text-orange-400" />
            </div>
            <div className="mt-2 text-3xl font-extrabold text-white">{kpis.fireWardensOnDuty}</div>
            <div className="text-[11px] text-orange-300 font-medium mt-1">Ready at stations</div>
          </div>
        </div>

        {/* EMERGENCY READINESS & SAFETY ROSTER */}
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 shadow-2xl backdrop-blur space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wider text-sm">
              <PhoneCall className="h-4 w-4 text-emerald-400" /> Emergency Duty Roster & Safety Contacts
            </div>
            {canManageFeed && (
              <button
                onClick={openFeedModal}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <Edit3 className="h-3.5 w-3.5" /> Edit Roster
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-white/60 tracking-wider">Chief Safety Officer</div>
              <div className="text-base font-bold text-white">
                {roster.chiefSafetyOfficer.name || <span className="text-white/40 italic font-normal">Unassigned • Click to configure</span>}
              </div>
              <div className="text-sm text-emerald-400 font-mono font-bold flex items-center gap-1.5">
                <PhoneCall className="h-3.5 w-3.5" />
                {roster.chiefSafetyOfficer.phone || <span className="text-white/40 font-normal">No phone registered</span>}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-white/60 tracking-wider">First Aid Officer</div>
              <div className="text-base font-bold text-white">
                {roster.firstAidOfficer.name || <span className="text-white/40 italic font-normal">Unassigned • Click to configure</span>}
              </div>
              <div className="text-sm text-emerald-400 font-mono font-bold flex items-center gap-1.5">
                <PhoneCall className="h-3.5 w-3.5" />
                {roster.firstAidOfficer.phone || <span className="text-white/40 font-normal">No phone registered</span>}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-white/60 tracking-wider">Safety Officer on Duty</div>
              <div className="text-base font-bold text-white">
                {roster.safetyOfficerOnDuty.name || <span className="text-white/40 italic font-normal">Unassigned • Click to configure</span>}
              </div>
              <div className="text-sm text-emerald-400 font-mono font-bold flex items-center gap-1.5">
                <PhoneCall className="h-3.5 w-3.5" />
                {roster.safetyOfficerOnDuty.phone || <span className="text-white/40 font-normal">No phone registered</span>}
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM REAL-TIME ROLLING TICKER */}
        <div className="rounded-2xl border border-white/10 bg-black/60 px-6 py-3.5 overflow-hidden flex items-center gap-4">
          <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-lg text-xs font-black uppercase whitespace-nowrap">
            <Radio className="h-3.5 w-3.5 animate-pulse" /> LIVE BULLETIN
          </div>
          <div className="overflow-hidden whitespace-nowrap w-full">
            <div className="inline-block animate-marquee text-xs font-medium text-white/80 space-x-12">
              {activeBulletins.map((msg, i) => (
                <span key={i} className="inline-block">
                  {msg}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* MODAL: Feed Live TV Data & Duty Roster */}
      <Dialog open={feedModalOpen} onOpenChange={setFeedModalOpen}>
        <DialogContent className="max-w-2xl bg-[#0f172a] border border-white/10 text-white shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-emerald-400" /> Configure Safety Live TV & Duty Roster
            </DialogTitle>
            <div className="text-xs text-slate-400">
              Update real-time duty roster contacts, custom site benchmarks, and daily safety ticker notices.
            </div>
          </DialogHeader>

          <div className="space-y-6 py-3 max-h-[70vh] overflow-y-auto pr-2">
            {/* EMERGENCY DUTY ROSTER PERSONNEL */}
            <div className="space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <UserCheck className="h-4 w-4" /> Emergency Duty Roster Personnel
              </div>

              {/* Chief Safety Officer */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">1. Chief Safety Officer</span>
                  {teamMembers.length > 0 && (
                    <select
                      className="text-xs bg-slate-900 border border-white/10 rounded-md px-2 py-1 text-slate-300 focus:outline-none focus:border-emerald-500"
                      onChange={(e) => {
                        const m = teamMembers.find((x) => x.id === e.target.value);
                        if (m) {
                          setFormRoster((prev) => ({
                            ...prev,
                            chiefSafetyOfficer: { name: m.full_name, phone: m.phone || prev.chiefSafetyOfficer.phone },
                          }));
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Select from team...</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name} {m.department ? `(${m.department})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-slate-400">Officer Name</Label>
                    <Input
                      placeholder="e.g. Eng. Wilson Mkono"
                      value={formRoster.chiefSafetyOfficer.name}
                      onChange={(e) =>
                        setFormRoster((prev) => ({
                          ...prev,
                          chiefSafetyOfficer: { ...prev.chiefSafetyOfficer, name: e.target.value },
                        }))
                      }
                      className="bg-slate-900 border-white/10 text-white h-9 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-400">Emergency Phone Number</Label>
                    <Input
                      placeholder="e.g. +255 784 991 223"
                      value={formRoster.chiefSafetyOfficer.phone}
                      onChange={(e) =>
                        setFormRoster((prev) => ({
                          ...prev,
                          chiefSafetyOfficer: { ...prev.chiefSafetyOfficer, phone: e.target.value },
                        }))
                      }
                      className="bg-slate-900 border-white/10 text-white h-9 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* First Aid Officer */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">2. First Aid Officer</span>
                  {teamMembers.length > 0 && (
                    <select
                      className="text-xs bg-slate-900 border border-white/10 rounded-md px-2 py-1 text-slate-300 focus:outline-none focus:border-emerald-500"
                      onChange={(e) => {
                        const m = teamMembers.find((x) => x.id === e.target.value);
                        if (m) {
                          setFormRoster((prev) => ({
                            ...prev,
                            firstAidOfficer: { name: m.full_name, phone: m.phone || prev.firstAidOfficer.phone },
                          }));
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Select from team...</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name} {m.department ? `(${m.department})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-slate-400">Officer Name</Label>
                    <Input
                      placeholder="e.g. Sarah K. Kimaro"
                      value={formRoster.firstAidOfficer.name}
                      onChange={(e) =>
                        setFormRoster((prev) => ({
                          ...prev,
                          firstAidOfficer: { ...prev.firstAidOfficer, name: e.target.value },
                        }))
                      }
                      className="bg-slate-900 border-white/10 text-white h-9 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-400">Emergency Phone Number</Label>
                    <Input
                      placeholder="e.g. +255 754 312 889"
                      value={formRoster.firstAidOfficer.phone}
                      onChange={(e) =>
                        setFormRoster((prev) => ({
                          ...prev,
                          firstAidOfficer: { ...prev.firstAidOfficer, phone: e.target.value },
                        }))
                      }
                      className="bg-slate-900 border-white/10 text-white h-9 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Safety Officer on Duty */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">3. Safety Officer on Duty</span>
                  {teamMembers.length > 0 && (
                    <select
                      className="text-xs bg-slate-900 border border-white/10 rounded-md px-2 py-1 text-slate-300 focus:outline-none focus:border-emerald-500"
                      onChange={(e) => {
                        const m = teamMembers.find((x) => x.id === e.target.value);
                        if (m) {
                          setFormRoster((prev) => ({
                            ...prev,
                            safetyOfficerOnDuty: { name: m.full_name, phone: m.phone || prev.safetyOfficerOnDuty.phone },
                          }));
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Select from team...</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name} {m.department ? `(${m.department})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-slate-400">Officer Name</Label>
                    <Input
                      placeholder="e.g. Juma R. Mushi"
                      value={formRoster.safetyOfficerOnDuty.name}
                      onChange={(e) =>
                        setFormRoster((prev) => ({
                          ...prev,
                          safetyOfficerOnDuty: { ...prev.safetyOfficerOnDuty, name: e.target.value },
                        }))
                      }
                      className="bg-slate-900 border-white/10 text-white h-9 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-400">Emergency Phone Number</Label>
                    <Input
                      placeholder="e.g. +255 713 445 670"
                      value={formRoster.safetyOfficerOnDuty.phone}
                      onChange={(e) =>
                        setFormRoster((prev) => ({
                          ...prev,
                          safetyOfficerOnDuty: { ...prev.safetyOfficerOnDuty, phone: e.target.value },
                        }))
                      }
                      className="bg-slate-900 border-white/10 text-white h-9 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* CUSTOM BENCHMARKS & TARGETS */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <Award className="h-4 w-4" /> Custom Site Benchmarks & Targets (Optional)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-[11px] text-slate-400">All-Time Site Record (Days)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 365"
                    value={formRecordDays}
                    onChange={(e) => setFormRecordDays(e.target.value)}
                    className="bg-slate-900 border-white/10 text-white h-9 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-400">Baseline Days Without LTI</Label>
                  <Input
                    type="number"
                    placeholder="Auto-calculated if blank"
                    value={formBaselineDays}
                    onChange={(e) => setFormBaselineDays(e.target.value)}
                    className="bg-slate-900 border-white/10 text-white h-9 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-400">Target Compliance (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="100.0"
                    value={formComplianceRate}
                    onChange={(e) => setFormComplianceRate(e.target.value)}
                    className="bg-slate-900 border-white/10 text-white h-9 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* LIVE ROLLING TICKER BULLETINS */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <Radio className="h-4 w-4" /> Live Bulletin Announcements (One notice per line)
              </div>
              <Textarea
                rows={4}
                placeholder="Enter custom daily safety notices (one per line)... If blank, dynamic live metrics will scroll."
                value={formBulletins}
                onChange={(e) => setFormBulletins(e.target.value)}
                className="bg-slate-900 border-white/10 text-white text-xs font-sans leading-relaxed"
              />
              <div className="text-[11px] text-slate-400">
                Leave empty to automatically display live status bulletins (incident-free count, contractor counts, emergency contacts).
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-white/10 pt-4 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setFeedModalOpen(false)}
              className="border-white/10 text-slate-300 hover:bg-white/10 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={saveFeedConfiguration}
              disabled={savingFeed}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5"
            >
              <Save className="h-4 w-4" />
              {savingFeed ? "Saving..." : "Save & Broadcast to TV"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
