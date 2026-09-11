import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ClipboardCheck, CheckCircle2, AlertTriangle, Clock, Calendar,
  ChevronLeft, ChevronRight, Plus, Search, Wrench, Eye, Play,
  Loader2, RefreshCw, XCircle, ShieldAlert, TrendingUp, Users,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, initials } from "@/lib/format";
import { format, parseISO, isValid, addDays, subDays, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

type ChecklistExecution = {
  id: string;
  machine_id: string;
  template_id: string;
  template_version: number;
  status: string;
  overall_result: string | null;
  performed_at: string;
  performed_by: string | null;
  performed_by_name: string | null;
  notes: string | null;
  hours_at_execution: number | null;
  machines?: { id: string; name: string; category?: string | null; registration_number?: string | null } | null;
  checklist_templates?: { id: string; name: string } | null;
};

type Machine = {
  id: string;
  name: string;
  category: string;
  registration_number: string | null;
  plate_number: string | null;
  status: string;
};

type Tab = "compliance" | "log";

export default function Inspections() {
  const { profile } = useAuth();
  const { canWrite } = useUserRole();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("compliance");

  const [loading, setLoading] = useState(true);
  const [executions, setExecutions] = useState<ChecklistExecution[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);

  // Log tab date filters
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [dateMode, setDateMode] = useState<"day" | "all" | "week">("day");
  const [search, setSearch] = useState("");
  const [selectedMachine, setSelectedMachine] = useState("all");
  const [selectedResult, setSelectedResult] = useState<"all" | "passed" | "failed" | "in_progress">("all");

  // Start Inspection Dialog
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [preselectedMachineId, setPreselectedMachineId] = useState<string>("");

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [{ data: execData, error: execErr }, { data: machData }] = await Promise.all([
        supabase
          .from("checklist_executions")
          .select(
            "id, machine_id, template_id, template_version, status, overall_result, performed_at, performed_by, performed_by_name, notes, hours_at_execution, machines(id, name, category, registration_number), checklist_templates(id, name)"
          )
          .eq("organisation_id", profile.organisation_id)
          .order("performed_at", { ascending: false }),
        supabase
          .from("machines")
          .select("id, name, category, registration_number, plate_number, status")
          .eq("organisation_id", profile.organisation_id)
          .order("name"),
      ]);

      if (execErr) {
        console.error("Error loading inspections:", execErr);
        toast.error("Failed to load inspections");
      }
      setExecutions((execData as any) ?? []);
      setMachines(machData ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("realtime-checklist-executions")
      .on("postgres_changes", { event: "*", schema: "public", table: "checklist_executions" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  // ─── Compliance Board data ───────────────────────────────────────────────
  const todayStart = startOfDay(new Date()).toISOString();

  const todayExecs = useMemo(
    () => executions.filter((e) => e.performed_at >= todayStart),
    [executions, todayStart],
  );

  // Map machine_id → latest today's execution
  const machineInspectionToday = useMemo(() => {
    const map = new Map<string, ChecklistExecution>();
    for (const e of todayExecs) {
      const existing = map.get(e.machine_id);
      if (!existing || e.performed_at > existing.performed_at) map.set(e.machine_id, e);
    }
    return map;
  }, [todayExecs]);

  const complianceStats = useMemo(() => {
    const inspected = machines.filter((m) => machineInspectionToday.has(m.id));
    const notInspected = machines.filter((m) => !machineInspectionToday.has(m.id));
    const withDefects = [...machineInspectionToday.values()].filter(
      (e) => e.overall_result === "fail" || e.overall_result === "attention" || e.overall_result === "failed",
    );
    const rate = machines.length > 0 ? Math.round((inspected.length / machines.length) * 100) : 0;
    return { inspected, notInspected, withDefects, rate };
  }, [machines, machineInspectionToday]);

  // ─── Log tab filters ─────────────────────────────────────────────────────
  const handlePrevDay = () => {
    const d = parseISO(selectedDate);
    if (isValid(d)) { setSelectedDate(format(subDays(d, 1), "yyyy-MM-dd")); setDateMode("day"); }
  };
  const handleNextDay = () => {
    const d = parseISO(selectedDate);
    if (isValid(d)) { setSelectedDate(format(addDays(d, 1), "yyyy-MM-dd")); setDateMode("day"); }
  };

  const filtered = useMemo(() => {
    return executions.filter((item) => {
      const itemDateStr = item.performed_at?.slice(0, 10);
      if (dateMode === "day" && itemDateStr !== selectedDate) return false;
      if (dateMode === "week") {
        const t = new Date(item.performed_at).getTime();
        if (t < Date.now() - 7 * 86400000) return false;
      }
      if (selectedMachine !== "all" && item.machine_id !== selectedMachine) return false;
      if (selectedResult === "passed") {
        const r = item.overall_result?.toLowerCase();
        if (r !== "pass" && r !== "ok" && r !== "passed") return false;
      } else if (selectedResult === "failed") {
        const r = item.overall_result?.toLowerCase();
        if (r !== "fail" && r !== "failed" && r !== "attention") return false;
      } else if (selectedResult === "in_progress") {
        if (item.status === "completed") return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const fields = [
          item.performed_by_name ?? "", item.machines?.name ?? "",
          item.machines?.registration_number ?? "", item.checklist_templates?.name ?? "", item.notes ?? "",
        ];
        if (!fields.some((f) => f.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [executions, dateMode, selectedDate, selectedMachine, selectedResult, search]);

  const logStats = useMemo(() => {
    let passed = 0, failed = 0, inProgress = 0;
    const inspectorsSet = new Set<string>();
    filtered.forEach((item) => {
      const res = item.overall_result?.toLowerCase();
      if (item.status !== "completed") inProgress++;
      else if (res === "pass" || res === "ok" || res === "passed") passed++;
      else if (res === "fail" || res === "failed" || res === "attention") failed++;
      else passed++;
      if (item.performed_by_name?.trim()) inspectorsSet.add(item.performed_by_name.trim());
    });
    return { total: filtered.length, passed, failed, inProgress, inspectorsCount: inspectorsSet.size };
  }, [filtered]);

  const parsedSelectedDate = parseISO(selectedDate);
  const formattedSelectedDay = isValid(parsedSelectedDate) ? format(parsedSelectedDate, "EEEE, d MMMM yyyy") : selectedDate;
  const isToday = selectedDate === todayStr && dateMode === "day";

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Machine Inspections</h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">Maintenance</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Daily compliance board and full inspection log across all equipment.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
          {canWrite && (
            <Button onClick={() => { setPreselectedMachineId(""); setStartDialogOpen(true); }}>
              <Plus className="mr-1.5 h-4 w-4" /> Start Inspection
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted/60 p-1 w-fit">
        {([
          { id: "compliance", label: "Today's Compliance" },
          { id: "log", label: `Inspection Log` },
        ] as { id: Tab; label: string }[]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab.id ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.id === "compliance" && complianceStats.notInspected.length > 0 && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {complianceStats.notInspected.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════ COMPLIANCE BOARD TAB ════════════════════════════════ */}
      {activeTab === "compliance" && (
        <div className="space-y-5">
          {/* Compliance KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Machines</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">{machines.length}</p>
                  <p className="mt-1 text-xs text-muted-foreground">In this organisation</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Wrench className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Inspected Today</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {complianceStats.inspected.length}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{complianceStats.rate}% compliance rate</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Not Yet Inspected</p>
                  <p className={cn("mt-2 text-3xl font-semibold tracking-tight", complianceStats.notInspected.length > 0 ? "text-amber-600 dark:text-amber-400" : "")}>
                    {complianceStats.notInspected.length}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Awaiting today's check</p>
                </div>
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  complianceStats.notInspected.length > 0
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-muted text-muted-foreground",
                )}>
                  <Clock className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Defects Found</p>
                  <p className={cn("mt-2 text-3xl font-semibold tracking-tight", complianceStats.withDefects.length > 0 ? "text-destructive" : "")}>
                    {complianceStats.withDefects.length}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Machines needing attention</p>
                </div>
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  complianceStats.withDefects.length > 0
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-muted text-muted-foreground",
                )}>
                  <ShieldAlert className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>

          {/* Compliance progress bar */}
          {machines.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">Daily compliance — {format(new Date(), "EEEE d MMMM yyyy")}</span>
                <span className={cn(
                  "font-semibold",
                  complianceStats.rate === 100 ? "text-emerald-600 dark:text-emerald-400"
                    : complianceStats.rate >= 70 ? "text-amber-600 dark:text-amber-400"
                      : "text-destructive",
                )}>
                  {complianceStats.rate}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    complianceStats.rate === 100 ? "bg-emerald-500"
                      : complianceStats.rate >= 70 ? "bg-amber-500"
                        : "bg-destructive",
                  )}
                  style={{ width: `${complianceStats.rate}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {complianceStats.inspected.length} of {machines.length} machines inspected today
              </p>
            </div>
          )}

          {/* ─── NOT YET INSPECTED ─── */}
          {complianceStats.notInspected.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold">Not yet inspected today ({complianceStats.notInspected.length})</h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {complianceStats.notInspected.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.registration_number || m.plate_number || m.category}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-3 shrink-0 h-8 border-amber-300 bg-white text-xs hover:bg-amber-50 dark:bg-transparent"
                      onClick={() => {
                        setPreselectedMachineId(m.id);
                        setStartDialogOpen(true);
                      }}
                    >
                      <Play className="mr-1 h-3 w-3" /> Inspect
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── DEFECTS FOUND TODAY ─── */}
          {complianceStats.withDefects.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                <h2 className="text-sm font-semibold">Defects found today — action required ({complianceStats.withDefects.length})</h2>
              </div>
              <div className="overflow-hidden rounded-xl border border-red-200 bg-card dark:border-red-900/40">
                {complianceStats.withDefects.map((e, i) => {
                  const m = machines.find((x) => x.id === e.machine_id);
                  return (
                    <div key={e.id} className={cn("flex items-center justify-between px-4 py-3", i > 0 && "border-t border-border")}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{m?.name ?? "Machine"}</p>
                        <p className="text-xs text-muted-foreground">
                          By {e.performed_by_name ?? "—"} · {format(parseISO(e.performed_at), "h:mm a")}
                        </p>
                      </div>
                      <div className="ml-3 flex items-center gap-2">
                        <span className="shrink-0 rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                          Defects
                        </span>
                        <Link to={`/inspections/${e.id}`}>
                          <Button size="sm" variant="outline" className="h-8 text-xs">
                            <Eye className="mr-1 h-3 w-3" /> View
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── ALL CLEAR ─── */}
          {complianceStats.notInspected.length === 0 && complianceStats.withDefects.length === 0 && machines.length > 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50/60 p-10 text-center dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500" />
              <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400">100% compliance — all machines inspected today!</p>
              <p className="mt-1 text-sm text-muted-foreground">Great work. All {machines.length} machine{machines.length === 1 ? "" : "s"} have been checked.</p>
            </div>
          )}

          {/* ─── INSPECTED TODAY ─── */}
          {complianceStats.inspected.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <h2 className="text-sm font-semibold">Inspected today ({complianceStats.inspected.length})</h2>
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {complianceStats.inspected.map((m, i) => {
                  const e = machineInspectionToday.get(m.id)!;
                  const isPass = !["fail", "failed", "attention"].includes(e.overall_result?.toLowerCase() ?? "");
                  return (
                    <div key={m.id} className={cn("flex items-center justify-between px-4 py-3", i > 0 && "border-t border-border")}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{m.name}</p>
                          {m.registration_number && (
                            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">{m.registration_number}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          By {e.performed_by_name ?? "—"} · {format(parseISO(e.performed_at), "h:mm a")}
                          {e.checklist_templates?.name && ` · ${e.checklist_templates.name}`}
                        </p>
                      </div>
                      <div className="ml-3 flex items-center gap-2">
                        <span className={cn(
                          "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                          isPass
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-destructive/10 text-destructive",
                        )}>
                          {isPass ? "Passed" : "Defects"}
                        </span>
                        <Link to={`/inspections/${e.id}`}>
                          <Button size="sm" variant="outline" className="h-8 text-xs">
                            <Eye className="mr-1 h-3 w-3" /> Report
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty org state */}
          {machines.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
              <Wrench className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <h3 className="mt-3 text-base font-semibold">No machines registered yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Add machines to your organisation to start tracking inspection compliance.</p>
              <Link to="/machines">
                <Button size="sm" className="mt-4">Go to Machines</Button>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ INSPECTION LOG TAB ═════════════════════════════════ */}
      {activeTab === "log" && (
        <div className="space-y-5">
          {/* Date Navigation */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 bg-muted/60 p-1 rounded-xl">
                {[
                  { label: "Today", action: () => { setSelectedDate(todayStr); setDateMode("day"); }, active: isToday },
                  { label: "Yesterday", action: () => { setSelectedDate(format(subDays(new Date(), 1), "yyyy-MM-dd")); setDateMode("day"); }, active: dateMode === "day" && selectedDate === format(subDays(new Date(), 1), "yyyy-MM-dd") },
                  { label: "Last 7 Days", action: () => setDateMode("week"), active: dateMode === "week" },
                  { label: "All Records", action: () => setDateMode("all"), active: dateMode === "all" },
                ].map((btn) => (
                  <Button key={btn.label} size="sm" variant={btn.active ? "default" : "ghost"} onClick={btn.action} className="h-8 text-xs font-medium">
                    {btn.label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={handlePrevDay}><ChevronLeft className="h-4 w-4" /></Button>
                <input
                  type="date" value={selectedDate}
                  onChange={(e) => { if (e.target.value) { setSelectedDate(e.target.value); setDateMode("day"); } }}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleNextDay}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                {dateMode === "day" ? <span>Showing: <strong className="text-primary">{formattedSelectedDay}</strong>{isToday && " (Today)"}</span>
                  : dateMode === "week" ? <span>Past <strong>7 days</strong></span>
                    : <span>All <strong>historical</strong> records</span>}
              </div>
              <span>Found <strong>{filtered.length}</strong> inspection{filtered.length === 1 ? "" : "s"}</span>
            </div>
          </div>

          {/* Log KPI mini cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total", value: logStats.total, color: "" },
              { label: "Passed / OK", value: logStats.passed, color: "text-emerald-600 dark:text-emerald-400" },
              { label: "Failed / Defects", value: logStats.failed, color: "text-destructive" },
              { label: "Inspectors", value: logStats.inspectorsCount, color: "text-blue-600 dark:text-blue-400" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className={cn("mt-1 text-2xl font-semibold", s.color)}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search inspector, machine, notes…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 text-xs" />
            </div>
            <select value={selectedMachine} onChange={(e) => setSelectedMachine(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium">
              <option value="all">All Machines</option>
              {machines.map((m) => <option key={m.id} value={m.id}>{m.name}{m.category ? ` (${m.category})` : ""}</option>)}
            </select>
            <select value={selectedResult} onChange={(e) => setSelectedResult(e.target.value as any)} className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium">
              <option value="all">All Results</option>
              <option value="passed">Passed / OK</option>
              <option value="failed">Failed / Defects</option>
              <option value="in_progress">In Progress</option>
            </select>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
              <ClipboardCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-3 text-base font-semibold">No inspections found {dateMode === "day" ? `for ${formattedSelectedDay}` : ""}</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                {isToday ? "No one has logged an inspection yet today." : `No records found for ${formattedSelectedDay}.`}
                {executions.length > 0 && dateMode === "day" && (
                  <span className="block mt-1 font-medium text-foreground">
                    There are {executions.length} record{executions.length === 1 ? "" : "s"} on other dates.
                  </span>
                )}
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                {executions.length > 0 && dateMode === "day" && (
                  <Button variant="outline" size="sm" onClick={() => setDateMode("all")}>View All ({executions.length})</Button>
                )}
                <Button size="sm" onClick={() => { setPreselectedMachineId(""); setStartDialogOpen(true); }}>
                  <Plus className="mr-1.5 h-4 w-4" /> Start Inspection
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3.5">Time</th>
                      <th className="px-5 py-3.5">Machine</th>
                      <th className="px-5 py-3.5">Inspector</th>
                      <th className="px-5 py-3.5">Template</th>
                      <th className="px-5 py-3.5">Result</th>
                      <th className="px-5 py-3.5">Hours / Notes</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((item) => {
                      const itemTime = item.performed_at ? format(parseISO(item.performed_at), "h:mm a") : "—";
                      const itemFullDate = item.performed_at ? formatDate(item.performed_at) : "—";
                      const res = item.overall_result?.toLowerCase();
                      const isPass = res === "pass" || res === "ok" || res === "passed";
                      const isFail = res === "fail" || res === "failed" || res === "attention";
                      const isCompleted = item.status === "completed";
                      return (
                        <tr key={item.id} className="transition-colors hover:bg-muted/30">
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="font-semibold flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />{itemTime}
                            </div>
                            {dateMode !== "day" && <div className="text-xs text-muted-foreground mt-0.5">{itemFullDate}</div>}
                          </td>
                          <td className="px-5 py-3.5">
                            <Link to={`/machines/${item.machine_id}`} className="font-medium hover:text-primary flex items-center gap-1.5">
                              <Wrench className="h-3.5 w-3.5 text-primary shrink-0" />
                              {item.machines?.name ?? "Machine"}
                            </Link>
                            {item.machines?.registration_number && (
                              <div className="mt-0.5 text-xs font-mono text-muted-foreground">{item.machines.registration_number}</div>
                            )}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">
                                {initials(item.performed_by_name ?? "?")}
                              </div>
                              <div>
                                <div className="text-xs font-medium">{item.performed_by_name || "Unassigned"}</div>
                                <div className="text-[10px] text-muted-foreground">Inspector</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="text-xs font-medium flex items-center gap-1.5">
                              <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              {item.checklist_templates?.name ?? "Inspection"}
                            </div>
                            <span className="text-[10px] text-muted-foreground">v{item.template_version}</span>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {!isCompleted ? (
                              <span className="status-pill status-due"><Clock className="h-3 w-3" /> In progress</span>
                            ) : isPass ? (
                              <span className="status-pill status-ok"><CheckCircle2 className="h-3 w-3" /> Passed</span>
                            ) : isFail ? (
                              <span className="status-pill status-overdue"><AlertTriangle className="h-3 w-3" /> Defects</span>
                            ) : (
                              <span className="status-pill status-inactive capitalize">{item.overall_result ?? "Completed"}</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-xs max-w-xs">
                            {item.hours_at_execution != null && <div className="font-mono text-muted-foreground">{item.hours_at_execution} hrs</div>}
                            {item.notes ? <p className="truncate text-muted-foreground" title={item.notes}>{item.notes}</p> : <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <Link to={`/inspections/${item.id}`}>
                              <Button size="sm" variant={isCompleted ? "outline" : "default"} className="h-8 gap-1 text-xs">
                                <Eye className="h-3.5 w-3.5" />{isCompleted ? "View Report" : "Continue"}
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Start Inspection Dialog */}
      <StartInspectionModal
        open={startDialogOpen}
        onOpenChange={setStartDialogOpen}
        machines={machines}
        preselectedMachineId={preselectedMachineId}
        onStarted={(id) => navigate(`/inspections/${id}`)}
      />
    </div>
  );
}

// ─── Start Inspection Modal ────────────────────────────────────────────────
function StartInspectionModal({
  open, onOpenChange, machines, preselectedMachineId, onStarted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machines: Machine[];
  preselectedMachineId: string;
  onStarted: (execId: string) => void;
}) {
  const { profile } = useAuth();
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [hours, setHours] = useState("");
  const [inspectorName, setInspectorName] = useState(profile?.full_name ?? "");
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedMachineId(preselectedMachineId || (machines[0]?.id ?? ""));
      setInspectorName(profile?.full_name ?? "");
      setHours("");
    }
  }, [open, preselectedMachineId, machines, profile]);

  useEffect(() => {
    if (!selectedMachineId) { setTemplates([]); return; }
    setLoadingTemplates(true);
    const m = machines.find((x) => x.id === selectedMachineId);
    supabase
      .from("checklist_templates")
      .select("id, name, version, machine_category, machine_id")
      .eq("status", "approved")
      .or(`machine_id.eq.${selectedMachineId},machine_id.is.null`)
      .order("name")
      .then(({ data }) => {
        const filtered = (data ?? []).filter((t: any) =>
          !t.machine_category || !m?.category || t.machine_category === m.category
        );
        setTemplates(filtered);
        setTemplateId(filtered[0]?.id ?? "");
        setLoadingTemplates(false);
      });
  }, [selectedMachineId, machines]);

  const handleStart = async () => {
    if (!selectedMachineId) return toast.error("Please select a machine");
    if (!templateId) return toast.error("No approved checklist template found for this machine");
    if (!profile) return;
    setStarting(true);
    try {
      const tpl = templates.find((t) => t.id === templateId);
      const { data: items } = await supabase
        .from("checklist_template_items")
        .select("*")
        .eq("template_id", templateId)
        .order("sort_order");

      const { data: exec, error } = await supabase
        .from("checklist_executions")
        .insert({
          organisation_id: profile.organisation_id,
          machine_id: selectedMachineId,
          template_id: templateId,
          template_version: tpl?.version ?? 1,
          status: "in_progress",
          performed_at: new Date().toISOString(),
          performed_by: profile.id,
          performed_by_name: inspectorName.trim() || profile.full_name || "Inspector",
          hours_at_execution: hours ? Number(hours) : null,
        })
        .select("id")
        .single();

      if (error || !exec) throw new Error(error?.message || "Failed to start");

      // Insert responses with correct column names
      if (items && items.length > 0) {
        const rows = items.map((it: any) => ({
          execution_id: exec.id,
          item_id: it.id,
          item_text_snapshot: it.text ?? "Item",
          item_type: it.item_type ?? "pass_fail",
          severity_snapshot: it.severity ?? "minor",
          sort_order: it.sort_order ?? 0,
        }));
        await supabase.from("checklist_execution_responses").insert(rows);
      }

      toast.success("Inspection started!");
      onOpenChange(false);
      onStarted(exec.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to start inspection");
    } finally {
      setStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Start Equipment Inspection</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Machine / Equipment</Label>
            <select
              value={selectedMachineId}
              onChange={(e) => setSelectedMachineId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— Select machine —</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>{m.name}{m.category ? ` · ${m.category}` : ""}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Checklist Template</Label>
            {loadingTemplates ? (
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading templates…
              </div>
            ) : templates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                No approved checklist templates for this machine. Create and approve one in Checklist Templates first.
              </div>
            ) : (
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}
              </select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Inspector Name</Label>
            <Input value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} placeholder="e.g. John Doe" />
          </div>
          <div className="space-y-1.5">
            <Label>Current Machine Hours (optional)</Label>
            <Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 1250" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleStart} disabled={starting || !selectedMachineId || !templateId}>
            {starting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Play className="mr-1.5 h-4 w-4" /> Start Inspection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
