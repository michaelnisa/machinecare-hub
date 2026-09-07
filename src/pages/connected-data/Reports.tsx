import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileBarChart, Download, CheckCircle2, AlertTriangle, FileText, Printer } from "lucide-react";
import { MOCK_AVAILABILITY_REPORTS } from "@/lib/connected-data-mock";
import { useToast } from "@/components/ui/use-toast";

export default function ConnectedReportsPage() {
  const { toast } = useToast();
  const [reports] = useState(MOCK_AVAILABILITY_REPORTS);

  const handleExport = (reportName: string) => {
    toast({
      title: "Report Generated",
      description: `${reportName} compiled and ready for download.`,
    });
  };

  return (
          <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Connected Data & Availability Reports
            </h1>
            <p className="text-sm text-muted-foreground">
              Data availability SLA compliance, connectivity uptime & asset stream reports
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("Data Availability PDF")}
            >
              <Printer className="mr-1.5 h-4 w-4" /> Print PDF Summary
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              size="sm"
              onClick={() => handleExport("Full Compliance CSV")}
            >
              <Download className="mr-1.5 h-4 w-4" /> Export CSV Report
            </Button>
          </div>
        </div>

        {/* Data Availability SLA Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Fleet Average Availability</div>
              <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">99.45%</div>
              <div className="mt-1 text-[11px] text-muted-foreground">Target SLA: 99.0%</div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Expected Datapoints (24h)</div>
              <div className="mt-1 text-2xl font-bold text-foreground">235,440</div>
              <div className="mt-1 text-[11px] text-muted-foreground">100% Scheduled</div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Received Datapoints (24h)</div>
              <div className="mt-1 text-2xl font-bold text-primary">233,988</div>
              <div className="mt-1 text-[11px] text-emerald-600 font-medium">99.38% delivered</div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Data Quality Score</div>
              <div className="mt-1 text-2xl font-bold text-foreground">99.1%</div>
              <div className="mt-1 text-[11px] text-muted-foreground">Zero corruption</div>
            </CardContent>
          </Card>
        </div>

        {/* Data Availability Report Table */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileBarChart className="h-4 w-4 text-primary" /> Data Availability & Collection Report
            </CardTitle>
            <CardDescription>Expected vs Received Telemetry Data Points per Asset (24h Window)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 font-semibold text-muted-foreground">
                  <tr>
                    <th className="p-3">Asset Name</th>
                    <th className="p-3">Customer / Site</th>
                    <th className="p-3">Expected Pkts (24h)</th>
                    <th className="p-3">Received Pkts (24h)</th>
                    <th className="p-3">Availability Score</th>
                    <th className="p-3">Uptime Hours</th>
                    <th className="p-3">Offline Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reports.map((row) => (
                    <tr key={row.asset_id} className="hover:bg-muted/30">
                      <td className="p-3 font-semibold text-foreground">{row.asset_name}</td>
                      <td className="p-3 text-muted-foreground">{row.customer_name} ({row.site_name})</td>
                      <td className="p-3 font-mono text-muted-foreground">{row.expected_datapoints_24h.toLocaleString()}</td>
                      <td className="p-3 font-mono text-foreground font-semibold">{row.received_datapoints_24h.toLocaleString()}</td>
                      <td className="p-3">
                        <Badge
                          className={
                            row.availability_percent >= 99.0
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          }
                        >
                          {row.availability_percent}%
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-emerald-600">{row.uptime_hours}h</td>
                      <td className="p-3 font-mono text-rose-600">{row.offline_hours}h</td>
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
