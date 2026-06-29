import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nProvider";

const schema = z.object({ email: z.string().trim().email("Enter a valid email").max(255) });
type FormValues = z.infer<typeof schema>;

export default function ForgotPassword() {
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute left-4 top-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/login"><ArrowLeft className="mr-1 h-4 w-4" /> {t.common.back}</Link>
        </Button>
      </div>
      <div className="absolute right-4 top-4"><LanguageSwitcher /></div>

      <div className="mx-auto flex min-h-screen max-w-sm items-center justify-center px-4">
        <div className="w-full">
          <div className="mb-6 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Wrench className="h-5 w-5" />
            </div>
            <span className="text-xl font-semibold">{t.common.appName}</span>
          </div>

          {sent ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-primary" />
              <h1 className="text-xl font-semibold">{t.auth.resetSentTitle}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t.auth.resetSentDesc}</p>
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link to="/login">{t.common.login}</Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="mb-1 text-3xl font-bold tracking-tight">{t.auth.forgotTitle}</h1>
              <p className="mb-6 text-sm text-muted-foreground">{t.auth.forgotSub}</p>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t.auth.email}</Label>
                  <Input id="email" type="email" autoComplete="email" {...register("email")} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <Button type="submit" className="h-11 w-full text-base" disabled={submitting} style={{ background: "var(--gradient-primary)" }}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t.auth.sendResetLink}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
