import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CoverImage } from "@/components/CoverImage";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/PageLoader";
import { Wrench, ArrowRight, AlertTriangle, Gauge, Fuel, BookOpen, ClipboardList, LogIn, CheckCircle2, ClipboardCheck, Route } from "lucide-react";
import { ServiceLogDialog } from "@/components/ServiceLogDialog";
import { UpdateReadingDialog } from "@/components/UpdateReadingDialog";
import { QuickFuelDialog } from "@/components/QuickFuelDialog";
import { QuickStartTripDialog } from "@/components/QuickStartTripDialog";
import { StartInspectionDialog } from "@/components/StartInspectionDialog";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  maintenance: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  inactive: "bg-muted text-muted-foreground",
  retired: "bg-muted text-muted-foreground",
};

const T = {
  en: {
    notFound: "Machine not found.",
    org: "Organisation",
    reg: "Reg",
    sn: "S/N",
    hours: "Current hours",
    reportFault: "Report a fault",
    yourName: "Your name",
    yourPhone: "Phone number",
    whatHappened: "What happened?",
    severity: "How serious is it?",
    severityMinor: "Minor",
    severityMajor: "Major",
    severityCritical: "Critical — machine unsafe/unusable",
    addPhoto: "Add a photo (optional)",
    submit: "Submit report",
    submitted: "Thanks — your report has been sent to the maintenance team.",
    signInPrompt: "Sign in to access more actions",
    signIn: "Sign in",
    logService: "Log a service",
    updateReading: "Update hours / km",
    logFuel: "Log fuel",
    myWOs: "My open work orders",
    recentHistory: "Recent history",
    knowledge: "Knowledge base",
    start: "Start",
    complete: "Complete",
    full: "Open full machine details",
    requireFields: "Please fill in your name, phone and a short description.",
    submitting: "Sending…",
    started: "Marked in progress",
    completed: "Marked complete",
    quickInspect: "Quick inspection",
    startTrip: "Start trip",
  },
  sw: {
    notFound: "Mashine haijapatikana.",
    org: "Shirika",
    reg: "Namba",
    sn: "Nambari ya kifaa",
    hours: "Masaa ya sasa",
    reportFault: "Ripoti tatizo",
    yourName: "Jina lako",
    yourPhone: "Nambari ya simu",
    whatHappened: "Ni nini kimetokea?",
    severity: "Ni kali kiasi gani?",
    severityMinor: "Ndogo",
    severityMajor: "Kubwa",
    severityCritical: "Hatari — mashine si salama/haifanyi kazi",
    addPhoto: "Ongeza picha (hiari)",
    submit: "Tuma ripoti",
    submitted: "Asante — ripoti yako imetumwa kwa timu ya matengenezo.",
    signInPrompt: "Ingia ili kupata huduma zaidi",
    signIn: "Ingia",
    logService: "Andika huduma",
    updateReading: "Sasisha masaa / km",
    logFuel: "Andika mafuta",
    myWOs: "Kazi zangu zilizo wazi",
    recentHistory: "Historia ya hivi karibuni",
    knowledge: "Maarifa",
    start: "Anza",
    complete: "Maliza",
    full: "Fungua taarifa kamili ya mashine",
    requireFields: "Tafadhali jaza jina lako, simu na maelezo mafupi.",
    submitting: "Inatuma…",
    started: "Imeanzishwa",
    completed: "Imekamilika",
    quickInspect: "Ukaguzi wa haraka",
    startTrip: "Anza safari",
  },
};

