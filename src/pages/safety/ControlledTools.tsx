import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Wrench, Plus, Loader2, CheckCircle2, XCircle, Gauge } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { formatDate } from "@/lib/format";

const TYPES = ["welding", "electrical_tester", "gas_equipment", "torque_wrench", "lifting_equipment", "confined_space_equipment", "other"];
const STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  issued: "bg-emerald-100 text-emerald-700",
  returned: "bg-slate-100 text-slate-600",
};
const TOOL_STATUS_CLASS: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-700",
  issued: "bg-blue-100 text-blue-700",
  reserved: "bg-indigo-100 text-indigo-700",
  under_maintenance: "bg-amber-100 text-amber-700",
  under_calibration: "bg-amber-100 text-amber-700",
  lost: "bg-red-100 text-red-700",
  damaged: "bg-red-100 text-red-700",
  retired: "bg-slate-100 text-slate-600",
};

function calibrationBadge(dueDate: string | null) {
  if (!dueDate) return null;
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: `Calibration expired ${formatDate(dueDate)}`, cls: "bg-red-100 text-red-700" };
  if (days <= 7) return { label: `Calibration due in ${days}d`, cls: "bg-red-100 text-red-700" };
  if (days <= 14) return { label: `Calibration due in ${days}d`, cls: "bg-amber-100 text-amber-700" };
  if (days <= 30) return { label: `Calibration due in ${days}d`, cls: "bg-amber-100 text-amber-700" };
  return { label: `Calibration due ${formatDate(dueDate)}`, cls: "bg-muted text-muted-foreground" };
}

