import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { formatMoney, formatNumber } from "@/lib/format";
import {
  getInventoryValuation,
  type InventoryValuationMetrics,
} from "@/services/manufacturingFinanceService";
import {
  Package,
  Boxes,
  Wrench,
  Flame,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Layers,
  Sparkles,
} from "lucide-react";
import { FinanceNavHeader } from "../FinanceNavHeader";

export default function InventoryValuation() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<InventoryValuationMetrics | null>(null);

  const loadData = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const data = await getInventoryValuation(organisation.id);
      setMetrics(data);
    } catch (err) {
      console.error("Failed to load inventory valuation:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  if (loading) return <PageLoader />;

  const m = metrics || {
    totalValue: 0,
    rawMaterialsValue: 0,
    sparesValue: 0,
    finishedGoodsValue: 0,
    otherValue: 0,
    totalItemCount: 0,
    lowStockItemsValue: 0,
    recentScrapLoss30Days: 0,
    scrapByReason: [],
  };

  const rawPct = m.totalValue > 0 ? Math.round((m.rawMaterialsValue / m.totalValue) * 100) : 0;
  const fgPct = m.totalValue > 0 ? Math.round((m.finishedGoodsValue / m.totalValue) * 100) : 0;
  const sparesPct = m.totalValue > 0 ? Math.round((m.sparesValue / m.totalValue) * 100) : 0;

  return (
    <div className="space-y-6 p-6">
      <FinanceNavHeader
        title="Material & Inventory Valuation"
        subtitle="Capital tied up in factory inventory: raw materials, spare parts, finished goods & scrap waste financial losses."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild className="gap-1.5 h-8 text-xs font-semibold">
              <Link to="/finance">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Overview
              </Link>
            </Button>
            <Button size="sm" asChild className="gap-1.5 h-8 text-xs font-semibold">
              <Link to="/inventory">
                <Package className="h-3.5 w-3.5" />
                Inventory Master
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="gap-1.5 h-8 text-xs font-semibold"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">Total Inventory Capital</div>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {formatMoney(m.totalValue)}
          </div>
          <div className="text-[11px] text-muted-foreground">{m.totalItemCount} SKU items tracked</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">Raw Materials Value</div>
          <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {formatMoney(m.rawMaterialsValue)}
          </div>
          <div className="text-[11px] text-muted-foreground">{rawPct}% of total plant inventory</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">Finished Goods Value</div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {formatMoney(m.finishedGoodsValue)}
          </div>
          <div className="text-[11px] text-muted-foreground">{fgPct}% ready for dispatch</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">MRO & Maintenance Spares</div>
          <div className="text-2xl font-bold tracking-tight text-orange-600 dark:text-orange-400">
            {formatMoney(m.sparesValue)}
          </div>
          <div className="text-[11px] text-muted-foreground">{sparesPct}% machinery components</div>
        </div>
      </div>

      {/* Inventory Capital Composition */}
      <div className="p-5 rounded-xl border border-border bg-card shadow-2xs space-y-4">
        <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          Working Capital Allocation in Inventory
        </h3>

        <div className="space-y-2">
          <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex">
            <div className="bg-blue-500 h-full transition-all" style={{ width: `${rawPct}%` }} title="Raw Materials" />
            <div className="bg-emerald-500 h-full transition-all" style={{ width: `${fgPct}%` }} title="Finished Goods" />
            <div className="bg-orange-500 h-full transition-all" style={{ width: `${sparesPct}%` }} title="Spare Parts" />
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs pt-1">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Raw Materials:</span>
              <span className="font-bold text-foreground">{formatMoney(m.rawMaterialsValue)} ({rawPct}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Finished Goods:</span>
              <span className="font-bold text-foreground">{formatMoney(m.finishedGoodsValue)} ({fgPct}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
              <span className="text-muted-foreground">Spare Parts & MRO:</span>
              <span className="font-bold text-foreground">{formatMoney(m.sparesValue)} ({sparesPct}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Material Scrap & Waste Financial Impact */}
      <div className="p-5 rounded-xl border border-border bg-card shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" />
              Material Scrap & Waste Financial Losses (Last 30 Days)
            </h3>
            <p className="text-xs text-muted-foreground">
              Total 30-day scrap penalty: <strong className="text-red-500 font-bold">{formatMoney(m.recentScrapLoss30Days)}</strong>
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="gap-1.5 h-8 text-xs font-semibold">
            <Link to="/production/waste">
              View Waste Logs
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>

        {m.scrapByReason.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No scrap loss events recorded in the last 30 days. High quality yield!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {m.scrapByReason.map((s, idx) => (
              <div key={idx} className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground">{s.reason}</span>
                  <span className="text-[11px] text-muted-foreground">{s.count} occurrences</span>
                </div>
                <div className="text-base font-bold text-red-600 dark:text-red-400">
                  {formatMoney(s.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
