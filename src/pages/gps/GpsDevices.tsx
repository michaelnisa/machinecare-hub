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
import {
  getGpsDevices,
  registerGpsDevice,
  assignDeviceToVehicle,
  unassignDevice,
  GpsDevice,
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
} from "lucide-react";
import { toast } from "sonner";

export default function GpsDevices() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<GpsDevice[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; name: string; plate_number: string | null }[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
  const [installNotes, setInstallNotes] = useState("");

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
    let activeCount = 0;
    let unassignedCount = 0;
    let offlineCount = 0;

    devices.forEach((d) => {
      if (d.active_assignment) activeCount++;
      else unassignedCount++;
      if (d.status === "offline") offlineCount++;
    });

    return { total: devices.length, activeCount, unassignedCount, offlineCount };
  }, [devices]);

  const filtered = useMemo(() => {
    return devices.filter((d) => {
      if (statusFilter === "assigned" && !d.active_assignment) return false;
      if (statusFilter === "unassigned" && d.active_assignment) return false;
      if (statusFilter === "offline" && d.status !== "offline") return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchImei = d.imei.toLowerCase().includes(q);
        const matchName = d.name.toLowerCase().includes(q);
        const matchVehicle = d.active_assignment?.vehicle_name?.toLowerCase().includes(q) || d.active_assignment?.vehicle_plate?.toLowerCase().includes(q);
        if (!matchImei && !matchName && !matchVehicle) return false;
      }
      return true;
    });
  }, [devices, statusFilter, search]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id) return;
    if (!regImei.trim() || regImei.trim().length < 10) {
      toast.error("Please enter a valid IMEI number (typically 15 digits).");
      return;
    }

    setSubmittingReg(true);
    try {
      const res = await registerGpsDevice(organisation.id, {
        imei: regImei.trim(),
        name: regName.trim() || `GPS Tracker (${regImei.slice(-4)})`,
        manufacturer: regManufacturer,
        model: regModel,
        sim_phone_number: regSimPhone.trim() || undefined,
        sim_carrier: regCarrier,
        serial_number: regSerial.trim() || undefined,
      });

      if (!res.success) throw new Error(res.error || "Failed to register device");

      toast.success("GPS Device registered in hardware inventory!");
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
        installNotes.trim()
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
              GPS Hardware Devices & Technician Assignments
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 ml-7">
            Manage device IMEIs, SIM cards, installation technician signoffs, and vehicle telematics hardware mappings.
          </p>
        </div>

        <Button onClick={() => setRegisterModalOpen(true)} className="gap-1.5 text-xs">
          <Plus className="h-4 w-4" />
          Register GPS Tracker
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium uppercase">
            <span>Total Trackers</span>
            <Cpu className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {metrics.total}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Hardware inventory registered</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium uppercase">
            <span>Active on Vehicles</span>
            <Truck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
            {metrics.activeCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Installed & tracking telemetry</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium uppercase">
            <span>Unassigned In Stock</span>
            <Layers className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600">
            {metrics.unassignedCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Available for deployment</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium uppercase">
            <span>Offline Devices</span>
            <AlertCircle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600">
            {metrics.offlineCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">No ping in last 24 hours</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search IMEI, tracker label, vehicle plate..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Status Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trackers</SelectItem>
              <SelectItem value="assigned">Active on Vehicle</SelectItem>
              <SelectItem value="unassigned">Unassigned (In Stock)</SelectItem>
              <SelectItem value="offline">Offline / Disconnected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs font-medium text-muted-foreground">
          Showing {filtered.length} of {devices.length} devices
        </div>
      </div>

      {/* Devices Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Cpu className="h-6 w-6 text-muted-foreground" />}
          title="No GPS devices found"
          description="Register your Teltonika, Concox, or Jimi IoT trackers to start monitoring vehicles in real time."
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
              <thead className="border-b border-border bg-muted/30 text-muted-foreground uppercase">
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
                        <div className="font-mono font-bold text-foreground text-sm">{d.imei}</div>
                        <div className="text-muted-foreground">{d.name}</div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-foreground">{d.manufacturer} {d.model}</div>
                        <div className="text-[11px] text-muted-foreground font-mono uppercase">
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
                        <div className="text-[11px] text-muted-foreground">{d.sim_carrier || "Vodacom TZ"}</div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-muted-foreground font-mono">
                        {d.last_communication_at ? (
                          <>
                            {formatDate(d.last_communication_at)} {new Date(d.last_communication_at).toLocaleTimeString()}
                          </>
                        ) : (
                          <span className="italic">Never connected</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {hasAssigned ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" /> ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            <Clock className="h-3 w-3" /> UNASSIGNED
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
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
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                              onClick={() => handleUnassign(d)}
                            >
                              Unassign
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
      )}

      {/* Register Device Modal */}
      <Dialog open={registerModalOpen} onOpenChange={setRegisterModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              Register GPS Hardware Tracker
            </DialogTitle>
            <DialogDescription>
              Add a new GPS telematics device to your organization hardware inventory.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRegister} className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Device IMEI (15 Digits) *</Label>
              <Input
                required
                maxLength={18}
                placeholder="e.g. 867823050123456"
                value={regImei}
                onChange={(e) => setRegImei(e.target.value)}
                className="mt-1 font-mono text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Device Label / Name</Label>
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
                <Select value={regManufacturer} onValueChange={setRegManufacturer}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Teltonika">Teltonika</SelectItem>
                    <SelectItem value="Concox">Concox</SelectItem>
                    <SelectItem value="Jimi IoT">Jimi IoT</SelectItem>
                    <SelectItem value="Coban">Coban</SelectItem>
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

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setRegisterModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingReg}>
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
              <Label className="text-xs">Installation Notes / Location</Label>
              <Input
                placeholder="e.g. Mounted behind dashboard instrument cluster, OBD wire tapped"
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
    </div>
  );
}
