import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SignaturePad from "signature_pad";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PageLoader } from "@/components/PageLoader";
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2, XCircle, Award } from "lucide-react";
import { toast } from "sonner";

type Programme = { id: string; name: string; pass_mark_percent: number; description: string | null };
type Module = {
  id: string; title: string; content_type: string;
  content_text: string | null; video_url: string | null; document_url: string | null;
  has_quiz: boolean; order_index: number;
};
type Question = {
  id: string; module_id: string; question_text: string;
  question_type: "multiple_choice" | "true_false"; options: string[]; correct_answer: string;
};
type Inductee = { id: string; full_name: string };

type Step = { kind: "welcome" } | { kind: "module"; index: number } | { kind: "quiz"; index: number } | { kind: "declaration" } | { kind: "done" };

function youTubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export default function InductionRun() {
  const { recordId } = useParams<{ recordId: string }>();
  const nav = useNavigate();
  const { profile } = useAuth();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [inductee, setInductee] = useState<Inductee | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [questionsByModule, setQuestionsByModule] = useState<Record<string, Question[]>>({});
  const [moduleResults, setModuleResults] = useState<Record<string, { score: number; passed: boolean; attempts: number }>>({});

  const [step, setStep] = useState<Step>({ kind: "welcome" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    (async () => {
      if (!recordId || !profile) return;
      setLoading(true);
      const { data: rec } = await supabase
        .from("induction_records")
        .select("*")
        .eq("id", recordId)
        .maybeSingle();
      if (!rec) { setLoading(false); return; }
      if (rec.status === "completed") {
        nav(`/induction/certificate/${recordId}`, { replace: true });
        return;
      }
      const [{ data: prog }, { data: ind }, { data: mods }] = await Promise.all([
        supabase.from("induction_programmes").select("id,name,pass_mark_percent,description").eq("id", rec.programme_id).maybeSingle(),
        supabase.from("inductees").select("id,full_name").eq("id", rec.inductee_id).maybeSingle(),
        supabase.from("induction_modules").select("*").eq("programme_id", rec.programme_id).order("order_index"),
      ]);
      setProgramme(prog as Programme | null);
      setInductee(ind as Inductee | null);
      const ms = (mods ?? []) as Module[];
      setModules(ms);
      if (ms.length) {
        const { data: qs } = await supabase
          .from("induction_quiz_questions")
          .select("*")
          .in("module_id", ms.map((m) => m.id))
          .order("order_index");
        const grouped: Record<string, Question[]> = {};
        (qs ?? []).forEach((q: any) => {
          grouped[q.module_id] = grouped[q.module_id] || [];
          grouped[q.module_id].push({ ...q, options: Array.isArray(q.options) ? q.options : [] });
        });
        setQuestionsByModule(grouped);
      }
      setLoading(false);
    })();
  }, [recordId, profile, nav]);

  // Init signature pad when declaration step shown
  useEffect(() => {
    if (step.kind !== "declaration" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);
      padRef.current?.clear();
    };
    padRef.current = new SignaturePad(canvas, { penColor: "#0f172a" });
    resize();
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); padRef.current?.off(); padRef.current = null; };
  }, [step.kind]);

  const goNext = () => {
    if (step.kind === "welcome") {
      if (modules.length === 0) setStep({ kind: "declaration" });
      else setStep({ kind: "module", index: 0 });
      return;
    }
    if (step.kind === "module") {
      const m = modules[step.index];
      if (m.has_quiz && (questionsByModule[m.id]?.length ?? 0) > 0) {
        setAnswers({});
        setStep({ kind: "quiz", index: step.index });
      } else if (step.index + 1 < modules.length) {
        setStep({ kind: "module", index: step.index + 1 });
      } else {
        setStep({ kind: "declaration" });
      }
      return;
    }
    if (step.kind === "quiz") {
      // already advanced via submit
      return;
    }
  };
  const goPrev = () => {
    if (step.kind === "module" && step.index > 0) setStep({ kind: "module", index: step.index - 1 });
    else if (step.kind === "module") setStep({ kind: "welcome" });
    else if (step.kind === "quiz") setStep({ kind: "module", index: step.index });
    else if (step.kind === "declaration") setStep(modules.length ? { kind: "module", index: modules.length - 1 } : { kind: "welcome" });
  };

  const submitQuiz = async () => {
    if (step.kind !== "quiz") return;
    const m = modules[step.index];
    const qs = questionsByModule[m.id] ?? [];
    if (qs.some((q) => !answers[q.id])) { toast.error("Answer all questions"); return; }
    const correct = qs.filter((q) => answers[q.id] === q.correct_answer).length;
    const scorePercent = Math.round((correct / qs.length) * 100);
    const pass = scorePercent >= (programme?.pass_mark_percent ?? 80);
    const prev = moduleResults[m.id];
    const attempts = (prev?.attempts ?? 0) + 1;

    setSubmitting(true);
    if (prev) {
      await supabase.from("induction_module_results").update({
        score_percent: scorePercent, passed: pass, attempts,
        answers_given: qs.map((q) => ({ q: q.id, a: answers[q.id] })),
        completed_at: new Date().toISOString(),
      }).eq("induction_record_id", recordId!).eq("module_id", m.id);
    } else {
      await supabase.from("induction_module_results").insert({
        induction_record_id: recordId!,
        module_id: m.id,
        score_percent: scorePercent,
        passed: pass,
        attempts,
        answers_given: qs.map((q) => ({ q: q.id, a: answers[q.id] })),
      });
    }
    setSubmitting(false);
    setModuleResults({ ...moduleResults, [m.id]: { score: scorePercent, passed: pass, attempts } });
    if (pass) {
      toast.success(`${t.induction.passed} — ${scorePercent}%`);
      if (step.index + 1 < modules.length) setStep({ kind: "module", index: step.index + 1 });
      else setStep({ kind: "declaration" });
    } else {
      toast.error(`${t.induction.failed} — ${scorePercent}%`);
    }
  };

  const retryQuiz = () => {
    if (step.kind !== "quiz") return;
    setAnswers({});
  };

  const finish = async () => {
    if (!recordId || !profile) return;
    if (!agreed) return toast.error(t.induction.mustAgree);
    if (!padRef.current || padRef.current.isEmpty()) return toast.error(t.induction.mustSign);

    setSubmitting(true);
    const dataUrl = padRef.current.toDataURL("image/png");
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${profile.organisation_id}/signatures/${recordId}.png`;
    const { error: upErr } = await supabase.storage.from("induction-assets").upload(path, blob, { upsert: true, contentType: "image/png" });
    if (upErr) { setSubmitting(false); return toast.error(upErr.message); }
    const { data: signed } = await supabase.storage.from("induction-assets").createSignedUrl(path, 60 * 60 * 24 * 365);

    const scores = Object.values(moduleResults);
    const overall = scores.length ? Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length) : 100;

    const { error } = await supabase.from("induction_records").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      overall_score_percent: overall,
      digital_signature_url: signed?.signedUrl ?? path,
    }).eq("id", recordId);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setStep({ kind: "done" });
  };

  if (loading) return <PageLoader />;
  if (!programme || !inductee) return <div className="p-6 text-sm text-muted-foreground">Not found.</div>;

  const totalSteps = modules.length + 2;
  const currentStep =
    step.kind === "welcome" ? 1 :
    step.kind === "module" ? step.index + 2 :
    step.kind === "quiz" ? step.index + 2 :
    step.kind === "declaration" ? totalSteps :
    totalSteps;
  const pct = (currentStep / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:py-12">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate font-medium text-foreground">{programme.name}</span>
            <span>{inductee.full_name}</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>

        {step.kind === "welcome" && (
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Award className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{t.induction.welcome}, {inductee.full_name}</h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{programme.description || t.induction.welcomeIntro}</p>
            <Button onClick={goNext} size="lg" className="mt-6 gap-2">
              {t.induction.begin} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step.kind === "module" && (() => {
          const m = modules[step.index];
          const embed = m.video_url ? youTubeEmbed(m.video_url) : null;
          return (
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-8">
              <div className="mb-4 flex items-center justify-between">
                <Badge variant="outline">{t.induction.moduleProgress.replace("{n}", String(step.index + 1)).replace("{total}", String(modules.length))}</Badge>
                <Badge variant="secondary" className="capitalize">{m.content_type}</Badge>
              </div>
              <h2 className="text-xl font-semibold tracking-tight">{m.title}</h2>
              <div className="prose prose-sm dark:prose-invert mt-4 max-w-none whitespace-pre-wrap text-sm text-foreground/90">
                {m.content_text}
              </div>
              {m.video_url && (
                <div className="mt-4 overflow-hidden rounded-xl border border-border">
                  {embed ? (
                    <iframe src={embed} title={m.title} className="aspect-video w-full" allowFullScreen />
                  ) : (
                    <video controls className="w-full" src={m.video_url} />
                  )}
                </div>
              )}
              {m.document_url && (
                <div className="mt-4">
                  <iframe src={m.document_url} title={m.title} className="h-[60vh] w-full rounded-xl border border-border" />
                </div>
              )}
              <div className="mt-6 flex items-center justify-between">
                <Button variant="ghost" onClick={goPrev} className="gap-2"><ArrowLeft className="h-4 w-4" />{t.induction.previous}</Button>
                <Button onClick={goNext} className="gap-2">
                  {m.has_quiz && (questionsByModule[m.id]?.length ?? 0) > 0 ? t.induction.quiz : t.induction.next}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })()}

        {step.kind === "quiz" && (() => {
          const m = modules[step.index];
          const qs = questionsByModule[m.id] ?? [];
          const result = moduleResults[m.id];
          return (
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight">{t.induction.quiz}</h2>
                <Badge variant="outline">{t.induction.passMark}: {programme.pass_mark_percent}%</Badge>
              </div>
              {result && !result.passed && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <XCircle className="h-4 w-4" /> {t.induction.failed} — {result.score}%. {t.induction.tryAgain}.
                </div>
              )}
              <div className="space-y-6">
                {qs.map((q, i) => (
                  <div key={q.id} className="space-y-2">
                    <div className="font-medium">{i + 1}. {q.question_text}</div>
                    <RadioGroup value={answers[q.id] ?? ""} onValueChange={(v) => setAnswers({ ...answers, [q.id]: v })} className="space-y-1.5">
                      {q.question_type === "true_false" ? (
                        <>
                          <label className="flex items-center gap-2 text-sm cursor-pointer"><RadioGroupItem value="true" /> {t.induction.true}</label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer"><RadioGroupItem value="false" /> {t.induction.false}</label>
                        </>
                      ) : q.options.map((o, idx) => (
                        <label key={idx} className="flex items-center gap-2 text-sm cursor-pointer"><RadioGroupItem value={o} /> {o}</label>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between">
                <Button variant="ghost" onClick={goPrev}><ArrowLeft className="mr-2 h-4 w-4" />{t.induction.previous}</Button>
                {result && !result.passed ? (
                  <Button onClick={retryQuiz} variant="outline">{t.induction.tryAgain}</Button>
                ) : null}
                <Button onClick={submitQuiz} disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t.induction.submit}
                </Button>
              </div>
            </div>
          );
        })()}

        {step.kind === "declaration" && (
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-8">
            <h2 className="text-xl font-semibold tracking-tight">{t.induction.declaration}</h2>
            <p className="mt-3 text-sm text-foreground/90">{t.induction.declarationText}</p>
            <label className="mt-4 flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(Boolean(v))} />
              {t.induction.iAgree}
            </label>

            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{t.induction.signaturePrompt}</span>
                <Button variant="ghost" size="sm" onClick={() => padRef.current?.clear()}>{t.induction.clear}</Button>
              </div>
              <div className="rounded-xl border border-border bg-background">
                <canvas ref={canvasRef} className="h-44 w-full touch-none rounded-xl" />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <Button variant="ghost" onClick={goPrev}><ArrowLeft className="mr-2 h-4 w-4" />{t.induction.previous}</Button>
              <Button onClick={finish} disabled={submitting} size="lg">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {t.induction.complete}
              </Button>
            </div>
          </div>
        )}

        {step.kind === "done" && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{t.induction.completed}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t.induction.completedSub}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button onClick={() => nav(`/induction/certificate/${recordId}`)}>{t.induction.viewCertificate}</Button>
              <Button variant="outline" onClick={() => nav("/induction/inductees")}>{t.induction.backToInductees}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
