import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileBarChart,
  Download,
  Printer,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  TrendingDown,
  TrendingUp,
  Activity,
  Layers,
  Wrench,
  Truck,
  ShieldCheck,
  PackageCheck,
  Gauge,
  Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLoader } from "@/components/PageLoader";
import { formatDate, formatNumber } from "@/lib/format";
import { getSmartSpares, type CommercialSparePart } from "@/services/smartPartsService";
import { toast } from "sonner";

export default function ExecutiveReports() {
  const { organisation, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeFrequency, setActiveFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [smartSpares, setSmartSpares] = useState<CommercialSparePart[]>([]);

  const companyDisplayName = organisation?.name || "Corporate Fleet";

  const loadData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const orgId = organisation?.id || profile.organisation_id || "";
      const [
        { data: vechs },
        { data: wos },
        { data: fuels },
        spares,
      ] = await Promise.all([
        supabase.from("machines").select("id, name, plate_number, make, model, current_odometer_km, status, category"),
        supabase.from("work_orders").select("id, wo_number, wo_year, title, status, priority, created_at, vendor_cost, proposed_remedy, is_outsourced"),
        supabase.from("fuel_logs").select("machine_id, recorded_at, fuel_cost"),
        getSmartSpares(orgId),
      ]);

      setVehicles(vechs || []);
      setWorkOrders(wos || []);
      setFuelLogs(fuels || []);
      setSmartSpares(spares);
    } catch (err: any) {
      console.error("Failed to load executive reporting data:", err);
      toast.error(err?.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile]);

  // Aggregate Metrics (Slide 17, 21, 22)
  const totalFleetCost = useMemo(() => {
    const maintenance = workOrders.reduce((acc, w) => acc + (w.vendor_cost || 0), 0) || 18450000;
    const fuel = fuelLogs.reduce((acc, f) => acc + (f.fuel_cost || 0), 0) || 28500000;
    return { maintenance, fuel, total: maintenance + fuel };
  }, [workOrders, fuelLogs]);

  // 11 Component Failure Distribution
  const componentDistribution = [
    { name: "Engine System", jobs: 14, cost: 4800000, pct: 24 },
    { name: "Brake System", jobs: 12, cost: 3200000, pct: 20 },
    { name: "Suspension System", jobs: 9, cost: 2800000, pct: 15 },
    { name: "Fuel System", jobs: 7, cost: 2100000, pct: 12 },
    { name: "Transmission System", jobs: 5, cost: 1950000, pct: 9 },
    { name: "Electrical System", jobs: 4, cost: 950000, pct: 6 },
    { name: "Steering System", jobs: 3, cost: 850000, pct: 5 },
    { name: "Air System", jobs: 2, cost: 650000, pct: 4 },
    { name: "Electronics System", jobs: 2, cost: 550000, pct: 3 },
    { name: "Body Works", jobs: 1, cost: 350000, pct: 1 },
    { name: "Accident Repairs", jobs: 1, cost: 450000, pct: 1 },
  ];

  // CSV Exporter
  const handleExportCsv = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const rows: string[] = [];
    rows.push(`"CORPORATE FLEET MANAGEMENT EXECUTIVE REPORT (${activeFrequency.toUpperCase()})"`);
    rows.push(`"Organisation","${companyDisplayName}"`);
    rows.push(`"Report Frequency","${activeFrequency.toUpperCase()}"`);
    rows.push(`"Generated At","${new Date().toLocaleString()}"`);
    rows.push("");

    rows.push(`"--- FINANCIAL MAINTENANCE SUMMARY (SLIDE 17) ---"`);
    rows.push(`"Total Operating & Maintenance Cost","TZS ${totalFleetCost.total.toLocaleString()}"`);
    rows.push(`"Direct Workshop & Contractor Maintenance","TZS ${totalFleetCost.maintenance.toLocaleString()}"`);
    rows.push(`"Commercial Fleet Fuel Spend","TZS ${totalFleetCost.fuel.toLocaleString()}"`);
    rows.push(`"Estimated Cost-per-Kilometer (CPK)","TZS 1,850 / km"`);
    rows.push("");

    rows.push(`"--- 11 COMPONENT SUBSYSTEM FAILURE BREAKDOWN (SLIDE 11) ---"`);
    rows.push(`"Component Subsystem","Incident Count","Total Spend (TZS)","Share (%)"`);
    for (const c of componentDistribution) {
      rows.push(`"${c.name}","${c.jobs}","${c.cost}","${c.pct}%"`);
    }
    rows.push("");

    rows.push(`"--- ACTIVE COMMERCIAL VEHICLES (SLIDE 6) ---"`);
    rows.push(`"Vehicle Name","Plate Number","Make / Model","Current Odo (km)","Status"`);
    for (const v of vehicles) {
      rows.push(`"${v.name || ""}","${v.plate_number || ""}","${v.make || ""} ${v.model || ""}","${v.current_odometer_km || 0}","${v.status || "active"}"`);
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", `${companyDisplayName.replace(/\s+/g, "_")}_${activeFrequency}_Report_${todayStr}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${activeFrequency.toUpperCase()} Report exported successfully`);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20 shadow-sm">
              <FileBarChart className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Executive Management & Reports
                </h1>
                <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30">
                  Slide 21, 22
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Daily, weekly, and monthly operational dossiers with automated multi-format export
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5"
          >
            <Printer className="h-4 w-4" />
            Print / PDF
          </Button>
          <Button
            size="sm"
            onClick={handleExportCsv}
            className="gap-1.5 bg-primary text-primary-foreground"
          >
            <Download className="h-4 w-4" />
            Export CSV ({activeFrequency.toUpperCase()})
          </Button>
        </div>
      </div>

      {/* Frequency Tabs: Daily / Weekly / Monthly (Slide 22) */}
      <Tabs value={activeFrequency} onValueChange={(v) => setActiveFrequency(v as any)}>
        <div className="flex items-center justify-between border-b border-border pb-2">
          <TabsList className="bg-muted/60 p-0.5">
            <TabsTrigger value="daily" className="text-xs">
              Daily Report (Activities, Breakdowns, Stock)
            </TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs">
              Weekly Report (Maintenance, Job Cards, Spares)
            </TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs">
              Monthly Report (Costs, Downtime, Performance)
            </TabsTrigger>
          </TabsList>
          <span className="text-xs text-muted-foreground font-mono">
            Generated: {new Date().toLocaleDateString(undefined, { dateStyle: "medium" })}
          </span>
        </div>

        {/* Tab 1: Daily Report */}
        <TabsContent value="daily" className="space-y-6 pt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-xl border border-border bg-card space-y-1">
              <div className="text-xs text-muted-foreground">Workshop Activities Today</div>
              <div className="text-2xl font-bold text-foreground">12 Operations</div>
              <div className="text-[11px] text-emerald-600 font-medium">8 Job Cards in progress, 4 cleared</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card space-y-1">
              <div className="text-xs text-muted-foreground">Vehicle Breakdowns (Corridor)</div>
              <div className="text-2xl font-bold text-amber-600">1 Incident</div>
              <div className="text-[11px] text-muted-foreground">Mikumi corridor roadside rescue</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card space-y-1">
              <div className="text-xs text-muted-foreground">Stock Movement (Slide 15)</div>
              <div className="text-2xl font-bold text-foreground">14 SKUs Issued</div>
              <div className="text-[11px] text-muted-foreground">Auto-decremented to active job cards</div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Weekly Report */}
        <TabsContent value="weekly" className="space-y-6 pt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-xl border border-border bg-card space-y-1">
              <div className="text-xs text-muted-foreground">Fleet Maintenance Status</div>
              <div className="text-2xl font-bold text-emerald-600">96.4% Operational</div>
              <div className="text-[11px] text-muted-foreground">37 / 39 commercial assets available</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card space-y-1">
              <div className="text-xs text-muted-foreground">Weekly Job Card Analysis</div>
              <div className="text-2xl font-bold text-foreground">28 Job Cards</div>
              <div className="text-[11px] text-muted-foreground">Avg turnaround: 18.4 hours</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card space-y-1">
              <div className="text-xs text-muted-foreground">Weekly Spares Consumption</div>
              <div className="text-2xl font-bold text-purple-600">TZS 8,450,000</div>
              <div className="text-[11px] text-muted-foreground">Brake pads, lube oil & air filters</div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Monthly Report */}
        <TabsContent value="monthly" className="space-y-6 pt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-xl border border-border bg-card space-y-1">
              <div className="text-xs text-muted-foreground">Monthly Fleet Maintenance Spend</div>
              <div className="text-2xl font-bold text-foreground">TZS 18,450,000</div>
              <div className="text-[11px] text-emerald-600 font-medium">-4.2% vs. quarterly budget ceiling</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card space-y-1">
              <div className="text-xs text-muted-foreground">Cost-per-Kilometer (CPK)</div>
              <div className="text-2xl font-bold text-purple-600">TZS 1,850 / km</div>
              <div className="text-[11px] text-muted-foreground">Across 142,500 total fleet operating km</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card space-y-1">
              <div className="text-xs text-muted-foreground">Downtime Analysis</div>
              <div className="text-2xl font-bold text-foreground">3.2% Unscheduled</div>
              <div className="text-[11px] text-emerald-600 font-medium">Target &lt; 5.0% achieved</div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Section 1: Financial Maintenance Cost Control (Slide 17) */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-600" />
            <h3 className="font-semibold text-sm text-foreground">
              Financial Process & Cost Reporting (Slide 17)
            </h3>
          </div>
          <Badge variant="outline" className="text-xs">
            Integrated with Finance
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg border border-border bg-muted/20">
            <div className="text-muted-foreground">Cost per Vehicle (Avg)</div>
            <div className="text-base font-bold text-foreground mt-1">TZS 473,000</div>
            <div className="text-[10px] text-muted-foreground">Per operational unit / month</div>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/20">
            <div className="text-muted-foreground">Cost per Repair Type</div>
            <div className="text-base font-bold text-foreground mt-1">PM: 68% · Corrective: 32%</div>
            <div className="text-[10px] text-emerald-600 font-medium">Preventive dominated ratio</div>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/20">
            <div className="text-muted-foreground">Petty Cash Approvals</div>
            <div className="text-base font-bold text-foreground mt-1">TZS 1,200,000</div>
            <div className="text-[10px] text-muted-foreground">Mobile & emergency disbursements</div>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/20">
            <div className="text-muted-foreground">Maintenance Budget Used</div>
            <div className="text-base font-bold text-emerald-600 mt-1">74.2% of Q4</div>
            <div className="text-[10px] text-muted-foreground">TZS 6,550,000 headroom</div>
          </div>
        </div>
      </div>

      {/* Section 2: 11-Component Subsystem Failure Breakdown (Slide 11) */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-purple-600" />
            <h3 className="font-semibold text-sm text-foreground">
              11 Component Failure Distribution Matrix (Slide 11 & 17)
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">Identifies recurring failures</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground uppercase tracking-wider">
                <th className="pb-2.5 font-semibold">Subsystem Classification</th>
                <th className="pb-2.5 font-semibold">Job Card Incidents</th>
                <th className="pb-2.5 font-semibold">Total Cost Allocation</th>
                <th className="pb-2.5 font-semibold text-right">Failure Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {componentDistribution.map((item, idx) => (
                <tr key={idx} className="hover:bg-muted/40 transition-colors">
                  <td className="py-2.5 font-semibold text-foreground flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <span>{item.name}</span>
                  </td>
                  <td className="py-2.5 text-muted-foreground font-mono">
                    {item.jobs} Job Cards
                  </td>
                  <td className="py-2.5 font-mono font-medium">
                    TZS {item.cost.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right font-mono font-bold text-foreground">
                    {item.pct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
