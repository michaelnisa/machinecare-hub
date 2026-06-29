import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ClipboardList, Plus, Trash2, Printer, AlertTriangle, ExternalLink, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatWoNumber } from "@/components/WorkOrderPreview";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting_parts", label: "Waiting parts" },
  { value: "done", label: "Done" },
  { value: "closed", label: "Closed" },
];

const WORK_TYPES = ["breakdown", "preventive", "inspection", "repair", "modification"];

const PRIORITY_BORDER: Record<string, string> = {
  low: "border-l-slate-400",
  normal: "border-l-blue-500",
  high: "border-l-amber-500",
  critical: "border-l-red-500",
  urgent: "border-l-red-500",
};

const STATUS_BADGE: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  assigned: "bg-indigo-100 text-indigo-700",
  in_progress: "bg-amber-100 text-amber-700",
  waiting_parts: "bg-purple-100 text-purple-700",
  done: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-100 text-slate-700",
};

export default function WorkOrders() {
  const { profile } = useAuth();
  const { isManager } = useUserRole();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string }[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string | null }[]>([]);
  const [tab, setTab] = useState<string>("all");
  const [machineFilter, setMachineFilter] = useState<string>(params.get("machine") ?? "all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: o, error }, { data: m }, { data: p }] = await Promise.all([
      supabase.from("work_orders").select("*").order("created_at", { ascending: false }),
      supabase.from("machines").select("id,name").order("name"),
      supabase.from("profiles").select("id, full_name").eq("organisation_id", profile.organisation_id),
    ]);
    if (error) toast.error(error.message);
    const mm = new Map((m ?? []).map((x) => [x.id, x.name]));
    setOrders((o ?? []).map((x) => ({ ...x, machine_name: mm.get(x.machine_id) })));
    setMachines(m ?? []);
    setMembers(p ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  useEffect(() => {
    const machine = params.get("machine");
    if (machine) setMachineFilter(machine);
  }, [params]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    STATUS_TABS.forEach((s) => { if (s.value !== "all") c[s.value] = orders.filter((o) => o.status === s.value).length; });
    return c;
  }, [orders]);

  const memberName = (id?: string | null) => members.find((m) => m.id === id)?.full_name ?? "Unassigned";

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (tab !== "all" && o.status !== tab) return false;
      if (machineFilter !== "all" && o.machine_id !== machineFilter) return false;
      if (assigneeFilter !== "all" && (o.assignee_id ?? "") !== assigneeFilter) return false;
      if (typeFilter !== "all" && o.work_type !== typeFilter) return false;
      if (ql) {
        const num = formatWoNumber(o.wo_year, o.wo_number).toLowerCase();
        const hay = `${num} ${o.title ?? ""}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [orders, tab, machineFilter, assigneeFilter, typeFilter, q]);

  const handleDelete = async () => {
    if (!confirm) return;
    const { error } = await supabase.from("work_orders").delete().eq("id", confirm);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setConfirm(null);
    load();
  };

  if (loading) return <PageLoader />;

  const isOverdue = (o: any) => o.due_date && new Date(o.due_date) < new Date() && !["done", "closed"].includes(o.status);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Work orders</h1>
          <p className="text-sm text-muted-foreground">Track jobs from open through to closed.</p>
        </div>
        {isManager && (
          <Button asChild>
            <Link to="/work-orders/new"><Plus className="mr-2 h-4 w-4" /> New work order</Link>
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((s) => (
          <button
            key={s.value}
            onClick={() => setTab(s.value)}
            className={[
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tab === s.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent",
            ].join(" ")}
          >
            {s.label} <span className="ml-1 opacity-70">({counts[s.value] ?? 0})</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search WO# or title…" className="pl-8" />
        </div>
        <select value={machineFilter} onChange={(e) => { setMachineFilter(e.target.value); if (e.target.value === "all") setParams({}); }} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All machines</option>
          {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All assignees</option>
          <option value="">Unassigned</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.full_name ?? "—"}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All types</option>
          {WORK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="No work orders" description="Create a work order to assign maintenance jobs." />
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => (
            <Link
              key={o.id}
              to={`/work-orders/${o.id}`}
              className={[
                "flex items-center gap-4 rounded-lg border border-border border-l-4 bg-card px-4 py-3 transition-colors hover:bg-accent/30",
                PRIORITY_BORDER[o.priority] ?? "border-l-slate-400",
              ].join(" ")}
            >
              <div className="min-w-[110px] font-mono text-xs text-muted-foreground">{formatWoNumber(o.wo_year, o.wo_number)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{o.title}</span>
                  {o.is_outsourced && <span className="rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-purple-700">Outsourced</span>}
                  {isOverdue(o) && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                      <AlertTriangle className="h-3 w-3" /> Overdue
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {o.machine_name ?? "—"} · {o.work_type ?? "—"} · {memberName(o.assignee_id)} · due {formatDate(o.due_date)}
                </div>
              </div>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_BADGE[o.status] ?? ""}`}>
                {(o.status ?? "").replace("_", " ")}
              </span>
              <Button variant="ghost" size="icon" asChild onClick={(e) => e.stopPropagation()} title="Print">
                <Link to={`/work-orders/${o.id}/print`} onClick={(e) => e.stopPropagation()}>
                  <Printer className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" asChild title="Open">
                <span><ExternalLink className="h-4 w-4" /></span>
              </Button>
              {isManager && (
                <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirm(o.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </Link>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Delete this work order?"
        description="This action cannot be undone."
        onConfirm={async () => { await handleDelete(); }}
      />
    </div>
  );
}
