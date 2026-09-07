import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Zap,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Gauge,
  Thermometer,
  Fuel,
  Battery,
  Clock,
  Radio,
  Sliders,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { MOCK_CONNECTED_ASSETS, MOCK_TELEMETRY_POINTS } from "@/lib/connected-data-mock";
import { useToast } from "@/components/ui/use-toast";

export default function ConnectedLiveDataPage() {
  const { toast } = useToast();
  const [selectedAssetId, setSelectedAssetId] = useState("asset-001");
  const [lastUpdatedSec, setLastUpdatedSec] = useState(3);
  const [liveMetrics, setLiveMetrics] = useState({
    temp: 87.4,
    rpm: 1502,
    fuel: 68.5,
    battery: 24.7,
    hours: 4281,
    load: 74.2,
    frequency: 50.01,
  });

  // Simulate real-time live pulse fluctuations
  useEffect(() => {
    const timer = setInterval(() => {
      setLastUpdatedSec((prev) => (prev >= 10 ? 1 : prev + 1));
      setLiveMetrics((prev) => ({
        ...prev,
        temp: parseFloat((87.0 + Math.random() * 1.5).toFixed(1)),
        rpm: Math.round(1495 + Math.random() * 20),
        fuel: parseFloat((prev.fuel - 0.01).toFixed(1)),
        battery: parseFloat((24.6 + Math.random() * 0.2).toFixed(1)),
        load: parseFloat((73.5 + Math.random() * 2.0).toFixed(1)),
        frequency: parseFloat((50.0 + (Math.random() - 0.5) * 0.05).toFixed(2)),
      }));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const selectedAsset = MOCK_CONNECTED_ASSETS.find((a) => a.id === selectedAssetId) || MOCK_CONNECTED_ASSETS[0];

  return (
          <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Live Telemetry Dashboard
              </h1>
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                <Activity className="mr-1 h-3 w-3 animate-pulse text-emerald-500" /> Live Stream (1 Hz)
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Real-time parameter values, sparkline trends & sensor status monitoring
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-primary" /> Updated {lastUpdatedSec} seconds ago
            </span>
          </div>
        </div>

        {/* Asset Cascade Selector */}
        <Card className="border-border">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Select Target Asset:</span>
              <select
                className="rounded-md border bg-background px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
              >
                {MOCK_CONNECTED_ASSETS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.asset_code}) — {a.customer_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div><span className="font-semibold text-foreground">Gateway:</span> {selectedAsset.device_name}</div>
              <div><span className="font-semibold text-foreground">Protocol:</span> {selectedAsset.protocol}</div>
              <div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  {selectedAsset.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Telemetry Value Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Engine Temperature */}
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Thermometer className="h-4 w-4 text-rose-500" /> Engine Temperature
              </span>
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                NORMAL
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{liveMetrics.temp} °C</div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center text-emerald-600 font-medium">
                  <TrendingUp className="mr-1 h-3 w-3" /> +0.2 °C/min
                </span>
                <span>Max: 95.0 °C</span>
              </div>
              {/* Mini sparkline visualization */}
              <div className="mt-3 flex items-end gap-1 h-8">
                {[60, 62, 65, 70, 78, 82, 85, 87, 87.4].map((v, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-primary/30 rounded-t hover:bg-cyan-500 transition-colors"
                    style={{ height: `${(v / 100) * 100}%` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Engine RPM */}
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Gauge className="h-4 w-4 text-primary" /> Engine Speed (RPM)
              </span>
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                STABLE
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{liveMetrics.rpm} RPM</div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span className="text-emerald-600 font-medium">Target: 1,500</span>
                <span>Nominal Line</span>
              </div>
              <div className="mt-3 flex items-end gap-1 h-8">
                {[1480, 1490, 1500, 1505, 1498, 1502, 1500, 1502].map((v, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-emerald-500/30 rounded-t hover:bg-emerald-500 transition-colors"
                    style={{ height: `${(v / 1600) * 100}%` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Fuel Level */}
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Fuel className="h-4 w-4 text-amber-500" /> Fuel Tank Level
              </span>
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                GOOD
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{liveMetrics.fuel} %</div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center text-amber-600 font-medium">
                  <TrendingDown className="mr-1 h-3 w-3" /> -2.4 %/hr
                </span>
                <span>Est 18h left</span>
              </div>
              <div className="mt-3 flex items-end gap-1 h-8">
                {[80, 78, 76, 74, 72, 70, 69, 68.5].map((v, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-amber-500/30 rounded-t hover:bg-amber-500 transition-colors"
                    style={{ height: `${v}%` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Battery Voltage */}
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Battery className="h-4 w-4 text-blue-500" /> Battery Terminal Voltage
              </span>
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                CHARGING
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{liveMetrics.battery} V</div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span className="text-emerald-600 font-medium">Alternator Active</span>
                <span>Nominal: 24 V</span>
              </div>
              <div className="mt-3 flex items-end gap-1 h-8">
                {[24.2, 24.5, 24.6, 24.7, 24.8, 24.7, 24.7].map((v, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-blue-500/30 rounded-t hover:bg-blue-500 transition-colors"
                    style={{ height: `${(v / 30) * 100}%` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Parameters Banner */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex items-center justify-between rounded-lg border bg-card p-4">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Engine Hours</div>
              <div className="text-xl font-bold">{liveMetrics.hours} h</div>
            </div>
            <Badge variant="outline">Non-Decreasing Counter</Badge>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-card p-4">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Active Load</div>
              <div className="text-xl font-bold">{liveMetrics.load} %</div>
            </div>
            <Badge variant="outline" className="text-emerald-600 border-emerald-500/30">Optimal Efficiency</Badge>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-card p-4">
            <div>
              <div className="text-xs text-muted-foreground font-medium">AC Output Frequency</div>
              <div className="text-xl font-bold">{liveMetrics.frequency} Hz</div>
            </div>
            <Badge variant="outline" className="text-blue-600 border-blue-500/30">Grid Synchronized</Badge>
          </div>
        </div>
      </div>
      );
}
