import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ClipboardCheck, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Props {
  wo: any;
  onSaved: () => void;
}

type Approval = {
  id: string;
  status: "pending" | "approved" | "rejected";
  requested_by: string | null;
  requested_at: string;
  request_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
};

export function WorkOrderCloseApprovalCard({ wo, onSaved }: Props) {
  const { profile } = useAuth();
  const { isOwner, isManager, isEngineer } = useUserRole();
  const [approval, setApproval] = useState<Approval | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewNote, setReviewNote] = useState("");

  const canReview = isOwner || isManager || isEngineer;

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("wo_close_approvals")
      .select("*")
      .eq("work_order_id", wo.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setApproval(data ?? null);
    const ids = [data?.requested_by, data?.reviewed_by].filter(Boolean) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { map[p.id] = p.full_name ?? "—"; });
      setNames(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [wo.id]);

  const request = async () => {
    if (!profile) return;
    setRequesting(true);
    const { error } = await (supabase as any).from("wo_close_approvals").insert({
      organisation_id: wo.organisation_id,
      work_order_id: wo.id,
      requested_by: profile.id,
      status: "pending",
    });
    setRequesting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Closure approval requested");
    load();
    onSaved();
  };

  const review = async (status: "approved" | "rejected") => {
    if (!approval) return;
    setReviewing(true);
    const { error } = await (supabase as any)
      .from("wo_close_approvals")
      .update({
        status,
        reviewed_by: profile?.id,
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote.trim() || null,
      })
      .eq("id", approval.id);
    setReviewing(false);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "approved" ? "Closure approved — the work order can now be closed" : "Closure rejected");
    setReviewNote("");
    load();
    onSaved();
  };

  if (loading) return null;
  if (wo.status === "closed" && !approval) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <ClipboardCheck className="h-4 w-4 text-primary" /> Closure approval
      </div>

      {!approval && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            This work order can't be closed until an engineer or supervisor approves it.
          </p>
          <Button size="sm" variant="outline" onClick={request} disabled={requesting}>
            {requesting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Request closure approval
          </Button>
        </div>
      )}

      {approval?.status === "pending" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
            Pending approval — requested by {names[approval.requested_by ?? ""] ?? "—"}{" "}
            {formatDistanceToNow(new Date(approval.requested_at), { addSuffix: true })}. This work order can't be closed until this is approved.
          </div>
          {canReview && (
            <div className="space-y-2">
              <Textarea
                rows={2}
                placeholder="Review note (optional)"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => review("approved")} disabled={reviewing} className="gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => review("rejected")} disabled={reviewing} className="gap-1.5">
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {approval && approval.status !== "pending" && (
        <div
          className={
            approval.status === "approved"
              ? "rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800"
              : "rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800"
          }
        >
          {approval.status === "approved" ? "Approved" : "Rejected"} by {names[approval.reviewed_by ?? ""] ?? "—"}{" "}
          {approval.reviewed_at && formatDistanceToNow(new Date(approval.reviewed_at), { addSuffix: true })}
          {approval.review_note && <div className="mt-1 rounded bg-white/60 p-2">{approval.review_note}</div>}
          {approval.status === "rejected" && (
            <div className="mt-2">
              <Button size="sm" variant="outline" onClick={request} disabled={requesting}>
                {requesting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Request again
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