export default function MobileMachine() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const { lang } = useI18n();
  const t = T[lang];

  const [machine, setMachine] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [readingOpen, setReadingOpen] = useState(false);
  const [fuelOpen, setFuelOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [tripOpen, setTripOpen] = useState(false);

  // fault report form (visible when not signed in, different org, or when a signed-in own-org user clicks "Report fault")
  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [faultDesc, setFaultDesc] = useState("");
  const [faultSeverity, setFaultSeverity] = useState("major");
  const [faultPhoto, setFaultPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showFaultForm, setShowFaultForm] = useState(false);

  // signed-in extras
  const [myWOs, setMyWOs] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [kb, setKb] = useState<any[]>([]);

  const isOwnOrg = !!profile && machine && profile.organisation_id === machine.organisation_id;

  useEffect(() => {
    if (user && isOwnOrg && profile) {
      setReporterName(profile.full_name ?? "");
      setReporterPhone(profile.phone ?? "");
    }
  }, [user, isOwnOrg, profile]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    (supabase as any).rpc("get_machine_public", { _machine_id: id }).then(({ data, error }: any) => {
      if (error || !data || data.length === 0) {
        setMachine(null);
      } else {
        setMachine(data[0]);
      }
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!user || !machine || !isOwnOrg) return;
    // Load my open WOs on this machine + recent history + KB
    supabase
      .from("work_orders")
      .select("id, wo_number, title, status, priority, due_date")
      .eq("machine_id", machine.id)
      .eq("assignee_id", user.id)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setMyWOs(data ?? []));

    supabase
      .from("service_logs")
      .select("id, title, performed_at, service_type")
      .eq("machine_id", machine.id)
      .order("performed_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setHistory(data ?? []));

    supabase
      .from("knowledge_items")
      .select("id, title, category")
      .eq("machine_id", machine.id)
      .limit(5)
      .then(({ data }) => setKb(data ?? []));
  }, [user, machine, isOwnOrg]);

  const submitFault = async () => {
    if (!machine) return;
    if (!reporterName.trim() || !reporterPhone.trim() || !faultDesc.trim()) {
      toast.error(t.requireFields);
      return;
    }
    setSubmitting(true);
    try {
      let photo_url: string | null = null;
      if (faultPhoto) {
        if (faultPhoto.size > 5 * 1024 * 1024) {
          toast.error("Photo too large. Please keep it under 5 MB.");
          setSubmitting(false);
          return;
        }
        const ext = (faultPhoto.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${machine.organisation_id}/faults/${machine.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("machine-docs")
          .upload(path, faultPhoto, { contentType: faultPhoto.type, upsert: false });
        if (upErr) throw upErr;
        photo_url = path;
      }

      const { error } = await (supabase as any).from("fault_reports").insert({
        organisation_id: machine.organisation_id,
        machine_id: machine.id,
        reporter_name: reporterName.trim(),
        reporter_phone: reporterPhone.trim(),
        description: faultDesc.trim(),
        severity: faultSeverity,
        photo_url,
        created_by: user?.id ?? null,
      });
      if (error) throw error;

      setSubmitted(true);
      setFaultDesc("");
      setFaultPhoto(null);
      setFaultSeverity("major");
      if (!user || !isOwnOrg) { setReporterName(""); setReporterPhone(""); }
      toast.success(t.submitted);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) return <PageLoader />;

  if (!machine) return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-md text-center">
        <p className="text-muted-foreground">{t.notFound}</p>
        <Link to="/" className="mt-4 inline-block text-primary hover:underline">Home</Link>
      </div>
    </div>
  );

  const statusClass = STATUS_COLORS[machine.status] ?? "bg-muted text-muted-foreground";

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-md space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wrench className="h-5 w-5" />
            </div>
            <span className="font-semibold">MachineCare</span>
          </div>
          <LanguageSwitcher />
        </div>

        {/* Identity card */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {machine.cover_image_url && (
            <div className="aspect-video w-full overflow-hidden bg-muted">
              <CoverImage value={machine.cover_image_url} alt={machine.name} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="p-5 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-semibold leading-tight">{machine.name}</h1>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusClass}`}>
                {machine.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {[machine.make, machine.model, machine.year].filter(Boolean).join(" · ") || machine.category}
            </p>
            <p className="text-xs text-muted-foreground">{t.org}: {machine.organisation_name}</p>
            <div className="grid grid-cols-2 gap-1 pt-1 text-xs">
              {machine.registration_number && (
                <p><span className="text-muted-foreground">{t.reg}:</span> {machine.registration_number}</p>
              )}
              {machine.serial_number && (
                <p><span className="text-muted-foreground">{t.sn}:</span> {machine.serial_number}</p>
              )}
              {machine.plate_number && (
                <p><span className="text-muted-foreground">Plate:</span> {machine.plate_number}</p>
              )}
              {machine.current_hours != null && (
                <p className="col-span-2"><span className="text-muted-foreground">{t.hours}:</span> {Number(machine.current_hours).toLocaleString()}</p>
              )}
              {machine.last_service_date && (
                <p className="col-span-2"><span className="text-muted-foreground">Last service:</span> {format(new Date(machine.last_service_date), "d MMM yyyy")}</p>
              )}
            </div>
          </div>
        </div>

        {/* Pre-start inspection — no login required */}
        <Link
          to={`/m/${machine.id}/inspect`}
          className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary-soft p-4 text-sm font-medium text-primary hover:border-primary/50"
        >
          <span className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" /> Pre-Start Inspection
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>

        {/* Signed-in: role-aware quick actions */}
        {user && isOwnOrg && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-14 flex-col gap-1" onClick={() => setInspectOpen(true)}>
                <ClipboardCheck className="h-4 w-4" />
                <span className="text-[11px] leading-tight">{t.quickInspect}</span>
              </Button>
              <Button className="h-14 flex-col gap-1" onClick={() => setLogOpen(true)}>
                <Wrench className="h-4 w-4" />
                <span className="text-[11px] leading-tight">{t.logService}</span>
              </Button>
              <Button variant="outline" className="h-14 flex-col gap-1" onClick={() => setReadingOpen(true)}>
                <Gauge className="h-4 w-4" />
                <span className="text-[11px] leading-tight">{t.updateReading}</span>
              </Button>
              <Button variant="outline" className="h-14 flex-col gap-1" onClick={() => setFuelOpen(true)}>
                <Fuel className="h-4 w-4" />
                <span className="text-[11px] leading-tight">{t.logFuel}</span>
              </Button>
              <Button variant="outline" className="h-14 flex-col gap-1" onClick={() => { setShowFaultForm((v) => !v); setSubmitted(false); }}>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-[11px] leading-tight">{t.reportFault}</span>
              </Button>
              {machine.category === "Vehicle" && (
                <Button variant="outline" className="col-span-2 h-12 gap-2" onClick={() => setTripOpen(true)}>
                  <Route className="h-4 w-4" />
                  <span className="text-sm">{t.startTrip}</span>
                </Button>
              )}
            </div>

            {myWOs.length > 0 && (
              <Section icon={<ClipboardList className="h-4 w-4" />} title={t.myWOs}>
                <ul className="divide-y divide-border">
                  {myWOs.map((w) => (
                    <li key={w.id} className="space-y-2 py-2 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/work-orders`} className="block flex-1">
                          <span className="font-medium">{w.wo_number ? `WO-${String(w.wo_number).padStart(4, "0")} · ` : ""}{w.title}</span>
                          <div className="text-xs text-muted-foreground capitalize">{w.status} · {w.priority}</div>
                        </Link>
                      </div>
                      <div className="flex gap-2">
                        {w.status === "open" && (
                          <Button size="sm" variant="outline" className="h-8" onClick={async () => {
                            const { error } = await supabase.from("work_orders").update({ status: "in_progress" }).eq("id", w.id);
                            if (error) return toast.error(error.message);
                            toast.success(t.started);
                            setMyWOs((prev) => prev.map((x) => x.id === w.id ? { ...x, status: "in_progress" } : x));
                          }}>{t.start}</Button>
                        )}
                        {w.status === "in_progress" && (
                          <Button size="sm" className="h-8" onClick={async () => {
                            const { error } = await supabase.from("work_orders").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", w.id);
                            if (error) return toast.error(error.message);
                            toast.success(t.completed);
                            setMyWOs((prev) => prev.filter((x) => x.id !== w.id));
                          }}>
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />{t.complete}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {history.length > 0 && (
              <Section icon={<BookOpen className="h-4 w-4" />} title={t.recentHistory}>
                <ul className="divide-y divide-border">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="truncate">{h.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {h.performed_at ? format(new Date(h.performed_at), "d MMM yy") : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {kb.length > 0 && (
              <Section icon={<BookOpen className="h-4 w-4" />} title={t.knowledge}>
                <ul className="divide-y divide-border">
                  {kb.map((k) => (
                    <li key={k.id} className="py-2 text-sm">
                      <span className="font-medium">{k.title}</span>
                      <span className="ml-2 text-xs text-muted-foreground capitalize">{k.category}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Link to={`/machines/${machine.id}`} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-sm hover:border-primary/40">
              <span className="font-medium">{t.full}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </>
        )}

        {/* Fault report form: always available to anonymous/different-org visitors; for a signed-in own-org user it's toggled via the "Report fault" quick action */}
        {(!user || !isOwnOrg || showFaultForm) && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h2 className="font-semibold">{t.reportFault}</h2>
            </div>
            {submitted ? (
              <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{t.submitted}</p>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder={t.yourName}
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
                <input
                  type="tel"
                  placeholder={t.yourPhone}
                  value={reporterPhone}
                  onChange={(e) => setReporterPhone(e.target.value)}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
                <textarea
                  placeholder={t.whatHappened}
                  value={faultDesc}
                  onChange={(e) => setFaultDesc(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background p-3 text-sm"
                />
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">{t.severity}</label>
                  <select
                    value={faultSeverity}
                    onChange={(e) => setFaultSeverity(e.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="minor">{t.severityMinor}</option>
                    <option value="major">{t.severityMajor}</option>
                    <option value="critical">{t.severityCritical}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">{t.addPhoto}</label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => setFaultPhoto(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm"
                  />
                </div>
                <Button className="h-12 w-full" onClick={submitFault} disabled={submitting}>
                  {submitting ? t.submitting : t.submit}
                </Button>
              </>
            )}

            {!user && (
              <div className="mt-2 flex items-center justify-between rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                <span>{t.signInPrompt}</span>
                <Link to={`/login?next=/m/${machine.id}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                  <LogIn className="h-3.5 w-3.5" /> {t.signIn}
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {user && isOwnOrg && (
        <>
          <ServiceLogDialog
            open={logOpen}
            onOpenChange={setLogOpen}
            machines={[{ id: machine.id, name: machine.name }]}
            defaultMachineId={machine.id}
          />
          <UpdateReadingDialog
            open={readingOpen}
            onOpenChange={setReadingOpen}
            machineId={machine.id}
            currentHours={machine.current_hours}
            onSaved={() => {
              // refresh machine hours
              (supabase as any).rpc("get_machine_public", { _machine_id: machine.id }).then(({ data }: any) => {
                if (data?.[0]) setMachine(data[0]);
              });
            }}
          />
          <QuickFuelDialog
            open={fuelOpen}
            onOpenChange={setFuelOpen}
            machineId={machine.id}
            onSaved={() => {
              (supabase as any).rpc("get_machine_public", { _machine_id: machine.id }).then(({ data }: any) => {
                if (data?.[0]) setMachine(data[0]);
              });
            }}
          />
          <StartInspectionDialog
            open={inspectOpen}
            onOpenChange={setInspectOpen}
            machineId={machine.id}
            machineCategory={machine.category}
          />
          {machine.category === "Vehicle" && (
            <QuickStartTripDialog
              open={tripOpen}
              onOpenChange={setTripOpen}
              machineId={machine.id}
            />
          )}
        </>
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}
