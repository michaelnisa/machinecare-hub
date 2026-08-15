import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatMoney } from "@/lib/format";

const TABS = [
  { value: "all", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partially paid" },
  { value: "paid", label: "Paid" },
];

function invoiceTotal(inv: any) {
  const itemsTotal = (inv.garage_invoice_items ?? []).reduce((s: number, it: any) => s + Number(it.line_total ?? it.quantity * it.unit_price), 0);
  return itemsTotal + Number(inv.labour_cost || 0) + Number(inv.other_cost || 0) - Number(inv.discount || 0);
}

export default function GarageInvoices() {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [tab, setTab] = useState(params.get("status") ?? "all");
  const [search, setSearch] = useState("");

  const changeTab = (v: string) => { setTab(v); setParams(v === "all" ? {} : { status: v }); };

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const [{ data: inv, error: e1 }, { data: pay, error: e2 }] = await Promise.all([
        (supabase as any).from("garage_invoices").select("*, garage_invoice_items(*), garage_jobs(id, job_number, job_year, garage_customers(name), garage_vehicles(make, model, registration_number))").order("issued_at", { ascending: false }),
        (supabase as any).from("garage_payments").select("invoice_id, amount, type"),
      ]);
      const err = e1 || e2;
      if (err) toast.error(err.message);
      setInvoices(inv ?? []);
      setPayments(pay ?? []);
      setLoading(false);
    })();
  }, [profile]);

  const paidByInvoice = useMemo(() => {
    const map: Record<string, number> = {};
    payments.forEach((p: any) => {
      const sign = p.type === "refund" ? -1 : 1;
      map[p.invoice_id] = (map[p.invoice_id] ?? 0) + sign * Number(p.amount);
    });
    return map;
  }, [payments]);

  const rows = useMemo(() => invoices.map((inv) => {
    const total = invoiceTotal(inv);
    const paid = paidByInvoice[inv.id] ?? 0;
    const outstanding = total - paid;
    const status = outstanding <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid";
    return { inv, total, paid, outstanding, status };
  }), [invoices, paidByInvoice]);

  const filtered = useMemo(() => {
    let out = tab === "all" ? rows : rows.filter((r) => r.status === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((r) => r.inv.garage_jobs?.garage_customers?.name?.toLowerCase().includes(q) || r.inv.garage_jobs?.garage_vehicles?.registration_number?.toLowerCase().includes(q));
    }
    return out;
  }, [rows, tab, search]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">Every invoice issued — total, paid, and outstanding.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button key={t.value} onClick={() => changeTab(t.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${tab === t.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted/60"}`}>
            {t.label}
          </button>
        ))}
        <Input placeholder="Search customer or plate…" value={search} onChange={(e) => setSearch(e.target.value)} className="ml-auto max-w-xs" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Receipt className="h-5 w-5" />} title="No invoices" description="Invoices appear here once a job is ready and invoiced." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Invoice</th>
                <th className="px-5 py-3 font-medium">Customer / vehicle</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Paid</th>
                <th className="px-5 py-3 font-medium">Outstanding</th>
                <th className="px-5 py-3 font-medium">Issued</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ inv, total, paid, outstanding, status }) => (
                <tr key={inv.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    <Link to={`/garage/jobs/${inv.job_id}`} className="font-medium text-primary hover:underline">INV-{inv.invoice_year}-{String(inv.invoice_number).padStart(4, "0")}</Link>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {inv.garage_jobs?.garage_customers?.name}
                    {inv.garage_jobs?.garage_vehicles?.registration_number && ` · ${inv.garage_jobs.garage_vehicles.registration_number}`}
                  </td>
                  <td className="px-5 py-3">{formatMoney(total)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{formatMoney(paid)}</td>
                  <td className="px-5 py-3">
                    <span className={outstanding > 0 ? (status === "partial" ? "text-amber-600" : "text-red-600") : "text-emerald-600"}>{formatMoney(outstanding)}</span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{formatDate(inv.issued_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
