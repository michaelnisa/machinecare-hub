import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatMoney } from "@/lib/format";

export default function GaragePayments() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [methodFilter, setMethodFilter] = useState("all");

  useEffect(() => {
    if (!profile) return;
    (supabase as any)
      .from("garage_payments")
      .select("*, garage_invoices(id, invoice_number, invoice_year, job_id, garage_jobs(garage_customers(name), garage_vehicles(registration_number))), profiles:received_by(full_name)")
      .order("paid_at", { ascending: false })
      .then(({ data, error }: any) => { if (error) toast.error(error.message); setPayments(data ?? []); setLoading(false); });
  }, [profile]);

  const filtered = useMemo(() => methodFilter === "all" ? payments : payments.filter((p) => p.method === methodFilter), [payments, methodFilter]);
  const total = useMemo(() => filtered.reduce((s, p) => s + (p.type === "refund" ? -1 : 1) * Number(p.amount), 0), [filtered]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">Every payment received — a running ledger, not editable after the fact.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All methods</option>
          {["cash", "mobile_money", "bank", "other"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
        </select>
        <div className="text-sm text-muted-foreground">Total: <span className="font-medium text-foreground">{formatMoney(total)}</span></div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<CreditCard className="h-5 w-5" />} title="No payments yet" description="Payments recorded against invoices will appear here." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Invoice</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Method</th>
                <th className="px-5 py-3 font-medium">Received by</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-5 py-3 text-muted-foreground">{formatDate(p.paid_at)}</td>
                  <td className="px-5 py-3">
                    {p.garage_invoices ? (
                      <Link to={`/garage/jobs/${p.garage_invoices.job_id}`} className="text-primary hover:underline">
                        INV-{p.garage_invoices.invoice_year}-{String(p.garage_invoices.invoice_number).padStart(4, "0")}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {p.garage_invoices?.garage_jobs?.garage_customers?.name}
                    {p.garage_invoices?.garage_jobs?.garage_vehicles?.registration_number && ` · ${p.garage_invoices.garage_jobs.garage_vehicles.registration_number}`}
                  </td>
                  <td className={`px-5 py-3 font-medium ${p.type === "refund" ? "text-red-600" : ""}`}>{p.type === "refund" ? "-" : ""}{formatMoney(p.amount)}</td>
                  <td className="px-5 py-3 capitalize text-muted-foreground">{p.method.replace("_", " ")}</td>
                  <td className="px-5 py-3 text-muted-foreground">{p.profiles?.full_name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
