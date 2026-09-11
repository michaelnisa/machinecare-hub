import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import {
  ShieldAlert, Plus, Loader2, CheckCircle2, XCircle, ClipboardList,
  ListChecks, ClipboardCheck, GraduationCap, Tv, Settings2, QrCode,
  MapPin, Users, HardHat, FileWarning, Trophy, FlaskConical, GitBranch,
  Building2, Package, Wrench, FileText, Settings, ShieldCheck, ChevronRight,
  FileCheck, Lock, UserCheck, AlertTriangle
} from "lucide-react";

import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { Link } from "react-router-dom";
import { formatWoNumber } from "@/components/WorkOrderPreview";
import { SafetyLiveFeedModal } from "@/components/safety/SafetyLiveFeedModal";
import { SafetyDepartmentQrPosterModal } from "@/components/safety/SafetyDepartmentQrPosterModal";
import { FiveWhysModal } from "@/components/safety/FiveWhysModal";

const TYPES = ["near_miss", "accident", "hazard", "first_aid", "lost_time"];
const SEVERITIES = ["low", "medium", "high", "critical"];
const STATUSES = ["open", "investigating", "closed"];

const SEV_CLASS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};
const STAT_CLASS: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  investigating: "bg-amber-100 text-amber-700",
  closed: "bg-emerald-100 text-emerald-700",
};

