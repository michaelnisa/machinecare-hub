import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { formatMoney, formatDate } from "@/lib/format";
import { FinanceNavHeader } from "./FinanceNavHeader";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  CreditCard,
  Building2,
  FileText,
  Fuel,
  Wrench,
  Truck,
  Activity,
} from "lucide-react";
import { toast } from "sonner";

interface CashMovement {
  id: string;
  date: string;
  type: "inflow" | "outflow";
  category: string;
  description: string;
  counterparty: string;
  amount: number;
  paymentMethod: string;
}

export default function FinanceCashFlow() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState<CashMovement[]>([]);

  const loadData = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      // Query organization machines first to scope fuel_logs (fuel_logs links via machine_id)
      const { data: orgMachines } = await (supabase as any)
        .from("machines")
        .select("id")
        .eq("organisation_id", organisation.id);
      const machineIds = (orgMachines || []).map((m: any) => m.id);

      const fuelPromise = machineIds.length === 0
        ? Promise.resolve({ data: [] })
        : (supabase as any)
            .from("fuel_logs")
            .select("id, fuel_cost, station, recorded_at, machine_id")
            .in("machine_id", machineIds)
            .gt("fuel_cost", 0);

      const [
        { data: invoices },
        { data: receipts },
        { data: fuelLogs },
        { data: tripExps },
        { data: bills },
      ] = await Promise.all([
        (supabase as any)
          .from("finance_invoices")
          .select("id, invoice_number, client_name, paid_amount, payment_method, paid_at, issued_at")
          .eq("organisation_id", organisation.id)
          .gt("paid_amount", 0),

        (supabase as any)
          .from("accountant_receipts")
          .select("id, receipt_number, title, category, payee_name, amount, payment_method, payment_date")
          .eq("organisation_id", organisation.id),

        fuelPromise,

        (supabase as any)
          .from("trip_expenses")
          .select("id, expense_type, amount, occurred_at")
          .eq("organisation_id", organisation.id)
          .gt("amount", 0),

        (supabase as any)
          .from("finance_supplier_bills")
          .select("id, bill_number, supplier_name, category, paid_amount, payment_method, updated_at, bill_date")
          .eq("organisation_id", organisation.id)
          .gt("paid_amount", 0),
      ]);

      const list: CashMovement[] = [];

      // 1. Inflows: Customer Invoices Paid
      (invoices || []).forEach((inv: any) => {
        list.push({
          id: `in-${inv.id}`,
          date: inv.paid_at || inv.issued_at || new Date().toISOString(),
          type: "inflow",
          category: "Freight Revenue",
          description: `Customer Invoice Payment #${inv.invoice_number}`,
          counterparty: inv.client_name,
          amount: Number(inv.paid_amount || 0),
          paymentMethod: inv.payment_method || "bank_transfer",
        });
      });

      // 2. Outflows: Accountant receipts (parts, maintenance)
      (receipts || []).forEach((r: any) => {
        list.push({
          id: `out-rec-${r.id}`,
          date: r.payment_date || new Date().toISOString(),
          type: "outflow",
          category: r.category || "Maintenance",
          description: r.title || `Voucher #${r.receipt_number}`,
          counterparty: r.payee_name || "Vendor",
          amount: Number(r.amount || 0),
          paymentMethod: r.payment_method || "cash",
        });
      });

      // 3. Outflows: Fuel purchases
      (fuelLogs || []).forEach((f: any) => {
        list.push({
          id: `out-fuel-${f.id}`,
          date: f.recorded_at || new Date().toISOString(),
          type: "outflow",
          category: "Fuel & Lubricants",
          description: `Fuel purchase at ${f.station || "Station"}`,
          counterparty: f.station || "Fuel Supplier",
          amount: Number(f.fuel_cost || 0),
          paymentMethod: "station_account",
        });
      });

      // 4. Outflows: Trip & driver expenses
      (tripExps || []).forEach((t: any) => {
        list.push({
          id: `out-trip-${t.id}`,
          date: t.occurred_at || new Date().toISOString(),
          type: "outflow",
          category: "Trip & Transit",
          description: `Trip disbursement: ${t.expense_type}`,
          counterparty: "Driver / Transit Toll",
          amount: Number(t.amount || 0),
          paymentMethod: "cash",
        });
      });

      // 5. Outflows: Paid supplier bills
      (bills || []).forEach((b: any) => {
        list.push({
          id: `out-bill-${b.id}`,
          date: b.updated_at || b.bill_date || new Date().toISOString(),
          type: "outflow",
          category: b.category || "Supplier Bill",
          description: `Bill settlement #${b.bill_number}`,
          counterparty: b.supplier_name,
          amount: Number(b.paid_amount || 0),
          paymentMethod: b.payment_method || "bank_transfer",
        });
      });

      // Sort newest first
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setMovements(list);
    } catch (err) {
      console.error("Failed to load cash flow movements:", err);
      toast.error("Failed to load cash flow records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  const metrics = useMemo(() => {
    let totalInflow = 0;
    let totalOutflow = 0;

    movements.forEach((m) => {
      if (m.type === "inflow") totalInflow += m.amount;
      else totalOutflow += m.amount;
    });

    const netCashFlow = totalInflow - totalOutflow;
    const isPositive = netCashFlow >= 0;

    return { totalInflow, totalOutflow, netCashFlow, isPositive };
  }, [movements]);

  // Monthly Cash Flow buckets (last 6 months)
  const monthlyFlow = useMemo(() => {
    const map = new Map<string, { inflow: number; outflow: number }>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mKey = d.toLocaleString("default", { month: "short", year: "2-digit" });
      map.set(mKey, { inflow: 0, outflow: 0 });
    }

    movements.forEach((m) => {
      const d = new Date(m.date);
      const mKey = d.toLocaleString("default", { month: "short", year: "2-digit" });
      if (map.has(mKey)) {
        const entry = map.get(mKey)!;
        if (m.type === "inflow") entry.inflow += m.amount;
        else entry.outflow += m.amount;
      }
    });

    return Array.from(map.entries()).map(([month, data]) => ({
      month,
      inflow: Math.round(data.inflow),
      outflow: Math.round(data.outflow),
      net: Math.round(data.inflow - data.outflow),
    }));
  }, [movements]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 p-6">
      <FinanceNavHeader
        title="Cash Flow Statement & Inflows/Outflows"
        subtitle="Real-time operating liquidity tracking cash collected from clients versus cash paid out to vendors & drivers."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/finance/expenses">
                <ArrowDownRight className="h-4 w-4 mr-1.5 text-rose-500" />
                Record Outflow
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/finance/invoices">
                <ArrowUpRight className="h-4 w-4 mr-1.5 text-emerald-500" />
                Collect Inflow
              </Link>
            </Button>
          </div>
        }
      />

      {/* Primary Cash Flow KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Cash Inflow</span>
            <ArrowUpRight className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
            +{formatMoney(metrics.totalInflow)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Cleared customer freight payments
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Cash Outflow</span>
            <ArrowDownRight className="h-5 w-5 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600">
            -{formatMoney(metrics.totalOutflow)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Fuel, maintenance & vendor disbursements
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Net Operating Cash Flow</span>
            <Wallet className={`h-5 w-5 ${metrics.isPositive ? "text-primary" : "text-rose-500"}`} />
          </div>
          <p
            className={`mt-2 text-2xl font-bold tracking-tight ${
              metrics.isPositive ? "text-primary" : "text-rose-600"
            }`}
          >
            {metrics.isPositive ? "+" : ""}
            {formatMoney(metrics.netCashFlow)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.isPositive ? "Operating cash surplus" : "Operating cash burn"}
          </p>
        </div>
      </div>

      {/* Monthly Inflow vs Outflow Visualizer */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">6-Month Cash Inflow vs Outflow Trajectory</h3>
          </div>
          <span className="text-xs text-muted-foreground font-medium">Monthly cleared velocity</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {monthlyFlow.map((m, idx) => {
            const hasData = m.inflow > 0 || m.outflow > 0;
            const maxVal = Math.max(m.inflow, m.outflow, 1);
            const inPct = Math.round((m.inflow / maxVal) * 100);
            const outPct = Math.round((m.outflow / maxVal) * 100);
            const isPos = m.net >= 0;

            return (
              <div
                key={idx}
                className="p-3 rounded-lg border border-border/60 bg-muted/20 flex flex-col justify-between space-y-3"
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-foreground">{m.month}</span>
                  <span className={`text-[10px] font-semibold ${isPos ? "text-emerald-600" : "text-rose-600"}`}>
                    {isPos ? "+" : ""}{formatMoney(m.net)}
                  </span>
                </div>

                {hasData ? (
                  <div className="space-y-1.5">
                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                        <span className="text-emerald-600 font-medium">In</span>
                        <span>{formatMoney(m.inflow)}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${inPct}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                        <span className="text-rose-600 font-medium">Out</span>
                        <span>{formatMoney(m.outflow)}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full" style={{ width: `${outPct}%` }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-10 flex items-center justify-center text-[11px] text-muted-foreground italic">
                    No transactions
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Cash Movement Register */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Operating Cash Movements Register</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {movements.length} cash events recorded
          </span>
        </div>

        {movements.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-6 w-6 text-muted-foreground" />}
            title="No cash movements recorded"
            description="Collect customer invoices or record operational expense vouchers to build your real-time cash flow."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold">Description</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Party / Entity</th>
                  <th className="py-3 px-4 font-semibold">Method</th>
                  <th className="py-3 px-4 font-semibold text-right">Cash Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movements.slice(0, 50).map((m) => {
                  const isInflow = m.type === "inflow";
                  return (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {formatDate(m.date)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isInflow
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                          }`}
                        >
                          {isInflow ? (
                            <>
                              <ArrowUpRight className="h-3 w-3" /> INFLOW
                            </>
                          ) : (
                            <>
                              <ArrowDownRight className="h-3 w-3" /> OUTFLOW
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        {m.description}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                        {m.category}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-foreground whitespace-nowrap">
                        {m.counterparty}
                      </td>
                      <td className="py-3 px-4 text-xs uppercase text-muted-foreground whitespace-nowrap">
                        {m.paymentMethod.replace(/_/g, " ")}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                          isInflow ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {isInflow ? "+" : "-"}
                        {formatMoney(m.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
