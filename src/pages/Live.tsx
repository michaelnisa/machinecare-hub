import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Activity, Gauge, ShieldCheck, AlertTriangle, Wrench, Factory, Maximize2 } from "lucide-react";

type Kpis = {
  // Production (today)
  prodActual: number;
  prodTarget: number;
  prodAttainment: number;
  scrap: number;
  // OEE (last 7 days avg)
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  // Safety
  daysSinceIncident: number | null;
  openIncidents: number;
  totalIncidents30d: number;
  // Machines / WO
  activeMachines: number;
  totalMachines: number;
  openWorkOrders: number;
};

const empty: Kpis = {
  prodActual: 0, prodTarget: 0, prodAttainment: 0, scrap: 0,
  oee: 0, availability: 0, performance: 0, quality: 0,
  daysSinceIncident: null, openIncidents: 0, totalIncidents30d: 0,
  activeMachines: 0, totalMachines: 0, openWorkOrders: 0,
};

function pct(n: number) {
  return `${Math.round(n)}%`;
}

function colorFor(value: number, good = 85, warn = 65) {
  if (value >= good) return "text-emerald-400";
  if (value >= warn) return "text-amber-400";
  return "text-rose-400";
}

function Tile({
  icon, label, value, sub, accent, big = true,
}: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: string; big?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between text-white/60">
        <span className="text-sm uppercase tracking-widest">{label}</span>
        <span className="opacity-70">{icon}</span>
      </div>
      <div className={`mt-3 font-bold leading-none tracking-tight ${big ? "text-6xl md:text-7xl" : "text-4xl md:text-5xl"} ${accent ?? "text-white"}`}>
        {value}
      </div>
      {sub && <div className="mt-3 text-base text-white/60">{sub}</div>}
    </div>
  );
}

