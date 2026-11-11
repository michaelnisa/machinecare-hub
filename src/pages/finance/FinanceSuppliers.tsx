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
import {
  getSupplierBills,
  createSupplierBill,
  type FinanceSupplierBill,
  type BillCategory,
  type BillStatus,
} from "@/services/financeService";
import {
  Building2,
  Search,
  Plus,
  Filter,
  DollarSign,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Truck,
  Fuel,
  Wrench,
  CircleDot,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";

export default function FinanceSuppliers() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<FinanceSupplierBill[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string; plate_number: string | null }[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create Bill Dialog
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submittingBill, setSubmittingBill] = useState(false);
  const [billNumber, setBillNumber] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [category, setCategory] = useState<BillCategory>("fuel");
  const [amount, setAmount] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [selectedMachine, setSelectedMachine] = useState("none");
  const [notes, setNotes] = useState("");

  // Pay Bill Dialog
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<FinanceSupplierBill | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payRef, setPayRef] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const loadData = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const [data, { data: machs }] = await Promise.all([
        getSupplierBills(organisation.id),
        (supabase as any)
          .from("machines")
          .select("id, name, plate_number")
          .eq("organisation_id", organisation.id)
          .order("name"),
      ]);
      setBills(data);
      setMachines(machs || []);
    } catch (err) {
      console.error("Failed to load supplier bills:", err);
      toast.error("Failed to load supplier bills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  // Overall KPIs
  const metrics = useMemo(() => {
    let totalBilled = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let overdueCount = 0;
    const now = Date.now();

    bills.forEach((b) => {
      const amt = Number(b.amount || 0);
      const paid = Number(b.paid_amount || 0);
      const balance = Math.max(amt - paid, 0);

      totalBilled += amt;
      totalPaid += paid;
      totalOutstanding += balance;

      if (balance > 0 && new Date(b.due_date).getTime() < now) {
        overdueCount++;
      }
    });

    return { totalBilled, totalPaid, totalOutstanding, overdueCount, count: bills.length };
  }, [bills]);

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      if (categoryFilter !== "all" && b.category !== categoryFilter) return false;
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchBillNum = b.bill_number.toLowerCase().includes(q);
        const matchSupp = b.supplier_name.toLowerCase().includes(q);
        const matchPlate = b.machine?.plate_number?.toLowerCase().includes(q) || false;
        if (!matchBillNum && !matchSupp && !matchPlate) return false;
      }
      return true;
    });
  }, [bills, categoryFilter, statusFilter, search]);

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id) return;
    if (!supplierName.trim() || !billNumber.trim() || !amount) {
      toast.error("Please fill in supplier name, bill number, and amount.");
      return;
    }

    setSubmittingBill(true);
    try {
      const res = await createSupplierBill(organisation.id, {
        bill_number: billNumber,
        supplier_name: supplierName,
        category,
        amount: Number(amount),
        bill_date: billDate,
        due_date: dueDate,
        machine_id: selectedMachine !== "none" ? selectedMachine : undefined,
        notes,
      });

      if (!res.success) throw new Error(res.error || "Failed to create bill");

      toast.success("Supplier bill recorded!");
      setCreateModalOpen(false);
      setBillNumber("");
      setSupplierName("");
      setAmount("");
      setSelectedMachine("none");
      setNotes("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save bill");
    } finally {
      setSubmittingBill(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) return;
    if (!payAmount || Number(payAmount) <= 0) {
      toast.error("Please enter a valid payment amount.");
      return;
    }

    setSubmittingPayment(true);
    try {
      const newPaid = Number(selectedBill.paid_amount || 0) + Number(payAmount);
      const isFull = newPaid >= Number(selectedBill.amount);

      const { error } = await (supabase as any)
        .from("finance_supplier_bills")
        .update({
          paid_amount: newPaid,
          status: isFull ? "paid" : "partially_paid",
          payment_method: payMethod,
          payment_reference: payRef || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedBill.id);

      if (error) throw error;

      toast.success("Vendor payment applied!");
      setPayModalOpen(false);
      setSelectedBill(null);
      setPayAmount("");
      setPayRef("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const openPaymentDialog = (bill: FinanceSupplierBill) => {
    setSelectedBill(bill);
    const balance = Math.max(Number(bill.amount) - Number(bill.paid_amount || 0), 0);
    setPayAmount(String(balance));
    setPayModalOpen(true);
  };

  const handleExportCSV = () => {
    if (!filteredBills.length) {
      toast.info("No records to export.");
      return;
    }

    const headers = ["Bill Date", "Bill #", "Supplier", "Category", "Vehicle", "Due Date", "Amount (TZS)", "Paid (TZS)", "Status"];
    const rows = filteredBills.map((b) => [
      b.bill_date,
      `"${b.bill_number}"`,
      `"${b.supplier_name.replace(/"/g, '""')}"`,
      b.category,
      `"${b.machine?.plate_number || b.machine?.name || "General"}"`,
      b.due_date,
      b.amount,
      b.paid_amount,
      b.status,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `supplier_bills_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Supplier bills exported to CSV");
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 p-6">
      <FinanceNavHeader
        title="Supplier Payments & Vendor Bills"
        subtitle="Manage fuel suppliers, spare part vendors, external garages, and Accounts Payable liabilities."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4" />
              Export CSV
            </Button>
            <Button size="sm" onClick={() => setCreateModalOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Enter Supplier Bill
            </Button>
          </>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Invoiced</span>
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-primary">
            {formatMoney(metrics.totalBilled)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.count} supplier bills registered
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Settled / Paid</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
            {formatMoney(metrics.totalPaid)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Paid out to vendors
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Accounts Payable (AP)</span>
            <DollarSign className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600">
            {formatMoney(metrics.totalOutstanding)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Pending vendor disbursements
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Overdue Bills</span>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600">
            {metrics.overdueCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Past due credit invoices
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bill number, vendor, vehicle..."
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
              <SelectItem value="fuel">Fuel & Stations</SelectItem>
              <SelectItem value="spare_parts">Spare Parts</SelectItem>
              <SelectItem value="tyres">Tyres & Wheels</SelectItem>
              <SelectItem value="maintenance">Garage & Maintenance</SelectItem>
              <SelectItem value="insurance_permits">Insurance & Permits</SelectItem>
              <SelectItem value="facility">Facility & Utilities</SelectItem>
              <SelectItem value="other">Other Vendor Bills</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="partially_paid">Partially Paid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs font-medium text-muted-foreground">
          Showing {filteredBills.length} of {bills.length} bills
        </div>
      </div>

      {/* Bills Table */}
      {filteredBills.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6 text-muted-foreground" />}
          title="No supplier bills found"
          description={
            search || categoryFilter !== "all" || statusFilter !== "all"
              ? "Try adjusting your filters or search terms."
              : "Keep track of supplier bills, spare parts invoices, and fuel station accounts in one central ledger."
          }
          action={
            <Button size="sm" onClick={() => setCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Record First Bill
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 font-semibold">Bill Date</th>
                  <th className="py-3 px-4 font-semibold">Bill #</th>
                  <th className="py-3 px-4 font-semibold">Supplier / Vendor</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Vehicle</th>
                  <th className="py-3 px-4 font-semibold">Due Date</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount</th>
                  <th className="py-3 px-4 font-semibold text-right">Balance Due</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredBills.map((b) => {
                  const balance = Math.max(Number(b.amount) - Number(b.paid_amount || 0), 0);
                  const isPaid = b.status === "paid" || balance === 0;

                  return (
                    <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {formatDate(b.bill_date)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-primary whitespace-nowrap">
                        {b.bill_number}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        {b.supplier_name}
                      </td>
                      <td className="py-3.5 px-4 text-xs capitalize text-muted-foreground whitespace-nowrap">
                        {b.category.replace(/_/g, " ")}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium whitespace-nowrap">
                        {b.machine ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-foreground border border-border">
                            <Truck className="h-3 w-3 text-muted-foreground" />
                            {b.machine.plate_number || b.machine.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        <span
                          className={
                            !isPaid && new Date(b.due_date).getTime() < Date.now()
                              ? "font-semibold text-rose-600"
                              : "text-muted-foreground"
                          }
                        >
                          {formatDate(b.due_date)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-foreground whitespace-nowrap">
                        {formatMoney(b.amount, b.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {balance > 0 ? (
                          <span className="font-semibold text-rose-600">
                            {formatMoney(balance, b.currency)}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-emerald-600">Settled</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isPaid
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : b.status === "partially_paid"
                              ? "bg-sky-500/10 text-sky-600 border-sky-500/20"
                              : new Date(b.due_date).getTime() < Date.now()
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          }`}
                        >
                          {b.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {!isPaid && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-medium"
                            onClick={() => openPaymentDialog(b)}
                          >
                            Pay Bill
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Bill Dialog */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Enter Supplier / Vendor Bill
            </DialogTitle>
            <DialogDescription>
              Record an incoming invoice from fuel stations, spare part dealers, or third-party service providers.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateBill} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="supplierName" className="text-xs font-medium">Supplier / Vendor *</Label>
                <Input
                  id="supplierName"
                  required
                  placeholder="e.g. TotalEnergies, CFAO Motors"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="billNumber" className="text-xs font-medium">Supplier Bill / Invoice # *</Label>
                <Input
                  id="billNumber"
                  required
                  placeholder="e.g. INV-90483"
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="category" className="text-xs font-medium">Expense Category *</Label>
                <Select value={category} onValueChange={(val: BillCategory) => setCategory(val)}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fuel">Fuel & Station Ledger</SelectItem>
                    <SelectItem value="spare_parts">Spare Parts & Hardware</SelectItem>
                    <SelectItem value="tyres">Tyres & Wheel Alignment</SelectItem>
                    <SelectItem value="maintenance">Workshop & Servicing</SelectItem>
                    <SelectItem value="insurance_permits">Insurance & Permits</SelectItem>
                    <SelectItem value="facility">Facility & Utilities</SelectItem>
                    <SelectItem value="other">Other Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="selectedMachine" className="text-xs font-medium">Assigned Vehicle</Label>
                <Select value={selectedMachine} onValueChange={setSelectedMachine}>
                  <SelectTrigger id="selectedMachine">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">General / Multiple</SelectItem>
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
                  placeholder="e.g. 1850000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="dueDate" className="text-xs font-medium">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="billDate" className="text-xs font-medium">Bill Issue Date</Label>
              <Input
                id="billDate"
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="notes" className="text-xs font-medium">Notes / Order Reference</Label>
              <Textarea
                id="notes"
                rows={2}
                placeholder="Purchase order ref, delivery note number, or terms..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingBill}>
                {submittingBill ? "Saving..." : "Record Bill"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pay Supplier Bill Dialog */}
      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-500" />
              Pay Supplier Bill
            </DialogTitle>
            <DialogDescription>
              Disburse payment to{" "}
              <span className="font-semibold text-foreground">
                {selectedBill?.supplier_name}
              </span>{" "}
              for bill{" "}
              <span className="font-mono text-primary font-semibold">
                {selectedBill?.bill_number}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRecordPayment} className="space-y-4 py-2">
            <div>
              <Label htmlFor="payAmount" className="text-xs font-medium">Disbursement Amount (TZS) *</Label>
              <Input
                id="payAmount"
                type="number"
                required
                min="1"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="payMethod" className="text-xs font-medium">Disbursement Method *</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger id="payMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Wire / EFT / TISS</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money (M-Pesa / Tigo / Airtel)</SelectItem>
                  <SelectItem value="cheque">Company Cheque</SelectItem>
                  <SelectItem value="cash">Petty Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="payRef" className="text-xs font-medium">Reference / Bank Transaction Number</Label>
              <Input
                id="payRef"
                placeholder="e.g. TXN987293 or Cheque #1029"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setPayModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingPayment}>
                {submittingPayment ? "Disbursing..." : "Confirm Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
