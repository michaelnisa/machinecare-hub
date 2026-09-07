import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Code2, Key, Copy, Plus, Play, Shield, Check, Lock, Terminal } from "lucide-react";
import { MOCK_API_KEYS } from "@/lib/connected-data-mock";
import { ConnectedApiKey, ApiScope } from "@/types/connected-data";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const ALL_SCOPES: { scope: ApiScope; label: string; desc: string }[] = [
  { scope: "telemetry:read", label: "Read Telemetry Streams", desc: "Access live & historical telemetry data points" },
  { scope: "assets:read", label: "Read Assets", desc: "Access connected asset registry & specs" },
  { scope: "devices:read", label: "Read Devices", desc: "Access gateway, IMEI & device telemetry" },
  { scope: "events:read", label: "Read Events", desc: "Access telemetry threshold events & anomalies" },
  { scope: "alerts:read", label: "Read Alerts", desc: "Access active system health alerts" },
  { scope: "sites:read", label: "Read Industrial Sites", desc: "Access site location hierarchies" },
  { scope: "customers:read", label: "Read Customer Directory", desc: "Access customer tenant profiles" },
];

export default function ConnectedApiAccessPage() {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ConnectedApiKey[]>(MOCK_API_KEYS);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<ApiScope[]>([
    "telemetry:read",
    "assets:read",
    "events:read",
  ]);

  // Interactive API Console state
  const [activeEndpoint, setActiveEndpoint] = useState("/api/v1/assets/asset-001/telemetry");
  const [apiResponse, setApiResponse] = useState(
    JSON.stringify(
      {
        status: 200,
        asset_id: "asset-001",
        asset_name: "CAT 6040 Excavator 01",
        timestamp: new Date().toISOString(),
        telemetry: {
          engine_coolant_temperature: { value: 87.4, unit: "°C", status: "GOOD" },
          engine_speed_rpm: { value: 1502, unit: "RPM", status: "GOOD" },
          fuel_tank_level_percent: { value: 68.5, unit: "%", status: "GOOD" },
          battery_terminal_voltage: { value: 24.7, unit: "V", status: "GOOD" },
        },
      },
      null,
      2,
    ),
  );

  const toggleScope = (scope: ApiScope) => {
    if (selectedScopes.includes(scope)) {
      setSelectedScopes(selectedScopes.filter((s) => s !== scope));
    } else {
      setSelectedScopes([...selectedScopes, scope]);
    }
  };

  const handleGenerateKey = () => {
    if (!keyName) return;
    const newKey: ConnectedApiKey = {
      id: `key-${Date.now()}`,
      name: keyName,
      key_prefix: `mc_live_${Math.random().toString(36).substring(2, 6)}...`,
      full_key: `mc_live_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`,
      customer_id: "cust-001",
      customer_name: "ABC Mining Ltd",
      scopes: selectedScopes,
      created_at: new Date().toISOString(),
      expires_at: "2027-12-31T23:59:59Z",
      last_used_at: "Never",
      status: "ACTIVE",
    };

    setApiKeys([newKey, ...apiKeys]);
    setShowNewKeyModal(false);
    setKeyName("");
    toast({
      title: "API Key Generated",
      description: `Generated credentials for ${newKey.name} with ${selectedScopes.length} scopes.`,
    });
  };

  const handleTestApiCall = (endpoint: string) => {
    setActiveEndpoint(endpoint);
    let mockData = {};
    if (endpoint.includes("/telemetry")) {
      mockData = {
        asset_id: "asset-001",
        metrics: { engine_temp: 87.4, rpm: 1502, fuel: 68.5 },
      };
    } else if (endpoint.includes("/events")) {
      mockData = {
        events: [
          { event: "HIGH_TEMPERATURE", value: "98.4 °C", status: "ACTIVE" },
        ],
      };
    } else {
      mockData = {
        assets: [
          { id: "asset-001", name: "CAT 6040 Excavator 01", status: "CONNECTED" },
          { id: "asset-002", name: "Komatsu PC8000", status: "CONNECTED" },
        ],
      };
    }

    setApiResponse(
      JSON.stringify(
        { status: 200, timestamp: new Date().toISOString(), endpoint, data: mockData },
        null,
        2,
      ),
    );
    toast({ title: "API Call Executed", description: `200 OK — ${endpoint}` });
  };

  return (
          <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              API Access Credentials & Granular Scopes
            </h1>
            <p className="text-sm text-muted-foreground">
              Issue REST API keys to industrial analytics partners & external platforms with strict scope isolation
            </p>
          </div>
          <Button
            className="bg-primary hover:bg-primary/90 text-white"
            onClick={() => setShowNewKeyModal(true)}
          >
            <Plus className="mr-2 h-4 w-4" /> Generate API Credentials
          </Button>
        </div>

        {/* API Credentials Table */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" /> Active API Keys & Partners
            </CardTitle>
            <CardDescription>Managed customer & analytics firm access credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 rounded-lg border p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{key.name}</span>
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        {key.status}
                      </Badge>
                    </div>
                    <div className="text-xs font-mono text-primary">
                      {key.key_prefix}
                    </div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {key.scopes.map((scope) => (
                        <Badge key={scope} variant="outline" className="text-[10px] bg-muted/40">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="text-right text-xs text-muted-foreground space-y-1">
                    <div>Customer: <strong className="text-foreground">{key.customer_name}</strong></div>
                    <div>Last Used: {key.last_used_at}</div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(key.full_key || key.key_prefix);
                        toast({ title: "Key Copied", description: "API Key copied to clipboard." });
                      }}
                    >
                      <Copy className="mr-1 h-3 w-3" /> Copy Secret Key
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Interactive REST API Playground */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" /> Interactive REST API Playground
            </CardTitle>
            <CardDescription>Test live endpoint payloads and scope authorizations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                "GET /api/v1/assets",
                "GET /api/v1/assets/asset-001/telemetry",
                "GET /api/v1/assets/asset-001/events",
                "GET /api/v1/assets/asset-001/health",
                "GET /api/v1/devices",
                "GET /api/v1/sites",
              ].map((endpoint) => (
                <Button
                  key={endpoint}
                  variant={activeEndpoint === endpoint ? "default" : "outline"}
                  size="sm"
                  className={activeEndpoint === endpoint ? "bg-primary text-white hover:bg-primary/90 text-xs font-mono" : "text-xs font-mono"}
                  onClick={() => handleTestApiCall(endpoint)}
                >
                  <Play className="mr-1 h-3 w-3" /> {endpoint}
                </Button>
              ))}
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                <span>Response Payload (JSON)</span>
                <span>HTTP 200 OK</span>
              </div>
              <pre className="rounded-md border bg-slate-950 p-4 text-xs font-mono text-emerald-400 overflow-x-auto h-56">
                {apiResponse}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Generate Key Modal */}
        <Dialog open={showNewKeyModal} onOpenChange={setShowNewKeyModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" /> Issue API Key
              </DialogTitle>
              <DialogDescription>
                Select scope permissions for external analytics access
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">API Key Name</label>
                <Input
                  placeholder="e.g. Datadog Analytics Connector"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="font-semibold text-foreground">Authorized API Scopes:</label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto border rounded-md p-2">
                  {ALL_SCOPES.map(({ scope, label, desc }) => (
                    <label
                      key={scope}
                      className="flex items-start gap-2.5 p-2 rounded hover:bg-muted/40 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selectedScopes.includes(scope)}
                        onChange={() => toggleScope(scope)}
                      />
                      <div>
                        <div className="font-semibold text-foreground">{label} (`{scope}`)</div>
                        <div className="text-[11px] text-muted-foreground">{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <Button
                className="w-full bg-primary hover:bg-primary/90 text-white"
                onClick={handleGenerateKey}
              >
                Generate API Key & Scopes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      );
}
