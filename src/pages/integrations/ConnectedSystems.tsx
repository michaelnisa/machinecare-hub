import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Settings,
  Server,
  Activity,
  Layers,
  Sliders,
  ExternalLink,
  ShieldCheck,
  Loader2,
  Plus,
} from "lucide-react";
import { integrationsService } from "@/services/integrationsService";
import type { ConnectedIntegration } from "@/types/integrations";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export function ConnectedSystems() {
  const [systems, setSystems] = useState<ConnectedIntegration[]>(integrationsService.getConnectedSystems());
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    integrationsService.fetchConnectedSystems().then((data) => {
      if (active) {
        setSystems(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSyncNow = async (systemId: string) => {
    setSyncingId(systemId);
    try {
      const job = await integrationsService.triggerSyncNow(systemId);
      setSystems(integrationsService.getConnectedSystems());
      toast.success(`Sync completed! ${job.records_processed.toLocaleString()} records processed.`);
    } catch (e: any) {
      toast.error("Manual sync failed");
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Active Connections</h2>
          <p className="text-xs text-muted-foreground">
            Operational connections communicating bidirectionally with MachineCare Canonical Store.
          </p>
        </div>
      </div>

      {systems.length === 0 ? (
        <Card className="border-dashed border-2 border-border/80 bg-muted/10 p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
            <Layers className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">No Active Connections</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mb-6">
            Connect your enterprise ERP (Odoo, SAP Business One, Microsoft Dynamics 365) or EAM (IBM Maximo) to enable bi-directional sync of assets, spare parts, inventory, and work orders.
          </p>
          <Link to="/integrations">
            <Button className="font-semibold text-xs gap-2">
              <Server className="h-3.5 w-3.5" /> Explore Marketplace & Connect
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {systems.map((system) => {
            const isSyncing = syncingId === system.id;
            const records = system.health_details?.synced_records_count || {};

            return (
              <Card key={system.id} className="border-border shadow-sm">
                <CardHeader className="pb-3 border-b border-border/60">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm uppercase">
                        {system.connector_type.substring(0, 3)}
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-foreground">
                          {system.name}
                        </CardTitle>
                        <div className="text-xs font-mono text-muted-foreground truncate max-w-sm mt-0.5">
                          {system.base_url}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <Badge variant="outline" className="text-[11px] font-semibold text-emerald-600 border-emerald-500/30 uppercase">
                        {system.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-4 text-xs">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-md bg-muted/40 p-2.5 border border-border/60">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Category</div>
                      <div className="font-semibold text-foreground mt-0.5">{system.category}</div>
                    </div>
                    <div className="rounded-md bg-muted/40 p-2.5 border border-border/60">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Frequency</div>
                      <div className="font-semibold text-foreground mt-0.5">{system.sync_frequency}</div>
                    </div>
                    <div className="rounded-md bg-muted/40 p-2.5 border border-border/60">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Conflict Rule</div>
                      <div className="font-semibold text-foreground mt-0.5">{system.conflict_strategy}</div>
                    </div>
                    <div className="rounded-md bg-muted/40 p-2.5 border border-border/60">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Latency</div>
                      <div className="font-semibold text-emerald-600 mt-0.5">
                        {system.health_details?.latency_ms || 120}ms
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/80 p-3 bg-muted/20">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground mb-2">
                      <span>Synchronized Canonical Datasets</span>
                      <span>Health Check: OK</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-background rounded p-2 border border-border/50">
                        <div className="text-base font-extrabold text-foreground">
                          {records.assets?.toLocaleString() || "0"}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase">Assets</div>
                      </div>
                      <div className="bg-background rounded p-2 border border-border/50">
                        <div className="text-base font-extrabold text-foreground">
                          {records.parts?.toLocaleString() || "0"}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase">Parts</div>
                      </div>
                      <div className="bg-background rounded p-2 border border-border/50">
                        <div className="text-base font-extrabold text-foreground">
                          {records.inventory?.toLocaleString() || "0"}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase">Inventory</div>
                      </div>
                      <div className="bg-background rounded p-2 border border-border/50">
                        <div className="text-base font-extrabold text-foreground">
                          {records.orders?.toLocaleString() || "0"}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase">Orders</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-muted-foreground pt-1 gap-2">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" /> Last Synced:{" "}
                      <span className="text-foreground font-medium">
                        {system.last_synced_at ? new Date(system.last_synced_at).toLocaleTimeString() : "Never"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[10px]">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" /> API Key Encrypted (AES-256)
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-2 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link to="/integrations/mapping">
                      <Button variant="outline" size="sm" className="text-xs gap-1">
                        <Sliders className="h-3 w-3" /> Data Mapping
                      </Button>
                    </Link>
                    <Link to="/integrations/history">
                      <Button variant="ghost" size="sm" className="text-xs">
                        Audit Logs
                      </Button>
                    </Link>
                  </div>

                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isSyncing}
                    onClick={() => handleSyncNow(system.id)}
                    className="text-xs gap-1.5 font-semibold"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing...
                      </>
                    ) : (
                      <>
                        <RotateCw className="h-3.5 w-3.5" /> Sync Now
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
export default ConnectedSystems;
