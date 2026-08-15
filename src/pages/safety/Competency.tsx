import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { GraduationCap, Plus, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export default function Competency() {
  const { profile, user } = useAuth();
  const { isManager } = useUserRole();
  const canManage = isManager || profile?.department === "safety";
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: r }, { data: e }] = await Promise.all([
      (supabase as any).from("employee_competencies").select("*, profiles:employee_id(full_name)").order("expiry_date", { ascending: true, nullsFirst: false }),
      supabase.from("profiles").select("id, full_name").eq("organisation_id", profile.organisation_id).order("full_name"),
    ]);
    setRecords(r ?? []);
    setEmployees(e ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const status = (r: any) => {
    if (r.status === "revoked") return "revoked";
    if (r.expiry_date && r.expiry_date < today) return "expired";
    if (r.expiry_date && r.expiry_date <= in30) return "expiring";
    return "valid";
  };
  const STATUS_CLASS: Record<string, string> = {
    valid: "bg-emerald-100 text-emerald-700",
    expiring: "bg-amber-100 text-amber-700",
    expired: "bg-red-100 text-red-700",
    revoked: "bg-slate-100 text-slate-600",
  };

  const stats = useMemo(() => ({
    valid: records.filter((r) => status(r) === "valid").length,
    expiring: records.filter((r) => status(r) === "expiring").length,
    expired: records.filter((r) => status(r) === "expired").length,
  }), [records]);

  const revoke = async (id: string) => {
    const { error } = await (supabase as any).from("employee_competencies").update({ status: "revoked" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Revoked");
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Training &amp; competency</h1>
          <p className="text-sm text-muted-foreground">Certifications required before someone is authorized for a restricted activity.</p>
        </div>
        {canManage && <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Add competency</Button>}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Valid", value: stats.valid },
          { label: "Expiring ≤30 days", value: stats.expiring, tone: stats.expiring > 0 ? "text-amber-600" : "" },
          { label: "Expired", value: stats.expired, tone: stats.expired > 0 ? "text-red-600" : "" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className={`mt-1 text-2xl font-semibold ${s.tone ?? ""}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {records.length === 0 ? (
        <EmptyState icon={<GraduationCap className="h-5 w-5" />} title="No competency records" description="Add certifications so work orders can check who's authorized." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="px-5 py-3 font-medium">Competency</th>
                <th className="px-5 py-3 font-medium">Certificate #</th>
                <th className="px-5 py-3 font-medium">Issued</th>
                <th className="px-5 py-3 font-medium">Expires</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-5 py-3">{r.profiles?.full_name ?? "—"}</td>
                  <td className="px-5 py-3">{r.competency_name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.certificate_number ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.issued_on ? formatDate(r.issued_on) : "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.expiry_date ? formatDate(r.expiry_date) : "—"}</td>
                  <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_CLASS[status(r)]}`}>{status(r)}</span></td>
                  <td className="px-5 py-3 text-right">
                    {canManage && r.status !== "revoked" && (
                      <Button size="sm" variant="ghost" onClick={() => revoke(r.id)} className="gap-1 text-muted-foreground">
                        <XCircle className="h-3.5 w-3.5" /> Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewCompetencyDialog open={open} setOpen={setOpen} employees={employees} userId={user?.id} orgId={profile?.organisation_id} onSaved={load} />
    </div>
  );
}

function NewCompetencyDialog({ open, setOpen, employees, userId, orgId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ employee_id: "", competency_name: "", certificate_number: "", issued_on: "", expiry_date: "" });

  useEffect(() => { if (open) setForm({ employee_id: "", competency_name: "", certificate_number: "", issued_on: "", expiry_date: "" }); }, [open]);

  const submit = async () => {
    if (!form.employee_id) return toast.error("Select an employee");
    if (!form.competency_name.trim()) return toast.error("Competency name required");
    setSaving(true);
    const { error } = await (supabase as any).from("employee_competencies").insert({
      organisation_id: orgId,
      employee_id: form.employee_id,
      competency_name: form.competency_name.trim(),
      certificate_number: form.certificate_number || null,
      issued_on: form.issued_on || null,
      expiry_date: form.expiry_date || null,
      issued_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Competency added");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add competency</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Employee *</Label>
            <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select…</option>
              {employees.map((e: any) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
          <div><Label>Competency *</Label><Input value={form.competency_name} onChange={(e) => setForm({ ...form, competency_name: e.target.value })} className="mt-1" placeholder="e.g. LOTO, Electrical Safety, Forklift" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Certificate #</Label><Input value={form.certificate_number} onChange={(e) => setForm({ ...form, certificate_number: e.target.value })} className="mt-1" /></div>
            <div><Label>Issued on</Label><Input type="date" value={form.issued_on} onChange={(e) => setForm({ ...form, issued_on: e.target.value })} className="mt-1" /></div>
          </div>
          <div><Label>Expiry date</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
