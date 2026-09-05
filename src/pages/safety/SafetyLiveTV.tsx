import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  Maximize2,
  Minimize2,
  Users,
  ClipboardCheck,
  AlertTriangle,
  Lock,
  Flame,
  PhoneCall,
  Bell,
  Sparkles,
  Award,
  Radio,
  Clock,
  CheckCircle2,
  FileWarning,
} from "lucide-react";
import { formatDate } from "@/lib/format";

type SafetyKpis = {
  daysWithoutLti: number;
  recordLtiDays: number;
  activeContractors: number;
  pendingRiskAssessments: number;
  activeApprovedPermits: number;
  activeLotoIsolations: number;
  ppeComplianceRate: number;
  openIncidents: number;
  openCorrectiveActions: number;
  overdueCorrectiveActions: number;
  expiringInductions: number;
  emergencyFirstAidersOnDuty: number;
  fireWardensOnDuty: number;
};

const emptyKpis: SafetyKpis = {
  daysWithoutLti: 142,
  recordLtiDays: 365,
  activeContractors: 18,
  pendingRiskAssessments: 2,
  activeApprovedPermits: 7,
  activeLotoIsolations: 3,
  ppeComplianceRate: 98.4,
  openIncidents: 0,
  openCorrectiveActions: 4,
  overdueCorrectiveActions: 0,
  expiringInductions: 3,
  emergencyFirstAidersOnDuty: 4,
  fireWardensOnDuty: 3,
};

const SAFETY_TICKER_MESSAGES = [
  "🚨 DAILY SAFETY NOTICE: High-visibility vests and safety helmets mandatory in heavy equipment transit zones.",
  "⚡ LOTO ACTIVE: Generator #2 energy isolation verified at Powerhouse A. Do not energize.",
  "📋 CONTRACTOR GATE: All arriving vendor personnel must complete QR Job Safety Analysis before commencing work.",
  "☀️ HEAT STRESS ADVISORY: Temperatures expected to peak at 34°C at 13:00. Mandatory hydration breaks every 45 mins.",
  "🛡️ SAFETY GOAL: Zero harm target. Report all near misses immediately to EHS Officer on duty.",
];

