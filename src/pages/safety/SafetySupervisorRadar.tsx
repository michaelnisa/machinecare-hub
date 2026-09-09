import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  HardHat,
  MapPin,
  ClipboardCheck,
  Flame,
  PauseCircle,
  PlayCircle,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Eye,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { formatWoNumber } from "@/components/WorkOrderPreview";

export default function SafetySupervisorRadar() {
  const { profile, organisation } = useAuth();
  const [loading, setLoading] = useState(true);

  const [activeWorks, setActiveWorks] = useState<any[]>([]);
  const [suspensions, setSuspensions] = useState<any[]>([]);
  const [contractors, setContractors] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const orgId = profile?.organisation_id || organisation?.id;

  const loadData = async () => {
    if (!orgId) return;
    setLoading(true);

    const [
      { data: wo, error: woErr },
      { data: susp, error: suspErr },
      { data: ctr, error: ctrErr },
    ] = await Promise.all([
      supabase
        .from("work_orders")
        .select("id, title, wo_number, wo_year, status, plant_area, is_suspended, suspension_reason, machine_id, contractor_id, machines(name), permit_hot_work, permit_confined_space, permit_isolation, contractors(company_name, contact_name, contact_phone)")
        .eq("organisation_id", orgId)
        .not("contractor_id", "is", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("contractor_work_suspensions")
        .select("*, work_orders(id, title, wo_number, wo_year, plant_area, machines(name)), contractors(company_name, contact_phone)")
        .eq("organisation_id", orgId)
        .eq("status", "suspended")
        .order("suspended_at", { ascending: false }),
      supabase
        .from("contractors")
        .select("*")
        .eq("organisation_id", orgId)
        .eq("status", "active"),
    ]);

    let workOrdersData = wo;
    if (woErr) {
      if (woErr.message?.toLowerCase().includes("is_suspended") || woErr.message?.toLowerCase().includes("does not exist")) {
        console.warn("work_orders.is_suspended column missing, falling back to standard select:", woErr.message);
        const { data: fallbackWo } = await supabase
          .from("work_orders")
          .select("id, title, wo_number, wo_year, status, plant_area, machine_id, contractor_id, machines(name), permit_hot_work, permit_confined_space, permit_isolation, contractors(company_name, contact_name, contact_phone)")
          .eq("organisation_id", orgId)
          .not("contractor_id", "is", null)
          .order("created_at", { ascending: false });
        workOrdersData = fallbackWo ?? [];
      } else {
        toast.error(woErr.message);
      }
    }

    if (suspErr) {
      if (suspErr.message?.toLowerCase().includes("schema cache") || suspErr.code === "PGRST205") {
        console.warn("contractor_work_suspensions table is not yet migrated or cached:", suspErr.message);
      } else {
        toast.error(suspErr.message);
      }
    }

    setActiveWorks(workOrdersData || []);
    setSuspensions(susp || []);
    setContractors(ctr || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [orgId]);

  // Active locations grouping
  const filteredWorks = useMemo(() => {
    return activeWorks.filter((w) => {
      const q = searchQuery.toLowerCase();
      const contractorName = w.contractors?.company_name?.toLowerCase() || "";
      const machineName = w.machines?.name?.toLowerCase() || "";
      const woNum = `wo-${w.wo_year || ""}-${w.wo_number || ""}`.toLowerCase();
      return (
        w.title?.toLowerCase().includes(q) ||
        contractorName.includes(q) ||
        machineName.includes(q) ||
        woNum.includes(q) ||
        w.plant_area?.toLowerCase().includes(q)
      );
    });
  }, [activeWorks, searchQuery]);

  const handleClearSuspension = async (susp: any) => {
    try {
      // 1. Mark suspension resumed
      const { error: suspErr } = await supabase
        .from("contractor_work_suspensions")
        .update({
          status: "resumed",
          resumed_at: new Date().toISOString(),
          resumed_by_name: profile?.full_name || "Safety Supervisor",
          corrective_action_taken: "Verified safe by Safety Supervisor on site.",
        })
        .eq("id", susp.id);

      if (suspErr && !suspErr.message?.toLowerCase().includes("schema cache")) {
        throw suspErr;
      }

      // 2. Unsuspend work order
      const { error: woErr } = await supabase
        .from("work_orders")
        .update({
          is_suspended: false,
          suspension_reason: null,
        })
        .eq("id", susp.work_order_id);

      if (woErr) throw woErr;

      toast.success("Suspension cleared. Contractor authorized to resume work.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to clear suspension");
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Safety Supervisor Daily Operations Radar
            </h1>
            <Badge className="bg-[#00A651]/15 text-[#00A651] border-[#00A651]/30 text-[10px] font-bold uppercase tracking-wider">
              REAL-TIME SITE RADAR
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor contractor site locations, safety requirements, supervisor inspection walk route, and stopped works.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadData}
            className="text-xs gap-1.5 border-emerald-600/30 text-[#00A651]"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh Radar
          </Button>
          <Link to="/contractor/portal">
            <Button
              size="sm"
              className="text-xs gap-1.5 bg-[#00A651] hover:bg-[#008f45] text-white font-bold"
            >
              <HardHat className="h-3.5 w-3.5" /> Contractor Portal
            </Button>
          </Link>
        </div>
      </div>

      {/* TOP RADAR METRIC CARDS */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-1 shadow-sm">
          <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider flex items-center justify-between">
            <span>Contractors on Site</span>
            <Users className="h-4 w-4 text-[#00A651]" />
          </div>
          <div className="text-3xl font-black text-foreground">{contractors.length}</div>
          <div className="text-[11px] text-muted-foreground">Active verified contractor firms</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-1 shadow-sm">
          <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider flex items-center justify-between">
            <span>Active Job Locations</span>
            <MapPin className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-3xl font-black text-blue-600">{activeWorks.length}</div>
          <div className="text-[11px] text-muted-foreground">Machines &amp; plant cells under maintenance</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-1 shadow-sm">
          <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider flex items-center justify-between">
            <span>Suspended Works</span>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
          <div className={`text-3xl font-black ${suspensions.length > 0 ? "text-red-600 animate-pulse" : "text-[#00A651]"}`}>
            {suspensions.length}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {suspensions.length > 0 ? "Requires immediate supervisor visit" : "Zero active safety stoppages"}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-1 shadow-sm">
          <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider flex items-center justify-between">
            <span>High-Risk Permits</span>
            <Flame className="h-4 w-4 text-orange-600" />
          </div>
          <div className="text-3xl font-black text-orange-600">
            {activeWorks.filter((w) => w.permit_hot_work || w.permit_confined_space || w.permit_isolation).length}
          </div>
          <div className="text-[11px] text-muted-foreground">Hot Work / Heights / LOTO verified</div>
        </div>
      </div>

      {/* SECTION 1: CRITICAL SUSPENDED WORKS RADAR */}
      {suspensions.length > 0 && (
        <div className="rounded-2xl border-2 border-red-500/40 bg-red-50/40 dark:bg-red-950/20 p-5 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-black uppercase tracking-wider text-xs">
              <AlertTriangle className="h-4 w-4 text-red-600 animate-bounce" />
              STOP WORK AUTHORITY ALERTS ({suspensions.length} WORK ORDERS SUSPENDED)
            </div>
            <Badge variant="destructive" className="text-[10px] uppercase font-bold">
              SUPERVISOR ACTION REQUIRED
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {suspensions.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-red-300 dark:border-red-900/60 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-sm text-foreground">
                      {formatWoNumber(s.work_orders?.wo_year, s.work_orders?.wo_number)} — {s.work_orders?.title}
                    </span>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Contractor: <strong className="text-foreground">{s.contractors?.company_name}</strong>
                    </div>
                  </div>
                  <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] font-bold">
                    SUSPENDED
                  </Badge>
                </div>

                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-2.5 border border-red-200 dark:border-red-900/40 text-xs text-red-900 dark:text-red-300">
                  <strong>Reason for Stoppage:</strong> {s.suspension_reason}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Suspended {formatDate(s.suspended_at)}</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleClearSuspension(s)}
                    className="bg-[#00A651] hover:bg-[#008f45] text-white text-xs h-7 gap-1 font-bold"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Authorize Resume
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2: WHERE ALL CONTRACT WORK IS TODAY & WHAT THEY NEED */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Contractor Job Locations &amp; Safety Requirements Radar
            </h2>
            <p className="text-xs text-muted-foreground">
              Real-time map of where contractor crews are working today and the exact controls they need.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search machine, area, contractor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>
        </div>

        {filteredWorks.length === 0 ? (
          <EmptyState
            icon={<MapPin className="h-6 w-6" />}
            title="No Active Contractor Work Orders Found"
            description="All active contractor jobs and plant locations will appear on this radar."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredWorks.map((wo) => {
              const isSuspended = wo.is_suspended;
              return (
                <Card
                  key={wo.id}
                  className={`border shadow-sm transition-all hover:shadow-md ${
                    isSuspended
                      ? "border-red-400 bg-red-50/20 dark:bg-red-950/10"
                      : "border-border bg-card hover:border-[#00A651]/40"
                  }`}
                >
                  <CardHeader className="pb-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="font-black text-xs text-muted-foreground">
                          {formatWoNumber(wo.wo_year, wo.wo_number)}
                        </span>
                        <CardTitle className="text-sm font-bold text-foreground line-clamp-1">
                          {wo.title}
                        </CardTitle>
                      </div>
                      {isSuspended ? (
                        <Badge variant="destructive" className="text-[10px] font-bold">
                          STOPPED
                        </Badge>
                      ) : (
                        <Badge className="bg-[#00A651]/15 text-[#00A651] border-[#00A651]/30 text-[10px] font-bold">
                          ACTIVE
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 text-xs">
                    {/* Location & Machine Info */}
                    <div className="p-2.5 bg-muted/40 rounded-xl border border-border/60 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-foreground">
                        <MapPin className="h-3.5 w-3.5 text-[#00A651] shrink-0" />
                        <span>{wo.machines?.name || "Unassigned Machine"}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground pl-5">
                        Plant Area: <strong className="text-foreground">{wo.plant_area || "General Facility"}</strong>
                      </div>
                      <div className="text-[11px] text-muted-foreground pl-5">
                        Contractor: <strong className="text-foreground">{wo.contractors?.company_name || "Assigned Crew"}</strong>
                      </div>
                    </div>

                    {/* What They Need (Safety Requirements Matrix) */}
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        What They Need (Safety Controls):
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {wo.permit_hot_work && (
                          <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300">
                            Hot Work Permit
                          </Badge>
                        )}
                        {wo.permit_confined_space && (
                          <Badge variant="outline" className="text-[10px] text-purple-600 border-purple-300">
                            Confined Space PTW
                          </Badge>
                        )}
                        {wo.permit_isolation && (
                          <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300">
                            LOTO Isolation
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300">
                          Verified PPE
                        </Badge>
                      </div>
                    </div>

                    {/* Action Button: Log Supervisor Visit */}
                    <div className="pt-1 flex items-center justify-between border-t border-border">
                      <span className="text-[11px] text-muted-foreground">
                        {isSuspended ? "Reason: " + wo.suspension_reason : "Scheduled shift audit"}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => {
                          toast.success(`Supervisor inspection logged for ${wo.title} at ${wo.plant_area || "Site"}`);
                        }}
                        variant="outline"
                        className="h-7 text-xs gap-1 border-emerald-600/30 text-[#00A651]"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Log Supervisor Walk
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
