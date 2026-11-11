import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney, formatNumber } from "@/lib/format";
import { FinanceNavHeader } from "./FinanceNavHeader";
import {
  getVehicleProfitability,
  type VehicleProfitability,
} from "@/services/financeService";
import {
  TrendingUp,
  TrendingDown,
  Truck,
  Search,
  Filter,
  DollarSign,
  Gauge,
  ArrowUpRight,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";

export default function FinanceVehicleProfitability() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<VehicleProfitability[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  const loadData = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const data = await getVehicleProfitability(organisation.id);
      setVehicles(data);
    } catch (err) {
      console.error("Failed to load vehicle profitability:", err);
      toast.error("Failed to calculate vehicle unit economics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  // Overall KPIs
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalKm = 0;

    vehicles.forEach((v) => {
      totalRevenue += v.revenue;
      totalCost += v.totalCost;
      totalKm += v.kmDriven;
    });

    const netProfit = totalRevenue - totalCost;
    const avgMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
    const fleetCpk = totalKm > 0 ? Math.round(totalCost / totalKm) : 0;
    const fleetRpk = totalKm > 0 ? Math.round(totalRevenue / totalKm) : 0;

    return {
      totalRevenue,
      totalCost,
      netProfit,
      avgMargin,
      fleetCpk,
      fleetRpk,
      count: vehicles.length,
    };
  }, [vehicles]);

  const filtered = useMemo(() => {
    return vehicles.filter((v) => {
      if (filterType === "profitable" && v.netProfit <= 0) return false;
      if (filterType === "loss" && v.netProfit >= 0) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchPlate = v.plateNumber.toLowerCase().includes(q);
        const matchName = v.machineName.toLowerCase().includes(q);
        if (!matchPlate && !matchName) return false;
      }
      return true;
    });
  }, [vehicles, filterType, search]);

  const handleExportCSV = () => {
    if (!filtered.length) {
      toast.info("No records to export.");
      return;
    }

    const headers = [
      "Plate Number",
      "Model",
      "Revenue (TZS)",
      "Fuel Cost (TZS)",
      "Maintenance (TZS)",
      "Trip Expenses (TZS)",
      "Total Cost (TZS)",
      "Net Profit (TZS)",
      "Margin %",
      "KM Driven",
      "Cost/KM (CPK)",
      "Rev/KM (RPK)",
    ];

    const rows = filtered.map((v) => [
      `"${v.plateNumber}"`,
      `"${v.machineName.replace(/"/g, '""')}"`,
      v.revenue,
      v.fuelCost,
      v.maintenanceCost,
      v.tripExpenses,
      v.totalCost,
      v.netProfit,
      `${v.marginPct}%`,
      v.kmDriven,
      v.costPerKm,
      v.revenuePerKm,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `vehicle_profitability_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Vehicle profitability exported to CSV");
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 p-6">
      <FinanceNavHeader
        title="Vehicle Profitability & Unit Economics"
        subtitle="Individual vehicle P&L analysis, operational cost attribution, and Cost-Per-Kilometer (CPK) metrics."
        actions={
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4" />
            Export Unit Economics CSV
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Fleet Net Profit</span>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-primary">
            {formatMoney(metrics.netProfit)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Across {metrics.count} tracked vehicles
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Fleet Operating Margin</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
            {metrics.avgMargin}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Average return on freight operations
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Fleet Avg Cost / KM (CPK)</span>
            <Gauge className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600">
            {formatMoney(metrics.fleetCpk)} <span className="text-xs font-normal text-muted-foreground">/ km</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Blended fuel, repair & operating cost per km
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Fleet Avg Rev / KM (RPK)</span>
            <ArrowUpRight className="h-4 w-4 text-teal-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-teal-600">
            {formatMoney(metrics.fleetRpk)} <span className="text-xs font-normal text-muted-foreground">/ km</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Gross freight earnings per kilometer
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vehicle plate number or model..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Profitability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vehicles</SelectItem>
              <SelectItem value="profitable">Profitable Only</SelectItem>
              <SelectItem value="loss">High Operating Cost / Loss</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs font-medium text-muted-foreground">
          Showing {filtered.length} of {vehicles.length} vehicles
        </div>
      </div>

      {/* Vehicle Profitability Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Truck className="h-6 w-6 text-muted-foreground" />}
          title="No vehicles found"
          description="Register vehicles in your fleet and log trips or fuel to calculate per-vehicle profit."
          action={
            <Button size="sm" asChild>
              <Link to="/fleet/vehicles">
                <Truck className="h-4 w-4 mr-1.5" />
                Go to Fleet Vehicles
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 font-semibold">Vehicle</th>
                  <th className="py-3 px-4 font-semibold text-right">Revenue</th>
                  <th className="py-3 px-4 font-semibold text-right">Fuel Spend</th>
                  <th className="py-3 px-4 font-semibold text-right">Maintenance</th>
                  <th className="py-3 px-4 font-semibold text-right">Trip Costs</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Cost</th>
                  <th className="py-3 px-4 font-semibold text-right">Net Profit</th>
                  <th className="py-3 px-4 font-semibold text-right">Margin %</th>
                  <th className="py-3 px-4 font-semibold text-right">KM</th>
                  <th className="py-3 px-4 font-semibold text-right">CPK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((v) => {
                  const isProfitable = v.netProfit >= 0;
                  return (
                    <tr key={v.machineId} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/machines/${v.machineId}`}
                          className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                          <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{v.plateNumber}</span>
                        </Link>
                        <div className="text-xs text-muted-foreground">{v.machineName}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-emerald-600 whitespace-nowrap">
                        {formatMoney(v.revenue)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatMoney(v.fuelCost)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatMoney(v.maintenanceCost)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatMoney(v.tripExpenses)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-rose-600 whitespace-nowrap">
                        {formatMoney(v.totalCost)}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-bold whitespace-nowrap ${
                          isProfitable ? "text-primary" : "text-rose-600"
                        }`}
                      >
                        {formatMoney(v.netProfit)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            isProfitable
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-rose-500/10 text-rose-600"
                          }`}
                        >
                          {v.marginPct}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatNumber(v.kmDriven)} km
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-bold bg-muted text-foreground border border-border">
                          {formatMoney(v.costPerKm)}/km
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