export default function Safety() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [pendingPtw, setPendingPtw] = useState<any[]>([]);
  const [pendingRams, setPendingRams] = useState<any[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewingRamsId, setReviewingRamsId] = useState<string | null>(null);
  const [qrPosterOpen, setQrPosterOpen] = useState(false);
  const [fiveWhysOpen, setFiveWhysOpen] = useState(false);
  const [selectedIncidentForRca, setSelectedIncidentForRca] = useState<any>(null);
  const [dash, setDash] = useState({
    pendingRiskAssessments: 0,
    activeLoto: 0,
    openCorrectiveActions: 0,
    overdueCorrectiveActions: 0,
    expiringInductions: 0,
    dsli: null as number | null,   // Days Since Last Incident
    lastIncidentDate: null as string | null,
  });

  const [activeTab, setActiveTab] = useState<"overview" | "workflows" | "incidents">("overview");

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString();
    const [{ data: i, error: e1 }, { data: m, error: e2 }, { data: ptw, error: e3 }, { data: raList, count: raCount }, { count: lotoCount }, { data: ca }, { count: expCount }] = await Promise.all([
      supabase.from("safety_incidents").select("*, machines(name)").order("occurred_at", { ascending: false }),
      supabase.from("machines").select("id, name").order("name"),
      (supabase as any)
        .from("wo_safety_approvals")
        .select("*, work_orders(id, title, wo_number, wo_year)")
        .eq("status", "pending")
        .order("requested_at", { ascending: true }),
      (supabase as any)
        .from("risk_assessments")
        .select("id, title, activity, initial_risk_level, status, created_at, machines(name)")
        .eq("status", "pending_approval")
        .order("created_at", { ascending: false }),
      (supabase as any).from("wo_loto_checklists").select("id", { count: "exact", head: true }).in("status", ["not_started", "in_progress"]),
      (supabase as any).from("corrective_actions").select("id, due_date, status").neq("status", "closed"),
      (supabase as any).from("induction_records").select("id", { count: "exact", head: true }).lte("expires_at", in30).gte("expires_at", today),
    ]);
    const err = e1 || e2 || e3;
    if (err) toast.error(err.message);
    setItems(i ?? []);
    setMachines(m ?? []);
    setPendingPtw(ptw ?? []);
    setPendingRams(raList ?? []);
    const openCa = (ca ?? []).length;
    const overdueCa = (ca ?? []).filter((x: any) => x.due_date && x.due_date < today).length;

    // DSLI: Days Since Last Incident — find the most recent occurred_at across all incidents
    const allIncidents = i ?? [];
    let dsli: number | null = null;
    let lastIncidentDate: string | null = null;
    if (allIncidents.length > 0) {
      const sorted = [...allIncidents].sort((a, b) =>
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
      );
      lastIncidentDate = sorted[0].occurred_at;
      const msElapsed = Date.now() - new Date(lastIncidentDate).getTime();
      dsli = Math.floor(msElapsed / 86400000);
    }

    setDash({
      pendingRiskAssessments: raCount ?? (raList ?? []).length,
      activeLoto: lotoCount ?? 0,
      openCorrectiveActions: openCa,
      overdueCorrectiveActions: overdueCa,
      expiringInductions: expCount ?? 0,
      dsli,
      lastIncidentDate,
    });
    setLoading(false);

  };

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30000);
    const handleVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", handleVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVis);
    };
  }, [profile]);

  const reviewPtw = async (id: string, status: "approved" | "rejected") => {
    setReviewingId(id);
    const { error } = await (supabase as any)
      .from("wo_safety_approvals")
      .update({ status, reviewed_by: profile?.id, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    setReviewingId(null);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Permit approved" : "Permit rejected");
    load();
  };

  const reviewRams = async (id: string, status: "approved" | "rejected") => {
    setReviewingRamsId(id);
    const { error } = await (supabase as any)
      .from("risk_assessments")
      .update({ status, approved_by: profile?.id, approved_at: new Date().toISOString() })
      .eq("id", id);
    setReviewingRamsId(null);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "RAMS approved" : "RAMS rejected");
    load();
  };

  const filtered = useMemo(() => filter === "all" ? items : items.filter((x) => x.status === filter), [items, filter]);

  const stats = useMemo(() => ({
    total: items.length,
    open: items.filter((x) => x.status === "open").length,
    critical: items.filter((x) => x.severity === "critical").length,
    lostTime: items.reduce((s, x) => s + Number(x.lost_time_hours || 0), 0),
  }), [items]);

  const updateStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "closed") patch.closed_at = new Date().toISOString();
    const { error } = await supabase.from("safety_incidents").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-[#00A651]" />
            <h1 className="text-2xl font-bold tracking-tight">Safety &amp; EHS Hub</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Operational safety control, high-risk permits, ISO 45001 compliance &amp; contractor governance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setQrPosterOpen(true)}
            variant="outline"
            className="text-xs gap-1.5 font-semibold border-[#00A651]/40 text-[#00A651] hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
          >
            <QrCode className="h-4 w-4" /> Safety QR Poster
          </Button>

          <Link to="/safety/live-tv">
            <Button
              variant="outline"
              className="text-xs gap-1.5 font-semibold"
            >
              <Tv className="h-4 w-4 text-[#00A651]" /> Live TV Display
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFeedOpen(true)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Configure Live TV Bulletin & Feed"
          >
            <Settings2 className="h-4 w-4" />
          </Button>

          <Button
            onClick={() => setOpen(true)}
            className="bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-bold gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" /> Report Incident
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "overview"
              ? "border-[#00A651] text-[#00A651] font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Overview & KPIs
        </button>
        <button
          onClick={() => setActiveTab("workflows")}
          className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "workflows"
              ? "border-[#00A651] text-[#00A651] font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          EHS Workflows & Modules
        </button>
        <button
          onClick={() => setActiveTab("incidents")}
          className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "incidents"
              ? "border-[#00A651] text-[#00A651] font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Incidents Register
          {stats.open > 0 && (
            <span className="rounded-full bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 px-1.5 py-0.2 text-[10px] font-bold">
              {stats.open}
            </span>
          )}
        </button>
      </div>

      {/* ── DSLI Hero Card ──────────────────────────────────────────────── */}
      <div className={`rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm
        ${dash.dsli === null
          ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800/40 dark:bg-emerald-950/20"
          : dash.dsli === 0
            ? "border-red-300 bg-red-50/60 dark:border-red-800/40 dark:bg-red-950/20"
            : dash.dsli <= 7
              ? "border-amber-300 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20"
              : "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800/40 dark:bg-emerald-950/20"
        }`}
      >
        <div className="flex items-center gap-4">
          <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold
            ${dash.dsli === null || (dash.dsli !== null && dash.dsli > 7)
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : dash.dsli === 0
                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            }`}
          >
            {dash.dsli === null ? "∞" : String(dash.dsli)}
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight text-foreground">
              Days Since Last Incident (DSLI)
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">
              {dash.dsli === null
                ? "No incidents have been recorded yet. Keep it that way."
                : dash.dsli === 0
                  ? "An incident occurred today — ensure immediate action has been taken."
                  : dash.dsli <= 7
                    ? `Last incident ${dash.dsli} day${dash.dsli === 1 ? "" : "s"} ago — stay vigilant.`
                    : `Last incident ${dash.dsli} day${dash.dsli === 1 ? "" : "s"} ago — great work keeping the site safe!`
              }
            </div>
            {dash.lastIncidentDate && (
              <div className="text-xs text-muted-foreground mt-1">
                Last recorded: {new Date(dash.lastIncidentDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
          <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Incident-free streak</div>
          <div className={`text-4xl font-black tabular-nums
            ${dash.dsli === null || (dash.dsli !== null && dash.dsli > 7)
              ? "text-emerald-600 dark:text-emerald-400"
              : dash.dsli === 0
                ? "text-red-600 dark:text-red-400"
                : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {dash.dsli === null ? "—" : `${dash.dsli}d`}
          </div>
        </div>
      </div>

      {/* KPI Cards — Fleet style */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          {
            label: "Pending Permits",
            value: pendingPtw.length,
            sub: pendingPtw.length > 0 ? "Requires safety review" : "No permits pending",
            icon: FileCheck,
            tone: pendingPtw.length > 0 ? "warning" : "success",
          },
          {
            label: "Pending RAMS",
            value: pendingRams.length,
            sub: pendingRams.length > 0 ? "Awaiting risk approval" : "All RAMS approved",
            icon: ClipboardCheck,
            tone: pendingRams.length > 0 ? "warning" : "success",
          },
          {
            label: "Active LOTO",
            value: dash.activeLoto,
            sub: dash.activeLoto > 0 ? "Energy isolation active" : "No active isolations",
            icon: Lock,
            tone: dash.activeLoto > 0 ? "default" : "success",
          },
          {
            label: "Open CAPA",
            value: dash.openCorrectiveActions,
            sub: dash.overdueCorrectiveActions > 0 ? `${dash.overdueCorrectiveActions} overdue` : "On schedule",
            icon: AlertTriangle,
            tone: dash.overdueCorrectiveActions > 0 ? "destructive" : dash.openCorrectiveActions > 0 ? "warning" : "success",
          },
          {
            label: "Expiring Inductions",
            value: dash.expiringInductions,
            sub: dash.expiringInductions > 0 ? "Renewal due ≤30d" : "All inductions current",
            icon: UserCheck,
            tone: dash.expiringInductions > 0 ? "warning" : "success",
          },
        ].map((s) => {
          const toneClasses: Record<string, string> = {
            default: "bg-primary/10 text-primary",
            success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
            warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
            destructive: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
          };
          return (
            <div key={s.label} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{s.label}</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight">{s.value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.sub}</div>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClasses[s.tone]}`}>
                  <s.icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* PENDING APPROVALS GRID: PTW & RAMS SIDE-BY-SIDE */}
      {(pendingPtw.length > 0 || pendingRams.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Pending Permits to Work */}
          {pendingPtw.length > 0 ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
              <div className="text-sm font-bold text-amber-900 dark:text-amber-300 flex items-center justify-between">
                <span>Pending Permits to Work ({pendingPtw.length})</span>
                <span className="text-xs font-normal text-muted-foreground">Requires EHS Review</span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {pendingPtw.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white dark:bg-slate-900 p-3 shadow-sm">
                    <div className="min-w-0 flex-1">
                      <Link to={`/work-orders/${p.work_orders?.id}`} className="text-xs font-bold text-primary hover:underline line-clamp-1">
                        {p.work_orders ? `${formatWoNumber(p.work_orders.wo_year, p.work_orders.wo_number)} — ${p.work_orders.title}` : "Work order"}
                      </Link>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Requested {formatDate(p.requested_at)}</div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={() => reviewPtw(p.id, "approved")} disabled={reviewingId === p.id} className="h-7 text-xs bg-[#00A651] hover:bg-[#008f45] text-white gap-1 font-bold">
                        <CheckCircle2 className="h-3 w-3" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => reviewPtw(p.id, "rejected")} disabled={reviewingId === p.id} className="h-7 text-xs gap-1">
                        <XCircle className="h-3 w-3" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Pending RAMS (Risk Assessments) */}
          {pendingRams.length > 0 ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
              <div className="text-sm font-bold text-amber-900 dark:text-amber-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileWarning className="h-4 w-4 text-amber-600" /> Pending RAMS / Risk Assessments ({pendingRams.length})
                </span>
                <Link to="/safety/risk-assessments" className="text-xs text-[#00A651] font-semibold hover:underline">
                  View All
                </Link>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {pendingRams.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white dark:bg-slate-900 p-3 shadow-sm">
                    <div className="min-w-0 flex-1">
                      <Link to="/safety/risk-assessments" className="text-xs font-bold text-foreground hover:underline line-clamp-1">
                        {r.title}
                      </Link>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Activity: {r.activity || "Hazard Analysis"} • Risk: <span className="font-semibold uppercase text-amber-700">{r.initial_risk_level || "Medium"}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={() => reviewRams(r.id, "approved")} disabled={reviewingRamsId === r.id} className="h-7 text-xs bg-[#00A651] hover:bg-[#008f45] text-white gap-1 font-bold">
                        <CheckCircle2 className="h-3 w-3" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => reviewRams(r.id, "rejected")} disabled={reviewingRamsId === r.id} className="h-7 text-xs gap-1">
                        <XCircle className="h-3 w-3" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 1: OVERVIEW OR TAB 2: WORKFLOWS (3 LOGICAL EHS PRESENTATION PILLARS) */}
      {(activeTab === "overview" || activeTab === "workflows") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              EHS Operational Pillars &amp; Workflows
            </h2>
            <span className="text-xs text-muted-foreground">
              Structured for daily plant operations &amp; audit compliance
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* PILLAR 1: Plant Operations & High-Risk Control */}
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between space-y-3 shadow-sm">
              <div>
                <div className="flex items-center gap-2 text-foreground font-bold text-sm mb-1">
                  <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-[#00A651]">
                    <HardHat className="h-4 w-4" />
                  </div>
                  <h3>1. Operations &amp; High-Risk Controls</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Boots-on-ground site walks, contractor Stop Work Authority &amp; high-risk job execution.
                </p>
              </div>

              <div className="space-y-1.5">
                <Link to="/safety/supervisor-radar" className="group flex items-center justify-between p-2 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="h-4 w-4 text-[#00A651] shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-foreground group-hover:text-[#00A651]">Supervisor Radar</div>
                      <div className="text-[11px] text-muted-foreground">Boots-on-ground site walks &amp; suspensions</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                </Link>

                <Link to="/contractor/portal" className="group flex items-center justify-between p-2 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <HardHat className="h-4 w-4 text-[#00A651] shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-foreground group-hover:text-[#00A651]">Contractor Safety Portal</div>
                      <div className="text-[11px] text-muted-foreground">Toolbox talks, JSEA &amp; Stop Work Authority</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                </Link>

                <Link to="/safety/contractors" className="group flex items-center justify-between p-2 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="h-4 w-4 text-[#00A651] shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-foreground group-hover:text-[#00A651]">Contractor Registry &amp; Insurances</div>
                      <div className="text-[11px] text-muted-foreground">Pre-qualification &amp; vendor certifications</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                </Link>

                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-border">
                  <Link to="/safety/controlled-tools" className="flex items-center gap-1.5 p-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40">
                    <Wrench className="h-3.5 w-3.5 text-[#00A651]" /> Controlled Tools
                  </Link>
                  <Link to="/safety/ppe" className="flex items-center gap-1.5 p-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40">
                    <Package className="h-3.5 w-3.5 text-[#00A651]" /> PPE Register
                  </Link>
                </div>
              </div>
            </div>

            {/* PILLAR 2: Hazard Prevention & Incident RCA */}
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between space-y-3 shadow-sm">
              <div>
                <div className="flex items-center gap-2 text-foreground font-bold text-sm mb-1">
                  <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600">
                    <FlaskConical className="h-4 w-4" />
                  </div>
                  <h3>2. Hazard Prevention &amp; Incident RCA</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Chemical HazCom / GHS, pre-task risk assessments &amp; ISO 45001 root cause problem solving.
                </p>
              </div>

              <div className="space-y-1.5">
                <Link to="/safety/chemicals" className="group flex items-center justify-between p-2 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <FlaskConical className="h-4 w-4 text-blue-600 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-foreground group-hover:text-blue-600">Chemicals &amp; Drum QR</div>
                      <div className="text-[11px] text-muted-foreground">GHS pictograms, SDS registry &amp; spill kits</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                </Link>

                <Link to="/safety/risk-assessments" className="group flex items-center justify-between p-2 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <ClipboardList className="h-4 w-4 text-blue-600 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-foreground group-hover:text-blue-600">Risk Assessments (RAMS)</div>
                      <div className="text-[11px] text-muted-foreground">Task risk evaluation &amp; control hierarchy</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                </Link>

                <Link to="/safety/corrective-actions" className="group flex items-center justify-between p-2 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <ListChecks className="h-4 w-4 text-blue-600 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-foreground group-hover:text-blue-600">Corrective Actions (CAPA)</div>
                      <div className="text-[11px] text-muted-foreground">Closed-loop hazard non-conformance fixes</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                </Link>

                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-border">
                  <Link to="/safety/inspections" className="flex items-center gap-1.5 p-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40">
                    <ClipboardCheck className="h-3.5 w-3.5 text-blue-600" /> Safety Audits
                  </Link>
                  <Link to="/safety/equipment" className="flex items-center gap-1.5 p-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> Safety Equipment
                  </Link>
                </div>
              </div>
            </div>

            {/* PILLAR 3: Workforce Safety Culture & Compliance */}
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between space-y-3 shadow-sm">
              <div>
                <div className="flex items-center gap-2 text-foreground font-bold text-sm mb-1">
                  <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600">
                    <Trophy className="h-4 w-4" />
                  </div>
                  <h3>3. Safety Culture &amp; Compliance</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Workforce recognition, safety committee governance &amp; digital workforce inductions.
                </p>
              </div>

              <div className="space-y-1.5">
                <Link to="/safety/leaderboard" className="group flex items-center justify-between p-2 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <Trophy className="h-4 w-4 text-amber-600 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-foreground group-hover:text-amber-600">Safety Leaderboard</div>
                      <div className="text-[11px] text-muted-foreground">Incident-free streaks, TBT bonuses &amp; rankings</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                </Link>

                <Link to="/safety/team" className="group flex items-center justify-between p-2 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="h-4 w-4 text-amber-600 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-foreground group-hover:text-amber-600">Safety Department Team</div>
                      <div className="text-[11px] text-muted-foreground">Designated HSE officers &amp; certified first aiders</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                </Link>

                <Link to="/induction/dashboard" className="group flex items-center justify-between p-2 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <GraduationCap className="h-4 w-4 text-amber-600 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-foreground group-hover:text-amber-600">Inductions &amp; Training</div>
                      <div className="text-[11px] text-muted-foreground">Digital induction tests &amp; skills competency</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                </Link>

                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-border">
                  <Link to="/safety/rules" className="flex items-center gap-1.5 p-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40">
                    <Settings className="h-3.5 w-3.5 text-amber-600" /> Safety Rules
                  </Link>
                  <Link to="/safety/documents" className="flex items-center gap-1.5 p-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40">
                    <FileText className="h-3.5 w-3.5 text-amber-600" /> Documents &amp; ISO
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: OVERVIEW (RECENT INCIDENTS PREVIEW) OR TAB 3: INCIDENTS (FULL INCIDENTS REGISTER) */}
      {(activeTab === "overview" || activeTab === "incidents") && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {activeTab === "overview" ? "Recent Safety Incidents" : "Incidents Register & 5-Whys RCA"}
              </h2>
            </div>
            {activeTab === "overview" && items.length > 5 && (
              <button
                onClick={() => setActiveTab("incidents")}
                className="text-xs font-semibold text-[#00A651] hover:underline"
              >
                View all {items.length} incidents →
              </button>
            )}
          </div>

          {activeTab === "incidents" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Total Incidents", value: stats.total },
                { label: "Open / Under Action", value: stats.open },
                { label: "Critical Severity", value: stats.critical },
                { label: "Lost-time Hours", value: `${stats.lostTime.toFixed(1)}h` },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
                  <div className="mt-1 text-2xl font-semibold">{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "incidents" && (
            <div className="flex flex-wrap gap-2">
              {["all", ...STATUSES].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
                    filter === s ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card hover:bg-muted/60"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {(activeTab === "overview" ? items.slice(0, 5) : filtered).length === 0 ? (
            <EmptyState
              icon={<ShieldAlert className="h-5 w-5" />}
              title="No incidents recorded"
              description="A safe shift is a good shift. Report incidents to track root causes and preventative CAPA."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Severity</th>
                      <th className="px-5 py-3 font-medium">Description</th>
                      <th className="px-5 py-3 font-medium">Machine</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeTab === "overview" ? items.slice(0, 5) : filtered).map((x) => (
                      <tr key={x.id} className="border-t border-border">
                        <td className="px-5 py-3 whitespace-nowrap">{formatDate(x.occurred_at)}</td>
                        <td className="px-5 py-3 capitalize whitespace-nowrap">{x.incident_type?.replace(/_/g, " ")}</td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${SEV_CLASS[x.severity]}`}>
                            {x.severity}
                          </span>
                        </td>
                        <td className="px-5 py-3 max-w-md truncate">{x.description}</td>
                        <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">{x.machines?.name ?? "—"}</td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STAT_CLASS[x.status]}`}>
                            {x.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedIncidentForRca(x);
                                setFiveWhysOpen(true);
                              }}
                              className="h-7 text-xs gap-1 border-emerald-600/30 text-[#00A651] hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              title="Investigate with 5-Whys Root Cause Analysis"
                            >
                              <GitBranch className="h-3.5 w-3.5" /> 5-Whys RCA
                            </Button>
                            {x.status !== "closed" && (
                              <select
                                value={x.status}
                                onChange={(e) => updateStatus(x.id, e.target.value)}
                                className="rounded border border-input bg-background px-2 py-1 text-xs"
                              >
                                {STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}


      <ReportDialog open={open} setOpen={setOpen} machines={machines} userId={user?.id} orgId={profile?.organisation_id} onSaved={load} />
      <SafetyLiveFeedModal open={feedOpen} onOpenChange={setFeedOpen} onSaved={load} />
      <SafetyDepartmentQrPosterModal open={qrPosterOpen} onOpenChange={setQrPosterOpen} />
      <FiveWhysModal
        open={fiveWhysOpen}
        onOpenChange={setFiveWhysOpen}
        incident={selectedIncidentForRca}
        onSaved={load}
      />
    </div>
  );
}

function ReportDialog({ open, setOpen, machines, userId, orgId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    incident_type: "near_miss",
    severity: "low",
    occurred_at: new Date().toISOString().slice(0, 16),
    location: "",
    persons_involved: "",
    description: "",
    immediate_action: "",
    corrective_action: "",
    machine_id: "",
    lost_time_hours: 0,
  });

  const submit = async () => {
    if (!form.description) return toast.error("Description required");
    setSaving(true);
    const { error } = await supabase.from("safety_incidents").insert({
      organisation_id: orgId,
      reported_by: userId,
      incident_type: form.incident_type,
      severity: form.severity,
      occurred_at: new Date(form.occurred_at).toISOString(),
      location: form.location || null,
      persons_involved: form.persons_involved || null,
      description: form.description,
      immediate_action: form.immediate_action || null,
      corrective_action: form.corrective_action || null,
      machine_id: form.machine_id || null,
      lost_time_hours: Number(form.lost_time_hours) || 0,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Incident reported");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Report incident</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Type</Label>
            <select value={form.incident_type} onChange={(e) => setForm({ ...form, incident_type: e.target.value })}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div><Label>Severity</Label>
            <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {SEVERITIES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><Label>Occurred at</Label>
            <Input type="datetime-local" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} className="mt-1" />
          </div>
          <div><Label>Machine (optional)</Label>
            <select value={form.machine_id} onChange={(e) => setForm({ ...form, machine_id: e.target.value })}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">—</option>
              {machines.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1" /></div>
          <div><Label>Persons involved</Label><Input value={form.persons_involved} onChange={(e) => setForm({ ...form, persons_involved: e.target.value })} className="mt-1" /></div>
          <div className="sm:col-span-2"><Label>Description *</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" /></div>
          <div className="sm:col-span-2"><Label>Immediate action</Label><Textarea rows={2} value={form.immediate_action} onChange={(e) => setForm({ ...form, immediate_action: e.target.value })} className="mt-1" /></div>
          <div className="sm:col-span-2"><Label>Corrective action</Label><Textarea rows={2} value={form.corrective_action} onChange={(e) => setForm({ ...form, corrective_action: e.target.value })} className="mt-1" /></div>
          <div><Label>Lost time (hours)</Label><Input type="number" min={0} step={0.5} value={form.lost_time_hours} onChange={(e) => setForm({ ...form, lost_time_hours: e.target.value })} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
