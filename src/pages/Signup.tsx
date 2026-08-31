import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { IndustryProfile } from "@/hooks/useIndustry";
import { IndustryPicker } from "@/components/IndustryPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Wrench, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// ── Zod schemas ────────────────────────────────────────────────
const inviteSchema = z.object({
  full_name: z.string().trim().min(2, "Required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
});

const onboardingSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  contact: z.string().trim().min(5, "Contact info must be at least 5 characters (email or phone)").max(255),
  company: z.string().trim().min(2, "Company name must be at least 2 characters").max(100),
});

type InviteFormValues = z.infer<typeof inviteSchema>;
type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export default function Signup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inviteToken = params.get("invite");
  const inviteEmail = params.get("email");
  const { t, currentLang } = useI18n();
  const isSwahili = currentLang === "sw";

  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [industryProfile, setIndustryProfile] = useState<IndustryProfile>("manufacturing");

  useEffect(() => {
    if (user && inviteToken) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate, inviteToken]);

  // ── Invite form setup ──────────────────────────────────────────
  const inviteForm = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: inviteEmail ?? "" },
  });

  // ── Onboarding form setup ──────────────────────────────────────
  const onboardingForm = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { name: "", contact: "", company: "" },
  });

  const onInviteSubmit = async (values: InviteFormValues) => {
    if (!accepted) {
      toast.error(t.auth.mustAcceptTos);
      return;
    }
    if (inviteToken && inviteEmail && values.email.toLowerCase() !== inviteEmail.toLowerCase()) {
      toast.error(t.auth.inviteEmailMismatch);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: values.full_name,
          invite_token: inviteToken,
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

  const onOnboardingSubmit = async (values: OnboardingFormValues) => {
    if (!accepted) {
      toast.error(isSwahili ? "Tafadhali kubali vigezo na masharti" : "Please accept the Terms & Conditions");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from("onboarding_requests").insert({
        name: values.name,
        contact: values.contact,
        company: values.company,
        industry: industryProfile,
        status: "pending",
      });

      if (error) {
        throw error;
      }

      setRequestSubmitted(true);
      toast.success(isSwahili ? "Ombi limetumwa kikamilifu!" : "Request submitted successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(isSwahili ? "Imeshindwa kutuma ombi. Tafadhali jaribu tena." : "Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Email sent confirmation (For Invited Users) ─────────────
  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-xl">
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

  // ── Onboarding Request success screen ──────────────────────
  if (requestSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary to-orange-500" />
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">
            {isSwahili ? "Ombi Limepokelewa!" : "Request Received!"}
          </h1>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            {isSwahili 
              ? "Asante kwa kuonyesha nia na MachineCare. Ombi lako limesajiliwa na timu yetu ya onboarding itawasiliana nawe hivi karibuni ili kukufungulia akaunti ya kampuni yako."
              : "Thank you for your interest in MachineCare. Your request has been registered and our onboarding team will contact you shortly to set up your workspace."}
          </p>
          <div className="mt-6 p-4 rounded-xl bg-secondary/60 text-xs text-left text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground">{isSwahili ? "Hatua inayofuata:" : "What happens next?"}</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>{isSwahili ? "Tunahakiki sekta na maelezo ya kampuni yako." : "We review your company and industry profile."}</li>
              <li>{isSwahili ? "Tunakupigia simu au kukutumia barua pepe kukamilisha usanidi." : "We schedule a call or email you to complete setup."}</li>
              <li>{isSwahili ? "Unapokea kiungo cha kujisajili na kuanza kutumia mfumo." : "You receive an invite link to activate your workspace."}</li>
            </ol>
          </div>
          <Button asChild className="mt-8 w-full h-11" style={{ background: "var(--gradient-primary)" }}>
            <Link to="/">{isSwahili ? "Rudi Nyumbani" : "Return to Home"}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      {/* Brand panel */}
      <div
        className="hidden md:flex md:flex-col md:items-center md:justify-center md:p-12 md:text-primary-foreground relative overflow-hidden"
        style={{ background: "var(--gradient-primary)" }}
      >
        <div aria-hidden className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
        <div className="max-w-md text-center z-10">
          <Wrench className="mx-auto mb-6 h-16 w-16 opacity-90" />
          <h2 className="text-4xl font-bold leading-tight tracking-tight">{t.home.tagline}</h2>
          <p className="mt-4 text-base opacity-90 leading-relaxed">{t.home.hero}</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center px-4 py-10 bg-background">
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

        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2.5">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Wrench className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">{t.common.appName}</span>
          </div>

          {inviteToken ? (
            // ── FLOW A: Invited user registration ──
            <>
              <h1 className="mb-1 text-3xl font-bold tracking-tight">
                {t.auth.joinTeam}
              </h1>
              <p className="mb-6 text-sm text-muted-foreground">
                {t.auth.joinTeamSub}
              </p>

              <form onSubmit={inviteForm.handleSubmit(onInviteSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="full_name">{t.auth.yourName}</Label>
                  <Input id="full_name" {...inviteForm.register("full_name")} />
                  {inviteForm.formState.errors.full_name && (
                    <p className="text-xs text-destructive">
                      {inviteForm.formState.errors.full_name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">{t.auth.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    {...inviteForm.register("email")}
                    readOnly={!!inviteEmail}
                  />
                  {inviteForm.formState.errors.email && (
                    <p className="text-xs text-destructive">
                      {inviteForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">{t.auth.password}</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    {...inviteForm.register("password")}
                  />
                  {inviteForm.formState.errors.password && (
                    <p className="text-xs text-destructive">
                      {inviteForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
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
            </>
          ) : (
            // ── FLOW B: Public onboarding request ──
            <>
              <h1 className="mb-1.5 text-3xl font-bold tracking-tight">
                {isSwahili ? "Omba Kujiunga" : "Request Access"}
              </h1>
              <p className="mb-6 text-sm text-muted-foreground leading-normal">
                {isSwahili
                  ? "MachineCare kwa sasa inajiendesha kwa waalikwa pekee ili kuhakikisha huduma bora. Jaza fomu hii na timu yetu itawasiliana nawe ili kufungua akaunti ya kampuni yako."
                  : "MachineCare is currently an invite-only platform to ensure high-quality onboarding. Fill out this form and our team will get in touch to set up your workspace."}
              </p>

              <form onSubmit={onboardingForm.handleSubmit(onOnboardingSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">{isSwahili ? "Jina Kamili" : "Your Name"}</Label>
                  <Input 
                    id="name" 
                    placeholder={isSwahili ? "Mf. Juma Yusuf" : "e.g. John Doe"}
                    {...onboardingForm.register("name")} 
                  />
                  {onboardingForm.formState.errors.name && (
                    <p className="text-xs text-destructive">
                      {onboardingForm.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contact">{isSwahili ? "Njia ya Mawasiliano" : "Contact Details"}</Label>
                  <Input
                    id="contact"
                    placeholder={isSwahili ? "Barua pepe au namba ya simu" : "Email address or phone number"}
                    {...onboardingForm.register("contact")}
                  />
                  {onboardingForm.formState.errors.contact && (
                    <p className="text-xs text-destructive">
                      {onboardingForm.formState.errors.contact.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="company">{isSwahili ? "Jina la Kampuni" : "Company / Organisation"}</Label>
                  <Input
                    id="company"
                    placeholder={isSwahili ? "Mf. Kiwanda cha Ngozi Ltd" : "e.g. Acme Industrial Ltd"}
                    {...onboardingForm.register("company")}
                  />
                  {onboardingForm.formState.errors.company && (
                    <p className="text-xs text-destructive">
                      {onboardingForm.formState.errors.company.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{isSwahili ? "Sekta Yenu" : "Industry type"}</Label>
                  <IndustryPicker
                    value={industryProfile}
                    onChange={setIndustryProfile}
                  />
                </div>

                <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer pt-2">
                  <Checkbox
                    checked={accepted}
                    onCheckedChange={(v) => setAccepted(!!v)}
                    className="mt-0.5"
                  />
                  <span>
                    {isSwahili ? (
                      <>
                        Ninakubali{" "}
                        <Link to="/terms" className="text-primary hover:underline">
                          Vigezo vya Huduma
                        </Link>{" "}
                        na{" "}
                        <Link to="/privacy" className="text-primary hover:underline">
                          Sera ya Faragha
                        </Link>
                        .
                      </>
                    ) : (
                      <>
                        I agree to the{" "}
                        <Link to="/terms" className="text-primary hover:underline">
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link to="/privacy" className="text-primary hover:underline">
                          Privacy Policy
                        </Link>
                        .
                      </>
                    )}
                  </span>
                </label>

                <Button
                  type="submit"
                  className="h-11 w-full text-base font-semibold mt-4"
                  disabled={submitting}
                  style={{ background: "var(--gradient-primary)" }}
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSwahili ? "Tuma Ombi la Kujiunga" : "Submit Access Request"}
                </Button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t.auth.haveAccount}{" "}
            <Link
              to="/login"
              className="font-semibold text-primary hover:underline transition-colors"
            >
              {t.common.login}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
