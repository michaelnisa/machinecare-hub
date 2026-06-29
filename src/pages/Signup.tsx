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
import { Checkbox } from "@/components/ui/checkbox";
import { Wrench, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const INDUSTRIES = [
  "Transport",
  "Logistics",
  "Construction",
  "Manufacturing",
  "Agriculture",
  "Mining",
  "Energy",
  "Other",
];

export default function Signup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inviteToken = params.get("invite");
  const inviteEmail = params.get("email");
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [emailSent, setEmailSent] = useState<string | null>(null);

  const schema = z.object({
    full_name: z.string().trim().min(2, "Required").max(100),
    organisation_name: inviteToken
      ? z.string().optional()
      : z.string().trim().min(2, "Required").max(100),
    industry: inviteToken
      ? z.string().optional()
      : z.string().min(1, "Required"),
    email: z.string().trim().email("Enter a valid email").max(255),
    password: z.string().min(8, "At least 8 characters").max(72),
  });
  type FormValues = z.infer<typeof schema>;

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { industry: "Transport", email: inviteEmail ?? "" },
  });

  const onSubmit = async (values: FormValues) => {
    if (!accepted) {
      toast.error(t.auth.mustAcceptTos);
      return;
    }
    if (
      inviteToken &&
      inviteEmail &&
      values.email.toLowerCase() !== inviteEmail.toLowerCase()
    ) {
      toast.error(t.auth.inviteEmailMismatch);
      return;
    }
    setSubmitting(true);
    const redirectUrl = `${window.location.origin}/dashboard`;
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: values.full_name,
          organisation_name: values.organisation_name,
          industry: values.industry,
          ...(inviteToken ? { invite_token: inviteToken } : {}),
        },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEmailSent(values.email);
  };

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-primary" />
          <h1 className="text-2xl font-bold">{t.auth.checkInbox}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t.auth.confirmSentTo}{" "}
            <span className="font-medium text-foreground">{emailSent}</span>.{" "}
            {t.auth.confirmSentDesc}
          </p>
          <Button asChild variant="outline" className="mt-6 w-full">
            <Link to="/login">{t.common.login}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
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

      <div className="relative flex items-center justify-center px-4 py-10">
        <div className="absolute left-4 top-4">
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
            {inviteToken ? t.auth.joinTeam : t.auth.createAccount}
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {inviteToken ? t.auth.joinTeamSub : t.auth.createSub}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">{t.auth.yourName}</Label>
              <Input id="full_name" {...register("full_name")} />
              {errors.full_name && (
                <p className="text-xs text-destructive">
                  {errors.full_name.message}
                </p>
              )}
            </div>

            {!inviteToken && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="organisation_name">
                    {t.auth.organisation}
                  </Label>
                  <Input
                    id="organisation_name"
                    {...register("organisation_name")}
                  />
                  {errors.organisation_name && (
                    <p className="text-xs text-destructive">
                      {errors.organisation_name.message as string}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="industry">{t.auth.industry}</Label>
                  <select
                    id="industry"
                    {...register("industry")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {INDUSTRIES.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">{t.auth.email}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
                readOnly={!!inviteEmail}
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t.auth.password}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={accepted}
                onCheckedChange={(v) => setAccepted(!!v)}
                className="mt-0.5"
              />
              <span>
                {t.auth.tosAccept}{" "}
                <Link to="/terms" className="text-primary hover:underline">
                  {t.auth.terms}
                </Link>{" "}
                {t.auth.and}{" "}
                <Link to="/privacy" className="text-primary hover:underline">
                  {t.auth.privacy}
                </Link>
                .
              </span>
            </label>

            <Button
              type="submit"
              className="h-11 w-full text-base"
              disabled={submitting}
              style={{ background: "var(--gradient-primary)" }}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.common.signup}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t.auth.haveAccount}{" "}
            <Link
              to="/login"
              className="font-medium text-primary hover:underline"
            >
              {t.common.login}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
