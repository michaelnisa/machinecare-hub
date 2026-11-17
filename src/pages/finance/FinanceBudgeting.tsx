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
import { FinanceNavHeader } from "./FinanceNavHeader";
import { getFinancialOverview } from "@/services/financeService";
import { toast } from "sonner";
import {
  PiggyBank,
  Search,
  Plus,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Printer,
  Calendar,
  Wallet,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type BudgetPeriod = "daily" | "monthly" | "annual";

export interface BudgetItem {
  id: string;
  title: string;
  department: string;
  category: "fuel" | "tolls" | "maintenance" | "posho" | "tyres" | "permits" | "overhead" | "contingency" | "other";
  fiscalYear: number;
  periodType: BudgetPeriod;
  allocatedAmountTzs: number;
  alertThresholdPct: number;
  notes?: string;
  updatedAt?: string;
}

export interface DailyExpenseItem {
  id: string;
  source: "Fuel Log" | "Trip Expense" | "Workshop / Receipt";
  category: string;
  title: string;
  amount: number;
  time: string;
  plateNumber?: string;
  notes?: string;
}

const DEFAULT_DEPARTMENTS = [
  "Fleet Operations",
  "Freight Logistics",
  "Workshop & Engineering",
  "Crew Management",
  "Compliance & Permits",
  "Administration & Overhead",
];

const INITIAL_BUDGET_TEMPLATES: BudgetItem[] = [
  // Daily Allocations
  {
    id: "b-daily-fuel",
    title: "Daily Fleet Fuel Allocation",
    department: "Fleet Operations",
    category: "fuel",
    fiscalYear: 2026,
    periodType: "daily",
    allocatedAmountTzs: 1500000,
    alertThresholdPct: 85,
    notes: "Daily depot diesel fueling & en-route fuel cards cap.",
  },
  {
    id: "b-daily-posho",
    title: "Daily Driver Posho & Crew Allowance",
    department: "Crew Management",
    category: "posho",
    fiscalYear: 2026,
    periodType: "daily",
    allocatedAmountTzs: 400000,
    alertThresholdPct: 85,
    notes: "Daily driver meal allowances, turnboy allowances, and crew rest posho.",
  },
  {
    id: "b-daily-tolls",
    title: "Daily Transit Tolls & Corridors",
    department: "Freight Logistics",
    category: "tolls",
    fiscalYear: 2026,
    periodType: "daily",
    allocatedAmountTzs: 450000,
    alertThresholdPct: 85,
    notes: "Weighbridge fees, local municipal transit levies, and corridor access.",
  },
  {
    id: "b-daily-workshop",
    title: "Daily Workshop Petty Cash & Fixes",
    department: "Workshop & Engineering",
    category: "maintenance",
    fiscalYear: 2026,
    periodType: "daily",
    allocatedAmountTzs: 300000,
    alertThresholdPct: 80,
    notes: "Emergency quick tyre punctures, bulbs, air hoses, and minor grease fittings.",
  },
  {
    id: "b-daily-contingency",
    title: "Daily Incident & Road Buffer",
    department: "Freight Logistics",
    category: "contingency",
    fiscalYear: 2026,
    periodType: "daily",
    allocatedAmountTzs: 150000,
    alertThresholdPct: 75,
    notes: "Daily contingency reserve for unforeseen route delays or towing.",
  },
  // Monthly Allocations
  {
    id: "b-fuel-monthly",
    title: "Monthly Bulk Diesel Procurement",
    department: "Fleet Operations",
    category: "fuel",
    fiscalYear: 2026,
    periodType: "monthly",
    allocatedAmountTzs: 45000000,
    alertThresholdPct: 85,
    notes: "Bulk diesel supply from Puma/TotalEnergies.",
  },
  {
    id: "b-tolls-monthly",
    title: "Monthly Statutory Corridors & Tolls",
    department: "Freight Logistics",
    category: "tolls",
    fiscalYear: 2026,
    periodType: "monthly",
    allocatedAmountTzs: 13500000,
    alertThresholdPct: 85,
    notes: "Cross-border bridge tariffs, ZIMRA, RDA, and TANROADS tolls.",
  },
  {
    id: "b-maint-monthly",
    title: "Monthly Workshop Scheduled PM & Spares",
    department: "Workshop & Engineering",
    category: "maintenance",
    fiscalYear: 2026,
    periodType: "monthly",
    allocatedAmountTzs: 16000000,
    alertThresholdPct: 80,
    notes: "Oil, filter kits, brake linings, and preventative overhauls.",
  },
  {
    id: "b-tyres-monthly",
    title: "Monthly Tyre Replacements & Casings",
    department: "Workshop & Engineering",
    category: "tyres",
    fiscalYear: 2026,
    periodType: "monthly",
    allocatedAmountTzs: 8500000,
    alertThresholdPct: 80,
    notes: "315/80R22.5 steer and drive tyres.",
  },
  {
    id: "b-posho-monthly",
    title: "Monthly Driver Allowances & Trip Posho",
    department: "Crew Management",
    category: "posho",
    fiscalYear: 2026,
    periodType: "monthly",
    allocatedAmountTzs: 11000000,
    alertThresholdPct: 85,
    notes: "Line haul drivers, cross-border allowances, and turnboy stipends.",
  },
  {
    id: "b-overhead-monthly",
    title: "Monthly Yard, Depot & Office Operations",
    department: "Administration & Overhead",
    category: "overhead",
    fiscalYear: 2026,
    periodType: "monthly",
    allocatedAmountTzs: 5000000,
    alertThresholdPct: 85,
    notes: "Depot security, yard electricity, telematics, and operations staff.",
  },
  // Annual Allocations
  {
    id: "b-fuel-annual",
    title: "Annual Fleet Diesel Procurement",
    department: "Fleet Operations",
    category: "fuel",
    fiscalYear: 2026,
    periodType: "annual",
    allocatedAmountTzs: 520000000,
    alertThresholdPct: 85,
    notes: "Full year bulk diesel allocation.",
  },
  {
    id: "b-maint-annual",
    title: "Annual Heavy Maintenance & Overhauls",
    department: "Workshop & Engineering",
    category: "maintenance",
    fiscalYear: 2026,
    periodType: "annual",
    allocatedAmountTzs: 190000000,
    alertThresholdPct: 80,
    notes: "Annual major engine overhauls, gearbox repairs, and spare parts reserve.",
  },
];

const USD_TO_TZS = 2600;

export default function FinanceBudgeting() {
  const { organisation, user } = useAuth();
  const orgId = organisation?.id || "default_org";

  const [loading, setLoading] = useState(true);
  const [currencyMode, setCurrencyMode] = useState<"TZS" | "USD">("TZS");
  const [activeTab, setActiveTab] = useState<BudgetPeriod>("daily");
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  // Budgets state
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);

  // Operational actuals for full month/year
  const [overallActuals, setOverallActuals] = useState<{
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

  // Daily actuals & transactions for selectedDate
  const [dailyExpenses, setDailyExpenses] = useState<DailyExpenseItem[]>([]);
  const [dailyActuals, setDailyActuals] = useState<{
    fuel: number;
    posho: number;
    tolls: number;
    maintenance: number;
    contingency: number;
    other: number;
  }>({
    fuel: 0,
    posho: 0,
    tolls: 0,
    maintenance: 0,
    contingency: 0,
    other: 0,
  });

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [form, setForm] = useState({
    title: "",
    department: DEFAULT_DEPARTMENTS[0],
    category: "fuel" as BudgetItem["category"],
    periodType: "daily" as BudgetPeriod,
    allocatedAmount: "",
    alertThresholdPct: "85",
    notes: "",
  });

  // Format currency helper
  const fmtMoney = (tzsAmount: number) => {
    if (currencyMode === "USD") {
      const usd = Math.round(tzsAmount / USD_TO_TZS);
      return `$${usd.toLocaleString()}`;
    }
    return `${Math.round(tzsAmount).toLocaleString()} TZS`;
  };

  // Load budgets & operational actuals
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load budgets (localStorage + Supabase fallback)
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

      try {
        const { data: dbData } = await supabase
          .from("finance_budgets")
          .select("*")
          .eq("organisation_id", orgId);
        if (dbData && dbData.length > 0) {
          loadedBudgets = dbData.map((d: any) => ({
            id: d.id,
            title: d.title,
            department: d.department || "Fleet Operations",
            category: d.category || "fuel",
            fiscalYear: d.fiscal_year || 2026,
            periodType: (d.period_type || "daily") as BudgetPeriod,
            allocatedAmountTzs: Number(d.allocated_amount || 0),
            alertThresholdPct: Number(d.alert_threshold_pct || 85),
            notes: d.notes || "",
            updatedAt: d.updated_at,
          }));
        }
      } catch (err) {
        // Fall back to stored state
      }

      setBudgets(loadedBudgets);

      // 2. Load overview actuals
      if (organisation?.id) {
        const overview = await getFinancialOverview(organisation.id);
        setOverallActuals({
          fuel: overview.fuelTotalCost || 0,
          tolls: overview.tripExpensesTotal || 0,
          maintenance: overview.maintenanceTotalCost || 0,
          posho: Math.round((overview.tripExpensesTotal || 0) * 0.35),
          tyres: Math.round((overview.maintenanceTotalCost || 0) * 0.4),
          permits: Math.round((overview.totalExpenses || 0) * 0.08),
          overhead: Math.round((overview.totalExpenses || 0) * 0.07),
          contingency: Math.round((overview.totalExpenses || 0) * 0.05),
        });

        // 3. Load daily expenses for selectedDate
        await loadDailyExpenses(selectedDate);
      }
    } catch (e) {
      console.error("Error loading budgets:", e);
    } finally {
      setLoading(false);
    }
  };

  // Load specific daily expenses
  const loadDailyExpenses = async (dateStr: string) => {
    if (!organisation?.id) return;
    try {
      const items: DailyExpenseItem[] = [];
      let fuelSum = 0;
      let poshoSum = 0;
      let tollsSum = 0;
      let maintSum = 0;
      let contingencySum = 0;

      // Fuel Logs for date
      const { data: fuels } = await (supabase as any)
        .from("fuel_logs")
        .select("id, recorded_at, fuel_cost, fuel_litres, station, notes, machine_id, machines:machines(name, plate_number)")
        .eq("organisation_id", organisation.id)
        .gte("recorded_at", `${dateStr}T00:00:00`)
        .lte("recorded_at", `${dateStr}T23:59:59`);

      if (fuels && fuels.length > 0) {
        fuels.forEach((f: any) => {
          const cost = Number(f.fuel_cost || 0);
          fuelSum += cost;
          items.push({
            id: f.id,
            source: "Fuel Log",
            category: "fuel",
            title: `Fuel Dispense - ${f.station || "Depot"}`,
            amount: cost,
            time: f.recorded_at ? f.recorded_at.slice(11, 16) : "--:--",
            plateNumber: f.machines?.plate_number || f.machines?.name,
            notes: f.notes || (f.fuel_litres ? `${f.fuel_litres} Litres` : ""),
          });
        });
      }

      // Trip Expenses for date
      const { data: tripExps } = await (supabase as any)
        .from("trip_expenses")
        .select("id, expense_type, amount, occurred_at, notes, trips:trips(origin, destination)")
        .eq("organisation_id", organisation.id)
        .gte("occurred_at", `${dateStr}T00:00:00`)
        .lte("occurred_at", `${dateStr}T23:59:59`);

      if (tripExps && tripExps.length > 0) {
        tripExps.forEach((t: any) => {
          const cost = Number(t.amount || 0);
          const typeLower = (t.expense_type || "").toLowerCase();
          let cat = "other";
          if (typeLower.includes("posho") || typeLower.includes("meal") || typeLower.includes("allowance")) {
            poshoSum += cost;
            cat = "posho";
          } else if (typeLower.includes("toll") || typeLower.includes("gate") || typeLower.includes("corridor")) {
            tollsSum += cost;
            cat = "tolls";
          } else {
            contingencySum += cost;
            cat = "contingency";
          }

          items.push({
            id: t.id,
            source: "Trip Expense",
            category: cat,
            title: `Trip Expense (${t.expense_type || "Corridor"})`,
            amount: cost,
            time: t.occurred_at ? t.occurred_at.slice(11, 16) : "--:--",
            plateNumber: t.trips ? `${t.trips.origin} → ${t.trips.destination}` : undefined,
            notes: t.notes || "",
          });
        });
      }

      // Accountant Receipts for date
      const { data: receipts } = await (supabase as any)
        .from("accountant_receipts")
        .select("id, receipt_number, title, category, payee_name, amount, payment_date, notes")
        .eq("organisation_id", organisation.id)
        .eq("payment_date", dateStr);

      if (receipts && receipts.length > 0) {
        receipts.forEach((r: any) => {
          const cost = Number(r.amount || 0);
          maintSum += cost;
          items.push({
            id: r.id,
            source: "Workshop / Receipt",
            category: "maintenance",
            title: r.title || r.receipt_number || "Workshop Expense",
            amount: cost,
            time: "Direct",
            notes: r.payee_name ? `Payee: ${r.payee_name}` : r.notes || "",
          });
        });
      }

      setDailyExpenses(items);
      setDailyActuals({
        fuel: fuelSum,
        posho: poshoSum,
        tolls: tollsSum,
        maintenance: maintSum,
        contingency: contingencySum,
        other: 0,
      });
    } catch (err) {
      console.error("Error loading daily expenses:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, [orgId]);

  useEffect(() => {
    if (activeTab === "daily") {
      loadDailyExpenses(selectedDate);
    }
  }, [selectedDate, activeTab]);

  // Navigate Date
  const handleDateChange = (daysDelta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + daysDelta);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const isToday = selectedDate === new Date().toISOString().slice(0, 10);

  // Form handling
  const openCreateModal = () => {
    setEditingBudget(null);
    setForm({
      title: "",
      department: DEFAULT_DEPARTMENTS[0],
      category: "fuel",
      periodType: activeTab,
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
      periodType: b.periodType,
      allocatedAmount: String(displayAmount),
      alertThresholdPct: String(b.alertThresholdPct),
      notes: b.notes || "",
    });
    setModalOpen(true);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Budget title is required");
    const num = Number(form.allocatedAmount.replace(/,/g, ""));
    if (isNaN(num) || num <= 0) return toast.error("Please enter a valid amount");

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
              periodType: form.periodType,
              allocatedAmountTzs: amountInTzs,
              alertThresholdPct: Number(form.alertThresholdPct) || 85,
              notes: form.notes.trim(),
              updatedAt: new Date().toISOString(),
            }
          : b
      );
      toast.success(`Budget "${form.title}" updated`);
    } else {
      const newItem: BudgetItem = {
        id: `budget_${Date.now()}`,
        title: form.title.trim(),
        department: form.department,
        category: form.category,
        fiscalYear: 2026,
        periodType: form.periodType,
        allocatedAmountTzs: amountInTzs,
        alertThresholdPct: Number(form.alertThresholdPct) || 85,
        notes: form.notes.trim(),
        updatedAt: new Date().toISOString(),
      };
      updated = [newItem, ...budgets];
      toast.success(`Budget "${form.title}" added`);
    }

    setBudgets(updated);
    localStorage.setItem(`company_budgets_${orgId}`, JSON.stringify(updated));

    try {
      await supabase.from("finance_budgets").upsert({
        id: editingBudget ? editingBudget.id : undefined,
        organisation_id: orgId,
        title: form.title.trim(),
        department: form.department,
        category: form.category,
        fiscal_year: 2026,
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

  const handleDeleteBudget = (id: string, title: string) => {
    if (!confirm(`Delete budget line "${title}"?`)) return;
    const updated = budgets.filter((b) => b.id !== id);
    setBudgets(updated);
    localStorage.setItem(`company_budgets_${orgId}`, JSON.stringify(updated));
    toast.success(`Budget line "${title}" removed`);
  };

  // Helper to determine actual spend for each budget item
  const getItemActualSpend = (b: BudgetItem): number => {
    if (activeTab === "daily") {
      switch (b.category) {
        case "fuel":
          return dailyActuals.fuel;
        case "posho":
          return dailyActuals.posho;
        case "tolls":
          return dailyActuals.tolls;
        case "maintenance":
          return dailyActuals.maintenance;
        case "contingency":
          return dailyActuals.contingency;
        default:
          return 0;
      }
    } else if (activeTab === "monthly") {
      switch (b.category) {
        case "fuel":
          return Math.round(overallActuals.fuel / 12);
        case "tolls":
          return Math.round(overallActuals.tolls / 12);
        case "maintenance":
          return Math.round(overallActuals.maintenance / 12);
        case "posho":
          return Math.round(overallActuals.posho / 12);
        case "tyres":
          return Math.round(overallActuals.tyres / 12);
        case "permits":
          return Math.round(overallActuals.permits / 12);
        case "overhead":
          return Math.round(overallActuals.overhead / 12);
        default:
          return Math.round(overallActuals.contingency / 12);
      }
    } else {
      switch (b.category) {
        case "fuel":
          return overallActuals.fuel;
        case "tolls":
          return overallActuals.tolls;
        case "maintenance":
          return overallActuals.maintenance;
        case "posho":
          return overallActuals.posho;
        case "tyres":
          return overallActuals.tyres;
        case "permits":
          return overallActuals.permits;
        case "overhead":
          return overallActuals.overhead;
        default:
          return overallActuals.contingency;
      }
    }
  };

  // Filter budgets for active tab
  const displayedBudgets = useMemo(() => {
    return budgets.filter((b) => {
      if (b.periodType !== activeTab) return false;
      if (departmentFilter !== "all" && b.department !== departmentFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        b.title.toLowerCase().includes(q) ||
        b.department.toLowerCase().includes(q) ||
        (b.notes && b.notes.toLowerCase().includes(q))
      );
    });
  }, [budgets, activeTab, departmentFilter, search]);

  // Aggregate KPIs
  const kpiTotals = useMemo(() => {
    const totalAllocated = displayedBudgets.reduce((sum, b) => sum + b.allocatedAmountTzs, 0);
    const totalActual = displayedBudgets.reduce((sum, b) => sum + getItemActualSpend(b), 0);
    const variance = totalAllocated - totalActual;
    const isOver = variance < 0;
    const burnPct = totalAllocated > 0 ? Math.round((totalActual / totalAllocated) * 100) : 0;

    return {
      allocated: totalAllocated,
      actual: totalActual,
      variance,
      isOver,
      burnPct,
    };
  }, [displayedBudgets, dailyActuals, overallActuals, activeTab]);

  if (loading) {
    return <PageLoader message="Loading budget allocations..." />;
  }

  return (
    <div className="space-y-6">
      {/* Clean Top Header */}
      <FinanceNavHeader
        title="Budgeting"
        subtitle="Manage daily fleet operating allowances, monthly limits, and company expenditure caps."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Currency Switcher */}
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5 text-xs">
              {(["TZS", "USD"] as const).map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setCurrencyMode(curr)}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-bold transition-all text-xs",
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
              className="gap-1.5 text-xs"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>

            <Button onClick={openCreateModal} size="sm" className="gap-1.5 font-bold shadow-xs">
              <Plus className="h-4 w-4" /> Allocate Budget
            </Button>
          </div>
        }
      />

      {/* Primary Period View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 border border-border p-2 rounded-xl">
        <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg p-1">
          <button
            type="button"
            onClick={() => setActiveTab("daily")}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all",
              activeTab === "daily"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Clock className="h-3.5 w-3.5" /> Daily Budgeting
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("monthly")}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all",
              activeTab === "monthly"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Calendar className="h-3.5 w-3.5" /> Monthly
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("annual")}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all",
              activeTab === "annual"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Building2 className="h-3.5 w-3.5" /> Full Year (2026)
          </button>
        </div>

        {/* Date Selector for Daily View */}
        {activeTab === "daily" && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleDateChange(-1)}
              title="Previous Day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 w-36 text-xs font-bold bg-background"
            />

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleDateChange(1)}
              title="Next Day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {!isToday && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs font-bold text-primary"
                onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
              >
                Today
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 4 Clean Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Allocated Budget */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {activeTab === "daily" ? "Today's Budget Cap" : activeTab === "monthly" ? "Monthly Budget" : "Annual Budget"}
            </span>
            <PiggyBank className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {fmtMoney(kpiTotals.allocated)}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {activeTab === "daily" ? `Allocated for ${selectedDate}` : `Total approved limit`}
          </p>
        </div>

        {/* Actual Spend */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {activeTab === "daily" ? "Spent Today" : "Actual Spend"}
            </span>
            <Wallet className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {fmtMoney(kpiTotals.actual)}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {activeTab === "daily" ? `Logged across trips & fuel` : `Recorded expenses to date`}
          </p>
        </div>

        {/* Remaining Variance */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Remaining Balance</span>
            {kpiTotals.isOver ? (
              <TrendingDown className="h-4 w-4 text-rose-500" />
            ) : (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            )}
          </div>
          <div
            className={cn(
              "text-2xl font-black font-mono",
              kpiTotals.isOver ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
            )}
          >
            {kpiTotals.isOver ? "-" : "+"}
            {fmtMoney(Math.abs(kpiTotals.variance))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {kpiTotals.isOver ? "Over budget cap" : "Available operating funds"}
          </p>
        </div>

        {/* Status / Burn Rate */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Budget Health</span>
            {kpiTotals.isOver ? (
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground font-mono">{kpiTotals.burnPct}%</span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-bold px-2 py-0.5",
                kpiTotals.isOver
                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                  : kpiTotals.burnPct >= 80
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
              )}
            >
              {kpiTotals.isOver ? "Over Budget" : kpiTotals.burnPct >= 80 ? "Nearing Cap" : "Healthy"}
            </Badge>
          </div>
          <Progress
            value={Math.min(100, kpiTotals.burnPct)}
            className={cn(
              "h-1.5",
              kpiTotals.isOver ? "[&>div]:bg-rose-500" : kpiTotals.burnPct >= 80 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"
            )}
          />
        </div>
      </div>

      {/* Cost Center Allocations List */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-foreground">
              {activeTab === "daily" ? "Daily Department Allocations" : activeTab === "monthly" ? "Monthly Department Budgets" : "Annual Department Allocations"}
            </h2>
            <Badge variant="secondary" className="text-xs font-bold">
              {displayedBudgets.length}
            </Badge>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search category or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-background"
            />
          </div>
        </div>

        {displayedBudgets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center bg-card">
            <PiggyBank className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
            <h3 className="text-sm font-bold text-foreground">No budgets configured for this period</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Click the button below to allocate a budget for this period.
            </p>
            <Button onClick={openCreateModal} size="sm" className="mt-4 gap-1.5 font-bold">
              <Plus className="h-4 w-4" /> Add Budget
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayedBudgets.map((b) => {
              const allocated = b.allocatedAmountTzs;
              const actual = getItemActualSpend(b);
              const remaining = allocated - actual;
              const pct = allocated > 0 ? Math.round((actual / allocated) * 100) : 0;
              const isOver = remaining < 0;

              return (
                <div
                  key={b.id}
                  className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between space-y-3 shadow-2xs hover:border-primary/40 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        {b.department}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-bold px-1.5 py-0",
                          isOver
                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                            : pct >= b.alertThresholdPct
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                        )}
                      >
                        {isOver ? "Over Budget" : `${pct}%`}
                      </Badge>
                    </div>

                    <h3 className="text-sm font-bold text-foreground">{b.title}</h3>
                    {b.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{b.notes}</p>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-border/60">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Spent:</span>
                      <span className="font-bold font-mono text-foreground">{fmtMoney(actual)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Budget Cap:</span>
                      <span className="font-bold font-mono text-foreground">{fmtMoney(allocated)}</span>
                    </div>

                    <Progress
                      value={Math.min(100, pct)}
                      className={cn(
                        "h-1.5",
                        isOver ? "[&>div]:bg-rose-500" : pct >= b.alertThresholdPct ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"
                      )}
                    />

                    <div className="flex items-center justify-between text-xs pt-0.5">
                      <span className="text-muted-foreground">Remaining:</span>
                      <span
                        className={cn(
                          "font-bold font-mono",
                          isOver ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {isOver ? "-" : "+"}
                        {fmtMoney(Math.abs(remaining))}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/40">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(b)}
                      className="h-7 text-xs font-medium px-2"
                    >
                      Adjust
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteBudget(b.id, b.title)}
                      className="h-7 text-xs font-medium text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 px-2"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* In Daily Mode: Today's Actual Expenses Breakdown */}
      {activeTab === "daily" && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Actual Expenses for {selectedDate}
              </h2>
              <p className="text-xs text-muted-foreground">
                Live fuel fill-ups, driver posho, toll fees, and workshop vouchers recorded on this date.
              </p>
            </div>
            <span className="text-xs font-bold text-foreground font-mono">
              Total: {fmtMoney(dailyExpenses.reduce((sum, e) => sum + e.amount, 0))}
            </span>
          </div>

          {dailyExpenses.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
              No expenses recorded for this date yet. Daily operating budget remains fully available.
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Vehicle / Route</th>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {dailyExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 font-semibold">
                          <Badge variant="outline" className="text-[10px] font-bold">
                            {exp.source}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-foreground">{exp.title}</span>
                          {exp.notes && (
                            <span className="block text-[11px] text-muted-foreground">{exp.notes}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground font-mono">
                          {exp.plateNumber || "--"}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {exp.time}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold font-mono text-foreground">
                          {fmtMoney(exp.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Simple, User-Friendly Budget Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBudget ? "Adjust Budget Allocation" : "Allocate New Budget"}
            </DialogTitle>
            <DialogDescription>
              Set spending limits for daily operations or monthly departmental cost centers.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveBudget} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Budget Title *</Label>
              <Input
                placeholder="e.g. Daily Fuel Cap or Monthly Workshop"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Budget Period</Label>
                <Select
                  value={form.periodType}
                  onValueChange={(v: BudgetPeriod) => setForm({ ...form, periodType: v })}
                >
                  <SelectTrigger className="text-xs bg-background">
                    <SelectValue placeholder="Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily Budget</SelectItem>
                    <SelectItem value="monthly">Monthly Budget</SelectItem>
                    <SelectItem value="annual">Full Year Budget</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Cost Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v: any) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger className="text-xs bg-background">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fuel">Fuel & Diesel</SelectItem>
                    <SelectItem value="posho">Driver Posho & Meals</SelectItem>
                    <SelectItem value="tolls">Tolls & Corridors</SelectItem>
                    <SelectItem value="maintenance">Workshop & Repairs</SelectItem>
                    <SelectItem value="tyres">Tyres & Casings</SelectItem>
                    <SelectItem value="permits">Permits & Compliance</SelectItem>
                    <SelectItem value="overhead">Depot & Operations</SelectItem>
                    <SelectItem value="contingency">Incident Contingency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Department</Label>
              <Select
                value={form.department}
                onValueChange={(v) => setForm({ ...form, department: v })}
              >
                <SelectTrigger className="text-xs bg-background">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">
                Allocated Amount ({currencyMode}) *
              </Label>
              <Input
                type="number"
                placeholder={currencyMode === "USD" ? "e.g. 500" : "e.g. 1500000"}
                value={form.allocatedAmount}
                onChange={(e) => setForm({ ...form, allocatedAmount: e.target.value })}
                className="text-xs font-mono font-bold"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Notes / Description (Optional)</Label>
              <Textarea
                placeholder="Brief purpose of this budget..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="text-xs resize-none"
                rows={2}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="font-bold">
                {editingBudget ? "Save Changes" : "Create Budget"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
