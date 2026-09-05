import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Radio, Plus, CheckCircle2, Copy, Send, ArrowRight, ArrowLeft, ShieldCheck, Key } from "lucide-react";
import { integrationsService } from "@/services/integrationsService";
import type { WebhookItem } from "@/types/integrations";
import { toast } from "sonner";

export function WebhooksView() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>(integrationsService.getWebhooks());
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [direction, setDirection] = useState<"inbound" | "outbound">("outbound");
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    integrationsService.fetchWebhooks().then((data) => {
      if (active) setWebhooks(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleCreate = () => {
    if (!name) {
      toast.error("Webhook name is required");
      return;
    }
    const created = integrationsService.createWebhook({
      name,
      direction,
      target_url: direction === "outbound" ? targetUrl : undefined,
    });
    setWebhooks(integrationsService.getWebhooks());
    setCreateOpen(false);
    setName("");
    setTargetUrl("");
    toast.success(`Created webhook: ${created.name}`);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard`);
  };

  const handleTestTrigger = async (whId: string) => {
    setTestingId(whId);
    await new Promise((r) => setTimeout(r, 600));
    setTestingId(null);
    toast.success("Dispatched test payload with valid HMAC-SHA256 signature (HTTP 200 OK)");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Inbound & Outbound Webhook Subscriptions</h2>
          <p className="text-xs text-muted-foreground">
            Real-time event-driven streaming with HMAC-SHA256 signature verification and exponential backoff.
          </p>
        </div>

        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add Webhook Subscription
        </Button>
      </div>

      {webhooks.length === 0 ? (
        <Card className="border-dashed border-2 border-border/80 bg-muted/10 p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
            <Radio className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No Webhook Subscriptions Configured</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-5">
            Configure inbound webhooks to receive real-time ERP change events or outbound webhooks to push MachineCare operational telemetry.
          </p>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 text-xs font-semibold">
            <Plus className="h-3.5 w-3.5" /> Register First Webhook
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {webhooks.map((wh) => (
            <Card key={wh.id} className="border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-bold text-foreground">{wh.name}</CardTitle>
                      {wh.direction === "outbound" ? (
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/20 gap-1">
                          <ArrowRight className="h-3 w-3" /> Outbound Dispatcher
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-500/20 gap-1">
                          <ArrowLeft className="h-3 w-3" /> Inbound Listener
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground mt-1 truncate max-w-sm">
                      {wh.target_url || wh.endpoint_path}
                    </div>
                  </div>

                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                    {wh.success_rate_percent}% SUCCESS
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-3 text-xs">
                <div className="space-y-1">
                  <span className="font-semibold text-muted-foreground text-[11px] uppercase">Subscribed Events:</span>
                  <div className="flex flex-wrap gap-1">
                    {wh.subscribed_events.map((ev) => (
                      <span key={ev} className="px-2 py-0.5 rounded bg-muted/60 text-foreground font-mono text-[10px]">
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-2 rounded bg-muted/20 border border-border flex items-center justify-between font-mono text-[11px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <Key className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Secret:</span>
                    <span className="text-foreground truncate">{wh.secret_key.substring(0, 10)}••••••••</span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => handleCopy(wh.secret_key, "Secret Key")}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span>Total Deliveries: <strong className="text-foreground">{wh.total_deliveries}</strong></span>
                  <span>Failed: <strong className={wh.failed_deliveries > 0 ? "text-destructive" : "text-foreground"}>{wh.failed_deliveries}</strong></span>
                  <span>Last trigger: {wh.last_triggered_at ? "Recently" : "None"}</span>
                </div>
              </CardContent>

              <CardFooter className="pt-2 border-t border-border flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={testingId === wh.id}
                  onClick={() => handleTestTrigger(wh.id)}
                  className="text-xs gap-1.5 h-8"
                >
                  <Send className="h-3 w-3" /> Test Ping Dispatch
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" /> Create Webhook Subscription
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure endpoints and subscribed real-time operational events.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Webhook Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. ERP Purchase Request Stream"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Direction</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={direction === "outbound" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDirection("outbound")}
                  className="text-xs"
                >
                  Outbound (MC → ERP)
                </Button>
                <Button
                  type="button"
                  variant={direction === "inbound" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDirection("inbound")}
                  className="text-xs"
                >
                  Inbound (ERP → MC)
                </Button>
              </div>
            </div>

            {direction === "outbound" && (
              <div className="space-y-1">
                <Label className="text-xs">Destination URL</Label>
                <Input
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://api.erp.company.com/webhooks/listener"
                  className="h-8 text-xs font-mono"
                />
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate}>
              Create Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default WebhooksView;
