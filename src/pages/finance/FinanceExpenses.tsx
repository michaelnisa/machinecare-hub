import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney, formatDate } from "@/lib/format";
import { FinanceNavHeader } from "./FinanceNavHeader";
import { toast } from "sonner";
import {
  Receipt,
  Search,
  Plus,
  Filter,
  DollarSign,
  Fuel,
  Wrench,
  Truck,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { createAccountantReceipt, type ReceiptType } from "@/services/accountantService";

export default function FinanceExpenses() {
  const { organisation, user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string; plate_number: string | null }[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [machineFilter, setMachineFilter] = useState("all");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Expense form state
  const [formData, setFormData] = useState({
    title: "",
    category: "maintenance_service",
    payee_name: "",
    amount: "",
    machine_id: "none",
    payment_method: "cash",
    payment_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const loadData = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      // 1. Load accountant receipts (maintenance, parts, services)
      const { data: receipts } = await (supabase as any)
        .from("accountant_receipts")
        .select(`
          id,
          receipt_number,
          receipt_type,
          title,
          category,
          payee_name,
          amount,
          currency,
          payment_method,
          payment_date,
          status,
          notes,
          machine_id,
          machines:machines(id, name, plate_number)
        `)
        .eq("organisation_id", organisation.id)
        .order("payment_date", { ascending: false });

      // 2. Load trip expenses
      const { data: tripExps } = await (supabase as any)
        .from("trip_expenses")
        .select(`
          id,
          trip_id,
          expense_type,
          amount,
          currency,
          occurred_at,
          notes,
          machine_id,
          trips:trips(id, origin, destination),
          machines:machines(id, name, plate_number)
        `)
        .eq("organisation_id", organisation.id)
        .order("occurred_at", { ascending: false });

      // 3. Load fuel logs as fuel expenses
      const { data: fuelLogs } = await (supabase as any)
        .from("fuel_logs")
        .select(`
          id,
          recorded_at,
          fuel_cost,
          fuel_litres,
          station,
          notes,
          machine_id,
          machines:machines(id, name, plate_number)
        `)
        .eq("organisation_id", organisation.id)
        .order("recorded_at", { ascending: false });

      // 4. Load machines list for dropdown
      const { data: machs } = await (supabase as any)
        .from("machines")
        .select("id, name, plate_number")
        .eq("organisation_id", organisation.id)
        .order("name");

      setMachines(machs || []);

      // Unify into a single expense timeline
      const unified: any[] = [];

      (receipts || []).forEach((r: any) => {
        unified.push({
          id: `rec-${r.id}`,
          rawId: r.id,
          voucherNumber: r.receipt_number || "REC-VOUCHER",
          title: r.title,
          category: r.category || r.receipt_type,
          payee: r.payee_name || "Vendor",
          amount: Number(r.amount || 0),
          currency: r.currency || "TZS",
          paymentMethod: r.payment_method || "cash",
          date: r.payment_date || new Date().toISOString(),
          machineId: r.machine_id,
          machineName: r.machines?.plate_number || r.machines?.name || "General Fleet",
          source: "accountant_receipts",
          status: r.status || "paid",
        });
      });

      (tripExps || []).forEach((t: any) => {
        unified.push({
          id: `trip-${t.id}`,
          rawId: t.id,
          voucherNumber: `TRIP-EXP-${t.id.slice(0, 6).toUpperCase()}`,
          title: `Trip Expense: ${t.expense_type?.toUpperCase() || "General"}`,
          category: "trip_expense",
          payee: t.trips ? `${t.trips.origin} → ${t.trips.destination}` : "Driver / En-Route",
          amount: Number(t.amount || 0),
          currency: t.currency || "TZS",
          paymentMethod: "cash",
          date: t.occurred_at || new Date().toISOString(),
          machineId: t.machine_id,
          machineName: t.machines?.plate_number || t.machines?.name || "Trip Asset",
          source: "trip_expenses",
          status: "paid",
        });
      });

      (fuelLogs || []).forEach((f: any) => {
        unified.push({
          id: `fuel-${f.id}`,
          rawId: f.id,
          voucherNumber: `FUEL-${f.id.slice(0, 6).toUpperCase()}`,
          title: `Fuel Purchase: ${Number(f.fuel_litres || 0).toLocaleString()}L`,
          category: "fuel",
          payee: f.station || "Fuel Station",
          amount: Number(f.fuel_cost || 0),
          currency: "TZS",
          paymentMethod: "station_account",
          date: f.recorded_at || new Date().toISOString(),
          machineId: f.machine_id,
          machineName: f.machines?.plate_number || f.machines?.name || "Fleet Vehicle",
          source: "fuel_logs",
          status: "paid",
        });
      });

      // Sort newest first
      unified.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(unified);
    } catch (err) {
      console.error("Failed to load expenses:", err);
      toast.error("Failed to load expenses list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  // KPI Calculations
  const metrics = useMemo(() => {
    let total = 0;
    let fuelTotal = 0;
    let maintenanceTotal = 0;
    let tripTotal = 0;
    let otherTotal = 0;

    expenses.forEach((e) => {
      total += e.amount;
      if (e.category === "fuel") fuelTotal += e.amount;
      else if (
        e.category === "maintenance_service" ||
        e.category === "spare_part" ||
        e.category.includes("maintenance") ||
        e.category.includes("spare")
      ) {
        maintenanceTotal += e.amount;
      } else if (e.category === "trip_expense") {
        tripTotal += e.amount;
      } else {
        otherTotal += e.amount;
      }
    });

    return { total, fuelTotal, maintenanceTotal, tripTotal, otherTotal };
  }, [expenses]);

  // Filtered List
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (categoryFilter !== "all") {
        if (categoryFilter === "fuel" && e.category !== "fuel") return false;
        if (
          categoryFilter === "maintenance" &&
          e.category !== "maintenance_service" &&
          e.category !== "spare_part" &&
          !e.category.includes("maintenance")
        )
          return false;
        if (categoryFilter === "trip" && e.category !== "trip_expense") return false;
      }

      if (machineFilter !== "all" && e.machineId !== machineFilter) {
        return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = e.title.toLowerCase().includes(q);
        const matchVoucher = e.voucherNumber.toLowerCase().includes(q);
        const matchPayee = e.payee.toLowerCase().includes(q);
        const matchMachine = e.machineName.toLowerCase().includes(q);
        if (!matchTitle && !matchVoucher && !matchPayee && !matchMachine) return false;
      }

      return true;
    });
  }, [expenses, categoryFilter, machineFilter, search]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id) return;
    if (!formData.title || !formData.amount || !formData.payee_name) {
      toast.error("Please fill in title, payee, and amount.");
      return;
    }

    setSubmitting(true);
    try {
      let rType: ReceiptType = "other_service";
      if (formData.category === "spare_part" || formData.category === "tyres") {
        rType = "spare_part";
      } else if (formData.category === "maintenance_service") {
        rType = "maintenance_service";
      }

      const res = await createAccountantReceipt({
        organisation_id: organisation.id,
        receipt_type: rType,
        title: formData.title.trim(),
        category: formData.category,
        payee_name: formData.payee_name.trim(),
        machine_id: formData.machine_id !== "none" ? formData.machine_id : null,
        amount: Number(formData.amount),
        currency: "TZS",
        payment_method: formData.payment_method as any,
        payment_date: formData.payment_date,
        paid_by_name: profile?.full_name || user?.email || "Finance Officer",
        notes: formData.notes.trim() || undefined,
        items: [
          {
            description: formData.title.trim(),
            quantity: 1,
            unit_price: Number(formData.amount),
            total: Number(formData.amount),
          },
        ],
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to record expense");
      }

      toast.success("Expense recorded successfully!");
      setAddModalOpen(false);
      setFormData({
        title: "",
        category: "maintenance_service",
        payee_name: "",
        amount: "",
        machine_id: "none",
        payment_method: "cash",
        payment_date: new Date().toISOString().slice(0, 10),
        notes: "",
      });
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create expense");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    if (!filteredExpenses.length) {
      toast.info("No expense records to export.");
      return;
    }

    const headers = ["Date", "Voucher #", "Title", "Category", "Vehicle", "Payee", "Method", "Amount (TZS)"];
    const rows = filteredExpenses.map((e) => [
      e.date?.slice(0, 10),
      `"${e.voucherNumber}"`,
      `"${e.title.replace(/"/g, '""')}"`,
      `"${e.category}"`,
      `"${e.machineName.replace(/"/g, '""')}"`,
      `"${e.payee.replace(/"/g, '""')}"`,
      e.paymentMethod,
      e.amount,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `fleet_expenses_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Expenses exported to CSV");
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 p-6">
      <FinanceNavHeader
        title="Fleet & Operational Expenses"
        subtitle="Consolidated ledger of vehicle maintenance, fuel purchases, driver per diems, and operational disbursements."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4" />
              Export CSV
            </Button>
            <Button size="sm" onClick={() => setAddModalOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Record Expense
            </Button>
          </>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Expenses</span>
            <DollarSign className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600">
            {formatMoney(metrics.total)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {expenses.length} recorded entries
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Fuel Spend</span>
            <Fuel className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600">
            {formatMoney(metrics.fuelTotal)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.total > 0 ? Math.round((metrics.fuelTotal / metrics.total) * 100) : 0}% of operating cost
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Repairs & Parts</span>
            <Wrench className="h-4 w-4 text-sky-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-sky-600">
            {formatMoney(metrics.maintenanceTotal)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Garage, spare parts & servicing
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Trip & Driver Exps</span>
            <Truck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
            {formatMoney(metrics.tripTotal)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Tolls, per diem & transit costs
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search voucher, title, payee, vehicle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="fuel">Fuel & Lubricants</SelectItem>
              <SelectItem value="maintenance">Repairs & Parts</SelectItem>
              <SelectItem value="trip">Trip & Driver Exps</SelectItem>
            </SelectContent>
          </Select>

          <Select value={machineFilter} onValueChange={setMachineFilter}>
            <SelectTrigger className="w-[180px]">
              <Truck className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter Vehicle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vehicles</SelectItem>
              {machines.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.plate_number || m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs font-medium text-muted-foreground">
          Showing {filteredExpenses.length} of {expenses.length} expenses
        </div>
      </div>

      {/* Expenses Table */}
      {filteredExpenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses found"
          description={
            search || categoryFilter !== "all" || machineFilter !== "all"
              ? "Try adjusting your search terms or filters."
              : "Record your first fleet expense voucher to begin tracking operational costs."
          }
          action={
            <Button size="sm" onClick={() => setAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Record First Expense
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
                  <th className="py-3 px-4 font-semibold">Voucher / ID</th>
                  <th className="py-3 px-4 font-semibold">Description</th>
                  <th className="py-3 px-4 font-semibold">Vehicle</th>
                  <th className="py-3 px-4 font-semibold">Payee / Station</th>
                  <th className="py-3 px-4 font-semibold">Method</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4 text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {formatDate(exp.date)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-primary whitespace-nowrap">
                      {exp.voucherNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-foreground">{exp.title}</div>
                      <div className="text-xs capitalize text-muted-foreground">
                        {exp.category.replace(/_/g, " ")}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-foreground border border-border">
                        <Truck className="h-3 w-3 text-muted-foreground" />
                        {exp.machineName}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      {exp.payee}
                    </td>
                    <td className="py-3.5 px-4 text-xs uppercase text-muted-foreground whitespace-nowrap">
                      {exp.paymentMethod.replace(/_/g, " ")}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-foreground whitespace-nowrap">
                      {formatMoney(exp.amount, exp.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        {exp.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Expense Dialog */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Record Fleet Expense
            </DialogTitle>
            <DialogDescription>
              Create an official disbursement voucher for workshop repairs, spare parts, driver allowances, or facility costs.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateExpense} className="space-y-4 py-2">
            <div>
              <Label htmlFor="title" className="text-xs font-medium">Expense Title / Description *</Label>
              <Input
                id="title"
                required
                placeholder="e.g. Brake Pads Replacement, Engine Oil Refill, Road Toll"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="category" className="text-xs font-medium">Expense Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maintenance_service">Maintenance & Servicing</SelectItem>
                    <SelectItem value="spare_part">Spare Parts & Hardware</SelectItem>
                    <SelectItem value="fuel">Fuel & Lubricants</SelectItem>
                    <SelectItem value="tyres">Tyres & Wheel Service</SelectItem>
                    <SelectItem value="trip_expense">Trip / Driver Allowance</SelectItem>
                    <SelectItem value="other_service">Facility & Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="machine_id" className="text-xs font-medium">Assign Vehicle</Label>
                <Select
                  value={formData.machine_id}
                  onValueChange={(val) => setFormData({ ...formData, machine_id: val })}
                >
                  <SelectTrigger id="machine_id">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">General Fleet / Facility</SelectItem>
                    {machines.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.plate_number || m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="amount" className="text-xs font-medium">Amount (TZS) *</Label>
                <Input
                  id="amount"
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="e.g. 250000"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="payee_name" className="text-xs font-medium">Payee / Vendor *</Label>
                <Input
                  id="payee_name"
                  required
                  placeholder="e.g. TotalEnergies, Dar Spare Parts Ltd"
                  value={formData.payee_name}
                  onChange={(e) => setFormData({ ...formData, payee_name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="payment_method" className="text-xs font-medium">Payment Method</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(val) => setFormData({ ...formData, payment_method: val })}
                >
                  <SelectTrigger id="payment_method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash Voucher</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer (EFT/TISS)</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money (M-Pesa/Tigo)</SelectItem>
                    <SelectItem value="cheque">Company Cheque</SelectItem>
                    <SelectItem value="card">Company Fuel/Credit Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="payment_date" className="text-xs font-medium">Payment Date</Label>
                <Input
                  id="payment_date"
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes" className="text-xs font-medium">Notes / Invoice Ref (Optional)</Label>
              <Textarea
                id="notes"
                rows={2}
                placeholder="Include invoice number, receipt notes, or authorization details..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Record Disbursement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
