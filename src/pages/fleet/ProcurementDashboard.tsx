import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  Building2,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  Search,
  Filter,
  DollarSign,
  Truck,
  TrendingDown,
  Layers,
  ChevronRight,
  Package,
  Award,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { formatDate, formatMoney } from "@/lib/format";
import { getSmartSpares, type CommercialSparePart } from "@/services/smartPartsService";
import {
  getFleetApprovalRequests,
  type FleetApprovalRequest,
  type VendorQuotation,
} from "@/services/fleetApprovalService";
import { toast } from "sonner";

export default function ProcurementDashboard() {
  const { organisation, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [requisitions, setRequisitions] = useState<FleetApprovalRequest[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [smartSpares, setSmartSpares] = useState<CommercialSparePart[]>([]);

  const loadData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const orgId = organisation?.id || profile.organisation_id || "";
      const [reqs, { data: sups }, spares] = await Promise.all([
        getFleetApprovalRequests(orgId),
        supabase.from("vendors").select("id, name, vendor_type, status, contact_person, phone, email").limit(50),
        getSmartSpares(orgId),
      ]);

      setRequisitions(reqs);
      setSuppliers(sups || []);
      setSmartSpares(spares);
    } catch (err: any) {
      console.error("Failed to load procurement data:", err);
      toast.error(err?.message || "Failed to load procurement dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile]);

  // Tender requisitions with multi-vendor quotes
  const tenderRequisitions = useMemo(() => {
    return requisitions.filter((r) => r.tender_quotes && r.tender_quotes.length > 0);
  }, [requisitions]);

  // Low stock spares requiring procurement reorder
  const lowStockSpares = useMemo(() => {
    return smartSpares.filter((s) => s.stock_quantity <= s.min_reorder_level);
  }, [smartSpares]);

  // Requisition statistics
  const pendingCount = requisitions.filter(
    (r) => r.status.startsWith("pending") || r.status === "info_requested"
  ).length;
  const approvedCount = requisitions.filter(
    (r) => r.status === "approved" || r.status === "disbursed"
  ).length;
  const totalRequisitionValue = requisitions.reduce((acc, r) => acc + (r.amount || 0), 0);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/20 shadow-sm">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Procurement Department
                </h1>
                <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30">
                  Enterprise Procurement
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Competitive 3-vendor tender comparisons, purchase requisitions, and approved supplier governance
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" className="gap-1.5 bg-primary text-primary-foreground">
            <Link to="/fleet/approvals">
              <Plus className="h-4 w-4" />
              New Requisition / Tender
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/inventory/suppliers">
              <Building2 className="h-4 w-4 text-primary" />
              Suppliers Directory ({suppliers.length})
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/inventory/items">
              <Package className="h-4 w-4 text-amber-600" />
              Stores Spares Catalog
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards: Slide 16 Procurement Status */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Active Requisitions
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                {requisitions.length}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                TZS {totalRequisitionValue.toLocaleString()} in pipeline
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <FileText className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-card p-5 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Pending Approval
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {pendingCount}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Requires stage sign-off in hierarchy
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-purple-500/20 bg-card p-5 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                3-Quote Tenders
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
                {tenderRequisitions.length} Active
              </div>
              <div className="mt-1 text-xs text-purple-600 font-medium">
                Competitive bid evaluation
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Award className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-red-500/20 bg-card p-5 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Low Stock Reorders
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-red-600 dark:text-red-400">
                {lowStockSpares.length} SKUs
              </div>
              <div className="mt-1 text-xs text-red-600 font-medium">
                Below minimum safety threshold
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: 3-Vendor Quotation Tender Matrix Showcase (Slide 16) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: 3-Vendor Quotation Tender Showcase & Active Requisitions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tender Matrix Showcase */}
          <div className="rounded-xl border border-purple-500/30 bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-purple-600" />
                <h3 className="font-semibold text-sm text-foreground">
                  3-Vendor Quotation Tender Matrix
                </h3>
              </div>
              <Badge variant="outline" className="text-xs text-purple-600 border-purple-500/30">
                Procurement Compliance Mandate
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Eliminates single-bid procurement risks by enforcing side-by-side comparison of supplier quotes before release to Finance and Management.
            </p>

            {tenderRequisitions.length === 0 ? (
              <div className="p-4 rounded-lg border border-border bg-muted/20 text-center text-xs text-muted-foreground">
                No active 3-vendor tender dossiers. Requisitions above budget thresholds will trigger the tender comparison workflow.
              </div>
            ) : (
              <div className="space-y-4">
                {tenderRequisitions.map((req) => (
                  <div key={req.id} className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
                      <div>
                        <div className="font-bold text-sm text-foreground flex items-center gap-2">
                          <span>{req.request_number}</span>
                          <span className="text-muted-foreground font-normal">·</span>
                          <span className="font-semibold">{req.title}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Target Asset: {req.vehicle_plate || "Workshop Plant"} · Total Est: TZS {req.amount.toLocaleString()}
                        </div>
                      </div>
                      <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                        <Link to="/fleet/approvals">Open Tender Dossier</Link>
                      </Button>
                    </div>

                    {/* 3-Quote Side-by-Side Comparison Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {req.tender_quotes?.map((quote, idx) => {
                        const isWinning = req.selected_tender_vendor === quote.vendor_name;
                        const isLowest = quote.quoted_amount === Math.min(...(req.tender_quotes || []).map((q) => q.quoted_amount));

                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg border text-xs transition-all relative ${
                              isWinning
                                ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500"
                                : isLowest
                                ? "border-blue-500/40 bg-blue-500/5"
                                : "border-border bg-card"
                            }`}
                          >
                            <div className="flex items-center justify-between font-semibold mb-1">
                              <span className="truncate max-w-[120px]">{quote.vendor_name}</span>
                              {isWinning ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-600 text-white">
                                  Awarded
                                </span>
                              ) : isLowest ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-600/15 text-blue-700 dark:text-blue-300">
                                  Lowest
                                </span>
                              ) : null}
                            </div>
                            <div className="text-sm font-bold text-foreground font-mono mt-1">
                              TZS {quote.quoted_amount.toLocaleString()}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                              <div>Lead: {quote.delivery_days} days</div>
                              <div>Warranty: {quote.warranty_months} mos</div>
                              <div>Terms: {quote.payment_terms || "30 Days"}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Requisitions Table */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">
                  Recent Requisitions & Approval Status
                </h3>
              </div>
              <Link
                to="/fleet/approvals"
                className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                View Approvals Pipeline <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {requisitions.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-6 w-6" />}
                title="No purchase requisitions"
                description="Create material requests or spare parts requests to initiate procurement approval."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground uppercase tracking-wider">
                      <th className="pb-2.5 font-semibold">Requisition #</th>
                      <th className="pb-2.5 font-semibold">Title</th>
                      <th className="pb-2.5 font-semibold">Vehicle</th>
                      <th className="pb-2.5 font-semibold">Amount</th>
                      <th className="pb-2.5 font-semibold">Stage</th>
                      <th className="pb-2.5 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {requisitions.slice(0, 6).map((req) => (
                      <tr key={req.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 font-mono font-bold text-primary">
                          <Link to="/fleet/approvals" className="hover:underline">
                            {req.request_number}
                          </Link>
                        </td>
                        <td className="py-3 max-w-[180px] truncate font-medium text-foreground">
                          {req.title}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {req.vehicle_plate || "Workshop"}
                        </td>
                        <td className="py-3 font-mono font-semibold">
                          TZS {req.amount.toLocaleString()}
                        </td>
                        <td className="py-3 capitalize text-muted-foreground">
                          {req.current_stage.replace("_", " ")}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              req.status === "approved"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : req.status === "rejected"
                                ? "bg-red-500/10 text-red-700 dark:text-red-300"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {req.status}
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

        {/* Right 1 Col: Stores Low-Stock Reorder Queue & Approved Suppliers */}
        <div className="space-y-4">
          {/* Stores Low-Stock Reorder Queue (Slide 13, 14) */}
          <div className="rounded-xl border border-red-500/20 bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <h3 className="font-semibold text-sm text-foreground">
                  Stores Low-Stock Queue
                </h3>
              </div>
              <Badge variant="destructive" className="text-[10px]">
                {lowStockSpares.length} SKUs Alert
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Spare parts requiring immediate purchase requisition generation to avoid workshop job card delays.
            </p>

            {lowStockSpares.length === 0 ? (
              <div className="p-3 text-center text-xs text-emerald-600 font-medium">
                ✓ All stores spare parts within healthy stock limits.
              </div>
            ) : (
              <div className="space-y-2">
                {lowStockSpares.slice(0, 5).map((part) => {
                  const reorderQty = Math.max(1, part.max_capacity - part.stock_quantity);
                  const totalEst = part.unit_price_tzs * reorderQty;
                  return (
                    <div
                      key={part.id}
                      className="p-2.5 rounded-lg border border-border bg-muted/20 flex items-center justify-between text-xs gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-foreground truncate">{part.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {part.part_number} · Bin: {part.bin_location}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-red-600">
                          {part.stock_quantity} / {part.min_reorder_level} left
                        </div>
                        <Link
                          to={`/fleet/approvals?new=1&type=purchase_requisition&title=${encodeURIComponent(`Replenish ${part.name} (${reorderQty} units)`)}&amount=${totalEst}&item=${encodeURIComponent(part.name)}`}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-600 hover:text-purple-700 hover:underline mt-0.5"
                          title="Launch 3-vendor tender comparison for this stock item"
                        >
                          Launch Tender <ArrowUpRight className="h-2.5 w-2.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-2">
              <Button asChild size="sm" variant="outline" className="w-full text-xs gap-1.5 border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30">
                <Link to="/fleet/approvals?new=1&type=purchase_requisition">
                  <Plus className="h-3.5 w-3.5" /> Raise Batch Purchase Requisition
                </Link>
              </Button>
            </div>
          </div>

          {/* Approved Suppliers Directory (Slide 16) */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">
                  Approved Suppliers
                </h3>
              </div>
              <Link
                to="/inventory/suppliers"
                className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
              >
                All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {suppliers.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">
                No vendors recorded yet.
              </div>
            ) : (
              <div className="space-y-2">
                {suppliers.slice(0, 5).map((sup) => (
                  <div
                    key={sup.id}
                    className="p-2 rounded-lg border border-border bg-muted/20 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{sup.name}</div>
                      <div className="text-[10px] text-muted-foreground capitalize">
                        {sup.vendor_type || "Commercial Supplier"}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      Approved
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
