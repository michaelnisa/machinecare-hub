import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLoader } from "@/components/PageLoader";
import { VendorContactButtons } from "@/components/VendorContactButtons";
import { ArrowLeft, Building2, Clock, AlertTriangle, DollarSign, ClipboardList, Mail, MapPin, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatTZS } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  returned: "bg-emerald-100 text-emerald-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-muted text-muted-foreground",
};

export default function VendorDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { isManager } = useUserRole();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [machines, setMachines] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!id || !profile) return;
    setLoading(true);
    const [{ data: v }, { data: o }, { data: m }] = await Promise.all([
      supabase.from("vendors").select("*").eq("id", id).maybeSingle(),
      supabase.from("work_orders")
        .select("id, machine_id, title, description, status, sent_date, promised_date, returned_date, vendor_cost, warranty_days, had_comeback, created_at")
        .eq("is_outsourced", true).eq("vendor_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("machines").select("id, name"),
    ]);
    setVendor(v);
    setJobs(o ?? []);
    const map: Record<string, string> = {};
    (m ?? []).forEach((row: any) => { map[row.id] = row.name; });
    setMachines(map);
    setNotes(v?.notes ?? "");
    setLoading(false);
  };

  useEffect(() => { load(); }, [id, profile]);

  const stats = useMemo(() => {
    let returned = 0, onTime = 0, comebacks = 0, total = 0, sumTAT = 0, tatCount = 0;
    for (const j of jobs) {
      if (j.had_comeback) comebacks += 1;
      if (j.vendor_cost) total += Number(j.vendor_cost);
      if (j.returned_date) {
        returned += 1;
        if (j.promised_date && new Date(j.returned_date) <= new Date(j.promised_date)) onTime += 1;
        if (j.sent_date) {
          const d = (new Date(j.returned_date).getTime() - new Date(j.sent_date).getTime()) / 86400000;
          if (d >= 0) { sumTAT += d; tatCount += 1; }
        }
      }
    }
    return {
      jobs: jobs.length,
      returned,
      onTime: returned ? Math.round((onTime / returned) * 100) : null,
      comeback: jobs.length ? Math.round((comebacks / jobs.length) * 100) : null,
      avgTAT: tatCount ? Math.round(sumTAT / tatCount) : null,
      totalCost: total,
    };
  }, [jobs]);

  const saveNotes = async () => {
    if (!vendor) return;
    setSaving(true);
    const { error } = await supabase.from("vendors").update({ notes }).eq("id", vendor.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Notes saved");
  };

  if (loading) return <PageLoader />;
  if (!vendor) return (
    <div className="space-y-3">
      <Button variant="ghost" onClick={() => navigate("/vendors")}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Vendor not found.</div>
    </div>
  );

  const enoughForColor = stats.returned >= 3;

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate("/vendors")} className="-ml-2">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to vendors
      </Button>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{vendor.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {vendor.category && <span>{vendor.category}</span>}
                {!vendor.active && <span className="rounded bg-muted px-2 py-0.5 text-xs">Inactive</span>}
              </div>
              {vendor.specialties && <div className="mt-2 text-sm text-muted-foreground">{vendor.specialties}</div>}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                {vendor.contact_name && <span>{vendor.contact_name}</span>}
                {vendor.email && <span className="inline-flex items-center gap-1 text-muted-foreground"><Mail className="h-3.5 w-3.5" />{vendor.email}</span>}
                {vendor.address && <span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{vendor.address}</span>}
              </div>
            </div>
          </div>
          <VendorContactButtons phone={vendor.phone} size="md" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat icon={<ClipboardList className="h-4 w-4" />} label="Jobs" value={stats.jobs} />
        <Stat
          icon={<Clock className="h-4 w-4" />}
          label="On-time %"
          value={stats.onTime == null ? "—" : `${stats.onTime}%`}
          tone={stats.onTime == null || !enoughForColor ? "mute" : stats.onTime >= 80 ? "good" : stats.onTime >= 50 ? "warn" : "bad"}
          caption={stats.onTime == null ? "After first returned job" : !enoughForColor ? `${stats.returned} returned` : undefined}
        />
        <Stat
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Comeback %"
          value={stats.comeback == null ? "—" : `${stats.comeback}%`}
          tone={stats.comeback == null || stats.jobs < 3 ? "mute" : stats.comeback <= 5 ? "good" : stats.comeback <= 15 ? "warn" : "bad"}
          caption={stats.jobs < 3 ? `${stats.jobs} jobs` : undefined}
        />
        <Stat icon={<Clock className="h-4 w-4" />} label="Avg turnaround" value={stats.avgTAT == null ? "—" : `${stats.avgTAT} d`} />
        <Stat icon={<DollarSign className="h-4 w-4" />} label="Total spend" value={stats.totalCost ? formatTZS(stats.totalCost) : "—"} />
      </div>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Job history</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-4">
          <div className="rounded-xl border border-border bg-card">
            {jobs.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No jobs recorded for this vendor yet.</div>
            ) : (
              <ol className="relative space-y-0">
                {jobs.map((j, i) => {
                  const overdue = !j.returned_date && j.promised_date && new Date(j.promised_date) < new Date() && j.status !== "completed" && j.status !== "cancelled";
                  return (
                    <li key={j.id} className={cn("relative grid grid-cols-[12px_1fr] gap-4 border-b border-border p-5 last:border-b-0")}>
                      <div className="relative">
                        <div className={cn("absolute left-1 top-2 h-2.5 w-2.5 rounded-full", overdue ? "bg-red-500" : j.returned_date ? "bg-emerald-500" : "bg-amber-500")} />
                        {i < jobs.length - 1 && <div className="absolute left-[7px] top-5 h-full w-px bg-border" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium">{j.title}</div>
                          <span className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${STATUS_CLASS[j.status] ?? "bg-muted"}`}>{j.status.replace("_", " ")}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {j.machine_id && machines[j.machine_id] ? `${machines[j.machine_id]} • ` : ""}
                          Sent {formatDate(j.sent_date)} → due {formatDate(j.promised_date)}
                          {j.returned_date && ` → returned ${formatDate(j.returned_date)}`}
                        </div>
                        {j.description && <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{j.description}</div>}
                        <div className="mt-2 flex flex-wrap gap-4 text-xs">
                          {j.vendor_cost && <span className="tabular-nums">{formatTZS(j.vendor_cost)}</span>}
                          {j.warranty_days != null && <span className="text-muted-foreground">Warranty {j.warranty_days}d</span>}
                          {j.had_comeback && <span className="text-red-600">Comeback</span>}
                          {overdue && <span className="rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-700">Overdue</span>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Internal notes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={8}
                disabled={!isManager}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Pricing notes, contact preferences, history, complaints…"
                maxLength={4000}
              />
              {isManager && (
                <div className="flex justify-end">
                  <Button onClick={saveNotes} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save notes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ icon, label, value, tone, caption }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone?: "good" | "warn" | "bad" | "mute"; caption?: string }) {
  const toneCls = tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : tone === "bad" ? "text-red-600" : tone === "mute" ? "text-muted-foreground" : "";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-semibold tabular-nums", toneCls)}>{value}</div>
        {caption && <div className="mt-1 text-[11px] text-muted-foreground">{caption}</div>}
      </CardContent>
    </Card>
  );
}