export default function Live() {
  const { user, loading, organisation } = useAuth();
  const [kpis, setKpis] = useState<Kpis>(empty);
  const [now, setNow] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Wake lock — keep TV screen on
  const wakeLockRef = useRef<any>(null);
  useEffect(() => {
    const request = async () => {
      try {
        // @ts-ignore
        if ("wakeLock" in navigator) wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      } catch {}
    };
    request();
    const onVis = () => { if (document.visibilityState === "visible") request(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      try { wakeLockRef.current?.release?.(); } catch {}
    };
  }, []);

  const load = useCallback(async () => {
    if (!organisation?.id) return;
    const orgId = organisation.id;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);
    const d7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const d30 = new Date(Date.now() - 30 * 86400000).toISOString();

    const [prodRes, oeeRes, incRes, openIncRes, machRes, woRes] = await Promise.all([
      supabase.from("production_kpis").select("target_units,actual_units,scrap_units").eq("organisation_id", orgId).eq("record_date", todayStr),
      supabase.from("oee_records").select("availability,performance,quality").eq("organisation_id", orgId).gte("record_date", d7),
      supabase.from("safety_incidents").select("occurred_at").eq("organisation_id", orgId).order("occurred_at", { ascending: false }).limit(50),
      supabase.from("safety_incidents").select("id", { count: "exact", head: true }).eq("organisation_id", orgId).neq("status", "closed"),
      supabase.from("machines").select("status").eq("organisation_id", orgId),
      supabase.from("work_orders").select("id", { count: "exact", head: true }).eq("organisation_id", orgId).neq("status", "completed"),
    ]);

    const prod = prodRes.data ?? [];
    const prodActual = prod.reduce((s, r) => s + Number(r.actual_units ?? 0), 0);
    const prodTarget = prod.reduce((s, r) => s + Number(r.target_units ?? 0), 0);
    const scrap = prod.reduce((s, r) => s + Number(r.scrap_units ?? 0), 0);
    const prodAttainment = prodTarget > 0 ? (prodActual / prodTarget) * 100 : 0;

    const oeeRows = oeeRes.data ?? [];
    const avg = (k: "availability" | "performance" | "quality") =>
      oeeRows.length ? oeeRows.reduce((s, r) => s + Number(r[k] ?? 0), 0) / oeeRows.length : 0;
    const availability = avg("availability");
    const performance = avg("performance");
    const quality = avg("quality");
    const oee = (availability * performance * quality) / 10000;

    const incidents = incRes.data ?? [];
    const last = incidents[0]?.occurred_at ? new Date(incidents[0].occurred_at) : null;
    const daysSinceIncident = last ? Math.floor((Date.now() - last.getTime()) / 86400000) : null;
    const totalIncidents30d = incidents.filter((i) => i.occurred_at && i.occurred_at >= d30).length;

    const machines = machRes.data ?? [];
    const activeMachines = machines.filter((m) => m.status === "active").length;

    setKpis({
      prodActual, prodTarget, prodAttainment, scrap,
      oee, availability, performance, quality,
      daysSinceIncident, openIncidents: openIncRes.count ?? 0, totalIncidents30d,
      activeMachines, totalMachines: machines.length,
      openWorkOrders: woRes.count ?? 0,
    });
    setLastUpdated(new Date());
  }, [organisation?.id]);

  // Initial + polling fallback
  useEffect(() => {
    if (!organisation?.id) return;
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [organisation?.id, load]);

  // Realtime subscriptions
  useEffect(() => {
    if (!organisation?.id) return;
    const channel = supabase
      .channel(`${organisation.id}:live-kpis`)
      .on("postgres_changes", { event: "*", schema: "public", table: "production_kpis", filter: `organisation_id=eq.${organisation.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "oee_records", filter: `organisation_id=eq.${organisation.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "safety_incidents", filter: `organisation_id=eq.${organisation.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "machines", filter: `organisation_id=eq.${organisation.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "work_orders", filter: `organisation_id=eq.${organisation.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [organisation?.id, load]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  };

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen w-full bg-[#0a0e1a] bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.15),transparent_50%),radial-gradient(ellipse_at_bottom,rgba(168,85,247,0.12),transparent_50%)] text-white">
      <div className="mx-auto max-w-[1800px] px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">{organisation?.name ?? "Live Operations"}</h1>
            <p className="mt-1 text-white/50">Real-time KPI dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white/70 hover:text-white hover:bg-white/10" title="Fullscreen">
              <Maximize2 className="h-5 w-5" />
            </Button>
            <div className="text-right">
              <div className="text-5xl font-bold tabular-nums">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              <div className="text-sm text-white/50">
                {now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
                {lastUpdated && <span className="ml-3 inline-flex items-center gap-1.5"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> live</span>}
              </div>
            </div>
          </div>
        </div>

        {/* PRODUCTION */}
        <SectionTitle icon={<Factory className="h-5 w-5" />} title="Production — Today" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Tile
            icon={<Activity className="h-6 w-6" />}
            label="Attainment"
            value={pct(kpis.prodAttainment)}
            sub={`${kpis.prodActual.toLocaleString()} / ${kpis.prodTarget.toLocaleString()} units`}
            accent={colorFor(kpis.prodAttainment, 95, 75)}
          />
          <Tile
            icon={<Factory className="h-6 w-6" />}
            label="Units Produced"
            value={kpis.prodActual.toLocaleString()}
            sub={`Target ${kpis.prodTarget.toLocaleString()}`}
          />
          <Tile
            icon={<AlertTriangle className="h-6 w-6" />}
            label="Scrap"
            value={kpis.scrap.toLocaleString()}
            sub={kpis.prodActual > 0 ? `${((kpis.scrap / (kpis.prodActual + kpis.scrap)) * 100).toFixed(1)}% of total` : "—"}
            accent={kpis.scrap === 0 ? "text-emerald-400" : "text-amber-400"}
          />
        </div>

        {/* OEE */}
        <SectionTitle icon={<Gauge className="h-5 w-5" />} title="OEE — Last 7 Days" />
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          <Tile icon={<Gauge className="h-6 w-6" />} label="OEE" value={pct(kpis.oee)} accent={colorFor(kpis.oee, 85, 60)} />
          <Tile icon={<Activity className="h-6 w-6" />} label="Availability" value={pct(kpis.availability)} accent={colorFor(kpis.availability)} big={false} />
          <Tile icon={<Activity className="h-6 w-6" />} label="Performance" value={pct(kpis.performance)} accent={colorFor(kpis.performance)} big={false} />
          <Tile icon={<Activity className="h-6 w-6" />} label="Quality" value={pct(kpis.quality)} accent={colorFor(kpis.quality)} big={false} />
        </div>

        {/* SAFETY */}
        <SectionTitle icon={<ShieldCheck className="h-5 w-5" />} title="Safety" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Tile
            icon={<ShieldCheck className="h-6 w-6" />}
            label="Days Since Incident"
            value={kpis.daysSinceIncident === null ? "∞" : String(kpis.daysSinceIncident)}
            sub={kpis.daysSinceIncident === null ? "No incidents recorded" : "Keep it going"}
            accent={kpis.daysSinceIncident === null || kpis.daysSinceIncident >= 30 ? "text-emerald-400" : kpis.daysSinceIncident >= 7 ? "text-amber-400" : "text-rose-400"}
          />
          <Tile
            icon={<AlertTriangle className="h-6 w-6" />}
            label="Open Incidents"
            value={String(kpis.openIncidents)}
            sub={`${kpis.totalIncidents30d} reported in 30d`}
            accent={kpis.openIncidents === 0 ? "text-emerald-400" : "text-rose-400"}
          />
          <Tile
            icon={<Wrench className="h-6 w-6" />}
            label="Machines & Work Orders"
            value={`${kpis.activeMachines}/${kpis.totalMachines}`}
            sub={`${kpis.openWorkOrders} open work orders`}
          />
        </div>

        <div className="mt-10 text-center text-xs text-white/30">
          Auto-refresh every 30s · {lastUpdated ? `updated ${lastUpdated.toLocaleTimeString()}` : "loading..."}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-4 mt-10 flex items-center gap-2 text-white/70">
      {icon}
      <h2 className="text-xs font-semibold uppercase tracking-[0.25em]">{title}</h2>
      <div className="ml-2 h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
    </div>
  );
}
