import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { FileText, Upload, Trash2, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { differenceInDays, parseISO } from "date-fns";

const DOC_CATEGORIES = ["insurance", "registration", "inspection", "manual", "receipt", "other"];

function expiryStatus(expires_on?: string | null, reminder_days = 30): "ok" | "due_soon" | "overdue" | "none" {
  if (!expires_on) return "none";
  const days = differenceInDays(parseISO(expires_on), new Date());
  if (days < 0) return "overdue";
  if (days <= reminder_days) return "due_soon";
  return "ok";
}

export default function Documents() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<any[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string }[]>([]);
  const [filter, setFilter] = useState<"all" | "expiring">("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: d }, { data: m }] = await Promise.all([
      supabase.from("documents").select("*, machines(name)").order("expires_on", { ascending: true, nullsFirst: false }),
      supabase.from("machines").select("id, name").order("name"),
    ]);
    setDocs(d ?? []);
    setMachines(m ?? []);
    setLoading(false);
  };
  useEffect(() => { if (profile) load(); }, [profile]);

  const enriched = useMemo(
    () => docs.map((d) => ({ ...d, _status: expiryStatus(d.expires_on, d.reminder_days) })),
    [docs],
  );

  const filtered = useMemo(() => {
    if (filter === "expiring") return enriched.filter((d) => d._status === "due_soon" || d._status === "overdue");
    return enriched;
  }, [enriched, filter]);

  const expiring = enriched.filter((d) => d._status === "due_soon" || d._status === "overdue").length;

  const handleDelete = async () => {
    if (!confirm) return;
    const { error } = await supabase.from("documents").delete().eq("id", confirm);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setConfirm(null);
    load();
  };

  const openDoc = async (file_url: string) => {
    try {
      const marker = "/machine-docs/";
      const idx = file_url.indexOf(marker);
      const path = idx >= 0 ? file_url.substring(idx + marker.length).split("?")[0] : file_url;
      const { data, error } = await supabase.storage.from("machine-docs").createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) throw error ?? new Error("Could not create signed URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to open document");
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">Insurance, registration and certificates with expiry tracking.</p>
        </div>
        <div className="flex gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">All documents</option>
            <option value="expiring">Expiring & overdue</option>
          </select>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Upload className="mr-2 h-4 w-4" /> Upload document
          </Button>
        </div>
      </div>

      {expiring > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          {expiring} {expiring === 1 ? "document is" : "documents are"} expiring soon or overdue.
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={<FileText className="h-5 w-5" />} title="No documents" description="Upload insurance, registration, or inspection certificates here." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Document</th>
                <th className="px-5 py-3 font-medium">Machine</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Issuer</th>
                <th className="px-5 py-3 font-medium">Expires</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    <button type="button" onClick={() => openDoc(d.file_url)} className="font-medium text-primary hover:underline inline-flex items-center gap-1">
                      {d.name} <ExternalLink className="h-3 w-3" />
                    </button>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{d.machines?.name ?? "—"}</td>
                  <td className="px-5 py-3 capitalize">{d.doc_category ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{d.issuer ?? "—"}</td>
                  <td className="px-5 py-3">{d.expires_on ? formatDate(d.expires_on) : "—"}</td>
                  <td className="px-5 py-3">
                    {d._status === "overdue" && <span className="status-pill status-overdue">Expired</span>}
                    {d._status === "due_soon" && <span className="status-pill status-due">Expiring soon</span>}
                    {d._status === "ok" && <span className="status-pill status-ok">Valid</span>}
                    {d._status === "none" && <span className="text-xs text-muted-foreground">No expiry</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(d); setOpen(true); }}>
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setConfirm(d.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DocDialog open={open} onOpenChange={setOpen} doc={editing} machines={machines} orgId={profile?.organisation_id} onSaved={load} />
      <ConfirmDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)} title="Delete this document?" description="This cannot be undone." onConfirm={async () => { await handleDelete(); }} />
    </div>
  );
}

function DocDialog({ open, onOpenChange, doc, machines, orgId, onSaved }: any) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({});
  const [file, setFile] = useState<File | null>(null);
  const isEdit = !!doc;

  useEffect(() => {
    if (open) {
      setForm(doc ?? {
        machine_id: "", name: "", doc_category: "insurance", issuer: "",
        issued_on: "", expires_on: "", reminder_days: 30,
      });
      setFile(null);
    }
  }, [open, doc]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.machine_id) return toast.error("Pick a machine");
    if (!isEdit && !file) return toast.error("Choose a file to upload");
    setSubmitting(true);
    try {
      let file_url = doc?.file_url;
      let file_type = doc?.file_type;
      let name = form.name?.trim();
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${orgId}/documents/${form.machine_id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("machine-docs").upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("machine-docs").getPublicUrl(path);
        file_url = pub.publicUrl;
        file_type = file.type.startsWith("image/") ? "image" : file.type === "application/pdf" ? "pdf" : "document";
        if (!name) name = file.name;
      }

      const payload: any = {
        machine_id: form.machine_id,
        name: name || "Document",
        file_url,
        file_type,
        doc_category: form.doc_category || null,
        issuer: form.issuer || null,
        issued_on: form.issued_on || null,
        expires_on: form.expires_on || null,
        reminder_days: Number(form.reminder_days) || 30,
      };

      const { error } = isEdit
        ? await supabase.from("documents").update(payload).eq("id", doc.id)
        : await supabase.from("documents").insert(payload);
      if (error) throw error;
      toast.success(isEdit ? "Updated" : "Uploaded");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{isEdit ? "Edit document" : "Upload document"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Machine *</Label>
              <select value={form.machine_id ?? ""} onChange={(e) => setForm({ ...form, machine_id: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select machine</option>
                {machines.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <select value={form.doc_category ?? "insurance"} onChange={(e) => setForm({ ...form, doc_category: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Document name</Label>
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Insurance certificate 2026" />
            </div>
            <div className="space-y-1.5">
              <Label>Issuer</Label>
              <Input value={form.issuer ?? ""} onChange={(e) => setForm({ ...form, issuer: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Issued on</Label>
              <Input type="date" value={form.issued_on ?? ""} onChange={(e) => setForm({ ...form, issued_on: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Expires on</Label>
              <Input type="date" value={form.expires_on ?? ""} onChange={(e) => setForm({ ...form, expires_on: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Remind me (days before)</Label>
              <Input type="number" value={form.reminder_days ?? 30} onChange={(e) => setForm({ ...form, reminder_days: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{isEdit ? "Replace file (optional)" : "File *"}</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
