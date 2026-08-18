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
import { InductionQrDialog } from "@/components/InductionQrDialog";
import {
  BookOpen, Plus, Trash2, ArrowLeft, Loader2, ChevronUp, ChevronDown, FileQuestion, Upload, QrCode,
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

const ASSET_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365 * 10; // 10 years — anon QR viewers never authenticate, so this must be a signed URL, not getPublicUrl on a private bucket
const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB — matches the induction-assets bucket's file_size_limit

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
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [togglingQr, setTogglingQr] = useState(false);
  const [quizCounts, setQuizCounts] = useState<Record<string, number>>({});

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
    const loadedModules = (mods ?? []) as Module[];
    setModules(loadedModules);

    const quizModuleIds = loadedModules.filter((m) => m.has_quiz).map((m) => m.id);
    if (quizModuleIds.length > 0) {
      const { data: qs } = await supabase
        .from("induction_quiz_questions")
        .select("module_id")
        .in("module_id", quizModuleIds);
      const counts: Record<string, number> = {};
      for (const row of qs ?? []) counts[row.module_id] = (counts[row.module_id] ?? 0) + 1;
      setQuizCounts(counts);
    } else {
      setQuizCounts({});
    }
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
    if ((form.content_type === "text" || form.content_type === "mixed") && !form.content_text.trim()) {
      toast.error("Add the module text, or pick a different content type");
      return;
    }
    if ((form.content_type === "video") && !form.video_url.trim()) {
      toast.error("Add a video URL, or pick a different content type");
      return;
    }
    if ((form.content_type === "pdf") && !form.document_url.trim()) {
      toast.error("Upload a PDF, or pick a different content type");
      return;
    }
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

  const toggleSelfService = async (v: boolean) => {
    if (!id) return;

    if (v) {
      if (modules.length === 0) {
        toast.error("Add at least one module before turning on QR self-service — an empty programme would give inductees nothing to complete.");
        return;
      }
      const emptyQuizModule = modules.find((m) => m.has_quiz && (quizCounts[m.id] ?? 0) === 0);
      if (emptyQuizModule) {
        toast.warning(`Heads up: "${emptyQuizModule.title}" has its quiz switch on but no questions yet — that step will be silently skipped for inductees. Add questions or turn its quiz off.`);
      }
      const brokenContent = modules.find(
        (m) => (m.content_type === "video" && !m.video_url) || (m.content_type === "pdf" && !m.document_url),
      );
      if (brokenContent) {
        const missing = brokenContent.content_type === "video" ? "video URL" : "PDF";
        toast.warning(`Heads up: "${brokenContent.title}" is set to ${brokenContent.content_type} but has no ${missing} — that step will show empty content.`);
      }
    }

    setTogglingQr(true);
    const { error } = await supabase.from("induction_programmes").update({ qr_self_service_enabled: v }).eq("id", id);
    setTogglingQr(false);
    if (error) { toast.error(error.message); return; }
    setProgramme((p: any) => ({ ...p, qr_self_service_enabled: v }));
  };

  const uploadAsset = async (file: File, subfolder: string): Promise<string | null> => {
    if (!profile) return null;
    const path = `${profile.organisation_id}/modules/${subfolder}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("induction-assets").upload(path, file);
    if (error) { toast.error(error.message); return null; }
    // induction-assets is a private bucket and QR self-service viewers are
    // anonymous, so a plain getPublicUrl would 403 for them — sign it instead.
    const { data, error: signError } = await supabase.storage
      .from("induction-assets")
      .createSignedUrl(path, ASSET_SIGNED_URL_TTL_SECONDS);
    if (signError || !data) { toast.error(signError?.message ?? "Failed to prepare file link"); return null; }
    return data.signedUrl;
  };

  const uploadPdf = async (file: File) => {
    if (file.size > MAX_PDF_BYTES) {
      toast.error("PDF too large. Please keep it under 20 MB.");
      return;
    }
    setUploading(true);
    const url = await uploadAsset(file, "pdf");
    setUploading(false);
    if (!url) return;
    setForm((f) => ({ ...f, document_url: url }));
    toast.success("Uploaded");
  };

  const uploadVideo = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error("Please choose a video file.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error("Video too large. Please keep it under 200 MB — consider uploading to YouTube and pasting the link instead.");
      return;
    }
    setUploadingVideo(true);
    const url = await uploadAsset(file, "video");
    setUploadingVideo(false);
    if (!url) return;
    setForm((f) => ({ ...f, video_url: url }));
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
          {isManager && (
            <div className="mt-3 flex items-center gap-2">
              <Switch checked={!!programme.qr_self_service_enabled} onCheckedChange={toggleSelfService} disabled={togglingQr} />
              <span className="text-sm text-muted-foreground">QR self-service access {programme.qr_self_service_enabled ? "on" : "off"}</span>
            </div>
          )}
        </div>
        {isManager && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setQrOpen(true)} className="gap-2">
              <QrCode className="h-4 w-4" />
              QR code
            </Button>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              {t.induction.addModule}
            </Button>
          </div>
        )}
      </div>

      <InductionQrDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        programmeId={programme.id}
        programmeName={programme.name}
        selfServiceEnabled={!!programme.qr_self_service_enabled}
      />

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
                    {m.has_quiz && (quizCounts[m.id] ?? 0) === 0 ? (
                      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">Quiz — no questions yet</Badge>
                    ) : m.has_quiz ? (
                      <Badge className="bg-primary-soft text-primary">Quiz · {quizCounts[m.id]} question{quizCounts[m.id] === 1 ? "" : "s"}</Badge>
                    ) : null}
                    {m.content_type === "video" && !m.video_url && (
                      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">No video URL</Badge>
                    )}
                    {m.content_type === "pdf" && !m.document_url && (
                      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">No PDF</Badge>
                    )}
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
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">or upload a video file</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="flex items-center gap-2">
                  <Input type="file" accept="video/*" onChange={(e) => e.target.files?.[0] && uploadVideo(e.target.files[0])} disabled={uploadingVideo} />
                  {uploadingVideo && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                <p className="text-[11px] text-muted-foreground">Up to 200 MB. For longer videos, upload to YouTube and paste the link above instead — it streams better on slow connections.</p>
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
            <Button onClick={save} disabled={saving || uploading || uploadingVideo}>
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
