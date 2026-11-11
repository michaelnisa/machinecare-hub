import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney, formatDate } from "@/lib/format";
import { FinanceNavHeader } from "./FinanceNavHeader";
import {
  getFinancialOverview,
  type FinancialOverviewMetrics,
} from "@/services/financeService";
import {
  BarChart3,
  FileSpreadsheet,
  Printer,
  Calendar,
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Fuel,
  Wrench,
  Truck,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export default function FinanceReports() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<FinancialOverviewMetrics | null>(null);
  const [period, setPeriod] = useState("all_time");

  const loadData = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const data = await getFinancialOverview(organisation.id);
      setMetrics(data);
    } catch (err) {
      console.error("Failed to load reports:", err);
      toast.error("Failed to compile financial reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!metrics) return;

    const rows = [
      ["FINANCIAL STATEMENT & P&L REPORT"],
      ["Organisation", organisation?.name || "Fleet Tenant"],
      ["Date Generated", new Date().toLocaleDateString()],
      [],
      ["LINE ITEM", "AMOUNT (TZS)"],
      ["Total Freight & Invoiced Revenue", metrics.totalRevenue],
      [],
      ["OPERATING EXPENSES (COGS)", ""],
      ["Fuel & Lubricants", metrics.fuelTotalCost],
      ["Spare Parts & Servicing", metrics.maintenanceTotalCost],
      ["Trip & Driver Transit Expenses", metrics.tripExpensesTotal],
      ["Supplier & Vendor Bills", metrics.totalExpenses - (metrics.fuelTotalCost + metrics.maintenanceTotalCost + metrics.tripExpensesTotal)],
      ["Total Operating Expenses", metrics.totalExpenses],
      [],
      ["NET OPERATING PROFIT / (LOSS)", metrics.netProfit],
      ["Operating Margin %", `${metrics.operatingMarginPct}%`],
      [],
      ["WORKING CAPITAL POSITION", ""],
      ["Accounts Receivable (Uncollected Revenue)", metrics.arOutstanding],
      ["Accounts Payable (Owed to Suppliers)", metrics.apOutstanding],
      ["Net Cash Flow Balance", metrics.netCashFlow],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((r) => r.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `financial_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Financial statement exported to CSV");
  };

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
      <div className="print:hidden">
        <FinanceNavHeader
          title="Management Financial Reports & Statements"
          subtitle="Formal Income Statement (P&L), operational expense distribution, and balance audit."
          actions={
            <>
              <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
                <FileSpreadsheet className="h-4 w-4" />
                Export CSV
              </Button>
              <Button size="sm" onClick={handlePrint} className="gap-1.5">
                <Printer className="h-4 w-4" />
                Print Financial Statement
              </Button>
            </>
          }
        />
      </div>

      {/* Printable Report Document Card */}
      <div className="rounded-xl border border-border bg-card p-6 md:p-8 shadow-sm space-y-8 max-w-4xl mx-auto print:border-none print:shadow-none print:p-0">
        {/* Statement Header */}
        <div className="border-b border-border pb-6 flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-primary" />
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {organisation?.name || "MachineCare Hub"}
              </h2>
            </div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1 font-semibold">
              Fleet Commercial & Financial Statement
            </p>
            <p className="text-xs text-muted-foreground">
              Period: {period === "all_time" ? "Cumulative YTD / Live Operating Record" : "Selected Fiscal Window"}
            </p>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Audited Internal Report
            </span>
            <p className="text-xs text-muted-foreground mt-1.5">
              Generated: {formatDate(new Date())}
            </p>
          </div>
        </div>

        {/* Executive Summary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/30 border border-border">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Gross Revenue</span>
            <p className="text-lg font-bold text-foreground mt-0.5">{formatMoney(m.totalRevenue)}</p>
          </div>
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Operating Costs</span>
            <p className="text-lg font-bold text-rose-600 mt-0.5">{formatMoney(m.totalExpenses)}</p>
          </div>
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Net Operating Profit</span>
            <p className={`text-lg font-bold mt-0.5 ${isProfitable ? "text-primary" : "text-rose-600"}`}>
              {formatMoney(m.netProfit)}
            </p>
          </div>
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Profit Margin</span>
            <p className={`text-lg font-bold mt-0.5 ${isProfitable ? "text-emerald-600" : "text-rose-600"}`}>
              {m.operatingMarginPct}%
            </p>
          </div>
        </div>

        {/* Detailed Profit & Loss Table */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            1. Income Statement (P&L)
          </h3>

          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-4">Line Item / Operational Category</th>
                  <th className="py-2.5 px-4 text-right">Amount (TZS)</th>
                  <th className="py-2.5 px-4 text-right">% of Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* Revenue Lines */}
                <tr className="bg-emerald-500/5 font-semibold">
                  <td className="py-3 px-4 text-emerald-800 dark:text-emerald-300">
                    Gross Invoiced Freight & Logistics Revenue
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-800 dark:text-emerald-300">
                    {formatMoney(m.totalRevenue)}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-800 dark:text-emerald-300">
                    100.0%
                  </td>
                </tr>

                {/* Direct Costs */}
                <tr className="bg-muted/10 font-medium">
                  <td className="py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground" colSpan={3}>
                    Direct Fleet Operating Costs (COGS)
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 px-4 pl-6 text-foreground">Fuel & Lubricant Procurement</td>
                  <td className="py-2.5 px-4 text-right text-rose-600 font-medium">{formatMoney(m.fuelTotalCost)}</td>
                  <td className="py-2.5 px-4 text-right text-xs text-muted-foreground">
                    {m.totalRevenue > 0 ? ((m.fuelTotalCost / m.totalRevenue) * 100).toFixed(1) : 0}%
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 px-4 pl-6 text-foreground">Spare Parts, Tyres & Workshop Maintenance</td>
                  <td className="py-2.5 px-4 text-right text-rose-600 font-medium">{formatMoney(m.maintenanceTotalCost)}</td>
                  <td className="py-2.5 px-4 text-right text-xs text-muted-foreground">
                    {m.totalRevenue > 0 ? ((m.maintenanceTotalCost / m.totalRevenue) * 100).toFixed(1) : 0}%
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 px-4 pl-6 text-foreground">Trip Disbursements, Tolls & Driver Allowances</td>
                  <td className="py-2.5 px-4 text-right text-rose-600 font-medium">{formatMoney(m.tripExpensesTotal)}</td>
                  <td className="py-2.5 px-4 text-right text-xs text-muted-foreground">
                    {m.totalRevenue > 0 ? ((m.tripExpensesTotal / m.totalRevenue) * 100).toFixed(1) : 0}%
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 px-4 pl-6 text-foreground">Supplier & Third-Party Vendor Bills</td>
                  <td className="py-2.5 px-4 text-right text-rose-600 font-medium">
                    {formatMoney(
                      Math.max(
                        m.totalExpenses -
                          (m.fuelTotalCost + m.maintenanceTotalCost + m.tripExpensesTotal),
                        0
                      )
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right text-xs text-muted-foreground">
                    {m.totalRevenue > 0
                      ? (
                          (Math.max(
                            m.totalExpenses -
                              (m.fuelTotalCost + m.maintenanceTotalCost + m.tripExpensesTotal),
                            0
                          ) /
                            m.totalRevenue) *
                          100
                        ).toFixed(1)
                      : 0}
                    %
                  </td>
                </tr>

                {/* Total Costs Subtotal */}
                <tr className="bg-rose-500/5 font-semibold">
                  <td className="py-3 px-4 text-rose-800 dark:text-rose-300">
                    Total Operating Costs
                  </td>
                  <td className="py-3 px-4 text-right text-rose-800 dark:text-rose-300">
                    ({formatMoney(m.totalExpenses)})
                  </td>
                  <td className="py-3 px-4 text-right text-rose-800 dark:text-rose-300">
                    {m.totalRevenue > 0 ? ((m.totalExpenses / m.totalRevenue) * 100).toFixed(1) : 0}%
                  </td>
                </tr>

                {/* Net Income */}
                <tr className="bg-primary/10 font-bold text-base">
                  <td className="py-3.5 px-4 text-primary">
                    Net Operating Profit / (Loss)
                  </td>
                  <td className="py-3.5 px-4 text-right text-primary">
                    {formatMoney(m.netProfit)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-primary">
                    {m.operatingMarginPct}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Working Capital Schedule */}
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            2. Working Capital & Liquidity Balances
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-border bg-card">
              <span className="text-xs text-muted-foreground font-medium">Accounts Receivable (AR)</span>
              <p className="text-xl font-bold text-amber-600 mt-1">{formatMoney(m.arOutstanding)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Pending payments from customers</p>
            </div>

            <div className="p-4 rounded-lg border border-border bg-card">
              <span className="text-xs text-muted-foreground font-medium">Accounts Payable (AP)</span>
              <p className="text-xl font-bold text-rose-600 mt-1">{formatMoney(m.apOutstanding)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Pending obligations to suppliers</p>
            </div>

            <div className="p-4 rounded-lg border border-border bg-card">
              <span className="text-xs text-muted-foreground font-medium">Net Working Position</span>
              <p className="text-xl font-bold text-primary mt-1">
                {formatMoney(m.arOutstanding - m.apOutstanding)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">AR minus AP liability</p>
            </div>
          </div>
        </div>

        {/* Signatures for Print */}
        <div className="hidden print:grid grid-cols-2 gap-12 pt-16 text-xs text-gray-700">
          <div className="border-t border-gray-400 pt-2">
            <p className="font-bold">Prepared By: Finance Officer</p>
            <p className="text-gray-500 mt-1">Signature & Date</p>
          </div>
          <div className="border-t border-gray-400 pt-2 text-right">
            <p className="font-bold">Approved By: Managing Director / Fleet Controller</p>
            <p className="text-gray-500 mt-1">Signature & Date</p>
          </div>
        </div>
      </div>
    </div>
  );
}
