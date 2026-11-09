import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { formatDate, formatMoney } from "@/lib/format";
import { toast } from "sonner";
import {
  getAccountantReceipts,
  getAccountingMetrics,
  updateAccountantReceiptStatus,
  type AccountantReceipt,
  type ReceiptType,
  type AccountingMetrics,
} from "@/services/accountantService";
import { CreateReceiptModal } from "@/components/accounting/CreateReceiptModal";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Printer,
  FileText,
  DollarSign,
  Package,
  Wrench,
  Truck,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Clock,
  Building2,
  Paperclip,
  TrendingUp,
} from "lucide-react";

export default function Accounting() {
  const { organisation } = useAuth();
  const { canWrite } = useUserRole();

  const [receipts, setReceipts] = useState<AccountantReceipt[]>([]);
  const [metrics, setMetrics] = useState<AccountingMetrics>({
    totalAmountThisMonth: 0,
    sparePartsAmount: 0,
    sparePartsCount: 0,
    maintenanceAmount: 0,
    maintenanceCount: 0,
    totalReceiptsCount: 0,
    recentCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ReceiptType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending">("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");

  // Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const loadData = async (showRefreshing = false) => {
    if (!organisation?.id) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      const [receiptsData, metricsData] = await Promise.all([
        getAccountantReceipts(organisation.id),
        getAccountingMetrics(organisation.id),
      ]);
      setReceipts(receiptsData);
      setMetrics(metricsData);
    } catch (err: any) {
      toast.error("Failed to load accounting data: " + err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  // Client-side filtering
  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      // Type
      if (typeFilter !== "all" && r.receipt_type !== typeFilter) return false;
      // Status
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      // Method
      if (methodFilter !== "all" && r.payment_method !== methodFilter) return false;

      // Search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const numMatch = r.receipt_number?.toLowerCase().includes(q);
        const titleMatch = r.title?.toLowerCase().includes(q);
        const payeeMatch = r.payee_name?.toLowerCase().includes(q);
        const refMatch = r.payment_reference?.toLowerCase().includes(q);
        const plateMatch = r.machines?.plate_number?.toLowerCase().includes(q) || r.machines?.name?.toLowerCase().includes(q);
        return numMatch || titleMatch || payeeMatch || refMatch || plateMatch;
      }
      return true;
    });
  }, [receipts, typeFilter, statusFilter, methodFilter, search]);

  const handleVoidReceipt = async (receiptId: string) => {
    if (!confirm("Are you sure you want to void this payment receipt?")) return;
    const res = await updateAccountantReceiptStatus(receiptId, "cancelled");
    if (!res.success) {
      toast.error(res.error || "Failed to void receipt");
      return;
    }
    toast.success("Payment receipt voided");
    loadData(true);
  };

  if (loading) return <PageLoader message="Loading financial receipts & ledgers..." />;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Accountant &amp; Finance Receipts</h1>
            <span className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
              <CheckCircle2 className="h-3 w-3" /> Disbursements Ledger
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create, record, and print official disbursement vouchers for spare parts and maintenance services.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {canWrite && (
            <Button
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-4 w-4" /> Record Payment Receipt
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Disbursed This Month</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono text-foreground">
            {formatMoney(metrics.totalAmountThisMonth, "TZS")}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {new Date().toLocaleString("default", { month: "long", year: "numeric" })}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Spare Parts Paid</span>
            <Package className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold font-mono text-foreground">
            {formatMoney(metrics.sparePartsAmount, "TZS")}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {metrics.sparePartsCount} parts purchases recorded
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Maintenance &amp; Services Paid</span>
            <Wrench className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold font-mono text-foreground">
            {formatMoney(metrics.maintenanceAmount, "TZS")}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {metrics.maintenanceCount} service disbursements
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Vouchers Issued</span>
            <Receipt className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold font-mono text-foreground">{metrics.totalReceiptsCount}</div>
          <div className="text-[11px] text-muted-foreground">
            {metrics.recentCount} active cleared vouchers
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-2xs">
        {/* Type Tabs */}
        <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)} className="w-full md:w-auto">
          <TabsList className="grid grid-cols-4 h-8 text-[11px]">
            <TabsTrigger value="all">All Vouchers</TabsTrigger>
            <TabsTrigger value="spare_part" className="gap-1">
              <Package className="h-3 w-3" /> Spare Parts
            </TabsTrigger>
            <TabsTrigger value="maintenance_service" className="gap-1">
              <Wrench className="h-3 w-3" /> Maintenance
            </TabsTrigger>
            <TabsTrigger value="other_service">Other</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Secondary filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 md:flex-initial">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search voucher #, payee, plate..."
              className="pl-8 h-8 text-xs"
            />
          </div>

          {/* Payment Method filter */}
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-[125px] h-8 text-xs">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Methods</SelectItem>
              <SelectItem value="cash" className="text-xs">Cash</SelectItem>
              <SelectItem value="bank_transfer" className="text-xs">Bank Transfer</SelectItem>
              <SelectItem value="mobile_money" className="text-xs">Mobile Money</SelectItem>
              <SelectItem value="cheque" className="text-xs">Cheque</SelectItem>
              <SelectItem value="selcom" className="text-xs">Selcom</SelectItem>
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[105px] h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Status</SelectItem>
              <SelectItem value="paid" className="text-xs">Paid</SelectItem>
              <SelectItem value="pending" className="text-xs">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border font-semibold text-muted-foreground">
                <th className="py-2.5 px-3">Voucher #</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Type &amp; Purpose</th>
                <th className="py-2.5 px-3">Payee / Supplier</th>
                <th className="py-2.5 px-3">Allocation</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3">Method &amp; Ref</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredReceipts.map((r) => {
                const isPart = r.receipt_type === "spare_part";
                const isMaint = r.receipt_type === "maintenance_service";

                return (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    {/* Voucher Number */}
                    <td className="py-3 px-3">
                      <Link
                        to={`/accounting/receipts/${r.id}/print`}
                        className="font-mono font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        <Receipt className="h-3 w-3" />
                        {r.receipt_number}
                      </Link>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(r.payment_date)}
                    </td>

                    {/* Type & Title */}
                    <td className="py-3 px-3 max-w-[260px]">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1 ${
                            isPart
                              ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                              : isMaint
                              ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                              : "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                          }`}
                        >
                          {isPart ? <Package className="h-2.5 w-2.5" /> : isMaint ? <Wrench className="h-2.5 w-2.5" /> : null}
                          {isPart ? "Parts" : isMaint ? "Service" : "Other"}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate">{r.category}</span>
                      </div>
                      <div className="font-medium text-foreground truncate" title={r.title}>
                        {r.title}
                      </div>
                    </td>

                    {/* Payee */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        {r.payee_name}
                      </div>
                      {r.received_by_name && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          Attn: {r.received_by_name}
                        </div>
                      )}
                    </td>

                    {/* Machine & WO Allocation */}
                    <td className="py-3 px-3 text-[11px]">
                      {r.machines ? (
                        <Link
                          to={`/fleet/vehicles/${r.machines.id}`}
                          className="font-mono font-medium text-foreground hover:underline flex items-center gap-1"
                        >
                          <Truck className="h-3 w-3 text-muted-foreground" />
                          {r.machines.plate_number || r.machines.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground italic text-[10px]">Unallocated</span>
                      )}
                      {r.work_orders && (
                        <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                          WO-{r.work_orders.wo_number || "ref"}
                        </div>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-foreground">
                      {formatMoney(r.amount, r.currency)}
                    </td>

                    {/* Payment Method */}
                    <td className="py-3 px-3">
                      <div className="font-medium capitalize text-foreground">
                        {r.payment_method.replace("_", " ")}
                      </div>
                      {r.payment_reference && (
                        <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]" title={r.payment_reference}>
                          {r.payment_reference}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          r.status === "paid"
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : r.status === "pending"
                            ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                            : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {r.attachment_url && (
                          <Button asChild variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="View attached receipt">
                            <a href={r.attachment_url} target="_blank" rel="noreferrer">
                              <Paperclip className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}

                        <Button asChild variant="outline" size="sm" className="h-7 text-xs gap-1 px-2">
                          <Link to={`/accounting/receipts/${r.id}/print`}>
                            <Printer className="h-3 w-3" /> Print
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

        {filteredReceipts.length === 0 && (
          <div className="py-12 px-4 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <h3 className="font-semibold text-sm">No Payment Receipts Found</h3>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-sm mx-auto">
              {search || typeFilter !== "all"
                ? "No receipts match your search filter criteria."
                : "No disbursement vouchers recorded yet. Click 'Record Payment Receipt' above to create your first voucher."}
            </p>
            {canWrite && !search && typeFilter === "all" && (
              <Button
                size="sm"
                onClick={() => setCreateModalOpen(true)}
                className="mt-3 text-xs gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Record First Receipt
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Create Receipt Modal */}
      <CreateReceiptModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() => loadData(true)}
      />
    </div>
  );
}
