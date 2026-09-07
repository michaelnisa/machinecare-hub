import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Download,
  Calendar,
  BarChart2,
  TrendingUp,
  Filter,
  FileSpreadsheet,
  FileCode,
  FileText,
  Sliders,
  Layers,
  Database,
} from "lucide-react";
import {
  MOCK_CONNECTED_CUSTOMERS,
  MOCK_CONNECTED_SITES,
  MOCK_CONNECTED_ASSETS,
  MOCK_MACHINE_DICTIONARY,
  generateHistoricalTimeSeries,
} from "@/lib/connected-data-mock";
import { useToast } from "@/components/ui/use-toast";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

import { TimeSeriesEngine } from "@/lib/time-series-engine";

export default function ConnectedDataExplorerPage() {
  const { toast } = useToast();
  const [selectedCustomerId, setSelectedCustomerId] = useState("cust-001");
  const [selectedSiteId, setSelectedSiteId] = useState("site-001");
  const [selectedAssetId, setSelectedAssetId] = useState("asset-001");
  const [selectedParamKey, setSelectedParamKey] = useState("engine_coolant_temperature");
  const [timeframe, setTimeframe] = useState<"1h" | "24h" | "7d" | "30d">("24h");
  const [compareParamKey, setCompareParamKey] = useState("generator_active_load_percent");

  const sites = MOCK_CONNECTED_SITES.filter((s) => s.customer_id === selectedCustomerId);
  const assets = MOCK_CONNECTED_ASSETS.filter((a) => a.site_id === selectedSiteId);
  const seriesData = generateHistoricalTimeSeries(selectedAssetId, selectedParamKey, timeframe);

  // Compute statistical summary via TimeSeriesEngine
  const values = seriesData.map((d) => d.value);
  const minVal = values.length ? Math.min(...values) : 0;
  const maxVal = values.length ? Math.max(...values) : 0;
  const avgVal = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : 0;
  const medianVal = values.length ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] : 0;
  const totalCount = seriesData.length;

  const handleExport = (format: "CSV" | "JSON" | "Excel") => {
    const csvContent = TimeSeriesEngine.exportToCSV(
      seriesData.map((s, idx) => ({
        id: `pts-${idx}`,
        asset_id: selectedAssetId,
        timestamp: s.timestamp,
        parameter_key: selectedParamKey,
        value: s.value,
        unit: "units",
        quality_state: "GOOD",
      })),
      selectedAssetId
    );

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `telemetry_${selectedAssetId}_${selectedParamKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: `Exporting Telemetry Data (${format})`,
      description: `Downloaded ${totalCount} rows for ${selectedParamKey} over ${timeframe}.`,
    });
  };

  return (
          <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Telemetry Data Explorer
            </h1>
            <p className="text-sm text-muted-foreground">
              Deep historical analysis, multi-parameter correlations & raw data export
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport("CSV")}>
              <FileText className="mr-1.5 h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("Excel")}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4 text-emerald-600" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("JSON")}>
              <FileCode className="mr-1.5 h-4 w-4 text-primary" /> JSON
            </Button>
          </div>
        </div>

        {/* Drilldown Navigation Selectors */}
        <Card className="border-border">
          <CardContent className="p-4 grid gap-4 md:grid-cols-5">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Customer</label>
              <select
                className="w-full rounded-md border bg-background p-2 text-xs font-medium focus:ring-1 focus:ring-primary"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
              >
                {MOCK_CONNECTED_CUSTOMERS.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Site</label>
              <select
                className="w-full rounded-md border bg-background p-2 text-xs font-medium focus:ring-1 focus:ring-primary"
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Asset</label>
              <select
                className="w-full rounded-md border bg-background p-2 text-xs font-medium focus:ring-1 focus:ring-primary"
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Primary Parameter</label>
              <select
                className="w-full rounded-md border bg-background p-2 text-xs font-medium focus:ring-1 focus:ring-primary"
                value={selectedParamKey}
                onChange={(e) => setSelectedParamKey(e.target.value)}
              >
                {MOCK_MACHINE_DICTIONARY.map((p) => (
                  <option key={p.id} value={p.standard_key}>{p.display_name} ({p.unit})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Comparison Parameter</label>
              <select
                className="w-full rounded-md border bg-background p-2 text-xs font-medium focus:ring-1 focus:ring-primary"
                value={compareParamKey}
                onChange={(e) => setCompareParamKey(e.target.value)}
              >
                {MOCK_MACHINE_DICTIONARY.map((p) => (
                  <option key={p.id} value={p.standard_key}>{p.display_name} ({p.unit})</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Timeframe Selector & Statistics Cards */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-1.5 rounded-lg border bg-card p-1">
            {(["1h", "24h", "7d", "30d"] as const).map((tf) => (
              <Button
                key={tf}
                variant={timeframe === tf ? "default" : "ghost"}
                size="sm"
                className={timeframe === tf ? "bg-primary text-white hover:bg-primary/90" : "text-xs"}
                onClick={() => setTimeframe(tf)}
              >
                {tf === "1h" ? "Last 1 Hour" : tf === "24h" ? "Last 24 Hours" : tf === "7d" ? "Last 7 Days" : "Last 30 Days"}
              </Button>
            ))}
          </div>
        </div>

        {/* Statistical Summary Ribbon */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-[11px] text-muted-foreground">Minimum</div>
            <div className="mt-1 text-lg font-bold text-foreground">{minVal}</div>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-[11px] text-muted-foreground">Maximum</div>
            <div className="mt-1 text-lg font-bold text-foreground">{maxVal}</div>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-[11px] text-muted-foreground">Average</div>
            <div className="mt-1 text-lg font-bold text-primary">{avgVal}</div>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-[11px] text-muted-foreground">Median</div>
            <div className="mt-1 text-lg font-bold text-foreground">{medianVal}</div>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-[11px] text-muted-foreground">Data Points</div>
            <div className="mt-1 text-lg font-bold text-foreground">{totalCount}</div>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-[11px] text-muted-foreground">Missing Values</div>
            <div className="mt-1 text-lg font-bold text-emerald-600">0</div>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-[11px] text-muted-foreground">Sampling Rate</div>
            <div className="mt-1 text-lg font-bold text-foreground">1 Hz</div>
          </div>
        </div>

        {/* Chart: Multi-Parameter Comparison */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Parameter Correlation & Comparison Chart
            </CardTitle>
            <CardDescription>
              Comparing Primary Parameter vs Secondary Parameter over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={seriesData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="formattedTime" stroke="#888888" fontSize={11} />
                  <YAxis yAxisId="left" stroke="#06b6d4" fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#fff", fontSize: 12 }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="value" name="Primary Parameter" stroke="#06b6d4" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="secondaryValue" name="Secondary Parameter" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Raw Telemetry Data Log Table */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Raw Telemetry Datapoint Log</CardTitle>
            <CardDescription>Exact timestamped telemetry records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 font-semibold text-muted-foreground">
                  <tr>
                    <th className="p-2.5">Timestamp</th>
                    <th className="p-2.5">Parameter Key</th>
                    <th className="p-2.5">Primary Value</th>
                    <th className="p-2.5">Comparison Value</th>
                    <th className="p-2.5">Quality State</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {seriesData.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="p-2.5 font-mono text-muted-foreground">{new Date(row.timestamp).toLocaleString()}</td>
                      <td className="p-2.5 font-mono text-primary">{selectedParamKey}</td>
                      <td className="p-2.5 font-bold text-foreground">{row.value}</td>
                      <td className="p-2.5 font-bold text-emerald-600">{row.secondaryValue}</td>
                      <td className="p-2.5">
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                          GOOD
                        </Badge>
                      </td>
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
