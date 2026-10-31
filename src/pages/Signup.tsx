import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SolutionSuitePicker, SOLUTION_SUITES, type SolutionSuite } from "@/components/SolutionSuitePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Wrench, Loader2, ArrowLeft, CheckCircle2, Building2, UserPlus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// ── Zod Schemas ────────────────────────────────────────────────
const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  company_name: z.string().trim().max(100).optional(),
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

const onboardingSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  contact: z.string().trim().min(5, "Contact info must be at least 5 characters (email or phone)").max(255),
  company: z.string().trim().min(2, "Company name must be at least 2 characters").max(100),
});

type SignupFormValues = z.infer<typeof signupSchema>;
type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export default function Signup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const orgInviteToken = params.get("invite") || params.get("token");
  const rawEmail = params.get("email") || "";
  const inviteEmail = rawEmail.includes("@") ? rawEmail : "";
  const paramCompany = params.get("company") || "";

  const { t, currentLang } = useI18n();
  const isSwahili = currentLang === "sw";

  const [activeTab, setActiveTab] = useState<"signup" | "demo">("signup");
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [selectedSuite, setSelectedSuite] = useState<SolutionSuite>(() => {
    const indParam = params.get("industry") || params.get("suite");
    if (indParam) {
      const match = SOLUTION_SUITES.find(
        (s) => s.id === indParam || s.recommendedIndustry === indParam
      );
      if (match) return match;
    }
    return SOLUTION_SUITES[0];
  });
  const [accountTier, setAccountTier] = useState<"standard" | "enterprise">("standard");
  const [resending, setResending] = useState(false);

  const handleResendEmail = async () => {
    if (!emailSent) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: emailSent,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    setResending(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        isSwahili
          ? "Barua pepe imetumwa tena! Hakikisha kuangalia kwenye folda ya Spam/Junk."
          : "Verification email resent! Please check your Inbox and Spam/Junk folder."
      );
    }
  };

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  // ── Signup Form ──────────────────────────────────────────────
  const signupForm = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      full_name: "",
      company_name: paramCompany || "",
      email: inviteEmail || "",
      password: "",
    },
  });

  // ── Onboarding Form ──────────────────────────────────────────
  const onboardingForm = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { name: "", contact: "", company: "" },
  });

  const onSignupSubmit = async (values: SignupFormValues) => {
    if (!accepted) {
      toast.error(
        isSwahili
          ? "Tafadhali kubali Vigezo vya Huduma na Sera ya Faragha"
          : "Please accept the Terms of Service & Privacy Policy"
      );
      return;
    }

    if (inviteEmail && values.email.toLowerCase() !== inviteEmail.toLowerCase()) {
      toast.error(t.auth.inviteEmailMismatch || "Email does not match invite");
      return;
    }

    setSubmitting(true);
    try {
      const company = values.company_name?.trim() || "My Company";
      const signupMetaData: Record<string, any> = {
        full_name: values.full_name.trim(),
        company_name: company,
        organisation_name: company,
        plan: accountTier,
        enabled_modules: selectedSuite.modules,
        industry_profile: params.get("industry") || selectedSuite.recommendedIndustry,
      };

      if (orgInviteToken) {
        signupMetaData.invite_token = orgInviteToken;
      }

      const { data, error } = await supabase.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: signupMetaData,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.session) {
        // Immediate session without confirmation
        toast.success(
          isSwahili
            ? "Akaunti imefunguliwa kikamilifu! Karibu MachineCare."
            : "Account created successfully! Welcome to MachineCare."
        );
        navigate("/dashboard", { replace: true });
      } else {
        // Supabase requires email verification
        setEmailSent(values.email.trim());
      }
    } catch (err: any) {
      console.error("Signup error:", err);
      const msg = err?.message || "Failed to create account. Please try again.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onOnboardingSubmit = async (values: OnboardingFormValues) => {
    if (!accepted) {
      toast.error(
        isSwahili ? "Tafadhali kubali vigezo na masharti" : "Please accept the Terms & Conditions"
      );
      return;
    }
    setSubmitting(true);
    try {
      const corePayload = {
        name: values.name.trim(),
        contact: values.contact.trim(),
        company: values.company.trim(),
        industry: `${selectedSuite.recommendedIndustry} (${selectedSuite.name} - ${accountTier.toUpperCase()})`,
        status: "pending",
        plan: accountTier,
        enabled_modules: selectedSuite.modules,
      };

      const { error: insertError } = await (supabase as any)
        .from("onboarding_requests")
        .insert(corePayload);

      if (insertError) {
        console.warn("Primary insert failed, retrying with raw industry:", insertError.message);
        const { error: retryError } = await (supabase as any)
          .from("onboarding_requests")
          .insert({
            name: values.name.trim(),
            contact: values.contact.trim(),
            company: values.company.trim(),
            industry: selectedSuite.recommendedIndustry,
            status: "pending",
          });
        if (retryError) throw retryError;
      }

      // Dispatch optional SMS non-blocking
      try {
        await supabase.functions.invoke("notify-onboarding-request-sms", {
          body: {
            name: values.name,
            contact: values.contact,
            company: values.company,
            industry: `${selectedSuite.name} (${accountTier.toUpperCase()})`,
          },
        });
      } catch (smsErr) {
        console.warn("SMS notification dispatch failed (non-blocking):", smsErr);
      }

      setRequestSubmitted(true);
      toast.success(isSwahili ? "Ombi limetumwa kikamilifu!" : "Request submitted successfully!");
    } catch (err: any) {
      console.error("Onboarding request error:", err);
      const errMsg =
        err?.message ||
        (isSwahili ? "Imeshindwa kutuma ombi. Tafadhali jaribu tena." : "Failed to submit request. Please try again.");
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Confirmation: Email verification sent ────────────────────
  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl animate-fade-in">
          <CheckCircle2 className="mx-auto mb-3 h-14 w-14 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">{t.auth.checkInbox}</h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {t.auth.confirmSentTo}{" "}
            <span className="font-semibold text-foreground">{emailSent}</span>.
          </p>

          <div className="my-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-left text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
            <p className="font-semibold flex items-center gap-1.5">
              <span>⚠️</span>
              <span>{isSwahili ? "Huoni barua pepe?" : "Can't find the email?"}</span>
            </p>
            <p className="opacity-90 leading-relaxed">
              {isSwahili
                ? "Tafadhali angalia folda yako ya Spam au Junk. Barua pepe za uthibitisho hutumwa kutoka kwa Supabase na zinaweza kuwekwa huko kimakosa."
                : "Please check your Spam, Junk, or Promotions folder. Verification emails are sent from Supabase and may be filtered there by mistake."}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={handleResendEmail}
              disabled={resending}
              className="w-full h-10 text-xs"
            >
              {resending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSwahili ? "Tuma Kiungo cha Uthibitisho Tena" : "Resend Verification Email"}
            </Button>
            <Button asChild className="w-full h-10" style={{ background: "var(--gradient-primary)" }}>
              <Link to="/login">{t.common.login}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/">{t.common.back} to Home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Confirmation: Onboarding request sent ────────────────────
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
              ? "Asante kwa kuonyesha nia na MachineCare. Ombi lako limesajiliwa na timu yetu ya onboarding itawasiliana nawe hivi karibuni."
              : "Thank you for your interest in MachineCare. Your request has been registered and our onboarding team will contact you shortly."}
          </p>
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
          {/* Header branding */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground"
                style={{ background: "var(--gradient-primary)" }}
              >
                <Wrench className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold tracking-tight">{t.common.appName}</span>
            </div>

            {!orgInviteToken && (
              <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 text-xs bg-muted/40">
                <button
                  type="button"
                  onClick={() => setActiveTab("signup")}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                    activeTab === "signup"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isSwahili ? "Fungua Akaunti" : "Create Account"}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("demo")}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                    activeTab === "demo"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isSwahili ? "Omba Demo" : "Request Demo"}
                </button>
              </div>
            )}
          </div>

          {activeTab === "signup" ? (
            // ── FLOW 1: Direct Account Registration ──
            <>
              <h1 className="mb-1 text-2xl font-bold tracking-tight">
                {orgInviteToken
                  ? t.auth.joinTeam || "Join Your Team"
                  : isSwahili
                  ? "Fungua Akaunti ya Kampuni"
                  : "Create Your Account"}
              </h1>
              <p className="mb-6 text-sm text-muted-foreground">
                {orgInviteToken
                  ? t.auth.joinTeamSub || "Complete registration to access your shared workspace."
                  : isSwahili
                  ? "Jiunge na MachineCare kwa sekunde chache ili uanze kusimamia vifaa vyako."
                  : "Get started in seconds with real-time fleet, machines & maintenance care."}
              </p>

              <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="full_name">{t.auth.yourName || "Full Name"}</Label>
                  <Input
                    id="full_name"
                    placeholder={isSwahili ? "Mf. Juma Yusuf" : "e.g. John Doe"}
                    {...signupForm.register("full_name")}
                  />
                  {signupForm.formState.errors.full_name && (
                    <p className="text-xs text-destructive">
                      {signupForm.formState.errors.full_name.message}
                    </p>
                  )}
                </div>

                {!orgInviteToken && (
                  <div className="space-y-1.5">
                    <Label htmlFor="company_name">
                      {isSwahili ? "Jina la Kampuni" : "Company / Organisation"}
                    </Label>
                    <Input
                      id="company_name"
                      placeholder={isSwahili ? "Mf. Mwananchi Logistics Ltd" : "e.g. Apex Industrial Ltd"}
                      {...signupForm.register("company_name")}
                    />
                    {signupForm.formState.errors.company_name && (
                      <p className="text-xs text-destructive">
                        {signupForm.formState.errors.company_name.message}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">{t.auth.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    {...signupForm.register("email")}
                    readOnly={!!inviteEmail}
                  />
                  {signupForm.formState.errors.email && (
                    <p className="text-xs text-destructive">
                      {signupForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">{t.auth.password}</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    {...signupForm.register("password")}
                  />
                  {signupForm.formState.errors.password && (
                    <p className="text-xs text-destructive">
                      {signupForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                {!orgInviteToken && (
                  <div className="pt-2">
                    <SolutionSuitePicker
                      selectedSuiteId={selectedSuite.id}
                      onSelectSuite={setSelectedSuite}
                      accountTier={accountTier}
                      onChangeAccountTier={setAccountTier}
                    />
                  </div>
                )}

                <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer pt-1">
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
                  className="h-11 w-full text-base font-semibold mt-2"
                  disabled={submitting}
                  style={{ background: "var(--gradient-primary)" }}
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {orgInviteToken
                    ? isSwahili ? "Jiunge na Timu" : "Join Workspace"
                    : isSwahili ? "Fungua Akaunti Sasa" : "Create Account"}
                </Button>
              </form>
            </>
          ) : (
            // ── FLOW 2: Enterprise Demo / Onboarding Request ──
            <>
              <h1 className="mb-1.5 text-2xl font-bold tracking-tight">
                {isSwahili ? "Omba Kujiunga" : "Request Enterprise Demo"}
              </h1>
              <p className="mb-6 text-sm text-muted-foreground leading-normal">
                {isSwahili
                  ? "Jaza fomu hii na wataalamu wetu watawasiliana nawe ili kusanidi mfumo kulingana na mahitaji yako."
                  : "Tell us about your organization and our specialists will arrange a tailored enterprise demonstration."}
              </p>

              <form onSubmit={onboardingForm.handleSubmit(onOnboardingSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="demo_name">{isSwahili ? "Jina Kamili" : "Your Name"}</Label>
                  <Input
                    id="demo_name"
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
                  <Label htmlFor="demo_contact">{isSwahili ? "Njia ya Mawasiliano" : "Contact Details"}</Label>
                  <Input
                    id="demo_contact"
                    placeholder={isSwahili ? "Barua pepe au simu" : "Email address or phone number"}
                    {...onboardingForm.register("contact")}
                  />
                  {onboardingForm.formState.errors.contact && (
                    <p className="text-xs text-destructive">
                      {onboardingForm.formState.errors.contact.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="demo_company">{isSwahili ? "Jina la Kampuni" : "Company / Organisation"}</Label>
                  <Input
                    id="demo_company"
                    placeholder={isSwahili ? "Mf. Kiwanda cha Saruji Ltd" : "e.g. Acme Industrial Ltd"}
                    {...onboardingForm.register("company")}
                  />
                  {onboardingForm.formState.errors.company && (
                    <p className="text-xs text-destructive">
                      {onboardingForm.formState.errors.company.message}
                    </p>
                  )}
                </div>

                <div className="pt-1">
                  <SolutionSuitePicker
                    selectedSuiteId={selectedSuite.id}
                    onSelectSuite={setSelectedSuite}
                    accountTier={accountTier}
                    onChangeAccountTier={setAccountTier}
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
                          Vigezo
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
                  {isSwahili ? "Tuma Ombi la Demo" : "Submit Demo Request"}
                </Button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t.auth.haveAccount || "Already have an account?"}{" "}
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