export default function ControlledTools() {
  const { profile, user } = useAuth();
  const { isManager } = useUserRole();
  const canReview = isManager || profile?.department === "safety";
  const [loading, setLoading] = useState(true);
  const [tools, setTools] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [requestTarget, setRequestTarget] = useState<any>(null);
  const [calibrationTarget, setCalibrationTarget] = useState<any>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: t }, { data: r }] = await Promise.all([
      (supabase as any).from("controlled_tools").select("*").order("name"),
      (supabase as any).from("controlled_tool_requests").select("*, controlled_tools(name)").order("created_at", { ascending: false }).limit(50),
    ]);
    setTools(t ?? []);
    setRequests(r ?? []);
    const ids = [...new Set([...(r ?? []).flatMap((x: any) => [x.requested_by, x.reviewed_by, x.issued_by]), ...(t ?? []).map((x: any) => x.assigned_to)].filter(Boolean))] as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { map[p.id] = p.full_name ?? "—"; });
      setNames(map);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const pending = requests.filter((r) => r.status === "pending");

  const review = async (id: string, status: "approved" | "rejected") => {
    const { error } = await (supabase as any).from("controlled_tool_requests").update({
      status, reviewed_by: profile?.id, reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Approved" : "Rejected");
    load();
  };

  const issue = async (id: string) => {
    const { error } = await (supabase as any).from("controlled_tool_requests").update({
      status: "issued", issued_by: profile?.id, issued_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Tool issued");
    load();
  };

  const acknowledge = async (id: string) => {
    const { error } = await (supabase as any).from("controlled_tool_requests").update({ acknowledged_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Acknowledged");
    load();
  };

  const returnTool = async (id: string, condition: string) => {
    const { error } = await (supabase as any).from("controlled_tool_requests").update({
      status: "returned", returned_at: new Date().toISOString(), condition_on_return: condition,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Returned");
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Controlled tools</h1>
          <p className="text-sm text-muted-foreground">Welding sets, testers, lifting gear — issued only after Safety approval and (if required) valid certification.</p>
        </div>
        {canReview && <Button onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />Add tool</Button>}
      </div>

      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="mb-3 text-sm font-semibold text-amber-900">Pending requests ({pending.length})</div>
          <div className="space-y-2">
            {pending.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white p-3 text-sm">
                <div>
                  <span className="font-medium">{r.controlled_tools?.name}</span>
                  <span className="text-muted-foreground"> — requested by {names[r.requested_by] ?? "—"} {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                </div>
                {canReview && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => review(r.id, "approved")} className="gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => review(r.id, "rejected")} className="gap-1.5"><XCircle className="h-3.5 w-3.5" /> Reject</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium text-foreground">Tools</h2>
        {tools.length === 0 ? (
          <EmptyState icon={<Wrench className="h-5 w-5" />} title="No controlled tools yet" description="Add welding sets, testers, or lifting equipment that need Safety approval before use." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((t) => {
              const cal = calibrationBadge(t.calibration_due_date);
              return (
                <div key={t.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{t.name}</div>
                      {(t.manufacturer || t.model) && <div className="text-xs text-muted-foreground">{[t.manufacturer, t.model].filter(Boolean).join(" · ")}</div>}
                      {t.serial_number && <div className="text-xs text-muted-foreground">S/N {t.serial_number}</div>}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs capitalize ${TOOL_STATUS_CLASS[t.status]}`}>{t.status.replace(/_/g, " ")}</span>
                  </div>
                  <div className="mt-1 text-xs capitalize text-muted-foreground">{t.tool_type.replace(/_/g, " ")}{t.location && ` · ${t.location}`}</div>
                  {t.assigned_to && <div className="mt-1 text-xs text-muted-foreground">Held by {names[t.assigned_to] ?? "—"}</div>}
                  {t.requires_certification && <div className="mt-1 text-xs text-amber-700">Requires: {t.requires_certification}</div>}
                  {cal && <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${cal.cls}`}>{cal.label}</span>}
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setRequestTarget(t)} disabled={t.status !== "available"}>Request</Button>
                    {canReview && (
                      <Button size="sm" variant="outline" onClick={() => setCalibrationTarget(t)} className="gap-1.5"><Gauge className="h-3.5 w-3.5" /> Log calibration</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-foreground">Recent requests</h2>
        {requests.length === 0 ? (
          <p className="text-xs text-muted-foreground">No requests yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Tool</th>
                  <th className="px-5 py-3 font-medium">Requested by</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-5 py-3">{r.controlled_tools?.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{names[r.requested_by] ?? "—"}</td>
                    <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_CLASS[r.status]}`}>{r.status}</span></td>
                    <td className="px-5 py-3 text-right">
                      {r.status === "approved" && canReview && <Button size="sm" onClick={() => issue(r.id)}>Issue</Button>}
                      {r.status === "issued" && !r.acknowledged_at && r.requested_by === profile?.id && <Button size="sm" variant="outline" onClick={() => acknowledge(r.id)}>Acknowledge receipt</Button>}
                      {r.status === "issued" && (canReview || r.requested_by === profile?.id) && (
                        <Button size="sm" variant="outline" onClick={() => returnTool(r.id, "good")}>Mark returned</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddToolDialog open={addOpen} setOpen={setAddOpen} userId={user?.id} orgId={profile?.organisation_id} onSaved={load} />
      <RequestToolDialog target={requestTarget} onClose={() => setRequestTarget(null)} userId={user?.id} onSaved={load} />
      <CalibrationDialog target={calibrationTarget} onClose={() => setCalibrationTarget(null)} orgId={profile?.organisation_id} userId={user?.id} onSaved={load} />
    </div>
  );
}

function AddToolDialog({ open, setOpen, userId, orgId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ name: "", tool_type: "other", asset_tag: "", serial_number: "", manufacturer: "", model: "", requires_certification: "", requires_safety_approval: true, calibration_due_date: "", location: "" });

  useEffect(() => { if (open) setForm({ name: "", tool_type: "other", asset_tag: "", serial_number: "", manufacturer: "", model: "", requires_certification: "", requires_safety_approval: true, calibration_due_date: "", location: "" }); }, [open]);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    setSaving(true);
    const { error } = await (supabase as any).from("controlled_tools").insert({
      organisation_id: orgId,
      name: form.name.trim(),
      tool_type: form.tool_type,
      asset_tag: form.asset_tag || null,
      serial_number: form.serial_number || null,
      manufacturer: form.manufacturer || null,
      model: form.model || null,
      requires_certification: form.requires_certification || null,
      requires_safety_approval: !!form.requires_safety_approval,
      calibration_due_date: form.calibration_due_date || null,
      location: form.location || null,
      created_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Tool added");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add controlled tool</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Type</Label>
              <select value={form.tool_type} onChange={(e) => setForm({ ...form, tool_type: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div><Label>Asset tag</Label><Input value={form.asset_tag} onChange={(e) => setForm({ ...form, asset_tag: e.target.value })} className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Serial number</Label><Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} className="mt-1" /></div>
            <div><Label>Manufacturer</Label><Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} className="mt-1" /></div>
            <div><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="mt-1" /></div>
          </div>
          <div><Label>Requires certification (optional)</Label><Input value={form.requires_certification} onChange={(e) => setForm({ ...form, requires_certification: e.target.value })} className="mt-1" placeholder="Must match a competency name exactly, e.g. Welding" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Calibration due</Label><Input type="date" value={form.calibration_due_date} onChange={(e) => setForm({ ...form, calibration_due_date: e.target.value })} className="mt-1" /></div>
            <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestToolDialog({ target, onClose, userId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => { if (target) setNote(""); }, [target]);
  if (!target) return null;

  const submit = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from("controlled_tool_requests").insert({
      organisation_id: target.organisation_id,
      tool_id: target.id,
      requested_by: userId,
      status: "pending",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Request submitted");
    onClose();
    onSaved();
  };

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Request — {target.name}</DialogTitle></DialogHeader>
        {target.requires_certification && (
          <p className="text-xs text-amber-700">This tool requires the "{target.requires_certification}" competency to be approved.</p>
        )}
        <Textarea rows={2} placeholder="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CalibrationDialog({ target, onClose, orgId, userId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ calibrated_on: new Date().toISOString().slice(0, 10), next_due: "", calibrated_by: "", notes: "" });

  useEffect(() => { if (target) setForm({ calibrated_on: new Date().toISOString().slice(0, 10), next_due: "", calibrated_by: "", notes: "" }); }, [target]);
  if (!target) return null;

  const submit = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from("calibration_logs").insert({
      organisation_id: orgId,
      tool_id: target.id,
      calibrated_on: form.calibrated_on,
      next_due: form.next_due || null,
      calibrated_by: form.calibrated_by || null,
      notes: form.notes || null,
      created_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Calibration logged");
    onClose();
    onSaved();
  };

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Log calibration — {target.name}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Calibrated on</Label><Input type="date" value={form.calibrated_on} onChange={(e) => setForm({ ...form, calibrated_on: e.target.value })} className="mt-1" /></div>
            <div><Label>Next due</Label><Input type="date" value={form.next_due} onChange={(e) => setForm({ ...form, next_due: e.target.value })} className="mt-1" /></div>
          </div>
          <div><Label>Calibrated by</Label><Input value={form.calibrated_by} onChange={(e) => setForm({ ...form, calibrated_by: e.target.value })} className="mt-1" placeholder="External calibration house or technician" /></div>
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
