import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  User,
  Plus,
  Search,
  Wrench,
  Eye,
  Play,
  Filter,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, initials } from "@/lib/format";
import { format, parseISO, isValid, addDays, subDays } from "date-fns";

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
  machines?: {
    id: string;
    name: string;
    code?: string | null;
    category?: string | null;
  } | null;
  checklist_templates?: {
    id: string;
    name: string;
  } | null;
};

export default function Inspections() {
  const { profile } = useAuth();
  const { canWrite } = useUserRole();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [executions, setExecutions] = useState<ChecklistExecution[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string; category?: string | null }[]>([]);

  // Date filters: default to TODAY
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [dateMode, setDateMode] = useState<"day" | "all" | "week">("day");

  // Secondary filters
  const [search, setSearch] = useState("");
  const [selectedMachine, setSelectedMachine] = useState("all");
  const [selectedResult, setSelectedResult] = useState<"all" | "passed" | "failed" | "in_progress">("all");

  // Start Inspection Dialog
  const [startDialogOpen, setStartDialogOpen] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      const [{ data: execData, error: execErr }, { data: machData }] = await Promise.all([
        supabase
          .from("checklist_executions")
          .select(
            "id, machine_id, template_id, template_version, status, overall_result, performed_at, performed_by, performed_by_name, notes, hours_at_execution, machines(id, name, code, category), checklist_templates(id, name)"
          )
          .eq("organisation_id", profile.organisation_id)
          .order("performed_at", { ascending: false }),
        supabase
          .from("machines")
          .select("id, name, category")
          .eq("organisation_id", profile.organisation_id)
          .order("name"),
      ]);

      if (execErr) {
        console.error("Error loading checklist executions:", execErr);
        toast.error("Failed to load inspections");
      }

      setExecutions((execData as any) ?? []);
      setMachines(machData ?? []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    // Subscribe to live inspection submissions in real-time
    const channel = supabase
      .channel("realtime-checklist-executions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "checklist_executions",
        },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  // Quick date jumping
  const handlePrevDay = () => {
    try {
      const d = parseISO(selectedDate);
      if (isValid(d)) {
        setSelectedDate(format(subDays(d, 1), "yyyy-MM-dd"));
        setDateMode("day");
      }
    } catch (_e) {
      // ignore invalid date format
    }
  };

  const handleNextDay = () => {
    try {
      const d = parseISO(selectedDate);
      if (isValid(d)) {
        setSelectedDate(format(addDays(d, 1), "yyyy-MM-dd"));
        setDateMode("day");
      }
    } catch (_e) {
      // ignore invalid date format
    }
  };

  const handleSetToday = () => {
    setSelectedDate(todayStr);
    setDateMode("day");
  };

  const handleSetYesterday = () => {
    setSelectedDate(format(subDays(new Date(), 1), "yyyy-MM-dd"));
    setDateMode("day");
  };

  // Filtered executions
  const filtered = useMemo(() => {
    return executions.filter((item) => {
      const itemDateStr = item.performed_at?.slice(0, 10);

      // Date filtering
      if (dateMode === "day") {
        if (itemDateStr !== selectedDate) return false;
      } else if (dateMode === "week") {
        const itemTime = new Date(item.performed_at).getTime();
        const now = Date.now();
        const weekAgo = now - 7 * 86400000;
        if (itemTime < weekAgo) return false;
      }

      // Machine filtering
      if (selectedMachine !== "all" && item.machine_id !== selectedMachine) {
        return false;
      }

      // Result filtering
      if (selectedResult === "passed") {
        const res = item.overall_result?.toLowerCase();
        if (res !== "pass" && res !== "ok" && res !== "passed") return false;
      } else if (selectedResult === "failed") {
        const res = item.overall_result?.toLowerCase();
        if (res !== "fail" && res !== "failed" && res !== "attention") return false;
      } else if (selectedResult === "in_progress") {
        if (item.status === "completed") return false;
      }

      // Search (Inspector / Performed by name or machine name)
      if (search.trim()) {
        const q = search.toLowerCase();
        const inspector = (item.performed_by_name ?? "").toLowerCase();
        const machineName = (item.machines?.name ?? "").toLowerCase();
        const machineCode = (item.machines?.code ?? "").toLowerCase();
        const tplName = (item.checklist_templates?.name ?? "").toLowerCase();
        const notes = (item.notes ?? "").toLowerCase();

        if (
          !inspector.includes(q) &&
          !machineName.includes(q) &&
          !machineCode.includes(q) &&
          !tplName.includes(q) &&
          !notes.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [executions, dateMode, selectedDate, selectedMachine, selectedResult, search]);

  // Statistics for the currently viewed date/filter
  const stats = useMemo(() => {
    const total = filtered.length;
    let passed = 0;
    let failed = 0;
    let inProgress = 0;
    const inspectorsSet = new Set<string>();

    filtered.forEach((item) => {
      const res = item.overall_result?.toLowerCase();
      if (item.status !== "completed") {
        inProgress++;
      } else if (res === "pass" || res === "ok" || res === "passed") {
        passed++;
      } else if (res === "fail" || res === "failed" || res === "attention") {
        failed++;
      } else {
        passed++;
      }

      if (item.performed_by_name?.trim()) {
        inspectorsSet.add(item.performed_by_name.trim());
      }
    });

    return {
      total,
      passed,
      failed,
      inProgress,
      inspectorsCount: inspectorsSet.size,
    };
  }, [filtered]);

  const parsedSelectedDate = parseISO(selectedDate);
  const formattedSelectedDay = isValid(parsedSelectedDate)
    ? format(parsedSelectedDate, "EEEE, d MMMM yyyy")
    : selectedDate;

  const isToday = selectedDate === todayStr && dateMode === "day";

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Machine Inspections</h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Maintenance
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Review daily pre-start, shift, and operational checklist inspections across all machinery.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} title="Refresh data">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
          <Button onClick={() => setStartDialogOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Start Inspection
          </Button>
        </div>
      </div>

      {/* Date Navigation Bar */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Date Mode Switcher */}
          <div className="flex flex-wrap items-center gap-1.5 bg-muted/60 p-1 rounded-xl">
            <Button
              size="sm"
              variant={dateMode === "day" && isToday ? "default" : "ghost"}
              onClick={handleSetToday}
              className="h-8 text-xs font-medium"
            >
              Today
            </Button>
            <Button
              size="sm"
              variant={dateMode === "day" && selectedDate === format(subDays(new Date(), 1), "yyyy-MM-dd") ? "default" : "ghost"}
              onClick={handleSetYesterday}
              className="h-8 text-xs font-medium"
            >
              Yesterday
            </Button>
            <Button
              size="sm"
              variant={dateMode === "week" ? "default" : "ghost"}
              onClick={() => setDateMode("week")}
              className="h-8 text-xs font-medium"
            >
              Last 7 Days
            </Button>
            <Button
              size="sm"
              variant={dateMode === "all" ? "default" : "ghost"}
              onClick={() => setDateMode("all")}
              className="h-8 text-xs font-medium"
            >
              All Records
            </Button>
          </div>

          {/* Single Day Date Picker & Day Flipper */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={handlePrevDay}
              title="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="relative flex items-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value);
                    setDateMode("day");
                  }
                }}
                className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={handleNextDay}
              title="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Selected Date Header Subtitle */}
        <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            {dateMode === "day" ? (
              <span>
                Showing inspections for:{" "}
                <strong className="text-primary font-semibold">{formattedSelectedDay}</strong>
                {isToday && " (Today)"}
              </span>
            ) : dateMode === "week" ? (
              <span>Showing inspections from the <strong>past 7 days</strong></span>
            ) : (
              <span>Showing <strong>all historical inspections</strong></span>
            )}
          </div>
          <div>
            Found <strong>{filtered.length}</strong> inspection{filtered.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Total Inspected
          </div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{stats.total}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {dateMode === "day" ? "Conducted this day" : "In selected range"}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Passed / OK
          </div>
          <div className="mt-1 text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
            {stats.passed}
          </div>
          <p className="mt-0.5 text-xs text-emerald-700/80 dark:text-emerald-400/80">
            Safe for operation
          </p>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-red-700 dark:text-red-400">
            Failed / Defects
          </div>
          <div className="mt-1 text-2xl font-semibold text-red-700 dark:text-red-400">
            {stats.failed}
          </div>
          <p className="mt-0.5 text-xs text-red-700/80 dark:text-red-400/80">
            Action required
          </p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-blue-700 dark:text-blue-400">
            Inspectors on Duty
          </div>
          <div className="mt-1 text-2xl font-semibold text-blue-700 dark:text-blue-400">
            {stats.inspectorsCount}
          </div>
          <p className="mt-0.5 text-xs text-blue-700/80 dark:text-blue-400/80">
            Technicians & operators
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by inspector name, machine, or defect notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        {/* Machine Filter */}
        <select
          value={selectedMachine}
          onChange={(e) => setSelectedMachine(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium"
        >
          <option value="all">All Machines</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} {m.category ? `(${m.category})` : ""}
            </option>
          ))}
        </select>

        {/* Result Filter */}
        <select
          value={selectedResult}
          onChange={(e) => setSelectedResult(e.target.value as any)}
          className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium"
        >
          <option value="all">All Inspection Results</option>
          <option value="passed">Passed / OK Only</option>
          <option value="failed">Failed / Attention Only</option>
          <option value="in_progress">In Progress Only</option>
        </select>
      </div>

      {/* Inspections Table / List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <ClipboardCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-3 text-base font-semibold text-foreground">
            No inspections found {dateMode === "day" ? `for ${formattedSelectedDay}` : ""}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            {isToday
              ? "No operator or technician has logged an inspection yet today."
              : `No inspection records were found for ${formattedSelectedDay}.`}
            {executions.length > 0 && dateMode === "day" && (
              <span className="block mt-1 font-medium text-foreground">
                There are {executions.length} inspection record{executions.length === 1 ? "" : "s"} logged on other dates.
              </span>
            )}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            {executions.length > 0 && dateMode === "day" && (
              <Button variant="outline" size="sm" onClick={() => setDateMode("all")}>
                View All Records ({executions.length})
              </Button>
            )}
            <Button size="sm" onClick={() => setStartDialogOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Start an Inspection
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
                  <th className="px-5 py-3.5">Conducted By (Inspector)</th>
                  <th className="px-5 py-3.5">Checklist Template</th>
                  <th className="px-5 py-3.5">Result</th>
                  <th className="px-5 py-3.5">Hours / Notes</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item) => {
                  const itemTime = item.performed_at
                    ? format(parseISO(item.performed_at), "h:mm a")
                    : "—";
                  const itemFullDate = item.performed_at
                    ? formatDate(item.performed_at)
                    : "—";

                  const res = item.overall_result?.toLowerCase();
                  const isPass = res === "pass" || res === "ok" || res === "passed";
                  const isFail = res === "fail" || res === "failed" || res === "attention";
                  const isCompleted = item.status === "completed";

                  return (
                    <tr key={item.id} className="transition-colors hover:bg-muted/30">
                      {/* Time & Date */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {itemTime}
                        </div>
                        {dateMode !== "day" && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {itemFullDate}
                          </div>
                        )}
                      </td>

                      {/* Machine */}
                      <td className="px-5 py-3.5">
                        <Link
                          to={`/machines/${item.machine_id}`}
                          className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                          <Wrench className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>{item.machines?.name ?? "Machine"}</span>
                        </Link>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                          {item.machines?.code && (
                            <span className="font-mono">{item.machines.code}</span>
                          )}
                          {item.machines?.category && (
                            <span className="rounded bg-muted px-1.5 py-0.2 text-[10px]">
                              {item.machines.category}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Inspector (Who does that) */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">
                            {initials(item.performed_by_name ?? "Technician")}
                          </div>
                          <div>
                            <div className="font-medium text-foreground text-xs">
                              {item.performed_by_name || "Unassigned"}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Technician / Operator
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Checklist Template */}
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-foreground text-xs flex items-center gap-1.5">
                          <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>{item.checklist_templates?.name ?? "Inspection Run"}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-0.5 inline-block">
                          Version {item.template_version}
                        </span>
                      </td>

                      {/* Result */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {!isCompleted ? (
                          <span className="status-pill status-due">
                            <Clock className="h-3 w-3" /> In progress
                          </span>
                        ) : isPass ? (
                          <span className="status-pill status-ok">
                            <CheckCircle2 className="h-3 w-3" /> Passed / OK
                          </span>
                        ) : isFail ? (
                          <span className="status-pill status-overdue">
                            <AlertTriangle className="h-3 w-3" /> Defect / Attention
                          </span>
                        ) : (
                          <span className="status-pill status-inactive capitalize">
                            {item.overall_result ?? "Completed"}
                          </span>
                        )}
                      </td>

                      {/* Hours & Notes */}
                      <td className="px-5 py-3.5 text-xs max-w-xs">
                        {item.hours_at_execution !== null && item.hours_at_execution !== undefined && (
                          <div className="font-mono text-muted-foreground">
                            {item.hours_at_execution} hrs
                          </div>
                        )}
                        {item.notes ? (
                          <p className="truncate text-muted-foreground" title={item.notes}>
                            {item.notes}
                          </p>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <Link to={`/inspections/${item.id}`}>
                          <Button size="sm" variant={isCompleted ? "outline" : "default"} className="h-8 gap-1 text-xs">
                            <Eye className="h-3.5 w-3.5" />
                            {isCompleted ? "View Report" : "Continue"}
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

      {/* Start Inspection Modal */}
      <StartInspectionModal
        open={startDialogOpen}
        onOpenChange={setStartDialogOpen}
        machines={machines}
        onStarted={(id) => navigate(`/inspections/${id}`)}
      />
    </div>
  );
}

// Modal for starting an inspection on any machine
function StartInspectionModal({
  open,
  onOpenChange,
  machines,
  onStarted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machines: { id: string; name: string; category?: string | null }[];
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
      if (machines.length > 0 && !selectedMachineId) {
        setSelectedMachineId(machines[0].id);
      }
      setInspectorName(profile?.full_name ?? "");
    }
  }, [open, machines, profile]);

  useEffect(() => {
    if (!selectedMachineId) {
      setTemplates([]);
      return;
    }

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
        if (filtered[0]) {
          setTemplateId(filtered[0].id);
        } else {
          setTemplateId("");
        }
        setLoadingTemplates(false);
      });
  }, [selectedMachineId, machines]);

  const handleStart = async () => {
    if (!selectedMachineId) return toast.error("Please select a machine");
    if (!templateId) return toast.error("Please select an approved checklist template");
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

      if (error || !exec) {
        throw new Error(error?.message || "Failed to create inspection execution");
      }

      // Initialize responses for each template item
      if (items && items.length > 0) {
        const rows = items.map((it: any) => ({
          execution_id: exec.id,
          template_item_id: it.id,
          item_title: it.title,
          item_description: it.description,
          item_type: it.item_type,
          is_mandatory: it.is_mandatory,
          critical_failure: it.critical_failure,
          sort_order: it.sort_order,
          result: "pending",
        }));
        await supabase.from("checklist_execution_responses").insert(rows);
      }

      toast.success("Inspection started!");
      onOpenChange(false);
      onStarted(exec.id);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to start inspection");
    } finally {
      setStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start Equipment Inspection</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Select Machine / Equipment</Label>
            <select
              value={selectedMachineId}
              onChange={(e) => setSelectedMachineId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— Select machine —</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.category ? `· ${m.category}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Checklist Template</Label>
            {loadingTemplates ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading matching templates...
              </div>
            ) : templates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                No approved checklist templates found for this machine category. Create one in Checklist Templates first.
              </div>
            ) : (
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (v{t.version})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Inspector Name</Label>
            <Input
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              placeholder="e.g. John Doe"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Current Machine Hours (optional)</Label>
            <Input
              type="number"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. 1250"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleStart}
            disabled={starting || !selectedMachineId || !templateId}
          >
            {starting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Play className="mr-1.5 h-4 w-4" /> Start Inspection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
