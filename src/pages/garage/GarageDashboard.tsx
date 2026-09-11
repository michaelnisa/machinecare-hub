import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ClipboardList, ClipboardCheck, ShoppingCart, Wrench, Clock, CheckCircle2, AlertTriangle, TrendingUp, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GarageIntakeWizardModal } from "@/components/garage/GarageIntakeWizardModal";
import { QuickCounterSaleModal } from "@/components/garage/QuickCounterSaleModal";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { STATUS_LABEL, STATUS_BADGE, formatJobNumber } from "@/lib/garage-constants";
import { invoiceTotal } from "@/lib/garage-money";

const OPEN_STATUSES = new Set(["received", "diagnosing", "estimate", "awaiting_approval", "approved", "in_progress", "quality_check", "ready"]);

const toneClasses: Record<string, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  destructive: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function GarageDashboard() {
  const { profile, organisation } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [invoicesToday, setInvoicesToday] = useState<any[]>([]);
  const [outstandingInvoices, setOutstandingInvoices] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState(0);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [counterSaleOpen, setCounterSaleOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

      const [
        { data: j, error: e1 },
        { data: invToday, error: e2 },
        { data: allInv, error: e3 },
        { data: pay, error: e4 },
        { data: items, error: e5 },
        { data: balances, error: e6 },
      ] = await Promise.all([
        (supabase as any).from("garage_jobs").select("*, garage_customers(name), garage_vehicles(make, model, registration_number), garage_mechanics(name)").order("created_at", { ascending: false }).limit(200),
        (supabase as any).from("garage_invoices").select("*, garage_invoice_items(*)").gte("issued_at", todayStart.toISOString()).lte("issued_at", todayEnd.toISOString()),
        (supabase as any).from("garage_invoices").select("*, garage_invoice_items(*)"),
        (supabase as any).from("garage_payments").select("invoice_id, amount, type"),
        supabase.from("inventory_items").select("id, reorder_level").eq("status", "active"),
        (supabase as any).from("stock_balances").select("item_id, available_stock"),
      ]);
      const err = e1 || e2 || e3 || e4 || e5 || e6;
      if (err) toast.error(err.message);

      setJobs(j ?? []);
      setInvoicesToday(invToday ?? []);

      const paidByInvoice: Record<string, number> = {};
      (pay ?? []).forEach((p: any) => {
        const sign = p.type === "refund" ? -1 : 1;
        paidByInvoice[p.invoice_id] = (paidByInvoice[p.invoice_id] ?? 0) + sign * Number(p.amount);
      });
      setOutstandingInvoices((allInv ?? []).filter((inv: any) => invoiceTotal(inv) - (paidByInvoice[inv.id] ?? 0) > 0));

      const av: Record<string, number> = {};
      (balances ?? []).forEach((b: any) => { av[b.item_id] = (av[b.item_id] ?? 0) + Number(b.available_stock); });
      setLowStock((items ?? []).filter((i: any) => (av[i.id] ?? 0) <= Number(i.reorder_level ?? 0)).length);

      setLoading(false);
    })();
  }, [profile]);

  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const jobsToday = useMemo(() => jobs.filter((j) => new Date(j.created_at) >= todayStart).length, [jobs, todayStart]);
  const openJobs = useMemo(() => jobs.filter((j) => OPEN_STATUSES.has(j.status)), [jobs]);
  const inProgress = useMemo(() => jobs.filter((j) => ["in_progress", "quality_check"].includes(j.status)).length, [jobs]);
  const waitingForCustomer = useMemo(() => jobs.filter((j) => j.status === "awaiting_approval").length, [jobs]);
  const readyForPickup = useMemo(() => jobs.filter((j) => j.status === "ready").length, [jobs]);
  const outstandingTotal = useMemo(() => outstandingInvoices.reduce((s, inv) => s + invoiceTotal(inv), 0), [outstandingInvoices]);
  const revenueToday = useMemo(() => invoicesToday.reduce((s, inv) => s + invoiceTotal(inv), 0), [invoicesToday]);

  const kpiCards = [
    {
      label: "Jobs Today",
      value: String(jobsToday),
      sub: `${openJobs.length} open · ${jobs.length - openJobs.length} completed`,
      icon: ClipboardList,
      tone: "default",
      to: "/garage/jobs",
    },
    {
      label: "In Progress",
      value: String(inProgress),
      sub: inProgress > 0 ? "Currently being worked on" : "No jobs in bay right now",
      icon: Wrench,
      tone: inProgress > 0 ? "warning" : "success",
      to: "/garage/jobs?status=in_progress",
    },
    {
      label: "Awaiting Approval",
      value: String(waitingForCustomer),
      sub: waitingForCustomer > 0 ? "Estimates sent, pending customer" : "No pending approvals",
      icon: Clock,
      tone: waitingForCustomer > 0 ? "warning" : "success",
      to: "/garage/jobs?status=awaiting_approval",
    },
    {
      label: "Ready for Pickup",
      value: String(readyForPickup),
      sub: readyForPickup > 0 ? "Notify customers to collect" : "No vehicles ready",
      icon: CheckCircle2,
      tone: readyForPickup > 0 ? "success" : "default",
      to: "/garage/jobs?status=ready",
    },
    {
      label: "Today's Revenue",
      value: formatMoney(revenueToday),
      sub: `${invoicesToday.length} invoice${invoicesToday.length === 1 ? "" : "s"} raised today`,
      icon: TrendingUp,
      tone: revenueToday > 0 ? "success" : "default",
      to: "/garage/reports",
    },
    {
      label: "Outstanding Balance",
      value: formatMoney(outstandingTotal),
      sub: `${outstandingInvoices.length} unpaid invoice${outstandingInvoices.length === 1 ? "" : "s"}`,
      icon: AlertTriangle,
      tone: outstandingTotal > 0 ? "destructive" : "success",
      to: "/garage/invoices?status=unpaid",
    },
    {
      label: "Low Stock Parts",
      value: String(lowStock),
      sub: lowStock > 0 ? "Parts below reorder level" : "All parts well stocked",
      icon: Package,
      tone: lowStock > 0 ? "warning" : "success",
      to: "/garage/inventory",
    },
  ] as const;

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{organisation?.name ?? "Workshop"} Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live overview of today's workshop activity, revenue, and stock.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setIntakeOpen(true)} className="gap-1.5">
            <ClipboardCheck className="h-4 w-4" /> Fast Walk-In Intake
          </Button>
          <Button variant="outline" onClick={() => setCounterSaleOpen(true)} className="gap-1.5">
            <ShoppingCart className="h-4 w-4" /> Quick Counter Sale
          </Button>
        </div>
      </div>

      {/* KPI cards — Fleet style */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((c) => (
          <Link key={c.label} to={c.to} className="rounded-xl border border-border bg-card p-5 hover:border-primary/40 transition-colors block">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{c.label}</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight">{c.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{c.sub}</div>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClasses[c.tone]}`}>
                <c.icon className="h-5 w-5" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Active jobs */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">Today's Work</h2>
          </div>
          <Link to="/garage/jobs" className="text-xs font-medium text-primary hover:underline">View all jobs</Link>
        </div>
        {openJobs.length === 0 ? (
          <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="Nothing open" description="No jobs currently in progress." />
        ) : (
          <div className="space-y-2">
            {openJobs.slice(0, 8).map((j) => (
              <div
                key={j.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => navigate(`/garage/jobs/${j.id}`)}
              >
                <div>
                  <span className="font-medium">{[j.garage_vehicles?.make, j.garage_vehicles?.model].filter(Boolean).join(" ") || "Vehicle"}</span>
                  {j.garage_vehicles?.registration_number && (
                    <span className="ml-2 text-xs text-muted-foreground">{j.garage_vehicles.registration_number}</span>
                  )}
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {j.garage_customers?.name ?? "—"} · {formatJobNumber(j)}
                    {j.garage_mechanics?.name ? ` · ${j.garage_mechanics.name}` : ""}
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs shrink-0 ${STATUS_BADGE[j.status]}`}>{STATUS_LABEL[j.status]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <GarageIntakeWizardModal open={intakeOpen} onOpenChange={setIntakeOpen} onJobCreated={() => navigate("/garage/jobs")} />
      <QuickCounterSaleModal open={counterSaleOpen} onOpenChange={setCounterSaleOpen} onSaleCompleted={() => navigate("/garage/invoices")} />
    </div>
  );
}
