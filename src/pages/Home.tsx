import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Wrench,
  ClipboardList,
  QrCode,
  BarChart3,
  ArrowRight,
  ShieldCheck,
  Gauge,
  Boxes,
  Fuel,
  Factory,
  GraduationCap,
  FileText,
  Bell,
  Users,
  CheckCircle2,
  Sparkles,
  Activity,
  Smartphone,
  Globe,
  Truck,
  Check,
  X,
  Layers,
  ChevronRight,
  TrendingUp,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const isSwahili = lang === "sw";
  const [activeTab, setActiveTab] = useState<"maintenance" | "safety" | "inventory" | "fleet">("maintenance");

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* ── TOP NAVIGATION BAR ────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground shadow-md transition-transform group-hover:scale-105"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Wrench className="h-4.5 w-4.5" />
            </div>
            <span className="text-lg font-extrabold tracking-tight">
              {t.common.appName}
            </span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#solutions" className="hover:text-foreground transition-colors">
              {isSwahili ? "Ufumbuzi" : "Solutions"}
            </a>
            <a href="#features" className="hover:text-foreground transition-colors">
              {isSwahili ? "Vipengele" : "Features"}
            </a>
            <a href="#comparison" className="hover:text-foreground transition-colors">
              {isSwahili ? "Kwa Nini MachineCare" : "Why MachineCare"}
            </a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              {isSwahili ? "Jinsi Inavyofanya Kazi" : "How it Works"}
            </a>
          </nav>
          <div className="flex items-center gap-2.5">
            <LanguageSwitcher />
            {user ? (
              <Button asChild size="sm" style={{ background: "var(--gradient-primary)" }}>
                <Link to="/dashboard">
                  {t.nav.dashboard} <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link to="/login">{t.common.login}</Link>
                </Button>
                <Button asChild size="sm" style={{ background: "var(--gradient-primary)" }}>
                  <Link to="/signup">{isSwahili ? "Omba Kujiunga" : "Request Access"}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-8 pb-20 md:pt-16 md:pb-28">
        {/* Glow & Grid Accents */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-70"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[650px] w-[1000px] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, hsl(var(--primary-glow) / 0.4), transparent)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse at center, black 50%, transparent 80%)",
          }}
        />

        <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 sm:px-6 md:grid-cols-12 md:items-center">
          <div className="animate-fade-in md:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-soft/80 px-3.5 py-1 text-xs font-semibold text-primary shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              <span>
                {isSwahili
                  ? "Mfumo wa Usimamizi wa Matengenezo, Usalama & Spares"
                  : "Complete Maintenance, Safety & Spare Parts Operations Platform"}
              </span>
            </div>
            
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl md:text-6xl lg:text-7xl">
              {isSwahili ? "Usimamizi wa Matengenezo" : "Master Equipment Maintenance"}{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "var(--gradient-primary)" }}
              >
                {isSwahili ? "& Uimara Wa Mitambo." : "& Asset Reliability."}
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {isSwahili ? (
                <>
                  MachineCare inakuwezesha kusimamia{" "}
                  <strong className="text-foreground font-semibold">ratiba za matengenezo (PM), work orders, vipuri vya akiba (inventory), usalama na mafunzo</strong>{" "}
                  kwenye mfumo mmoja wa kidijitali wa kisasa.
                </>
              ) : (
                <>
                  MachineCare unifies{" "}
                  <strong className="text-foreground font-semibold">preventive maintenance schedules, work orders, spare parts inventory, contractor safety, and operational telemetry</strong>{" "}
                  into one easy-to-use digital platform.
                </>
              )}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 px-7 text-base text-primary-foreground font-semibold shadow-lg hover:opacity-95 transition-all"
                style={{
                  background: "var(--gradient-primary)",
                  boxShadow: "var(--shadow-elegant)",
                }}
              >
                <Link to="/signup">
                  {isSwahili ? "Omba Kujiunga & Onboarding" : "Request Access & Onboarding"}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>

              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base border-border hover:bg-secondary">
                <Link to="/login">{t.home.cta_login}</Link>
              </Button>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />{" "}
                {isSwahili ? "Haitaji Kadi ya Benki" : "No credit card required"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />{" "}
                {isSwahili ? "Inafanya kazi kwenye Simu, Tablet & Skrini za TV" : "Runs on Phone, Tablet & Shopfloor TV"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-primary" /> English &amp; Kiswahili
              </span>
            </div>
          </div>

          {/* Hero Visual Card */}
          <div className="relative md:col-span-5">
            <div className="relative mx-auto max-w-md">
              <div
                className="absolute -inset-4 -z-10 rounded-[2.5rem] opacity-35 blur-2xl"
                style={{ background: "var(--gradient-primary)" }}
              />

              <div className="rounded-3xl border border-border/80 bg-card/95 p-6 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground shadow-sm"
                      style={{ background: "var(--gradient-primary)" }}
                    >
                      <Wrench className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">Main Air Compressor C-02</p>
                      <p className="text-xs text-muted-foreground font-mono">ASSET-COMP-882 · Plant Floor</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Optimal Care
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
                  <div className="rounded-xl bg-secondary/70 p-3 border border-border/50">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Run Hours</p>
                    <p className="text-lg font-extrabold text-foreground">2,480 hrs</p>
                  </div>
                  <div className="rounded-xl bg-secondary/70 p-3 border border-border/50">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">PM Status</p>
                    <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">Up to Date</p>
                  </div>
                  <div className="rounded-xl bg-secondary/70 p-3 border border-border/50">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Spares In Stock</p>
                    <p className="text-lg font-extrabold text-foreground">12 Filters</p>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Preventive Maintenance (PM)</span>
                    <span className="text-primary font-semibold">Scheduled Care</span>
                  </p>
                  
                  <div className="rounded-xl border border-border bg-background p-3 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                        <Wrench className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Oil & Air Filter Replacement</p>
                        <p className="text-[10px] text-muted-foreground">Due in 20 hours · 2,500h Interval</p>
                      </div>
                    </div>
                    <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700">Scheduled</span>
                  </div>

                  <div className="rounded-xl border border-border bg-background p-3 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Valve & Pressure Inspection</p>
                        <p className="text-[10px] text-muted-foreground">Signed off by Engineer Bakari</p>
                      </div>
                    </div>
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Verified</span>
                  </div>
                </div>
              </div>

              {/* Floating QR Sticker */}
              <div className="absolute -bottom-6 -left-6 hidden rotate-[-5deg] rounded-2xl border border-border bg-card p-3 shadow-xl sm:block backdrop-blur-lg">
                <QrCode className="h-14 w-14 text-foreground" />
                <p className="mt-1 text-center text-[10px] font-bold text-muted-foreground">Scan Machine QR</p>
              </div>

              {/* Floating Alert Badge */}
              <div className="absolute -right-4 -top-4 hidden rotate-[4deg] items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5 text-xs font-semibold shadow-xl sm:flex backdrop-blur-lg">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>100% Safety Compliance</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── KEY METRICS STRIP ───────────────────────────────────── */}
        <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4 shadow-sm">
            {[
              { k: isSwahili ? "Kupunguza Downtime" : "Downtime Reduction", v: "32%", sub: isSwahili ? "Matengenezo ya kuzuia kabla" : "Proactive preventive care" },
              { k: isSwahili ? "Matengenezo kwa Wakati" : "PMs Completed On-Time", v: "96%", sub: isSwahili ? "Utekelezaji wa ratiba kikamilifu" : "On-time maintenance execution" },
              { k: isSwahili ? "Kasi ya Work-Orders" : "Faster WO Closure", v: "3×", sub: isSwahili ? "Funga kazi za mafundi haraka" : "Streamlined job sign-offs" },
              { k: isSwahili ? "Ufuatiliaji wa Spares" : "Inventory Control", v: "100%", sub: isSwahili ? "Taarifa sahihi za akiba ya spaji" : "Zero spare parts stockouts" },
            ].map((s) => (
              <div key={s.k} className="bg-card p-6 text-center hover:bg-secondary/40 transition-colors">
                <p className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">{s.v}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-primary">{s.k}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TAILORED SOLUTIONS (MAINTENANCE, SAFETY, INVENTORY, FLEET) ──────────────── */}
      <section id="solutions" className="py-20 mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            {isSwahili ? "Ufumbuzi Ulioandaliwa" : "Tailored Operational Solutions"}
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {isSwahili ? "Ufumbuzi wa Matengenezo, Usalama na Spares" : "Complete Care for Maintenance, Safety & Spare Parts"}
          </h2>
          <p className="mt-3 text-muted-foreground text-sm sm:text-base">
            {isSwahili
              ? "MachineCare inakupa zana maalum zinazohitajika kuendesha matengenezo, usalama wa wafanyakazi, na akiba ya vipuri kwa ustadi."
              : "Explore how MachineCare streamlines equipment reliability, contractor safety inductions, and spare parts control."}
          </p>
        </div>

        {/* Tailored Solutions Tabs Selector */}
        <div className="flex justify-center mb-10 overflow-x-auto pb-2">
          <div className="inline-flex rounded-2xl border border-border bg-secondary/50 p-1.5">
            <button
              onClick={() => setActiveTab("maintenance")}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
                activeTab === "maintenance"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Wrench className="h-4 w-4 text-primary" />
              <span>{isSwahili ? "Matengenezo & Uimara" : "Maintenance & Reliability"}</span>
            </button>
            
            <button
              onClick={() => setActiveTab("safety")}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
                activeTab === "safety"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>{isSwahili ? "Usalama & Compliance" : "Safety & Compliance"}</span>
            </button>

            <button
              onClick={() => setActiveTab("inventory")}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
                activeTab === "inventory"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Boxes className="h-4 w-4 text-amber-500" />
              <span>{isSwahili ? "Spares & Inventory" : "Inventory & Spare Parts"}</span>
            </button>

            <button
              onClick={() => setActiveTab("fleet")}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
                activeTab === "fleet"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Truck className="h-4 w-4 text-blue-500" />
              <span>{isSwahili ? "Magari & Garages" : "Fleet & Workshops"}</span>
            </button>
          </div>
        </div>

        {/* Tab Content Cards */}
        <div className="rounded-3xl border border-border bg-card p-8 md:p-12 shadow-sm">
          {/* TAB 1: MAINTENANCE */}
          {activeTab === "maintenance" && (
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                  <Wrench className="h-4 w-4" /> Equipment Maintenance & Reliability
                </div>
                <h3 className="text-2xl font-bold tracking-tight">Proactive Maintenance Schedules & Work Orders</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Prevent unexpected breakdowns before they occur. Set up automated maintenance schedules by operating hours, kilometres, or calendar frequencies, and track every work order from issue to resolution.
                </p>
                <ul className="space-y-2.5 text-xs text-foreground font-medium pt-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Hours-based & Calendar Preventive Maintenance (PM) Triggers</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Instant QR Code Scanning on Machinery for Quick Work Orders</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Complete Asset History Passports & Digital Maintenance Logs</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/50 p-6 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold border-b border-border pb-3">
                  <span>Equipment Maintenance Overview</span>
                  <span className="text-emerald-500 font-extrabold">96% On-Time Execution</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Active Work Orders:</span> <span className="font-semibold text-foreground">3 In Progress</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Preventive Maintenance Due:</span> <span className="font-semibold text-amber-600">2 Scheduled This Week</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Avg. Repair Closure Time:</span> <span className="font-semibold text-emerald-600">1.8 Hours</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SAFETY */}
          {activeTab === "safety" && (
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-500 uppercase tracking-wider">
                  <ShieldCheck className="h-4 w-4" /> Safety & Contractor Compliance
                </div>
                <h3 className="text-2xl font-bold tracking-tight">Zero-Harm Environment & Mobile Contractor Inductions</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Protect your workforce and contractors. Run mobile safety inductions with automated comprehension quizzes, issue digital compliance certificates, and log incidents with root-cause analysis.
                </p>
                <ul className="space-y-2.5 text-xs text-foreground font-medium pt-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Mobile Safety Inductions & Quiz Certificates for Contractors</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Incident & Near-Miss Incident Logging with Root-Cause Actions</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Digital Permit-to-Work (PTW) Approval Workflows & Audit Trails</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/50 p-6 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold border-b border-border pb-3">
                  <span>Safety Compliance Summary</span>
                  <span className="text-emerald-500 font-extrabold">100% Certified</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Days Without Lost-Time Incident:</span> <span className="font-bold text-emerald-600">142 Days</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Active Contractor Inductions:</span> <span className="font-semibold text-foreground">18 Certified</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Permits to Work (PTW):</span> <span className="font-semibold text-foreground">2 Approved Today</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INVENTORY */}
          {activeTab === "inventory" && (
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-wider">
                  <Boxes className="h-4 w-4" /> Spare Parts & Inventory Control
                </div>
                <h3 className="text-2xl font-bold tracking-tight">Real-Time Spare Stock & Reorder Thresholds</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Eliminate maintenance delays caused by missing spare parts. Track stock levels in real time, automate minimum inventory reorder alerts, and deduct parts directly as work orders are completed.
                </p>
                <ul className="space-y-2.5 text-xs text-foreground font-medium pt-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-500" /> Automatic Low-Stock Reorder Alerts & Min/Max Thresholds</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-500" /> Automatic Spare Part Deductions per Work Order</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-500" /> Vendor Catalog Management, Purchase Requests & Stock Audits</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/50 p-6 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold border-b border-border pb-3">
                  <span>Inventory Control Metrics</span>
                  <span className="text-amber-600 font-extrabold">Optimal Stocking</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total Spare Part Items:</span> <span className="font-semibold text-foreground">342 Stock SKUs</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Critical Spares Status:</span> <span className="font-semibold text-emerald-600">All Above Min Threshold</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Parts Consumed This Month:</span> <span className="font-semibold text-foreground font-mono">TZS 4.2M / $1,600</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FLEET */}
          {activeTab === "fleet" && (
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-blue-500 uppercase tracking-wider">
                  <Truck className="h-4 w-4" /> Fleet & Workshop Operations
                </div>
                <h3 className="text-2xl font-bold tracking-tight">Kilometre Servicing, Fuel Logs & Job Cards</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Tailored for heavy equipment fleets, transport logistics, and repair workshops. Monitor fuel consumption logs, km-driven service triggers, and digital workshop repair cards.
                </p>
                <ul className="space-y-2.5 text-xs text-foreground font-medium pt-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-blue-500" /> Kilometre-Driven Service Triggers & Odometer Tracking</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-blue-500" /> Fuel Refuel Logs & Variance / Theft Detection</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-blue-500" /> Digital Workshop Job Cards & Part Cost Invoicing</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/50 p-6 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold border-b border-border pb-3">
                  <span>Fleet Vehicle Status</span>
                  <span className="text-blue-500 font-extrabold">Active Maintenance</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Scania Hauler T-882:</span> <span className="font-semibold text-foreground">Service Due in 340 km</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>CAT Excavator E-104:</span> <span className="font-semibold text-emerald-600">Fuel Logged (420 L)</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Workshop Job #402:</span> <span className="font-semibold text-foreground">Mechanic Assigned</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── ALL MODULES & FEATURES GRID ───────────────────────────── */}
      <section id="features" className="py-20 border-t border-border bg-secondary/30">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              {isSwahili ? "Vipengele Vyote" : "Comprehensive Feature Suite"}
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {isSwahili ? "Kila Kitu Unachohitaji Ili Kuendesha Matengenezo & Usalama" : "Everything Needed to Manage Equipment & Safety"}
            </h2>
            <p className="mt-3 text-muted-foreground text-sm sm:text-base">
              {isSwahili
                ? "Mfumo mmoja uliokamilika badala ya programu nyingi zinazotatanisha."
                : "No need for multiple fragmented software tools. MachineCare connects all plant floor workflows."}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
            {[
              { icon: Factory, title: "Machine Registry", desc: "Digital passport for every machine with photos, manuals, QR codes, and service logs." },
              { icon: ClipboardList, title: "Work Orders (WO)", desc: "Corrective and preventive work orders with labor hours, parts consumed, and sign-offs." },
              { icon: Wrench, title: "Preventive Maintenance", desc: "Automated schedules triggered by runtime hours, kilometres, or calendar frequencies." },
              { icon: QrCode, title: "QR Scan & Log", desc: "Stick QR stickers on machines so technicians scan to instantly report faults or log work." },
              { icon: Gauge, title: "OEE Tracking", desc: "Real-time Availability × Performance × Quality metrics for every machine and bottling line." },
              { icon: BarChart3, title: "Production KPIs", desc: "Monitor daily production targets vs actuals, scrap rates, and line attainment." },
              { icon: ShieldCheck, title: "Safety & Incidents", desc: "Log near-misses, lost-time incidents, root cause analysis, and safety audit trails." },
              { icon: GraduationCap, title: "Safety Inductions", desc: "Run contractor safety inductions with quizzes, track compliance, and issue certificates." },
              { icon: Boxes, title: "Inventory & Spare Parts", desc: "Track stock levels, minimum reorder alerts, supplier catalogs, and part usage." },
              { icon: Fuel, title: "Fuel & Odometers", desc: "Log fuel refuels and meter readings from mobile to detect fuel theft and drive PM." },
              { icon: FileText, title: "Documents & Vendors", desc: "Store machine manuals, electrical drawings, insurance, and vendor contacts in one place." },
              { icon: Activity, title: "Live TV Shopfloor", desc: "Big-screen live TV dashboard for operator visibility, open work orders, and safety counters." },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group relative rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5.5 w-5.5" />
                </div>
                <h3 className="mb-1.5 text-base font-bold text-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS IN 4 EASY STEPS ───────────────────────────── */}
      <section id="how-it-works" className="py-20 mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            {isSwahili ? "Jinsi Inavyofanya Kazi" : "Easy Onboarding"}
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {isSwahili ? "Hatua 4 Rahisi Za Kuanza Kujisajili" : "Up and Running in 4 Simple Steps"}
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          {[
            { n: "01", t: "Request Access", d: "Fill out your company name & contact info to request access." },
            { n: "02", t: "Add Assets & QR Codes", d: "Register your machines and print QR code stickers for each asset." },
            { n: "03", t: "Invite Team Members", d: "Assign roles to technicians, supervisors, and operators." },
            { n: "04", t: "Watch Performance Grow", d: "Track live OEE, automated PM alerts, and zero lost service logs." },
          ].map((s) => (
            <div key={s.n} className="rounded-3xl border border-border bg-card p-7 relative">
              <span
                className="text-4xl font-black bg-clip-text text-transparent opacity-80"
                style={{ backgroundImage: "var(--gradient-primary)" }}
              >
                {s.n}
              </span>
              <h3 className="mt-3 text-lg font-bold">{s.t}</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CALL TO ACTION BANNER ─────────────────────────────────── */}
      <section className="py-16 mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div
          className="relative overflow-hidden rounded-3xl border border-border p-10 text-center sm:p-16 shadow-2xl"
          style={{ background: "var(--gradient-hero)" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 left-1/2 h-72 w-[120%] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
            style={{ background: "var(--gradient-primary)" }}
          />
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            {isSwahili ? "Anza Kuendesha Matengenezo Kwa Usahihi" : "Ready to Modernize Your Equipment Maintenance?"}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base leading-relaxed">
            {isSwahili
              ? "Tuma ombi lako sasa ili upate nafasi ya kufunguliwa mfumo na timu yetu ya usaidizi."
              : "Submit an onboarding access request today and let our engineering team set up your workspace."}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 px-8 text-base text-primary-foreground font-bold shadow-xl"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}
            >
              <Link to="/signup">
                {isSwahili ? "Omba Kujiunga Sasa" : "Request Access Now"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base">
              <Link to="/login">{t.home.cta_login}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-background py-12">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground shadow-sm"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <Wrench className="h-4 w-4" />
                </div>
                <span className="text-base font-bold tracking-tight">{t.common.appName}</span>
              </div>
              <p className="mt-3 max-w-xs text-xs text-muted-foreground leading-relaxed">
                The operating system for equipment maintenance, safety compliance, and spare parts management.
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">Solutions</p>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                <li><a href="#solutions" className="hover:text-foreground">Maintenance & Reliability</a></li>
                <li><a href="#solutions" className="hover:text-foreground">Safety & Compliance</a></li>
                <li><a href="#solutions" className="hover:text-foreground">Spare Parts & Inventory</a></li>
                <li><a href="#solutions" className="hover:text-foreground">Fleet & Workshops</a></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">Access</p>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                <li><Link to="/login" className="hover:text-foreground">Sign In</Link></li>
                <li><Link to="/signup" className="hover:text-foreground">{isSwahili ? "Omba Kujiunga" : "Request Access"}</Link></li>
                <li><Link to="/dashboard" className="hover:text-foreground">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">Contact & Support</p>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                <li><a href="mailto:michaelnisa3@gmail.com" className="hover:text-foreground">michaelnisa3@gmail.com</a></li>
                <li><span>Phone: +255 764 190 999</span></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
            <p>© {new Date().getFullYear()} {t.common.appName}. All rights reserved.</p>
            <p>Built for industrial equipment maintenance, safety compliance, and spare parts control.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
