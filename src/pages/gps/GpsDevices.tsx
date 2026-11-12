import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getGpsDevices,
  registerGpsDevice,
  assignDeviceToVehicle,
  unassignDevice,
  replaceDeviceOnVehicle,
  getDeviceAssignmentHistory,
  validateImei,
  computeDeviceHealthSummary,
  GpsDevice,
  DeviceAssignmentHistoryItem,
} from "@/services/gpsService";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import {
  Cpu,
  Plus,
  Truck,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
  ArrowLeft,
  Smartphone,
  Layers,
  Wrench,
  Activity,
  Zap,
  ZapOff,
  Battery,
  BatteryWarning,
  RefreshCw,
  History,
  ShieldAlert,
  MapPin,
  Check,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

export default function GpsDevices() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<GpsDevice[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; name: string; plate_number: string | null }[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("inventory");

  // Register Modal
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [submittingReg, setSubmittingReg] = useState(false);
  const [regImei, setRegImei] = useState("");
  const [regName, setRegName] = useState("");
  const [regManufacturer, setRegManufacturer] = useState("Teltonika");
  const [regModel, setRegModel] = useState("FMC920 4G");
  const [regSimPhone, setRegSimPhone] = useState("");
  const [regCarrier, setRegCarrier] = useState("Vodacom TZ");
  const [regSerial, setRegSerial] = useState("");

  // Assign Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [submittingAssign, setSubmittingAssign] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<GpsDevice | null>(null);
  const [assignVehicleId, setAssignVehicleId] = useState("");
  const [techName, setTechName] = useState("");
  const [installLocation, setInstallLocation] = useState("Under Dashboard / OBD");
  const [installNotes, setInstallNotes] = useState("");

  // Replace Tracker Modal
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [submittingReplace, setSubmittingReplace] = useState(false);
  const [replaceTargetDevice, setReplaceTargetDevice] = useState<GpsDevice | null>(null);
  const [newDeviceId, setNewDeviceId] = useState("");
  const [replaceTechName, setReplaceTechName] = useState("");
  const [replaceReason, setReplaceReason] = useState("Hardware defect / failure");
  const [replaceNotes, setReplaceNotes] = useState("");

  // History Audit Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDevice, setHistoryDevice] = useState<GpsDevice | null>(null);
  const [historyList, setHistoryList] = useState<DeviceAssignmentHistoryItem[]>([]);

  const loadData = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const [devs, { data: vList }] = await Promise.all([
        getGpsDevices(organisation.id),
        (supabase as any)
          .from("machines")
          .select("id, name, plate_number")
          .eq("organisation_id", organisation.id)
          .in("category", ["Vehicle", "Trailer", "Fleet", "Truck", "heavy_equipment"])
          .order("name"),
      ]);

      setDevices(devs);
      setVehicles(vList || []);
    } catch (err) {
      toast.error("Failed to load GPS devices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  const metrics = useMemo(() => {
    return computeDeviceHealthSummary(devices);
  }, [devices]);

  // Luhn IMEI validation state for registration
  const imeiValidation = useMemo(() => {
    if (!regImei.trim()) return null;
    return validateImei(regImei.trim());
  }, [regImei]);

  // Unassigned devices ready for replacement or assignment
  const unassignedDevices = useMemo(() => {
    return devices.filter((d) => !d.active_assignment && d.status !== "decommissioned");
  }, [devices]);

  const filtered = useMemo(() => {
    return devices.filter((d) => {
      if (statusFilter === "assigned" && !d.active_assignment) return false;
      if (statusFilter === "unassigned" && d.active_assignment) return false;
      if (statusFilter === "offline" && d.status !== "offline") return false;
      if (statusFilter === "tamper" && d.telematics_health?.external_power !== false) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchImei = d.imei.toLowerCase().includes(q);
        const matchName = d.name.toLowerCase().includes(q);
        const matchVehicle =
          d.active_assignment?.vehicle_name?.toLowerCase().includes(q) ||
          d.active_assignment?.vehicle_plate?.toLowerCase().includes(q);
        if (!matchImei && !matchName && !matchVehicle) return false;
      }
      return true;
    });
  }, [devices, statusFilter, search]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id) return;

    const validation = validateImei(regImei.trim());
    if (!validation.valid) {
      toast.error(validation.reason || "Invalid IMEI format");
      return;
    }

    setSubmittingReg(true);
    try {
      const res = await registerGpsDevice(organisation.id, {
        imei: regImei.trim(),
        name: regName.trim() || `${regManufacturer} (${regImei.slice(-4)})`,
        manufacturer: regManufacturer,
        model: regModel,
        sim_phone_number: regSimPhone.trim() || undefined,
        sim_carrier: regCarrier,
        serial_number: regSerial.trim() || undefined,
      });

      if (!res.success) throw new Error(res.error || "Failed to register device");

      toast.success("GPS Hardware tracker registered successfully!");
      setRegisterModalOpen(false);
      setRegImei("");
      setRegName("");
      setRegSerial("");
      setRegSimPhone("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to register GPS device");
    } finally {
      setSubmittingReg(false);
    }
  };

  const handleOpenAssign = (dev: GpsDevice) => {
    setSelectedDevice(dev);
    setAssignVehicleId(dev.active_assignment?.vehicle_id || "");
    setTechName(dev.active_assignment?.technician_name || "");
    setInstallLocation(dev.active_assignment?.installation_location || "Under Dashboard / OBD");
    setInstallNotes("");
    setAssignModalOpen(true);
  };

  const handleConfirmAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id || !selectedDevice) return;
    if (!assignVehicleId) {
      toast.error("Please select a target vehicle.");
      return;
    }
    if (!techName.trim()) {
      toast.error("Please specify the installation technician.");
      return;
    }

    setSubmittingAssign(true);
    try {
      const res = await assignDeviceToVehicle(
        organisation.id,
        selectedDevice.id,
        assignVehicleId,
        techName.trim(),
        `${installLocation ? `Location: ${installLocation}. ` : ""}${installNotes.trim()}`
      );

      if (!res.success) throw new Error(res.error || "Assignment failed");

      toast.success("GPS Tracker assigned to vehicle successfully!");
      setAssignModalOpen(false);
      setSelectedDevice(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign device");
    } finally {
      setSubmittingAssign(false);
    }
  };

  const handleUnassign = async (dev: GpsDevice) => {
    if (!dev.active_assignment) return;
    if (!confirm(`Unassign tracker ${dev.imei} from vehicle ${dev.active_assignment.vehicle_name || "vehicle"}?`)) {
      return;
    }

    try {
      const res = await unassignDevice(dev.active_assignment.id, dev.id);
      if (!res.success) throw new Error(res.error || "Unassignment failed");
      toast.success("Tracker unassigned and moved to available stock.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to unassign device");
    }
  };

  // Open Replace Modal
  const handleOpenReplace = (dev: GpsDevice) => {
    setReplaceTargetDevice(dev);
    setNewDeviceId("");
    setReplaceTechName(dev.active_assignment?.technician_name || "");
    setReplaceReason("Hardware defect / failure");
    setReplaceNotes("");
    setReplaceModalOpen(true);
  };

  const handleConfirmReplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id || !replaceTargetDevice || !replaceTargetDevice.active_assignment) return;
    if (!newDeviceId) {
      toast.error("Please pick a replacement tracker from available inventory.");
      return;
    }
    if (!replaceTechName.trim()) {
      toast.error("Please specify the replacing technician name.");
      return;
    }

    setSubmittingReplace(true);
    try {
      const res = await replaceDeviceOnVehicle(
        organisation.id,
        replaceTargetDevice.id,
        newDeviceId,
        replaceTargetDevice.active_assignment.vehicle_id,
        replaceTechName.trim(),
        replaceReason,
        replaceNotes.trim()
      );

      if (!res.success) throw new Error(res.error || "Replacement failed");

      toast.success("Vehicle tracker replaced cleanly. Previous assignment archived.");
      setReplaceModalOpen(false);
      setReplaceTargetDevice(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to replace device");
    } finally {
      setSubmittingReplace(false);
    }
  };

  // Open History Audit Modal
  const handleOpenHistory = async (dev: GpsDevice) => {
    setHistoryDevice(dev);
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const items = await getDeviceAssignmentHistory(dev.id);
      setHistoryList(items);
    } catch (err) {
      toast.error("Failed to load history audit log");
    } finally {
      setHistoryLoading(false);
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
            <Cpu className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              GPS Hardware & Telematics Health
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 ml-7">
            Manage device IMEIs, Luhn checksum validation, technician audit logs, replacement workflows, and real-time hardware diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button onClick={() => setRegisterModalOpen(true)} className="gap-1.5 text-xs">
            <Plus className="h-4 w-4" />
            Register GPS Tracker
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium uppercase">
            <span>Total Trackers</span>
            <Cpu className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">{metrics.total}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Hardware inventory</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium uppercase">
            <span>Active on Fleet</span>
            <Truck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-emerald-600">{metrics.active}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Mounted & streaming</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium uppercase">
            <span>In Stock</span>
            <Layers className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-amber-600">{metrics.unassigned}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Ready for deployment</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium uppercase">
            <span>Offline (&gt;24h)</span>
            <AlertCircle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-rose-600">{metrics.offlineOver24h}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Cellular / power lost</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium uppercase">
            <span>Power Cut / Tamper</span>
            <ZapOff className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-rose-600">{metrics.powerCutTamper}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">12V/24V line disconnected</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium uppercase">
            <span>Low Backup Batt</span>
            <BatteryWarning className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-amber-600">{metrics.lowBackupBattery}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">&lt; 3.65V internal cell</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="bg-muted">
            <TabsTrigger value="inventory" className="gap-1.5 text-xs">
              <Cpu className="h-3.5 w-3.5" />
              Hardware Inventory & Assignments
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-1.5 text-xs">
              <Activity className="h-3.5 w-3.5" />
              Health & Telematics Diagnostics
            </TabsTrigger>
          </TabsList>

          {/* Filter Bar */}
          <div className="flex flex-1 flex-wrap items-center justify-end gap-3 min-w-[280px]">
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search IMEI, model, vehicle plate..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[170px] h-8 text-xs">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Status Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trackers ({devices.length})</SelectItem>
                <SelectItem value="assigned">Active on Fleet ({metrics.active})</SelectItem>
                <SelectItem value="unassigned">In Stock ({metrics.unassigned})</SelectItem>
                <SelectItem value="offline">Offline &gt;24h ({metrics.offlineOver24h})</SelectItem>
                <SelectItem value="tamper">Power Cut Alerts ({metrics.powerCutTamper})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tab 1: Inventory & Assignments */}
        <TabsContent value="inventory" className="space-y-4">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Cpu className="h-6 w-6 text-muted-foreground" />}
              title="No GPS devices found"
              description="Register your Teltonika, Concox, Jimi IoT, or Queclink trackers to link them with fleet vehicles."
              action={
                <Button size="sm" onClick={() => setRegisterModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Register First Tracker
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/40 text-muted-foreground uppercase text-[11px]">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Device IMEI</th>
                      <th className="py-3 px-4 font-semibold">Model & Protocol</th>
                      <th className="py-3 px-4 font-semibold">Assigned Vehicle</th>
                      <th className="py-3 px-4 font-semibold">SIM Card / Carrier</th>
                      <th className="py-3 px-4 font-semibold">Last Ping</th>
                      <th className="py-3 px-4 font-semibold text-center">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((d) => {
                      const hasAssigned = !!d.active_assignment;

                      return (
                        <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-mono font-bold text-foreground text-sm flex items-center gap-1.5">
                              {d.imei}
                            </div>
                            <div className="text-[11px] text-muted-foreground">{d.name}</div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-semibold text-foreground">
                              {d.manufacturer} {d.model}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono uppercase">
                              Protocol: {d.protocol}
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            {d.active_assignment ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted border border-border">
                                <Truck className="h-3.5 w-3.5 text-primary" />
                                <span className="font-semibold text-foreground">
                                  {d.active_assignment.vehicle_name}
                                </span>
                                {d.active_assignment.vehicle_plate && (
                                  <span className="text-muted-foreground font-mono">
                                    ({d.active_assignment.vehicle_plate})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">Unassigned (In Stock)</span>
                            )}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            {d.sim_phone_number ? (
                              <div className="flex items-center gap-1 font-mono text-foreground">
                                <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                                {d.sim_phone_number}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                            <div className="text-[11px] text-muted-foreground">
                              {d.sim_carrier || "Vodacom TZ"}
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                            {d.last_communication_at ? (
                              <>
                                {formatDate(d.last_communication_at)}{" "}
                                {new Date(d.last_communication_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </>
                            ) : (
                              <span className="italic">Never connected</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {d.status === "offline" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                                <AlertCircle className="h-3 w-3" /> OFFLINE &gt;24H
                              </span>
                            ) : hasAssigned ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                <CheckCircle2 className="h-3 w-3" /> ACTIVE
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                <Clock className="h-3 w-3" /> IN STOCK
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                title="View Installation & Assignment History"
                                className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                                onClick={() => handleOpenHistory(d)}
                              >
                                <History className="h-3.5 w-3.5" />
                              </Button>

                              {!hasAssigned ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2.5 font-medium"
                                  onClick={() => handleOpenAssign(d)}
                                >
                                  Assign Vehicle
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                                    title="Swap with replacement tracker"
                                    onClick={() => handleOpenReplace(d)}
                                  >
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Replace
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                                    onClick={() => handleUnassign(d)}
                                  >
                                    Unassign
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Health & Telematics Diagnostics */}
        <TabsContent value="health" className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 text-muted-foreground uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Device & Vehicle</th>
                    <th className="py-3 px-4 font-semibold">External 12V/24V Power</th>
                    <th className="py-3 px-4 font-semibold">Internal Backup Battery</th>
                    <th className="py-3 px-4 font-semibold">GPS Satellite Quality</th>
                    <th className="py-3 px-4 font-semibold">Last Ping Age</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((d) => {
                    const health = d.telematics_health;
                    const hasAssigned = !!d.active_assignment;
                    const isTampered = health?.external_power === false;
                    const isLowBatt = health?.battery_voltage != null && health.battery_voltage < 3.65;
                    const isOffline = d.status === "offline" || (health?.hours_since_ping != null && health.hours_since_ping >= 24);

                    return (
                      <tr key={`health-${d.id}`} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono font-bold text-foreground text-sm">{d.imei}</div>
                          {hasAssigned ? (
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Truck className="h-3 w-3 text-primary" />
                              {d.active_assignment?.vehicle_name} ({d.active_assignment?.vehicle_plate || "No Plate"})
                            </div>
                          ) : (
                            <span className="text-[11px] text-amber-600 font-medium">Unassigned (In Stock)</span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {isTampered ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/30">
                              <ZapOff className="h-3.5 w-3.5" />
                              POWER CUT / TAMPER
                            </span>
                          ) : health?.external_power !== undefined ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              <Zap className="h-3.5 w-3.5" />
                              12V/24V Main Connected
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {health?.battery_voltage != null ? (
                            <div className="flex items-center gap-1.5">
                              {isLowBatt ? (
                                <BatteryWarning className="h-4 w-4 text-amber-500" />
                              ) : (
                                <Battery className="h-4 w-4 text-emerald-500" />
                              )}
                              <span className={`font-mono font-semibold ${isLowBatt ? "text-amber-600" : "text-foreground"}`}>
                                {health.battery_voltage.toFixed(2)} V
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {health.battery_voltage >= 3.9 ? "(Full)" : health.battery_voltage >= 3.65 ? "(Normal)" : "(Low cell)"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">No battery reading</span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {health?.satellite_count !== undefined ? (
                            <div className="flex items-center gap-1.5 font-mono">
                              <Radio className={`h-3.5 w-3.5 ${health.satellite_count >= 8 ? "text-emerald-500" : health.satellite_count >= 4 ? "text-amber-500" : "text-rose-500"}`} />
                              <span className="font-semibold text-foreground">
                                {health.satellite_count} Sats
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {health.satellite_count >= 8 ? "(3D Fix)" : health.satellite_count >= 4 ? "(2D Fix)" : "(No Lock)"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px]">
                          {isOffline ? (
                            <span className="text-rose-600 font-semibold">
                              &gt; 24h Offline ({health?.hours_since_ping ? `${health.hours_since_ping}h ago` : "No ping"})
                            </span>
                          ) : health?.hours_since_ping !== undefined ? (
                            <span className="text-emerald-600 font-medium">
                              {health.hours_since_ping < 0.1
                                ? "Active (Just now)"
                                : `${health.hours_since_ping < 1 ? Math.round(health.hours_since_ping * 60) + "m ago" : health.hours_since_ping + "h ago"}`}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Never connected</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {hasAssigned && (
                              <Link
                                to="/gps/live-map"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-[11px] font-medium hover:bg-muted text-muted-foreground hover:text-foreground"
                              >
                                <MapPin className="h-3 w-3 text-primary" />
                                Track
                              </Link>
                            )}
                            {hasAssigned && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2"
                                onClick={() => handleOpenReplace(d)}
                              >
                                Replace
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Register Device Modal with Luhn Checksum Feedback */}
      <Dialog open={registerModalOpen} onOpenChange={setRegisterModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              Register GPS Hardware Tracker
            </DialogTitle>
            <DialogDescription>
              Add a new GPS telematics tracker to your hardware inventory.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRegister} className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Device IMEI (15 Digits) *</Label>
              <div className="relative mt-1">
                <Input
                  required
                  maxLength={18}
                  placeholder="e.g. 867823050123456"
                  value={regImei}
                  onChange={(e) => setRegImei(e.target.value)}
                  className={`font-mono text-xs pr-8 ${
                    imeiValidation
                      ? imeiValidation.valid
                        ? "border-emerald-500 focus-visible:ring-emerald-500"
                        : "border-rose-500 focus-visible:ring-rose-500"
                      : ""
                  }`}
                />
                {imeiValidation && (
                  <div className="absolute right-2.5 top-2.5">
                    {imeiValidation.valid ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-500" />
                    )}
                  </div>
                )}
              </div>
              {/* Luhn algorithm feedback helper */}
              {imeiValidation && (
                <p
                  className={`text-[11px] mt-1 ${
                    imeiValidation.valid ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {imeiValidation.valid
                    ? "Valid 15-digit IMEI with verified Luhn checksum."
                    : imeiValidation.reason}
                </p>
              )}
              {!imeiValidation && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Standard 15-digit hardware IMEI with Luhn checksum verification.
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs">Device Label / Identifier</Label>
              <Input
                placeholder="e.g. Scania G460 Tracker #1"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Manufacturer</Label>
                <Select value={regManufacturer} onValueChange={(val) => {
                  setRegManufacturer(val);
                  if (val === "Teltonika") setRegModel("FMC920 4G");
                  else if (val === "Concox") setRegModel("GT06 / VG02U");
                  else if (val === "Jimi IoT") setRegModel("JM-VL03 4G");
                  else if (val === "Queclink") setRegModel("GV300");
                  else if (val === "Coban") setRegModel("GPS303G");
                  else if (val === "Suntech") setRegModel("ST4305");
                }}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Teltonika">Teltonika (Lithuania)</SelectItem>
                    <SelectItem value="Concox">Concox</SelectItem>
                    <SelectItem value="Jimi IoT">Jimi IoT</SelectItem>
                    <SelectItem value="Queclink">Queclink</SelectItem>
                    <SelectItem value="Coban">Coban</SelectItem>
                    <SelectItem value="Suntech">Suntech</SelectItem>
                    <SelectItem value="Meitrack">Meitrack</SelectItem>
                    <SelectItem value="Astra Telematics">Astra Telematics</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Hardware Model</Label>
                <Input
                  value={regModel}
                  onChange={(e) => setRegModel(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">SIM Phone Number</Label>
                <Input
                  placeholder="+255 7..."
                  value={regSimPhone}
                  onChange={(e) => setRegSimPhone(e.target.value)}
                  className="mt-1 font-mono text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">Cellular Carrier</Label>
                <Select value={regCarrier} onValueChange={setRegCarrier}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Vodacom TZ">Vodacom Tanzania</SelectItem>
                    <SelectItem value="Airtel TZ">Airtel Tanzania</SelectItem>
                    <SelectItem value="Tigo TZ">Tigo Tanzania</SelectItem>
                    <SelectItem value="Halotel TZ">Halotel Tanzania</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Hardware Serial Number (Optional)</Label>
              <Input
                placeholder="e.g. SN-920-884102"
                value={regSerial}
                onChange={(e) => setRegSerial(e.target.value)}
                className="mt-1 font-mono text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setRegisterModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingReg || (imeiValidation && !imeiValidation.valid)}>
                {submittingReg ? "Registering..." : "Register Device"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Device Modal */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Assign Tracker to Vehicle
            </DialogTitle>
            <DialogDescription>
              Link IMEI {selectedDevice?.imei} to a vehicle in your fleet.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmAssign} className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Target Vehicle *</Label>
              <Select value={assignVehicleId} onValueChange={setAssignVehicleId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose vehicle..." />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} ({v.plate_number || "No Plate"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Installation Technician *</Label>
              <Input
                required
                placeholder="e.g. Ally Mwinyi (Auto Electrician)"
                value={techName}
                onChange={(e) => setTechName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Physical Mounting Location</Label>
              <Select value={installLocation} onValueChange={setInstallLocation}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Under Dashboard / OBD">Under Dashboard / OBD Port</SelectItem>
                  <SelectItem value="Behind Instrument Cluster">Behind Instrument Cluster</SelectItem>
                  <SelectItem value="Central Fuse Box">Central Fuse Box Tapped</SelectItem>
                  <SelectItem value="Engine Compartment (IP67)">Engine Compartment (IP67 Rated)</SelectItem>
                  <SelectItem value="Roof Cowl / Hidden Liner">Roof Cowl / Windshield Liner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Installation Notes / Ignition Wiring</Label>
              <Input
                placeholder="e.g. ACC wire spliced to ignition relay pin 15, tamper seal #481"
                value={installNotes}
                onChange={(e) => setInstallNotes(e.target.value)}
                className="mt-1"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setAssignModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingAssign}>
                {submittingAssign ? "Saving..." : "Confirm Assignment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Replace Tracker Modal */}
      <Dialog open={replaceModalOpen} onOpenChange={setReplaceModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Swap / Replace Vehicle Tracker
            </DialogTitle>
            <DialogDescription>
              Replace existing tracker {replaceTargetDevice?.imei} on vehicle{" "}
              <strong>{replaceTargetDevice?.active_assignment?.vehicle_name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmReplace} className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Replacement Tracker (From In-Stock Inventory) *</Label>
              {unassignedDevices.length === 0 ? (
                <div className="mt-1 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-700 text-[11px]">
                  No unassigned trackers available in stock. Please register a new device first.
                </div>
              ) : (
                <Select value={newDeviceId} onValueChange={setNewDeviceId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select available tracker..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unassignedDevices.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.manufacturer} {d.model} - IMEI: {d.imei} ({d.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label className="text-xs">Replacement Reason *</Label>
              <Select value={replaceReason} onValueChange={setReplaceReason}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hardware defect / failure">Hardware defect / failure</SelectItem>
                  <SelectItem value="Upgrade to 4G FMC920">Upgrade to 4G FMC920</SelectItem>
                  <SelectItem value="Physical damage / wire cut">Physical damage / wire cut</SelectItem>
                  <SelectItem value="Routine maintenance swap">Routine maintenance swap</SelectItem>
                  <SelectItem value="SIM / modem failure">SIM / modem communication failure</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Technician Name *</Label>
              <Input
                required
                placeholder="e.g. Juma Hamisi"
                value={replaceTechName}
                onChange={(e) => setReplaceTechName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Replacement Notes</Label>
              <Input
                placeholder="e.g. Defective internal GPS antenna replaced with new FMC920 unit"
                value={replaceNotes}
                onChange={(e) => setReplaceNotes(e.target.value)}
                className="mt-1"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setReplaceModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingReplace || unassignedDevices.length === 0}
              >
                {submittingReplace ? "Processing Swap..." : "Confirm Replacement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* History Audit Modal */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Installation & Assignment Audit Log
            </DialogTitle>
            <DialogDescription>
              Complete vehicle assignment history for tracker IMEI:{" "}
              <span className="font-mono font-bold text-foreground">{historyDevice?.imei}</span> (
              {historyDevice?.name})
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs">
            {historyLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading audit records...</div>
            ) : historyList.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground italic">
                No past assignments recorded for this device.
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {historyList.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-border bg-muted/20 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Truck className="h-3.5 w-3.5 text-primary" />
                        {item.vehicle_name || "Vehicle"}
                        {item.vehicle_plate && (
                          <span className="font-mono text-muted-foreground">({item.vehicle_plate})</span>
                        )}
                      </div>
                      {item.status === "active" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          CURRENTLY ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">
                          ARCHIVED
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                      <div>
                        Installed:{" "}
                        <span className="font-mono text-foreground">
                          {formatDate(item.installed_at)}
                        </span>
                      </div>
                      <div>
                        Removed:{" "}
                        <span className="font-mono text-foreground">
                          {item.removed_at ? formatDate(item.removed_at) : "Active"}
                        </span>
                      </div>
                    </div>

                    {item.technician_name && (
                      <div className="text-[11px] text-muted-foreground">
                        Technician: <span className="text-foreground">{item.technician_name}</span>
                      </div>
                    )}

                    {item.installation_location && (
                      <div className="text-[11px] text-muted-foreground">
                        Location: <span className="text-foreground">{item.installation_location}</span>
                      </div>
                    )}

                    {item.installation_notes && (
                      <div className="text-[11px] text-muted-foreground italic bg-background/50 p-1.5 rounded border border-border">
                        Notes: {item.installation_notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
