import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ClipboardList, CheckCircle2, XCircle, HelpCircle, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { formatWoNumber } from "@/components/WorkOrderPreview";

const STATUSES = ["pending", "approved", "rejected", "info_requested", "purchase_required", "issued", "partially_issued", "closed"];
const STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  info_requested: "bg-amber-100 text-amber-700",
  purchase_required: "bg-purple-100 text-purple-700",
  issued: "bg-emerald-100 text-emerald-700",
  partially_issued: "bg-blue-100 text-blue-700",
  closed: "bg-slate-100 text-slate-600",
};

export default function Requests() {
  const { profile } = useAuth();
  const { isManager } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<string, { available: number; reserved: number }>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("pending");
  const [reviewTarget, setReviewTarget] = useState<{ request: any; decision: "rejected" | "info_requested" | "purchase_required" } | null>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: r, error: e1 }, { data: b, error: e2 }] = await Promise.all([
      (supabase as any).from("material_requests").select("*, work_orders(id, title, wo_number, wo_year), material_request_items(*, inventory_items(name, part_number, unit, reorder_level, criticality), stock_locations(name))").order("created_at", { ascending: false }),
      (supabase as any).from("stock_balances").select("item_id, available_stock, reserved_stock"),
    ]);
    const err = e1 || e2;
    if (err) toast.error(err.message);
    setRequests(r ?? []);
    const balMap: Record<string, { available: number; reserved: number }> = {};
    (b ?? []).forEach((row: any) => {
      const e = balMap[row.item_id] ?? { available: 0, reserved: 0 };
      e.available += Number(row.available_stock);
      e.reserved += Number(row.reserved_stock);
      balMap[row.item_id] = e;
    });
    setBalances(balMap);
    const ids = [...new Set((r ?? []).map((x: any) => x.requested_by).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { map[p.id] = p.full_name ?? "—"; });
      setNames(map);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const filtered = useMemo(() => filter === "all" ? requests : requests.filter((r) => r.status === filter), [requests, filter]);

  const approve = async (id: string) => {
    const { error } = await (supabase as any).rpc("review_material_request", { _request_id: id, _decision: "approved" });
    if (error) return toast.error(error.message);
    toast.success("Approved — stock reserved");
    load();
  };

  const [note, setNote] = useState("");

  const submitReview = async () => {
    if (!reviewTarget) return;
    const { error } = await (supabase as any).rpc("review_material_request", {
      _request_id: reviewTarget.request.id,
      _decision: reviewTarget.decision,
      _review_note: note,
    });
    if (error) return toast.error(error.message);
    toast.success("Updated");
    setReviewTarget(null);
    setNote("");
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Material requests</h1>
        <p className="text-sm text-muted-foreground">Parts requested against work orders — approve, reject, or flag for purchase.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", ...STATUSES].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${filter === s ? "bg-primary text-primary-foreground" : "border-border bg-card"}`}>
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="No requests" description="Nothing here right now." />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                  {r.work_orders ? (
                    <Link to={`/work-orders/${r.work_orders.id}`} className="font-medium text-primary hover:underline">
                      {formatWoNumber(r.work_orders.wo_year, r.work_orders.wo_number)} — {r.work_orders.title}
                    </Link>
                  ) : <span className="font-medium">Standalone request</span>}
                  <span className="text-xs text-muted-foreground">
                    by {names[r.requested_by] ?? "—"} {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_CLASS[r.status]}`}>{r.status.replace(/_/g, " ")}</span>
                  {r.status === "pending" && isManager && (
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={() => approve(r.id)} className="gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => setReviewTarget({ request: r, decision: "rejected" })}><XCircle className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" onClick={() => setReviewTarget({ request: r, decision: "info_requested" })}><HelpCircle className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" onClick={() => setReviewTarget({ request: r, decision: "purchase_required" })}><ShoppingCart className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                {(r.material_request_items ?? []).map((it: any) => {
                  const bal = balances[it.item_id] ?? { available: 0, reserved: 0 };
                  const afterIssue = bal.available - it.quantity_requested;
                  const reorder = Number(it.inventory_items?.reorder_level ?? 0);
                  return (
                    <div key={it.id} className="rounded bg-muted/40 px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {it.inventory_items?.name}{it.inventory_items?.part_number && ` (${it.inventory_items.part_number})`}
                          {it.inventory_items?.criticality === "critical" && <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-red-700">critical</span>}
                          {" — "}requested {formatNumber(it.quantity_requested)} {it.inventory_items?.unit} at {it.stock_locations?.name}
                        </span>
                        <span className="text-muted-foreground">
                          available {formatNumber(bal.available)} · reserved {formatNumber(bal.reserved)}
                        </span>
                      </div>
                      {r.status === "pending" && afterIssue < reorder && (
                        <div className="mt-1 text-amber-700">Approving this will take available stock to {formatNumber(afterIssue)}, below the reorder level of {formatNumber(reorder)}.</div>
                      )}
                      {r.status === "pending" && afterIssue < 0 && (
                        <div className="mt-1 font-medium text-red-700">Not enough stock available to fully approve this line.</div>
                      )}
                    </div>
                  );
                })}
              </div>
              {r.review_note && <p className="mt-2 text-xs text-muted-foreground">Note: {r.review_note}</p>}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!reviewTarget} onOpenChange={(v) => !v && setReviewTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="capitalize">{reviewTarget?.decision.replace(/_/g, " ")}</DialogTitle></DialogHeader>
          <Textarea rows={3} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)}>Cancel</Button>
            <Button onClick={submitReview}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
