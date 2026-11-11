import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatMoney, formatDate } from "@/lib/format";
import { FinanceNavHeader } from "./FinanceNavHeader";
import {
  getApArAging,
  type ApArAging,
} from "@/services/financeService";
import {
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building2,
  FileText,
  AlertTriangle,
  ArrowRight,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

export default function FinanceApAr() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [aging, setAging] = useState<ApArAging | null>(null);

  const loadData = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const data = await getApArAging(organisation.id);
      setAging(data);
    } catch (err) {
      console.error("Failed to load AP/AR aging:", err);
      toast.error("Failed to calculate aging schedule");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  if (loading) return <PageLoader />;

  const ar = aging?.receivables || { current: 0, days31to60: 0, days61to90: 0, days90Plus: 0, total: 0, invoices: [] };
  const ap = aging?.payables || { current: 0, days31to60: 0, days61to90: 0, days90Plus: 0, total: 0, bills: [] };

  const netWorkingCapital = ar.total - ap.total;
  const isPositive = netWorkingCapital >= 0;

  return (
    <div className="space-y-6 p-6">
      <FinanceNavHeader
        title="Accounts Payable & Receivable (AP & AR)"
        subtitle="Aging schedule of liquidity inflows from customers versus payment obligations to suppliers."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/finance/suppliers">
                <Building2 className="h-4 w-4 mr-1.5" />
                Manage Payables
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/finance/invoices">
                <FileText className="h-4 w-4 mr-1.5" />
                Manage Receivables
              </Link>
            </Button>
          </div>
        }
      />

      {/* Top Liquidity Position Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Receivables (AR)</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
            {formatMoney(ar.total)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Money owed by {ar.invoices.length} customer invoices
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Payables (AP)</span>
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600">
            {formatMoney(ap.total)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Money owed to {ap.bills.length} vendor bills
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Net Working Capital Balance</span>
            <DollarSign className={`h-4 w-4 ${isPositive ? "text-primary" : "text-amber-500"}`} />
          </div>
          <p className={`mt-2 text-2xl font-bold tracking-tight ${isPositive ? "text-primary" : "text-amber-600"}`}>
            {formatMoney(netWorkingCapital)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isPositive ? "Net receivable surplus" : "Working capital deficit (AP exceeds AR)"}
          </p>
        </div>
      </div>

      {/* Aging Schedule Breakdown Comparison */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* AR Buckets */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-500" />
              <h3 className="font-semibold text-sm">Receivables Aging Schedule (Customers)</h3>
            </div>
            <span className="text-xs font-semibold text-emerald-600">{formatMoney(ar.total)}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[11px] font-medium text-emerald-600">Current (0-30d)</span>
              <p className="text-sm font-bold text-emerald-700 mt-1">{formatMoney(ar.current)}</p>
            </div>
            <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/20">
              <span className="text-[11px] font-medium text-sky-600">31 - 60 Days</span>
              <p className="text-sm font-bold text-sky-700 mt-1">{formatMoney(ar.days31to60)}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <span className="text-[11px] font-medium text-amber-600">61 - 90 Days</span>
              <p className="text-sm font-bold text-amber-700 mt-1">{formatMoney(ar.days61to90)}</p>
            </div>
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <span className="text-[11px] font-medium text-rose-600">90+ Days</span>
              <p className="text-sm font-bold text-rose-700 mt-1">{formatMoney(ar.days90Plus)}</p>
            </div>
          </div>
        </div>

        {/* AP Buckets */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-rose-500" />
              <h3 className="font-semibold text-sm">Payables Aging Schedule (Vendors)</h3>
            </div>
            <span className="text-xs font-semibold text-rose-600">{formatMoney(ap.total)}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[11px] font-medium text-emerald-600">Current (0-30d)</span>
              <p className="text-sm font-bold text-emerald-700 mt-1">{formatMoney(ap.current)}</p>
            </div>
            <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/20">
              <span className="text-[11px] font-medium text-sky-600">31 - 60 Days</span>
              <p className="text-sm font-bold text-sky-700 mt-1">{formatMoney(ap.days31to60)}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <span className="text-[11px] font-medium text-amber-600">61 - 90 Days</span>
              <p className="text-sm font-bold text-amber-700 mt-1">{formatMoney(ap.days61to90)}</p>
            </div>
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <span className="text-[11px] font-medium text-rose-600">90+ Days</span>
              <p className="text-sm font-bold text-rose-700 mt-1">{formatMoney(ap.days90Plus)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs for Detailed Line Records */}
      <Tabs defaultValue="receivables" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="receivables" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Receivables ({ar.invoices.length})
          </TabsTrigger>
          <TabsTrigger value="payables" className="gap-1.5">
            <Building2 className="h-4 w-4" />
            Payables ({ap.bills.length})
          </TabsTrigger>
        </TabsList>

        {/* Receivables Table */}
        <TabsContent value="receivables">
          {ar.invoices.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-border bg-card">
              <ShieldCheck className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
              <h4 className="font-semibold text-sm">All Customer Accounts are Cleared</h4>
              <p className="text-xs text-muted-foreground mt-1">There are no outstanding invoices awaiting customer settlement.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Invoice #</th>
                      <th className="py-3 px-4 font-semibold">Customer / Client</th>
                      <th className="py-3 px-4 font-semibold">Issued Date</th>
                      <th className="py-3 px-4 font-semibold">Due Date</th>
                      <th className="py-3 px-4 font-semibold text-right">Invoiced</th>
                      <th className="py-3 px-4 font-semibold text-right">Paid</th>
                      <th className="py-3 px-4 font-semibold text-right">Balance Due</th>
                      <th className="py-3 px-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ar.invoices.map((inv) => {
                      const balance = Math.max(Number(inv.total_amount) - Number(inv.paid_amount || 0), 0);
                      const isOverdue = new Date(inv.due_date).getTime() < Date.now();
                      return (
                        <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-primary whitespace-nowrap">
                            {inv.invoice_number}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-foreground">
                            {inv.client_name}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(inv.issued_at)}
                          </td>
                          <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                            <span className={isOverdue ? "font-semibold text-rose-600" : "text-muted-foreground"}>
                              {formatDate(inv.due_date)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-foreground whitespace-nowrap">
                            {formatMoney(inv.total_amount)}
                          </td>
                          <td className="py-3.5 px-4 text-right text-xs text-emerald-600 whitespace-nowrap">
                            {formatMoney(inv.paid_amount || 0)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-amber-600 whitespace-nowrap">
                            {formatMoney(balance)}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <Button size="sm" variant="outline" asChild className="h-7 text-xs">
                              <Link to="/finance/invoices">Collect</Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Payables Table */}
        <TabsContent value="payables">
          {ap.bills.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-border bg-card">
              <ShieldCheck className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
              <h4 className="font-semibold text-sm">All Supplier Accounts are Settled</h4>
              <p className="text-xs text-muted-foreground mt-1">There are no pending vendor invoices awaiting disbursement.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Bill #</th>
                      <th className="py-3 px-4 font-semibold">Supplier / Vendor</th>
                      <th className="py-3 px-4 font-semibold">Category</th>
                      <th className="py-3 px-4 font-semibold">Due Date</th>
                      <th className="py-3 px-4 font-semibold text-right">Billed</th>
                      <th className="py-3 px-4 font-semibold text-right">Paid</th>
                      <th className="py-3 px-4 font-semibold text-right">Balance Due</th>
                      <th className="py-3 px-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ap.bills.map((b) => {
                      const balance = Math.max(Number(b.amount) - Number(b.paid_amount || 0), 0);
                      const isOverdue = new Date(b.due_date).getTime() < Date.now();
                      return (
                        <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-primary whitespace-nowrap">
                            {b.bill_number}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-foreground">
                            {b.supplier_name}
                          </td>
                          <td className="py-3.5 px-4 text-xs capitalize text-muted-foreground whitespace-nowrap">
                            {b.category.replace(/_/g, " ")}
                          </td>
                          <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                            <span className={isOverdue ? "font-semibold text-rose-600" : "text-muted-foreground"}>
                              {formatDate(b.due_date)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-foreground whitespace-nowrap">
                            {formatMoney(b.amount)}
                          </td>
                          <td className="py-3.5 px-4 text-right text-xs text-emerald-600 whitespace-nowrap">
                            {formatMoney(b.paid_amount || 0)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-rose-600 whitespace-nowrap">
                            {formatMoney(balance)}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <Button size="sm" variant="outline" asChild className="h-7 text-xs">
                              <Link to="/finance/suppliers">Pay</Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
