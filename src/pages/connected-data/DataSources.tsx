import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Database, Plus, Network, Cpu, CheckCircle2, AlertTriangle, RefreshCw, Zap } from "lucide-react";
import { MOCK_DATA_SOURCES } from "@/lib/connected-data-mock";
import { ConnectedDataSource, ProtocolType } from "@/types/connected-data";
import { useToast } from "@/components/ui/use-toast";

const ALL_PROTOCOLS: ProtocolType[] = [
  "CAN",
  "J1939",
  "Modbus",
  "OPC-UA",
  "PLC",
  "MQTT",
  "HTTP",
  "REST API",
  "Webhooks",
  "GPS",
  "Digital Input",
  "Analog Input",
  "Sensors",
  "CSV",
  "Excel",
  "Manual Data",
];

export default function ConnectedDataSourcesPage() {
  const { toast } = useToast();
  const [dataSources] = useState<ConnectedDataSource[]>(MOCK_DATA_SOURCES);

  return (
          <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Multi-Protocol Data Sources
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure telemetry feeds, CAN buses, Modbus channels, OPC-UA servers & REST webhooks
            </p>
          </div>
          <Button
            className="bg-primary hover:bg-primary/90 text-white"
            onClick={() => toast({ title: "New Data Source", description: "Protocol wizard opened." })}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Protocol Source
          </Button>
        </div>

        {/* Supported Protocols Matrix */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" />
              Supported Industrial Protocols & Connectors
            </CardTitle>
            <CardDescription>Extensible ingestion plug-ins supported out of the box</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {ALL_PROTOCOLS.map((proto) => (
                <Badge
                  key={proto}
                  variant="outline"
                  className="bg-muted/40 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer p-1.5 px-3 text-xs"
                >
                  <Zap className="mr-1 h-3 w-3 text-primary" /> {proto}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Active Data Sources List */}
        <div className="grid gap-4 md:grid-cols-2">
          {dataSources.map((ds) => (
            <Card key={ds.id} className="border-border hover:border-primary/40 transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Database className="h-4 w-4 text-primary" />
                      {ds.source_name}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {ds.asset_name} • {ds.endpoint_or_channel}
                    </CardDescription>
                  </div>
                  <Badge
                    className={
                      ds.status === "ACTIVE"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                    }
                  >
                    {ds.status}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/30 p-2.5 text-center text-xs">
                  <div>
                    <div className="text-muted-foreground">Protocol</div>
                    <div className="font-bold text-primary">{ds.protocol}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Parameters</div>
                    <div className="font-bold">{ds.parameters_count}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Polling Interval</div>
                    <div className="font-bold">{ds.polling_interval_sec}s</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>Last Sync: {ds.last_sync}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary hover:text-primary"
                    onClick={() => toast({ title: "Re-synced Source", description: `Re-established connection to ${ds.source_name}` })}
                  >
                    <RefreshCw className="mr-1 h-3 w-3" /> Sync Stream
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      );
}
