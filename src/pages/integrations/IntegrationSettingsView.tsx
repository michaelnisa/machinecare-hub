import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Settings, Shield, Bell, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function IntegrationSettingsView() {
  const [defaultConflict, setDefaultConflict] = useState("erp_wins");
  const [autoRetry, setAutoRetry] = useState(true);
  const [notifyOnFail, setNotifyOnFail] = useState(true);
  const [rateLimit, setRateLimit] = useState("240");

  const handleSave = () => {
    toast.success("Integration settings saved successfully for current organization.");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-bold text-foreground">Tenant Integration Policies & System Settings</h2>
        <p className="text-xs text-muted-foreground">
          Configure organization-wide defaults for conflict resolution, automated retries, and failure alerts.
        </p>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Conflict Resolution Policy
          </CardTitle>
          <CardDescription className="text-xs">
            Global strategy applied when ERP and MachineCare operational data diverge.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Default Strategy for New Connections</Label>
            <Select value={defaultConflict} onValueChange={setDefaultConflict}>
              <SelectTrigger className="text-xs max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="erp_wins">ERP Wins (Business/financial system takes priority)</SelectItem>
                <SelectItem value="machinecare_wins">MachineCare Wins (Physical/operational telemetry takes priority)</SelectItem>
                <SelectItem value="newest_wins">Newest Timestamp Wins (Most recent modification)</SelectItem>
                <SelectItem value="manual">Manual Resolution (Stop and require admin review)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> Observability & Failure Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-foreground">Automatic Exponential Retries</div>
              <div className="text-[11px] text-muted-foreground">Retry transient network drops and rate limits up to 3 times.</div>
            </div>
            <Switch checked={autoRetry} onCheckedChange={setAutoRetry} />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <div>
              <div className="text-xs font-bold text-foreground">Alert Admins on Dead-Letter Records</div>
              <div className="text-[11px] text-muted-foreground">Send SMS / email notification if records exceed max retry attempts.</div>
            </div>
            <Switch checked={notifyOnFail} onCheckedChange={setNotifyOnFail} />
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <Label className="text-xs font-semibold">Global API Rate Limit Throttling (Requests / min)</Label>
            <Input
              value={rateLimit}
              onChange={(e) => setRateLimit(e.target.value)}
              className="max-w-xs text-xs font-mono h-8"
            />
          </div>
        </CardContent>

        <CardFooter className="pt-2 border-t border-border flex justify-end">
          <Button size="sm" onClick={handleSave} className="text-xs">
            Save Settings
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
export default IntegrationSettingsView;
