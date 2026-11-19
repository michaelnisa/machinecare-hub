import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useIndustry } from "@/hooks/useIndustry";
import { isLogistixwareAccount } from "@/services/customerService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { toast } from "sonner";
import { formatMoney, formatNumber } from "@/lib/format";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  DollarSign,
  Fuel,
  Truck,
  Wrench,
  CircleDot,
  Radio,
  Plus,
  Search,
  Phone,
  MapPin,
  Eye,
  FileText,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Send,
  ArrowRight,
  CreditCard,
  Building2,
  Package,
  FileCheck,
} from "lucide-react";
import {
  getFleetApprovalRequests,
  createFleetApprovalRequest,
  reviewFleetApprovalStep,
  disburseFleetApproval,
  buildApprovalChain,
  STAGE_CONFIG,
  type FleetApprovalRequest,
  type FleetApprovalType,
  type FleetApprovalPriority,
  type ApprovalStageId,
} from "@/services/fleetApprovalService";
import { isEnterpriseFleet } from "@/lib/fleetTiers";

const TYPE_CONFIG: Record<
  FleetApprovalType,
  { label: string; icon: any; color: string; bg: string }
> = {
  emergency_breakdown: {
    label: "Emergency Road Breakdown",
    icon: Radio,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/30",
  },
  spare_parts: {
    label: "Spare Parts Requisition",
    icon: Wrench,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/30",
  },
  trip_float: {
    label: "Trip Safari Float",
    icon: Fuel,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/30",
  },
  tyre_replacement: {
    label: "Tyre Replacement",
    icon: CircleDot,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/30",
  },
  outsourced_service: {
    label: "Outsourced Garage Service",
    icon: Building2,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-500/10 border-indigo-500/30",
  },
  material_request: {
    label: "Material Requisition",
    icon: Package,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/30",
  },
  purchase_requisition: {
    label: "Purchase Requisition (3-Quote Tender)",
    icon: FileCheck,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/30",
  },
  general_payment: {
    label: "General Payment",
    icon: DollarSign,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
  },
};

