import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Building2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { Link } from "react-router-dom";

export default function Contractors() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contractors, setContractors] = useState<any[]>([]);
  const [workerCounts, setWorkerCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await (supabase as any).from("contractors").select("*").order("company_name");
    if (error) toast.error(error.message);
    setContractors(data ?? []);
    if (data?.length) {
      const { data: workers } = await (supabase as any).from("contractor_workers").select("contractor_id").eq("is_active", true);
      const counts: Record<string, number> = {};
      (workers ?? []).forEach((w: any) => { counts[w.contractor_id] = (counts[w.contractor_id] ?? 0) + 1; });
      setWorkerCounts(counts);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const today = new Date().toISOString().slice(0, 10);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contractors</h1>
          <p className="text-sm text-muted-foreground">Companies and workers doing work on site — induction, documents and permit history.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />New contractor</Button>
      </div>

      {contractors.length === 0 ? (
        <EmptyState icon={<Building2 className="h-5 w-5" />} title="No contractors yet" description="Add a contractor company to start tracking their workers and documents." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contractors.map((c) => {
            const insuranceExpired = c.insurance_expiry && c.insurance_expiry < today;
            return (
              <Link key={c.id} to={`/safety/contractors/${c.id}`} className="rounded-xl border border-border bg-card p-4 hover:border-primary/50">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{c.company_name}</div>
                  <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${c.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{c.status}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{c.contact_name ?? "No contact set"}</div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{workerCounts[c.id] ?? 0} workers</span>
                  {c.insurance_expiry && (
                    <span className={insuranceExpired ? "text-red-600" : "text-muted-foreground"}>
                      Insurance {insuranceExpired ? "expired" : "to"} {formatDate(c.insurance_expiry)}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <NewContractorDialog open={open} setOpen={setOpen} userId={user?.id} orgId={profile?.organisation_id} onSaved={load} />
    </div>
  );
}

function NewContractorDialog({ open, setOpen, userId, orgId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ company_name: "", contact_name: "", contact_phone: "", contact_email: "", insurance_expiry: "", notes: "" });

  const submit = async () => {
    if (!form.company_name.trim()) return toast.error("Company name required");
    setSaving(true);
    const { error } = await (supabase as any).from("contractors").insert({
      organisation_id: orgId,
      company_name: form.company_name.trim(),
      contact_name: form.contact_name || null,
      contact_phone: form.contact_phone || null,
      contact_email: form.contact_email || null,
      insurance_expiry: form.insurance_expiry || null,
      notes: form.notes || null,
      created_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Contractor added");
    setOpen(false);
    setForm({ company_name: "", contact_name: "", contact_phone: "", contact_email: "", insurance_expiry: "", notes: "" });
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New contractor</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Company name *</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Contact name</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="mt-1" /></div>
            <div><Label>Contact phone</Label><Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Contact email</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className="mt-1" /></div>
            <div><Label>Insurance expiry</Label><Input type="date" value={form.insurance_expiry} onChange={(e) => setForm({ ...form, insurance_expiry: e.target.value })} className="mt-1" /></div>
          </div>
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
