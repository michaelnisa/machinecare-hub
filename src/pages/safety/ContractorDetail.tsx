import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ArrowLeft, Plus, Loader2, Users, FileText, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { formatWoNumber } from "@/components/WorkOrderPreview";

const DOC_TYPES = ["insurance", "certificate", "licence", "other"];

export default function ContractorDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contractor, setContractor] = useState<any>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [inductionStatus, setInductionStatus] = useState<Record<string, any>>({});
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [workerOpen, setWorkerOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);

  const load = async () => {
    if (!profile || !id) return;
    setLoading(true);
    const [{ data: c }, { data: w }, { data: d }, { data: wo }] = await Promise.all([
      (supabase as any).from("contractors").select("*").eq("id", id).single(),
      (supabase as any).from("contractor_workers").select("*, inductees(id, full_name)").eq("contractor_id", id).order("full_name"),
      (supabase as any).from("contractor_documents").select("*").eq("contractor_id", id).order("expires_on", { ascending: true, nullsFirst: false }),
      (supabase as any).from("work_orders").select("id, title, wo_number, wo_year, status").eq("contractor_id", id).order("created_at", { ascending: false }),
    ]);
    setContractor(c ?? null);
    setWorkers(w ?? []);
    setDocuments(d ?? []);
    setWorkOrders(wo ?? []);

    const inducteeIds = (w ?? []).map((x: any) => x.inductee_id).filter(Boolean);
    if (inducteeIds.length) {
      const { data: records } = await (supabase as any)
        .from("induction_records")
        .select("inductee_id, status, expires_at")
        .in("inductee_id", inducteeIds)
        .order("completed_at", { ascending: false });
      const map: Record<string, any> = {};
      (records ?? []).forEach((r: any) => { if (!map[r.inductee_id]) map[r.inductee_id] = r; });
      setInductionStatus(map);
    } else {
      setInductionStatus({});
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile, id]);

  const today = new Date().toISOString().slice(0, 10);
  const readiness = (workerId: string) => {
    const w = workers.find((x) => x.id === workerId);
    if (!w?.inductee_id) return { ok: false, label: "No induction linked" };
    const rec = inductionStatus[w.inductee_id];
    if (!rec || rec.status !== "completed") return { ok: false, label: "Induction not completed" };
    if (rec.expires_at && rec.expires_at < new Date().toISOString()) return { ok: false, label: "Induction expired" };
    return { ok: true, label: "Induction current" };
  };

  const insuranceExpired = contractor?.insurance_expiry && contractor.insurance_expiry < today;

  if (loading) return <PageLoader />;
  if (!contractor) return <EmptyState icon={<Users className="h-5 w-5" />} title="Contractor not found" description="" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/safety/contractors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Contractors
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{contractor.company_name}</h1>
          <p className="text-sm text-muted-foreground">{contractor.contact_name}{contractor.contact_phone && ` · ${contractor.contact_phone}`}{contractor.contact_email && ` · ${contractor.contact_email}`}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs capitalize ${contractor.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{contractor.status}</span>
      </div>

      {insuranceExpired && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">
          Insurance expired on {formatDate(contractor.insurance_expiry)} — this contractor should not be authorized for new work until renewed.
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Workers</h2>
          <Button size="sm" variant="outline" onClick={() => setWorkerOpen(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />Add worker</Button>
        </div>
        {workers.length === 0 ? (
          <p className="text-xs text-muted-foreground">No workers added yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">ID number</th>
                  <th className="px-5 py-3 font-medium">Readiness</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => {
                  const r = readiness(w.id);
                  return (
                    <tr key={w.id} className="border-t border-border">
                      <td className="px-5 py-3">{w.full_name}</td>
                      <td className="px-5 py-3 text-muted-foreground">{w.role_title ?? "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{w.id_number ?? "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${r.ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {r.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} {r.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Documents</h2>
          <Button size="sm" variant="outline" onClick={() => setDocOpen(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />Add document</Button>
        </div>
        {documents.length === 0 ? (
          <p className="text-xs text-muted-foreground">No documents on file.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((d) => {
              const expired = d.expires_on && d.expires_on < today;
              return (
                <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{d.name}</div>
                    <div className="text-xs capitalize text-muted-foreground">{d.doc_type}{d.expires_on && ` · expires ${formatDate(d.expires_on)}`}</div>
                  </div>
                  {expired && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">expired</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-foreground">Work order / permit history</h2>
        {workOrders.length === 0 ? (
          <p className="text-xs text-muted-foreground">No work orders linked to this contractor yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Work order</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((w) => (
                  <tr key={w.id} className="border-t border-border">
                    <td className="px-5 py-3">
                      <Link to={`/work-orders/${w.id}`} className="text-primary hover:underline">{formatWoNumber(w.wo_year, w.wo_number)} — {w.title}</Link>
                    </td>
                    <td className="px-5 py-3 capitalize text-muted-foreground">{w.status?.replace(/_/g, " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddWorkerDialog open={workerOpen} setOpen={setWorkerOpen} contractorId={id} orgId={profile?.organisation_id} onSaved={load} />
      <AddDocumentDialog open={docOpen} setOpen={setDocOpen} contractorId={id} orgId={profile?.organisation_id} onSaved={load} />
    </div>
  );
}

function AddWorkerDialog({ open, setOpen, contractorId, orgId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [inductees, setInductees] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ full_name: "", id_number: "", role_title: "", phone: "", inductee_id: "" });

  useEffect(() => {
    if (open) {
      setForm({ full_name: "", id_number: "", role_title: "", phone: "", inductee_id: "" });
      supabase.from("inductees").select("id, full_name").eq("inductee_type", "contractor").order("full_name").then(({ data }) => setInductees(data ?? []));
    }
  }, [open]);

  const submit = async () => {
    if (!form.full_name.trim()) return toast.error("Name required");
    setSaving(true);
    const { error } = await (supabase as any).from("contractor_workers").insert({
      organisation_id: orgId,
      contractor_id: contractorId,
      full_name: form.full_name.trim(),
      id_number: form.id_number || null,
      role_title: form.role_title || null,
      phone: form.phone || null,
      inductee_id: form.inductee_id || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Worker added");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add worker</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Full name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>ID number</Label><Input value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} className="mt-1" /></div>
            <div><Label>Role</Label><Input value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} className="mt-1" /></div>
          </div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" /></div>
          <div>
            <Label>Linked induction record</Label>
            <select value={form.inductee_id} onChange={(e) => setForm({ ...form, inductee_id: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">— Not linked —</option>
              {inductees.map((i) => <option key={i.id} value={i.id}>{i.full_name}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Add this person as an inductee (type "contractor") on the Induction page first, then link them here to show their induction status.
            </p>
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

function AddDocumentDialog({ open, setOpen, contractorId, orgId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ doc_type: "insurance", name: "", issued_on: "", expires_on: "" });

  useEffect(() => { if (open) setForm({ doc_type: "insurance", name: "", issued_on: "", expires_on: "" }); }, [open]);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Document name required");
    setSaving(true);
    const { error } = await (supabase as any).from("contractor_documents").insert({
      organisation_id: orgId,
      contractor_id: contractorId,
      doc_type: form.doc_type,
      name: form.name.trim(),
      issued_on: form.issued_on || null,
      expires_on: form.expires_on || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Document added");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add document</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" placeholder="e.g. Public liability insurance" /></div>
          <div><Label>Type</Label>
            <select value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Issued on</Label><Input type="date" value={form.issued_on} onChange={(e) => setForm({ ...form, issued_on: e.target.value })} className="mt-1" /></div>
            <div><Label>Expires on</Label><Input type="date" value={form.expires_on} onChange={(e) => setForm({ ...form, expires_on: e.target.value })} className="mt-1" /></div>
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
