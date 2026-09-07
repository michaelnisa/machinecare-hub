import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Boxes,
  Search,
  Plus,
  Radio,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  Database,
  Sliders,
  Cpu,
  RefreshCw,
  Building2,
} from "lucide-react";
import {
  MOCK_CONNECTED_ASSETS,
  MOCK_MACHINE_DICTIONARY,
  MOCK_CONNECTED_CUSTOMERS,
  MOCK_CONNECTED_SITES,
  MOCK_CONNECTED_DEVICES,
} from "@/lib/connected-data-mock";
import { ConnectedAsset } from "@/types/connected-data";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function ConnectedAssetsPage() {
  const { toast } = useToast();
  const [assets, setAssets] = useState<ConnectedAsset[]>(MOCK_CONNECTED_ASSETS);
  const [search, setSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<ConnectedAsset | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("Heavy Hydraulic Excavator");
  const [manufacturer, setManufacturer] = useState("Caterpillar");
  const [model, setModel] = useState("CAT 6040");
  const [serialNumber, setSerialNumber] = useState("");
  const [customerId, setCustomerId] = useState(MOCK_CONNECTED_CUSTOMERS[0]?.id || "");
  const [siteId, setSiteId] = useState(MOCK_CONNECTED_SITES[0]?.id || "");
  const [deviceId, setDeviceId] = useState(MOCK_CONNECTED_DEVICES[0]?.id || "");
  const [protocol, setProtocol] = useState("CAN / J1939");

  const filtered = assets.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.asset_code.toLowerCase().includes(search.toLowerCase()) ||
      a.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      a.manufacturer.toLowerCase().includes(search.toLowerCase()),
  );

  const handleRegisterAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Asset Name is required", variant: "destructive" });
      return;
    }

    const selectedCust = MOCK_CONNECTED_CUSTOMERS.find((c) => c.id === customerId) || MOCK_CONNECTED_CUSTOMERS[0];
    const selectedSite = MOCK_CONNECTED_SITES.find((s) => s.id === siteId) || MOCK_CONNECTED_SITES[0];
    const selectedDev = MOCK_CONNECTED_DEVICES.find((d) => d.id === deviceId) || MOCK_CONNECTED_DEVICES[0];

    const newAsset: ConnectedAsset = {
      id: `asset-${Date.now()}`,
      customer_id: selectedCust.id,
      customer_name: selectedCust.name,
      site_id: selectedSite.id,
      site_name: selectedSite.name,
      asset_code: code.trim() || `EQ-${name.slice(0, 3).toUpperCase()}-0${assets.length + 1}`,
      name: name.trim(),
      type,
      manufacturer,
      model: model || "Standard Unit",
      serial_number: serialNumber || `SN-${Date.now()}`,
      manufacture_year: 2024,
      device_id: selectedDev.id,
      device_name: selectedDev.name,
      protocol,
      status: "ONLINE",
      health_score: 98,
      last_communication: "Just now",
      parameters_count: 6,
      created_at: new Date().toISOString(),
    };

    setAssets([newAsset, ...assets]);
    setIsAddOpen(false);
    setName("");
    setCode("");
    setModel("");
    setSerialNumber("");

    toast({
      title: "Asset Registered Successfully",
      description: `${newAsset.name} linked to gateway ${selectedDev.name}.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Connected Asset Registry
          </h1>
          <p className="text-sm text-muted-foreground">
            Physical machinery & equipment bound to real-time IoT gateways and telemetry streams
          </p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 text-white font-semibold"
          onClick={() => setIsAddOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" /> Register Connected Asset
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search asset by name, code, customer, manufacturer..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Assets Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((asset) => (
          <Card
            key={asset.id}
            className="border-border cursor-pointer hover:border-primary/50 transition-all shadow-sm"
            onClick={() => setSelectedAsset(asset)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-primary" />
                    {asset.name}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {asset.asset_code} • {asset.customer_name}
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className={
                    asset.status === "ONLINE"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]"
                      : "bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]"
                  }
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                  {asset.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground">
                <div><span className="font-semibold text-foreground">Type:</span> {asset.type}</div>
                <div><span className="font-semibold text-foreground">Site:</span> {asset.site_name}</div>
                <div><span className="font-semibold text-foreground">Device:</span> {asset.device_name} ({asset.protocol})</div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2 text-center text-xs">
                <div>
                  <div className="text-[10px] text-muted-foreground">Health Score</div>
                  <div className="font-bold text-sm text-emerald-600">{asset.health_score}%</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Live Parameters</div>
                  <div className="font-bold text-sm text-primary">{asset.parameters_count} Keys</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-primary" /> {asset.last_communication}
                </span>
                <span className="text-primary font-semibold flex items-center gap-0.5">
                  View Streams <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedAsset} onOpenChange={(open) => !open && setSelectedAsset(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" />
              {selectedAsset?.name} ({selectedAsset?.asset_code})
            </DialogTitle>
            <DialogDescription>
              {selectedAsset?.customer_name} • {selectedAsset?.site_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-muted-foreground">Manufacturer:</span> <strong className="text-foreground">{selectedAsset?.manufacturer}</strong></div>
              <div><span className="text-muted-foreground">Model:</span> <strong className="text-foreground">{selectedAsset?.model}</strong></div>
              <div><span className="text-muted-foreground">Serial No:</span> <strong className="text-foreground">{selectedAsset?.serial_number}</strong></div>
              <div><span className="text-muted-foreground">Gateway Device:</span> <strong className="text-primary">{selectedAsset?.device_name}</strong></div>
              <div><span className="text-muted-foreground">Protocol:</span> <strong className="text-foreground">{selectedAsset?.protocol}</strong></div>
              <div><span className="text-muted-foreground">Health Rating:</span> <strong className="text-emerald-600">{selectedAsset?.health_score}% Optimal</strong></div>
            </div>

            <div className="border-t pt-3">
              <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-primary" /> Bound Parameter Streams (Machine Data Dictionary)
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {MOCK_MACHINE_DICTIONARY.slice(0, 6).map((param) => (
                  <div key={param.id} className="rounded border bg-muted/30 p-2 flex justify-between items-center">
                    <span className="truncate">{param.label}</span>
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary">{param.unit}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Asset Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Register Connected Asset
            </DialogTitle>
            <DialogDescription>
              Register a physical machine, assign an IoT gateway device, and bind data feeds.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRegisterAsset} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="asset-name">Asset Name *</Label>
                <Input
                  id="asset-name"
                  placeholder="e.g. CAT 6040 Mining Shovel"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="asset-code">Asset Tag / Code</Label>
                <Input
                  id="asset-code"
                  placeholder="e.g. EXC-01"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="asset-cust">Customer</Label>
                <select
                  id="asset-cust"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  {MOCK_CONNECTED_CUSTOMERS.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="asset-site">Site Location</Label>
                <select
                  id="asset-site"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                >
                  {MOCK_CONNECTED_SITES.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="asset-mfg">Manufacturer</Label>
                <Input
                  id="asset-mfg"
                  placeholder="e.g. Caterpillar"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="asset-model">Model</Label>
                <Input
                  id="asset-model"
                  placeholder="e.g. 6040 FS"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="asset-sn">Serial Number</Label>
                <Input
                  id="asset-sn"
                  placeholder="e.g. CAT006040A"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="asset-dev">Assigned Gateway / Device</Label>
                <select
                  id="asset-dev"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                >
                  {MOCK_CONNECTED_DEVICES.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.type})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="asset-proto">Telemetry Protocol</Label>
                <select
                  id="asset-proto"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={protocol}
                  onChange={(e) => setProtocol(e.target.value)}
                >
                  <option value="CAN / J1939">CAN / J1939</option>
                  <option value="Modbus TCP">Modbus TCP</option>
                  <option value="Modbus RTU">Modbus RTU</option>
                  <option value="OPC-UA">OPC-UA</option>
                  <option value="MQTT">MQTT</option>
                  <option value="REST API">REST API</option>
                </select>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-white font-semibold">
                Register Asset
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
