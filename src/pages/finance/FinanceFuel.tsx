import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { formatMoney, formatNumber } from "@/lib/format";
import { FinanceNavHeader } from "./FinanceNavHeader";
import {
  getFuelFinanceStats,
  type FuelFinanceStats,
} from "@/services/financeService";
import {
  Fuel,
  Gauge,
  TrendingDown,
  Building2,
  Truck,
  Plus,
  FileSpreadsheet,
  ArrowRight,
  Droplet,
} from "lucide-react";
import { toast } from "sonner";

export default function FinanceFuel() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<FuelFinanceStats | null>(null);

  const loadData = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const data = await getFuelFinanceStats(organisation.id);
      setStats(data);
    } catch (err) {
      console.error("Failed to load fuel finance:", err);
      toast.error("Failed to load fuel finance statistics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  const handleExportCSV = () => {
    if (!stats || !stats.byVehicle.length) {
      toast.info("No fuel data to export.");
      return;
    }

    const headers = ["Plate Number", "Vehicle Model", "Total Spend (TZS)", "Total Litres", "KM Driven", "Cost / KM (TZS)"];
    const rows = stats.byVehicle.map((v) => [
      `"${v.plate}"`,
      `"${v.machineName.replace(/"/g, '""')}"`,
      v.spend,
      v.litres,
      v.km,
      v.cpk,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `fuel_finance_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Fuel report exported to CSV");
  };

  if (loading) return <PageLoader />;

  const s = stats || {
    totalSpend: 0,
    totalLitres: 0,
    avgCostPerLitre: 0,
    totalKm: 0,
    avgCostPerKm: 0,
    byStation: [],
    byVehicle: [],
  };

  return (
    <div className="space-y-6 p-6">
      <FinanceNavHeader
        title="Fuel Finance & Consumption Audit"
        subtitle="Fuel procurement budgets, pump prices, station ledger, and Cost-Per-Kilometer efficiency."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4" />
              Export Audit CSV
            </Button>
            <Button size="sm" asChild className="gap-1.5">
              <Link to="/fuel">
                <Plus className="h-4 w-4" />
                Record Fuel Fill-up
              </Link>
            </Button>
          </>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Fuel Spend</span>
            <Fuel className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600">
            {formatMoney(s.totalSpend)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Across {s.byVehicle.length} operational fleet units
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Volume</span>
            <Droplet className="h-4 w-4 text-sky-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-sky-600">
            {formatNumber(s.totalLitres)} <span className="text-sm font-normal text-muted-foreground">Litres</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Diesel & petrol volume dispensed
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Avg Cost / Litre</span>
            <TrendingDown className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-indigo-600">
            {formatMoney(s.avgCostPerLitre)} <span className="text-xs font-normal text-muted-foreground">/ L</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Average pump procurement price
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Fuel Cost / KM</span>
            <Gauge className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
            {formatMoney(s.avgCostPerKm)} <span className="text-xs font-normal text-muted-foreground">/ KM</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Fleet fuel burn efficiency metric
          </p>
        </div>
      </div>

      {/* Two Column Layout: Station Vendor Distribution & Vehicle Efficiency Table */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Station Spend Breakdown */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Station & Vendor Share</h3>
            </div>
            <span className="text-xs text-muted-foreground">
              {s.byStation.length} stations
            </span>
          </div>

          {s.byStation.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No fuel purchase station logs recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {s.byStation.map((station, idx) => {
                const pct = s.totalSpend > 0 ? Math.round((station.spend / s.totalSpend) * 100) : 0;
                return (
                  <div key={idx} className="space-y-1.5 p-2.5 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{station.station}</span>
                      <span className="font-bold text-amber-600">{formatMoney(station.spend)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{formatNumber(station.litres)} Litres</span>
                      <span>{pct}% share</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Fuel Economics by Vehicle (2 columns wide) */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Vehicle Fuel Economics & CPK</h3>
            </div>
            <Link
              to="/fuel"
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
            >
              Open Fuel Logs <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {s.byVehicle.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No fleet vehicles linked to fuel logs.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Plate / Vehicle</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Fuel Spend</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Litres</th>
                    <th className="py-2.5 px-3 font-semibold text-right">KM Driven</th>
                    <th className="py-2.5 px-3 font-semibold text-right">TZS / KM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {s.byVehicle.map((v, i) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-medium text-foreground">{v.plate}</div>
                        <div className="text-xs text-muted-foreground">{v.machineName}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-amber-600 whitespace-nowrap">
                        {formatMoney(v.spend)}
                      </td>
                      <td className="py-3 px-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatNumber(v.litres)} L
                      </td>
                      <td className="py-3 px-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatNumber(v.km)} km
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-bold bg-muted text-foreground border border-border">
                          {formatMoney(v.cpk)} / km
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
