import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
});

type FormValues = z.infer<typeof schema>;

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, navigate, next]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword(values);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t.auth.welcomeBack);
    navigate(next, { replace: true });
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      {/* Left: form */}
      <div className="relative flex items-center justify-center px-4 py-10">
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-1 h-4 w-4" /> {t.common.back}
            </Link>
          </Button>
        </div>
        <div className="absolute right-4 top-4">
          <LanguageSwitcher />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Wrench className="h-5 w-5" />
            </div>
            <span className="text-xl font-semibold">{t.common.appName}</span>
          </div>
          <h1 className="mb-1 text-3xl font-bold tracking-tight">
            {t.auth.welcomeBack}
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {t.auth.welcomeSub}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t.auth.email}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t.auth.password}</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t.auth.forgotPassword}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="h-11 w-full text-base"
              disabled={submitting}
              style={{ background: "var(--gradient-primary)" }}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.common.login}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t.auth.noAccount}{" "}
            <Link
              to="/signup"
              className="font-medium text-primary hover:underline"
            >
              {t.auth.createOne}
            </Link>
          </p>
        </div>
      </div>

      {/* Right: brand panel */}
      <div
        className="hidden md:flex md:flex-col md:items-center md:justify-center md:p-12 md:text-primary-foreground"
        style={{ background: "var(--gradient-primary)" }}
      >
        <div className="max-w-md text-center">
          <Wrench className="mx-auto mb-6 h-12 w-12 opacity-90" />
          <h2 className="text-3xl font-bold leading-tight">{t.home.tagline}</h2>
          <p className="mt-3 text-sm opacity-90">{t.home.hero}</p>
        </div>
      </div>
    </div>
  );
}
