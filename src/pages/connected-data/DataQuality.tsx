import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, ShieldCheck, Clock, RefreshCw, Activity, Layers, Search } from "lucide-react";
import { MOCK_DATA_QUALITY_RECORDS } from "@/lib/connected-data-mock";
import { DataQualityRecord, QualityState } from "@/types/connected-data";
import { useToast } from "@/components/ui/use-toast";

export default function ConnectedDataQualityPage() {
  const { toast } = useToast();
  const [qualityRecords] = useState<DataQualityRecord[]>(MOCK_DATA_QUALITY_RECORDS);

  return (
          <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Data Quality & Stream Trust Matrix
            </h1>
            <p className="text-sm text-muted-foreground">
              Evaluate telemetry reliability, detect missing packets, latency & impossible values
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast({ title: "Quality Audit Completed", description: "All 1,284 asset data streams validated." })}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Run Stream Quality Audit
          </Button>
        </div>

        {/* Quality States Legend & Overview */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="border-border">
            <CardContent className="p-3 text-center">
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 mb-1">GOOD</Badge>
              <div className="text-xl font-bold">1,120 Streams</div>
              <div className="text-[11px] text-muted-foreground">100% Verified</div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-3 text-center">
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 mb-1">WARNING</Badge>
              <div className="text-xl font-bold text-amber-600">42 Streams</div>
              <div className="text-[11px] text-muted-foreground">Jitter detected</div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-3 text-center">
              <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 mb-1">DELAYED</Badge>
              <div className="text-xl font-bold text-blue-600">18 Streams</div>
              <div className="text-[11px] text-muted-foreground">Latency &gt; 30s</div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-3 text-center">
              <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 mb-1">MISSING</Badge>
              <div className="text-xl font-bold text-rose-600">12 Streams</div>
              <div className="text-[11px] text-muted-foreground">Packet drop</div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-3 text-center">
              <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 mb-1">INVALID</Badge>
              <div className="text-xl font-bold text-purple-600">6 Streams</div>
              <div className="text-[11px] text-muted-foreground">Out of bounds</div>
            </CardContent>
          </Card>
        </div>

        {/* Data Quality Matrix Table */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Telemetry Data Stream Audit Matrix</CardTitle>
            <CardDescription>Individual parameter quality scoring and anomaly counters</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 font-semibold text-muted-foreground">
                  <tr>
                    <th className="p-3">Asset Name</th>
                    <th className="p-3">Parameter Name</th>
                    <th className="p-3">Quality State</th>
                    <th className="p-3">Quality Score</th>
                    <th className="p-3">Missing Packets (24h)</th>
                    <th className="p-3">Delayed Packets (24h)</th>
                    <th className="p-3">Invalid Values (24h)</th>
                    <th className="p-3">Stale Seconds</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {qualityRecords.map((dq) => (
                    <tr key={dq.id} className="hover:bg-muted/30">
                      <td className="p-3 font-semibold text-foreground">{dq.asset_name}</td>
                      <td className="p-3 font-mono text-primary">{dq.parameter_name}</td>
                      <td className="p-3">
                        <Badge
                          className={
                            dq.quality_state === "GOOD"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : dq.quality_state === "WARNING"
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              : dq.quality_state === "DELAYED"
                              ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                              : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                          }
                        >
                          {dq.quality_state}
                        </Badge>
                      </td>
                      <td className="p-3 font-bold text-foreground">{dq.quality_score_percent}%</td>
                      <td className="p-3 text-muted-foreground">{dq.missing_count_24h}</td>
                      <td className="p-3 text-muted-foreground">{dq.delayed_count_24h}</td>
                      <td className="p-3 text-muted-foreground">{dq.invalid_count_24h}</td>
                      <td className="p-3 font-mono text-muted-foreground">{dq.stale_seconds}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      );
}
