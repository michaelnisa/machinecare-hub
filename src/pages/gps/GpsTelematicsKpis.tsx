import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GpsNavHeader } from "./GpsNavHeader";
import {
  getGpsTelematicsKpis,
  toggleVehicleEngineImmobilizer,
  type TelematicsKpisReport,
} from "@/services/gpsService";
import { formatNumber } from "@/lib/format";
import {
  Gauge,
  Activity,
  Fuel,
  ShieldAlert,
  Radio,
  Truck,
  TrendingUp,
  MapPin,
  History,
  Power,
  PowerOff,
  Zap,
  ZapOff,
  Download,
  AlertTriangle,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

export default function GpsTelematicsKpis() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [data, setData] = useState<TelematicsKpisReport | null>(null);
  const [togglingVehicleId, setTogglingVehicleId] = useState<string | null>(null);

  const loadKpis = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const report = await getGpsTelematicsKpis(organisation.id, days);
      setData(report);
    } catch (err: any) {
      toast.error("Failed to load GPS telematics KPIs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKpis();
  }, [organisation?.id, days]);

  const handleToggleImmobilizer = async (vehicleId: string, currentCut: boolean, name: string) => {
    const action = currentCut ? "restore engine ignition" : "remotely cut the engine";
    if (!window.confirm(`Are you sure you want to ${action} for vehicle ${name}?`)) {
      return;
    }
    setTogglingVehicleId(vehicleId);
    try {
      const res = await toggleVehicleEngineImmobilizer(vehicleId, !currentCut);
      if (res.success) {
        toast.success(currentCut ? "Engine ignition restored" : "Vehicle engine cut command transmitted");
        await loadKpis();
      } else {
        toast.error(res.error || "Failed to execute immobilizer command");
      }
    } catch {
      toast.error("Execution failed");
    } finally {
      setTogglingVehicleId(null);
    }
  };

  const handleExportCsv = () => {
    if (!data) return;
    const headers = [
      "Vehicle Plate",
      "Model",
      "Motion Status",
      "Distance Covered (km)",
      "Avg Speed (km/h)",
      "Max Speed (km/h)",
      "Idling Hours",
      "Safety Score (%)",
      "Immobilizer Status",
    ];
    const rows = data.vehicleLeaderboard.map((v) => [
      `"${v.plate}"`,
      `"${v.name}"`,
      v.motionStatus,
      v.periodKm,
      v.avgSpeed,
      v.maxSpeed,
      v.idlingHours,
      `${v.safetyScore}%`,
      v.isImmobilized ? "Immobilized (Cut)" : "Normal (Active)",
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `gps_telematics_kpi_${days}d.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Telematics KPI report downloaded");
  };

  const maxDailyMileage = useMemo(() => {
    if (!data?.dailyMileage?.length) return 100;
    return Math.max(...data.dailyMileage.map((d) => d.km), 100);
  }, [data]);

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <GpsNavHeader />

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">GPS Telematics & Fleet KPIs</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
              Live Fleet Intelligence
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time mileage, fuel wastage, driving safety, and tracker health diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1.5 rounded-lg border border-border">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Period:</span>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-[120px] h-7 text-xs border-0 bg-transparent shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="14">Last 14 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button size="sm" variant="outline" onClick={handleExportCsv} disabled={!data || loading} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Export Telematics CSV
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <PageLoader />
      ) : !data ? (
        <EmptyState
          icon={<Gauge className="h-6 w-6 text-muted-foreground" />}
          title="No telematics data available"
          description="Tracked vehicles will automatically aggregate mileage and speed KPIs once GPS streaming begins."
        />
      ) : (
        <>
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* 1. Total Mileage */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium uppercase">
                <span>Fleet Distance</span>
                <Truck className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                {formatNumber(data.totalDistanceKm)} <span className="text-xs font-normal text-muted-foreground">km</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Across {data.totalVehicles} tracked assets</p>
            </div>

            {/* 2. Motion Distribution */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium uppercase">
                <span>Active Moving</span>
                <Activity className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
                {data.movingCount} <span className="text-xs font-normal text-muted-foreground">/ {data.totalVehicles}</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {Math.round((data.movingCount / Math.max(data.totalVehicles, 1)) * 100)}% utilization
              </p>
            </div>

            {/* 3. Cruise Speed */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium uppercase">
                <span>Speed Metrics</span>
                <Gauge className="h-4 w-4 text-sky-500" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-sky-600">
                {data.avgSpeedKmh} <span className="text-xs font-normal text-muted-foreground">avg km/h</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Max speed: {data.maxSpeedKmh} km/h</p>
            </div>

            {/* 4. Idling Fuel Wastage */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium uppercase">
                <span>Idle Fuel Loss</span>
                <Fuel className="h-4 w-4 text-amber-500" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600">
                {formatNumber(data.wastedFuelLitres)} <span className="text-xs font-normal text-muted-foreground">L</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{data.idlingHoursTotal} hrs idling</p>
            </div>

            {/* 5. Driver Safety Events */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium uppercase">
                <span>Safety Alerts</span>
                <ShieldAlert className="h-4 w-4 text-rose-500" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600">
                {data.overspeedEvents + data.harshBrakingEvents + data.geofenceEvents}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {data.overspeedEvents} overspeed · {data.harshBrakingEvents} harsh
              </p>
            </div>

            {/* 6. Tracker Uptime */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium uppercase">
                <span>Tracker Uptime</span>
                <Radio className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
                {data.onlineTrackerPercent}%
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">GPS signal online</p>
            </div>
          </div>

          {/* Daily Fleet Mileage Trend Chart */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Daily Fleet Mileage & Active Vehicle Velocity
                </h3>
                <p className="text-xs text-muted-foreground">
                  Aggregated distance (km) traversed across all monitored vehicles over the last {days} days.
                </p>
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                Total: <strong>{formatNumber(data.totalDistanceKm)} km</strong>
              </div>
            </div>

            <div className="mt-4 flex items-end gap-1.5 h-44 pt-6 overflow-x-auto">
              {data.dailyMileage.map((d) => {
                const heightPercent = Math.max(12, Math.round((d.km / maxDailyMileage) * 100));
                return (
                  <div key={d.date} className="flex-1 min-w-[28px] flex flex-col items-center gap-1.5 group relative">
                    <div className="w-full flex justify-center">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-full max-w-[24px] rounded-t-md bg-primary/80 group-hover:bg-primary transition-all relative"
                      >
                        {/* Tooltip on hover */}
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                          <div className="bg-popover text-popover-foreground text-[10px] font-mono px-2 py-0.5 rounded shadow-md border border-border whitespace-nowrap">
                            {formatNumber(d.km)} km ({d.movingVehicles} veh)
                          </div>
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] text-muted-foreground rotate-45 origin-left truncate w-6">
                      {d.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vehicle Telematics Leaderboard */}
          <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-primary" />
                  Vehicle Telematics Leaderboard & Remote Controls
                </h3>
                <p className="text-xs text-muted-foreground">
                  Individual asset telematics performance, driver safety scores, and instant engine immobilizer actuation.
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                Showing {data.vehicleLeaderboard.length} tracked assets
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 text-muted-foreground uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Vehicle & Model</th>
                    <th className="py-3 px-4 font-semibold">Motion Status</th>
                    <th className="py-3 px-4 font-semibold">Period Mileage</th>
                    <th className="py-3 px-4 font-semibold">Speed Profile</th>
                    <th className="py-3 px-4 font-semibold">Idle Fuel Loss</th>
                    <th className="py-3 px-4 font-semibold text-center">Safety Score</th>
                    <th className="py-3 px-4 font-semibold text-center">Engine Relay</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.vehicleLeaderboard.map((v) => {
                    const isBusy = togglingVehicleId === v.vehicleId;
                    return (
                      <tr key={v.vehicleId} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono font-bold text-foreground text-sm">{v.plate}</div>
                          <div className="text-[11px] text-muted-foreground">{v.name}</div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              v.motionStatus === "moving"
                                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                : v.motionStatus === "idling"
                                ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                : v.motionStatus === "stopped"
                                ? "bg-sky-500/10 text-sky-600 border border-sky-500/20"
                                : "bg-slate-500/10 text-slate-600 border border-slate-500/20"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                v.motionStatus === "moving"
                                  ? "bg-emerald-500 animate-pulse"
                                  : v.motionStatus === "idling"
                                  ? "bg-amber-500 animate-pulse"
                                  : "bg-current"
                              }`}
                            />
                            {v.motionStatus === "moving" ? `${v.speedKmh} km/h` : v.motionStatus}
                          </span>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap font-mono font-semibold text-foreground">
                          {formatNumber(v.periodKm)} km
                          <div className="text-[10px] text-muted-foreground font-normal">
                            Odo: {v.currentOdo ? `${formatNumber(v.currentOdo)} km` : "—"}
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-medium text-foreground">Avg: {v.avgSpeed} km/h</div>
                          <div className="text-[11px] text-muted-foreground">Max: {v.maxSpeed} km/h</div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-medium text-amber-600">
                            ~{Math.round(v.idlingHours * 3.5)} L wasted
                          </div>
                          <div className="text-[11px] text-muted-foreground">{v.idlingHours} hrs idling</div>
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold text-xs px-2 py-0.5 rounded-md ${
                              v.safetyScore >= 85
                                ? "bg-emerald-500/10 text-emerald-600"
                                : v.safetyScore >= 70
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-rose-500/10 text-rose-600"
                            }`}
                          >
                            {v.safetyScore}%
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {v.isImmobilized ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                              <ZapOff className="h-3 w-3" /> CUT
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              <Zap className="h-3 w-3" /> READY
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              to={`/gps/replay?vehicleId=${v.vehicleId}`}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-[11px] font-medium hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="Route History Replay"
                            >
                              <History className="h-3 w-3 text-primary" />
                              Replay
                            </Link>

                            <Link
                              to={`/gps/live-map?selected=${v.vehicleId}`}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-[11px] font-medium hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="Track Live on Map"
                            >
                              <MapPin className="h-3 w-3 text-emerald-600" />
                              Live
                            </Link>

                            <Button
                              size="sm"
                              variant={v.isImmobilized ? "default" : "destructive"}
                              disabled={isBusy}
                              onClick={() => handleToggleImmobilizer(v.vehicleId, v.isImmobilized, v.plate)}
                              className={`h-7 text-xs px-2 font-medium ${
                                v.isImmobilized
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                  : "bg-rose-600 hover:bg-rose-700 text-white"
                              }`}
                            >
                              {isBusy ? (
                                "..."
                              ) : v.isImmobilized ? (
                                <>
                                  <Power className="h-3 w-3 mr-1" />
                                  Restore
                                </>
                              ) : (
                                <>
                                  <PowerOff className="h-3 w-3 mr-1" />
                                  Cut
                                </>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
