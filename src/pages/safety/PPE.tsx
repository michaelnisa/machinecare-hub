import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { HardHat, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

const CONDITIONS = ["new", "good", "fair", "worn", "damaged"];
const STATUSES = ["issued", "returned", "replaced", "expired"];
const STATUS_CLASS: Record<string, string> = {
  issued: "bg-blue-100 text-blue-700",
  returned: "bg-slate-100 text-slate-600",
  replaced: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-700",
};

export default function PPE() {
  const { profile, user } = useAuth();
  const { isManager } = useUserRole();
  const canManageRequirements = isManager || profile?.department === "safety";
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [defaultLocationId, setDefaultLocationId] = useState<string | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: pi }, { data: pr }, { data: profs }, { data: cw }, { data: inv }, { data: loc }] = await Promise.all([
      (supabase as any).from("ppe_issues").select("*, profiles:employee_id(full_name), contractor_workers(full_name, contractors(company_name))").order("issued_at", { ascending: false }),
      (supabase as any).from("ppe_requirements").select("*").order("activity"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
      (supabase as any).from("contractor_workers").select("id, full_name, contractors(company_name)").eq("is_active", true).order("full_name"),
      supabase.from("inventory_items").select("id, name, category").eq("category", "ppe").order("name"),
      (supabase as any).from("stock_locations").select("id").eq("is_default", true).maybeSingle(),
    ]);
    setIssues(pi ?? []);
    setRequirements(pr ?? []);
    setEmployees(profs ?? []);
    setWorkers(cw ?? []);
    setItems(inv ?? []);
    setDefaultLocationId(loc?.id ?? null);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const stats = useMemo(() => ({
    active: issues.filter((x) => x.status === "issued").length,
    expiringSoon: issues.filter((x) => x.status === "issued" && x.expiry_date && x.expiry_date <= in30 && x.expiry_date >= today).length,
    expired: issues.filter((x) => x.status === "issued" && x.expiry_date && x.expiry_date < today).length,
  }), [issues]);

  const holderName = (x: any) => x.profiles?.full_name ?? (x.contractor_workers ? `${x.contractor_workers.full_name} (${x.contractor_workers.contractors?.company_name ?? "contractor"})` : "—");

  const markStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "returned") patch.returned_at = new Date().toISOString();
    const { error } = await (supabase as any).from("ppe_issues").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">PPE management</h1>
          <p className="text-sm text-muted-foreground">Track PPE issued to employees and contractors, and define what's required by activity.</p>
        </div>
        <Button onClick={() => setIssueOpen(true)}><Plus className="mr-2 h-4 w-4" />Issue PPE</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Active issues", value: stats.active },
          { label: "Expiring ≤30 days", value: stats.expiringSoon, tone: stats.expiringSoon > 0 ? "text-amber-600" : "" },
          { label: "Expired", value: stats.expired, tone: stats.expired > 0 ? "text-red-600" : "" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className={`mt-1 text-2xl font-semibold ${s.tone ?? ""}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">PPE requirements by activity</h2>
          {canManageRequirements && (
            <Button size="sm" variant="outline" onClick={() => setReqOpen(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New requirement</Button>
          )}
        </div>
        {requirements.length === 0 ? (
          <p className="text-xs text-muted-foreground">No PPE requirements defined yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {requirements.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4">
                <div className="text-sm font-medium capitalize">{r.activity}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {r.required_ppe.map((p: string) => (
                    <span key={p} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">{p}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-foreground">Issued PPE</h2>
        {issues.length === 0 ? (
          <EmptyState icon={<HardHat className="h-5 w-5" />} title="No PPE issued yet" description="Issue PPE to employees or contractor workers." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Holder</th>
                  <th className="px-5 py-3 font-medium">PPE</th>
                  <th className="px-5 py-3 font-medium">Size</th>
                  <th className="px-5 py-3 font-medium">Condition</th>
                  <th className="px-5 py-3 font-medium">Issued</th>
                  <th className="px-5 py-3 font-medium">Expiry</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {issues.map((x) => {
                  const expired = x.status === "issued" && x.expiry_date && x.expiry_date < today;
                  return (
                    <tr key={x.id} className="border-t border-border">
                      <td className="px-5 py-3">{holderName(x)}</td>
                      <td className="px-5 py-3">{x.ppe_type}</td>
                      <td className="px-5 py-3 text-muted-foreground">{x.size ?? "—"}</td>
                      <td className="px-5 py-3 capitalize text-muted-foreground">{x.condition}</td>
                      <td className="px-5 py-3 text-muted-foreground">{formatDate(x.issued_at)}</td>
                      <td className="px-5 py-3 text-muted-foreground">{x.expiry_date ? formatDate(x.expiry_date) : "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${expired ? STATUS_CLASS.expired : STATUS_CLASS[x.status]}`}>
                          {expired ? "expired" : x.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {x.status === "issued" && (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => markStatus(x.id, "returned")}>Return</Button>
                            <Button size="sm" variant="outline" onClick={() => markStatus(x.id, "replaced")}>Replace</Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <IssuePpeDialog open={issueOpen} setOpen={setIssueOpen} employees={employees} workers={workers} items={items} userId={user?.id} orgId={profile?.organisation_id} defaultLocationId={defaultLocationId} onSaved={load} />
      <RequirementDialog open={reqOpen} setOpen={setReqOpen} userId={user?.id} orgId={profile?.organisation_id} onSaved={load} />
    </div>
  );
}

function IssuePpeDialog({ open, setOpen, employees, workers, items, userId, orgId, defaultLocationId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ holderType: "employee", holderId: "", ppe_type: "", size: "", quantity: 1, condition: "new", expiry_date: "", inventory_item_id: "" });

  useEffect(() => {
    if (open) setForm({ holderType: "employee", holderId: "", ppe_type: "", size: "", quantity: 1, condition: "new", expiry_date: "", inventory_item_id: "" });
  }, [open]);

  const submit = async () => {
    if (!form.holderId) return toast.error("Select who this PPE is for");
    if (!form.ppe_type.trim()) return toast.error("PPE type required");
    setSaving(true);
    const { error } = await (supabase as any).from("ppe_issues").insert({
      organisation_id: orgId,
      employee_id: form.holderType === "employee" ? form.holderId : null,
      contractor_worker_id: form.holderType === "contractor" ? form.holderId : null,
      inventory_item_id: form.inventory_item_id || null,
      ppe_type: form.ppe_type.trim(),
      size: form.size || null,
      quantity: Number(form.quantity) || 1,
      condition: form.condition,
      expiry_date: form.expiry_date || null,
      issued_by: userId,
    });
    if (!error && form.inventory_item_id && defaultLocationId) {
      const { error: stockErr } = await (supabase as any).rpc("record_stock_transaction", {
        _item_id: form.inventory_item_id,
        _location_id: defaultLocationId,
        _transaction_type: "issue",
        _quantity: -(Number(form.quantity) || 1),
        _reason: "PPE issued",
        _reference: `ppe:${form.ppe_type.trim()}`,
      });
      if (stockErr) toast.error(`PPE recorded, but stock wasn't deducted: ${stockErr.message}`);
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("PPE issued");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Issue PPE</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Issue to</Label>
              <select value={form.holderType} onChange={(e) => setForm({ ...form, holderType: e.target.value, holderId: "" })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="employee">Employee</option>
                <option value="contractor">Contractor worker</option>
              </select>
            </div>
            <div><Label>{form.holderType === "employee" ? "Employee" : "Worker"}</Label>
              <select value={form.holderId} onChange={(e) => setForm({ ...form, holderId: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select…</option>
                {(form.holderType === "employee" ? employees : workers).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.full_name}{p.contractors ? ` (${p.contractors.company_name})` : ""}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>PPE type *</Label><Input value={form.ppe_type} onChange={(e) => setForm({ ...form, ppe_type: e.target.value })} className="mt-1" placeholder="Helmet, Gloves, Safety shoes…" /></div>
            <div><Label>Size</Label><Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Quantity</Label><Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="mt-1" /></div>
            <div><Label>Condition</Label>
              <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><Label>Expiry date</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} className="mt-1" /></div>
          </div>
          {items.length > 0 && (
            <div><Label>Deduct from stock (optional)</Label>
              <select value={form.inventory_item_id} onChange={(e) => setForm({ ...form, inventory_item_id: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">— No stock link —</option>
                {items.map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Issue"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequirementDialog({ open, setOpen, userId, orgId, onSaved }: any) {
  const [activity, setActivity] = useState("");
  const [ppeText, setPpeText] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!activity.trim()) return toast.error("Activity required");
    const list = ppeText.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) return toast.error("Add at least one PPE item");
    setSaving(true);
    const { error } = await (supabase as any).from("ppe_requirements").insert({
      organisation_id: orgId, activity: activity.trim(), required_ppe: list, created_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Requirement added");
    setOpen(false);
    setActivity(""); setPpeText("");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New PPE requirement</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Activity *</Label><Input value={activity} onChange={(e) => setActivity(e.target.value)} className="mt-1" placeholder="e.g. Hot Work" /></div>
          <div><Label>Required PPE (comma-separated) *</Label><Input value={ppeText} onChange={(e) => setPpeText(e.target.value)} className="mt-1" placeholder="Helmet, Welding shield, Gloves, Fire-resistant clothing" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
