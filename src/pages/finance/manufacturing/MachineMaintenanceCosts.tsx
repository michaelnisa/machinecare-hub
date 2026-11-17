import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney, formatNumber } from "@/lib/format";
import {
  getMachineMaintenanceFinancials,
  type MachineCostRecord,
} from "@/services/manufacturingFinanceService";
import {
  Wrench,
  Search,
  Download,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Clock,
  DollarSign,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { FinanceNavHeader } from "../FinanceNavHeader";

export default function MachineMaintenanceCosts() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<MachineCostRecord[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const loadData = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const data = await getMachineMaintenanceFinancials(organisation.id);
      setRecords(data);
    } catch (err) {
      console.error("Failed to load machine maintenance financials:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  const uniqueCategories = useMemo(() => {
    const s = new Set<string>();
    records.forEach((r) => {
      if (r.category) s.add(r.category);
    });
    return Array.from(s);
  }, [records]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const matchSearch = r.machineName.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === "all" || r.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [records, search, categoryFilter]);

  const totals = useMemo(() => {
    const totalParts = filtered.reduce((acc, r) => acc + r.partsCost, 0);
    const totalLabour = filtered.reduce((acc, r) => acc + r.labourCost, 0);
    const totalDowntimeCost = filtered.reduce((acc, r) => acc + r.downtimeCost, 0);
    const grandTotal = filtered.reduce((acc, r) => acc + r.totalMaintenanceCost, 0);

    return { totalParts, totalLabour, totalDowntimeCost, grandTotal };
  }, [filtered]);

  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    const headers = [
      "Machine Name",
      "Category",
      "Work Orders",
      "Parts Cost",
      "Labour Cost",
      "External Bills",
      "Downtime Minutes",
      "Downtime Cost",
      "Total Maintenance Financials",
    ];

    const rows = filtered.map((r) => [
      `"${r.machineName}"`,
      `"${r.category || ""}"`,
      r.workOrderCount,
      r.partsCost,
      r.labourCost,
      r.externalExpenses,
      r.downtimeMinutes,
      r.downtimeCost,
      r.totalMaintenanceCost,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `machine_maintenance_costs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 p-6">
      <FinanceNavHeader
        title="Machine & Maintenance Cost Centers"
        subtitle="Financial impact of plant maintenance: spare parts consumed, technician labour hours, outside contractor services & downtime loss per machine."
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
          <div className="text-xs font-semibold text-muted-foreground">Total Plant Maintenance Spend</div>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {formatMoney(totals.grandTotal)}
          </div>
          <div className="text-[11px] text-muted-foreground">{filtered.length} Machines tracked</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">Spare Parts Consumed</div>
          <div className="text-2xl font-bold tracking-tight text-orange-600 dark:text-orange-400">
            {formatMoney(totals.totalParts)}
          </div>
          <div className="text-[11px] text-muted-foreground">Components & MRO issued</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">Maintenance Labour Cost</div>
          <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {formatMoney(totals.totalLabour)}
          </div>
          <div className="text-[11px] text-muted-foreground">Technician work order hours</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">Downtime Financial Penalty</div>
          <div className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-400">
            {formatMoney(totals.totalDowntimeCost)}
          </div>
          <div className="text-[11px] text-muted-foreground">Lost line capacity due to breakdowns</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search machinery name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Machinery Categories</option>
            {uniqueCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Machine Cost Table */}
      <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-3.5">Machine / Asset</th>
                <th className="py-3 px-3.5">Category</th>
                <th className="py-3 px-3.5 text-center">Work Orders</th>
                <th className="py-3 px-3.5 text-right">Parts Cost</th>
                <th className="py-3 px-3.5 text-right">Labour Cost</th>
                <th className="py-3 px-3.5 text-right">Outside Bills</th>
                <th className="py-3 px-3.5 text-right">Downtime Loss</th>
                <th className="py-3 px-3.5 text-right">Total Financial Impact</th>
                <th className="py-3 px-3.5 w-36">Plant Cost Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No machine cost records found matching your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const pct = totals.grandTotal > 0 ? Math.round((r.totalMaintenanceCost / totals.grandTotal) * 100) : 0;
                  return (
                    <tr key={r.machineId} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3.5 font-bold text-foreground">
                        <Link to={`/machines/${r.machineId}`} className="hover:underline flex items-center gap-1.5">
                          <span>{r.machineName}</span>
                          <ArrowUpRight className="h-3 w-3 opacity-50" />
                        </Link>
                      </td>
                      <td className="py-3 px-3.5 text-muted-foreground capitalize">
                        {r.category}
                      </td>
                      <td className="py-3 px-3.5 text-center font-semibold text-foreground">
                        {r.workOrderCount}
                      </td>
                      <td className="py-3 px-3.5 text-right text-muted-foreground">
                        {formatMoney(r.partsCost)}
                      </td>
                      <td className="py-3 px-3.5 text-right text-muted-foreground">
                        {formatMoney(r.labourCost)}
                      </td>
                      <td className="py-3 px-3.5 text-right text-muted-foreground">
                        {formatMoney(r.externalExpenses)}
                      </td>
                      <td className="py-3 px-3.5 text-right text-muted-foreground">
                        {r.downtimeCost > 0 ? (
                          <span className="text-red-500 font-semibold">{formatMoney(r.downtimeCost)}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-bold text-foreground">
                        {formatMoney(r.totalMaintenanceCost)}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct > 25 ? "bg-red-500" : pct > 15 ? "bg-amber-500" : "bg-primary"}`}
                              style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
