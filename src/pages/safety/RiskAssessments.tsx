import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ClipboardList,
  QrCode,
  Tv,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Building2,
  HardHat,
  FileText,
  UserCheck,
  Eye,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { Link } from "react-router-dom";
import { formatWoNumber } from "@/components/WorkOrderPreview";
import { VendorQrPosterModal } from "./VendorQrPosterModal";

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  pending_approval: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 animate-pulse",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300",
};

const RISK_CLASS: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  critical: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold",
};

export default function RiskAssessments() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [posterOpen, setPosterOpen] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<any | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("risk_assessments")
      .select("*, work_orders(id, title, wo_number, wo_year), machines(name)")
      .order("created_at", { ascending: false });

    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [profile]);

  const pendingCount = useMemo(
    () => items.filter((x) => x.status === "pending_approval").length,
    [items]
  );

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((x) => x.status === filter);
  }, [items, filter]);

  // Review approval action
  const handleReview = async (status: "approved" | "rejected") => {
    if (!selectedAssessment) return;
    setProcessing(true);
    try {
      const { error } = await (supabase as any)
        .from("risk_assessments")
        .update({
          status,
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
          review_note: reviewNote ? `${selectedAssessment.review_note || ""}\n[Safety Note]: ${reviewNote}` : selectedAssessment.review_note,
        })
        .eq("id", selectedAssessment.id);

      if (error) throw error;
      toast.success(status === "approved" ? "Risk Assessment & Permit Approved!" : "Risk Assessment Rejected");
      setSelectedAssessment(null);
      setReviewNote("");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to update assessment status");
    } finally {
      setProcessing(false);
    }
  };

  // Parse vendor details if JSON in review_note
  const parsedVendorData = useMemo(() => {
    if (!selectedAssessment?.review_note) return null;
    try {
      if (selectedAssessment.review_note.startsWith("{")) {
        return JSON.parse(selectedAssessment.review_note);
      }
    } catch {
      return null;
    }
    return null;
  }, [selectedAssessment]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Banner & Fast Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Risk Assessments & RAMS</h1>
            {pendingCount > 0 && (
              <Badge className="bg-amber-500 text-black font-bold animate-pulse">
                {pendingCount} Pending Approval
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Internal Job Safety Analyses & External Vendor/Contractor Permit to Work Approvals.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPosterOpen(true)}
            className="gap-1.5 border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
          >
            <QrCode className="h-4 w-4" /> Vendor QR Gate Poster
          </Button>

          <Link to="/safety/live-tv">
            <Button size="sm" className="gap-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500">
              <Tv className="h-4 w-4 text-emerald-400 dark:text-white" /> Safety Live TV
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: "all", label: "All Assessments" },
          { id: "pending_approval", label: `Pending Approval (${pendingCount})` },
          { id: "approved", label: "Approved Permits" },
          { id: "rejected", label: "Rejected" },
          { id: "draft", label: "Drafts" },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setFilter(s.id)}
            className={`rounded-full border px-3.5 py-1 text-xs font-semibold capitalize transition-colors ${
              filter === s.id
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "border-border bg-card hover:bg-muted/60 text-muted-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Main Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No risk assessments in this view"
          description="Contractors can submit from the QR portal, or you can create one linked to a work order."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Title / Contractor</th>
                  <th className="px-5 py-3.5 font-semibold">Type / Source</th>
                  <th className="px-5 py-3.5 font-semibold">Location / Machine</th>
                  <th className="px-5 py-3.5 font-semibold">Overall Risk</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 font-semibold">Submitted</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((x) => {
                  const isVendor = x.title.includes("[VENDOR") || x.activity?.includes("Vendor");
                  const isPending = x.status === "pending_approval";

                  return (
                    <tr key={x.id} className={`hover:bg-muted/40 transition-colors ${isPending ? "bg-amber-500/5" : ""}`}>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          {x.title}
                        </div>
                        {x.work_orders && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            WO:{" "}
                            <Link to={`/work-orders/${x.work_orders.id}`} className="text-primary hover:underline">
                              {formatWoNumber(x.work_orders.wo_year, x.work_orders.wo_number)}
                            </Link>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {isVendor ? (
                          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[11px] gap-1">
                            <Building2 className="h-3 w-3" /> Vendor RAMS
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px] gap-1">
                            <FileText className="h-3 w-3" /> Internal JSA
                          </Badge>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {x.machines?.name || "Main Site / Workshop"}
                      </td>
                      <td className="px-5 py-3.5">
                        {x.overall_risk && (
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${RISK_CLASS[x.overall_risk]}`}>
                            {x.overall_risk}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_CLASS[x.status]}`}>
                          {x.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs font-mono">
                        {formatDate(x.submitted_at || x.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          size="sm"
                          variant={isPending ? "default" : "outline"}
                          onClick={() => setSelectedAssessment(x)}
                          className={`text-xs gap-1.5 ${isPending ? "bg-amber-600 hover:bg-amber-500 text-white font-bold" : ""}`}
                        >
                          {isPending ? <ShieldCheck className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {isPending ? "Review & Approve" : "View"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QR Poster Modal */}
      <VendorQrPosterModal open={posterOpen} onOpenChange={setPosterOpen} />

      {/* Safety Review & Approval Dialog */}
      {selectedAssessment && (
        <Dialog open={!!selectedAssessment} onOpenChange={(v) => !v && setSelectedAssessment(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    Review Risk Assessment & Permit to Work
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-1">
                    Reference #{selectedAssessment.id?.slice(0, 8).toUpperCase()} • Submitted: {formatDate(selectedAssessment.submitted_at || selectedAssessment.created_at)}
                  </DialogDescription>
                </div>
                <Badge className={`uppercase text-xs ${STATUS_CLASS[selectedAssessment.status]}`}>
                  {selectedAssessment.status.replace(/_/g, " ")}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Summary Card */}
              <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
                <div className="text-sm font-bold text-foreground">{selectedAssessment.title}</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div><span className="font-semibold text-foreground">Activity:</span> {selectedAssessment.activity ?? "—"}</div>
                  <div><span className="font-semibold text-foreground">Risk Level:</span> <span className="uppercase font-bold text-amber-600">{selectedAssessment.overall_risk ?? "medium"}</span></div>
                </div>
              </div>

              {/* Vendor Submission Details if parsed */}
              {parsedVendorData && (
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-3 text-xs">
                  <div className="flex items-center gap-2 font-bold text-purple-700 dark:text-purple-400">
                    <Building2 className="h-4 w-4" /> Contractor Submitted Information
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div><span className="text-muted-foreground">Company:</span> <div className="font-bold">{parsedVendorData.vendor_company}</div></div>
                    <div><span className="text-muted-foreground">Representative:</span> <div className="font-bold">{parsedVendorData.rep_name}</div></div>
                    <div><span className="text-muted-foreground">Phone:</span> <div className="font-mono">{parsedVendorData.phone}</div></div>
                    <div><span className="text-muted-foreground">Workers on Site:</span> <div>{parsedVendorData.workers_count} personnel</div></div>
                    <div><span className="text-muted-foreground">Location:</span> <div>{parsedVendorData.location}</div></div>
                    <div><span className="text-muted-foreground">Sign-off By:</span> <div className="font-mono">{parsedVendorData.sign_off}</div></div>
                  </div>

                  {parsedVendorData.high_risk_activities?.length > 0 && (
                    <div>
                      <span className="text-muted-foreground font-semibold">High-Risk Permits Requested:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {parsedVendorData.high_risk_activities.map((hr: string) => (
                          <Badge key={hr} className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-[10px] uppercase">
                            ⚠️ {hr.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {parsedVendorData.mandatory_ppe?.length > 0 && (
                    <div>
                      <span className="text-muted-foreground font-semibold">Mandatory PPE Acknowledged:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {parsedVendorData.mandatory_ppe.map((ppe: string) => (
                          <Badge key={ppe} variant="outline" className="text-[10px]">
                            ✓ {ppe}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {parsedVendorData.hazard_matrix?.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-purple-500/10">
                      <div className="font-bold text-foreground">Identified Hazard & Mitigation Matrix:</div>
                      <div className="space-y-2">
                        {parsedVendorData.hazard_matrix.map((hz: any, i: number) => (
                          <div key={i} className="p-2.5 rounded-lg border border-border bg-background text-xs space-y-1">
                            <div className="font-bold text-emerald-600 dark:text-emerald-400">Step {i + 1}: {hz.step}</div>
                            <div><span className="text-muted-foreground">Hazard:</span> {hz.hazard}</div>
                            <div><span className="text-muted-foreground">Mitigation:</span> {hz.controlMeasure}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Safety Review Note Input */}
              <div className="space-y-1.5">
                <Label className="text-xs">Safety Officer Review Notes / Instructions</Label>
                <Textarea
                  rows={2}
                  placeholder="e.g. Approved with condition that fire extinguisher is standing by at Bay 3."
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="flex-row sm:justify-between gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAssessment(null)}
              >
                Close
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={processing}
                  onClick={() => handleReview("rejected")}
                  className="text-xs gap-1.5"
                >
                  <XCircle className="h-4 w-4" /> Reject
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={processing}
                  onClick={() => handleReview("approved")}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5"
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Approve Permit to Work
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