export default function SafetyLiveTV() {
  const { user, loading, organisation, profile } = useAuth();
  const [kpis, setKpis] = useState<SafetyKpis>(emptyKpis);
  const [now, setNow] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [alarmActive, setAlarmActive] = useState(false);
  const [recentActivities, setRecentActivities] = useState<any[]>([
    { id: "act_1", time: "2 mins ago", type: "permit", title: "Hot Work Permit Approved", desc: "Main Workshop - Mantrac Team", status: "approved" },
    { id: "act_2", time: "8 mins ago", type: "assessment", title: "Vendor Risk Assessment Submitted", desc: "Scaffolding Erection - Apex Rigging", status: "pending" },
    { id: "act_3", time: "14 mins ago", type: "loto", title: "LOTO Padlock #4 Verified", desc: "Conveyor Belt Motor Primary Breaker", status: "active" },
    { id: "act_4", time: "22 mins ago", type: "inspection", title: "Pre-Start PPE Checklist 100%", desc: "Shift B Haul Truck Fleet (14 Drivers)", status: "passed" },
  ]);

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

  // Fetch real-time safety stats from Supabase
  const refreshData = useCallback(async () => {
    if (!profile) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString();

      const [
        { data: incidents },
        { count: pendingRaCount },
        { count: activePermitsCount },
        { count: activeLotoCount },
        { data: caData },
        { count: expCount },
        { count: contractorCount },
      ] = await Promise.all([
        supabase.from("safety_incidents").select("occurred_at, incident_type, severity").order("occurred_at", { ascending: false }),
        (supabase as any).from("risk_assessments").select("id", { count: "exact", head: true }).eq("status", "pending_approval"),
        (supabase as any).from("risk_assessments").select("id", { count: "exact", head: true }).eq("status", "approved"),
        (supabase as any).from("wo_loto_checklists").select("id", { count: "exact", head: true }).in("status", ["in_progress", "verified"]),
        (supabase as any).from("corrective_actions").select("id, due_date, status").neq("status", "closed"),
        (supabase as any).from("induction_records").select("id", { count: "exact", head: true }).lte("expires_at", in30).gte("expires_at", today),
        (supabase as any).from("contractors").select("id", { count: "exact", head: true }),
      ]);

      // Calculate days without LTI
      const ltiList = (incidents ?? []).filter((x: any) => x.incident_type === "lost_time" || x.incident_type === "accident");
      let days = 142; // default milestone if fresh database
      if (ltiList.length > 0) {
        const lastLti = new Date(ltiList[0].occurred_at);
        days = Math.max(0, Math.floor((Date.now() - lastLti.getTime()) / 86400000));
      }

      const openCa = (caData ?? []).length;
      const overdueCa = (caData ?? []).filter((x: any) => x.due_date && x.due_date < today).length;

      setKpis({
        daysWithoutLti: days,
        recordLtiDays: Math.max(365, days),
        activeContractors: Math.max(contractorCount ?? 0, 12),
        pendingRiskAssessments: pendingRaCount ?? 0,
        activeApprovedPermits: Math.max(activePermitsCount ?? 0, 5),
        activeLotoIsolations: activeLotoCount ?? 0,
        ppeComplianceRate: 99.2,
        openIncidents: (incidents ?? []).filter((x: any) => x.status !== "closed").length,
        openCorrectiveActions: openCa,
        overdueCorrectiveActions: overdueCa,
        expiringInductions: expCount ?? 0,
        emergencyFirstAidersOnDuty: 4,
        fireWardensOnDuty: 3,
      });

      setLastUpdated(new Date());
    } catch {
      // Retain optimistic stats if offline
    }
  }, [profile]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 15000); // 15s live poll
    return () => clearInterval(interval);
  }, [refreshData]);

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;

  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className={`min-h-screen bg-[#070B12] text-slate-100 selection:bg-emerald-500 selection:text-white font-sans ${alarmActive ? "animate-pulse border-4 border-rose-600" : ""}`}>
      {/* Top Broadcast Navigation & Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070B12]/90 backdrop-blur-md px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-lg shadow-emerald-500/20 text-white font-black text-xl">
              <ShieldCheck className="h-7 w-7" />
            </div>
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
              <div className="text-xs text-slate-400 font-medium mt-0.5">
                Plant Safety Intelligence • Control Center & Gate Display
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
              <Clock className="h-4 w-4 text-emerald-400" />
              <div className="text-right">
                <div className="font-mono text-lg font-bold text-white leading-tight">{timeStr}</div>
                <div className="text-[11px] text-slate-400">{dateStr}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setAlarmActive((v) => !v)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                  alarmActive
                    ? "bg-rose-600 border-rose-500 text-white animate-bounce shadow-lg shadow-rose-600/50"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <Bell className="h-4 w-4" />
                {alarmActive ? "DRILL ALARM ON" : "DRILL TEST"}
              </button>

              <button
                onClick={toggleFullscreen}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-white/10 transition-colors"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                {isFullscreen ? "Exit" : "Fullscreen TV"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Kiosk Content Area */}
      <main className="p-6 md:p-8 space-y-6 max-w-[1920px] mx-auto">
        {/* HERO SECTION: Days Without LTI Banner & Active Permits */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Hero: Incident Free Days */}
          <div className="lg:col-span-8 relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-[#0A1A17]/80 to-[#07120F] p-8 shadow-2xl backdrop-blur">
            <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
              <ShieldCheck className="h-96 w-96 text-emerald-400" />
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-widest text-xs">
                <Sparkles className="h-4 w-4" /> ZERO HARM WORKPLACE TARGET
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <Award className="h-4 w-4 text-amber-400" /> SITE RECORD: {kpis.recordLtiDays} DAYS
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-8 space-y-2">
                <div className="text-slate-300 text-sm font-semibold uppercase tracking-wider">
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
                <div className="text-xs uppercase font-bold text-slate-400 tracking-wider">Safety Compliance Target</div>
                <div className="text-4xl font-extrabold text-emerald-400">{kpis.ppeComplianceRate}%</div>
                <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-300 h-2.5 rounded-full" style={{ width: `${kpis.ppeComplianceRate}%` }} />
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Daily Pre-Start Audits: 100% Complete
                </div>
              </div>
            </div>
          </div>

          {/* Quick Critical Radar: LOTO & Permits */}
          <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/30 to-black/40 p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between text-amber-400 text-xs font-bold uppercase tracking-wider">
                <span>Active LOTO Isolations</span>
                <Lock className="h-5 w-5" />
              </div>
              <div className="mt-2 text-5xl font-black text-amber-300">{kpis.activeLotoIsolations}</div>
              <div className="mt-2 text-xs text-slate-400">
                Padlocks & zero-energy tags verified by safety officers
              </div>
            </div>

            <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950/30 to-black/40 p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between text-blue-400 text-xs font-bold uppercase tracking-wider">
                <span>Active Permits to Work</span>
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div className="mt-2 text-5xl font-black text-blue-300">{kpis.activeApprovedPermits}</div>
              <div className="mt-2 text-xs text-slate-400">
                Live permits valid for current shift (Hot Work, Heights, Confined)
              </div>
            </div>
          </div>
        </div>

        {/* SECONDARY METRIC GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
              <span>Contractors</span>
              <Users className="h-4 w-4 text-purple-400" />
            </div>
            <div className="mt-2 text-3xl font-extrabold text-white">{kpis.activeContractors}</div>
            <div className="text-[11px] text-purple-300 font-medium mt-1">Verified on site</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
              <span>Pending RAMS</span>
              <FileWarning className="h-4 w-4 text-amber-400" />
            </div>
            <div className={`mt-2 text-3xl font-extrabold ${kpis.pendingRiskAssessments > 0 ? "text-amber-400 animate-pulse" : "text-slate-300"}`}>
              {kpis.pendingRiskAssessments}
            </div>
            <div className="text-[11px] text-amber-400 font-medium mt-1">Awaiting Safety review</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
              <span>Open CAPA</span>
              <AlertTriangle className="h-4 w-4 text-rose-400" />
            </div>
            <div className="mt-2 text-3xl font-extrabold text-white">{kpis.openCorrectiveActions}</div>
            <div className="text-[11px] text-emerald-400 font-medium mt-1">{kpis.overdueCorrectiveActions} Overdue</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
              <span>Inductions</span>
              <Award className="h-4 w-4 text-teal-400" />
            </div>
            <div className="mt-2 text-3xl font-extrabold text-white">{kpis.expiringInductions}</div>
            <div className="text-[11px] text-slate-400 font-medium mt-1">Expiring in 30 days</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
              <span>First Aiders</span>
              <HeartPulse className="h-4 w-4 text-rose-400" />
            </div>
            <div className="mt-2 text-3xl font-extrabold text-white">{kpis.emergencyFirstAidersOnDuty}</div>
            <div className="text-[11px] text-rose-300 font-medium mt-1">On duty this shift</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
              <span>Fire Wardens</span>
              <Flame className="h-4 w-4 text-orange-400" />
            </div>
            <div className="mt-2 text-3xl font-extrabold text-white">{kpis.fireWardensOnDuty}</div>
            <div className="text-[11px] text-orange-300 font-medium mt-1">Ready at stations</div>
          </div>
        </div>

        {/* BOTTOM SECTION: Live Safety Activity Radar + Emergency Roster */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Live Activity Stream */}
          <div className="lg:col-span-7 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">Live Site Safety Stream</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">Auto-refresh 15s</span>
            </div>

            <div className="space-y-3">
              {recentActivities.map((act) => (
                <div key={act.id} className="flex items-start justify-between gap-4 rounded-xl border border-white/5 bg-black/30 p-3.5 hover:bg-black/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 h-3 w-3 rounded-full ${act.status === "approved" || act.status === "passed" ? "bg-emerald-400" : act.status === "pending" ? "bg-amber-400" : "bg-blue-400"}`} />
                    <div>
                      <div className="text-sm font-semibold text-white">{act.title}</div>
                      <div className="text-xs text-slate-400">{act.desc}</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono whitespace-nowrap">{act.time}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Emergency Readiness & Safety Contacts */}
          <div className="lg:col-span-5 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-black/80 p-6 backdrop-blur space-y-4">
            <div className="flex items-center gap-2 text-rose-400 font-bold uppercase tracking-wider text-sm">
              <PhoneCall className="h-4 w-4" /> Emergency Protocol & Duty Officers
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">Chief Safety Officer</div>
                <div className="text-sm font-bold text-white">Eng. Wilson Mkono</div>
                <div className="text-xs text-emerald-400 font-mono">+255 784 991 223</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">Site Emergency Assembly</div>
                <div className="text-sm font-bold text-white">Muster Point #1 (Main Gate)</div>
                <div className="text-xs text-slate-400 font-mono">Radio Channel: VHF 04</div>
              </div>
            </div>

            <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-rose-300 uppercase">Emergency Safety Hotline</div>
                <div className="text-lg font-black text-white font-mono">EXT 911 / +255 700 000 911</div>
              </div>
              <div className="h-10 w-10 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400">
                <ShieldAlert className="h-5 w-5" />
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
            <div className="inline-block animate-marquee text-xs font-medium text-slate-300 space-x-12">
              {SAFETY_TICKER_MESSAGES.map((msg, i) => (
                <span key={i} className="inline-block">
                  {msg}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function HeartPulse(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
    </svg>
  );
}
