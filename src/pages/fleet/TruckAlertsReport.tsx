import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isLogistixwareAccount } from "@/services/customerService";
import {
  syncTrakzeeAlerts,
  getTrakzeeTruckAlerts,
  type TrakzeeTruckAlert,
} from "@/services/trakzeeService";
import { acknowledgeGpsAlert } from "@/services/gpsService";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  AlertTriangle,
  ZapOff,
  Gauge,
  Clock,
  Printer,
  Download,
  RefreshCw,
  Search,
  Filter,
  Truck,
  MapPin,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  FileSpreadsheet,
  FileText,
  Calendar,
  AlertOctagon,
  Building2,
  Radio,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function TruckAlertsReport() {
  const { organisation, profile } = useAuth();
  const orgId = organisation?.id || profile?.organisation_id || "";
  const isLogistix = isLogistixwareAccount(organisation) || Boolean(organisation?.trakzee_enabled);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [alerts, setAlerts] = useState<TrakzeeTruckAlert[]>([]);
  const [viewMode, setViewMode] = useState<"dashboard" | "document">("dashboard");

  // Filters
  const [timePeriod, setTimePeriod] = useState<"today" | "yesterday" | "7days" | "30days" | "all">("today");
  const [truckFilter, setTruckFilter] = useState("all");
  const [alertTypeFilter, setAlertTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Acknowledge Dialog
  const [ackModalOpen, setAckModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<TrakzeeTruckAlert | null>(null);
  const [ackNotes, setAckNotes] = useState("");
  const [submittingAck, setSubmittingAck] = useState(false);

  // Print Container Ref
  const printRef = useRef<HTMLDivElement>(null);

  // Load Alerts for this account only
  const loadAlerts = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getTrakzeeTruckAlerts(orgId);
      setAlerts(data);
    } catch (err: any) {
      console.warn("Error loading stored alerts:", err);
      toast.error("Failed to load truck telematics alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [orgId]);

  // Sync Live Alerts from Trakzee API
  const handleSyncAlerts = async () => {
    if (!orgId) return;
    setSyncing(true);
    try {
      toast.info("Connecting to Trakzee API to fetch latest truck alerts...");
      const res = await syncTrakzeeAlerts(orgId);
      if (res.success) {
        setAlerts(res.alerts);
        setLastSyncedAt(new Date().toLocaleTimeString());
        toast.success(`Trakzee sync complete: ${res.alerts.length} truck alerts recorded.`);
      } else {
        toast.error(res.error || "Failed to sync Trakzee alerts");
      }
    } catch (err: any) {
      toast.error(err?.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  // Distinct trucks for selector
  const availableTrucks = useMemo(() => {
    const map = new Map<string, string>();
    alerts.forEach((a) => {
      const key = a.vehicle_plate || a.vehicle_name;
      if (key && !map.has(key)) {
        map.set(key, a.vehicle_name);
      }
    });
    return Array.from(map.entries()).map(([plate, name]) => ({ plate, name }));
  }, [alerts]);

  // Filtered Alert List
  const filteredAlerts = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return alerts.filter((a) => {
      // Time Period
      const alertDate = new Date(a.event_time);
      const alertDateStr = a.event_time.slice(0, 10);

      if (timePeriod === "today" && alertDateStr !== todayStr) return false;
      if (timePeriod === "yesterday" && alertDateStr !== yesterdayStr) return false;
      if (timePeriod === "7days" && alertDate < sevenDaysAgo) return false;
      if (timePeriod === "30days" && alertDate < thirtyDaysAgo) return false;

      // Truck Filter
      if (truckFilter !== "all") {
        const p = (a.vehicle_plate || a.vehicle_name).toLowerCase();
        if (p !== truckFilter.toLowerCase()) return false;
      }

      // Alert Type Filter
      if (alertTypeFilter !== "all" && a.alert_type !== alertTypeFilter) return false;

      // Severity Filter
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;

      // Search Query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = a.title.toLowerCase().includes(q);
        const matchMsg = a.message.toLowerCase().includes(q);
        const matchPlate = a.vehicle_plate.toLowerCase().includes(q);
        const matchDriver = (a.driver_name || "").toLowerCase().includes(q);
        const matchLoc = (a.location || "").toLowerCase().includes(q);
        if (!matchTitle && !matchMsg && !matchPlate && !matchDriver && !matchLoc) return false;
      }

      return true;
    });
  }, [alerts, timePeriod, truckFilter, alertTypeFilter, severityFilter, search]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let criticalCount = 0;
    let overspeedCount = 0;
    let powerCutCount = 0;
    let geofenceCount = 0;
    let unackCount = 0;

    const truckCountMap = new Map<string, number>();
    const driverCountMap = new Map<string, number>();

    filteredAlerts.forEach((a) => {
      if (a.severity === "critical") criticalCount++;
      if (a.alert_type === "overspeed") overspeedCount++;
      if (a.alert_type === "power_cut" || a.alert_type === "tampering") powerCutCount++;
      if (a.alert_type === "geofence_exit" || a.alert_type === "geofence_entry") geofenceCount++;
      if (!a.is_acknowledged) unackCount++;

      const trk = a.vehicle_plate || a.vehicle_name;
      if (trk) truckCountMap.set(trk, (truckCountMap.get(trk) || 0) + 1);

      if (a.driver_name) {
        driverCountMap.set(a.driver_name, (driverCountMap.get(a.driver_name) || 0) + 1);
      }
    });

    let topTruck = "--";
    let topTruckCount = 0;
    truckCountMap.forEach((count, truck) => {
      if (count > topTruckCount) {
        topTruckCount = count;
        topTruck = truck;
      }
    });

    let topDriver = "--";
    let topDriverCount = 0;
    driverCountMap.forEach((count, driver) => {
      if (count > topDriverCount) {
        topDriverCount = count;
        topDriver = driver;
      }
    });

    return {
      total: filteredAlerts.length,
      criticalCount,
      overspeedCount,
      powerCutCount,
      geofenceCount,
      unackCount,
      topTruck: topTruckCount > 0 ? `${topTruck} (${topTruckCount})` : "--",
      topDriver: topDriverCount > 0 ? `${topDriver} (${topDriverCount})` : "--",
    };
  }, [filteredAlerts]);

  // Handle Acknowledge Alert
  const handleOpenAck = (alert: TrakzeeTruckAlert) => {
    setSelectedAlert(alert);
    setAckNotes("");
    setAckModalOpen(true);
  };

  const handleConfirmAck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert) return;
    setSubmittingAck(true);

    try {
      const res = await acknowledgeGpsAlert(selectedAlert.id, ackNotes);
      if (!res.success) throw new Error(res.error || "Failed to acknowledge");

      setAlerts((prev) =>
        prev.map((a) =>
          a.id === selectedAlert.id
            ? { ...a, is_acknowledged: true, acknowledged_at: new Date().toISOString() }
            : a
        )
      );

      // Update localStorage cache
      const cacheKey = `mc_trakzee_truck_alerts_${orgId}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const list: TrakzeeTruckAlert[] = JSON.parse(cached);
          const updated = list.map((a) =>
            a.id === selectedAlert.id
              ? { ...a, is_acknowledged: true, acknowledged_at: new Date().toISOString() }
              : a
          );
          localStorage.setItem(cacheKey, JSON.stringify(updated));
        }
      } catch (_) {}

      toast.success("Alert acknowledged and recorded in safety compliance audit.");
      setAckModalOpen(false);
      setSelectedAlert(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to acknowledge alert");
    } finally {
      setSubmittingAck(false);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (filteredAlerts.length === 0) {
      toast.error("No alerts available to export");
      return;
    }

    const headers = [
      "TIMESTAMP",
      "TRUCK NO",
      "VEHICLE NAME",
      "DRIVER NAME",
      "ALERT TYPE",
      "SEVERITY",
      "SPEED (KM/H)",
      "LOCATION",
      "STATUS",
      "DETAILS",
    ];

    const rows = filteredAlerts.map((a) => [
      a.event_time,
      `"${a.vehicle_plate}"`,
      `"${a.vehicle_name}"`,
      `"${a.driver_name || "--"}"`,
      a.alert_type,
      a.severity.toUpperCase(),
      a.speed_kmh ?? "--",
      `"${(a.location || "").replace(/"/g, '""')}"`,
      a.is_acknowledged ? "ACKNOWLEDGED" : "PENDING REVIEW",
      `"${a.message.replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Truck_Alerts_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV report downloaded successfully");
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Truck Telematics & Safety Alerts Report
                <Badge variant="outline" className="text-[10px] uppercase font-mono border-rose-500/30 text-rose-600 bg-rose-500/5">
                  Trakzee GPS API
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Official safety audit feed: speed violations, geofence excursions, power sabotage, and emergency panic alerts for {organisation?.name || "LOGISTIXWARE"}.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-lg p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode("dashboard")}
              className={cn(
                "px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5",
                viewMode === "dashboard" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Gauge className="h-3.5 w-3.5" /> Dashboard
            </button>
            <button
              type="button"
              onClick={() => setViewMode("document")}
              className={cn(
                "px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5",
                viewMode === "document" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="h-3.5 w-3.5" /> Official Document
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 text-xs font-semibold gap-1.5"
            title="Download CSV spreadsheet"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-8 text-xs font-semibold gap-1.5"
            title="Print Corporate Incident Report"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Report
          </Button>

          <Button
            size="sm"
            onClick={handleSyncAlerts}
            disabled={syncing}
            className="h-8 text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            {syncing ? "Syncing API..." : "Sync Trakzee Alerts"}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Total Alerts */}
        <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase">
            <span>Total Alerts</span>
            <AlertTriangle className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="mt-1 text-2xl font-black text-foreground font-mono">{metrics.total}</div>
          <span className="text-[10px] text-muted-foreground">In selected period</span>
        </div>

        {/* 2. Critical Breaches */}
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 shadow-xs">
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 text-[10px] font-bold uppercase">
            <span>Critical Breaches</span>
            <ZapOff className="h-3.5 w-3.5 text-rose-500" />
          </div>
          <div className="mt-1 text-2xl font-black text-rose-600 font-mono">{metrics.criticalCount}</div>
          <span className="text-[10px] text-muted-foreground">Severe speed / power cuts</span>
        </div>

        {/* 3. Over-Speed Events */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase">
            <span>{"Over-Speed (>80km/h)"}</span>
            <Gauge className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="mt-1 text-2xl font-black text-amber-600 font-mono">{metrics.overspeedCount}</div>
          <span className="text-[10px] text-muted-foreground">Highway speed violations</span>
        </div>

        {/* 4. Power & Hardware Tamper */}
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 shadow-xs">
          <div className="flex items-center justify-between text-purple-700 dark:text-purple-400 text-[10px] font-bold uppercase">
            <span>Power Disconnect</span>
            <Radio className="h-3.5 w-3.5 text-purple-500" />
          </div>
          <div className="mt-1 text-2xl font-black text-purple-600 font-mono">{metrics.powerCutCount}</div>
          <span className="text-[10px] text-muted-foreground">0V line disconnects</span>
        </div>

        {/* 5. Most Infraction Truck */}
        <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase">
            <span>Top Truck</span>
            <Truck className="h-3.5 w-3.5 text-sky-500" />
          </div>
          <div className="mt-1 text-sm font-black font-mono text-foreground truncate" title={metrics.topTruck}>
            {metrics.topTruck}
          </div>
          <span className="text-[10px] text-muted-foreground">Highest triggers</span>
        </div>

        {/* 6. Pending Review */}
        <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase">
            <span>Pending Review</span>
            <Clock className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="mt-1 text-2xl font-black text-amber-600 font-mono">{metrics.unackCount}</div>
          <span className="text-[10px] text-muted-foreground">Unacknowledged</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-muted/20 border border-border p-3 rounded-xl shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Selector */}
          <Select value={timePeriod} onValueChange={(val: any) => setTimePeriod(val)}>
            <SelectTrigger className="h-8 text-xs font-semibold w-36 bg-background">
              <Calendar className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="all">All History</SelectItem>
            </SelectContent>
          </Select>

          {/* Truck Selector */}
          <Select value={truckFilter} onValueChange={setTruckFilter}>
            <SelectTrigger className="h-8 text-xs font-semibold w-44 bg-background">
              <Truck className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="All Trucks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Fleet Trucks ({availableTrucks.length})</SelectItem>
              {availableTrucks.map((t) => (
                <SelectItem key={t.plate} value={t.plate}>
                  {t.plate} ({t.name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Alert Type Selector */}
          <Select value={alertTypeFilter} onValueChange={setAlertTypeFilter}>
            <SelectTrigger className="h-8 text-xs font-semibold w-40 bg-background">
              <AlertTriangle className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Alert Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Alert Types</SelectItem>
              <SelectItem value="overspeed">Over Speed</SelectItem>
              <SelectItem value="power_cut">Power Cut / Disconnect</SelectItem>
              <SelectItem value="harsh_braking">Harsh Braking</SelectItem>
              <SelectItem value="harsh_acceleration">Harsh Acceleration</SelectItem>
              <SelectItem value="geofence_exit">Geofence Exit</SelectItem>
              <SelectItem value="sos">Emergency SOS</SelectItem>
              <SelectItem value="idling">Excessive Idling</SelectItem>
            </SelectContent>
          </Select>

          {/* Severity Selector */}
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="h-8 text-xs font-semibold w-32 bg-background">
              <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search plate, driver, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-background"
          />
        </div>
      </div>

      {/* DASHBOARD VIEW: Interactive Table */}
      {viewMode === "dashboard" && (
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/50 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3">Date & Time</th>
                  <th className="py-3 px-3">Severity</th>
                  <th className="py-3 px-3">Truck No. / Vehicle</th>
                  <th className="py-3 px-3">Driver</th>
                  <th className="py-3 px-3">Violation / Alert Type</th>
                  <th className="py-3 px-3 text-right">Speed</th>
                  <th className="py-3 px-3">Location / Highway</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-2 text-center w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-sans">
                {filteredAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      <ShieldAlert className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="font-semibold text-foreground">No truck alerts matching filter criteria.</p>
                      <p className="text-xs mt-1">Click "Sync Trakzee Alerts" above to poll the live telematics webservice.</p>
                    </td>
                  </tr>
                ) : (
                  filteredAlerts.map((a) => {
                    const isCrit = a.severity === "critical";
                    const isWarn = a.severity === "warning";

                    return (
                      <tr key={a.id} className="hover:bg-muted/30 transition-colors group">
                        {/* 1. Date & Time */}
                        <td className="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap">
                          {new Date(a.event_time).toLocaleDateString()} {new Date(a.event_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>

                        {/* 2. Severity */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <Badge
                            className={cn(
                              "text-[10px] uppercase font-bold",
                              isCrit
                                ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                : isWarn
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                : "bg-sky-500/10 text-sky-600 border-sky-500/20"
                            )}
                          >
                            {a.severity}
                          </Badge>
                        </td>

                        {/* 3. Truck No. */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-foreground font-mono flex items-center gap-1.5">
                            <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span>{a.vehicle_plate}</span>
                          </div>
                          {a.vehicle_name && a.vehicle_name !== a.vehicle_plate && (
                            <div className="text-[10px] text-muted-foreground ml-5">{a.vehicle_name}</div>
                          )}
                        </td>

                        {/* 4. Driver */}
                        <td className="py-2.5 px-3 font-medium text-foreground">
                          {a.driver_name || <span className="text-muted-foreground">--</span>}
                        </td>

                        {/* 5. Alert Type & Message */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-foreground">{a.title}</div>
                          <div className="text-[11px] text-muted-foreground max-w-sm truncate" title={a.message}>
                            {a.message}
                          </div>
                        </td>

                        {/* 6. Speed */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {a.speed_kmh !== undefined && a.speed_kmh !== null && a.speed_kmh > 0 ? (
                            <span className={cn(a.speed_kmh > 80 ? "text-rose-600 font-extrabold" : "text-foreground")}>
                              {Math.round(a.speed_kmh)} km/h
                            </span>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </td>

                        {/* 7. Location */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="max-w-xs truncate" title={a.location || "Position logged"}>
                              {a.location || (a.latitude && a.longitude ? `${a.latitude.toFixed(4)}, ${a.longitude.toFixed(4)}` : "Route En Route")}
                            </span>
                          </div>
                          {a.latitude && a.longitude && (
                            <a
                              href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-primary hover:underline ml-4 flex items-center gap-0.5 mt-0.5"
                            >
                              View Map <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </td>

                        {/* 8. Status */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {a.is_acknowledged ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" /> Acknowledged
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600">
                              <Clock className="h-3 w-3" /> Pending Review
                            </span>
                          )}
                        </td>

                        {/* 9. Action */}
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          {!a.is_acknowledged ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenAck(a)}
                              className="h-6 px-2 text-[10px] font-bold text-primary hover:bg-primary/10"
                            >
                              Acknowledge
                            </Button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Verified</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DOCUMENT VIEW: Official Corporate Safety Report */}
      {viewMode === "document" && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-6 shadow-sm" ref={printRef}>
          {/* Document Header */}
          <div className="border-b-2 border-primary/30 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-xs uppercase tracking-widest font-extrabold text-primary">
                {organisation?.name || "LOGISTIXWARE TANZANIA LIMITED"}
              </span>
              <h2 className="text-xl font-black text-foreground uppercase tracking-tight mt-0.5">
                TRUCK TELEMATICS & SAFETY INCIDENT AUDIT REPORT
              </h2>
              <p className="text-xs text-muted-foreground">
                Automated Fleet GPS Safety Monitoring, Over-Speed Violations & Device Hardware Integrity
              </p>
            </div>
            <div className="text-right text-xs space-y-0.5 font-mono">
              <p><strong>Generated:</strong> {new Date().toLocaleString()}</p>
              <p><strong>Period:</strong> {timePeriod.toUpperCase()}</p>
              <p><strong>Report ID:</strong> RPT-SEC-{Date.now().toString().slice(-6)}</p>
            </div>
          </div>

          {/* Statistical Breakdown Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3.5 rounded-lg border border-border text-xs">
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">Total Incidents</span>
              <span className="text-lg font-black font-mono text-foreground">{metrics.total}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">Critical Violations</span>
              <span className="text-lg font-black font-mono text-rose-600">{metrics.criticalCount}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">{"Over Speed (>80 km/h)"}</span>
              <span className="text-lg font-black font-mono text-amber-600">{metrics.overspeedCount}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">Hardware Cut (0V)</span>
              <span className="text-lg font-black font-mono text-purple-600">{metrics.powerCutCount}</span>
            </div>
          </div>

          {/* Itemized Table */}
          <table className="w-full text-xs text-left border border-border border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border text-[10px] font-bold text-muted-foreground uppercase">
                <th className="p-2 border border-border">TIMESTAMP</th>
                <th className="p-2 border border-border">SEVERITY</th>
                <th className="p-2 border border-border">TRUCK NO</th>
                <th className="p-2 border border-border">DRIVER</th>
                <th className="p-2 border border-border">VIOLATION DETAILS</th>
                <th className="p-2 border border-border text-right">SPEED</th>
                <th className="p-2 border border-border">LOCATION / HIGHWAY</th>
                <th className="p-2 border border-border text-center">AUDIT STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAlerts.map((row) => (
                <tr key={row.id} className="border-b border-border">
                  <td className="p-2 font-mono text-muted-foreground">{new Date(row.event_time).toLocaleString()}</td>
                  <td className="p-2 font-bold uppercase text-[10px]">{row.severity}</td>
                  <td className="p-2 font-mono font-bold text-foreground">{row.vehicle_plate}</td>
                  <td className="p-2 font-medium">{row.driver_name || "--"}</td>
                  <td className="p-2">
                    <span className="font-semibold text-foreground">{row.title}</span>: {row.message}
                  </td>
                  <td className="p-2 text-right font-mono font-bold">{row.speed_kmh ? `${Math.round(row.speed_kmh)} km/h` : "--"}</td>
                  <td className="p-2 text-muted-foreground">{row.location || "--"}</td>
                  <td className="p-2 text-center">{row.is_acknowledged ? "ACKNOWLEDGED" : "PENDING"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Formal Audit Sign-Off Blocks */}
          <div className="grid grid-cols-3 gap-6 pt-10 text-xs text-center border-t border-border">
            <div className="border-t border-border pt-2">
              <p className="font-bold text-foreground">Prepared By</p>
              <p className="text-[10px] text-muted-foreground">Fleet Telematics Controller</p>
            </div>
            <div className="border-t border-border pt-2">
              <p className="font-bold text-foreground">Audited By</p>
              <p className="text-[10px] text-muted-foreground">Transport Safety & Compliance Officer</p>
            </div>
            <div className="border-t border-border pt-2">
              <p className="font-bold text-foreground">Authorized By</p>
              <p className="text-[10px] text-muted-foreground">Director of Fleet Operations</p>
            </div>
          </div>
        </div>
      )}

      {/* Acknowledge Alert Modal */}
      <Dialog open={ackModalOpen} onOpenChange={setAckModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Acknowledge Truck Telematics Alert</DialogTitle>
            <DialogDescription>
              Record operator notes and log this incident into the safety compliance audit register.
            </DialogDescription>
          </DialogHeader>

          {selectedAlert && (
            <form onSubmit={handleConfirmAck} className="space-y-4 py-2">
              <div className="bg-muted/40 p-3 rounded-lg border border-border space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Truck:</span>
                  <span className="font-bold font-mono text-foreground">{selectedAlert.vehicle_plate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Violation:</span>
                  <span className="font-semibold text-rose-600">{selectedAlert.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recorded Time:</span>
                  <span className="font-mono">{new Date(selectedAlert.event_time).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Operator Resolution Notes (Optional)</label>
                <Textarea
                  placeholder="e.g. Driver contacted via radio; slowed down immediately. Dispatched safety warning."
                  value={ackNotes}
                  onChange={(e) => setAckNotes(e.target.value)}
                  className="text-xs"
                  rows={3}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setAckModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submittingAck}
                  className="bg-primary text-primary-foreground font-bold"
                >
                  {submittingAck ? "Saving..." : "Confirm Acknowledgment"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
