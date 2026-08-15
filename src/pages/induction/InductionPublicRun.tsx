import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import SignaturePad from "signature_pad";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader } from "@/components/PageLoader";
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2, XCircle, Award, GraduationCap } from "lucide-react";
import { toast } from "sonner";

type Programme = { id: string; name: string; pass_mark_percent: number; description: string | null };
type Module = {
  id: string; title: string; content_type: string;
  content_text: string | null; video_url: string | null; document_url: string | null;
  has_quiz: boolean; order_index: number;
};
type Question = {
  id: string; question_text: string;
  question_type: "multiple_choice" | "true_false"; options: string[]; order_index: number;
};
type Inductee = { id: string; full_name: string };

type Step =
  | { kind: "identify" }
  | { kind: "welcome" }
  | { kind: "module"; index: number }
  | { kind: "quiz"; index: number }
  | { kind: "declaration" }
  | { kind: "done" };

function youTubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export default function InductionPublicRun() {
  const { programmeId } = useParams<{ programmeId: string }>();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [inductees, setInductees] = useState<Inductee[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [questionsByModule, setQuestionsByModule] = useState<Record<string, Question[]>>({});

  const [inducteeId, setInducteeId] = useState("");
  const [recordId, setRecordId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const [step, setStep] = useState<Step>({ kind: "identify" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [moduleResults, setModuleResults] = useState<Record<string, { score: number; passed: boolean }>>({});
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  const inductee = inductees.find((i) => i.id === inducteeId) ?? null;

  useEffect(() => {
    if (!programmeId) return;
    (async () => {
      setLoading(true);
      // RPCs added by migration 20260814010000; will not appear in generated
      // types until `supabase gen types` is re-run.
      const [{ data: prog }, { data: inds }, { data: mods }] = await Promise.all([
        (supabase as any).rpc("get_induction_programme_public", { _programme_id: programmeId }),
        (supabase as any).rpc("get_inductees_for_programme_public", { _programme_id: programmeId }),
        (supabase as any).rpc("get_induction_modules_public", { _programme_id: programmeId }),
      ]);
      setProgramme(prog?.[0] ?? null);
      setInductees((inds ?? []) as Inductee[]);
      const ms = (mods ?? []) as Module[];
      setModules(ms);

      const quizModules = ms.filter((m) => m.has_quiz);
      if (quizModules.length) {
        const results = await Promise.all(
          quizModules.map((m) => (supabase as any).rpc("get_induction_quiz_questions_public", { _module_id: m.id })),
        );
        const grouped: Record<string, Question[]> = {};
        quizModules.forEach((m, i) => {
          const qs = (results[i].data ?? []) as any[];
          grouped[m.id] = qs.map((q) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] }));
        });
        setQuestionsByModule(grouped);
      }
      setLoading(false);
    })();
  }, [programmeId]);

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

  const startInduction = async () => {
    if (!programmeId || !inducteeId) return;
    setStarting(true);
    const { data, error } = await (supabase as any).rpc("start_induction_public", {
      _programme_id: programmeId,
      _inductee_id: inducteeId,
    });
    setStarting(false);
    if (error || !data) return toast.error(error?.message ?? "Could not start induction");
    setRecordId(data as string);
    setStep({ kind: "welcome" });
  };

  const goNext = () => {
    if (step.kind === "welcome") {
      setStep(modules.length === 0 ? { kind: "declaration" } : { kind: "module", index: 0 });
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
    }
  };
  const goPrev = () => {
    if (step.kind === "module" && step.index > 0) setStep({ kind: "module", index: step.index - 1 });
    else if (step.kind === "module") setStep({ kind: "welcome" });
    else if (step.kind === "quiz") setStep({ kind: "module", index: step.index });
    else if (step.kind === "declaration") setStep(modules.length ? { kind: "module", index: modules.length - 1 } : { kind: "welcome" });
  };

  const submitQuiz = async () => {
    if (step.kind !== "quiz" || !recordId) return;
    const m = modules[step.index];
    const qs = questionsByModule[m.id] ?? [];
    if (qs.some((q) => !answers[q.id])) { toast.error("Answer all questions"); return; }

    setSubmitting(true);
    const { data, error } = await (supabase as any).rpc("submit_induction_quiz_public", {
      _record_id: recordId,
      _module_id: m.id,
      _answers: answers,
    });
    setSubmitting(false);
    if (error || !data?.[0]) return toast.error(error?.message ?? "Could not submit quiz");

    const { score_percent, passed } = data[0];
    setModuleResults({ ...moduleResults, [m.id]: { score: score_percent, passed } });
    if (passed) {
      toast.success(`${t.induction.passed} — ${score_percent}%`);
      if (step.index + 1 < modules.length) setStep({ kind: "module", index: step.index + 1 });
      else setStep({ kind: "declaration" });
    } else {
      toast.error(`${t.induction.failed} — ${score_percent}%`);
    }
  };

  const retryQuiz = () => setAnswers({});

  const finish = async () => {
    if (!recordId) return;
    if (!agreed) return toast.error(t.induction.mustAgree);
    if (!padRef.current || padRef.current.isEmpty()) return toast.error(t.induction.mustSign);

    setSubmitting(true);
    const dataUrl = padRef.current.toDataURL("image/png");
    const { error } = await supabase.functions.invoke("complete-induction-public", {
      body: { recordId, signaturePngBase64: dataUrl },
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setStep({ kind: "done" });
  };

  if (loading) return <PageLoader />;

  if (!programme) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <GraduationCap className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">This induction isn't available for QR access</p>
          <p className="mt-1 text-sm text-muted-foreground">Ask your site manager to check with you directly.</p>
          <Link to="/" className="mt-4 inline-block text-primary hover:underline">Home</Link>
        </div>
      </div>
    );
  }

  const totalSteps = modules.length + 2;
  const currentStep =
    step.kind === "identify" ? 0 :
    step.kind === "welcome" ? 1 :
    step.kind === "module" ? step.index + 2 :
    step.kind === "quiz" ? step.index + 2 :
    totalSteps;
  const pct = (currentStep / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:py-12">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate font-medium text-foreground">{programme.name}</span>
            {inductee && <span>{inductee.full_name}</span>}
          </div>
          {step.kind !== "identify" && <Progress value={pct} className="h-1.5" />}
        </div>

        {step.kind === "identify" && (
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
              <GraduationCap className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">{programme.name}</h1>
            {programme.description && (
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{programme.description}</p>
            )}
            <div className="mx-auto mt-6 max-w-xs space-y-3 text-left">
              <p className="text-center text-sm text-muted-foreground">Who's taking this induction?</p>
              {inductees.length > 0 ? (
                <Select value={inducteeId} onValueChange={setInducteeId}>
                  <SelectTrigger><SelectValue placeholder="Pick your name" /></SelectTrigger>
                  <SelectContent>
                    {inductees.map((i) => <SelectItem key={i.id} value={i.id}>{i.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-center text-sm text-muted-foreground">No inductees found for this programme yet.</p>
              )}
              <Button className="h-12 w-full" disabled={!inducteeId || starting} onClick={startInduction}>
                {starting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue
              </Button>
            </div>
          </div>
        )}

        {step.kind === "welcome" && (
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Award className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{t.induction.welcome}, {inductee?.full_name}</h1>
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
          </div>
        )}
      </div>
    </div>
  );
}
