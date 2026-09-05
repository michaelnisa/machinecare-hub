import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Clock, History, RotateCw, ChevronRight } from "lucide-react";
import { integrationsService } from "@/services/integrationsService";
import type { SyncJobRecord } from "@/types/integrations";

export function SyncHistoryView() {
  const [jobs, setJobs] = useState<SyncJobRecord[]>(integrationsService.getSyncJobs());
  const [selectedJob, setSelectedJob] = useState<SyncJobRecord | null>(null);

  useEffect(() => {
    let active = true;
    integrationsService.fetchSyncJobs().then((data) => {
      if (active) setJobs(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Sync History & Audit Trail</h2>
          <p className="text-xs text-muted-foreground">
            Complete cryptographic audit trail of all background synchronization jobs and payload transformations.
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> Execution History Log
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0">
              <div className="divide-y divide-border">
                <div className="grid grid-cols-12 gap-2 p-3 bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase">
                  <div className="col-span-3">Started Time</div>
                  <div className="col-span-3">System / Entity</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-3">Records (Proc/Add/Upd)</div>
                  <div className="col-span-1 text-right">View</div>
                </div>

                {jobs.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-semibold text-foreground">No sync jobs have run yet.</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Manual and scheduled sync runs will appear here with execution stats and record counts.
                    </p>
                  </div>
                ) : (
                  jobs.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className={`grid grid-cols-12 gap-2 p-3 items-center text-xs cursor-pointer transition-colors ${
                        selectedJob?.id === job.id ? "bg-primary/5" : "hover:bg-muted/30"
                      }`}
                    >
                      <div className="col-span-3">
                        <div className="font-mono text-foreground font-semibold">
                          {new Date(job.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(job.started_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="col-span-3">
                        <div className="font-bold text-foreground truncate">{job.integration_name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {job.entity_type} ({job.direction === "erp_to_mc" ? "Inbound" : "Outbound"})
                        </div>
                      </div>

                      <div className="col-span-2">
                        {job.status === "completed" ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                            COMPLETED
                          </Badge>
                        ) : job.status === "running" ? (
                          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px]">
                            RUNNING
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            FAILED
                          </Badge>
                        )}
                      </div>

                      <div className="col-span-3 font-mono text-[11px]">
                        <span className="font-bold text-foreground">{job.records_processed.toLocaleString()}</span> total (
                        <span className="text-emerald-600">+{job.records_created}</span> /{" "}
                        <span className="text-blue-600">~{job.records_updated}</span>)
                        {job.records_failed > 0 && (
                          <span className="text-destructive font-bold ml-1">!{job.records_failed}</span>
                        )}
                      </div>

                      <div className="col-span-1 text-right text-muted-foreground">
                        <ChevronRight className="h-4 w-4 ml-auto" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Selected Job Inspection Details */}
        <div className="lg:col-span-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-bold">Job Execution Inspector</CardTitle>
              <CardDescription className="text-xs">
                Detailed telemetry for selected run.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 space-y-4 text-xs">
              {selectedJob ? (
                <>
                  <div className="space-y-1.5 border-b border-border pb-3">
                    <div className="text-[11px] text-muted-foreground uppercase font-semibold">Job ID</div>
                    <div className="font-mono text-foreground font-bold">{selectedJob.id}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-b border-border pb-3">
                    <div>
                      <div className="text-[11px] text-muted-foreground uppercase font-semibold">Processed</div>
                      <div className="font-mono text-base font-black text-foreground">{selectedJob.records_processed.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground uppercase font-semibold">Failed</div>
                      <div className="font-mono text-base font-black text-destructive">{selectedJob.records_failed}</div>
                    </div>
                  </div>

                  {selectedJob.error_summary && (
                    <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                      <div className="font-bold mb-0.5">Error Summary:</div>
                      {selectedJob.error_summary}
                    </div>
                  )}

                  <div className="space-y-1.5 font-mono text-[11px] text-muted-foreground">
                    <div>Started: {selectedJob.started_at}</div>
                    <div>Completed: {selectedJob.completed_at || "In progress"}</div>
                    <div>Direction: {selectedJob.direction}</div>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8 italic">
                  Select a sync job row on the left to inspect detailed record diffs.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
export default SyncHistoryView;
