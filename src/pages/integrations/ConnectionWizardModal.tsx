import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertTriangle, Loader2, ArrowRight, ArrowLeft, Plug, ShieldCheck, Database, Sliders, Clock, Layers } from "lucide-react";
import { integrationsService, CONNECTOR_CATALOG } from "@/services/integrationsService";
import type { ConnectorCatalogItem, SyncFrequency, ConflictStrategy } from "@/types/integrations";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialConnectorSlug?: string;
  onSuccess?: () => void;
}

export function ConnectionWizardModal({ open, onOpenChange, initialConnectorSlug, onSuccess }: Props) {
  const [step, setStep] = useState(1);
  const [selectedSlug, setSelectedSlug] = useState<string>(initialConnectorSlug || "odoo");
  const selectedConnector = CONNECTOR_CATALOG.find((c) => c.slug === selectedSlug) || CONNECTOR_CATALOG[0];

  // Config & Credentials State
  const [configValues, setConfigValues] = useState<Record<string, string>>({
    base_url: selectedSlug === "odoo" ? "https://mining-tz.odoo.com" : selectedSlug === "sap_business_one" ? "https://sap-server.local:50000/b1s/v1" : "https://api.businesscentral.dynamics.com",
    company_identifier: selectedSlug === "odoo" ? "mining_production_db" : selectedSlug === "sap_business_one" ? "SBODEMOUS" : "00000000-0000-0000-0000-000000000000",
    environment: "production",
  });

  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({
    api_key: "odoo_live_bearer_key_sec_99",
    username: "machinecare_bot",
    password: "••••••••",
    tenant_id: "tenant-corp-azure-99",
    client_id: "client-id-app-2026",
    client_secret: "client-secret-••••",
  });

  // Test Connection State
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency_ms: number; company_name?: string; version?: string } | null>(null);

  // Entities to Sync State
  const [selectedEntities, setSelectedEntities] = useState<string[]>(["customers", "parts", "inventory", "assets"]);

  // Sync Rules State
  const [syncFrequency, setSyncFrequency] = useState<SyncFrequency>("15m");
  const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>("erp_wins");

  const handleSelectConnector = (slug: string) => {
    setSelectedSlug(slug);
    setTestResult(null);
    if (slug === "odoo") {
      setConfigValues({ base_url: "https://mining-tz.odoo.com", company_identifier: "mining_production_db" });
    } else if (slug === "sap_business_one") {
      setConfigValues({ base_url: "https://sap-server.local:50000/b1s/v1", company_identifier: "SBODEMOUS" });
    } else if (slug === "dynamics_365") {
      setConfigValues({ base_url: "https://api.businesscentral.dynamics.com", environment: "production", company_identifier: "CRONUS_TZ" });
    } else if (slug === "maximo") {
      setConfigValues({ base_url: "https://maximo-manage.miningcorp.local", company_identifier: "PIT_NORTH", org_id: "EAGLE_MINING" });
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await integrationsService.testConnection({
        connector_type: selectedSlug,
        base_url: configValues.base_url,
        company_identifier: configValues.company_identifier,
        environment: configValues.environment,
        credentials: credentialValues,
      });
      setTestResult(res);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || "Connection failed", latency_ms: 0 });
      toast.error("Test connection failed");
    } finally {
      setTesting(false);
    }
  };

  const toggleEntity = (entity: string) => {
    setSelectedEntities((prev) =>
      prev.includes(entity) ? prev.filter((e) => e !== entity) : [...prev, entity]
    );
  };

  const handleActivate = () => {
    integrationsService.createConnection({
      name: `${selectedConnector.name} - Operations`,
      connector_type: selectedSlug,
      base_url: configValues.base_url,
      company_identifier: configValues.company_identifier,
      environment: configValues.environment || "production",
      sync_frequency: syncFrequency,
      conflict_strategy: conflictStrategy,
    });

    toast.success(`Activated ${selectedConnector.name} Integration! Initial sync queued.`);
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Plug className="h-5 w-5 text-primary" /> Connect ERP to MachineCare
              </DialogTitle>
              <DialogDescription>
                Step {step} of 7 — {
                  step === 1 ? "Select System" :
                  step === 2 ? "Account Credentials" :
                  step === 3 ? "Test Connection" :
                  step === 4 ? "Select Data Scope" :
                  step === 5 ? "Data Mapping Schema" :
                  step === 6 ? "Frequency & Rules" : "Review & Activate"
                }
              </DialogDescription>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              Wizard Step {step}/7
            </Badge>
          </div>
        </DialogHeader>

        {/* STEP 1: Choose ERP */}
        {step === 1 && (
          <div className="space-y-4 py-3">
            <p className="text-sm text-muted-foreground">
              Select your enterprise business system of record to integrate with MachineCare.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {CONNECTOR_CATALOG.filter(c => c.status === "available").map((connector) => (
                <div
                  key={connector.slug}
                  onClick={() => handleSelectConnector(connector.slug)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedSlug === connector.slug
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-border/80 hover:bg-muted/40"
                  }`}
                >
                  <div className="font-bold text-base text-foreground flex items-center justify-between">
                    {connector.name}
                    {selectedSlug === connector.slug && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {connector.description}
                  </div>
                  <div className="mt-3">
                    <Badge variant="secondary" className="text-[10px]">
                      {connector.version}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: Connect Account */}
        {step === 2 && (
          <div className="space-y-4 py-3">
            <div className="p-3 bg-muted/30 rounded border border-border flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="text-xs text-muted-foreground">
                Credentials are encrypted in MachineCare Vault using AES-256-GCM. Plaintext secrets are never stored or transmitted to the browser.
              </div>
            </div>

            <div className="space-y-3">
              {selectedConnector.config_fields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs font-semibold">{field.label}</Label>
                  <Input
                    value={configValues[field.key] || ""}
                    onChange={(e) => setConfigValues({ ...configValues, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="text-sm font-mono"
                  />
                </div>
              ))}

              {selectedConnector.credential_fields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs font-semibold">{field.label}</Label>
                  <Input
                    type={field.type}
                    value={credentialValues[field.key] || ""}
                    onChange={(e) => setCredentialValues({ ...credentialValues, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="text-sm font-mono"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Test Connection */}
        {step === 3 && (
          <div className="space-y-5 py-4 text-center">
            <div>
              <h3 className="text-base font-semibold">Verify Connectivity</h3>
              <p className="text-xs text-muted-foreground mt-1">
                MachineCare will perform an asynchronous health check and authenticate with {selectedConnector.name}.
              </p>
            </div>

            <div className="p-6 rounded-lg border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center space-y-4">
              {testing ? (
                <div className="flex flex-col items-center space-y-2 py-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground font-mono">Pinging {configValues.base_url}...</span>
                </div>
              ) : testResult ? (
                <div className="space-y-2 text-center">
                  {testResult.success ? (
                    <div className="flex flex-col items-center space-y-2 text-emerald-600">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                      <div className="font-bold text-sm text-foreground">{testResult.message}</div>
                      <div className="text-xs text-muted-foreground">
                        Latency: <span className="font-mono text-emerald-600 font-bold">{testResult.latency_ms}ms</span> | Entity: {testResult.company_name} | {testResult.version}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-2 text-destructive">
                      <AlertTriangle className="h-10 w-10 text-destructive" />
                      <div className="font-bold text-sm">{testResult.message}</div>
                      <div className="text-xs text-muted-foreground">Please check URL, API keys, or permissions.</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground py-2">
                  Target: <code className="font-mono text-foreground font-bold">{configValues.base_url}</code>
                </div>
              )}

              <Button onClick={handleTestConnection} disabled={testing} variant="outline" className="gap-2">
                {testing && <Loader2 className="h-4 w-4 animate-spin" />}
                {testResult ? "Re-test Connection" : "Test Connection Now"}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Choose Data */}
        {step === 4 && (
          <div className="space-y-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">Select Data Objects to Synchronize</h3>
              <p className="text-xs text-muted-foreground">
                Choose which business entities should be managed between {selectedConnector.name} and MachineCare.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { id: "assets", label: "Fixed Assets & Equipment", desc: "MachineCare adds operating telemetry, PM schedules & inspection logs" },
                { id: "parts", label: "Spare Parts & Master Items", desc: "Sync part numbers, descriptions, costs, and min reorder levels" },
                { id: "inventory", label: "Inventory Quantities & Warehouses", desc: "Stock balances, warehouse allocations, and batch availability" },
                { id: "customers", label: "Customers & Business Partners", desc: "Customer master records for workshop & service operations" },
                { id: "purchase_orders", label: "Purchase Orders & Requisitions", desc: "Work order spare part requisitions routed to ERP procurement" },
                { id: "production_orders", label: "Production & Manufacturing Orders", desc: "Operational attainment, scrap rates, and machine downtime minutes" },
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => toggleEntity(item.id)}
                  className={`p-3 rounded border cursor-pointer flex items-start gap-3 transition-colors ${
                    selectedEntities.includes(item.id) ? "border-primary/50 bg-primary/5" : "border-border"
                  }`}
                >
                  <Checkbox checked={selectedEntities.includes(item.id)} className="mt-1" />
                  <div>
                    <div className="text-xs font-bold text-foreground">{item.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 5: Configure Mapping */}
        {step === 5 && (
          <div className="space-y-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Canonical Schema Mapping</h3>
                <p className="text-xs text-muted-foreground">
                  Default mapping loaded for {selectedConnector.name}. You can fine-tune specific fields later in Data Mapping.
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                {selectedEntities.length} entities mapped
              </Badge>
            </div>

            <div className="rounded border border-border p-3 bg-muted/10 space-y-2">
              <div className="text-xs font-bold text-foreground flex items-center gap-2">
                <Sliders className="h-3.5 w-3.5 text-primary" /> Sample Mapping: Parts & Spares
              </div>
              <div className="grid grid-cols-2 text-xs font-mono bg-background p-2.5 rounded border border-border gap-2">
                <div>
                  <span className="text-muted-foreground">{selectedConnector.name}:</span>
                  <div className="text-foreground">default_code / ItemCode</div>
                  <div className="text-foreground">name / ItemName</div>
                  <div className="text-foreground">qty_available / OnStock</div>
                </div>
                <div>
                  <span className="text-primary font-semibold">MachineCare:</span>
                  <div className="text-foreground">part_number</div>
                  <div className="text-foreground">name</div>
                  <div className="text-foreground">available_quantity</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: Choose Frequency & Rules */}
        {step === 6 && (
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Synchronization Frequency</Label>
              <Select value={syncFrequency} onValueChange={(v: any) => setSyncFrequency(v)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5m">Every 5 minutes (Real-time operational)</SelectItem>
                  <SelectItem value="15m">Every 15 minutes (Standard recommended)</SelectItem>
                  <SelectItem value="30m">Every 30 minutes</SelectItem>
                  <SelectItem value="1h">Hourly</SelectItem>
                  <SelectItem value="daily">Daily batch</SelectItem>
                  <SelectItem value="manual">Manual trigger only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Conflict Resolution Strategy</Label>
              <Select value={conflictStrategy} onValueChange={(v: any) => setConflictStrategy(v)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="erp_wins">ERP Wins (ERP is business system of record)</SelectItem>
                  <SelectItem value="machinecare_wins">MachineCare Wins (Operational site priority)</SelectItem>
                  <SelectItem value="newest_wins">Newest Timestamp Wins</SelectItem>
                  <SelectItem value="manual">Manual Resolution (Hold in Error Center)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* STEP 7: Review & Activate */}
        {step === 7 && (
          <div className="space-y-4 py-3">
            <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-xs text-muted-foreground">ERP Connector:</span>
                <span className="text-sm font-bold">{selectedConnector.name}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-xs text-muted-foreground">Host Endpoint:</span>
                <span className="text-xs font-mono">{configValues.base_url}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-xs text-muted-foreground">Data Entities:</span>
                <span className="text-xs font-semibold">{selectedEntities.join(", ")}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-xs text-muted-foreground">Frequency:</span>
                <Badge variant="secondary" className="text-xs">{syncFrequency}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Conflict Policy:</span>
                <span className="text-xs font-mono font-bold text-primary">{conflictStrategy}</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-border pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>

          {step < 7 ? (
            <Button
              size="sm"
              onClick={() => setStep((s) => Math.min(7, s + 1))}
              disabled={step === 3 && testResult && !testResult.success}
              className="gap-1.5"
            >
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleActivate} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="h-4 w-4" /> Activate Integration
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
