import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nProvider";

const schema = z.object({
  password: z.string().min(8, "At least 8 characters").max(72),
  confirm: z.string().min(8).max(72),
}).refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords don't match" });

type FormValues = z.infer<typeof schema>;

export default function ResetPassword() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase puts the recovery session in the URL hash and signs the user in
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: values.password });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(t.auth.passwordUpdated);
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute right-4 top-4"><LanguageSwitcher /></div>
      <div className="mx-auto flex min-h-screen max-w-sm items-center justify-center px-4">
        <div className="w-full">
          <div className="mb-6 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Wrench className="h-5 w-5" />
            </div>
            <span className="text-xl font-semibold">{t.common.appName}</span>
          </div>
          <h1 className="mb-1 text-3xl font-bold tracking-tight">{t.auth.resetTitle}</h1>
          <p className="mb-6 text-sm text-muted-foreground">{t.auth.resetSub}</p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">{t.auth.newPassword}</Label>
              <Input id="password" type="password" autoComplete="new-password" {...register("password")} disabled={!ready} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">{t.auth.confirmPassword}</Label>
              <Input id="confirm" type="password" autoComplete="new-password" {...register("confirm")} disabled={!ready} />
              {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
            </div>
            <Button type="submit" className="h-11 w-full text-base" disabled={submitting || !ready} style={{ background: "var(--gradient-primary)" }}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.auth.updatePassword}
            </Button>
          </form>
          {!ready && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {t.auth.openFromEmail} <Link to="/forgot-password" className="text-primary hover:underline">{t.auth.requestNewLink}</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