const PRIORITY_BADGES: Record<FleetApprovalPriority, { label: string; badge: string }> = {
  emergency: {
    label: "EMERGENCY HIGHWAY",
    badge: "bg-rose-500 text-white font-bold animate-pulse",
  },
  urgent: {
    label: "Urgent",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30",
  },
  standard: {
    label: "Standard",
    badge: "bg-muted text-muted-foreground border border-border",
  },
  low: {
    label: "Low",
    badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
};

export default function FleetApprovals() {
  const { profile } = useAuth();
  const { isManager, isOwner, role } = useUserRole();
  const { organisation } = useIndustry();
  const isEnterprise = isEnterpriseFleet(organisation);
  const isMultiDepartment = isEnterprise;

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<FleetApprovalRequest[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [selectedRequest, setSelectedRequest] = useState<FleetApprovalRequest | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [disburseModalOpen, setDisburseModalOpen] = useState(false);

  // Review action state
  const [reviewNote, setReviewNote] = useState("");
  const [reviewing, setReviewing] = useState(false);

  // Disbursement state
  const [disburseMethod, setDisburseMethod] = useState<"cash" | "mobile" | "bank">("cash");
  const [disburseRef, setDisburseRef] = useState("");
  const [disburseNote, setDisburseNote] = useState("");
  const [disbursing, setDisbursing] = useState(false);

  const [reqType, setReqType] = useState<FleetApprovalType>("spare_parts");
  const [reqPriority, setReqPriority] = useState<FleetApprovalPriority>("standard");
  const [reqTitle, setReqTitle] = useState("");
  const [reqDescription, setReqDescription] = useState("");
  const [reqVehiclePlate, setReqVehiclePlate] = useState("");
  const [reqWorkOrderId, setReqWorkOrderId] = useState("");
  const [reqAmount, setReqAmount] = useState<number | "">("");
  const [reqCurrency, setReqCurrency] = useState<"TZS" | "USD">("TZS");
  const [reqGps, setReqGps] = useState("");
  const [reqVendorName, setReqVendorName] = useState("");
  const [reqVendorPhone, setReqVendorPhone] = useState("");
  const [reqItems, setReqItems] = useState<{ name: string; quantity: number; unit_price: number }[]>([
    { name: "", quantity: 1, unit_price: 0 },
  ]);
  const [creating, setCreating] = useState(false);

  // Cross-department URL Query Param Sync (Workshop / Procurement / Stores -> Approvals)
  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setCreateModalOpen(true);
      const qType = searchParams.get("type");
      if (qType) {
        setReqType(qType as FleetApprovalType);
      }
      const qTitle = searchParams.get("title") || searchParams.get("item");
      if (qTitle) setReqTitle(qTitle);
      const qVehicle = searchParams.get("vehicle");
      if (qVehicle) setReqVehiclePlate(qVehicle);
      const qAmount = searchParams.get("amount");
      if (qAmount && !isNaN(Number(qAmount))) setReqAmount(Number(qAmount));
      const qPriority = searchParams.get("priority");
      if (qPriority && (qPriority === "standard" || qPriority === "urgent" || qPriority === "emergency")) {
        setReqPriority(qPriority as FleetApprovalPriority);
      }
      const qDesc = searchParams.get("description") || searchParams.get("reason");
      if (qDesc) setReqDescription(qDesc);
      const qWo = searchParams.get("work_order_id");
      if (qWo) setReqWorkOrderId(qWo);
    }
  }, [searchParams]);

  // 3-Quote Tender Competitive Bidding State (Mega Beverages Slide 16)
  const [quote1Vendor, setQuote1Vendor] = useState("");
  const [quote1Amount, setQuote1Amount] = useState("");
  const [quote1Days, setQuote1Days] = useState("3");
  const [quote2Vendor, setQuote2Vendor] = useState("");
  const [quote2Amount, setQuote2Amount] = useState("");
  const [quote2Days, setQuote2Days] = useState("5");
  const [quote3Vendor, setQuote3Vendor] = useState("");
  const [quote3Amount, setQuote3Amount] = useState("");
  const [quote3Days, setQuote3Days] = useState("7");
  const [selectedVendorForApproval, setSelectedVendorForApproval] = useState<string>("");

  const orgId = profile?.organisation_id || "";

  const loadData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [appData, { data: vData }] = await Promise.all([
        getFleetApprovalRequests(orgId, isMultiDepartment),
        (supabase as any)
          .from("machines")
          .select("id, name, plate_number, serial_number, model, category, notes")
          .eq("organisation_id", orgId)
          .order("name"),
      ]);
      setRequests(appData);
      setVehicles(vData ?? []);
    } catch (e: any) {
      console.warn("Failed to load fleet approvals:", e);
      toast.error("Failed to load approval workflows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [orgId]);

  // Metric Computations
  const metrics = useMemo(() => {
    const pendingReview = requests.filter(
      (r) => r.status.startsWith("pending")
    ).length;
    const emergencyCount = requests.filter(
      (r) => r.priority === "emergency" && r.status !== "approved" && r.status !== "disbursed"
    ).length;
    const approvedCount = requests.filter(
      (r) => r.status === "approved" || r.status === "disbursed"
    ).length;
    const totalCommitted = requests
      .filter((r) => r.status === "approved" || r.status === "disbursed")
      .reduce((sum, r) => sum + (r.currency === "TZS" ? r.amount : r.amount * 2600), 0);

    return { pendingReview, emergencyCount, approvedCount, totalCommitted };
  }, [requests]);

  // Tab Filtering
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Search text filter
      const matchesSearch =
        !searchQuery ||
        r.request_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.vehicle_plate && r.vehicle_plate.toLowerCase().includes(searchQuery.toLowerCase())) ||
        r.requester_name.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeTab === "all") return true;
      if (activeTab === "pending") return r.status.startsWith("pending");
      if (activeTab === "emergency") return r.priority === "emergency";
      if (activeTab === "spare_parts") return r.request_type === "spare_parts";
      if (activeTab === "trip_float") return r.request_type === "trip_float";
      if (activeTab === "tyre") return r.request_type === "tyre_replacement";
      if (activeTab === "approved") return r.status === "approved" || r.status === "disbursed";
      if (activeTab === "rejected") return r.status === "rejected";
      return true;
    });
  }, [requests, activeTab, searchQuery]);

  // Handle Review Step (Approve or Reject)
  const handleReviewStep = async (decision: "approved" | "rejected" | "info_requested") => {
    if (!selectedRequest || !profile) return;
    setReviewing(true);
    try {
      const updated = await reviewFleetApprovalStep(
        orgId,
        selectedRequest.id,
        selectedRequest.current_stage as ApprovalStageId,
        decision,
        profile.id,
        profile.full_name || "Manager",
        reviewNote.trim() || undefined,
        selectedVendorForApproval || undefined
      );

      toast.success(
        decision === "approved"
          ? `Stage approved! ${updated.status === "approved" ? "All stages completed." : "Progressed to next department."}`
          : decision === "rejected"
          ? "Request has been rejected."
          : "Clarification requested from submitter."
      );

      setSelectedRequest(updated);
      setReviewNote("");
      setSelectedVendorForApproval("");
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to submit review");
    } finally {
      setReviewing(false);
    }
  };

  // Handle Disbursement
  const handleDisbursement = async () => {
    if (!selectedRequest || !profile) return;
    if (!disburseRef.trim()) {
      return toast.error("Enter a payment reference number (e.g. Receipt #, TXN ID, or Voucher #)");
    }
    setDisbursing(true);
    try {
      const updated = await disburseFleetApproval(orgId, selectedRequest.id, {
        disbursed_at: new Date().toISOString(),
        disbursed_by: profile.id,
        disburser_name: profile.full_name || "Finance Officer",
        method: disburseMethod,
        reference: disburseRef.trim(),
        note: disburseNote.trim() || undefined,
      });

      toast.success("Payment disbursed and recorded successfully!");
      setSelectedRequest(updated);
      setDisburseModalOpen(false);
      setDisburseRef("");
      setDisburseNote("");
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to disburse payment");
    } finally {
      setDisbursing(false);
    }
  };

  // Handle Create New Requisition
  const handleCreateRequest = async () => {
    if (!orgId || !profile) return;
    if (!reqTitle.trim()) return toast.error("Enter a requisition title");
    if (!reqAmount || Number(reqAmount) <= 0) return toast.error("Enter a valid amount");

    setCreating(true);
    try {
      const cleanItems = reqItems
        .filter((it) => it.name.trim())
        .map((it) => ({
          name: it.name.trim(),
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          total_price: (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
        }));

      const chain = buildApprovalChain(reqType, Number(reqAmount), isMultiDepartment);
      const initialStage = chain[0].stage;

      // Construct 3-Quote Tender Matrix (Slide 16)
      const tenderQuotes: any[] = [];
      if (quote1Vendor.trim()) {
        tenderQuotes.push({
          vendor_name: quote1Vendor.trim(),
          unit_price: Number(quote1Amount) || Number(reqAmount),
          total_price: Number(quote1Amount) || Number(reqAmount),
          delivery_days: Number(quote1Days) || 3,
          warranty_months: 12,
          is_selected: true,
        });
      }
      if (quote2Vendor.trim()) {
        tenderQuotes.push({
          vendor_name: quote2Vendor.trim(),
          unit_price: Number(quote2Amount) || 0,
          total_price: Number(quote2Amount) || 0,
          delivery_days: Number(quote2Days) || 5,
          warranty_months: 6,
          is_selected: false,
        });
      }
      if (quote3Vendor.trim()) {
        tenderQuotes.push({
          vendor_name: quote3Vendor.trim(),
          unit_price: Number(quote3Amount) || 0,
          total_price: Number(quote3Amount) || 0,
          delivery_days: Number(quote3Days) || 7,
          warranty_months: 6,
          is_selected: false,
        });
      }

      const matchedVeh = vehicles.find(
        (v) =>
          (v.plate_number && v.plate_number.toLowerCase() === reqVehiclePlate.trim().toLowerCase()) ||
          (v.name && v.name.toLowerCase() === reqVehiclePlate.trim().toLowerCase()) ||
          (v.serial_number && v.serial_number.toLowerCase() === reqVehiclePlate.trim().toLowerCase())
      );

      await createFleetApprovalRequest({
        organisation_id: orgId,
        request_type: reqType,
        priority: reqPriority,
        title: reqTitle.trim(),
        description: reqDescription.trim() || undefined,
        vehicle_id: matchedVeh?.id || undefined,
        vehicle_plate: reqVehiclePlate.trim() || undefined,
        work_order_id: reqWorkOrderId.trim() || undefined,
        amount: Number(reqAmount),
        currency: reqCurrency,
        department:
          reqType === "emergency_breakdown" || reqType === "trip_float"
            ? "Fleet Operations & Dispatch"
            : "Workshop & Maintenance",
        requested_by: profile.id,
        requester_name: profile.full_name || "Fleet Staff",
        gps_location: reqGps.trim() || undefined,
        vendor_name: reqVendorName.trim() || undefined,
        vendor_phone: reqVendorPhone.trim() || undefined,
        items: cleanItems,
        evidence_urls: [],
        status: `pending_${initialStage}` as any,
        current_stage: initialStage,
        approval_chain: chain,
        tender_quotes: tenderQuotes.length > 0 ? tenderQuotes : undefined,
        selected_tender_vendor: tenderQuotes[0]?.vendor_name,
      });

      toast.success("Requisition submitted into approval workflow!");
      setCreateModalOpen(false);
      // Reset form
      setReqTitle("");
      setReqDescription("");
      setReqVehiclePlate("");
      setReqWorkOrderId("");
      setReqAmount("");
      setReqGps("");
      setReqVendorName("");
      setReqVendorPhone("");
      setReqItems([{ name: "", quantity: 1, unit_price: 0 }]);
      setQuote1Vendor("");
      setQuote1Amount("");
      setQuote2Vendor("");
      setQuote2Amount("");
      setQuote3Vendor("");
      setQuote3Amount("");
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to submit request");
    } finally {
      setCreating(false);
    }
  };

  if (loading && requests.length === 0) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Fleet Approvals &amp; Requisition Center
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="h-3.5 w-3.5" />{" "}
              {isMultiDepartment ? "Multi-Department Governance" : "Direct Manager Approval"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isMultiDepartment
              ? "End-to-end digital approval workflow connecting Workshop, Stores, Procurement, and Finance."
              : "Direct digital approval workflow for fleet maintenance, spare parts, and safari float requisitions."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button onClick={() => setCreateModalOpen(true)} className="gap-1.5 text-xs">
            <Plus className="h-4 w-4" /> New Requisition
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Pending Review</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-1 text-2xl font-bold tracking-tight">{metrics.pendingReview}</p>
          <p className="text-[11px] text-muted-foreground">
            {isMultiDepartment ? "Awaiting department sign-offs" : "Awaiting manager sign-off"}
          </p>
        </div>

        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3.5 shadow-sm hover:border-rose-500/50 transition-colors">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-rose-700 dark:text-rose-400">Highway Emergencies</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500 text-white animate-pulse">
              <Radio className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-1 text-2xl font-bold tracking-tight text-rose-700 dark:text-rose-300">
            {metrics.emergencyCount}
          </p>
          <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">Active corridor breakdowns</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Approved &amp; Disbursed</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-1 text-2xl font-bold tracking-tight">{metrics.approvedCount}</p>
          <p className="text-[11px] text-muted-foreground">
            {isMultiDepartment ? "Passed all department checks" : "Passed manager authorization"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Committed Spend</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-1 text-lg font-bold tracking-tight">
            TZS {formatNumber(metrics.totalCommitted)}
          </p>
          <p className="text-[11px] text-muted-foreground">Approved operational budget</p>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "all", label: "All Requests" },
            { id: "pending", label: "Pending Review", count: metrics.pendingReview },
            { id: "emergency", label: "Corridor Emergency", count: metrics.emergencyCount, alert: true },
            { id: "spare_parts", label: "Spare Parts" },
            { id: "trip_float", label: "Trip Safari Float" },
            { id: "tyre", label: "Tyres" },
            { id: "approved", label: "Approved" },
            { id: "rejected", label: "Rejected" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? tab.alert
                    ? "bg-rose-600 text-white"
                    : "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    activeTab === tab.id
                      ? "bg-white/20 text-white"
                      : tab.alert
                      ? "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search plate, REQ#, title..."
            className="pl-8 text-xs h-9"
          />
        </div>
      </div>

      {filteredRequests.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No approval requisitions found"
          description={
            searchQuery || activeTab !== "all"
              ? "No requisitions match your current search or tab filter."
              : "No requisitions have been submitted yet. Submit a requisition for spare parts, highway rescue, tyre replacement, or trip safari float."
          }
          action={
            <Button onClick={() => setCreateModalOpen(true)} className="gap-1.5 text-xs">
              <Plus className="h-4 w-4" /> New Requisition
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => {
            const typeConf = TYPE_CONFIG[req.request_type] || TYPE_CONFIG.spare_parts;
            const priorityConf = PRIORITY_BADGES[req.priority] || PRIORITY_BADGES.standard;
            const TypeIcon = typeConf.icon;

            return (
              <div
                key={req.id}
                className={`rounded-xl border bg-card p-4 shadow-sm transition-all hover:border-primary/50 ${
                  req.priority === "emergency" && req.status.startsWith("pending")
                    ? "border-rose-500/40 bg-rose-500/[0.02]"
                    : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {req.request_number}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${typeConf.bg} ${typeConf.color}`}
                      >
                        <TypeIcon className="h-3 w-3" />
                        {typeConf.label}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityConf.badge}`}
                      >
                        {priorityConf.label}
                      </span>
                      {req.vehicle_plate && (
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground border border-border">
                          <Truck className="h-3 w-3 text-muted-foreground" />
                          {req.vehicle_plate}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                      {req.title}
                    </h3>

                    {req.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 max-w-3xl">
                        {req.description}
                      </p>
                    )}

                    {req.gps_location && (
                      <div className="flex items-center gap-1 text-xs text-rose-700 dark:text-rose-400 font-medium">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        Location: {req.gps_location}
                        {req.vendor_phone && ` · Vendor: ${req.vendor_name || ""} (${req.vendor_phone})`}
                      </div>
                    )}
                  </div>

                  <div className="text-right space-y-1">
                    <div className="text-lg font-bold text-foreground">
                      {req.currency} {formatNumber(req.amount)}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      By {req.requester_name} · {req.department}
                    </p>
                  </div>
                </div>

                {/* Visual Approval Chain Stepper (Mega Beverages 5-Department Hierarchy) */}
                <div className="mt-4 pt-3 border-t border-border">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                      {req.approval_chain.map((step, idx) => {
                        const isApproved = step.status === "approved";
                        const isRejected = step.status === "rejected";
                        const isCurrent = step.stage === req.current_stage;

                        return (
                          <div key={step.stage} className="flex items-center">
                            <div
                              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors ${
                                isApproved
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                                  : isRejected
                                  ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400"
                                  : isCurrent
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 font-semibold ring-1 ring-amber-500/30"
                                  : "bg-muted/40 border-border text-muted-foreground"
                              }`}
                              title={step.note ? `Note: ${step.note}` : undefined}
                            >
                              {isApproved ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              ) : isRejected ? (
                                <X className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                              ) : isCurrent ? (
                                <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 animate-spin" />
                              ) : (
                                <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                              )}
                              <span>{step.stage_label}</span>
                            </div>
                            {idx < req.approval_chain.length - 1 && (
                              <ArrowRight className="mx-1 h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedRequest(req)}
                        className="gap-1 text-xs h-8"
                      >
                        <Eye className="h-3.5 w-3.5" /> View Dossier &amp; Review
                      </Button>
                      {req.status === "approved" && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(req);
                            setDisburseModalOpen(true);
                          }}
                          className="gap-1 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CreditCard className="h-3.5 w-3.5" /> Disburse Funds
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Dossier Modal */}
      {selectedRequest && (
        <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl">
                  {selectedRequest.request_number}: {selectedRequest.title}
                </DialogTitle>
              </div>
              <p className="text-xs text-muted-foreground">
                Submitted by {selectedRequest.requester_name} ({selectedRequest.department}) on{" "}
                {new Date(selectedRequest.created_at).toLocaleString()}
              </p>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              {/* Asset & Financial Overview */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 rounded-xl border border-border bg-muted/20 p-3">
                <div>
                  <p className="text-[11px] text-muted-foreground">Vehicle Plate</p>
                  <p className="font-mono font-bold text-foreground">
                    {selectedRequest.vehicle_plate || "General Fleet / Store"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Total Requisition Amount</p>
                  <p className="font-bold text-foreground">
                    {selectedRequest.currency} {formatNumber(selectedRequest.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Current Status</p>
                  <span className="capitalize font-semibold text-primary">
                    {selectedRequest.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              {/* Description */}
              {selectedRequest.description && (
                <div>
                  <Label className="text-xs text-muted-foreground">Technical Diagnosis / Justification</Label>
                  <div className="mt-1 rounded-lg border border-border bg-card p-3 text-xs leading-relaxed">
                    {selectedRequest.description}
                  </div>
                </div>
              )}

              {/* GPS Corridor location */}
              {selectedRequest.gps_location && (
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-800 dark:text-rose-300">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <MapPin className="h-4 w-4 text-rose-600" /> Roadside Breakdown Location
                  </div>
                  <p className="mt-1">{selectedRequest.gps_location}</p>
                  {selectedRequest.vendor_name && (
                    <p className="mt-1 font-mono">
                      Service Vendor: {selectedRequest.vendor_name} ({selectedRequest.vendor_phone})
                    </p>
                  )}
                </div>
              )}

              {/* Itemized Spares / Expense Table */}
              {selectedRequest.items.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Itemized Requisition Details</Label>
                  <table className="mt-1.5 w-full rounded-lg border border-border text-xs">
                    <thead className="bg-muted/40 text-left text-muted-foreground">
                      <tr>
                        <th className="p-2 font-medium">Item / Service Description</th>
                        <th className="p-2 font-medium text-center">Qty</th>
                        <th className="p-2 font-medium text-right">Unit Price</th>
                        <th className="p-2 font-medium text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRequest.items.map((it, idx) => (
                        <tr key={idx} className="border-t border-border">
                          <td className="p-2 font-medium">{it.name}</td>
                          <td className="p-2 text-center">{it.quantity}</td>
                          <td className="p-2 text-right">
                            {selectedRequest.currency} {formatNumber(it.unit_price || 0)}
                          </td>
                          <td className="p-2 text-right font-bold">
                            {selectedRequest.currency} {formatNumber(it.total_price || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Procurement 3-Vendor Quotation Tender Matrix (Slide 16) */}
              {selectedRequest.tender_quotes && selectedRequest.tender_quotes.length > 0 && (
                <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-xs font-bold text-foreground">
                        Procurement 3-Vendor Tender Evaluation (Slide 16)
                      </span>
                    </div>
                    <span className="rounded-md border border-purple-500/40 px-2 py-0.5 text-[10px] font-mono text-purple-700 dark:text-purple-300">
                      Competitive Bidding
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-left text-muted-foreground bg-purple-500/10">
                        <tr>
                          <th className="p-2 font-medium">Bidding Supplier</th>
                          <th className="p-2 font-medium text-right">Quoted Price ({selectedRequest.currency})</th>
                          <th className="p-2 font-medium text-center">Lead Time</th>
                          <th className="p-2 font-medium text-center">Warranty</th>
                          <th className="p-2 font-medium text-center">Evaluation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRequest.tender_quotes.map((q, qIdx) => {
                          const isWinning = selectedRequest.selected_tender_vendor
                            ? selectedRequest.selected_tender_vendor === q.vendor_name
                            : q.is_selected;

                          return (
                            <tr
                              key={qIdx}
                              className={`border-t border-purple-500/20 ${
                                isWinning ? "bg-purple-500/15 font-semibold text-foreground" : "text-muted-foreground"
                              }`}
                            >
                              <td className="p-2">
                                <div className="flex items-center gap-2">
                                  <span>{q.vendor_name}</span>
                                  {isWinning && (
                                    <span className="rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 text-[9px] font-bold uppercase">
                                      Awarded
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-2 text-right font-mono">
                                {formatNumber(q.total_price)}
                              </td>
                              <td className="p-2 text-center">{q.delivery_days} days</td>
                              <td className="p-2 text-center">{q.warranty_months} mo</td>
                              <td className="p-2 text-center">
                                {canReview && selectedRequest.current_stage === "procurement" ? (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedVendorForApproval(q.vendor_name)}
                                    className={`text-[10px] rounded px-2 py-0.5 border cursor-pointer font-bold ${
                                      (selectedVendorForApproval || selectedRequest.selected_tender_vendor) === q.vendor_name
                                        ? "bg-purple-600 text-white border-purple-600"
                                        : "bg-background text-foreground border-border hover:bg-muted"
                                    }`}
                                  >
                                    {(selectedVendorForApproval || selectedRequest.selected_tender_vendor) === q.vendor_name
                                      ? "Selected Bid"
                                      : "Select Bid"}
                                  </button>
                                ) : (
                                  <span className="text-[10px]">
                                    {isWinning ? "Selected" : "Alternative"}
                                  </span>
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

              {/* Multi-Department Audit Trail */}
              <div>
                <Label className="text-xs text-muted-foreground">Approval Stages &amp; Department Sign-Offs</Label>
                <div className="mt-2 space-y-2">
                  {selectedRequest.approval_chain.map((step) => (
                    <div
                      key={step.stage}
                      className="rounded-lg border border-border p-3 text-xs flex flex-wrap items-start justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{step.stage_label}</span>
                          <span
                            className={`rounded-full px-2 py-0.2 text-[10px] font-bold uppercase ${
                              step.status === "approved"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : step.status === "rejected"
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                : step.stage === selectedRequest.current_stage
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {step.status}
                          </span>
                        </div>
                        {step.reviewer_name && (
                          <p className="mt-0.5 text-muted-foreground text-[11px]">
                            Reviewed by {step.reviewer_name} on {new Date(step.reviewed_at!).toLocaleString()}
                          </p>
                        )}
                        {step.note && (
                          <p className="mt-1 rounded bg-muted/60 p-2 italic text-foreground">
                            "{step.note}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Disbursement Record if settled */}
              {selectedRequest.disbursement_info && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 text-xs text-emerald-900 dark:text-emerald-200">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Funds Disbursed / Settled
                  </div>
                  <p className="mt-1">
                    Disbursed by {selectedRequest.disbursement_info.disburser_name} via{" "}
                    <span className="font-semibold uppercase">
                      {selectedRequest.disbursement_info.method === "cash"
                        ? "Cash"
                        : selectedRequest.disbursement_info.method === "mobile"
                        ? "Mobile Money"
                        : selectedRequest.disbursement_info.method === "bank"
                        ? "Bank Transfer"
                        : selectedRequest.disbursement_info.method}
                    </span>.
                    Reference: <span className="font-mono font-bold">{selectedRequest.disbursement_info.reference}</span>
                  </p>
                  {selectedRequest.disbursement_info.note && (
                    <p className="mt-1 italic">{selectedRequest.disbursement_info.note}</p>
                  )}
                </div>
              )}

              {/* Active Review Action Form (if pending) */}
              {selectedRequest.status.startsWith("pending") && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" /> Action Required:{" "}
                      {STAGE_CONFIG[selectedRequest.current_stage as ApprovalStageId]?.label || "Department Review"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Department Review Remarks / Note</Label>
                    <Textarea
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="Add technical comments, stock check confirmation, or budget verification..."
                      className="mt-1 text-xs bg-background h-20"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReviewStep("info_requested")}
                      disabled={reviewing}
                      className="text-xs border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                    >
                      Request Clarification
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleReviewStep("rejected")}
                      disabled={reviewing}
                      className="text-xs"
                    >
                      Reject Request
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleReviewStep("approved")}
                      disabled={reviewing}
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" /> Approve Department Stage
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="mt-3">
              <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Disbursement Modal */}
      {disburseModalOpen && selectedRequest && (
        <Dialog open={disburseModalOpen} onOpenChange={setDisburseModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg">Authorize &amp; Disburse Payment</DialogTitle>
              <p className="text-xs text-muted-foreground">
                Release funds for {selectedRequest.request_number} ({selectedRequest.currency} {formatNumber(selectedRequest.amount)})
              </p>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div>
                <Label htmlFor="disburse_method">Disbursement Channel</Label>
                <select
                  id="disburse_method"
                  value={disburseMethod}
                  onChange={(e: any) => setDisburseMethod(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                >
                  <option value="cash">Cash (Petty Cash Voucher)</option>
                  <option value="mobile">Mobile Money</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>

              <div>
                <Label htmlFor="disburse_ref">Voucher / Transaction Reference *</Label>
                <Input
                  id="disburse_ref"
                  value={disburseRef}
                  onChange={(e) => setDisburseRef(e.target.value)}
                  placeholder="e.g. CASH-0012, TXN-8912, or Bank Ref"
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label htmlFor="disburse_note">Disbursement Notes</Label>
                <Textarea
                  id="disburse_note"
                  value={disburseNote}
                  onChange={(e) => setDisburseNote(e.target.value)}
                  placeholder="Payment receipt details or driver fuel card account number..."
                  className="mt-1 text-xs h-16"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDisburseModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleDisbursement}
                disabled={disbursing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"
              >
                <CheckCircle2 className="h-4 w-4" /> Complete Disbursement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* New Requisition Modal */}
      {createModalOpen && (
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">Submit Fleet Requisition</DialogTitle>
              <p className="text-xs text-muted-foreground">
                Initiate a requisition for workshop parts, highway roadside rescue, safari float, or tyres.
              </p>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="req_type">Requisition Category *</Label>
                  <select
                    id="req_type"
                    value={reqType}
                    onChange={(e: any) => setReqType(e.target.value)}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                  >
                    <option value="spare_parts">Spare Parts Requisition</option>
                    <option value="material_request">Material Requisition</option>
                    <option value="purchase_requisition">Purchase Requisition (3-Quote Tender)</option>
                    <option value="emergency_breakdown">Emergency Highway Breakdown</option>
                    <option value="trip_float">Trip Safari Float (Fuel &amp; Road Tolls)</option>
                    <option value="tyre_replacement">Tyre Replacement &amp; Fitment</option>
                    <option value="outsourced_service">Outsourced / External Garage</option>
                    <option value="general_payment">General Fleet Expense</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="req_priority">Urgency Priority *</Label>
                  <select
                    id="req_priority"
                    value={reqPriority}
                    onChange={(e: any) => setReqPriority(e.target.value)}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                  >
                    <option value="standard">Standard (Next Scheduled PM)</option>
                    <option value="urgent">Urgent (Vehicle Held in Workshop)</option>
                    <option value="emergency">EMERGENCY (Stranded on Highway)</option>
                    <option value="low">Low Priority (Routine Restock)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="req_vehicle">Assigned Vehicle Plate / Asset Tag</Label>
                  <Input
                    id="req_vehicle"
                    list="asset_plates_list"
                    value={reqVehiclePlate}
                    onChange={(e) => setReqVehiclePlate(e.target.value)}
                    placeholder="e.g. T 412 DFB or GEN-01 (or select)"
                    className="mt-1 text-xs"
                  />
                  <datalist id="asset_plates_list">
                    {vehicles.map((v) => (
                      <option
                        key={v.id}
                        value={v.plate_number || v.name}
                      >
                        {v.name} {v.category ? `(${v.category})` : ""} {v.serial_number ? `· S/N: ${v.serial_number}` : ""}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="req_amount">Estimated Cost *</Label>
                    <Input
                      id="req_amount"
                      type="number"
                      value={reqAmount}
                      onChange={(e) => setReqAmount(e.target.value ? Number(e.target.value) : "")}
                      placeholder="e.g. 850000"
                      className="mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label htmlFor="req_curr">Currency</Label>
                    <select
                      id="req_curr"
                      value={reqCurrency}
                      onChange={(e: any) => setReqCurrency(e.target.value)}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                    >
                      <option value="TZS">TZS (Shillings)</option>
                      <option value="USD">USD (Dollars)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="req_title">Requisition Title *</Label>
                <Input
                  id="req_title"
                  value={reqTitle}
                  onChange={(e) => setReqTitle(e.target.value)}
                  placeholder="e.g. Turbocharger Intercooler Hose replacement"
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label htmlFor="req_desc">Fault Reason / Technical Diagnostic</Label>
                <Textarea
                  id="req_desc"
                  value={reqDescription}
                  onChange={(e) => setReqDescription(e.target.value)}
                  placeholder="Explain why this part or disbursement is required..."
                  className="mt-1 text-xs h-16"
                />
              </div>

              {/* Highway details for Emergency Breakdowns */}
              {reqType === "emergency_breakdown" && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 space-y-3">
                  <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5 animate-pulse" /> Emergency Highway Dispatch Details
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="req_gps">Highway Mile Marker / GPS Location</Label>
                      <Input
                        id="req_gps"
                        value={reqGps}
                        onChange={(e) => setReqGps(e.target.value)}
                        placeholder="e.g. Morogoro Highway KM 182 (Mikumi)"
                        className="mt-1 text-xs bg-background"
                      />
                    </div>
                    <div>
                      <Label htmlFor="req_vname">Roadside Mechanic / Vendor Name</Label>
                      <Input
                        id="req_vname"
                        value={reqVendorName}
                        onChange={(e) => setReqVendorName(e.target.value)}
                        placeholder="e.g. Mikumi Mobile Truck Service"
                        className="mt-1 text-xs bg-background"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="req_vphone">Vendor Mobile Phone</Label>
                    <Input
                      id="req_vphone"
                      value={reqVendorPhone}
                      onChange={(e) => setReqVendorPhone(e.target.value)}
                      placeholder="+255 754 889 120"
                      className="mt-1 text-xs bg-background"
                    />
                  </div>
                </div>
              )}

              {/* Line items */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Line Items &amp; Spare Parts</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setReqItems([...reqItems, { name: "", quantity: 1, unit_price: 0 }])
                    }
                    className="h-7 text-xs text-primary"
                  >
                    + Add Item
                  </Button>
                </div>
                <div className="mt-1.5 space-y-2">
                  {reqItems.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={it.name}
                        onChange={(e) => {
                          const copy = [...reqItems];
                          copy[idx].name = e.target.value;
                          setReqItems(copy);
                        }}
                        placeholder="Part name or service description"
                        className="text-xs flex-1"
                      />
                      <Input
                        type="number"
                        value={it.quantity}
                        onChange={(e) => {
                          const copy = [...reqItems];
                          copy[idx].quantity = Number(e.target.value);
                          setReqItems(copy);
                        }}
                        placeholder="Qty"
                        className="text-xs w-16 text-center"
                      />
                      <Input
                        type="number"
                        value={it.unit_price}
                        onChange={(e) => {
                          const copy = [...reqItems];
                          copy[idx].unit_price = Number(e.target.value);
                          setReqItems(copy);
                        }}
                        placeholder="Price"
                        className="text-xs w-28 text-right"
                      />
                      {reqItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setReqItems(reqItems.filter((_, i) => i !== idx))}
                          className="h-8 w-8 p-0 text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Procurement 3-Quote Competitive Bidding (Mega Beverages Slide 16) */}
              {isEnterprise && (
                <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <FileCheck className="h-4 w-4 text-purple-600" />
                      Procurement 3-Vendor Quotation Tender (Slide 16)
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase font-mono">
                      Competitive Bidding
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Record 3 vendor bids for transparent procurement governance and finance audit.
                  </p>

                  <div className="space-y-2.5">
                    {/* Bid 1 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2 rounded-lg border border-purple-500/20 bg-purple-500/5">
                      <div>
                        <Label className="text-[10px] font-bold text-purple-700 dark:text-purple-400">
                          Vendor 1 (Recommended Bidder) *
                        </Label>
                        <Input
                          placeholder="e.g. Scania Tanzania Ltd"
                          value={quote1Vendor}
                          onChange={(e) => setQuote1Vendor(e.target.value)}
                          className="h-8 text-xs bg-background mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Quoted Amount (TZS)</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 3850000"
                          value={quote1Amount}
                          onChange={(e) => setQuote1Amount(e.target.value)}
                          className="h-8 text-xs bg-background mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Delivery Days</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 3"
                          value={quote1Days}
                          onChange={(e) => setQuote1Days(e.target.value)}
                          className="h-8 text-xs bg-background mt-1"
                        />
                      </div>
                    </div>

                    {/* Bid 2 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2 rounded-lg border border-border bg-background">
                      <div>
                        <Label className="text-[10px] font-medium text-foreground">
                          Vendor 2 (Alternative Quote)
                        </Label>
                        <Input
                          placeholder="e.g. Commercial Motors Dar"
                          value={quote2Vendor}
                          onChange={(e) => setQuote2Vendor(e.target.value)}
                          className="h-8 text-xs bg-background mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Quoted Amount (TZS)</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 4200000"
                          value={quote2Amount}
                          onChange={(e) => setQuote2Amount(e.target.value)}
                          className="h-8 text-xs bg-background mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Delivery Days</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 5"
                          value={quote2Days}
                          onChange={(e) => setQuote2Days(e.target.value)}
                          className="h-8 text-xs bg-background mt-1"
                        />
                      </div>
                    </div>

                    {/* Bid 3 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2 rounded-lg border border-border bg-background">
                      <div>
                        <Label className="text-[10px] font-medium text-foreground">
                          Vendor 3 (Alternative Quote)
                        </Label>
                        <Input
                          placeholder="e.g. Heavy Diesel Spares Ltd"
                          value={quote3Vendor}
                          onChange={(e) => setQuote3Vendor(e.target.value)}
                          className="h-8 text-xs bg-background mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Quoted Amount (TZS)</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 4450000"
                          value={quote3Amount}
                          onChange={(e) => setQuote3Amount(e.target.value)}
                          className="h-8 text-xs bg-background mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Delivery Days</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 7"
                          value={quote3Days}
                          onChange={(e) => setQuote3Days(e.target.value)}
                          className="h-8 text-xs bg-background mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="mt-3">
              <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateRequest} disabled={creating} className="gap-1.5 text-xs">
                <Send className="h-3.5 w-3.5" /> Submit to Approval Chain
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
