import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import {
  getFinancialOverview,
  type FinancialOverviewMetrics,
} from "@/services/financeService";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Fuel,
  Wrench,
  Truck,
  Receipt,
  FileText,
  Building2,
  Calendar,
  CreditCard,
  PieChart,
  BarChart3,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { FinanceNavHeader } from "./FinanceNavHeader";

export default function FinanceOverview() {
  const { organisation } = useAuth();
  const [metrics, setMetrics] = useState<FinancialOverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    if (!organisation?.id) return;
    try {
      const data = await getFinancialOverview(organisation.id);
      setMetrics(data);
    } catch (err) {
      console.error("Failed to load financial overview:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  if (loading) return <PageLoader />;

  const m = metrics || {
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    operatingMarginPct: 0,
    netCashFlow: 0,
    arOutstanding: 0,
    apOutstanding: 0,
    fuelTotalCost: 0,
    maintenanceTotalCost: 0,
    tripExpensesTotal: 0,
    monthlyTrend: [],
    expenseCategoryBreakdown: [],
  };

  const isProfitable = m.netProfit >= 0;

  return (
    <div className="space-y-6 p-6">
      <FinanceNavHeader
        title="Financial Overview"
        subtitle={`P&L statement, operating cash flow, freight billing & unit economics for ${organisation?.name || "Fleet"}.`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRefreshing(true);
                loadData();
              }}
              disabled={refreshing}
              className="gap-1.5"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button size="sm" asChild className="gap-1.5">
              <Link to="/finance/invoices">
                <Plus className="h-4 w-4" />
                Create Invoice
              </Link>
            </Button>

            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link to="/finance/expenses">
                <Receipt className="h-4 w-4" />
                Record Expense
              </Link>
            </Button>
          </>
        }
      />

      {/* Primary KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Total Revenue */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Total Revenue</span>
            <span className="rounded-md bg-emerald-500/10 p-1 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {formatMoney(m.totalRevenue)}
          </div>
          <div className="mt-1 flex items-center text-xs text-muted-foreground">
            <span>Customer billing & trip income</span>
          </div>
        </div>

        {/* Operating Expenses */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Total OpEx</span>
            <span className="rounded-md bg-rose-500/10 p-1 text-rose-600">
              <TrendingDown className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
            {formatMoney(m.totalExpenses)}
          </div>
          <div className="mt-1 flex items-center text-xs text-muted-foreground">
            <span>Fuel, repairs, trips & bills</span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Net Operating Profit</span>
            <span className={`rounded-md p-1 ${isProfitable ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>
              {isProfitable ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            </span>
          </div>
          <div className={`mt-2 text-2xl font-bold tracking-tight ${isProfitable ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {formatMoney(m.netProfit)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Margin: <strong>{m.operatingMarginPct}%</strong>
          </div>
        </div>

        {/* Accounts Receivable */}
        <Link
          to="/finance/ap-ar"
          className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-sky-500/50 transition-colors block"
        >
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Receivables (AR)</span>
            <span className="rounded-md bg-sky-500/10 p-1 text-sky-600">
              <FileText className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-sky-600 dark:text-sky-400">
            {formatMoney(m.arOutstanding)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Unpaid client invoices →
          </div>
        </Link>

        {/* Accounts Payable */}
        <Link
          to="/finance/ap-ar"
          className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-amber-500/50 transition-colors block"
        >
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Payables (AP)</span>
            <span className="rounded-md bg-amber-500/10 p-1 text-amber-600">
              <Building2 className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {formatMoney(m.apOutstanding)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Supplier bills due →
          </div>
        </Link>
      </div>

      {/* Middle Row: Monthly Trend + Expense Breakdown */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Monthly Trend Chart Card */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <div>
                <h3 className="font-semibold text-foreground">Monthly Financial Performance</h3>
                <p className="text-xs text-muted-foreground">Revenue vs. Operating Expenses over the last 6 months</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Expenses
              </span>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {m.monthlyTrend.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No transaction records available in this period.
              </div>
            ) : (
              m.monthlyTrend.map((t) => {
                const maxVal = Math.max(...m.monthlyTrend.map((x) => Math.max(x.revenue, x.expenses)), 1000);
                const revPct = Math.round((t.revenue / maxVal) * 100);
                const expPct = Math.round((t.expenses / maxVal) * 100);

                return (
                  <div key={t.month} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="w-16 font-mono text-muted-foreground">{t.month}</span>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-emerald-600 font-semibold">{formatMoney(t.revenue)}</span>
                        <span className="text-rose-600">{formatMoney(t.expenses)}</span>
                        <span className={`w-20 text-right font-bold ${t.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {t.profit >= 0 ? `+${formatMoney(t.profit)}` : formatMoney(t.profit)}
                        </span>
                      </div>
                    </div>
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/50 gap-1 p-0.5">
                      <div
                        className="rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.max(revPct, 2)}%` }}
                        title={`Revenue: ${formatMoney(t.revenue)}`}
                      />
                      <div
                        className="rounded-full bg-rose-500/80 transition-all duration-500"
                        style={{ width: `${Math.max(expPct, 2)}%` }}
                        title={`Expenses: ${formatMoney(t.expenses)}`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Expense Category Breakdown */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-4 border-b border-border">
              <PieChart className="h-5 w-5 text-primary" />
              <div>
                <h3 className="font-semibold text-foreground">Operating Cost Centers</h3>
                <p className="text-xs text-muted-foreground">Distribution of fleet expenses</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {m.expenseCategoryBreakdown.map((cat, idx) => {
                const colors = [
                  "bg-amber-500 text-amber-500",
                  "bg-sky-500 text-sky-500",
                  "bg-purple-500 text-purple-500",
                  "bg-emerald-500 text-emerald-500",
                ];
                const activeColor = colors[idx % colors.length];

                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{cat.category}</span>
                      <span className="font-semibold text-muted-foreground">
                        {formatMoney(cat.amount)} ({cat.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                      <div
                        className={`h-full rounded-full ${activeColor.split(" ")[0]} transition-all duration-500`}
                        style={{ width: `${Math.max(cat.percentage, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border">
            <Button variant="outline" size="sm" asChild className="w-full gap-2">
              <Link to="/finance/expenses">
                View All Operating Expenses →
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards into 10 Finance Sub-Modules */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Finance Capabilities & Ledgers
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <Link
            to="/finance/expenses"
            className="group rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:bg-muted/20 transition-all block"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-rose-500/10 p-2.5 text-rose-600 group-hover:scale-105 transition-transform">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">Expenses</h4>
                <p className="text-xs text-muted-foreground line-clamp-1">Operational & vehicle receipts</p>
              </div>
            </div>
          </Link>

          <Link
            to="/finance/fuel"
            className="group rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:bg-muted/20 transition-all block"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2.5 text-amber-600 group-hover:scale-105 transition-transform">
                <Fuel className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">Fuel Finance</h4>
                <p className="text-xs text-muted-foreground line-clamp-1">Purchases, TZS/Litre & stations</p>
              </div>
            </div>
          </Link>

          <Link
            to="/finance/trips"
            className="group rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:bg-muted/20 transition-all block"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-600 group-hover:scale-105 transition-transform">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">Trip Revenue & Costs</h4>
                <p className="text-xs text-muted-foreground line-clamp-1">Freight revenue & margin per trip</p>
              </div>
            </div>
          </Link>

          <Link
            to="/finance/invoices"
            className="group rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:bg-muted/20 transition-all block"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-sky-500/10 p-2.5 text-sky-600 group-hover:scale-105 transition-transform">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">Invoicing & Clients</h4>
                <p className="text-xs text-muted-foreground line-clamp-1">Customer invoices & receipts</p>
              </div>
            </div>
          </Link>

          <Link
            to="/finance/suppliers"
            className="group rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:bg-muted/20 transition-all block"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/10 p-2.5 text-purple-600 group-hover:scale-105 transition-transform">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">Supplier Payments</h4>
                <p className="text-xs text-muted-foreground line-clamp-1">Fuel, spare parts & vendor bills</p>
              </div>
            </div>
          </Link>

          <Link
            to="/finance/ap-ar"
            className="group rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:bg-muted/20 transition-all block"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-500/10 p-2.5 text-indigo-600 group-hover:scale-105 transition-transform">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">AP & AR Aging</h4>
                <p className="text-xs text-muted-foreground line-clamp-1">Payables & receivables buckets</p>
              </div>
            </div>
          </Link>

          <Link
            to="/finance/cash-flow"
            className="group rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:bg-muted/20 transition-all block"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-teal-500/10 p-2.5 text-teal-600 group-hover:scale-105 transition-transform">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">Cash Flow</h4>
                <p className="text-xs text-muted-foreground line-clamp-1">Inflow, outflow & net burn</p>
              </div>
            </div>
          </Link>

          <Link
            to="/finance/vehicle-profitability"
            className="group rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:bg-muted/20 transition-all block"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2.5 text-amber-600 group-hover:scale-105 transition-transform">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">Vehicle Profitability</h4>
                <p className="text-xs text-muted-foreground line-clamp-1">Net profit & Cost/KM (CPK)</p>
              </div>
            </div>
          </Link>

          <Link
            to="/finance/reports"
            className="group rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:bg-muted/20 transition-all block col-span-full sm:col-span-2 md:col-span-1"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5 text-primary group-hover:scale-105 transition-transform">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">Financial Reports</h4>
                <p className="text-xs text-muted-foreground line-clamp-1">P&L statements, CSV & Print</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
