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
} from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const { t } = useI18n();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground shadow-sm"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Wrench className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              {t.common.appName}
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#what" className="hover:text-foreground transition-colors">What it does</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#who" className="hover:text-foreground transition-colors">Who it's for</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {user ? (
              <Button asChild size="sm">
                <Link to="/dashboard">
                  {t.nav.dashboard} <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link to="/login">{t.common.login}</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/signup">{t.common.signup}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-[600px] w-[900px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, hsl(var(--primary-glow) / 0.35), transparent)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage:
              "radial-gradient(ellipse at center, black 40%, transparent 75%)",
          }}
        />

        <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-20 sm:px-6 sm:py-28 md:grid-cols-12 md:items-center">
          <div className="animate-fade-in md:col-span-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Manufacturing · Maintenance · Safety — one platform
            </span>
            <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
              The operating system for{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "var(--gradient-primary)" }}
              >
                your plant floor.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              MachineCare brings <strong className="text-foreground">machines, work orders, preventive maintenance, OEE, production, safety and inductions</strong> into a single place — so your team stops chasing spreadsheets and starts running a tighter, safer, more productive operation.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 px-6 text-base text-primary-foreground"
                style={{
                  background: "var(--gradient-primary)",
                  boxShadow: "var(--shadow-elegant)",
                }}
              >
                <Link to="/signup">
                  Start free — set up in 10 min
                  <ArrowRight className="ml-1.5 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
                <Link to="/login">{t.home.cta_login}</Link>
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> No credit card</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Works on phone, tablet &amp; TV dashboards</span>
              <span className="inline-flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-primary" /> English &amp; Kiswahili</span>
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative md:col-span-5">
            <div className="relative mx-auto max-w-md">
              <div
                className="absolute -inset-6 -z-10 rounded-[2rem] opacity-40 blur-2xl"
                style={{ background: "var(--gradient-primary)" }}
              />

              <div className="rounded-3xl border border-border bg-card/90 p-5 shadow-2xl backdrop-blur">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground"
                      style={{ background: "var(--gradient-primary)" }}
                    >
                      <Factory className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Contiform Bloc · Water Line</p>
                      <p className="text-xs text-muted-foreground">K998R20 · Bottling</p>
                    </div>
                  </div>
                  <span className="status-pill status-ok">Running</span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    { k: "OEE", v: "87%" },
                    { k: "Output", v: "42k/hr" },
                    { k: "Open WO", v: "2" },
                  ].map((m) => (
                    <div key={m.k} className="rounded-xl bg-secondary/60 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.k}</p>
                      <p className="text-base font-bold">{m.v}</p>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Next PM tasks</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {[
                    { l: "Blow moulder · clean preform infeed", d: true },
                    { l: "Filler · valve seal inspection", d: true },
                    { l: "Capper · torque calibration", d: false },
                  ].map((s) => (
                    <li key={s.l} className="flex items-center gap-2.5">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] ${
                          s.d
                            ? "bg-primary text-primary-foreground"
                            : "border border-border text-muted-foreground"
                        }`}
                      >
                        {s.d ? "✓" : ""}
                      </span>
                      <span className={s.d ? "text-muted-foreground line-through" : ""}>
                        {s.l}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="absolute -bottom-6 -left-6 hidden rotate-[-6deg] rounded-2xl border border-border bg-card p-3 shadow-xl sm:block">
                <QrCode className="h-16 w-16 text-foreground" />
                <p className="mt-1 text-center text-[10px] text-muted-foreground">Scan to log</p>
              </div>

              <div className="absolute -right-4 -top-4 hidden rotate-[5deg] items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium shadow-xl sm:flex">
                <span className="flex h-2 w-2 rounded-full bg-[hsl(var(--success))]" />
                Service due in 8 days
              </div>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
            {[
              { k: "Avg. downtime cut", v: "32%" },
              { k: "PMs completed on time", v: "96%" },
              { k: "Faster work-order closure", v: "3×" },
              { k: "Plant visibility", v: "24/7" },
            ].map((s) => (
              <div key={s.k} className="bg-card p-5 text-center">
                <p className="text-2xl font-bold tracking-tight sm:text-3xl">{s.v}</p>
                <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.k}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What it does — explainer */}
      <section id="what" className="border-y border-border bg-secondary/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
          <div className="mb-12 grid gap-6 md:grid-cols-2 md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">What MachineCare actually does</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                Replace 6 disconnected tools with one shared source of truth.
              </h2>
            </div>
            <p className="text-base text-muted-foreground">
              No more WhatsApp work orders, paper checklists, lost service logs or Excel OEE files. Every machine has its own profile, history, documents, parts, costs and live status — and every person on the team works from the same screen.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              { icon: Factory, title: "Run production", desc: "Daily targets vs. actuals, scrap, attainment and live OEE per machine, line and site." },
              { icon: Wrench, title: "Maintain equipment", desc: "Preventive schedules by hours or calendar, work orders, job logs, parts used and sign-offs." },
              { icon: ShieldCheck, title: "Keep people safe", desc: "Incident reports, safety inductions with quizzes & certificates, permits and audit trail." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features — full module list */}
      <section id="features" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Every module included
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            One subscription. Every workflow your plant needs.
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3 lg:grid-cols-4">
          {[
            { icon: Factory, title: "Machine registry", desc: "Every asset with photo, QR, manuals, parts list, meter readings and lifetime history." },
            { icon: ClipboardList, title: "Work orders", desc: "Corrective & preventive WOs with tasks, parts, costs, permits and sign-off (GSM-format)." },
            { icon: Wrench, title: "Preventive maintenance", desc: "Schedule by hours, kilometres or calendar. Auto-generate WOs before things break." },
            { icon: QrCode, title: "QR scan & log", desc: "Stick a QR on every machine — anyone with a phone can log work, fuel or a fault." },
            { icon: Gauge, title: "OEE tracking", desc: "Availability × Performance × Quality per machine, line and shift — with trends." },
            { icon: BarChart3, title: "Production KPIs", desc: "Daily targets vs. actuals, scrap and attainment by line, product and operator." },
            { icon: ShieldCheck, title: "Safety & incidents", desc: "Near-miss to lost-time reporting, root cause, corrective actions and days-since counter." },
            { icon: GraduationCap, title: "Inductions", desc: "Build programmes, run quizzes on-site, issue certificates — keep contractors compliant." },
            { icon: Boxes, title: "Inventory & parts", desc: "Stock levels, min/max, low-stock alerts and parts consumed per work order." },
            { icon: Fuel, title: "Fuel & odometer", desc: "Capture refuels and meter readings from a phone. Drive PM triggers automatically." },
            { icon: FileText, title: "Documents & vendors", desc: "Centralise manuals, drawings, certificates. Track vendors, contacts and SLAs." },
            { icon: Activity, title: "Live TV dashboard", desc: "Big-screen real-time view of production, OEE, safety and open WOs for the shop floor." },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl"
            >
              <div
                aria-hidden
                className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-60"
                style={{ background: "var(--gradient-primary)" }}
              />
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1.5 text-base font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Bell className="h-3.5 w-3.5 text-primary" /> Email & in-app alerts</span>
          <span className="inline-flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5 text-primary" /> Mobile-first, offline-tolerant</span>
          <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-primary" /> Role-based access (admin · supervisor · technician)</span>
          <span className="inline-flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-primary" /> Multi-site & multi-language</span>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-border bg-secondary/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              How it works
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Up and running in an afternoon.
            </h2>
          </div>
          <ol className="grid gap-5 md:grid-cols-4">
            {[
              { n: "01", t: "Add your machines", d: "Import a spreadsheet or add critical assets first. Attach manuals & PM schedules." },
              { n: "02", t: "Print the QR codes", d: "Stick one on every machine. Anyone with a phone becomes a technician." },
              { n: "03", t: "Invite your team", d: "Operators, technicians, supervisors — each with the right permissions." },
              { n: "04", t: "Watch the data flow", d: "Live OEE, due services, open WOs and safety stats land on dashboards automatically." },
            ].map((s) => (
              <li key={s.n} className="rounded-2xl border border-border bg-card p-6">
                <p
                  className="text-3xl font-bold tracking-tight text-transparent bg-clip-text"
                  style={{ backgroundImage: "var(--gradient-primary)" }}
                >
                  {s.n}
                </p>
                <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Who it's for */}
      <section id="who" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Built for</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Manufacturing plants, fleets and field operations.
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { t: "Food, beverage & bottling", d: "Lines like Krones Contiform, fillers, cappers, conveyors — with hours-based PM and OEE." },
            { t: "Heavy equipment & fleets", d: "Excavators, generators, trucks. Meter-driven services, fuel logs and vendor SLAs." },
            { t: "Workshops & contractors", d: "Job cards, parts costs, customer machines and induction certificates in one place." },
          ].map((c) => (
            <div key={c.t} className="rounded-2xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold">{c.t}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust / Quote */}
      <section className="border-y border-border bg-secondary/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
          <figure className="mx-auto max-w-3xl text-center">
            <p className="text-2xl font-medium leading-snug sm:text-3xl">
              &ldquo;We cut unplanned downtime by a third in the first quarter.
              The team actually <span className="text-primary">enjoys</span> doing inspections now.&rdquo;
            </p>
            <figcaption className="mt-6 text-sm text-muted-foreground">
              Plant Manager · Heavy-equipment fleet, Dar es Salaam
            </figcaption>
          </figure>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
        <div
          className="relative overflow-hidden rounded-3xl border border-border p-10 text-center sm:p-14"
          style={{ background: "var(--gradient-hero)" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 left-1/2 h-64 w-[120%] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
            style={{ background: "var(--gradient-primary)" }}
          />
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Run your plant like a flagship.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Free to start. No credit card. Add your first machine in under five minutes.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="text-primary-foreground"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}
            >
              <Link to="/signup">{t.home.cta_signup}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">{t.home.cta_login}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <Wrench className="h-4 w-4" />
                </div>
                <span className="text-base font-bold tracking-tight">{t.common.appName}</span>
              </div>
              <p className="mt-3 max-w-xs text-sm text-muted-foreground">
                One platform for manufacturing, maintenance and safety — built for the plant floor.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Product</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Features</a></li>
                <li><a href="#how" className="hover:text-foreground">How it works</a></li>
                <li><a href="#who" className="hover:text-foreground">Who it's for</a></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Account</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/login" className="hover:text-foreground">Sign in</Link></li>
                <li><Link to="/signup" className="hover:text-foreground">Create account</Link></li>
                <li><Link to="/dashboard" className="hover:text-foreground">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Contact</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><a href="mailto:hello@machinecare.company" className="hover:text-foreground">hello@machinecare.company</a></li>
                <li><a href="https://machinecare.company" className="hover:text-foreground">machinecare.company</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
            <p>© {new Date().getFullYear()} {t.common.appName}. All rights reserved.</p>
            <p>Built for fleets, workshops and field teams.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
