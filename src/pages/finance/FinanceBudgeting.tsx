import { useEffect, useState, useMemo, useRef } from "react";
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
import { DailyBudgetLedger } from "@/components/finance/DailyBudgetLedger";
import { getFinancialOverview } from "@/services/financeService";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
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
  Download,
  FileSpreadsheet,
  ArrowRightLeft,
  Edit,
  Trash2,
  Layers,
  LayoutGrid,
  Table as TableIcon,
  SlidersHorizontal,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type BudgetPeriod = "daily" | "monthly" | "annual";
export type BudgetFilter = "all" | "daily" | "monthly" | "annual";

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

const MONTHS_LIST = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
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
  const { organisation, user, profile } = useAuth();
  const orgId = organisation?.id || "default_org";

  const [loading, setLoading] = useState(true);
  const [currencyMode, setCurrencyMode] = useState<"TZS" | "USD">("TZS");
  // Default to 'all' so that clicking budget shows ALL budgets right away
  const [activeTab, setActiveTab] = useState<BudgetFilter>("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState<"all" | "at_risk">("all");

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

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [form, setForm] = useState({
    title: "",
    department: DEFAULT_DEPARTMENTS[0],
    category: "fuel" as BudgetItem["category"],
    periodType: "monthly" as BudgetPeriod,
    allocatedAmount: "",
    alertThresholdPct: "85",
    notes: "",
  });

  // Transfer Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    sourceId: "",
    destinationId: "",
    amount: "",
    reason: "",
  });

  // Professional Report Preview & Edit Modal State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Editable Report Metadata with Monthly selection
  const [reportMeta, setReportMeta] = useState({
    reportType: "monthly" as "all" | "monthly" | "daily" | "annual",
    selectedMonth: "November",
    selectedYear: 2026,
    title: "MONTHLY BUDGET PERFORMANCE REPORT - NOVEMBER 2026",
    preparedBy: profile?.full_name || "Finance & Accounts Department",
    reviewedBy: "Financial Controller",
    approvedBy: "Managing Director / CFO",
    notes: "Official monthly operating budget allocations vs. actual expenditures.",
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
            periodType: (d.period_type || "monthly") as BudgetPeriod,
            allocatedAmountTzs: Number(d.allocated_amount || 0),
            alertThresholdPct: Number(d.alert_threshold_pct || 85),
            notes: d.notes || "",
            updatedAt: d.updated_at,
          }));
        }
      } catch (err) {}

      setBudgets(loadedBudgets);

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

  // Form handling (Create / Edit)
  const openCreateModal = () => {
    setEditingBudget(null);
    setForm({
      title: "",
      department: DEFAULT_DEPARTMENTS[0],
      category: "fuel",
      periodType: activeTab === "all" ? "monthly" : activeTab,
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
      toast.success(`Budget "${form.title}" updated successfully`);
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
      toast.success(`Budget "${form.title}" allocated successfully`);
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
    if (!confirm(`Are you sure you want to delete budget line "${title}"?`)) return;
    const updated = budgets.filter((b) => b.id !== id);
    setBudgets(updated);
    localStorage.setItem(`company_budgets_${orgId}`, JSON.stringify(updated));
    toast.success(`Budget line "${title}" removed`);
  };

  // Helper to determine actual spend for each budget item
  const getItemActualSpend = (b: BudgetItem, periodOverride?: BudgetFilter): number => {
    const period = periodOverride || b.periodType;
    if (period === "daily") {
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
    } else if (period === "monthly") {
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

  // Filter budgets for active tab & risk filter
  const displayedBudgets = useMemo(() => {
    return budgets.filter((b) => {
      // If activeTab is 'all', show ALL budgets!
      if (activeTab !== "all" && b.periodType !== activeTab) return false;
      if (departmentFilter !== "all" && b.department !== departmentFilter) return false;

      // Risk Filter check
      if (riskFilter === "at_risk") {
        const allocated = b.allocatedAmountTzs;
        const actual = getItemActualSpend(b);
        const pct = allocated > 0 ? (actual / allocated) * 100 : 0;
        if (pct < b.alertThresholdPct && actual <= allocated) return false;
      }

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        b.title.toLowerCase().includes(q) ||
        b.department.toLowerCase().includes(q) ||
        b.periodType.toLowerCase().includes(q) ||
        (b.notes && b.notes.toLowerCase().includes(q))
      );
    });
  }, [budgets, activeTab, departmentFilter, riskFilter, search, dailyActuals, overallActuals]);

  // Aggregate KPIs for Dashboard
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
  }, [displayedBudgets, dailyActuals, overallActuals]);

  // Handle Budget Reallocation (Virement)
  const openTransferModal = () => {
    setTransferForm({
      sourceId: budgets[0]?.id || "",
      destinationId: budgets[1]?.id || "",
      amount: "",
      reason: "",
    });
    setTransferModalOpen(true);
  };

  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const { sourceId, destinationId, amount, reason } = transferForm;
    if (!sourceId || !destinationId) return toast.error("Please select source and destination budgets");
    if (sourceId === destinationId) return toast.error("Source and destination must be different cost centers");
    const num = Number(amount.replace(/,/g, ""));
    if (isNaN(num) || num <= 0) return toast.error("Enter a valid transfer amount");

    const amountInTzs = currencyMode === "USD" ? Math.round(num * USD_TO_TZS) : num;

    const source = budgets.find((b) => b.id === sourceId);
    const destination = budgets.find((b) => b.id === destinationId);
    if (!source || !destination) return toast.error("Selected budget line not found");

    if (source.allocatedAmountTzs < amountInTzs) {
      return toast.error(`Source budget only has ${fmtMoney(source.allocatedAmountTzs)} allocated.`);
    }

    const updated = budgets.map((b) => {
      if (b.id === sourceId) {
        return {
          ...b,
          allocatedAmountTzs: b.allocatedAmountTzs - amountInTzs,
          notes: `${b.notes || ""} [Transferred -${fmtMoney(amountInTzs)} to ${destination.title}: ${reason}]`.trim(),
          updatedAt: new Date().toISOString(),
        };
      }
      if (b.id === destinationId) {
        return {
          ...b,
          allocatedAmountTzs: b.allocatedAmountTzs + amountInTzs,
          notes: `${b.notes || ""} [Received +${fmtMoney(amountInTzs)} from ${source.title}: ${reason}]`.trim(),
          updatedAt: new Date().toISOString(),
        };
      }
      return b;
    });

    setBudgets(updated);
    localStorage.setItem(`company_budgets_${orgId}`, JSON.stringify(updated));
    toast.success(`Successfully transferred ${fmtMoney(amountInTzs)} from "${source.title}" to "${destination.title}"`);
    setTransferModalOpen(false);
  };

  // Open Report Modal & configure
  const handleOpenReportModal = (type: "monthly" | "all" | "daily" = "monthly") => {
    const month = reportMeta.selectedMonth || "November";
    const year = reportMeta.selectedYear || 2026;
    setReportMeta((prev) => ({
      ...prev,
      reportType: type,
      title:
        type === "monthly"
          ? `MONTHLY BUDGET PERFORMANCE REPORT - ${month.toUpperCase()} ${year}`
          : type === "daily"
          ? `DAILY BUDGET PERFORMANCE REPORT - ${selectedDate}`
          : `EXECUTIVE BUDGET PERFORMANCE & VARIANCE REPORT (FY ${year})`,
    }));
    setReportModalOpen(true);
  };

  // Filter budgets for the Report Sheet specifically
  const reportBudgets = useMemo(() => {
    if (reportMeta.reportType === "monthly") {
      // Monthly report shows all monthly lines, and pro-rated annual lines
      return budgets.filter((b) => b.periodType === "monthly" || b.periodType === "annual");
    } else if (reportMeta.reportType === "daily") {
      return budgets.filter((b) => b.periodType === "daily");
    } else if (reportMeta.reportType === "annual") {
      return budgets.filter((b) => b.periodType === "annual");
    }
    return budgets;
  }, [budgets, reportMeta.reportType]);

  // Report KPIs specifically
  const reportTotals = useMemo(() => {
    const totalAllocated = reportBudgets.reduce((sum, b) => {
      if (reportMeta.reportType === "monthly" && b.periodType === "annual") {
        return sum + Math.round(b.allocatedAmountTzs / 12);
      }
      return sum + b.allocatedAmountTzs;
    }, 0);

    const totalActual = reportBudgets.reduce((sum, b) => {
      return sum + getItemActualSpend(b, reportMeta.reportType === "monthly" ? "monthly" : undefined);
    }, 0);

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
  }, [reportBudgets, reportMeta.reportType, dailyActuals, overallActuals]);

  // Export CSV
  const handleExportCsv = () => {
    const rows = [
      ["Department", "Budget Title", "Period", "Approved Budget (TZS)", "Actual Spend (TZS)", "Variance (TZS)", "Burn Rate (%)", "Status"],
      ...reportBudgets.map((b) => {
        const allocated = reportMeta.reportType === "monthly" && b.periodType === "annual" ? Math.round(b.allocatedAmountTzs / 12) : b.allocatedAmountTzs;
        const actual = getItemActualSpend(b, reportMeta.reportType === "monthly" ? "monthly" : undefined);
        const remaining = allocated - actual;
        const pct = allocated > 0 ? Math.round((actual / allocated) * 100) : 0;
        const status = remaining < 0 ? "OVER BUDGET" : pct >= b.alertThresholdPct ? "NEARING CAP" : "WITHIN BUDGET";
        return [
          `"${b.department}"`,
          `"${b.title}"`,
          `"${b.periodType.toUpperCase()}"`,
          allocated,
          actual,
          remaining,
          `${pct}%`,
          `"${status}"`,
        ];
      }),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const filename = reportMeta.reportType === "monthly"
      ? `Monthly_Budget_Report_${reportMeta.selectedMonth}_${reportMeta.selectedYear}.csv`
      : `Budget_Report_${reportMeta.reportType}_2026.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV report downloaded successfully");
  };

  // Download PDF Report
  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setGeneratingPdf(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      const filename = reportMeta.reportType === "monthly"
        ? `Monthly_Budget_Report_${reportMeta.selectedMonth}_${reportMeta.selectedYear}.pdf`
        : `Executive_Budget_Report_${reportMeta.reportType}_2026.pdf`;
      pdf.save(filename);
      toast.success("Executive PDF report downloaded successfully!");
    } catch (err: any) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate PDF: " + (err?.message || "Unknown error"));
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Print Isolated Document
  const handlePrintDocument = () => {
    window.print();
  };

  const companyName = organisation?.name || "MACHINECARE FLEET & LOGISTICS LIMITED";
  const companyLogo = organisation?.logo_url || null;
  const reportRefNumber = `RPT-BGT-${reportMeta.reportType.toUpperCase()}-${reportMeta.selectedYear}-01`;

  if (loading) {
    return <PageLoader message="Loading budget allocations..." />;
  }

  return (
    <div className="space-y-6">
      {/* Isolated Print CSS: When printing, hides EVERYTHING except #budget-report-sheet */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #budget-report-sheet,
          #budget-report-sheet * {
            visibility: visible !important;
          }
          #budget-report-sheet {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            max-width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 15mm 20mm !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: #0f172a !important;
            z-index: 9999999 !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }
      `}</style>

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

            {/* Quick Reallocation / Transfer */}
            <Button
              variant="outline"
              size="sm"
              onClick={openTransferModal}
              className="gap-1.5 text-xs"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" /> Transfer Funds
            </Button>

            {/* Download Monthly Report Direct Trigger */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenReportModal("monthly")}
              className="gap-1.5 text-xs border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 font-bold"
            >
              <Calendar className="h-3.5 w-3.5" /> Download Monthly Report
            </Button>

            {/* Professional Report Studio Trigger */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenReportModal(activeTab === "all" ? "monthly" : activeTab)}
              className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/5 font-bold"
            >
              <Download className="h-3.5 w-3.5" /> Download Report
            </Button>

            <Button onClick={openCreateModal} size="sm" className="gap-1.5 font-bold shadow-xs">
              <Plus className="h-4 w-4" /> Allocate Budget
            </Button>
          </div>
        }
      />

      {/* Primary Period View Switcher: Shows 'All Budgets' first! */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 border border-border p-2 rounded-xl">
        <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg p-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab("all");
              setRiskFilter("all");
            }}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all",
              activeTab === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="h-3.5 w-3.5" /> All Budgets ({budgets.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("daily");
              setRiskFilter("all");
            }}
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
            onClick={() => {
              setActiveTab("monthly");
              setRiskFilter("all");
            }}
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
            onClick={() => {
              setActiveTab("annual");
              setRiskFilter("all");
            }}
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
        {activeTab === "daily" ? (
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
        ) : (
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={cn(
                "p-1.5 rounded-md text-xs transition-all",
                viewMode === "cards" ? "bg-muted text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
              )}
              title="Card View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "p-1.5 rounded-md text-xs transition-all",
                viewMode === "table" ? "bg-muted text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
              )}
              title="Table View"
            >
              <TableIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 4 Clean Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Allocated Budget */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {activeTab === "daily" ? "Today's Budget Cap" : activeTab === "monthly" ? "Monthly Budget" : activeTab === "annual" ? "Annual Budget" : "Total Approved Budgets"}
            </span>
            <PiggyBank className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {fmtMoney(kpiTotals.allocated)}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {activeTab === "daily" ? `Allocated for ${selectedDate}` : `Across ${displayedBudgets.length} cost centers`}
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
            {activeTab === "daily" ? `Logged across trips & fuel` : `Incurred operational expenditures`}
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
            {kpiTotals.isOver ? "Over budget cap" : "Available operating surplus"}
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
              {activeTab === "all"
                ? "All Department Budgets"
                : activeTab === "daily"
                ? "Daily Department Allocations"
                : activeTab === "monthly"
                ? "Monthly Department Budgets"
                : "Annual Department Allocations"}
            </h2>
            <Badge variant="secondary" className="text-xs font-bold">
              {displayedBudgets.length}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Risk Filter */}
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setRiskFilter("all")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-semibold text-xs transition-all",
                  riskFilter === "all" ? "bg-muted text-foreground font-bold" : "text-muted-foreground"
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setRiskFilter("at_risk")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-semibold text-xs transition-all flex items-center gap-1",
                  riskFilter === "at_risk" ? "bg-rose-500/20 text-rose-700 dark:text-rose-400 font-bold" : "text-muted-foreground hover:text-rose-600"
                )}
              >
                <AlertTriangle className="h-3 w-3" /> Near / Over Cap
              </button>
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search budget or notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>
          </div>
        </div>

        {displayedBudgets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center bg-card">
            <PiggyBank className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
            <h3 className="text-sm font-bold text-foreground">No budgets match your criteria</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {riskFilter === "at_risk" ? "All of your budget lines are currently within approved limits." : "Click below to allocate a budget line."}
            </p>
            {riskFilter === "at_risk" ? (
              <Button onClick={() => setRiskFilter("all")} variant="outline" size="sm" className="mt-4">
                View All Budgets
              </Button>
            ) : (
              <Button onClick={openCreateModal} size="sm" className="mt-4 gap-1.5 font-bold">
                <Plus className="h-4 w-4" /> Add Budget
              </Button>
            )}
          </div>
        ) : viewMode === "table" ? (
          /* Table View for High-Density Budget Inspection */
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Budget Line</th>
                    <th className="py-2.5 px-3">Cycle</th>
                    <th className="py-2.5 px-3 text-right">Budget Cap</th>
                    <th className="py-2.5 px-3 text-right">Spent</th>
                    <th className="py-2.5 px-3 text-right">Remaining</th>
                    <th className="py-2.5 px-3 text-center">Burn %</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayedBudgets.map((b) => {
                    const allocated = b.allocatedAmountTzs;
                    const actual = getItemActualSpend(b);
                    const remaining = allocated - actual;
                    const pct = allocated > 0 ? Math.round((actual / allocated) * 100) : 0;
                    const isOver = remaining < 0;

                    return (
                      <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-muted-foreground">{b.department}</td>
                        <td className="py-2.5 px-3 font-bold text-foreground">
                          {b.title}
                          {b.notes && <span className="block text-[11px] font-normal text-muted-foreground">{b.notes}</span>}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className="text-[10px] font-bold uppercase">
                            {b.periodType}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                          {fmtMoney(allocated)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-foreground">
                          {fmtMoney(actual)}
                        </td>
                        <td
                          className={cn(
                            "py-2.5 px-3 text-right font-mono font-bold",
                            isOver ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {isOver ? "-" : "+"}
                          {fmtMoney(Math.abs(remaining))}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold">
                          {pct}%
                        </td>
                        <td className="py-2.5 px-3 text-center">
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
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(b)}
                              className="h-7 text-xs font-semibold px-2"
                            >
                              <Edit className="h-3 w-3 mr-1" /> Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteBudget(b.id, b.title)}
                              className="h-7 w-7 text-rose-500 hover:text-rose-600"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
        ) : (
          /* Cards View */
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
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                          {b.department}
                        </span>
                        <Badge variant="outline" className="text-[9px] uppercase font-bold px-1.5 py-0">
                          {b.periodType}
                        </Badge>
                      </div>
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
                      className="h-7 text-xs font-semibold px-2"
                    >
                      <Edit className="h-3 w-3 mr-1" /> Edit Budget
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

      {/* In Daily Mode: Today's Actual Expenses Breakdown & Exact 10-Column Disbursement Ledger */}
      {activeTab === "daily" && (
        <div className="space-y-6 pt-2">
          {/* Exact 10-Column Daily Budget Ledger */}
          <DailyBudgetLedger
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />

          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Automated Fleet Telematics & Trip Expenses ({selectedDate})
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
      </div>
    )}

      {/* Edit / Create Budget Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBudget ? `Edit Budget: ${editingBudget.title}` : "Allocate New Budget"}
            </DialogTitle>
            <DialogDescription>
              {editingBudget
                ? "Update spending limits, department category, or notes for this budget line."
                : "Set spending limits for daily operations, monthly departmental cost centers, or annual targets."}
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

      {/* Budget Transfer / Reallocation Modal (Virement) */}
      <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" /> Transfer / Reallocate Funds
            </DialogTitle>
            <DialogDescription>
              Shift funds from one cost center to another to handle unexpected operational demands.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleExecuteTransfer} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Transfer From (Source Line) *</Label>
              <Select
                value={transferForm.sourceId}
                onValueChange={(v) => setTransferForm({ ...transferForm, sourceId: v })}
              >
                <SelectTrigger className="text-xs bg-background">
                  <SelectValue placeholder="Select Source Budget" />
                </SelectTrigger>
                <SelectContent>
                  {budgets.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.title} ({fmtMoney(b.allocatedAmountTzs)}) - {b.periodType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Transfer To (Destination Line) *</Label>
              <Select
                value={transferForm.destinationId}
                onValueChange={(v) => setTransferForm({ ...transferForm, destinationId: v })}
              >
                <SelectTrigger className="text-xs bg-background">
                  <SelectValue placeholder="Select Destination Budget" />
                </SelectTrigger>
                <SelectContent>
                  {budgets
                    .filter((b) => b.id !== transferForm.sourceId)
                    .map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.title} ({fmtMoney(b.allocatedAmountTzs)}) - {b.periodType}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Amount to Transfer ({currencyMode}) *</Label>
              <Input
                type="number"
                placeholder={currencyMode === "USD" ? "e.g. 200" : "e.g. 500000"}
                value={transferForm.amount}
                onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                className="text-xs font-mono font-bold"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Reason for Reallocation *</Label>
              <Input
                placeholder="e.g. Additional diesel required for copper transit"
                value={transferForm.reason}
                onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                className="text-xs"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTransferModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="font-bold">
                Confirm Transfer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Professional Report Studio & Isolated Print / PDF Exporter */}
      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0">
          {/* Header Controls Bar */}
          <div className="p-4 border-b border-border bg-muted/40 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10 backdrop-blur-md">
            <div>
              <h3 className="text-base font-bold text-foreground">
                {reportMeta.reportType === "monthly" ? "Monthly Budget Performance Report" : "Executive Budget Report"}
              </h3>
              <p className="text-xs text-muted-foreground">
                Official company letterhead with company logo, cost center allocations, and corporate sign-offs.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="gap-1.5 text-xs"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Export CSV
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintDocument}
                className="gap-1.5 text-xs font-bold"
              >
                <Printer className="h-3.5 w-3.5" /> Print Report
              </Button>

              <Button
                size="sm"
                onClick={handleDownloadPdf}
                disabled={generatingPdf}
                className="gap-1.5 text-xs font-bold bg-primary text-primary-foreground"
              >
                <Download className="h-3.5 w-3.5" />
                {generatingPdf ? "Generating PDF..." : "Download PDF"}
              </Button>
            </div>
          </div>

          {/* Report Customization / Editing Panel */}
          <div className="p-4 bg-muted/20 border-b border-border space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> Report Scope &amp; Customization:
              </div>

              {/* Report Scope Switcher */}
              <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-0.5 text-xs">
                {(
                  [
                    { id: "monthly", label: "Monthly Report" },
                    { id: "daily", label: "Daily Report" },
                    { id: "all", label: "All Budgets" },
                  ] as const
                ).map((scope) => (
                  <button
                    key={scope.id}
                    type="button"
                    onClick={() => {
                      setReportMeta((prev) => ({
                        ...prev,
                        reportType: scope.id,
                        title:
                          scope.id === "monthly"
                            ? `MONTHLY BUDGET PERFORMANCE REPORT - ${prev.selectedMonth.toUpperCase()} ${prev.selectedYear}`
                            : scope.id === "daily"
                            ? `DAILY BUDGET PERFORMANCE REPORT - ${selectedDate}`
                            : `EXECUTIVE BUDGET PERFORMANCE & VARIANCE REPORT (FY ${prev.selectedYear})`,
                      }));
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-md font-semibold transition-all",
                      reportMeta.reportType === scope.id ? "bg-primary text-primary-foreground font-bold shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {scope.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* If Monthly: Show Month Selector */}
              {reportMeta.reportType === "monthly" && (
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground">Select Month</Label>
                  <Select
                    value={reportMeta.selectedMonth}
                    onValueChange={(m) => {
                      setReportMeta((prev) => ({
                        ...prev,
                        selectedMonth: m,
                        title: `MONTHLY BUDGET PERFORMANCE REPORT - ${m.toUpperCase()} ${prev.selectedYear}`,
                      }));
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs bg-background">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS_LIST.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m} {reportMeta.selectedYear}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className={cn("space-y-1", reportMeta.reportType === "monthly" ? "sm:col-span-3" : "sm:col-span-4")}>
                <Label className="text-[11px] font-semibold text-muted-foreground">Report Document Title</Label>
                <Input
                  value={reportMeta.title}
                  onChange={(e) => setReportMeta({ ...reportMeta, title: e.target.value })}
                  className="h-7 text-xs bg-background font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">Prepared By (Name / Title)</Label>
                <Input
                  value={reportMeta.preparedBy}
                  onChange={(e) => setReportMeta({ ...reportMeta, preparedBy: e.target.value })}
                  className="h-7 text-xs bg-background"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">Approved By (Director / CFO)</Label>
                <Input
                  value={reportMeta.approvedBy}
                  onChange={(e) => setReportMeta({ ...reportMeta, approvedBy: e.target.value })}
                  className="h-7 text-xs bg-background"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Executive Remarks / Audit Notes</Label>
              <Input
                value={reportMeta.notes}
                onChange={(e) => setReportMeta({ ...reportMeta, notes: e.target.value })}
                className="h-7 text-xs bg-background"
                placeholder="Remarks for board or finance review..."
              />
            </div>
          </div>

          {/* Printable A4 Report Preview Container */}
          <div className="p-6 bg-slate-100 dark:bg-slate-950 flex justify-center">
            <div
              ref={reportRef}
              id="budget-report-sheet"
              className="bg-white text-slate-900 p-8 shadow-xl rounded-md w-full max-w-3xl border border-slate-200 print:shadow-none print:border-none print:p-0 text-xs"
              style={{ minHeight: "1050px" }}
            >
              {/* Report Header Letterhead with Uploaded Company Logo */}
              <div className="border-b-2 border-slate-900 pb-4 mb-6">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-3">
                    {companyLogo ? (
                      <img
                        src={companyLogo}
                        alt={companyName}
                        className="h-12 max-w-[170px] object-contain"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div className="h-11 w-11 rounded-md bg-slate-900 flex items-center justify-center text-white font-black text-sm shrink-0">
                        {companyName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h1 className="text-base font-black tracking-tight text-slate-900 uppercase">
                        {companyName}
                      </h1>
                      <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
                        Commercial Fleet Operations &amp; Financial ERP
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-slate-900 text-white mb-1">
                      {reportMeta.reportType === "monthly" ? "Monthly Audit Report" : "Official Fiscal Report"}
                    </span>
                    <div className="text-[10px] font-mono text-slate-600">
                      Ref: <strong>{reportRefNumber}</strong>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Date: {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[11px]">
                  <div>
                    <span className="text-slate-500 font-medium">Document: </span>
                    <strong className="text-slate-900 uppercase">{reportMeta.title}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Reporting Currency: </span>
                    <strong className="text-slate-900">{currencyMode} (Peg: 1 USD = 2,600 TZS)</strong>
                  </div>
                </div>

                {reportMeta.notes && (
                  <div className="mt-2 text-[10px] text-slate-600 italic">
                    Note: {reportMeta.notes}
                  </div>
                )}
              </div>

              {/* Executive Summary Dashboard Box */}
              <div className="grid grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3.5 mb-6">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    {reportMeta.reportType === "monthly" ? `${reportMeta.selectedMonth} Budget Cap` : "Total Approved Budget"}
                  </div>
                  <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                    {fmtMoney(reportTotals.allocated)}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Approved Limit</div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    {reportMeta.reportType === "monthly" ? "Actual Monthly Spend" : "Actual Realized Spend"}
                  </div>
                  <div className="text-base font-black font-mono text-amber-700 mt-0.5">
                    {fmtMoney(reportTotals.actual)}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Operational Incurred</div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Net Variance
                  </div>
                  <div
                    className={cn(
                      "text-base font-black font-mono mt-0.5",
                      reportTotals.isOver ? "text-rose-700" : "text-emerald-700"
                    )}
                  >
                    {reportTotals.isOver ? "-" : "+"}
                    {fmtMoney(Math.abs(reportTotals.variance))}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">
                    {reportTotals.isOver ? "Budget Deficit" : "Operating Surplus"}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Fiscal Health
                  </div>
                  <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                    {reportTotals.burnPct}%
                  </div>
                  <div className="text-[9px] font-bold text-slate-600 mt-0.5">
                    {reportTotals.isOver ? "OVERRUN" : reportTotals.burnPct >= 80 ? "NEAR CAP" : "COMPLIANT"}
                  </div>
                </div>
              </div>

              {/* Departmental Cost Allocations Table */}
              <div className="mb-6">
                <div className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>1. {reportMeta.reportType === "monthly" ? `${reportMeta.selectedMonth} Departmental Cost Allocations & Variance` : "Cost Center Allocations & Variance Matrix"}</span>
                  <span className="text-[10px] text-slate-500 normal-case font-normal">
                    {reportBudgets.length} Cost Centers Audited
                  </span>
                </div>

                <table className="w-full text-[11px] border-collapse border border-slate-300">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    <tr>
                      <th className="py-2 px-2 text-left border-r border-slate-300">Department</th>
                      <th className="py-2 px-2 text-left border-r border-slate-300">Line Description</th>
                      <th className="py-2 px-2 text-center border-r border-slate-300">Cycle</th>
                      <th className="py-2 px-2 text-right border-r border-slate-300">
                        {reportMeta.reportType === "monthly" ? "Monthly Budget" : "Approved Budget"}
                      </th>
                      <th className="py-2 px-2 text-right border-r border-slate-300">Actual Spend</th>
                      <th className="py-2 px-2 text-right border-r border-slate-300">Variance</th>
                      <th className="py-2 px-2 text-center border-r border-slate-300">Burn %</th>
                      <th className="py-2 px-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {reportBudgets.map((b) => {
                      const allocated = reportMeta.reportType === "monthly" && b.periodType === "annual" ? Math.round(b.allocatedAmountTzs / 12) : b.allocatedAmountTzs;
                      const actual = getItemActualSpend(b, reportMeta.reportType === "monthly" ? "monthly" : undefined);
                      const remaining = allocated - actual;
                      const pct = allocated > 0 ? Math.round((actual / allocated) * 100) : 0;
                      const isOver = remaining < 0;

                      return (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="py-1.5 px-2 font-medium text-slate-600 border-r border-slate-200">
                            {b.department}
                          </td>
                          <td className="py-1.5 px-2 font-bold text-slate-900 border-r border-slate-200">
                            {b.title}
                          </td>
                          <td className="py-1.5 px-2 text-center uppercase text-[9px] font-bold text-slate-500 border-r border-slate-200">
                            {b.periodType}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono border-r border-slate-200">
                            {fmtMoney(allocated)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono border-r border-slate-200 font-semibold">
                            {fmtMoney(actual)}
                          </td>
                          <td
                            className={cn(
                              "py-1.5 px-2 text-right font-mono border-r border-slate-200 font-bold",
                              isOver ? "text-rose-700" : "text-emerald-700"
                            )}
                          >
                            {isOver ? "-" : "+"}
                            {fmtMoney(Math.abs(remaining))}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono border-r border-slate-200">
                            {pct}%
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <span
                              className={cn(
                                "text-[9px] font-bold px-1.5 py-0.5 rounded",
                                isOver
                                  ? "bg-rose-100 text-rose-800"
                                  : pct >= b.alertThresholdPct
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              )}
                            >
                              {isOver ? "OVERRUN" : pct >= b.alertThresholdPct ? "NEAR CAP" : "COMPLIANT"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-400">
                    <tr>
                      <td colSpan={3} className="py-2 px-2 text-slate-900 uppercase tracking-wider border-r border-slate-300">
                        TOTAL SUMMARY
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-900 border-r border-slate-300">
                        {fmtMoney(reportTotals.allocated)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-900 border-r border-slate-300">
                        {fmtMoney(reportTotals.actual)}
                      </td>
                      <td
                        className={cn(
                          "py-2 px-2 text-right font-mono border-r border-slate-300",
                          reportTotals.isOver ? "text-rose-700" : "text-emerald-700"
                        )}
                      >
                        {reportTotals.isOver ? "-" : "+"}
                        {fmtMoney(Math.abs(reportTotals.variance))}
                      </td>
                      <td className="py-2 px-2 text-center font-mono border-r border-slate-300">
                        {reportTotals.burnPct}%
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className="text-[9px] font-black uppercase text-slate-900">
                          {reportTotals.isOver ? "DEFICIT" : "APPROVED"}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* If Daily Mode: Realized Daily Transactions */}
              {reportMeta.reportType === "daily" && dailyExpenses.length > 0 && (
                <div className="mb-6">
                  <div className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                    2. Daily Operating Transactions Log ({selectedDate})
                  </div>
                  <table className="w-full text-[10px] border border-slate-300">
                    <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-300">
                      <tr>
                        <th className="py-1.5 px-2 text-left border-r border-slate-300">Type</th>
                        <th className="py-1.5 px-2 text-left border-r border-slate-300">Transaction</th>
                        <th className="py-1.5 px-2 text-left border-r border-slate-300">Vehicle / Corridor</th>
                        <th className="py-1.5 px-2 text-center border-r border-slate-300">Time</th>
                        <th className="py-1.5 px-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {dailyExpenses.map((e) => (
                        <tr key={e.id}>
                          <td className="py-1 px-2 font-semibold text-slate-600 border-r border-slate-200">{e.source}</td>
                          <td className="py-1 px-2 font-medium text-slate-900 border-r border-slate-200">{e.title}</td>
                          <td className="py-1 px-2 text-slate-600 font-mono border-r border-slate-200">{e.plateNumber || "--"}</td>
                          <td className="py-1 px-2 text-center text-slate-500 border-r border-slate-200">{e.time}</td>
                          <td className="py-1 px-2 text-right font-mono font-bold text-slate-900">{fmtMoney(e.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Executive Sign-off & Audit Block */}
              <div className="pt-8 mt-8 border-t-2 border-slate-300">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
                  Corporate Governance &amp; Sign-off Approvals
                </div>
                <div className="grid grid-cols-3 gap-6 pt-2">
                  <div className="border-t border-slate-400 pt-2 text-center">
                    <div className="text-[10px] font-bold text-slate-900">
                      {reportMeta.preparedBy}
                    </div>
                    <div className="text-[9px] text-slate-500 uppercase">Prepared By (Operations / Accounts)</div>
                    <div className="text-[8px] text-slate-400 font-mono mt-0.5">Date: {new Date().toISOString().slice(0, 10)}</div>
                  </div>

                  <div className="border-t border-slate-400 pt-2 text-center">
                    <div className="text-[10px] font-bold text-slate-900">
                      {reportMeta.reviewedBy}
                    </div>
                    <div className="text-[9px] text-slate-500 uppercase">Reviewed &amp; Audited By</div>
                    <div className="text-[8px] text-slate-400 font-mono mt-0.5">Signature / Stamp</div>
                  </div>

                  <div className="border-t border-slate-400 pt-2 text-center">
                    <div className="text-[10px] font-bold text-slate-900">
                      {reportMeta.approvedBy}
                    </div>
                    <div className="text-[9px] text-slate-500 uppercase">Executive Approval</div>
                    <div className="text-[8px] text-slate-400 font-mono mt-0.5">Authorized Signatory</div>
                  </div>
                </div>

                <div className="mt-8 text-center text-[9px] text-slate-400 border-t border-slate-100 pt-2">
                  Generated via MachineCare Enterprise ERP • Confidential • For Internal Management &amp; Board Review Only
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
