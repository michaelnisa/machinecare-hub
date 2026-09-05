import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCw, Clock, ArrowRightLeft, ArrowRight, ArrowLeft, Play, CheckCircle2, ShieldAlert } from "lucide-react";
import { integrationsService } from "@/services/integrationsService";
import { toast } from "sonner";

interface EntityScheduleConfig {
  entity: string;
  name: string;
  direction: "erp_to_mc" | "mc_to_erp" | "bidirectional";
  frequency: string;
  lastRun: string;
  nextRun: string;
  status: "active" | "paused";
}

export function SyncJobsView() {
  const [schedules, setSchedules] = useState<EntityScheduleConfig[]>([
    {
      entity: "inventory",
      name: "Inventory Balances & Stock Quantities",
      direction: "erp_to_mc",
      frequency: "Every 5 minutes",
      lastRun: "2 mins ago",
      nextRun: "in 3 mins",
      status: "active",
    },
    {
      entity: "parts",
      name: "Parts & Master Catalog Items",
      direction: "erp_to_mc",
      frequency: "Every 15 minutes",
      lastRun: "14 mins ago",
      nextRun: "in 1 min",
      status: "active",
    },
    {
      entity: "assets",
      name: "Fixed Assets & Equipment",
      direction: "erp_to_mc",
      frequency: "Hourly",
      lastRun: "48 mins ago",
      nextRun: "in 12 mins",
      status: "active",
    },
    {
      entity: "purchase_requests",
      name: "Spare Parts Purchase Requests",
      direction: "mc_to_erp",
      frequency: "Event-driven (Webhook / Instant)",
      lastRun: "1 hour ago",
      nextRun: "On trigger",
      status: "active",
    },
    {
      entity: "maintenance_costs",
      name: "Work Order Maintenance Costs",
      direction: "mc_to_erp",
      frequency: "Daily batch (23:00 UTC)",
      lastRun: "Yesterday",
      nextRun: "in 11 hours",
      status: "active",
    },
  ]);

  const [triggeringEntity, setTriggeringEntity] = useState<string | null>(null);

  const handleRunNow = async (entity: string) => {
    setTriggeringEntity(entity);
    try {
      const job = await integrationsService.triggerSyncNow("int_odoo_prod", entity);
      toast.success(`Triggered sync for ${entity}! Processed ${job.records_processed} records.`);
    } catch {
      toast.error("Failed to execute sync job");
    } finally {
      setTriggeringEntity(null);
    }
  };

  const handleToggleStatus = (index: number) => {
    const updated = [...schedules];
    updated[index].status = updated[index].status === "active" ? "paused" : "active";
    setSchedules(updated);
    toast.info(`Schedule ${updated[index].status === "active" ? "resumed" : "paused"}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Sync Schedules & Worker Jobs</h2>
          <p className="text-xs text-muted-foreground">
            Granular per-entity synchronization schedule policies with automated background dispatch.
          </p>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Active Entity Sync Matrix
          </CardTitle>
          <CardDescription className="text-xs">
            Configured directions and intervals between MachineCare and active ERPs.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <div className="grid grid-cols-12 gap-3 p-3 bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase">
              <div className="col-span-4">Entity Type</div>
              <div className="col-span-2">Sync Direction</div>
              <div className="col-span-2">Schedule Interval</div>
              <div className="col-span-2">Timing (Last / Next)</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {schedules.map((item, idx) => (
              <div key={item.entity} className="grid grid-cols-12 gap-3 p-3 items-center text-xs">
                <div className="col-span-4">
                  <div className="font-bold text-foreground">{item.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                    entity: {item.entity}
                  </div>
                </div>

                <div className="col-span-2">
                  {item.direction === "erp_to_mc" ? (
                    <Badge variant="outline" className="text-[10px] gap-1 text-blue-600 border-blue-500/20">
                      <ArrowRight className="h-3 w-3" /> ERP → MachineCare
                    </Badge>
                  ) : item.direction === "mc_to_erp" ? (
                    <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-500/20">
                      <ArrowLeft className="h-3 w-3" /> MachineCare → ERP
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] gap-1 text-purple-600 border-purple-500/20">
                      <ArrowRightLeft className="h-3 w-3" /> Bidirectional
                    </Badge>
                  )}
                </div>

                <div className="col-span-2 font-mono text-[11px] text-foreground font-medium">
                  {item.frequency}
                </div>

                <div className="col-span-2 text-[11px]">
                  <div className="text-muted-foreground">Last: <span className="text-foreground font-medium">{item.lastRun}</span></div>
                  <div className="text-primary font-medium">Next: {item.nextRun}</div>
                </div>

                <div className="col-span-2 flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleStatus(idx)}
                    className="text-xs h-7 px-2"
                  >
                    {item.status === "active" ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={triggeringEntity === item.entity}
                    onClick={() => handleRunNow(item.entity)}
                    className="text-xs h-7 px-2 gap-1"
                  >
                    <Play className="h-3 w-3 text-emerald-500" /> Run
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
export default SyncJobsView;
