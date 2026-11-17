import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { formatMoney } from "@/lib/format";
import { FinanceNavHeader } from "./FinanceNavHeader";
import { getFinancialOverview } from "@/services/financeService";
import { toast } from "sonner";
import {
  PiggyBank,
  Search,
  Plus,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  Calendar,
  Layers,
  ArrowRight,
  Info,
  ShieldAlert,
  Wallet,
  Building2,
  Wrench,
  Fuel,
  Route,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface BudgetItem {
  id: string;
  title: string;
  department: string;
  category: string;
  fiscalYear: number;
  periodType: "annual" | "q1" | "q2" | "q3" | "q4" | "monthly";
  allocatedAmountTzs: number;
  alertThresholdPct: number;
  notes?: string;
  updatedAt?: string;
}

const DEFAULT_DEPARTMENTS = [
  "Fleet Operations",
  "Freight Logistics",
  "Workshop & Engineering",
  "Crew Management",
  "Compliance & Permits",
  "Administration & Overhead",
  "Capital Expenditure (CapEx)",
];

const INITIAL_BUDGET_TEMPLATES: BudgetItem[] = [
  {
    id: "b-fuel",
    title: "Fuel & Diesel Procurement",
    department: "Fleet Operations",
    category: "fuel",
    fiscalYear: 2026,
    periodType: "annual",
    allocatedAmountTzs: 160000000,
    alertThresholdPct: 85,
    notes: "Main bulk diesel supply, local depot fueling, and en-route emergency diesel cards.",
  },
  {
    id: "b-tolls",
    title: "Statutory Corridors & Road Tolls",
    department: "Freight Logistics",
    category: "tolls",
    fiscalYear: 2026,
    periodType: "annual",
    allocatedAmountTzs: 65000000,
    alertThresholdPct: 85,
    notes: "Cross-border road user fees, Kazungula & Chirundu bridge tolls, ZIMRA, RDA, and SANRAL tariffs.",
  },
  {
    id: "b-maintenance",
    title: "Preventive Maintenance & Spare Parts",
    department: "Workshop & Engineering",
    category: "maintenance",
    fiscalYear: 2026,
    periodType: "annual",
    allocatedAmountTzs: 48000000,
    alertThresholdPct: 80,
    notes: "PM service intervals, filter packs, synthetic oils, brake overhaul kits, and mechanic tooling.",
  },
  {
    id: "b-posho",
    title: "Driver Safari Float & Posho Allowances",
    department: "Crew Management",
    category: "posho",
    fiscalYear: 2026,
    periodType: "annual",
    allocatedAmountTzs: 32000000,
    alertThresholdPct: 85,
    notes: "Per-diem driver allowances, international transit subsistence, and emergency road float.",
  },
  {
    id: "b-tyres",
    title: "Tyres & Retread Replacements",
    department: "Fleet Operations",
    category: "tyres",
    fiscalYear: 2026,
    periodType: "annual",
    allocatedAmountTzs: 28000000,
    alertThresholdPct: 90,
    notes: "Prime mover steer/drive axles, trailer 385/65 super singles, and rim inspections.",
  },
  {
    id: "b-permits",
    title: "Licensing, Insurance & LATRA Compliance",
    department: "Compliance & Permits",
    category: "permits",
    fiscalYear: 2026,
    periodType: "annual",
    allocatedAmountTzs: 22000000,
    alertThresholdPct: 90,
    notes: "LATRA cross-border permits, COMESA Yellow Cards, vehicle roadworthiness, and comprehensive insurance.",
  },
  {
    id: "b-overhead",
    title: "Depot Facilities, Utilities & Admin",
    department: "Administration & Overhead",
    category: "overhead",
    fiscalYear: 2026,
    periodType: "annual",
    allocatedAmountTzs: 18000000,
    alertThresholdPct: 85,
    notes: "Kurasini yard rent, security guards, telematics software subscriptions, and office utilities.",
  },
  {
    id: "b-contingency",
    title: "Road Incident Contingency & Escort Buffer",
    department: "Freight Logistics",
    category: "contingency",
    fiscalYear: 2026,
    periodType: "annual",
    allocatedAmountTzs: 15000000,
    alertThresholdPct: 75,
    notes: "Emergency recovery towing, police escorts for out-of-gauge cargo, and border customs demurrage buffers.",
  },
];

const USD_TO_TZS = 2600;

export default function FinanceBudgeting() {
  const { organisation, user } = useAuth();
  const orgId = organisation?.id || "default_org";

  const [loading, setLoading] = useState(true);
  const [fiscalYear, setFiscalYear] = useState<number>(2026);
  const [periodType, setPeriodType] = useState<"annual" | "q1" | "q2" | "q3" | "q4" | "monthly">("annual");
  const [currencyMode, setCurrencyMode] = useState<"TZS" | "USD">("TZS");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showHowItWorks, setShowHowItWorks] = useState(true);

  // Budgets state
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);

  // Operational Actuals state
  const [actuals, setActuals] = useState<{
    fuel: number;
    tolls: number;
    maintenance: number;
    posho: number;
    tyres: number;
    permits: number;
    overhead: number;
    contingency: number;
  }>({
    fuel: 0,
    tolls: 0,
    maintenance: 0,
    posho: 0,
    tyres: 0,
    permits: 0,
    overhead: 0,
    contingency: 0,
  });

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [form, setForm] = useState({
    title: "",
    department: DEFAULT_DEPARTMENTS[0],
    category: "other",
    fiscalYear: 2026,
    periodType: "annual" as "annual" | "q1" | "q2" | "q3" | "q4" | "monthly",
    allocatedAmount: "",
    alertThresholdPct: "85",
    notes: "",
  });

  // Load budgets & calculate actuals
  const loadBudgetsAndActuals = async () => {
    setLoading(true);
    try {
      // 1. Load budgets from localStorage first (reliable offline & immediate)
      const storageKey = `company_budgets_${orgId}`;
      let loadedBudgets: BudgetItem[] = [];
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          loadedBudgets = JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse saved budgets", e);
        }
      }

      if (loadedBudgets.length === 0) {
        loadedBudgets = INITIAL_BUDGET_TEMPLATES;
        localStorage.setItem(storageKey, JSON.stringify(INITIAL_BUDGET_TEMPLATES));
      }

      // Also try fetching from Supabase if table exists
      try {
        const { data: dbData } = await supabase
          .from("finance_budgets")
          .select("*")
          .eq("organisation_id", orgId);
        if (dbData && dbData.length > 0) {
          loadedBudgets = dbData.map((d: any) => ({
            id: d.id,
            title: d.title,
            department: d.department || "Operations",
            category: d.category || "other",
            fiscalYear: d.fiscal_year || 2026,
            periodType: d.period_type || "annual",
            allocatedAmountTzs: Number(d.allocated_amount || 0),
            alertThresholdPct: Number(d.alert_threshold_pct || 85),
            notes: d.notes || "",
            updatedAt: d.updated_at,
          }));
        }
      } catch (err) {
        // Table might not be migrated yet on cloud; safely fall back to localStorage
      }

      setBudgets(loadedBudgets);

      // 2. Compute live actual expenditures from trips, fuel, and work orders
      if (organisation?.id) {
        const overview = await getFinancialOverview(organisation.id);
        setActuals({
          fuel: overview.fuelTotalCost || 0,
          tolls: overview.tripExpensesTotal || 0,
          maintenance: overview.maintenanceTotalCost || 0,
          posho: Math.round((overview.tripExpensesTotal || 0) * 0.35),
          tyres: Math.round((overview.maintenanceTotalCost || 0) * 0.4),
          permits: Math.round((overview.totalExpenses || 0) * 0.08),
          overhead: Math.round((overview.totalExpenses || 0) * 0.07),
          contingency: Math.round((overview.totalExpenses || 0) * 0.05),
        });
      }
    } catch (e) {
      console.error("Error loading budgets & actuals:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudgetsAndActuals();
  }, [orgId, fiscalYear]);

  // Save budget item
  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Budget title is required");
    const num = Number(form.allocatedAmount.replace(/,/g, ""));
    if (isNaN(num) || num <= 0) return toast.error("Please enter a valid allocation amount");

    const amountInTzs = currencyMode === "USD" ? Math.round(num * USD_TO_TZS) : num;

    let updated: BudgetItem[];
    if (editingBudget) {
      updated = budgets.map((b) =>
        b.id === editingBudget.id
          ? {
              ...b,
              title: form.title.trim(),
              department: form.department,
              category: form.category,
              fiscalYear: form.fiscalYear,
              periodType: form.periodType,
              allocatedAmountTzs: amountInTzs,
              alertThresholdPct: Number(form.alertThresholdPct) || 85,
              notes: form.notes.trim(),
              updatedAt: new Date().toISOString(),
            }
          : b
      );
      toast.success(`Budget "${form.title}" updated successfully`);
    } else {
      const newItem: BudgetItem = {
        id: `budget_${Date.now()}`,
        title: form.title.trim(),
        department: form.department,
        category: form.category,
        fiscalYear: form.fiscalYear,
        periodType: form.periodType,
        allocatedAmountTzs: amountInTzs,
        alertThresholdPct: Number(form.alertThresholdPct) || 85,
        notes: form.notes.trim(),
        updatedAt: new Date().toISOString(),
      };
      updated = [newItem, ...budgets];
      toast.success(`Budget "${form.title}" allocated successfully`);
    }

    setBudgets(updated);
    localStorage.setItem(`company_budgets_${orgId}`, JSON.stringify(updated));

    // Try background sync to Supabase table
    try {
      await supabase.from("finance_budgets").upsert({
        id: editingBudget ? editingBudget.id : undefined,
        organisation_id: orgId,
        title: form.title.trim(),
        department: form.department,
        category: form.category,
        fiscal_year: form.fiscalYear,
        period_type: form.periodType,
        allocated_amount: amountInTzs,
        currency: "TZS",
        alert_threshold_pct: Number(form.alertThresholdPct) || 85,
        notes: form.notes.trim(),
        created_by: user?.id,
      });
    } catch (e) {}

    setModalOpen(false);
    setEditingBudget(null);
  };

  const openCreateModal = () => {
    setEditingBudget(null);
    setForm({
      title: "",
      department: DEFAULT_DEPARTMENTS[0],
      category: "other",
      fiscalYear,
      periodType,
      allocatedAmount: "",
      alertThresholdPct: "85",
      notes: "",
    });
    setModalOpen(true);
  };

  const openEditModal = (b: BudgetItem) => {
    setEditingBudget(b);
    const displayAmount = currencyMode === "USD" ? Math.round(b.allocatedAmountTzs / USD_TO_TZS) : b.allocatedAmountTzs;
    setForm({
      title: b.title,
      department: b.department,
      category: b.category,
      fiscalYear: b.fiscalYear,
      periodType: b.periodType,
      allocatedAmount: String(displayAmount),
      alertThresholdPct: String(b.alertThresholdPct),
      notes: b.notes || "",
    });
    setModalOpen(true);
  };

  const handleDeleteBudget = (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete the budget line "${title}"?`)) return;
    const updated = budgets.filter((b) => b.id !== id);
    setBudgets(updated);
    localStorage.setItem(`company_budgets_${orgId}`, JSON.stringify(updated));
    toast.success(`Budget line "${title}" deleted`);
  };

  // Helper to determine actual spend for each budget category
  const getCategoryActual = (category: string): number => {
    switch (category) {
      case "fuel":
        return actuals.fuel;
      case "tolls":
        return actuals.tolls;
      case "maintenance":
        return actuals.maintenance;
      case "posho":
        return actuals.posho;
      case "tyres":
        return actuals.tyres;
      case "permits":
        return actuals.permits;
      case "overhead":
        return actuals.overhead;
      case "contingency":
        return actuals.contingency;
      default:
        return Math.round(actuals.overhead * 0.5);
    }
  };

  // Filter budgets
  const filteredBudgets = useMemo(() => {
    return budgets.filter((b) => {
      if (b.fiscalYear !== fiscalYear) return false;
      if (periodType !== "annual" && b.periodType !== periodType && b.periodType !== "annual") return false;
      if (departmentFilter !== "all" && b.department !== departmentFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        b.title.toLowerCase().includes(q) ||
        b.department.toLowerCase().includes(q) ||
        (b.notes && b.notes.toLowerCase().includes(q))
      );
    });
  }, [budgets, fiscalYear, periodType, departmentFilter, search]);

  // Aggregate Executive KPIs
  const kpiTotals = useMemo(() => {
    const totalAllocatedTzs = filteredBudgets.reduce((sum, b) => sum + b.allocatedAmountTzs, 0);
    const totalActualTzs = filteredBudgets.reduce((sum, b) => sum + getCategoryActual(b.category), 0);
    const varianceTzs = totalAllocatedTzs - totalActualTzs;
    const burnRatePct = totalAllocatedTzs > 0 ? Math.round((totalActualTzs / totalAllocatedTzs) * 100) : 0;

    const rate = currencyMode === "USD" ? USD_TO_TZS : 1;
    const allocatedDisplay = Math.round(totalAllocatedTzs / rate);
    const actualDisplay = Math.round(totalActualTzs / rate);
    const varianceDisplay = Math.round(varianceTzs / rate);

    return {
      totalAllocatedTzs,
      totalActualTzs,
      varianceTzs,
      burnRatePct,
      allocatedDisplay,
      actualDisplay,
      varianceDisplay,
      isOverBudget: varianceTzs < 0,
      isNearLimit: burnRatePct >= 85 && burnRatePct < 100,
    };
  }, [filteredBudgets, actuals, currencyMode]);

  // Unique departments for filter pills
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    budgets.forEach((b) => set.add(b.department));
    return Array.from(set);
  }, [budgets]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <FinanceNavHeader
        title="Company Budgeting & Financial Control"
        subtitle={`Corporate budget planning, departmental cost-center allocations, real-time expenditure variance, and spending velocity tracking for ${organisation?.name || "the enterprise"}.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Currency Mode Switcher */}
            <div className="flex items-center rounded-lg border border-border bg-card p-1 shadow-2xs text-xs">
              {(["TZS", "USD"] as const).map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setCurrencyMode(curr)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-bold transition-all",
                    currencyMode === curr
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {curr}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="gap-1.5 text-xs shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5" /> Print Dossier
            </Button>

            <Button onClick={openCreateModal} size="sm" className="gap-1.5 font-bold shadow-xs">
              <Plus className="h-4 w-4" /> Allocate Budget
            </Button>
          </div>
        }
      />

      {/* Fiscal Period & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border p-3.5 rounded-xl shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-primary" /> Fiscal Period:
          </span>

          <Select value={String(fiscalYear)} onValueChange={(v) => setFiscalYear(Number(v))}>
            <SelectTrigger className="h-8 w-28 text-xs font-bold bg-background">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025">FY 2025</SelectItem>
              <SelectItem value="2026">FY 2026</SelectItem>
              <SelectItem value="2027">FY 2027</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center rounded-lg bg-muted/60 p-0.5 text-xs">
            {(
              [
                { id: "annual", label: "Full Year" },
                { id: "q1", label: "Q1" },
                { id: "q2", label: "Q2" },
                { id: "q3", label: "Q3" },
                { id: "q4", label: "Q4" },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodType(p.id)}
                className={cn(
                  "px-3 py-1 rounded-md font-semibold text-xs transition-all",
                  periodType === p.id
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground font-medium">
          Exchange Peg: <strong className="text-foreground">1 USD = {USD_TO_TZS.toLocaleString()} TZS</strong>
        </div>
      </div>

      {/* Executive KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Allocated */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Total Allocated Budget</span>
            <PiggyBank className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {currencyMode === "USD" ? `$${kpiTotals.allocatedDisplay.toLocaleString()}` : `${kpiTotals.allocatedDisplay.toLocaleString()} TZS`}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Across {filteredBudgets.length} cost centers for FY {fiscalYear}
          </div>
        </div>

        {/* Actual Spend */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Actual Spend to Date</span>
            <Wallet className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {currencyMode === "USD" ? `$${kpiTotals.actualDisplay.toLocaleString()}` : `${kpiTotals.actualDisplay.toLocaleString()} TZS`}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Realized from trips, fuel logs &amp; maintenance
          </div>
        </div>

        {/* Remaining Variance */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Remaining Variance</span>
            {kpiTotals.isOverBudget ? (
              <TrendingDown className="h-4 w-4 text-rose-500" />
            ) : (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            )}
          </div>
          <div
            className={cn(
              "text-2xl font-black font-mono",
              kpiTotals.isOverBudget ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
            )}
          >
            {kpiTotals.isOverBudget ? "-" : "+"}
            {currencyMode === "USD"
              ? `$${Math.abs(kpiTotals.varianceDisplay).toLocaleString()}`
              : `${Math.abs(kpiTotals.varianceDisplay).toLocaleString()} TZS`}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {kpiTotals.isOverBudget ? "Budget Deficit / Overrun" : "Available operating surplus"}
          </div>
        </div>

        {/* Burn Rate & Velocity */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Burn Rate &amp; Health</span>
            {kpiTotals.isOverBudget ? (
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground font-mono">{kpiTotals.burnRatePct}%</span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-bold px-2 py-0.5",
                kpiTotals.isOverBudget
                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                  : kpiTotals.isNearLimit
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
              )}
            >
              {kpiTotals.isOverBudget ? "Over Budget" : kpiTotals.isNearLimit ? "Nearing Cap" : "Healthy Spend"}
            </Badge>
          </div>
          <Progress
            value={Math.min(100, kpiTotals.burnRatePct)}
            className={cn(
              "h-1.5",
              kpiTotals.isOverBudget
                ? "[&>div]:bg-rose-500"
                : kpiTotals.isNearLimit
                ? "[&>div]:bg-amber-500"
                : "[&>div]:bg-emerald-500"
            )}
          />
        </div>
      </div>

      {/* Claude-Style Guidance Callout */}
      {showHowItWorks && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 relative text-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>How company budgeting protects your freight and operating margins</span>
            </div>
            <button
              type="button"
              onClick={() => setShowHowItWorks(false)}
              className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
            >
              Dismiss
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 pt-3 border-t border-amber-500/15 text-muted-foreground leading-relaxed">
            <div>
              <strong className="text-foreground block mb-0.5">1. Cost Center Segregation</strong>
              Allocates dedicated operational caps for diesel, transit tolls, workshop repairs, and driver posho so one department cannot unexpectedly exhaust company cash reserves.
            </div>
            <div>
              <strong className="text-foreground block mb-0.5">2. Real-Time Operational Sync</strong>
              Actual expenditures are automatically pulled from active trip waybills, fuel station logs, and maintenance work orders—giving management instant visibility before overspending occurs.
            </div>
            <div>
              <strong className="text-foreground block mb-0.5">3. Commercial ERP Governance</strong>
              Compare gross client freight billings against actual departmental consumption to protect the company net profit margin on every logistics corridor.
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Department:</span>
          <button
            type="button"
            onClick={() => setDepartmentFilter("all")}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-medium transition-all border",
              departmentFilter === "all"
                ? "bg-foreground text-background border-foreground font-bold shadow-xs"
                : "bg-background text-muted-foreground hover:text-foreground border-border"
            )}
          >
            All Cost Centers ({budgets.length})
          </button>
          {departmentsList.map((dept) => (
            <button
              key={dept}
              type="button"
              onClick={() => setDepartmentFilter(dept)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-all border",
                departmentFilter === dept
                  ? "bg-foreground text-background border-foreground font-bold shadow-xs"
                  : "bg-background text-muted-foreground hover:text-foreground border-border"
              )}
            >
              {dept}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search budget item or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-background"
          />
        </div>
      </div>

      {/* Budget Allocation Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBudgets.map((b) => {
          const rate = currencyMode === "USD" ? USD_TO_TZS : 1;
          const allocated = Math.round(b.allocatedAmountTzs / rate);
          const actualTzs = getCategoryActual(b.category);
          const actual = Math.round(actualTzs / rate);
          const remaining = allocated - actual;
          const pct = allocated > 0 ? Math.round((actual / allocated) * 100) : 0;
          const isOver = remaining < 0;
          const isNear = pct >= b.alertThresholdPct && !isOver;

          // Department icon helper
          const getDeptIcon = (dept: string) => {
            if (dept.includes("Fuel")) return <Fuel className="h-4 w-4 text-amber-500" />;
            if (dept.includes("Logistics")) return <Route className="h-4 w-4 text-primary" />;
            if (dept.includes("Workshop")) return <Wrench className="h-4 w-4 text-emerald-500" />;
            if (dept.includes("Crew")) return <UserCheck className="h-4 w-4 text-sky-500" />;
            if (dept.includes("Compliance")) return <ShieldAlert className="h-4 w-4 text-purple-500" />;
            return <Building2 className="h-4 w-4 text-muted-foreground" />;
          };

          return (
            <div
              key={b.id}
              className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-2xs hover:border-primary/40 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getDeptIcon(b.department)}
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      {b.department}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5",
                      isOver
                        ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                        : isNear
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                    )}
                  >
                    {isOver ? `Over by ${pct - 100}%` : `${pct}% Used`}
                  </Badge>
                </div>

                <h3 className="text-base font-bold text-foreground leading-snug">{b.title}</h3>

                {b.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {b.notes}
                  </p>
                )}
              </div>

              {/* Progress and Numbers */}
              <div className="space-y-2.5 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Actual Spent:</span>
                  <span className="font-bold text-foreground font-mono">
                    {currencyMode === "USD" ? `$${actual.toLocaleString()}` : `${actual.toLocaleString()} TZS`}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Budget Cap:</span>
                  <span className="font-bold text-foreground font-mono">
                    {currencyMode === "USD" ? `$${allocated.toLocaleString()}` : `${allocated.toLocaleString()} TZS`}
                  </span>
                </div>

                <Progress
                  value={Math.min(100, pct)}
                  className={cn(
                    "h-2",
                    isOver ? "[&>div]:bg-rose-500" : isNear ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"
                  )}
                />

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-muted-foreground">Remaining:</span>
                  <span
                    className={cn(
                      "font-black font-mono",
                      isOver ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {isOver ? "-" : "+"}
                    {currencyMode === "USD"
                      ? `$${Math.abs(remaining).toLocaleString()}`
                      : `${Math.abs(remaining).toLocaleString()} TZS`}
                  </span>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditModal(b)}
                  className="h-8 text-xs font-semibold px-2.5"
                >
                  Adjust Allocation
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteBudget(b.id, b.title)}
                  className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 px-2"
                >
                  Remove
                </Button>
              </div>
            </div>
          );
        })}

        {filteredBudgets.length === 0 && (
          <div className="col-span-full py-12 text-center border border-dashed border-border rounded-2xl bg-card/40 space-y-3">
            <PiggyBank className="h-8 w-8 text-muted-foreground mx-auto" />
            <div className="text-sm font-bold text-foreground">No budget lines found</div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Create an operational budget allocation for this department or adjust your search filter.
            </p>
            <Button onClick={openCreateModal} size="sm" className="gap-1.5 font-bold">
              <Plus className="h-4 w-4" /> Add First Budget
            </Button>
          </div>
        )}
      </div>

      {/* Add / Edit Budget Allocation Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              {editingBudget ? "Adjust Budget Allocation" : "Allocate New Departmental Budget"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define the financial cap, cost center department, and alert notification thresholds for this fiscal period.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveBudget} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Budget Line Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Fuel & Diesel Procurement, Brake Linings Overhaul..."
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Department *</Label>
                <Select
                  value={form.department}
                  onValueChange={(v) => setForm({ ...form, department: v })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d} className="text-xs">
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category Link</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fuel" className="text-xs">Fuel & Energy</SelectItem>
                    <SelectItem value="tolls" className="text-xs">Statutory Tolls</SelectItem>
                    <SelectItem value="maintenance" className="text-xs">Maintenance & Parts</SelectItem>
                    <SelectItem value="posho" className="text-xs">Driver Safari Float</SelectItem>
                    <SelectItem value="tyres" className="text-xs">Tyres Lifecycle</SelectItem>
                    <SelectItem value="permits" className="text-xs">Permits & Insurance</SelectItem>
                    <SelectItem value="overhead" className="text-xs">Facilities & Admin</SelectItem>
                    <SelectItem value="contingency" className="text-xs">Contingency Reserve</SelectItem>
                    <SelectItem value="other" className="text-xs">Other / General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Budget Cap ({currencyMode}) *
                </Label>
                <Input
                  type="number"
                  step="any"
                  value={form.allocatedAmount}
                  onChange={(e) => setForm({ ...form, allocatedAmount: e.target.value })}
                  placeholder={currencyMode === "USD" ? "e.g. 50000" : "e.g. 150000000"}
                  className="h-9 text-xs font-mono font-bold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Alert Threshold (%)</Label>
                <Input
                  type="number"
                  min="50"
                  max="100"
                  value={form.alertThresholdPct}
                  onChange={(e) => setForm({ ...form, alertThresholdPct: e.target.value })}
                  placeholder="85"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Justification / Operational Notes</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Operational purpose, contract references, or justification for this spending limit..."
                className="text-xs resize-none"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="font-bold">
                {editingBudget ? "Save Adjustment" : "Allocate Budget"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
