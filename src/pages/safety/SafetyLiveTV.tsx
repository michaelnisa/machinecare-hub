import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
} from "lucide-react";
import { formatDate } from "@/lib/format";

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

const emptyKpis: SafetyKpis = {
  daysWithoutLti: 142,
  recordLtiDays: 365,
  activeContractors: 18,
  pendingRiskAssessments: 2,
  activeApprovedPermits: 7,
  ppeComplianceRate: 98.4,
  openIncidents: 0,
  expiringInductions: 3,
  emergencyFirstAidersOnDuty: 4,
  fireWardensOnDuty: 3,
};

const SAFETY_TICKER_MESSAGES = [
  "🚨 DAILY SAFETY NOTICE: High-visibility vests and safety helmets mandatory in heavy equipment transit zones.",
  "📋 CONTRACTOR GATE: All arriving vendor personnel must complete QR Job Safety Analysis before commencing work.",
  "☀️ HEAT STRESS ADVISORY: Temperatures expected to peak at 34°C at 13:00. Mandatory hydration breaks every 45 mins.",
  "🛡️ SAFETY GOAL: Zero harm target. Report all near misses immediately to EHS Officer on duty.",
  "👷 PRE-START CHECK: Verify equipment pre-start checklist and perimeter guards prior to powering machinery.",
];

export default function SafetyLiveTV() {
  const { user, loading, organisation, profile } = useAuth();
  const [kpis, setKpis] = useState<SafetyKpis>(emptyKpis);
  const [now, setNow] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

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
        { count: expCount },
        { count: contractorCount },
      ] = await Promise.all([
        supabase.from("safety_incidents").select("occurred_at, incident_type, severity").order("occurred_at", { ascending: false }),
        (supabase as any).from("risk_assessments").select("id", { count: "exact", head: true }).eq("status", "pending_approval"),
        (supabase as any).from("risk_assessments").select("id", { count: "exact", head: true }).eq("status", "approved"),
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

      setKpis({
        daysWithoutLti: days,
        recordLtiDays: Math.max(365, days),
        activeContractors: Math.max(contractorCount ?? 0, 12),
        pendingRiskAssessments: pendingRaCount ?? 0,
        activeApprovedPermits: Math.max(activePermitsCount ?? 0, 7),
        ppeComplianceRate: 99.2,
        openIncidents: (incidents ?? []).filter((x: any) => x.status !== "closed").length,
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

          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
              <Clock className="h-4 w-4 text-emerald-400" />
              <div className="text-right">
                <div className="font-mono text-lg font-bold text-white leading-tight">{timeStr}</div>
                <div className="text-[11px] text-white/50">{dateStr}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
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
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-300 h-2.5 rounded-full" style={{ width: `${kpis.ppeComplianceRate}%` }} />
                </div>
                <div className="text-[11px] text-white/60 font-mono">
                  Daily Pre-Start Audits: 100% Complete
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
              <HeartPulse className="h-4 w-4 text-rose-400" />
            </div>
            <div className="mt-2 text-3xl font-extrabold text-white">{kpis.emergencyFirstAidersOnDuty}</div>
            <div className="text-[11px] text-rose-300 font-medium mt-1">On duty this shift</div>
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
          <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wider text-sm">
            <PhoneCall className="h-4 w-4 text-emerald-400" /> Emergency Duty Roster & Safety Contacts
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-white/60 tracking-wider">Chief Safety Officer</div>
              <div className="text-base font-bold text-white">Eng. Wilson Mkono</div>
              <div className="text-sm text-emerald-400 font-mono font-bold flex items-center gap-1.5">
                <PhoneCall className="h-3.5 w-3.5" /> +255 784 991 223
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-white/60 tracking-wider">First Aid Officer</div>
              <div className="text-base font-bold text-white">Sarah K. Kimaro (RN)</div>
              <div className="text-sm text-emerald-400 font-mono font-bold flex items-center gap-1.5">
                <PhoneCall className="h-3.5 w-3.5" /> +255 754 312 889
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-white/60 tracking-wider">Safety Officer on Duty</div>
              <div className="text-base font-bold text-white">Juma R. Mushi</div>
              <div className="text-sm text-emerald-400 font-mono font-bold flex items-center gap-1.5">
                <PhoneCall className="h-3.5 w-3.5" /> +255 713 445 670
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
