import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, Plug, RefreshCw, Send, CheckCircle2, AlertTriangle, Zap, Cloud } from "lucide-react";
import { MOCK_WEBHOOKS } from "@/lib/connected-data-mock";
import { useToast } from "@/components/ui/use-toast";

export default function ConnectedIntegrationsPage() {
  const { toast } = useToast();

  return (
          <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Cloud & IoT Connectors & Outbound Webhooks
          </h1>
          <p className="text-sm text-muted-foreground">
            Stream real-time telemetry events to AWS IoT, Azure IoT Hub, Kafka & external analytics webhooks
          </p>
        </div>

        {/* Cloud Connectors */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Cloud className="h-4 w-4 text-primary" /> AWS IoT Core Connector
              </CardTitle>
              <CardDescription>MQTT broker ingestion & shadow sync</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">CONNECTED</Badge>
              <div className="text-xs text-muted-foreground">Topic: `telemetry/machinecare/#`</div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => toast({ title: "Tested AWS IoT Core", description: "Connection verified via TLS 1.3." })}
              >
                Test Connection
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Cloud className="h-4 w-4 text-blue-500" /> Azure IoT Hub Stream
              </CardTitle>
              <CardDescription>Device twin & telemetry ingestion</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">CONNECTED</Badge>
              <div className="text-xs text-muted-foreground">Endpoint: `ihub-prod.azure-devices.net`</div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => toast({ title: "Tested Azure IoT Hub", description: "Stream active (2.4k msg/sec)." })}
              >
                Test Connection
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-500" /> Apache Kafka Pipeline
              </CardTitle>
              <CardDescription>Real-time event stream distribution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">CONNECTED</Badge>
              <div className="text-xs text-muted-foreground">Cluster: `kafka.internal.mc:9092`</div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => toast({ title: "Tested Kafka Cluster", description: "Topic telemetry.raw synchronized." })}
              >
                Test Connection
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Outbound Webhooks Section */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Plug className="h-4 w-4 text-primary" /> Outbound Webhook Subscriptions
            </CardTitle>
            <CardDescription>HTTP POST event notifications to external analytics engines</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {MOCK_WEBHOOKS.map((wh) => (
                <div key={wh.id} className="flex items-center justify-between border rounded-lg p-3.5 text-xs">
                  <div>
                    <div className="font-bold text-sm text-foreground">{wh.name}</div>
                    <div className="font-mono text-muted-foreground">{wh.target_url}</div>
                    <div className="flex gap-1 pt-1">
                      {wh.events_subscribed.map((ev) => (
                        <Badge key={ev} variant="outline" className="text-[10px] bg-muted/40">
                          {ev}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{wh.status}</Badge>
                    <div className="text-muted-foreground">{wh.total_deliveries} deliveries</div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => toast({ title: "Webhook Test Fired", description: "Sent ping payload (200 OK)." })}
                    >
                      <Send className="mr-1 h-3 w-3" /> Test Webhook
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
