import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatNumber } from "@/lib/format";
import {
  getProductionBatchCosting,
  type BatchCostingRecord,
} from "@/services/manufacturingFinanceService";
import {
  Boxes,
  Search,
  Filter,
  Download,
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Layers,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { FinanceNavHeader } from "../FinanceNavHeader";

export default function ProductionCosting() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<BatchCostingRecord[]>([]);
  const [search, setSearch] = useState("");
  const [lineFilter, setLineFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadData = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const data = await getProductionBatchCosting(organisation.id);
      setRecords(data);
    } catch (err) {
      console.error("Failed to load production batch costing:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  const uniqueLines = useMemo(() => {
    const s = new Set<string>();
    records.forEach((r) => {
      if (r.productionLine) s.add(r.productionLine);
    });
    return Array.from(s);
  }, [records]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const matchSearch =
        r.poNumber.toLowerCase().includes(search.toLowerCase()) ||
        r.productName.toLowerCase().includes(search.toLowerCase()) ||
        (r.productSku && r.productSku.toLowerCase().includes(search.toLowerCase()));

      const matchLine = lineFilter === "all" || r.productionLine === lineFilter;
      const matchStatus = statusFilter === "all" || r.status === statusFilter;

      return matchSearch && matchLine && matchStatus;
    });
  }, [records, search, lineFilter, statusFilter]);

  // Summary Metrics
  const summary = useMemo(() => {
    const totalCost = filtered.reduce((acc, r) => acc + r.totalBatchCost, 0);
    const totalUnits = filtered.reduce((acc, r) => acc + r.completedQty, 0);
    const avgUnitCost = totalUnits > 0 ? Math.round(totalCost / totalUnits) : 0;
    const avgMargin =
      filtered.length > 0
        ? Math.round(filtered.reduce((acc, r) => acc + r.unitMarginPct, 0) / filtered.length)
        : 0;

    return { totalCost, totalUnits, avgUnitCost, avgMargin };
  }, [filtered]);

  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    const headers = [
      "PO Number",
      "Product Name",
      "SKU",
      "Production Line",
      "Status",
      "Planned Qty",
      "Completed Qty",
      "Material Cost",
      "Labour Cost",
      "Scrap Cost",
      "Total Batch Cost",
      "Unit Cost",
      "Target Price",
      "Margin %",
    ];

    const rows = filtered.map((r) => [
      r.poNumber,
      `"${r.productName}"`,
      r.productSku || "",
      `"${r.productionLine}"`,
      r.status,
      r.plannedQty,
      r.completedQty,
      r.materialCost,
      r.labourCost,
      r.scrapCost,
      r.totalBatchCost,
      r.unitCost,
      r.targetSellingPrice,
      `${r.unitMarginPct}%`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `production_job_costing_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 p-6">
      <FinanceNavHeader
        title="Batch & SKU Job Costing"
        subtitle="Comprehensive production cost ledger: BOM material consumption, direct labour, scrap penalty & unit margins."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild className="gap-1.5 h-8 text-xs font-semibold">
              <Link to="/finance">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Overview
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              className="gap-1.5 h-8 text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button
              variant="default"
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
          <div className="text-xs font-semibold text-muted-foreground">Total Filtered Batch Spend</div>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {formatMoney(summary.totalCost)}
          </div>
          <div className="text-[11px] text-muted-foreground">{filtered.length} Production Batches</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">Finished Output Volume</div>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {formatNumber(summary.totalUnits)} units
          </div>
          <div className="text-[11px] text-muted-foreground">Good output completed</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">Weighted Avg Cost / Unit</div>
          <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {formatMoney(summary.avgUnitCost)}
          </div>
          <div className="text-[11px] text-muted-foreground">Direct materials + labour + overhead</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">Average Batch Gross Margin</div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {summary.avgMargin}%
          </div>
          <div className="text-[11px] text-muted-foreground">Target price vs manufacture cost</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search PO, product name, or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <select
            value={lineFilter}
            onChange={(e) => setLineFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Production Lines</option>
            {uniqueLines.map((line) => (
              <option key={line} value={line}>{line}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
            <option value="planned">Planned</option>
            <option value="released">Released</option>
          </select>
        </div>
      </div>

      {/* Cost Ledger Table */}
      <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-3.5">Order / Batch</th>
                <th className="py-3 px-3.5">Product & Line</th>
                <th className="py-3 px-3.5 text-right">Output (Good / Plan)</th>
                <th className="py-3 px-3.5 text-right">Materials</th>
                <th className="py-3 px-3.5 text-right">Labour</th>
                <th className="py-3 px-3.5 text-right">Scrap Cost</th>
                <th className="py-3 px-3.5 text-right">Total Batch Cost</th>
                <th className="py-3 px-3.5 text-right">Unit Cost</th>
                <th className="py-3 px-3.5 text-right">Margin %</th>
                <th className="py-3 px-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground">
                    No production orders found matching your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.orderId} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3.5 font-bold text-foreground">
                      <div>{r.poNumber}</div>
                      {r.startDate && (
                        <div className="text-[10px] font-normal text-muted-foreground">
                          {new Date(r.startDate).toLocaleDateString("en-GB")}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="font-semibold text-foreground">{r.productName}</div>
                      <div className="text-[10px] text-muted-foreground">Line: {r.productionLine}</div>
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <span className="font-bold text-foreground">{formatNumber(r.completedQty)}</span>
                      <span className="text-muted-foreground text-[10px]"> / {formatNumber(r.plannedQty)}</span>
                      {r.scrapQty > 0 && (
                        <div className="text-[10px] text-red-500 font-semibold">
                          +{r.scrapQty} scrap
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-right text-muted-foreground">
                      {formatMoney(r.materialCost)}
                    </td>
                    <td className="py-3 px-3.5 text-right text-muted-foreground">
                      {formatMoney(r.labourCost)}
                    </td>
                    <td className="py-3 px-3.5 text-right text-muted-foreground">
                      {r.scrapCost > 0 ? (
                        <span className="text-red-500 font-semibold">{formatMoney(r.scrapCost)}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-right font-bold text-foreground">
                      {formatMoney(r.totalBatchCost)}
                    </td>
                    <td className="py-3 px-3.5 text-right font-bold text-blue-600 dark:text-blue-400">
                      {formatMoney(r.unitCost)}
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          r.unitMarginPct >= 20
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {r.unitMarginPct}%
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <Badge variant="outline" className="capitalize text-[10px] py-0 px-1.5">
                        {r.status.replace("_", " ")}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
