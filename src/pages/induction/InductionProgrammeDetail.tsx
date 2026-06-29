import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  BookOpen, Plus, Trash2, ArrowLeft, Loader2, ChevronUp, ChevronDown, FileQuestion, Upload,
} from "lucide-react";
import { toast } from "sonner";

type Module = {
  id: string;
  programme_id: string;
  title: string;
  content_type: "text" | "video" | "pdf" | "mixed";
  content_text: string | null;
  video_url: string | null;
  document_url: string | null;
  order_index: number;
  has_quiz: boolean;
};

const CONTENT_TYPES = ["text", "video", "pdf", "mixed"] as const;

export default function InductionProgrammeDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { isManager } = useUserRole();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [programme, setProgramme] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Module | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    content_type: "text" as Module["content_type"],
    content_text: "",
    video_url: "",
    document_url: "",
    has_quiz: true,
  });

  const load = async () => {
    if (!id || !profile) return;
    setLoading(true);
    const [{ data: prog }, { data: mods }] = await Promise.all([
      supabase.from("induction_programmes").select("*").eq("id", id).maybeSingle(),
      supabase.from("induction_modules").select("*").eq("programme_id", id).order("order_index"),
    ]);
    setProgramme(prog);
    setModules((mods ?? []) as Module[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id, profile]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", content_type: "text", content_text: "", video_url: "", document_url: "", has_quiz: true });
    setOpen(true);
  };
  const openEdit = (m: Module) => {
    setEditing(m);
    setForm({
      title: m.title,
      content_type: m.content_type,
      content_text: m.content_text ?? "",
      video_url: m.video_url ?? "",
      document_url: m.document_url ?? "",
      has_quiz: m.has_quiz,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!id) return;
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    const nextOrder = editing ? editing.order_index : (modules[modules.length - 1]?.order_index ?? -1) + 1;
    const payload: any = {
      programme_id: id,
      title: form.title.trim(),
      content_type: form.content_type,
      content_text: form.content_text.trim() || null,
      video_url: form.video_url.trim() || null,
      document_url: form.document_url.trim() || null,
      has_quiz: form.has_quiz,
      order_index: nextOrder,
    };
    const { error } = editing
      ? await supabase.from("induction_modules").update(payload).eq("id", editing.id)
      : await supabase.from("induction_modules").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t.induction.moduleSaved);
    setOpen(false);
    load();
  };

  const remove = async () => {
    if (!removeId) return;
    const { error } = await supabase.from("induction_modules").delete().eq("id", removeId);
    if (error) { toast.error(error.message); return; }
    toast.success(t.induction.moduleRemoved);
    setRemoveId(null);
    load();
  };

  const reorder = async (m: Module, dir: -1 | 1) => {
    const idx = modules.findIndex((x) => x.id === m.id);
    const other = modules[idx + dir];
    if (!other) return;
    await Promise.all([
      supabase.from("induction_modules").update({ order_index: other.order_index }).eq("id", m.id),
      supabase.from("induction_modules").update({ order_index: m.order_index }).eq("id", other.id),
    ]);
    load();
  };

  const uploadPdf = async (file: File) => {
    if (!profile) return;
    setUploading(true);
    const path = `${profile.organisation_id}/modules/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("induction-assets").upload(path, file);
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("induction-assets").getPublicUrl(path);
    setForm((f) => ({ ...f, document_url: data.publicUrl }));
    toast.success("Uploaded");
  };

  if (loading) return <PageLoader />;
  if (!programme) return <div className="p-6 text-sm text-muted-foreground">Not found.</div>;

  return (
    <div className="space-y-6">
      <Link to="/induction/programmes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t.induction.programmes}
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{programme.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary" className="capitalize">{t.induction.typeBadge[programme.inductee_type as keyof typeof t.induction.typeBadge]}</Badge>
            <span>{programme.pass_mark_percent}% {t.induction.passMark.toLowerCase()}</span>
            <span>•</span>
            <span>{programme.validity_days ? `${programme.validity_days}d ${t.induction.validityDays.toLowerCase()}` : t.induction.noExpiry}</span>
          </div>
          {programme.description && <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{programme.description}</p>}
        </div>
        {isManager && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            {t.induction.addModule}
          </Button>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t.induction.modules}</h2>
        {modules.length === 0 ? (
          <EmptyState icon={<BookOpen className="h-5 w-5" />} title={t.induction.noModules} />
        ) : (
          <div className="space-y-2">
            {modules.map((m, i) => (
              <div key={m.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0 || !isManager} onClick={() => reorder(m, -1)}>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === modules.length - 1 || !isManager} onClick={() => reorder(m, 1)}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium">{i + 1}. {m.title}</div>
                    <Badge variant="outline" className="capitalize">{m.content_type}</Badge>
                    {m.has_quiz && <Badge className="bg-primary-soft text-primary">Quiz</Badge>}
                  </div>
                  {m.content_text && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.content_text}</p>}
                  {m.video_url && <a href={m.video_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-primary hover:underline">{m.video_url}</a>}
                  {m.document_url && <a href={m.document_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-primary hover:underline">PDF</a>}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {m.has_quiz && (
                    <Link to={`/induction/programmes/${id}/modules/${m.id}/quiz`}>
                      <Button variant="outline" size="sm" className="gap-1.5"><FileQuestion className="h-3.5 w-3.5" />{t.induction.manageQuiz}</Button>
                    </Link>
                  )}
                  {isManager && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>{t.common.edit}</Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setRemoveId(m.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t.common.edit : t.induction.addModule}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t.induction.moduleTitle}</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.induction.contentType}</Label>
              <Select value={form.content_type} onValueChange={(v: any) => setForm({ ...form, content_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((c) => <SelectItem key={c} value={c}>{(t.induction as any)[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(form.content_type === "text" || form.content_type === "mixed") && (
              <div className="space-y-1.5">
                <Label>{t.induction.contentText}</Label>
                <Textarea rows={5} value={form.content_text} onChange={(e) => setForm({ ...form, content_text: e.target.value })} />
              </div>
            )}
            {(form.content_type === "video" || form.content_type === "mixed") && (
              <div className="space-y-1.5">
                <Label>{t.induction.videoUrl}</Label>
                <Input placeholder="https://youtube.com/..." value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} />
              </div>
            )}
            {(form.content_type === "pdf" || form.content_type === "mixed") && (
              <div className="space-y-1.5">
                <Label>{t.induction.pdfUpload}</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" accept="application/pdf" onChange={(e) => e.target.files?.[0] && uploadPdf(e.target.files[0])} disabled={uploading} />
                  {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                {form.document_url && <a href={form.document_url} target="_blank" rel="noreferrer" className="block truncate text-xs text-primary hover:underline">{form.document_url}</a>}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={form.has_quiz} onCheckedChange={(v) => setForm({ ...form, has_quiz: v })} />
              <span className="text-sm">{t.induction.hasQuiz}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removeId}
        onOpenChange={(v) => !v && setRemoveId(null)}
        title={t.induction.removeModuleTitle}
        description={t.induction.removeModuleDesc}
        onConfirm={remove}
      />
    </div>
  );
}
