import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Activity, Database, Cpu, Zap, BarChart2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const PROTOCOL_USAGE_DATA = [
  { name: "CAN / J1939", count: 480 },
  { name: "Modbus RTU/TCP", count: 320 },
  { name: "MQTT / Sparkplug B", count: 290 },
  { name: "OPC-UA", count: 180 },
  { name: "HTTP / REST API", count: 120 },
];

export default function ConnectedAnalyticsPage() {
  return (
          <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Connected Telemetry Analytics & Intelligence
          </h1>
          <p className="text-sm text-muted-foreground">
            Data pipeline throughput, protocol distribution & asset connectivity trends
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Daily Telemetry Ingestion</div>
              <div className="mt-1 text-2xl font-bold text-primary">18.4M Points</div>
              <div className="mt-1 text-xs text-emerald-600 font-medium">+12% vs last week</div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Average Latency</div>
              <div className="mt-1 text-2xl font-bold text-foreground">14 ms</div>
              <div className="mt-1 text-xs text-emerald-600 font-medium">Sub-second stream</div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">API Throughput</div>
              <div className="mt-1 text-2xl font-bold text-blue-600">4,200 req/sec</div>
              <div className="mt-1 text-xs text-muted-foreground">Scoped analytics API</div>
            </CardContent>
          </Card>
        </div>

        {/* Protocol Volume Chart */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Data Source Protocol Distribution</CardTitle>
            <CardDescription>Active connected gateways grouped by industrial protocol</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={PROTOCOL_USAGE_DATA}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" stroke="#888888" fontSize={11} />
                  <YAxis stroke="#888888" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#fff" }} />
                  <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      );
}
