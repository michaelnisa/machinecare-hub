import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import {
  getManufacturingFinancialOverview,
  type ManufacturingOverviewMetrics,
} from "@/services/manufacturingFinanceService";
import {
  Factory,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Wrench,
  AlertTriangle,
  Flame,
  Boxes,
  FileText,
  Building2,
  Calendar,
  PiggyBank,
  RefreshCw,
  ArrowUpRight,
  ArrowRight,
  ShieldAlert,
  BarChart3,
  Layers,
} from "lucide-react";
import { FinanceNavHeader } from "../FinanceNavHeader";

export default function ManufacturingFinanceOverview() {
  const { organisation } = useAuth();
  const [metrics, setMetrics] = useState<ManufacturingOverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    if (!organisation?.id) return;
    try {
      const data = await getManufacturingFinancialOverview(organisation.id);
      setMetrics(data);
    } catch (err) {
      console.error("Failed to load manufacturing finance overview:", err);
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
    grossRevenue: 0,
    cogm: 0,
    directMaterialCost: 0,
    directLabourCost: 0,
    maintenanceSpend: 0,
    downtimeLoss: 0,
    scrapLoss: 0,
    grossMargin: 0,
    grossMarginPct: 0,
    netOperatingProfit: 0,
    totalInventoryValuation: 0,
    rawMaterialValuation: 0,
    finishedGoodsValuation: 0,
    sparesValuation: 0,
    arOutstanding: 0,
    apOutstanding: 0,
    monthlyTrend: [],
    costBreakdown: [],
  };

  const isProfitable = m.grossMargin >= 0;

  return (
    <div className="space-y-6 p-6">
      <FinanceNavHeader
        title="Manufacturing Financial Overview"
        subtitle={`Cost of Goods Manufactured (COGM), Plant P&L, Scrap/Downtime Losses & Unit Economics for ${organisation?.name || "Manufacturing Plant"}.`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRefreshing(true);
                loadData();
              }}
              disabled={refreshing}
              className="gap-1.5 h-8 text-xs font-semibold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" asChild className="gap-1.5 h-8 text-xs font-semibold">
              <Link to="/finance/invoices">
                <FileText className="h-3.5 w-3.5" />
                Customer Invoices
              </Link>
            </Button>
            <Button size="sm" variant="secondary" asChild className="gap-1.5 h-8 text-xs font-semibold">
              <Link to="/finance/production-costing">
                <Boxes className="h-3.5 w-3.5" />
                Batch Costing
              </Link>
            </Button>
          </div>
        }
      />

      {/* Top Plant KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Finished Goods Revenue */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Finished Goods Revenue</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold tracking-tight text-foreground">
            {formatMoney(m.grossRevenue)}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span>AR Pending:</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {formatMoney(m.arOutstanding)}
            </span>
          </div>
        </div>

        {/* COGM (Cost of Goods Manufactured) */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Cost of Production (COGM)</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
              <Factory className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold tracking-tight text-foreground">
            {formatMoney(m.cogm)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Direct Materials + Labour + Overheads
          </div>
        </div>

        {/* Gross Operating Margin */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Plant Gross Margin</span>
            <div className={`p-1.5 rounded-lg ${isProfitable ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
              {isProfitable ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            </div>
          </div>
          <div className={`text-xl font-bold tracking-tight ${isProfitable ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {formatMoney(m.grossMargin)}
          </div>
          <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <span>Margin:</span>
            <span className={isProfitable ? "text-emerald-600" : "text-red-600"}>
              {m.grossMarginPct.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Downtime Financial Loss */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Downtime Cost Loss</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {formatMoney(m.downtimeLoss)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Machine Stoppage Financial Penalty
          </div>
        </div>

        {/* Scrap & Material Waste Loss */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Scrap & Defect Cost</span>
            <div className="p-1.5 rounded-lg bg-red-500/10 text-red-600">
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold tracking-tight text-red-600 dark:text-red-400">
            {formatMoney(m.scrapLoss)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Material Waste & Defective Units
          </div>
        </div>

        {/* Factory Inventory Capital */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Inventory Value (Capital)</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold tracking-tight text-foreground">
            {formatMoney(m.totalInventoryValuation)}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Raw: {formatMoney(m.rawMaterialValuation)}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Trend & Cost Pool Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend Chart / Table */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-border bg-card shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Monthly Production Economics & Gross Profit
              </h3>
              <p className="text-xs text-muted-foreground">
                Revenue vs Cost of Goods Manufactured (COGM)
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {m.monthlyTrend.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No monthly transaction data available yet.</div>
            ) : (
              m.monthlyTrend.map((t, idx) => {
                const maxVal = Math.max(...m.monthlyTrend.map((x) => Math.max(x.revenue, x.productionCost, 1)));
                const revWidth = Math.round((t.revenue / maxVal) * 100);
                const costWidth = Math.round((t.productionCost / maxVal) * 100);

                return (
                  <div key={idx} className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between font-medium">
                      <span className="font-bold text-foreground w-20">{t.month}</span>
                      <div className="flex items-center gap-4 text-muted-foreground text-[11px]">
                        <span>Revenue: <strong className="text-emerald-600">{formatMoney(t.revenue)}</strong></span>
                        <span>COGM: <strong className="text-blue-600">{formatMoney(t.productionCost)}</strong></span>
                        <span>Margin: <strong className={t.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"}>{formatMoney(t.grossProfit)}</strong></span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex gap-1">
                      <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${revWidth}%` }} title="Revenue" />
                      <div className="bg-blue-500 h-full rounded-full transition-all" style={{ width: `${costWidth}%` }} title="COGM" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Cost Pool Allocation Breakdown */}
        <div className="p-5 rounded-xl border border-border bg-card shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Plant Cost Centers Breakdown
              </h3>
              <p className="text-xs text-muted-foreground">
                Allocation of manufacturing expenditure
              </p>
            </div>
          </div>

          <div className="space-y-3.5">
            {m.costBreakdown.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No cost records logged yet.</div>
            ) : (
              m.costBreakdown.map((c, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{c.category}</span>
                    <span className="font-bold text-foreground">{formatMoney(c.amount)} ({c.percentage}%)</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.max(3, c.percentage))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Navigation into Manufacturing Cost Centers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Batch Costing Card */}
        <Link
          to="/finance/production-costing"
          className="p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all group flex flex-col justify-between space-y-3"
        >
          <div className="flex items-start justify-between">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
              <Boxes className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          <div>
            <div className="font-semibold text-sm text-foreground">Batch & SKU Job Costing</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Unit economics, BOM material usage, labour allocation, and margin per order.
            </div>
          </div>
        </Link>

        {/* Machine Maintenance Cost Center */}
        <Link
          to="/finance/maintenance-costs"
          className="p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all group flex flex-col justify-between space-y-3"
        >
          <div className="flex items-start justify-between">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600">
              <Wrench className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          <div>
            <div className="font-semibold text-sm text-foreground">Machine Maintenance Costs</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Spares spend, technician labour, and downtime financial impact per machine.
            </div>
          </div>
        </Link>

        {/* Inventory Valuation */}
        <Link
          to="/finance/inventory-valuation"
          className="p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all group flex flex-col justify-between space-y-3"
        >
          <div className="flex items-start justify-between">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
              <Package className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          <div>
            <div className="font-semibold text-sm text-foreground">Material & Inventory Valuation</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Capital tied up in raw materials, finished stock, and scrap defect losses.
            </div>
          </div>
        </Link>

        {/* Commercial Invoicing & AR */}
        <Link
          to="/finance/invoices"
          className="p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all group flex flex-col justify-between space-y-3"
        >
          <div className="flex items-start justify-between">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <FileText className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          <div>
            <div className="font-semibold text-sm text-foreground">Customer Invoicing & AR</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Commercial billing for finished goods, payment collections, and customer aging.
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
