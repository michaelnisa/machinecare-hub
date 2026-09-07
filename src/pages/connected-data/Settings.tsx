import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Settings, Cpu, Save, RefreshCw, Sliders, Database, Layers, CheckCircle2 } from "lucide-react";
import { MOCK_MACHINE_DICTIONARY } from "@/lib/connected-data-mock";
import { MachineDataParameter } from "@/types/connected-data";
import { useToast } from "@/components/ui/use-toast";

export default function ConnectedSettingsPage() {
  const { toast } = useToast();
  const [dictionary, setDictionary] = useState<MachineDataParameter[]>(MOCK_MACHINE_DICTIONARY);
  const [retentionDaysRaw, setRetentionDaysRaw] = useState(30);
  const [retentionDaysAgg, setRetentionDaysAgg] = useState(365);

  const handleSaveSettings = () => {
    toast({
      title: "Connected Data Settings Saved",
      description: "Machine Data Dictionary & Retention rules updated.",
    });
  };

  return (
          <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Connected Data Settings & Machine Data Dictionary
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure telemetry normalization, standard parameter keys & retention policies
            </p>
          </div>
          <Button
            className="bg-primary hover:bg-primary/90 text-white"
            onClick={handleSaveSettings}
          >
            <Save className="mr-2 h-4 w-4" /> Save Settings
          </Button>
        </div>

        {/* Data Retention & Storage Policy */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" /> Time-Series Data Retention Policy
            </CardTitle>
            <CardDescription>Hot storage retention for high-frequency raw telemetry points</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Raw Telemetry Retention (Days)</label>
              <Input
                type="number"
                value={retentionDaysRaw}
                onChange={(e) => setRetentionDaysRaw(Number(e.target.value))}
              />
              <p className="text-[11px] text-muted-foreground">Unfiltered 1Hz telemetry data stored in hot time-series engine.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Aggregated Metrics Retention (Days)</label>
              <Input
                type="number"
                value={retentionDaysAgg}
                onChange={(e) => setRetentionDaysAgg(Number(e.target.value))}
              />
              <p className="text-[11px] text-muted-foreground">1-minute & hourly statistical rollups for long-term analytics.</p>
            </div>
          </CardContent>
        </Card>

        {/* Machine Data Dictionary */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" /> Machine Data Dictionary Manager
            </CardTitle>
            <CardDescription>Standardized parameter keys mapped from heterogeneous IoT raw keys</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 font-semibold text-muted-foreground">
                  <tr>
                    <th className="p-2.5">Standard Key</th>
                    <th className="p-2.5">Display Name</th>
                    <th className="p-2.5">Unit</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5">Expected Freq</th>
                    <th className="p-2.5">Mapped Raw Keys</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dictionary.map((param) => (
                    <tr key={param.id} className="hover:bg-muted/30">
                      <td className="p-2.5 font-mono text-primary font-bold">{param.standard_key}</td>
                      <td className="p-2.5 font-semibold text-foreground">{param.display_name}</td>
                      <td className="p-2.5 font-bold text-emerald-600">{param.unit}</td>
                      <td className="p-2.5">
                        <Badge variant="outline" className="text-[10px] bg-muted/40">{param.category}</Badge>
                      </td>
                      <td className="p-2.5 font-mono text-muted-foreground">{param.expected_frequency_sec}s</td>
                      <td className="p-2.5">
                        <div className="flex flex-wrap gap-1">
                          {param.raw_mapping_keys.map((k) => (
                            <Badge key={k} variant="secondary" className="text-[9px] font-mono px-1 py-0">
                              {k}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      );
}
