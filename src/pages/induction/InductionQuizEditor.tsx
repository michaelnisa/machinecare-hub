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
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FileQuestion, Plus, Trash2, ArrowLeft, Loader2, X } from "lucide-react";
import { toast } from "sonner";

type Question = {
  id: string;
  module_id: string;
  question_text: string;
  question_type: "multiple_choice" | "true_false";
  options: string[];
  correct_answer: string;
  order_index: number;
};

export default function InductionQuizEditor() {
  const { id: programmeId, moduleId } = useParams<{ id: string; moduleId: string }>();
  const { profile } = useAuth();
  const { isManager } = useUserRole();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [module, setModule] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = () => ({
    question_text: "",
    question_type: "multiple_choice" as Question["question_type"],
    options: ["", ""] as string[],
    correct_answer: "",
  });
  const [form, setForm] = useState(emptyForm());

  const load = async () => {
    if (!moduleId || !profile) return;
    setLoading(true);
    const [{ data: mod }, { data: qs }] = await Promise.all([
      supabase.from("induction_modules").select("*").eq("id", moduleId).maybeSingle(),
      supabase.from("induction_quiz_questions").select("*").eq("module_id", moduleId).order("order_index"),
    ]);
    setModule(mod);
    setQuestions((qs ?? []).map((q: any) => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : [],
    })) as Question[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [moduleId, profile]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (q: Question) => {
    setEditing(q);
    setForm({
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.question_type === "true_false" ? [] : (q.options.length ? q.options : ["", ""]),
      correct_answer: q.correct_answer,
    });
    setOpen(true);
  };

  const setOption = (i: number, v: string) => {
    const next = [...form.options]; next[i] = v;
    setForm({ ...form, options: next });
  };
  const addOption = () => setForm({ ...form, options: [...form.options, ""] });
  const removeOption = (i: number) => {
    const next = form.options.filter((_, idx) => idx !== i);
    setForm({ ...form, options: next, correct_answer: form.correct_answer === form.options[i] ? "" : form.correct_answer });
  };

  const save = async () => {
    if (!moduleId) return;
    if (!form.question_text.trim()) { toast.error("Question is required"); return; }
    if (!form.correct_answer) { toast.error("Pick the correct answer"); return; }
    if (form.question_type === "multiple_choice") {
      const cleaned = form.options.map((o) => o.trim()).filter(Boolean);
      if (cleaned.length < 2) { toast.error("At least 2 options"); return; }
      if (!cleaned.includes(form.correct_answer)) { toast.error("Correct answer must match an option"); return; }
    }

    setSaving(true);
    const nextOrder = editing ? editing.order_index : (questions[questions.length - 1]?.order_index ?? -1) + 1;
    const payload: any = {
      module_id: moduleId,
      question_text: form.question_text.trim(),
      question_type: form.question_type,
      options: form.question_type === "multiple_choice" ? form.options.map((o) => o.trim()).filter(Boolean) : [],
      correct_answer: form.correct_answer,
      order_index: nextOrder,
    };
    const { error } = editing
      ? await supabase.from("induction_quiz_questions").update(payload).eq("id", editing.id)
      : await supabase.from("induction_quiz_questions").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t.induction.questionSaved);
    setOpen(false);
    load();
  };

  const remove = async () => {
    if (!removeId) return;
    const { error } = await supabase.from("induction_quiz_questions").delete().eq("id", removeId);
    if (error) { toast.error(error.message); return; }
    toast.success(t.induction.questionRemoved);
    setRemoveId(null);
    load();
  };

  if (loading) return <PageLoader />;
  if (!module) return <div className="p-6 text-sm text-muted-foreground">Not found.</div>;

  return (
    <div className="space-y-6">
      <Link to={`/induction/programmes/${programmeId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {module.title}
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.induction.quizEditor}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{module.title}</p>
        </div>
        {isManager && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            {t.induction.addQuestion}
          </Button>
        )}
      </div>

      {questions.length === 0 ? (
        <EmptyState icon={<FileQuestion className="h-5 w-5" />} title={t.induction.noQuestions} />
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-muted-foreground">Q{i + 1}</span>
                    <Badge variant="outline">{q.question_type === "true_false" ? t.induction.trueFalse : t.induction.multipleChoice}</Badge>
                  </div>
                  <div className="mt-1.5 font-medium">{q.question_text}</div>
                  <div className="mt-2 space-y-1 text-sm">
                    {q.question_type === "true_false" ? (
                      <>
                        <div className={q.correct_answer === "true" ? "text-primary" : "text-muted-foreground"}>• {t.induction.true} {q.correct_answer === "true" && "✓"}</div>
                        <div className={q.correct_answer === "false" ? "text-primary" : "text-muted-foreground"}>• {t.induction.false} {q.correct_answer === "false" && "✓"}</div>
                      </>
                    ) : q.options.map((o, idx) => (
                      <div key={idx} className={o === q.correct_answer ? "text-primary" : "text-muted-foreground"}>
                        • {o} {o === q.correct_answer && "✓"}
                      </div>
                    ))}
                  </div>
                </div>
                {isManager && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(q)}>{t.common.edit}</Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setRemoveId(q.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t.common.edit : t.induction.addQuestion}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t.induction.questionText}</Label>
              <Textarea rows={2} value={form.question_text} onChange={(e) => setForm({ ...form, question_text: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.induction.contentType}</Label>
              <Select
                value={form.question_type}
                onValueChange={(v: any) => setForm({
                  ...form,
                  question_type: v,
                  options: v === "true_false" ? [] : (form.options.length ? form.options : ["", ""]),
                  correct_answer: "",
                })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple_choice">{t.induction.multipleChoice}</SelectItem>
                  <SelectItem value="true_false">{t.induction.trueFalse}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.question_type === "true_false" ? (
              <div className="space-y-1.5">
                <Label>{t.induction.correctAnswer}</Label>
                <RadioGroup value={form.correct_answer} onValueChange={(v) => setForm({ ...form, correct_answer: v })} className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="true" /> {t.induction.true}</label>
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="false" /> {t.induction.false}</label>
                </RadioGroup>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{t.induction.option}s &amp; {t.induction.correctAnswer}</Label>
                <RadioGroup value={form.correct_answer} onValueChange={(v) => setForm({ ...form, correct_answer: v })} className="space-y-2">
                  {form.options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <RadioGroupItem value={o} disabled={!o.trim()} />
                      <Input value={o} onChange={(e) => setOption(i, e.target.value)} placeholder={`${t.induction.option} ${i + 1}`} />
                      {form.options.length > 2 && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeOption(i)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </RadioGroup>
                <Button type="button" variant="outline" size="sm" onClick={addOption} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> {t.induction.option}
                </Button>
              </div>
            )}
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
        title={t.induction.removeQuestionTitle}
        description={t.induction.removeQuestionDesc}
        onConfirm={remove}
      />
    </div>
  );
}
