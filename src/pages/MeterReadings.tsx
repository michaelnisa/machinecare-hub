import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { UpdateReadingDialog } from "@/components/UpdateReadingDialog";
import { formatDate, formatNumber } from "@/lib/format";
import { differenceInDays, parseISO } from "date-fns";
import { Activity, ExternalLink, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MeterReadings() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [readings, setReadings] = useState<any[]>([]);
  const [machineFilter, setMachineFilter] = useState<string>("all");
  const [machines, setMachines] = useState<{ id: string; name: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: m }] = await Promise.all([
      supabase
        .from("meter_readings")
        .select("*, machines(id, name, category)")
        .eq("organisation_id", profile!.organisation_id)
        .order("reading_date", { ascending: false }),
      supabase.from("machines").select("id, name").order("name"),
    ]);
    if (error) console.error(error);
    setReadings(data ?? []);
    setMachines(m ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (profile) load();
  }, [profile]);

  const latestByMachine = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of readings) {
      const key = r.machine_id;
      if (!map.has(key)) map.set(key, r);
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.machines?.name ?? "").localeCompare(b.machines?.name ?? ""),
    );
  }, [readings]);

  const staleCount = latestByMachine.filter(
    (r) => differenceInDays(new Date(), parseISO(r.reading_date)) > 30,
  ).length;

  const machineOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of readings) {
      if (r.machines?.id && !seen.has(r.machines.id))
        seen.set(r.machines.id, r.machines.name);
    }
    return Array.from(seen.entries());
  }, [readings]);

  const filteredHistory = useMemo(() => {
    if (machineFilter === "all") return readings;
    return readings.filter((r) => r.machine_id === machineFilter);
  }, [readings, machineFilter]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Meter Readings
          </h1>
          <p className="text-sm text-muted-foreground">
            Odometer & hour-meter readings across all machines, with staleness
            at a glance.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Record reading
        </Button>
      </div>

      {staleCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Activity className="h-4 w-4" />
          {staleCount} {staleCount === 1 ? "machine has" : "machines have"} no
          reading in the last 30 days.
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          Latest reading per machine
        </h2>
        {latestByMachine.length === 0 ? (
          <EmptyState
            icon={<Activity className="h-5 w-5" />}
            title="No readings yet"
            description="Record an odometer or hour-meter reading to start tracking machine usage."
            action={
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Record reading
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
                    <th className="px-5 py-3 font-medium">Latest reading</th>
                    <th className="px-5 py-3 font-medium">Recorded</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {latestByMachine.map((r) => {
                    const daysSince = differenceInDays(
                      new Date(),
                      parseISO(r.reading_date),
                    );
                    const stale = daysSince > 30;
                    return (
                      <tr key={r.machine_id} className="border-t border-border">
                        <td className="px-5 py-3 font-medium">
                          {r.machines?.name ?? "—"}
                        </td>
                        <td className="px-5 py-3">{formatNumber(r.reading)}</td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {formatDate(r.reading_date)}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              "status-pill",
                              stale ? "status-overdue" : "status-ok",
                            )}
                          >
                            {stale ? `${daysSince}d stale` : "Up to date"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            to={`/machines/${r.machine_id}`}
                            className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                          >
                            Open machine <ExternalLink className="h-3 w-3" />
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

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Reading history
          </h2>
          <select
            value={machineFilter}
            onChange={(e) => setMachineFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All machines</option>
            {machineOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        {filteredHistory.length === 0 ? (
          <EmptyState
            icon={<Activity className="h-5 w-5" />}
            title="No readings"
            description="No meter readings recorded yet."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Machine</th>
                    <th className="px-5 py-3 font-medium">Reading</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-5 py-3 text-muted-foreground">
                        {r.machines?.name ?? "—"}
                      </td>
                      <td className="px-5 py-3 font-medium">
                        {formatNumber(r.reading)}
                      </td>
                      <td className="px-5 py-3">
                        {formatDate(r.reading_date)}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {r.notes ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <UpdateReadingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        machines={machines}
        currentHours={null}
        onSaved={load}
      />
    </div>
  );
}
