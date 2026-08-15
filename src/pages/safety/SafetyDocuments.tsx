import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { BookOpen, Plus, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

const CATEGORIES = ["policy", "procedure", "sop", "emergency_plan", "permit_template", "manual", "knowledge_article", "other"];
const STATUS_CLASS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  under_review: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-700",
  archived: "bg-slate-100 text-slate-600",
};

export default function SafetyDocuments() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<any[]>([]);
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await (supabase as any).from("safety_documents").select("*, machines(name), profiles:owner(full_name)").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setDocs(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const filtered = useMemo(() => category === "all" ? docs : docs.filter((d) => d.category === category), [docs, category]);

  const openDoc = async (file_url: string) => {
    try {
      const marker = "/machine-docs/";
      const idx = file_url.indexOf(marker);
      const path = idx >= 0 ? file_url.substring(idx + marker.length).split("?")[0] : file_url;
      const { data, error } = await supabase.storage.from("machine-docs").createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) throw error ?? new Error("Could not open document");
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
          <h1 className="text-2xl font-semibold tracking-tight">Safety documents &amp; knowledge</h1>
          <p className="text-sm text-muted-foreground">Policies, SOPs, emergency plans, permit templates and practical knowledge articles.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />New document</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", ...CATEGORIES].map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${category === c ? "bg-primary text-primary-foreground" : "border-border bg-card"}`}>
            {c.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-5 w-5" />} title="No documents yet" description="Upload an SOP or write a knowledge article." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <div key={d.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium">{d.title}</div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_CLASS[d.status]}`}>{d.status.replace(/_/g, " ")}</span>
              </div>
              <div className="mt-1 text-xs capitalize text-muted-foreground">
                {d.category.replace(/_/g, " ")}{d.version && ` · v${d.version}`}{d.machines && ` · ${d.machines.name}`}
              </div>
              {d.content && <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{d.content}</p>}
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{d.owner ? `Owner: ${d.profiles?.full_name}` : ""}{d.review_date && ` · review ${formatDate(d.review_date)}`}</span>
                {d.file_url && (
                  <button onClick={() => openDoc(d.file_url)} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> Open
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewDocDialog open={open} setOpen={setOpen} userId={user?.id} orgId={profile?.organisation_id} onSaved={load} />
    </div>
  );
}

function NewDocDialog({ open, setOpen, userId, orgId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<any>({ title: "", category: "sop", version: "", content: "", review_date: "", expiry_date: "" });

  useEffect(() => { if (open) { setForm({ title: "", category: "sop", version: "", content: "", review_date: "", expiry_date: "" }); setFile(null); } }, [open]);

  const submit = async () => {
    if (!form.title.trim()) return toast.error("Title required");
    setSaving(true);
    try {
      let file_url: string | null = null;
      let file_type: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${orgId}/safety-documents/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("machine-docs").upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("machine-docs").getPublicUrl(path);
        file_url = pub.publicUrl;
        file_type = file.type.startsWith("image/") ? "image" : file.type === "application/pdf" ? "pdf" : "document";
      }
      const { error } = await (supabase as any).from("safety_documents").insert({
        organisation_id: orgId,
        title: form.title.trim(),
        category: form.category,
        version: form.version || null,
        content: form.content || null,
        file_url,
        file_type,
        owner: userId,
        review_date: form.review_date || null,
        expiry_date: form.expiry_date || null,
        uploaded_by: userId,
      });
      if (error) throw error;
      toast.success("Document saved");
      setOpen(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New safety document</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Category</Label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div><Label>Version</Label><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className="mt-1" placeholder="e.g. 1.2" /></div>
          </div>
          <div><Label>Article content (for knowledge articles / notes)</Label>
            <Textarea rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="mt-1" placeholder={"Symptom, causes, PPE required, steps, escalation…"} />
          </div>
          <div><Label>Attach file (optional)</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Review date</Label><Input type="date" value={form.review_date} onChange={(e) => setForm({ ...form, review_date: e.target.value })} className="mt-1" /></div>
            <div><Label>Expiry date</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} className="mt-1" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
