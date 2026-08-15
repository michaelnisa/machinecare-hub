import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { STATUS_LABEL, STATUS_BADGE, formatJobNumber } from "@/lib/garage-constants";

const OPEN_STATUSES = new Set(["received", "diagnosing", "estimate", "awaiting_approval", "approved", "in_progress", "quality_check", "ready"]);

function invoiceTotal(inv: any) {
  const itemsTotal = (inv.garage_invoice_items ?? []).reduce((s: number, it: any) => s + Number(it.line_total ?? it.quantity * it.unit_price), 0);
  return itemsTotal + Number(inv.labour_cost || 0) + Number(inv.other_cost || 0) - Number(inv.discount || 0);
}

export default function GarageDashboard() {
  const { profile, organisation } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [invoicesToday, setInvoicesToday] = useState<any[]>([]);
  const [outstandingInvoices, setOutstandingInvoices] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState(0);

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

  const KPI_CARDS = [
    { label: "Today's jobs", value: jobsToday, to: "/garage/jobs" },
    { label: "In progress", value: inProgress, to: "/garage/jobs?status=in_progress" },
    { label: "Waiting for customer", value: waitingForCustomer, to: "/garage/jobs?status=awaiting_approval" },
    { label: "Ready for pickup", value: readyForPickup, to: "/garage/jobs?status=ready" },
    { label: "Outstanding", value: formatMoney(outstandingTotal), to: "/garage/invoices?status=unpaid" },
    { label: "Today's revenue", value: formatMoney(revenueToday), to: "/garage/reports" },
    { label: "Low stock parts", value: lowStock, to: "/garage/inventory" },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{organisation?.name ?? "Workshop"} dashboard</h1>
        <p className="text-sm text-muted-foreground">What's happening in your workshop today.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_CARDS.map((k) => (
          <Link key={k.label} to={k.to} className="rounded-xl border border-border bg-card p-4 hover:border-primary/50">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</div>
            <div className="mt-1 text-2xl font-semibold">{k.value}</div>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-foreground">Today's work</h2>
        {openJobs.length === 0 ? (
          <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="Nothing open" description="No jobs currently in progress." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Vehicle</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Job</th>
                  <th className="px-5 py-3 font-medium">Mechanic</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {openJobs.slice(0, 10).map((j) => (
                  <tr key={j.id} className="cursor-pointer border-t border-border hover:bg-muted/40" onClick={() => navigate(`/garage/jobs/${j.id}`)}>
                    <td className="px-5 py-3">
                      <div className="font-medium">{[j.garage_vehicles?.make, j.garage_vehicles?.model].filter(Boolean).join(" ") || "Vehicle"}</div>
                      {j.garage_vehicles?.registration_number && <div className="text-xs text-muted-foreground">{j.garage_vehicles.registration_number}</div>}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{j.garage_customers?.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{formatJobNumber(j)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{j.garage_mechanics?.name ?? "Unassigned"}</td>
                    <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[j.status]}`}>{STATUS_LABEL[j.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
