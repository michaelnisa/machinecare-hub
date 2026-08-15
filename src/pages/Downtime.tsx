import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { differenceInMinutes } from "date-fns";
import {
  AlertOctagon,
  ExternalLink,
  Plus,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const REASONS = [
  { value: "breakdown", label: "Breakdown" },
  { value: "electrical", label: "Electrical" },
  { value: "mechanical", label: "Mechanical" },
  { value: "operator_error", label: "Operator error" },
  { value: "no_parts", label: "Waiting on parts" },
  { value: "other", label: "Other" },
];

function reasonLabel(v: string) {
  return REASONS.find((r) => r.value === v)?.label ?? v;
}

function durationLabel(startedAt: string, endedAt: string | null) {
  const mins = differenceInMinutes(
    endedAt ? new Date(endedAt) : new Date(),
    new Date(startedAt),
  );
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export default function Downtime() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [machines, setMachines] = useState<
    { id: string; name: string; current_hours: number | null }[]
  >([]);
  const [filter, setFilter] = useState<"all" | "ongoing" | "resolved">("all");
  const [logOpen, setLogOpen] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: e, error }, { data: m }] = await Promise.all([
      (supabase as any)
        .from("machine_downtime_events")
        .select("*, machines(id, name)")
        .order("started_at", { ascending: false }),
      supabase.from("machines").select("id, name, current_hours").order("name"),
    ]);
    if (error) console.error(error);
    setEvents(e ?? []);
    setMachines(m ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (profile) load();
  }, [profile]);

  const filtered = useMemo(() => {
    if (filter === "ongoing") return events.filter((e) => !e.ended_at);
    if (filter === "resolved") return events.filter((e) => !!e.ended_at);
    return events;
  }, [events, filter]);

  const ongoingCount = events.filter((e) => !e.ended_at).length;
  const thisMonthMinutes = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => {
        const d = new Date(e.started_at);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth()
        );
      })
      .reduce(
        (sum, e) =>
          sum +
          differenceInMinutes(
            e.ended_at ? new Date(e.ended_at) : now,
            new Date(e.started_at),
          ),
        0,
      );
  }, [events]);

  const resolve = async (id: string) => {
    setResolving(id);
    const { error } = await (supabase as any)
      .from("machine_downtime_events")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", id);
    setResolving(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Marked resolved");
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Downtime</h1>
          <p className="text-sm text-muted-foreground">
            Every breakdown, start to finish — with a root cause, not just a
            shift-level number.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All events</option>
            <option value="ongoing">Ongoing</option>
            <option value="resolved">Resolved</option>
          </select>
          <Button onClick={() => setLogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Log breakdown
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-red-700">
            Machines down right now
          </div>
          <div className="mt-1 text-2xl font-semibold text-red-700">
            {ongoingCount}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Downtime this month
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {Math.floor(thisMonthMinutes / 60)}h {thisMonthMinutes % 60}m
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<AlertOctagon className="h-5 w-5" />}
          title="No downtime events"
          description="Log a breakdown to start tracking root causes and duration."
          action={
            <Button onClick={() => setLogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Log breakdown
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Machine</th>
                  <th className="px-5 py-3 font-medium">Reason</th>
                  <th className="px-5 py-3 font-medium">Started</th>
                  <th className="px-5 py-3 font-medium">Duration</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ev) => (
                  <tr key={ev.id} className="border-t border-border">
                    <td className="px-5 py-3">
                      <Link
                        to={`/machines/${ev.machines?.id}`}
                        className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {ev.machines?.name ?? "—"}{" "}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                        {reasonLabel(ev.reason)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {formatDate(ev.started_at)}
                    </td>
                    <td className="px-5 py-3">
                      {durationLabel(ev.started_at, ev.ended_at)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "status-pill",
                          ev.ended_at ? "status-ok" : "status-overdue",
                        )}
                      >
                        {ev.ended_at ? "Resolved" : "Ongoing"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {!ev.ended_at && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resolve(ev.id)}
                          disabled={resolving === ev.id}
                        >
                          {resolving === ev.id ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                          )}
                          Mark resolved
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <LogBreakdownDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        machines={machines}
        orgId={profile?.organisation_id}
        onSaved={load}
      />
    </div>
  );
}

function LogBreakdownDialog({
  open,
  onOpenChange,
  machines,
  orgId,
  onSaved,
}: any) {
  const [submitting, setSubmitting] = useState(false);
  const [machineId, setMachineId] = useState("");
  const [reason, setReason] = useState("breakdown");
  const [startedAt, setStartedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [reading, setReading] = useState("");

  const selectedMachine = machines.find((m: any) => m.id === machineId);

  useEffect(() => {
    if (open) {
      setMachineId("");
      setReason("breakdown");
      setStartedAt(new Date().toISOString().slice(0, 16));
      setNotes("");
      setReading("");
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineId) return toast.error("Pick a machine");
    setSubmitting(true);
    const startedIso = new Date(startedAt).toISOString();
    const { error } = await (supabase as any)
      .from("machine_downtime_events")
      .insert({
        organisation_id: orgId,
        machine_id: machineId,
        reason,
        started_at: startedIso,
        notes: notes.trim() || null,
      });
    if (error) {
      setSubmitting(false);
      return toast.error(error.message);
    }
    if (reading.trim()) {
      const { error: readingError } = await supabase
        .from("meter_readings")
        .insert({
          organisation_id: orgId,
          machine_id: machineId,
          reading: Number(reading),
          reading_date: startedIso.slice(0, 10),
          notes: "Logged during breakdown",
        });
      if (readingError)
        toast.error(
          `Breakdown logged, but reading failed: ${readingError.message}`,
        );
    }
    setSubmitting(false);
    toast.success("Breakdown logged");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a breakdown</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Machine *</Label>
            <select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select machine</option>
              {machines.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Started at</Label>
            <Input
              type="datetime-local"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
            />
          </div>
          {machineId && (
            <div className="space-y-1.5">
              <Label>Odometer / hours reading</Label>
              <Input
                type="number"
                step="any"
                value={reading}
                onChange={(e) => setReading(e.target.value)}
                placeholder={
                  selectedMachine?.current_hours != null
                    ? `Last logged: ${selectedMachine.current_hours}`
                    : "Optional"
                }
              />
              <p className="text-xs text-muted-foreground">
                If given, this also feeds PM Schedules' usage-based due-date
                prediction.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What happened?"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{" "}
              Log breakdown
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
