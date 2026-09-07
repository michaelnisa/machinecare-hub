import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Radio,
  Zap,
  Clock,
  Check,
  Search,
  Sliders,
  Boxes,
  ArrowRight,
} from "lucide-react";
import { MOCK_CONNECTED_EVENTS } from "@/lib/connected-data-mock";
import { ConnectedEvent } from "@/types/connected-data";
import { useToast } from "@/components/ui/use-toast";

export default function ConnectedAlertsPage() {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<ConnectedEvent[]>(MOCK_CONNECTED_EVENTS);
  const [search, setSearch] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");

  const handleAcknowledge = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "ACKNOWLEDGED" } : a))
    );
    toast({
      title: "Alert Acknowledged",
      description: "Dispatched operational alert acknowledged by operator.",
    });
  };

  const handleResolve = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "RESOLVED" } : a))
    );
    toast({
      title: "Alert Resolved",
      description: "Incident resolved and cleared from active roster.",
    });
  };

  const filtered = alerts.filter((a) => {
    const matchesSearch =
      a.asset_name.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase());
    const matchesSev = filterSeverity === "ALL" || a.severity === filterSeverity;
    return matchesSearch && matchesSev;
  });

  const criticalCount = alerts.filter((a) => a.severity === "CRITICAL" && a.status === "ACTIVE").length;
  const warningCount = alerts.filter((a) => a.severity === "WARNING" && a.status === "ACTIVE").length;
  const resolvedCount = alerts.filter((a) => a.status === "RESOLVED" || a.status === "ACKNOWLEDGED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Active Telemetry Alerts
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time threshold breaches, device offline warnings & equipment condition incidents
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="font-semibold">
          <Link to="/connected-data/events">
            <Sliders className="mr-1.5 h-4 w-4 text-primary" /> Manage Rule Engine
          </Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-semibold">Critical Urgent Incidents</div>
            <div className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">
              {criticalCount} Active
            </div>
            <div className="mt-1 text-xs text-rose-600 font-medium">Requires immediate operator intervention</div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-semibold">Warning Thresholds</div>
            <div className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {warningCount} Active
            </div>
            <div className="mt-1 text-xs text-amber-600 font-medium">Parameters approaching limit bounds</div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-semibold">Handled / Resolved</div>
            <div className="mt-1 text-2xl font-bold text-emerald-600">
              {resolvedCount} Alerts
            </div>
            <div className="mt-1 text-xs text-emerald-600 font-medium">Logged in compliance history</div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Severity Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search alerts by machine name, parameter, reason..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Filter:</span>
          <select
            className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary"
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
          >
            <option value="ALL">All Alerts</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="WARNING">Warning Only</option>
          </select>
        </div>
      </div>

      {/* Active Alerts Table */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4 text-rose-500" />
            Live Incident Roster ({filtered.length})
          </CardTitle>
          <CardDescription>Real-time operational alerts dispatched across MQTT, Email & Webhook channels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filtered.map((evt) => (
              <div
                key={evt.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-3.5 text-xs hover:bg-muted/30 transition-colors gap-3"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      evt.severity === "CRITICAL"
                        ? "bg-rose-500/10 text-rose-600"
                        : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{evt.asset_name}</span>
                      <Badge
                        className={
                          evt.severity === "CRITICAL"
                            ? "bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]"
                            : "bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]"
                        }
                      >
                        {evt.severity}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">{evt.description}</div>
                    <div className="text-[11px] text-muted-foreground pt-0.5">
                      Triggered Value: <strong className="text-rose-600 font-mono">{evt.triggered_value}</strong> (Threshold: {evt.threshold_value}) • {new Date(evt.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {evt.status === "ACTIVE" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-medium"
                      onClick={() => handleAcknowledge(evt.id)}
                    >
                      Acknowledge
                    </Button>
                  )}
                  {evt.status !== "RESOLVED" ? (
                    <Button
                      size="sm"
                      className="h-8 bg-primary hover:bg-primary/90 text-white text-xs font-semibold"
                      onClick={() => handleResolve(evt.id)}
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Resolve
                    </Button>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      <Check className="mr-1 h-3 w-3" /> Resolved
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
