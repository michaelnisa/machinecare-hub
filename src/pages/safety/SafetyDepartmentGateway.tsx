import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  ShieldCheck,
  PhoneCall,
  Heart,
  Flame,
  AlertTriangle,
  LogIn,
  HardHat,
  Camera,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ClipboardList,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

const INCIDENT_TYPES = [
  { id: "near_miss", label: "Near Miss (Hazard Avoided)" },
  { id: "hazard", label: "Unsafe Condition / Hazard" },
  { id: "first_aid", label: "First Aid Injury" },
  { id: "accident", label: "Accident / Lost Time" },
];

const SEVERITIES = ["low", "medium", "high", "critical"];

export default function SafetyDepartmentGateway() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const orgIdParam = searchParams.get("org");
  const [organisation, setOrganisation] = useState<any>(null);
  const [loadingOrg, setLoadingOrg] = useState(true);

  // Active view: 'hub' | 'report_incident' | 'login'
  const [view, setView] = useState<"hub" | "report_incident" | "login">("hub");

  // Incident reporting state
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);
  const [incidentSubmitted, setIncidentSubmitted] = useState(false);
  const [incidentForm, setIncidentForm] = useState({
    incident_type: "near_miss",
    severity: "medium",
    description: "",
    location: "",
    reporter_name: "",
    reporter_contact: "",
  });

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  useEffect(() => {
    async function loadOrg() {
      setLoadingOrg(true);
      if (orgIdParam) {
        const { data } = await supabase
          .from("organisations")
          .select("id, name, logo_url, safety_emergency_phone, safety_first_aid_phone")
          .eq("id", orgIdParam)
          .maybeSingle();
        if (data) setOrganisation(data);
      } else {
        // Fetch first organisation or default
        const { data } = await supabase
          .from("organisations")
          .select("id, name, logo_url, safety_emergency_phone, safety_first_aid_phone")
          .limit(1)
          .maybeSingle();
        if (data) setOrganisation(data);
      }
      setLoadingOrg(false);
    }
    loadOrg();
  }, [orgIdParam]);

  const handleIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentForm.description.trim()) {
      return toast.error("Please provide a description of the safety issue");
    }
    setIncidentSubmitting(true);
    try {
      const payload: any = {
        organisation_id: organisation?.id,
        incident_type: incidentForm.incident_type,
        severity: incidentForm.severity,
        description: `[Public Safety Gate Report] ${incidentForm.description}${
          incidentForm.location ? ` | Location: ${incidentForm.location}` : ""
        }${
          incidentForm.reporter_name
            ? ` | Reporter: ${incidentForm.reporter_name} (${incidentForm.reporter_contact || "No phone"})`
            : ""
        }`,
        occurred_at: new Date().toISOString(),
        status: "open",
      };

      const { error } = await supabase.from("safety_incidents").insert(payload);
      if (error) throw error;

      setIncidentSubmitted(true);
      toast.success("Safety report successfully submitted to EHS Department!");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit report");
    } finally {
      setIncidentSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      return toast.error("Please enter both email and password");
    }
    setLoginSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });
      if (error) throw error;

      // Check user profile department
      const { data: prof } = await supabase
        .from("profiles")
        .select("department, role, organisation_id")
        .eq("id", data.user.id)
        .maybeSingle();

      toast.success(`Welcome back, ${data.user.email}!`);
      if (prof?.department === "safety") {
        navigate("/safety");
      } else {
        navigate("/contractor/portal");
      }
    } catch (err: any) {
      toast.error(err.message || "Invalid credentials");
    } finally {
      setLoginSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-foreground flex flex-col items-center p-4 sm:p-6">
      {/* Top Brand Header */}
      <header className="w-full max-w-md flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          {organisation?.logo_url ? (
            <img
              src={organisation.logo_url}
              alt="Logo"
              className="h-11 w-11 rounded-xl object-contain bg-white p-1 border border-border shadow-sm"
            />
          ) : (
            <div className="h-11 w-11 rounded-xl bg-[#00A651] text-white flex items-center justify-center font-black text-xl shadow-md">
              <ShieldCheck className="h-6 w-6" />
            </div>
          )}
          <div>
            <h1 className="font-extrabold text-sm tracking-tight text-foreground uppercase">
              {organisation?.name || "MachineCare"}
            </h1>
            <p className="text-[11px] font-semibold text-[#00A651] tracking-wide">
              Official Safety Care Gateway
            </p>
          </div>
        </div>

        <Badge className="bg-[#00A651]/15 text-[#00A651] border-[#00A651]/30 text-[10px] uppercase font-bold tracking-wider">
          LIVE GATE
        </Badge>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-md space-y-4 pb-12">
        {view === "hub" && (
          <div className="space-y-4 animate-fade-in">
            {/* Hero Card */}
            <Card className="border-2 border-[#00A651]/30 shadow-lg overflow-hidden relative">
              <div className="h-2 bg-[#00A651] w-full" />
              <CardHeader className="pb-3 text-center">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-[#00A651] flex items-center justify-center mb-1">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <CardTitle className="text-lg font-black tracking-tight">
                  Zero Harm Workplace
                </CardTitle>
                <CardDescription className="text-xs">
                  Scan verified • Report an incident or log in for Contractor Toolbox Talks & Tasks.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Immediate Action: Report Incident */}
                <button
                  onClick={() => {
                    setIncidentSubmitted(false);
                    setView("report_incident");
                  }}
                  className="w-full text-left p-4 rounded-2xl border-2 border-red-500/30 bg-red-50/70 dark:bg-red-950/30 hover:bg-red-100/70 transition-all flex items-center justify-between group shadow-sm"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-md">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-red-950 dark:text-red-300 flex items-center gap-1.5">
                        Report Accident / Hazard
                      </div>
                      <div className="text-xs text-red-800/80 dark:text-red-400">
                        Immediate anonymous or identified reporting
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-red-600 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* Login for More: Contractor & Safety Login */}
                <button
                  onClick={() => setView("login")}
                  className="w-full text-left p-4 rounded-2xl border-2 border-[#00A651]/40 bg-emerald-50/60 dark:bg-emerald-950/30 hover:bg-emerald-100/60 transition-all flex items-center justify-between group shadow-sm"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-xl bg-[#00A651] text-white flex items-center justify-center shadow-md">
                      <HardHat className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#00A651] dark:text-emerald-300 flex items-center gap-1.5">
                        Contractor &amp; Staff Login
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Toolbox talks, active works &amp; HSE reports
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-[#00A651] group-hover:translate-x-0.5 transition-transform" />
                </button>
              </CardContent>
            </Card>

            {/* Emergency Hotline Contacts */}
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <PhoneCall className="h-3.5 w-3.5 text-[#00A651]" /> Immediate Emergency Contacts
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <a
                  href={`tel:${organisation?.safety_emergency_phone || "999"}`}
                  className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors flex flex-col justify-between"
                >
                  <div className="flex items-center gap-1 text-[10px] font-bold text-[#00A651] uppercase">
                    <PhoneCall className="h-3 w-3" /> Safety Officer
                  </div>
                  <div className="text-xs font-bold text-foreground mt-1 truncate">
                    {organisation?.safety_emergency_phone || "Radio Ch 1"}
                  </div>
                </a>

                <a
                  href={`tel:${organisation?.safety_first_aid_phone || "999"}`}
                  className="p-3 rounded-xl border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-colors flex flex-col justify-between"
                >
                  <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 uppercase">
                    <Heart className="h-3 w-3" /> First Aid Post
                  </div>
                  <div className="text-xs font-bold text-foreground mt-1 truncate">
                    {organisation?.safety_first_aid_phone || "Clinic Ext 99"}
                  </div>
                </a>
              </CardContent>
            </Card>
          </div>
        )}

        {/* View 2: Report Incident Form */}
        {view === "report_incident" && (
          <Card className="border-border shadow-xl animate-fade-in">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setView("hub")}
                  className="text-xs text-muted-foreground hover:text-foreground font-medium"
                >
                  ← Back to Gateway
                </button>
                <Badge variant="outline" className="text-[10px] uppercase font-bold text-red-600 border-red-300">
                  Quick Report
                </Badge>
              </div>
              <CardTitle className="text-base font-bold mt-2">
                Report Safety Incident or Hazard
              </CardTitle>
              <CardDescription className="text-xs">
                Your report notifies the safety team immediately. All reports are taken seriously.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4">
              {incidentSubmitted ? (
                <div className="text-center py-6 space-y-3">
                  <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 text-[#00A651] flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h3 className="font-bold text-base">Report Dispatched!</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    The on-duty EHS Officer has received your alert and will follow up promptly. Thank you for keeping our workplace safe.
                  </p>
                  <Button
                    onClick={() => setView("hub")}
                    className="mt-2 bg-[#00A651] hover:bg-[#008f45] text-white text-xs"
                  >
                    Return to Gateway
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleIncidentSubmit} className="space-y-3.5">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Incident / Issue Type</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {INCIDENT_TYPES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setIncidentForm({ ...incidentForm, incident_type: t.id })}
                          className={`p-2 rounded-lg text-xs font-medium border text-left transition-colors ${
                            incidentForm.incident_type === t.id
                              ? "border-[#00A651] bg-emerald-50 text-[#00A651] font-bold"
                              : "border-border bg-card hover:bg-muted/50"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Severity</Label>
                    <div className="grid grid-cols-4 gap-1">
                      {SEVERITIES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setIncidentForm({ ...incidentForm, severity: s })}
                          className={`py-1.5 text-xs rounded-md capitalize font-semibold border ${
                            incidentForm.severity === s
                              ? "bg-red-600 text-white border-red-600 shadow-sm"
                              : "border-border bg-card text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Location / Plant Area / Machine</Label>
                    <Input
                      placeholder="e.g. Line 2 Filling Station, Workshop B, Crane 4"
                      value={incidentForm.location}
                      onChange={(e) => setIncidentForm({ ...incidentForm, location: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Describe What Happened / Unsafe Condition *</Label>
                    <Textarea
                      required
                      rows={3}
                      placeholder="Explain what occurred, any hazards present, or injuries sustained..."
                      value={incidentForm.description}
                      onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Your Name (Optional)</Label>
                      <Input
                        placeholder="John Doe"
                        value={incidentForm.reporter_name}
                        onChange={(e) => setIncidentForm({ ...incidentForm, reporter_name: e.target.value })}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Phone (Optional)</Label>
                      <Input
                        placeholder="+255 7..."
                        value={incidentForm.reporter_contact}
                        onChange={(e) => setIncidentForm({ ...incidentForm, reporter_contact: e.target.value })}
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={incidentSubmitting}
                    className="w-full bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-bold gap-2 py-2.5 mt-2"
                  >
                    {incidentSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                      </>
                    ) : (
                      <>Submit Safety Report</>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}

        {/* View 3: Contractor & Staff Login */}
        {view === "login" && (
          <Card className="border-border shadow-xl animate-fade-in">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setView("hub")}
                  className="text-xs text-muted-foreground hover:text-foreground font-medium"
                >
                  ← Back to Gateway
                </button>
                <Badge variant="outline" className="text-[10px] uppercase font-bold text-[#00A651] border-[#00A651]/30">
                  Authorized Sign In
                </Badge>
              </div>
              <CardTitle className="text-base font-bold mt-2">
                Contractor &amp; Staff Login
              </CardTitle>
              <CardDescription className="text-xs">
                Log in to submit shift Toolbox Talks, view work orders, or suspend work.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4">
              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Email / Account</Label>
                  <Input
                    type="email"
                    required
                    placeholder="user@contractor.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Password</Label>
                  <Input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loginSubmitting}
                  className="w-full bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-bold gap-2 py-2.5 mt-2"
                >
                  {loginSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Authenticating...
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" /> Sign In to Safety Workspace
                    </>
                  )}
                </Button>

                <p className="text-[11px] text-center text-muted-foreground pt-1">
                  Need contractor access? Ask your site Safety Officer for an invitation.
                </p>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
