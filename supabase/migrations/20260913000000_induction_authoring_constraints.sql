-- Guardrails against malformed induction content reaching the QR flow.
-- All UI-side validation (InductionProgrammes.tsx, InductionProgrammeDetail.tsx,
-- InductionQuizEditor.tsx) can be bypassed by a direct API/RPC call, so these
-- CHECK constraints back it up at the DB level. Added NOT VALID so existing
-- rows (if any violate) aren't retroactively rejected by this migration —
-- only new inserts/updates are enforced going forward.

ALTER TABLE public.induction_programmes
  ADD CONSTRAINT chk_pass_mark_range CHECK (pass_mark_percent >= 0 AND pass_mark_percent <= 100) NOT VALID;

ALTER TABLE public.induction_programmes
  ADD CONSTRAINT chk_inductee_type CHECK (inductee_type IN ('employee', 'contractor', 'visitor')) NOT VALID;

ALTER TABLE public.induction_modules
  ADD CONSTRAINT chk_content_type CHECK (content_type IN ('text', 'video', 'pdf', 'mixed')) NOT VALID;

ALTER TABLE public.induction_quiz_questions
  ADD CONSTRAINT chk_question_type CHECK (question_type IN ('multiple_choice', 'true_false')) NOT VALID;

-- A multiple_choice question needs at least 2 options...
ALTER TABLE public.induction_quiz_questions
  ADD CONSTRAINT chk_mc_min_options
  CHECK (question_type <> 'multiple_choice' OR jsonb_array_length(options) >= 2) NOT VALID;

-- ...and its correct_answer must actually be one of them.
ALTER TABLE public.induction_quiz_questions
  ADD CONSTRAINT chk_correct_answer_in_options
  CHECK (question_type <> 'multiple_choice' OR options @> to_jsonb(correct_answer)) NOT VALID;

-- A true_false question's answer must be literally "true" or "false".
ALTER TABLE public.induction_quiz_questions
  ADD CONSTRAINT chk_tf_answer
  CHECK (question_type <> 'true_false' OR correct_answer IN ('true', 'false')) NOT VALID;
