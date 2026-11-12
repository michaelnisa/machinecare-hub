import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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
import { formatMoney, formatDate, formatNumber } from "@/lib/format";
import { parseCargoMeta, extractCleanCargo } from "@/lib/fleet-metadata";
import { FinanceNavHeader } from "./FinanceNavHeader";
import {
  Route,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Truck,
  ArrowUpRight,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

interface TripFinancialRecord {
  id: string;
  origin: string;
  destination: string;
  cargo: string;
  startDate: string;
  vehiclePlate: string;
  vehicleName: string;
  status: string;
  revenue: number;
  fuelCost: number;
  expenses: number;
  totalCost: number;
  netMargin: number;
  marginPct: number;
  kmDriven: number;
  isInvoiced: boolean;
}

export default function FinanceTrips() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<TripFinancialRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadData = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const [
        { data: trips },
        { data: tripExps },
        { data: invoices },
      ] = await Promise.all([
        (supabase as any)
          .from("trips")
          .select(`
            id,
            origin,
            destination,
            purpose,
            cargo_description,
            start_at,
            status,
            cost,
            start_odo,
            end_odo,
            fuel_used_l,
            machine_id,
            machines:machines(id, name, plate_number)
          `)
          .eq("organisation_id", organisation.id)
          .order("start_at", { ascending: false }),

        (supabase as any)
          .from("trip_expenses")
          .select("trip_id, amount, expense_type")
          .eq("organisation_id", organisation.id),

        (supabase as any)
          .from("finance_invoices")
          .select("trip_id, total_amount, paid_amount")
          .eq("organisation_id", organisation.id)
          .not("trip_id", "is", null),
      ]);

      // Map trip expenses
      const expenseMap = new Map<string, number>();
      (tripExps || []).forEach((e: any) => {
        if (e.trip_id) {
          expenseMap.set(e.trip_id, (expenseMap.get(e.trip_id) || 0) + Number(e.amount || 0));
        }
      });

      // Map invoice revenues linked to trips
      const invoiceRevMap = new Map<string, number>();
      const invoicedTripSet = new Set<string>();
      (invoices || []).forEach((inv: any) => {
        if (inv.trip_id) {
          invoicedTripSet.add(inv.trip_id);
          invoiceRevMap.set(inv.trip_id, (invoiceRevMap.get(inv.trip_id) || 0) + Number(inv.total_amount || 0));
        }
      });

      const parsed: TripFinancialRecord[] = (trips || []).map((t: any) => {
        const directCost = Number(t.cost || 0);
        const subExpenses = expenseMap.get(t.id) || 0;
        const totalExpenses = directCost + subExpenses;

        const meta = parseCargoMeta(t.cargo_description);
        const cargoText = extractCleanCargo(t.cargo_description, t.purpose || meta?.purpose);

        // Revenue: from linked customer invoice, or contracted corridor price, or fallback multiplier
        let revenue = invoiceRevMap.get(t.id) || 0;
        if (!revenue && meta?.client_billing_amount) {
          const rate = Number(meta.exchange_rate) || 2600;
          const isUsd = (meta.billing_currency || meta.currency || "").toUpperCase() === "USD";
          revenue = isUsd ? Math.round(Number(meta.client_billing_amount) * rate) : Number(meta.client_billing_amount);
        }
        if (!revenue && directCost > 0) {
          revenue = Math.round(directCost * 1.35);
        }

        const km = (t.end_odo && t.start_odo && t.end_odo > t.start_odo) ? (t.end_odo - t.start_odo) : 0;
        const fuelL = Number(t.fuel_used_l || 0);
        const estFuelCost = fuelL > 0 ? fuelL * 3100 : directCost * 0.6;
        const otherExps = Math.max(totalExpenses - estFuelCost, 0);

        const netMargin = revenue - totalExpenses;
        const marginPct = revenue > 0 ? Math.round((netMargin / revenue) * 100) : 0;

        return {
          id: t.id,
          origin: t.origin || "Origin",
          destination: t.destination || "Destination",
          cargo: cargoText,
          startDate: t.start_at || new Date().toISOString(),
          vehiclePlate: t.machines?.plate_number || t.machines?.name || "Fleet Vehicle",
          vehicleName: t.machines?.name || "Vehicle",
          status: t.status || "completed",
          revenue,
          fuelCost: Math.round(estFuelCost),
          expenses: Math.round(otherExps),
          totalCost: totalExpenses,
          netMargin,
          marginPct,
          kmDriven: km,
          isInvoiced: invoicedTripSet.has(t.id),
        };
      });

      setRecords(parsed);
    } catch (err) {
      console.error("Failed to load trip financials:", err);
      toast.error("Failed to load trip financials");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let netProfit = 0;
    let unbilledCount = 0;

    records.forEach((r) => {
      totalRevenue += r.revenue;
      totalCost += r.totalCost;
      netProfit += r.netMargin;
      if (!r.isInvoiced) unbilledCount++;
    });

    const avgMarginPct = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

    return { totalRevenue, totalCost, netProfit, avgMarginPct, count: records.length, unbilledCount };
  }, [records]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (statusFilter === "unbilled" && r.isInvoiced) return false;
      if (statusFilter === "invoiced" && !r.isInvoiced) return false;
      if (
        statusFilter !== "all" &&
        statusFilter !== "unbilled" &&
        statusFilter !== "invoiced" &&
        r.status !== statusFilter
      ) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchRoute = `${r.origin} ${r.destination}`.toLowerCase().includes(q);
        const matchPlate = r.vehiclePlate.toLowerCase().includes(q);
        const matchCargo = r.cargo.toLowerCase().includes(q);
        if (!matchRoute && !matchPlate && !matchCargo) return false;
      }
      return true;
    });
  }, [records, statusFilter, search]);

  const handleExportCSV = () => {
    if (!filtered.length) {
      toast.info("No records to export.");
      return;
    }

    const headers = ["Date", "Route", "Vehicle", "Cargo", "Revenue (TZS)", "Total Cost (TZS)", "Net Margin (TZS)", "Margin %", "Status"];
    const rows = filtered.map((r) => [
      r.startDate.slice(0, 10),
      `"${r.origin} -> ${r.destination}"`,
      `"${r.vehiclePlate}"`,
      `"${r.cargo.replace(/"/g, '""')}"`,
      r.revenue,
      r.totalCost,
      r.netMargin,
      `${r.marginPct}%`,
      r.status,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `trip_profitability_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Trip profitability exported to CSV");
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 p-6">
      <FinanceNavHeader
        title="Trip Revenue & Profitability"
        subtitle="Freight contract earnings, en-route disbursements, driver per diems, and trip operating margins."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4" />
              Export CSV
            </Button>
            <Button size="sm" asChild className="gap-1.5">
              <Link to="/fleet/trips">
                <Route className="h-4 w-4" />
                Manage Trips
              </Link>
            </Button>
          </>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Freight Revenue</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
            {formatMoney(metrics.totalRevenue)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Across {metrics.count} commercial dispatches
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Trip Operating Costs</span>
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600">
            {formatMoney(metrics.totalCost)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Fuel, road tolls, driver allowances & border fees
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Net Freight Margin</span>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-primary">
            {formatMoney(metrics.netProfit)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Gross freight operating profit
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Average Margin %</span>
            <ArrowUpRight className="h-4 w-4 text-teal-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-teal-600">
            {metrics.avgMarginPct}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.unbilledCount > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {metrics.unbilledCount} pending commercial invoice
              </span>
            ) : (
              "All trips invoiced & accounted"
            )}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by route, vehicle, cargo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Trip Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trips</SelectItem>
              <SelectItem value="unbilled">Pending Invoice (Unbilled)</SelectItem>
              <SelectItem value="invoiced">Invoiced Trips</SelectItem>
              <SelectItem value="completed">Status: Completed</SelectItem>
              <SelectItem value="in_transit">Status: In Transit</SelectItem>
              <SelectItem value="planned">Status: Planned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs font-medium text-muted-foreground">
          Showing {filtered.length} of {records.length} trips
        </div>
      </div>

      {/* Trips Profitability Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Route className="h-6 w-6 text-muted-foreground" />}
          title="No trip records found"
          description={
            search || statusFilter !== "all"
              ? "Try adjusting your filters or search keywords."
              : "No freight trips have been dispatched yet. Dispatch trips to analyze voyage margins."
          }
          action={
            <Button size="sm" asChild>
              <Link to="/fleet/trips">
                <Route className="h-4 w-4 mr-1.5" />
                Go to Trips Manager
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
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Transit Route</th>
                  <th className="py-3 px-4 font-semibold">Vehicle</th>
                  <th className="py-3 px-4 font-semibold text-right">Freight Revenue</th>
                  <th className="py-3 px-4 font-semibold text-right">Est Fuel</th>
                  <th className="py-3 px-4 font-semibold text-right">Disbursements</th>
                  <th className="py-3 px-4 font-semibold text-right">Net Margin</th>
                  <th className="py-3 px-4 font-semibold text-right">Margin %</th>
                  <th className="py-3 px-4 font-semibold text-center">Billing</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => {
                  const isProfitable = r.netMargin >= 0;
                  return (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {formatDate(r.startDate)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <span>{r.origin}</span>
                          <span className="text-muted-foreground">→</span>
                          <span>{r.destination}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{r.cargo}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-foreground border border-border">
                          <Truck className="h-3 w-3 text-muted-foreground" />
                          {r.vehiclePlate}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-emerald-600 whitespace-nowrap">
                        {formatMoney(r.revenue)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatMoney(r.fuelCost)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatMoney(r.expenses)}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-bold whitespace-nowrap ${
                          isProfitable ? "text-primary" : "text-rose-600"
                        }`}
                      >
                        {formatMoney(r.netMargin)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            isProfitable
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-rose-500/10 text-rose-600"
                          }`}
                        >
                          {r.marginPct}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {r.isInvoiced ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            Invoiced
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            <Clock className="h-3 w-3" />
                            Unbilled
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                          {r.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {!r.isInvoiced ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2 gap-1 font-medium border-primary/30 text-primary hover:bg-primary/10"
                              asChild
                            >
                              <Link to={`/finance/invoices?tripId=${r.id}`}>
                                <FileText className="h-3 w-3" />
                                Bill Trip
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
                              asChild
                            >
                              <Link to="/finance/invoices">
                                <FileText className="h-3 w-3" />
                                View Invoice
                              </Link>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
                            asChild
                          >
                            <Link to="/fleet/trips">
                              <Route className="h-3 w-3" />
                              Waybill
                            </Link>
                          </Button>
                        </div>
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
