import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, RotateCw, CheckCircle2, Sliders, Eye, ShieldAlert, Loader2, Check } from "lucide-react";
import { integrationsService } from "@/services/integrationsService";
import type { IntegrationErrorItem } from "@/types/integrations";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export function ErrorCenterView() {
  const [errors, setErrors] = useState<IntegrationErrorItem[]>(integrationsService.getErrors());
  const [inspectingError, setInspectingError] = useState<IntegrationErrorItem | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    integrationsService.fetchErrors().then((data) => {
      if (active) setErrors(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleRetry = async (errorId: string) => {
    setRetryingId(errorId);
    try {
      await integrationsService.retryError(errorId);
      setErrors(integrationsService.getErrors());
      toast.success("Retry queued with exponential backoff!");
    } catch {
      toast.error("Retry failed");
    } finally {
      setRetryingId(null);
    }
  };

  const handleResolve = (errorId: string) => {
    integrationsService.resolveError(errorId, "Manually marked as resolved by admin");
    setErrors(integrationsService.getErrors());
    toast.success("Error marked as resolved.");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Error Center & Dead-Letter Queue (DLQ)</h2>
          <p className="text-xs text-muted-foreground">
            Monitor, inspect raw ERP payloads, fix schema mappings, and trigger automated retries.
          </p>
        </div>
      </div>

      {errors.length === 0 ? (
        <Card className="border-dashed border-2 border-border/80 bg-muted/10 p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 mb-3">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Zero Integration Errors</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
            All connected pipelines and ERP sync jobs are healthy. No unmapped payload failures or dead-letter queue records detected.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {errors.map((item) => (
            <Card key={item.id} className="border-border shadow-sm border-l-4 border-l-destructive">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <Badge variant="destructive" className="text-xs font-mono uppercase">
                      FAILED
                    </Badge>
                    <span className="text-sm font-bold text-foreground">
                      Entity: <span className="text-primary capitalize">{item.entity_type}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">|</span>
                    <span className="text-xs text-muted-foreground">
                      ERP: <strong className="text-foreground">{item.connector_type.toUpperCase()}</strong>
                    </span>
                    <span className="text-xs text-muted-foreground">|</span>
                    <span className="text-xs font-mono text-muted-foreground">
                      ERP ID: <strong className="text-foreground">{item.external_id}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Retry #{item.retry_count}/{item.max_retries}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase ${
                        item.status === "dead_letter"
                          ? "bg-red-500/10 text-red-600 border-red-500/30"
                          : item.status === "retrying"
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-1 text-xs">
                <div className="p-2.5 rounded bg-destructive/5 border border-destructive/20 text-destructive font-mono text-xs flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">{item.error_code}:</span> {item.error_message}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-muted-foreground pt-1">
                  <div>
                    Occurred:{" "}
                    <span className="text-foreground font-medium">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                    {item.next_retry_at && (
                      <span className="ml-3 text-amber-600">
                        Next automated attempt: {new Date(item.next_retry_at).toLocaleTimeString()}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setInspectingError(item)}
                      className="text-xs h-8 gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" /> Inspect Payload
                    </Button>
                    <Link to="/integrations/mapping">
                      <Button size="sm" variant="outline" className="text-xs h-8 gap-1">
                        <Sliders className="h-3.5 w-3.5" /> Fix Mapping
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      disabled={retryingId === item.id || item.status === "dead_letter"}
                      onClick={() => handleRetry(item.id)}
                      className="text-xs h-8 gap-1 font-semibold"
                    >
                      {retryingId === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCw className="h-3.5 w-3.5" />
                      )}
                      Retry Now
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleResolve(item.id)}
                      className="text-xs h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                    >
                      Mark Resolved
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Record JSON Modal */}
      {inspectingError && (
        <Dialog open={Boolean(inspectingError)} onOpenChange={(o) => !o && setInspectingError(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Raw Payload Inspector
              </DialogTitle>
              <DialogDescription className="text-xs font-mono">
                Error ID: {inspectingError.id} | External ID: {inspectingError.external_id}
              </DialogDescription>
            </DialogHeader>

            <div className="bg-muted/30 p-3 rounded border border-border overflow-x-auto text-xs font-mono max-h-72">
              <pre>{JSON.stringify(inspectingError.raw_payload, null, 2)}</pre>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setInspectingError(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
export default ErrorCenterView;
