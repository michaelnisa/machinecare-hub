import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  getGpsAlerts,
  acknowledgeGpsAlert,
  GpsAlert,
} from "@/services/gpsService";
import { formatDate } from "@/lib/format";
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Filter,
  Search,
  ArrowLeft,
  Truck,
  MapPin,
  Clock,
  ZapOff,
  Gauge,
  Target,
} from "lucide-react";
import { toast } from "sonner";

export default function GpsAlerts() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<GpsAlert[]>([]);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Acknowledge Dialog
  const [ackModalOpen, setAckModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<GpsAlert | null>(null);
  const [ackNotes, setAckNotes] = useState("");
  const [submittingAck, setSubmittingAck] = useState(false);

  const loadData = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const data = await getGpsAlerts(organisation.id);
      setAlerts(data);
    } catch (err) {
      toast.error("Failed to load GPS alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  const metrics = useMemo(() => {
    let criticalCount = 0;
    let warningCount = 0;
    let unackCount = 0;

    alerts.forEach((a) => {
      if (a.severity === "critical") criticalCount++;
      if (a.severity === "warning") warningCount++;
      if (!a.is_acknowledged) unackCount++;
    });

    return { total: alerts.length, criticalCount, warningCount, unackCount };
  }, [alerts]);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      if (statusFilter === "unack" && a.is_acknowledged) return false;
      if (statusFilter === "ack" && !a.is_acknowledged) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = a.title.toLowerCase().includes(q);
        const matchMsg = a.message.toLowerCase().includes(q);
        const matchVehicle = (a.vehicle?.name || "").toLowerCase().includes(q) || (a.vehicle?.plate_number || "").toLowerCase().includes(q);
        if (!matchTitle && !matchMsg && !matchVehicle) return false;
      }
      return true;
    });
  }, [alerts, severityFilter, statusFilter, search]);

  const handleOpenAck = (alert: GpsAlert) => {
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
      toast.success("Alert acknowledged and recorded in audit log.");
      setAckModalOpen(false);
      setSelectedAlert(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to acknowledge alert");
    } finally {
      setSubmittingAck(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/gps/live-map"
              className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <AlertTriangle className="h-6 w-6 text-rose-500" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              GPS Telematics Alerts & Safety Events Center
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 ml-7">
            Real-time feed of fleet speed violations, battery disconnects, geofence breaches, and device tampering.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium uppercase">
            <span>Total Alerts</span>
            <AlertTriangle className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {metrics.total}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Recorded telematics triggers</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium uppercase">
            <span>Critical Security Alerts</span>
            <ZapOff className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600">
            {metrics.criticalCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Power cuts & high overspeeds</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium uppercase">
            <span>Warning Events</span>
            <Gauge className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600">
            {metrics.warningCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Speed & boundary excursions</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium uppercase">
            <span>Pending Review</span>
            <Clock className="h-4 w-4 text-sky-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-sky-600">
            {metrics.unackCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Unacknowledged by operator</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search alert title, message, vehicle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[170px]">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical Only</SelectItem>
              <SelectItem value="warning">Warning Only</SelectItem>
              <SelectItem value="info">Info Only</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="unack">Pending Review (Unack)</SelectItem>
              <SelectItem value="ack">Acknowledged</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs font-medium text-muted-foreground">
          Showing {filtered.length} of {alerts.length} alerts
        </div>
      </div>

      {/* Alerts Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert className="h-6 w-6 text-muted-foreground" />}
          title="No alerts matching criteria"
          description="Your fleet has no unhandled overspeed, geofence, or hardware security alerts in this view."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/30 text-muted-foreground uppercase">
                <tr>
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold">Severity</th>
                  <th className="py-3 px-4 font-semibold">Vehicle</th>
                  <th className="py-3 px-4 font-semibold">Alert Type</th>
                  <th className="py-3 px-4 font-semibold">Details / Diagnostic</th>
                  <th className="py-3 px-4 font-semibold">Location</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((a) => {
                  const isCrit = a.severity === "critical";
                  const isWarn = a.severity === "warning";

                  return (
                    <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-muted-foreground font-mono">
                        {formatDate(a.event_time)} {new Date(a.event_time).toLocaleTimeString()}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isCrit
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                              : isWarn
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              : "bg-sky-500/10 text-sky-600 border-sky-500/20"
                          }`}
                        >
                          {a.severity.toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {a.vehicle ? (
                          <div className="font-semibold text-foreground">
                            {a.vehicle.name}
                            {a.vehicle.plate_number && (
                              <span className="text-muted-foreground ml-1.5 font-normal">
                                ({a.vehicle.plate_number})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Fleet Vehicle</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-medium text-foreground">
                        {a.title}
                      </td>

                      <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">
                        {a.message}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                        {a.latitude != null && a.longitude != null ? (
                          <a
                            href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <MapPin className="h-3 w-3" />
                            {a.latitude.toFixed(4)}, {a.longitude.toFixed(4)}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {a.is_acknowledged ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Acknowledged
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                            <Clock className="h-3 w-3" /> Pending Review
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {!a.is_acknowledged ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2.5 font-medium"
                            onClick={() => handleOpenAck(a)}
                          >
                            Acknowledge
                          </Button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">Cleared</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Acknowledge Dialog */}
      <Dialog open={ackModalOpen} onOpenChange={setAckModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Acknowledge Telematics Alert
            </DialogTitle>
            <DialogDescription>
              Record operator resolution or driver follow-up notes for {selectedAlert?.title}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmAck} className="space-y-3 py-2 text-xs">
            <div className="p-3 rounded-lg bg-muted/40 border border-border">
              <div className="font-semibold text-foreground">{selectedAlert?.title}</div>
              <p className="text-muted-foreground mt-0.5">{selectedAlert?.message}</p>
            </div>

            <div>
              <label className="text-xs font-medium">Operator Resolution Notes</label>
              <Textarea
                placeholder="e.g. Contacted driver via radio; slowed down to 60 km/h. Maintenance team verified battery cable connection."
                value={ackNotes}
                onChange={(e) => setAckNotes(e.target.value)}
                rows={3}
                className="mt-1 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setAckModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingAck}>
                {submittingAck ? "Saving..." : "Confirm & Clear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
