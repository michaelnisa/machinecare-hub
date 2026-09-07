import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Radio,
  Search,
  Plus,
  Wifi,
  WifiOff,
  Battery,
  Signal,
  Cpu,
  Boxes,
  MapPin,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Code,
} from "lucide-react";
import { MOCK_CONNECTED_DEVICES, MOCK_CONNECTED_ASSETS } from "@/lib/connected-data-mock";
import { ConnectedDevice } from "@/types/connected-data";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function ConnectedDevicesPage() {
  const { toast } = useToast();
  const [devices, setDevices] = useState<ConnectedDevice[]>(MOCK_CONNECTED_DEVICES);
  const [search, setSearch] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<ConnectedDevice | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("CAN Bus & Telematics Gateway");
  const [manufacturer, setManufacturer] = useState("Teltonika");
  const [imei, setImei] = useState("");
  const [firmware, setFirmware] = useState("v2.4.12-rc4");
  const [assetId, setAssetId] = useState(MOCK_CONNECTED_ASSETS[0]?.id || "");

  const filtered = devices.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.device_id.toLowerCase().includes(search.toLowerCase()) ||
      d.imei.toLowerCase().includes(search.toLowerCase()) ||
      d.manufacturer.toLowerCase().includes(search.toLowerCase()),
  );

  const handleRegisterDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Device Name is required", variant: "destructive" });
      return;
    }

    const assignedAsset = MOCK_CONNECTED_ASSETS.find((a) => a.id === assetId);

    const newDevice: ConnectedDevice = {
      id: `dev-${Date.now()}`,
      device_id: code.trim() || `DEV-GW-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      type,
      manufacturer,
      imei: imei.trim() || `86492004${Math.floor(1000000 + Math.random() * 9000000)}`,
      firmware_version: firmware,
      assigned_asset_id: assignedAsset?.id,
      assigned_asset_name: assignedAsset?.name,
      status: "ONLINE",
      signal_strength: 92,
      battery_level: 100,
      ip_address: `192.168.10.${Math.floor(Math.random() * 150 + 10)}`,
      last_ping: "Just now",
      created_at: new Date().toISOString(),
    };

    setDevices([newDevice, ...devices]);
    setIsAddOpen(false);
    setName("");
    setCode("");
    setImei("");

    toast({
      title: "Device Registered Successfully",
      description: `${newDevice.name} is now ready to stream telemetry.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            IoT Gateways & Hardware Devices
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure & monitor edge gateways, CAN interfaces, Modbus RTU/TCP nodes, PLC bridges & sensors
          </p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 text-white font-semibold"
          onClick={() => setIsAddOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" /> Register New Device
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search device by name, ID, IMEI, manufacturer..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Devices Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((device) => (
          <Card
            key={device.id}
            className="border-border cursor-pointer hover:border-primary/50 transition-all shadow-sm"
            onClick={() => setSelectedDevice(device)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Radio className="h-4 w-4 text-primary" />
                    {device.name}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {device.device_id} • {device.manufacturer}
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className={
                    device.status === "ONLINE"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]"
                      : "bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]"
                  }
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                  {device.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground space-y-1">
                <div><span className="font-semibold text-foreground">Type:</span> {device.type}</div>
                <div><span className="font-semibold text-foreground">IMEI / ID:</span> <span className="font-mono">{device.imei}</span></div>
                <div><span className="font-semibold text-foreground">Assigned Asset:</span> {device.assigned_asset_name || "Unassigned"}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2 text-center text-xs">
                <div className="flex items-center justify-center gap-1">
                  <Signal className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-muted-foreground">Signal:</span>
                  <strong className="text-foreground">{device.signal_strength}%</strong>
                </div>
                <div className="flex items-center justify-center gap-1">
                  <Battery className="h-3.5 w-3.5 text-primary" />
                  <span className="text-muted-foreground">Power:</span>
                  <strong className="text-foreground">{device.battery_level}%</strong>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
                <span>FW: {device.firmware_version}</span>
                <span>Ping: {device.last_ping}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Device Detail Dialog */}
      <Dialog open={!!selectedDevice} onOpenChange={(open) => !open && setSelectedDevice(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              {selectedDevice?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedDevice?.device_id} • {selectedDevice?.manufacturer}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-muted-foreground">Hardware Type:</span> <div className="font-medium text-foreground">{selectedDevice?.type}</div></div>
              <div><span className="text-muted-foreground">IMEI:</span> <div className="font-mono text-foreground">{selectedDevice?.imei}</div></div>
              <div><span className="text-muted-foreground">IP Address:</span> <div className="font-mono text-foreground">{selectedDevice?.ip_address}</div></div>
              <div><span className="text-muted-foreground">Firmware:</span> <div className="font-medium text-foreground">{selectedDevice?.firmware_version}</div></div>
              <div><span className="text-muted-foreground">Assigned Asset:</span> <div className="font-medium text-primary">{selectedDevice?.assigned_asset_name || "Unassigned"}</div></div>
              <div><span className="text-muted-foreground">Last Heartbeat:</span> <div className="font-medium text-foreground">{selectedDevice?.last_ping}</div></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Device Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Register New Device / Gateway
            </DialogTitle>
            <DialogDescription>
              Pair an IoT gateway, CAN adapter, or cellular tracker to stream machine telemetry.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRegisterDevice} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dev-name">Device Name *</Label>
              <Input
                id="dev-name"
                placeholder="e.g. Teltonika FMC640 CAN Gateway 02"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dev-code">Device ID / Code</Label>
                <Input
                  id="dev-code"
                  placeholder="e.g. DEV-TEL-9002"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dev-mfg">Manufacturer</Label>
                <Input
                  id="dev-mfg"
                  placeholder="e.g. Teltonika"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dev-type">Device Type</Label>
              <select
                id="dev-type"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="CAN Bus & Telematics Gateway">CAN Bus & Telematics Gateway</option>
                <option value="Modbus RTU / TCP IoT Module">Modbus RTU / TCP IoT Module</option>
                <option value="PLC & Edge Computing Gateway">PLC & Edge Computing Gateway</option>
                <option value="Wireless Tri-Axial Vibration Sensor">Wireless Vibration Sensor</option>
                <option value="Solar Array Inverter Gateway">Solar Inverter Gateway</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dev-imei">IMEI / Serial Number</Label>
                <Input
                  id="dev-imei"
                  placeholder="e.g. 864920048192019"
                  value={imei}
                  onChange={(e) => setImei(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dev-fw">Firmware Version</Label>
                <Input
                  id="dev-fw"
                  placeholder="e.g. v2.4.12"
                  value={firmware}
                  onChange={(e) => setFirmware(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dev-asset">Assign to Physical Machine</Label>
              <select
                id="dev-asset"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
              >
                <option value="">Leave Unassigned</option>
                {MOCK_CONNECTED_ASSETS.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.asset_code})</option>
                ))}
              </select>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-white font-semibold">
                Register Device
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
