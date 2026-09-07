import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Boxes,
  Wifi,
  WifiOff,
  AlertOctagon,
  Database,
  Building2,
  MapPin,
  CheckCircle2,
  TrendingUp,
  Activity,
  Plus,
  ArrowRight,
  ShieldCheck,
  Search,
  Bell,
  Sliders,
  Radio,
  Clock,
  Thermometer,
  Fuel,
  Battery,
  Gauge,
} from "lucide-react";
import {
  MOCK_CONNECTED_CUSTOMERS,
  MOCK_CONNECTED_SITES,
  MOCK_CONNECTED_ASSETS,
  MOCK_CONNECTED_EVENTS,
} from "@/lib/connected-data-mock";
import { useToast } from "@/components/ui/use-toast";

export default function ConnectedDataDashboard() {
  const { toast } = useToast();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("ALL");
  const [events, setEvents] = useState(MOCK_CONNECTED_EVENTS);

  // Live telemetry pulse simulation for human-friendly machine spotlights
  const [liveStats, setLiveStats] = useState({
    shovelTemp: 87.4,
    shovelRpm: 1450,
    shovelFuel: 72,
    shovelVolt: 24.8,
    genLoad: 78.4,
    genFreq: 50.02,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveStats((prev) => ({
        shovelTemp: +(prev.shovelTemp + (Math.random() * 0.6 - 0.3)).toFixed(1),
        shovelRpm: Math.round(prev.shovelRpm + (Math.random() * 16 - 8)),
        shovelFuel: +(prev.shovelFuel - 0.01).toFixed(1),
        shovelVolt: +(prev.shovelVolt + (Math.random() * 0.1 - 0.05)).toFixed(1),
        genLoad: +(prev.genLoad + (Math.random() * 1.2 - 0.6)).toFixed(1),
        genFreq: +(50.0 + (Math.random() - 0.5) * 0.04).toFixed(2),
      }));
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const handleAcknowledgeEvent = (id: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "ACKNOWLEDGED" } : e))
    );
    toast({
      title: "Alert Acknowledged",
      description: "Notification marked as acknowledged by operator.",
    });
  };

  const filteredAssets =
    selectedCustomerId === "ALL"
      ? MOCK_CONNECTED_ASSETS
      : MOCK_CONNECTED_ASSETS.filter((a) => a.customer_id === selectedCustomerId);

  const filteredSites =
    selectedCustomerId === "ALL"
      ? MOCK_CONNECTED_SITES
      : MOCK_CONNECTED_SITES.filter((s) => s.customer_id === selectedCustomerId);

  return (
    <div className="space-y-6">
      {/* Friendly Top Welcome Banner */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Connected Operations Overview
            </h1>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs font-semibold">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" /> All Systems Online
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time physical asset monitoring, live telemetry & operational alerts across all sites
          </p>
        </div>

        {/* Customer Workspace Filter & Quick Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 shadow-sm">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">Organization:</span>
            <select
              className="bg-transparent text-xs font-medium text-foreground focus:outline-none cursor-pointer"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
            >
              <option value="ALL">All Client Accounts (Master View)</option>
              {MOCK_CONNECTED_CUSTOMERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-white font-semibold">
            <Link to="/connected-data/assets">
              <Plus className="mr-1.5 h-4 w-4" /> Register Asset
            </Link>
          </Button>
        </div>
      </div>

      {/* 4 Core Essential KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total Assets */}
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Total Fleet & Machinery</span>
              <Boxes className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {filteredAssets.length * 320 || 1284}
            </div>
            <div className="mt-1 flex items-center text-xs text-emerald-600 font-medium">
              <TrendingUp className="mr-1 h-3 w-3" /> +48 new machines this month
            </div>
          </CardContent>
        </Card>

        {/* Connected Rate */}
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Online & Connected</span>
              <Wifi className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {Math.round((filteredAssets.length * 320 || 1284) * 0.905)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              90.5% healthy streaming rate
            </div>
          </CardContent>
        </Card>

        {/* Needs Attention / Offline */}
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Active Alerts</span>
              <AlertOctagon className="h-4 w-4 text-rose-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
              27
            </div>
            <div className="mt-1 text-xs text-rose-600 font-medium">
              4 critical events requiring action
            </div>
          </CardContent>
        </Card>

        {/* Telemetry Points */}
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Data Stream Volume</span>
              <Database className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              18.4M
            </div>
            <div className="mt-1 text-xs text-emerald-600 font-medium">
              99.45% data availability score
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Navigation Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link
          to="/connected-data/live"
          className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm hover:border-primary/50 transition-all"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Live Telemetry</div>
            <div className="text-[11px] text-muted-foreground">Real-time parameters</div>
          </div>
        </Link>

        <Link
          to="/connected-data/explorer"
          className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm hover:border-primary/50 transition-all"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Search className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Data Explorer</div>
            <div className="text-[11px] text-muted-foreground">Historical charts & export</div>
          </div>
        </Link>

        <Link
          to="/connected-data/alerts"
          className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm hover:border-primary/50 transition-all"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Alerts Inbox</div>
            <div className="text-[11px] text-muted-foreground">Threshold breaches</div>
          </div>
        </Link>

        <Link
          to="/connected-data/reports"
          className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm hover:border-primary/50 transition-all"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Compliance Reports</div>
            <div className="text-[11px] text-muted-foreground">Availability & uptime</div>
          </div>
        </Link>
      </div>

      {/* Main Section: Live Machinery Spotlight & Operational Alerts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live Equipment Telemetry Spotlight (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
              Live Machinery Telemetry Spotlight
            </h2>
            <Link to="/connected-data/live" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              View All Streams <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Machine Card 1: CAT 6040 Excavator */}
            <Card className="border-border hover:border-primary/40 transition-all">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                      <Boxes className="h-4 w-4 text-primary" />
                      CAT 6040 Mining Shovel 01
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Mine Site A (Pilbara) • CAN / J1939 Gateway
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                    ONLINE
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="rounded-lg bg-muted/40 p-2.5">
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Thermometer className="h-3.5 w-3.5 text-rose-500" /> Coolant Temp
                    </div>
                    <div className="text-lg font-bold text-foreground mt-0.5">
                      {liveStats.shovelTemp} °C
                    </div>
                    <div className="text-[10px] text-emerald-600 font-medium">Optimal Band</div>
                  </div>

                  <div className="rounded-lg bg-muted/40 p-2.5">
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Gauge className="h-3.5 w-3.5 text-primary" /> Engine Speed
                    </div>
                    <div className="text-lg font-bold text-foreground mt-0.5">
                      {liveStats.shovelRpm} RPM
                    </div>
                    <div className="text-[10px] text-muted-foreground">Target: 1,500</div>
                  </div>

                  <div className="rounded-lg bg-muted/40 p-2.5">
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Fuel className="h-3.5 w-3.5 text-amber-500" /> Fuel Level
                    </div>
                    <div className="text-lg font-bold text-foreground mt-0.5">
                      {liveStats.shovelFuel} %
                    </div>
                    <div className="text-[10px] text-muted-foreground">Est 18h left</div>
                  </div>

                  <div className="rounded-lg bg-muted/40 p-2.5">
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Battery className="h-3.5 w-3.5 text-blue-500" /> Battery
                    </div>
                    <div className="text-lg font-bold text-foreground mt-0.5">
                      {liveStats.shovelVolt} V
                    </div>
                    <div className="text-[10px] text-emerald-600 font-medium">Alternator Good</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Machine Card 2: Cummins Diesel Generator */}
            <Card className="border-border hover:border-primary/40 transition-all">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                      <Boxes className="h-4 w-4 text-primary" />
                      Cummins QSK60 Generator 02
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Substation 04 North • Modbus TCP Node
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                    ONLINE
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="rounded-lg bg-muted/40 p-2.5">
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Activity className="h-3.5 w-3.5 text-primary" /> Active Load
                    </div>
                    <div className="text-lg font-bold text-foreground mt-0.5">
                      {liveStats.genLoad} %
                    </div>
                    <div className="text-[10px] text-emerald-600 font-medium">High Efficiency</div>
                  </div>

                  <div className="rounded-lg bg-muted/40 p-2.5">
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Sliders className="h-3.5 w-3.5 text-blue-500" /> AC Frequency
                    </div>
                    <div className="text-lg font-bold text-foreground mt-0.5">
                      {liveStats.genFreq} Hz
                    </div>
                    <div className="text-[10px] text-emerald-600 font-medium">Grid Locked</div>
                  </div>

                  <div className="rounded-lg bg-muted/40 p-2.5">
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Total Hours
                    </div>
                    <div className="text-lg font-bold text-foreground mt-0.5">
                      4,281 h
                    </div>
                    <div className="text-[10px] text-muted-foreground">PM Due in 120h</div>
                  </div>

                  <div className="rounded-lg bg-muted/40 p-2.5">
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Radio className="h-3.5 w-3.5 text-primary" /> Signal
                    </div>
                    <div className="text-lg font-bold text-foreground mt-0.5">
                      -68 dBm
                    </div>
                    <div className="text-[10px] text-emerald-600 font-medium">Excellent</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Operational Alerts & Incident Inbox (1 Col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Bell className="h-4 w-4 text-rose-500" />
              Recent Operational Alerts
            </h2>
            <Link to="/connected-data/alerts" className="text-xs font-semibold text-primary hover:underline">
              View All
            </Link>
          </div>

          <Card className="border-border">
            <CardContent className="p-3 space-y-3">
              {events.slice(0, 3).map((evt) => (
                <div
                  key={evt.id}
                  className="flex flex-col gap-1.5 rounded-lg border p-3 text-xs hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{evt.asset_name}</span>
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
                  <div className="text-muted-foreground leading-relaxed">{evt.description}</div>
                  <div className="flex items-center justify-between pt-1 border-t text-[11px]">
                    <span className="text-muted-foreground font-mono">
                      Value: <strong className="text-foreground">{evt.triggered_value}</strong>
                    </span>
                    {evt.status === "ACTIVE" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] text-primary hover:text-primary/80 px-2"
                        onClick={() => handleAcknowledgeEvent(evt.id)}
                      >
                        Acknowledge
                      </Button>
                    ) : (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Acknowledged
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Facilities & Sites Status Summary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Managed Industrial Sites & Facilities
          </h2>
          <Link to="/connected-data/sites" className="text-xs font-semibold text-primary hover:underline">
            Manage Sites ({filteredSites.length})
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {filteredSites.slice(0, 3).map((site) => (
            <div
              key={site.id}
              className="flex items-center justify-between rounded-lg border bg-card p-3.5 text-xs shadow-sm hover:border-primary/40 transition-colors"
            >
              <div>
                <div className="font-bold text-foreground text-sm">{site.name}</div>
                <div className="text-muted-foreground mt-0.5">
                  {site.customer_name} • {site.location}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-primary text-sm">{site.asset_count} Machines</div>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 mt-1"
                >
                  {site.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
