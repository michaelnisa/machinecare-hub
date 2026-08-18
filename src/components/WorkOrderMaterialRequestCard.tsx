import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Package, Plus, Trash2, CheckCircle2, XCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/format";
import { IssueConfirmDialog } from "@/components/IssueConfirmDialog";
import { Link } from "react-router-dom";

interface Props {
  wo: any;
  onSaved: () => void;
}

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
const ITEM_STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  issued: "bg-emerald-100 text-emerald-700",
  partially_issued: "bg-blue-100 text-blue-700",
  closed: "bg-slate-100 text-slate-600",
};

export function WorkOrderMaterialRequestCard({ wo, onSaved }: Props) {
  const { profile } = useAuth();
  const { isManager } = useUserRole();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [issueTarget, setIssueTarget] = useState<{ requestItemId: string; itemName: string; unit: string | null; remaining: number } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("material_requests")
      .select("*, material_request_items(*, inventory_items(name, part_number, unit), stock_locations(name))")
      .eq("work_order_id", wo.id)
      .order("created_at", { ascending: false });
    setRequests(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [wo.id]);

  const review = async (requestId: string, decision: "approved" | "rejected") => {
    setReviewing(requestId);
    const { error } = await (supabase as any).rpc("review_material_request", {
      _request_id: requestId,
      _decision: decision,
    });
    setReviewing(null);
    if (error) return toast.error(error.message);
    toast.success(decision === "approved" ? "Approved — stock reserved" : "Rejected");
    load();
    onSaved();
  };

  const issue = async (requestItemId: string, quantity: number) => {
    const { error } = await (supabase as any).rpc("issue_material_request_item", {
      _request_item_id: requestItemId,
      _quantity: quantity,
      _work_order_id: wo.id,
      _machine_id: wo.machine_id,
    });
    if (error) { toast.error(error.message); throw error; }
    toast.success("Issued");
    load();
    onSaved();
  };

  const returnItem = async (requestItemId: string, quantity: number) => {
    const { error } = await (supabase as any).rpc("return_material_request_item", {
      _request_item_id: requestItemId,
      _quantity: quantity,
      _condition: "unused",
    });
    if (error) return toast.error(error.message);
    toast.success("Returned");
    load();
    onSaved();
  };

  if (loading) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Package className="h-4 w-4 text-primary" /> Material requests
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Request parts
        </Button>
      </div>

      {requests.length === 0 ? (
        <p className="text-xs text-muted-foreground">No parts requested for this job yet.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_CLASS[r.status]}`}>{r.status.replace(/_/g, " ")}</span>
                <div className="flex items-center gap-2">
                  {["issued", "partially_issued", "closed"].includes(r.status) && (
                    <Link to={`/inventory/requests/${r.id}/receipt`} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs"><Printer className="h-3.5 w-3.5" /> Receipt</Button>
                    </Link>
                  )}
                  {r.status === "pending" && isManager && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => review(r.id, "approved")} disabled={reviewing === r.id} className="gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => review(r.id, "rejected")} disabled={reviewing === r.id} className="gap-1.5">
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                {(r.material_request_items ?? []).map((it: any) => {
                  const remainingToIssue = (it.quantity_approved ?? 0) - it.quantity_issued;
                  const remainingToReturn = it.quantity_issued - it.quantity_returned;
                  return (
                    <div key={it.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1.5 text-xs">
                      <span>
                        {it.inventory_items?.name} — requested {formatNumber(it.quantity_requested)} {it.inventory_items?.unit}
                        {it.quantity_approved != null && `, approved ${formatNumber(it.quantity_approved)}`}
                        {it.quantity_issued > 0 && `, issued ${formatNumber(it.quantity_issued)}`}
                        {it.quantity_returned > 0 && `, returned ${formatNumber(it.quantity_returned)}`}
                        <span className={`ml-2 rounded-full px-1.5 py-0.5 capitalize ${ITEM_STATUS_CLASS[it.status]}`}>{it.status.replace(/_/g, " ")}</span>
                      </span>
                      {isManager && (
                        <div className="flex gap-1.5">
                          {remainingToIssue > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => setIssueTarget({ requestItemId: it.id, itemName: it.inventory_items?.name ?? "item", unit: it.inventory_items?.unit ?? null, remaining: remainingToIssue })}
                            >
                              Issue {formatNumber(remainingToIssue)}
                            </Button>
                          )}
                          {remainingToReturn > 0 && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => returnItem(it.id, remainingToReturn)}>Return {formatNumber(remainingToReturn)}</Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewRequestDialog open={open} setOpen={setOpen} wo={wo} userId={profile?.id} orgId={wo.organisation_id} onSaved={() => { load(); onSaved(); }} />
      <IssueConfirmDialog
        open={!!issueTarget}
        onOpenChange={(v) => !v && setIssueTarget(null)}
        itemName={issueTarget?.itemName ?? ""}
        unit={issueTarget?.unit}
        remaining={issueTarget?.remaining ?? 0}
        onConfirm={async (qty) => { if (issueTarget) await issue(issueTarget.requestItemId, qty); }}
      />
    </div>
  );
}

function NewRequestDialog({ open, setOpen, wo, userId, orgId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [defaultLocationId, setDefaultLocationId] = useState<string>("");
  const [rows, setRows] = useState<{ item_id: string; quantity: string; reason: string }[]>([{ item_id: "", quantity: "1", reason: "" }]);

  useEffect(() => {
    if (open) {
      setRows([{ item_id: "", quantity: "1", reason: "" }]);
      (async () => {
        const [{ data: i }, { data: l }] = await Promise.all([
          supabase.from("inventory_items").select("id, name, part_number, unit").eq("status", "active").order("name"),
          (supabase as any).from("stock_locations").select("id").eq("is_default", true).maybeSingle(),
        ]);
        setItems(i ?? []);
        setDefaultLocationId(l?.id ?? "");
      })();
    }
  }, [open]);

  const updateRow = (i: number, patch: Partial<{ item_id: string; quantity: string; reason: string }>) => {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  };

  const submit = async () => {
    const valid = rows.filter((r) => r.item_id && Number(r.quantity) > 0);
    if (valid.length === 0) return toast.error("Add at least one item with a quantity");
    if (!defaultLocationId) return toast.error("No stock location configured yet");
    setSaving(true);
    const { data: req, error } = await (supabase as any).from("material_requests").insert({
      organisation_id: orgId,
      work_order_id: wo.id,
      machine_id: wo.machine_id,
      requested_by: userId,
      status: "pending",
    }).select().single();
    if (error || !req) { setSaving(false); return toast.error(error?.message ?? "Failed"); }

    const itemRows = valid.map((r) => ({
      material_request_id: req.id,
      item_id: r.item_id,
      location_id: defaultLocationId,
      quantity_requested: Number(r.quantity),
      notes: r.reason || null,
    }));
    const { error: itemsErr } = await (supabase as any).from("material_request_items").insert(itemRows);
    setSaving(false);
    if (itemsErr) return toast.error(itemsErr.message);
    toast.success("Material request submitted");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Request parts</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-start gap-2">
                <select value={row.item_id} onChange={(e) => updateRow(i, { item_id: e.target.value })} className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select part…</option>
                  {items.map((it: any) => <option key={it.id} value={it.id}>{it.name}{it.part_number ? ` · ${it.part_number}` : ""}</option>)}
                </select>
                <Input type="number" min={1} value={row.quantity} onChange={(e) => updateRow(i, { quantity: e.target.value })} className="w-20" />
                {rows.length > 1 && (
                  <Button size="icon" variant="ghost" onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
              <Textarea rows={1} placeholder="Reason (optional)" value={row.reason} onChange={(e) => updateRow(i, { reason: e.target.value })} />
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setRows((r) => [...r, { item_id: "", quantity: "1", reason: "" }])}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add another part
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit request"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
