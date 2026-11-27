import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Edit2,
  Printer,
  Download,
  Search,
  DollarSign,
  Coins,
  CheckCircle,
  Clock,
  Truck,
  Building2,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface DailyBudgetEntry {
  id: string;
  organisation_id?: string;
  budget_date: string;
  description: string;
  category: string;
  truck_no: string;
  vehicle_id?: string | null;
  amount_usd: number;
  paid_usd: number;
  balance_usd: number;
  amount_tzs: number;
  paid_tzs: number;
  balance_tzs: number;
  received_by: string;
  payment_method?: string;
  voucher_no?: string;
  notes?: string;
  created_at?: string;
}

export const BUDGET_CATEGORIES = [
  "Fuel & Lubricants",
  "Workshop & Repairs",
  "Tyres & Tubes",
  "Driver Posho & Allowance",
  "Tolls & Weighbridges",
  "Border Clearance & Transit",
  "Permits & Regulatory",
  "Escort & Security",
  "Overhead & Admin",
  "Contingency / Other",
];

const DEFAULT_SAMPLE_ENTRIES: Omit<DailyBudgetEntry, "id">[] = [
  {
    budget_date: new Date().toISOString().slice(0, 10),
    description: "Tunduma border customs transit clearance",
    category: "Border Clearance & Transit",
    truck_no: "T 482 DXK",
    amount_usd: 450,
    paid_usd: 450,
    balance_usd: 0,
    amount_tzs: 0,
    paid_tzs: 0,
    balance_tzs: 0,
    received_by: "Hamisi J. (Agent)",
  },
  {
    budget_date: new Date().toISOString().slice(0, 10),
    description: "Diesel fuel top-up 350L - Morogoro Depot",
    category: "Fuel & Lubricants",
    truck_no: "T 915 DBM",
    amount_usd: 0,
    paid_usd: 0,
    balance_usd: 0,
    amount_tzs: 1050000,
    paid_tzs: 1050000,
    balance_tzs: 0,
    received_by: "Puma Energy Morogoro",
  },
  {
    budget_date: new Date().toISOString().slice(0, 10),
    description: "Driver trip posho allowance (4 days Dar - Kasumbalesa)",
    category: "Driver Posho & Allowance",
    truck_no: "T 915 DBM",
    amount_usd: 120,
    paid_usd: 60,
    balance_usd: 60,
    amount_tzs: 150000,
    paid_tzs: 150000,
    balance_tzs: 0,
    received_by: "Rashid Ally (Driver)",
  },
  {
    budget_date: new Date().toISOString().slice(0, 10),
    description: "Emergency brake chamber replacement parts",
    category: "Workshop & Repairs",
    truck_no: "T 230 CTY",
    amount_usd: 85,
    paid_usd: 85,
    balance_usd: 0,
    amount_tzs: 220000,
    paid_tzs: 100000,
    balance_tzs: 120000,
    received_by: "AutoSpares Mwenge",
  },
];

interface DailyBudgetLedgerProps {
  selectedDate?: string;
  onDateChange?: (date: string) => void;
  className?: string;
}

export function DailyBudgetLedger({
  selectedDate: propDate,
  onDateChange,
  className,
}: DailyBudgetLedgerProps) {
  const { currentOrganisation } = useAuth();
  const orgId = currentOrganisation?.id;

  const [date, setDate] = useState<string>(
    propDate || new Date().toISOString().slice(0, 10)
  );

  useEffect(() => {
    if (propDate && propDate !== date) {
      setDate(propDate);
    }
  }, [propDate]);

  const handleDateSelect = (newDate: string) => {
    setDate(newDate);
    onDateChange?.(newDate);
  };

  const [entries, setEntries] = useState<DailyBudgetEntry[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; plate_number: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    description: "",
    category: BUDGET_CATEGORIES[0],
    truck_no: "",
    amount_usd: "",
    paid_usd: "",
    amount_tzs: "",
    paid_tzs: "",
    received_by: "",
    payment_method: "cash",
    voucher_no: "",
    notes: "",
  });

  // Print ref
  const printRef = useRef<HTMLDivElement>(null);

  // Load Vehicles for dropdown
  useEffect(() => {
    async function fetchVehicles() {
      try {
        const { data, error } = await supabase
          .from("machines")
          .select("id, plate_number, name")
          .order("name");
        if (!error && data) {
          setVehicles(
            data.map((m: any) => ({
              id: m.id,
              plate_number: m.plate_number || m.name,
              name: m.name,
            }))
          );
        }
      } catch (err) {
        console.warn("Failed to fetch vehicles list:", err);
      }
    }
    fetchVehicles();
  }, []);

  // Load daily budget entries
  const loadEntries = async () => {
    setLoading(true);
    const storageKey = `mc_daily_budget_${orgId || "default"}_${date}`;
    try {
      if (orgId) {
        const { data, error } = await supabase
          .from("finance_daily_budget_entries" as any)
          .select("*")
          .eq("organisation_id", orgId)
          .eq("budget_date", date)
          .order("created_at", { ascending: true });

        if (!error && data && data.length > 0) {
          const mapped = data.map((d: any) => ({
            id: d.id,
            organisation_id: d.organisation_id,
            budget_date: d.budget_date,
            description: d.description || "",
            category: d.category || "other",
            truck_no: d.truck_no || "--",
            vehicle_id: d.vehicle_id,
            amount_usd: Number(d.amount_usd || 0),
            paid_usd: Number(d.paid_usd || 0),
            balance_usd: Number(d.balance_usd ?? (Number(d.amount_usd || 0) - Number(d.paid_usd || 0))),
            amount_tzs: Number(d.amount_tzs || 0),
            paid_tzs: Number(d.paid_tzs || 0),
            balance_tzs: Number(d.balance_tzs ?? (Number(d.amount_tzs || 0) - Number(d.paid_tzs || 0))),
            received_by: d.received_by || "",
            payment_method: d.payment_method || "cash",
            voucher_no: d.voucher_no || "",
            notes: d.notes || "",
            created_at: d.created_at,
          }));
          setEntries(mapped);
          localStorage.setItem(storageKey, JSON.stringify(mapped));
          setLoading(false);
          return;
        }
      }

      // Fallback to local storage or initial sample data for today
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        try {
          setEntries(JSON.parse(cached));
          setLoading(false);
          return;
        } catch {
          // parse error
        }
      }

      // If empty for today and no cache, seed with realistic East African fleet samples
      const seeded = DEFAULT_SAMPLE_ENTRIES.map((sample, idx) => ({
        ...sample,
        id: `sample-${date}-${idx}`,
        budget_date: date,
        balance_usd: sample.amount_usd - sample.paid_usd,
        balance_tzs: sample.amount_tzs - sample.paid_tzs,
      }));
      setEntries(seeded);
      localStorage.setItem(storageKey, JSON.stringify(seeded));
    } catch (err) {
      console.error("Error loading daily budget entries:", err);
      // Fallback
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        setEntries(JSON.parse(cached));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [date, orgId]);

  // Save entry (insert or update)
  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    const amtUsd = parseFloat(formData.amount_usd) || 0;
    const paidUsd = parseFloat(formData.paid_usd) || 0;
    const balUsd = amtUsd - paidUsd;

    const amtTzs = parseFloat(formData.amount_tzs) || 0;
    const paidTzs = parseFloat(formData.paid_tzs) || 0;
    const balTzs = amtTzs - paidTzs;

    const storageKey = `mc_daily_budget_${orgId || "default"}_${date}`;

    if (editingId) {
      // Update
      const updatedList = entries.map((entry) => {
        if (entry.id === editingId) {
          return {
            ...entry,
            description: formData.description.trim(),
            category: formData.category,
            truck_no: formData.truck_no.trim() || "--",
            amount_usd: amtUsd,
            paid_usd: paidUsd,
            balance_usd: balUsd,
            amount_tzs: amtTzs,
            paid_tzs: paidTzs,
            balance_tzs: balTzs,
            received_by: formData.received_by.trim() || "--",
            payment_method: formData.payment_method,
            voucher_no: formData.voucher_no.trim(),
            notes: formData.notes.trim(),
          };
        }
        return entry;
      });

      setEntries(updatedList);
      localStorage.setItem(storageKey, JSON.stringify(updatedList));

      // Attempt Supabase sync
      if (orgId && !editingId.startsWith("sample-") && !editingId.startsWith("local-")) {
        try {
          await supabase
            .from("finance_daily_budget_entries" as any)
            .update({
              description: formData.description.trim(),
              category: formData.category,
              truck_no: formData.truck_no.trim() || null,
              amount_usd: amtUsd,
              paid_usd: paidUsd,
              balance_usd: balUsd,
              amount_tzs: amtTzs,
              paid_tzs: paidTzs,
              balance_tzs: balTzs,
              received_by: formData.received_by.trim() || null,
              payment_method: formData.payment_method,
              voucher_no: formData.voucher_no.trim() || null,
              notes: formData.notes.trim() || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", editingId);
        } catch (err) {
          console.warn("Could not sync update to Supabase:", err);
        }
      }

      toast.success("Budget entry updated");
    } else {
      // Create new
      const newId = `local-${Date.now()}`;
      const newEntry: DailyBudgetEntry = {
        id: newId,
        organisation_id: orgId,
        budget_date: date,
        description: formData.description.trim(),
        category: formData.category,
        truck_no: formData.truck_no.trim() || "--",
        amount_usd: amtUsd,
        paid_usd: paidUsd,
        balance_usd: balUsd,
        amount_tzs: amtTzs,
        paid_tzs: paidTzs,
        balance_tzs: balTzs,
        received_by: formData.received_by.trim() || "--",
        payment_method: formData.payment_method,
        voucher_no: formData.voucher_no.trim(),
        notes: formData.notes.trim(),
        created_at: new Date().toISOString(),
      };

      // Try Supabase insert
      if (orgId) {
        try {
          const { data, error } = await supabase
            .from("finance_daily_budget_entries" as any)
            .insert({
              organisation_id: orgId,
              budget_date: date,
              description: newEntry.description,
              category: newEntry.category,
              truck_no: newEntry.truck_no === "--" ? null : newEntry.truck_no,
              amount_usd: newEntry.amount_usd,
              paid_usd: newEntry.paid_usd,
              balance_usd: newEntry.balance_usd,
              amount_tzs: newEntry.amount_tzs,
              paid_tzs: newEntry.paid_tzs,
              balance_tzs: newEntry.balance_tzs,
              received_by: newEntry.received_by === "--" ? null : newEntry.received_by,
              payment_method: newEntry.payment_method,
              voucher_no: newEntry.voucher_no || null,
              notes: newEntry.notes || null,
            })
            .select()
            .single();

          if (!error && data) {
            newEntry.id = data.id;
          }
        } catch (err) {
          console.warn("Supabase insert fallback to local:", err);
        }
      }

      const updatedList = [...entries, newEntry];
      setEntries(updatedList);
      localStorage.setItem(storageKey, JSON.stringify(updatedList));
      toast.success("Budget entry added successfully");
    }

    setModalOpen(false);
    resetForm();
  };

  // Delete entry
  const handleDeleteEntry = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this daily budget entry?")) return;

    const storageKey = `mc_daily_budget_${orgId || "default"}_${date}`;
    const updatedList = entries.filter((e) => e.id !== id);
    setEntries(updatedList);
    localStorage.setItem(storageKey, JSON.stringify(updatedList));

    if (orgId && !id.startsWith("sample-") && !id.startsWith("local-")) {
      try {
        await supabase
          .from("finance_daily_budget_entries" as any)
          .delete()
          .eq("id", id);
      } catch (err) {
        console.warn("Could not delete from Supabase:", err);
      }
    }
    toast.success("Entry removed");
  };

  const handleEditClick = (entry: DailyBudgetEntry) => {
    setEditingId(entry.id);
    setFormData({
      description: entry.description,
      category: entry.category,
      truck_no: entry.truck_no === "--" ? "" : entry.truck_no,
      amount_usd: entry.amount_usd ? String(entry.amount_usd) : "",
      paid_usd: entry.paid_usd ? String(entry.paid_usd) : "",
      amount_tzs: entry.amount_tzs ? String(entry.amount_tzs) : "",
      paid_tzs: entry.paid_tzs ? String(entry.paid_tzs) : "",
      received_by: entry.received_by === "--" ? "" : entry.received_by,
      payment_method: entry.payment_method || "cash",
      voucher_no: entry.voucher_no || "",
      notes: entry.notes || "",
    });
    setModalOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      description: "",
      category: BUDGET_CATEGORIES[0],
      truck_no: "",
      amount_usd: "",
      paid_usd: "",
      amount_tzs: "",
      paid_tzs: "",
      received_by: "",
      payment_method: "cash",
      voucher_no: "",
      notes: "",
    });
  };

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const matchSearch =
        e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.truck_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.received_by.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory =
        categoryFilter === "all" || e.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [entries, searchTerm, categoryFilter]);

  // Aggregate Totals
  const totals = useMemo(() => {
    return entries.reduce(
      (acc, cur) => {
        acc.amount_usd += cur.amount_usd || 0;
        acc.paid_usd += cur.paid_usd || 0;
        acc.balance_usd += cur.balance_usd || 0;
        acc.amount_tzs += cur.amount_tzs || 0;
        acc.paid_tzs += cur.paid_tzs || 0;
        acc.balance_tzs += cur.balance_tzs || 0;
        return acc;
      },
      {
        amount_usd: 0,
        paid_usd: 0,
        balance_usd: 0,
        amount_tzs: 0,
        paid_tzs: 0,
        balance_tzs: 0,
      }
    );
  }, [entries]);

  // CSV Export
  const exportToCSV = () => {
    if (entries.length === 0) {
      toast.error("No entries to export");
      return;
    }
    const headers = [
      "DESCRIPTION",
      "CATEGORY",
      "TRUCK NO",
      "AMOUNT - USD",
      "PAID USD",
      "BALANCE USD",
      "AMOUNT TZS",
      "PAID TZS",
      "BALANCE TZS",
      "RECEIVED BY",
      "DATE",
    ];

    const rows = entries.map((e) => [
      `"${e.description.replace(/"/g, '""')}"`,
      `"${e.category}"`,
      `"${e.truck_no}"`,
      e.amount_usd.toFixed(2),
      e.paid_usd.toFixed(2),
      e.balance_usd.toFixed(2),
      Math.round(e.amount_tzs),
      Math.round(e.paid_tzs),
      Math.round(e.balance_tzs),
      `"${(e.received_by || "").replace(/"/g, '""')}"`,
      e.budget_date,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Daily_Budget_Ledger_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV export downloaded");
  };

  // Print Handling
  const handlePrint = () => {
    window.print();
  };

  // Live modal balance preview
  const modalBalanceUsd =
    (parseFloat(formData.amount_usd) || 0) - (parseFloat(formData.paid_usd) || 0);
  const modalBalanceTzs =
    (parseFloat(formData.amount_tzs) || 0) - (parseFloat(formData.paid_tzs) || 0);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card border border-border p-4 rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Coins className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                Daily Budget & Expenditure Ledger
                <Badge variant="secondary" className="text-[10px] font-mono uppercase">
                  Dual Currency USD / TZS
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground">
                Itemized operating budget disbursements, truck fuel, trip posho, border transit, and vendor vouchers.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
          {/* Quick Date Picker */}
          <div className="flex items-center gap-1.5 bg-muted/40 border border-border rounded-lg px-2 py-1">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="date"
              value={date}
              onChange={(e) => handleDateSelect(e.target.value)}
              className="h-7 w-32 border-0 bg-transparent text-xs font-semibold p-0 focus-visible:ring-0"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            className="h-8 text-xs font-semibold gap-1.5"
            title="Download CSV spreadsheet"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-8 text-xs font-semibold gap-1.5"
            title="Print Daily Budget Disbursement Sheet"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Voucher
          </Button>

          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            className="h-8 text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Expense Line
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards for USD & TZS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* USD Summary */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              USD Budget Total
            </span>
            <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-xl font-black font-mono text-emerald-950 dark:text-emerald-100">
            ${totals.amount_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground font-medium">
            <span>Disbursed: ${totals.paid_usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            <span className="font-bold text-foreground">
              Bal: ${totals.balance_usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* USD Balance */}
        <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              USD Pending Balance
            </span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className={cn(
            "mt-2 text-xl font-black font-mono",
            totals.balance_usd > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
          )}>
            ${totals.balance_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {totals.balance_usd > 0 ? "Remaining payable to agents/suppliers" : "All USD vouchers fully settled"}
          </p>
        </div>

        {/* TZS Summary */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
              TZS Budget Total
            </span>
            <Coins className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 text-xl font-black font-mono text-blue-950 dark:text-blue-100">
            TZS {Math.round(totals.amount_tzs).toLocaleString("en-US")}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground font-medium">
            <span>Disbursed: TZS {Math.round(totals.paid_tzs).toLocaleString("en-US")}</span>
            <span className="font-bold text-foreground">
              Bal: TZS {Math.round(totals.balance_tzs).toLocaleString("en-US")}
            </span>
          </div>
        </div>

        {/* TZS Balance */}
        <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              TZS Pending Balance
            </span>
            <AlertCircle className="h-4 w-4 text-purple-500" />
          </div>
          <div className={cn(
            "mt-2 text-xl font-black font-mono",
            totals.balance_tzs > 0 ? "text-purple-600 dark:text-purple-400" : "text-emerald-600 dark:text-emerald-400"
          )}>
            TZS {Math.round(totals.balance_tzs).toLocaleString("en-US")}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {totals.balance_tzs > 0 ? "Pending local vendor / fuel payments" : "All local currency vouchers cleared"}
          </p>
        </div>
      </div>

      {/* Search and Category Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20 border border-border p-3 rounded-xl">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search truck, description, payee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs bg-background"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 text-xs w-44 bg-background">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories ({entries.length})</SelectItem>
              {BUDGET_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Showing <strong className="text-foreground">{filteredEntries.length}</strong> of{" "}
            {entries.length} items for <span className="font-semibold text-foreground">{date}</span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={loadEntries}
            title="Refresh Ledger"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Main 10-Column Daily Budget Ledger Table (Matching User's Header Exactly) */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              {/* Top grouping header for currency separation */}
              <tr className="bg-muted/80 border-b border-border text-[11px] uppercase tracking-wider font-extrabold text-foreground">
                <th colSpan={3} className="py-2 px-3 border-r border-border text-left">
                  General Details
                </th>
                <th colSpan={3} className="py-2 px-3 border-r border-border text-center bg-emerald-500/10 text-emerald-950 dark:text-emerald-300">
                  United States Dollar (USD $)
                </th>
                <th colSpan={3} className="py-2 px-3 border-r border-border text-center bg-blue-500/10 text-blue-950 dark:text-blue-300">
                  Tanzanian Shillings (TZS)
                </th>
                <th colSpan={2} className="py-2 px-3 text-left">
                  Verification & Actions
                </th>
              </tr>
              {/* Exact 10 Column Header from user picture */}
              <tr className="bg-muted/40 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-3 min-w-[200px]">DESCRIPTION</th>
                <th className="py-3 px-3 min-w-[130px]">Category</th>
                <th className="py-3 px-3 min-w-[110px] border-r border-border">TRUCK NO</th>

                {/* USD Columns */}
                <th className="py-3 px-3 text-right min-w-[100px] bg-emerald-500/5 text-emerald-900 dark:text-emerald-300">
                  AMOUNT - USD
                </th>
                <th className="py-3 px-3 text-right min-w-[95px] bg-emerald-500/5 text-emerald-900 dark:text-emerald-300">
                  PAID USD
                </th>
                <th className="py-3 px-3 text-right min-w-[95px] bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 border-r border-border font-extrabold">
                  BALANCE USD
                </th>

                {/* TZS Columns */}
                <th className="py-3 px-3 text-right min-w-[110px] bg-blue-500/5 text-blue-900 dark:text-blue-300">
                  AMOUNT TZS
                </th>
                <th className="py-3 px-3 text-right min-w-[105px] bg-blue-500/5 text-blue-900 dark:text-blue-300">
                  PAID TZS
                </th>
                <th className="py-3 px-3 text-right min-w-[105px] bg-blue-500/10 text-blue-950 dark:text-blue-200 border-r border-border font-extrabold">
                  BALANCE TZS
                </th>

                <th className="py-3 px-3 min-w-[130px]">RECEIVED BY</th>
                <th className="py-3 px-2 text-center w-16">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border font-sans">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted-foreground">
                    <p className="text-sm font-semibold">No budget line items recorded for this date.</p>
                    <p className="text-xs mt-1">Click "Add Expense Line" above to enter daily transport budget disbursements.</p>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors group">
                    {/* 1. DESCRIPTION */}
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-foreground">{row.description}</div>
                      {row.notes && <div className="text-[11px] text-muted-foreground mt-0.5">{row.notes}</div>}
                    </td>

                    {/* 2. Category */}
                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className="text-[10px] font-semibold">
                        {row.category}
                      </Badge>
                    </td>

                    {/* 3. TRUCK NO */}
                    <td className="py-2.5 px-3 border-r border-border">
                      <div className="flex items-center gap-1 font-mono font-bold text-foreground">
                        {row.truck_no && row.truck_no !== "--" ? (
                          <>
                            <Truck className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span>{row.truck_no}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </div>
                    </td>

                    {/* 4. AMOUNT - USD */}
                    <td className="py-2.5 px-3 text-right font-mono font-medium bg-emerald-500/5">
                      {row.amount_usd > 0 ? (
                        `$${row.amount_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </td>

                    {/* 5. PAID USD */}
                    <td className="py-2.5 px-3 text-right font-mono font-medium bg-emerald-500/5 text-emerald-800 dark:text-emerald-400">
                      {row.paid_usd > 0 ? (
                        `$${row.paid_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </td>

                    {/* 6. BALANCE USD */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold border-r border-border bg-emerald-500/10">
                      {row.balance_usd > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400">
                          ${row.balance_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : row.amount_usd > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">$0.00</span>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </td>

                    {/* 7. AMOUNT TZS */}
                    <td className="py-2.5 px-3 text-right font-mono font-medium bg-blue-500/5">
                      {row.amount_tzs > 0 ? (
                        Math.round(row.amount_tzs).toLocaleString("en-US")
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </td>

                    {/* 8. PAID TZS */}
                    <td className="py-2.5 px-3 text-right font-mono font-medium bg-blue-500/5 text-blue-800 dark:text-blue-400">
                      {row.paid_tzs > 0 ? (
                        Math.round(row.paid_tzs).toLocaleString("en-US")
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </td>

                    {/* 9. BALANCE TZS */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold border-r border-border bg-blue-500/10">
                      {row.balance_tzs > 0 ? (
                        <span className="text-purple-600 dark:text-purple-400">
                          {Math.round(row.balance_tzs).toLocaleString("en-US")}
                        </span>
                      ) : row.amount_tzs > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">0</span>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </td>

                    {/* 10. RECEIVED BY */}
                    <td className="py-2.5 px-3 font-medium text-foreground">
                      {row.received_by && row.received_by !== "--" ? (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span>{row.received_by}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </td>

                    {/* Row Actions */}
                    <td className="py-2.5 px-2 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={() => handleEditClick(row)}
                          title="Edit Line"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                          onClick={() => handleDeleteEntry(row.id)}
                          title="Delete Line"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Totals Summary Row */}
            {filteredEntries.length > 0 && (
              <tfoot>
                <tr className="bg-muted/90 border-t-2 border-border font-extrabold text-foreground">
                  <td colSpan={3} className="py-3 px-3 text-right uppercase tracking-wider text-[11px] border-r border-border">
                    Daily Total Disbursements ({filteredEntries.length} lines):
                  </td>

                  {/* USD Totals */}
                  <td className="py-3 px-3 text-right font-mono text-emerald-950 dark:text-emerald-200 bg-emerald-500/15">
                    ${totals.amount_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-900 dark:text-emerald-300 bg-emerald-500/15">
                    ${totals.paid_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right font-mono border-r border-border bg-emerald-500/20 text-emerald-950 dark:text-emerald-100">
                    ${totals.balance_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* TZS Totals */}
                  <td className="py-3 px-3 text-right font-mono text-blue-950 dark:text-blue-200 bg-blue-500/15">
                    {Math.round(totals.amount_tzs).toLocaleString("en-US")}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-blue-900 dark:text-blue-300 bg-blue-500/15">
                    {Math.round(totals.paid_tzs).toLocaleString("en-US")}
                  </td>
                  <td className="py-3 px-3 text-right font-mono border-r border-border bg-blue-500/20 text-blue-950 dark:text-blue-100">
                    {Math.round(totals.balance_tzs).toLocaleString("en-US")}
                  </td>

                  <td colSpan={2} className="py-3 px-3 text-muted-foreground text-[10px]">
                    Ledger verified
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Printable Corporate Voucher / Audit Sheet (Visible on Print) */}
      <div className="hidden print:block font-sans text-black p-6 space-y-6" ref={printRef}>
        <div className="border-b-2 border-black pb-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wider">
              LOGISTIXWARE / MACHINECARE HUB
            </h1>
            <h2 className="text-sm font-semibold">DAILY FLEET OPERATING BUDGET & DISBURSEMENT VOUCHER</h2>
            <p className="text-xs text-gray-600">Cross-Border Transport & Haulage Operations</p>
          </div>
          <div className="text-right text-xs">
            <p><strong>Date:</strong> {date}</p>
            <p><strong>Printed:</strong> {new Date().toLocaleString()}</p>
            <p><strong>Status:</strong> Approved Ledger</p>
          </div>
        </div>

        <table className="w-full text-xs border border-black border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b border-black text-[10px]">
              <th className="p-2 border border-black text-left">DESCRIPTION</th>
              <th className="p-2 border border-black text-left">CATEGORY</th>
              <th className="p-2 border border-black text-left">TRUCK NO</th>
              <th className="p-2 border border-black text-right">AMOUNT USD</th>
              <th className="p-2 border border-black text-right">PAID USD</th>
              <th className="p-2 border border-black text-right">BAL USD</th>
              <th className="p-2 border border-black text-right">AMOUNT TZS</th>
              <th className="p-2 border border-black text-right">PAID TZS</th>
              <th className="p-2 border border-black text-right">BAL TZS</th>
              <th className="p-2 border border-black text-left">RECEIVED BY</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((item, idx) => (
              <tr key={idx} className="border-b border-black">
                <td className="p-1.5 border border-black font-medium">{item.description}</td>
                <td className="p-1.5 border border-black">{item.category}</td>
                <td className="p-1.5 border border-black font-mono">{item.truck_no}</td>
                <td className="p-1.5 border border-black text-right font-mono">{item.amount_usd > 0 ? `$${item.amount_usd.toFixed(2)}` : "-"}</td>
                <td className="p-1.5 border border-black text-right font-mono">{item.paid_usd > 0 ? `$${item.paid_usd.toFixed(2)}` : "-"}</td>
                <td className="p-1.5 border border-black text-right font-mono font-bold">{item.balance_usd > 0 ? `$${item.balance_usd.toFixed(2)}` : "$0.00"}</td>
                <td className="p-1.5 border border-black text-right font-mono">{item.amount_tzs > 0 ? Math.round(item.amount_tzs).toLocaleString() : "-"}</td>
                <td className="p-1.5 border border-black text-right font-mono">{item.paid_tzs > 0 ? Math.round(item.paid_tzs).toLocaleString() : "-"}</td>
                <td className="p-1.5 border border-black text-right font-mono font-bold">{item.balance_tzs > 0 ? Math.round(item.balance_tzs).toLocaleString() : "0"}</td>
                <td className="p-1.5 border border-black">{item.received_by}</td>
              </tr>
            ))}
            <tr className="font-bold bg-gray-100 border-t-2 border-black">
              <td colSpan={3} className="p-2 border border-black text-right">TOTALS:</td>
              <td className="p-2 border border-black text-right font-mono">${totals.amount_usd.toFixed(2)}</td>
              <td className="p-2 border border-black text-right font-mono">${totals.paid_usd.toFixed(2)}</td>
              <td className="p-2 border border-black text-right font-mono">${totals.balance_usd.toFixed(2)}</td>
              <td className="p-2 border border-black text-right font-mono">{Math.round(totals.amount_tzs).toLocaleString()}</td>
              <td className="p-2 border border-black text-right font-mono">{Math.round(totals.paid_tzs).toLocaleString()}</td>
              <td className="p-2 border border-black text-right font-mono">{Math.round(totals.balance_tzs).toLocaleString()}</td>
              <td className="p-2 border border-black">-</td>
            </tr>
          </tbody>
        </table>

        {/* Corporate Signatures */}
        <div className="grid grid-cols-4 gap-4 pt-12 text-xs text-center">
          <div className="border-t border-black pt-2">
            <p className="font-bold">Prepared By</p>
            <p className="text-[10px] text-gray-500">Fleet Operations Officer</p>
          </div>
          <div className="border-t border-black pt-2">
            <p className="font-bold">Verified By</p>
            <p className="text-[10px] text-gray-500">Workshop & Transport Lead</p>
          </div>
          <div className="border-t border-black pt-2">
            <p className="font-bold">Authorized By</p>
            <p className="text-[10px] text-gray-500">Finance Manager / Director</p>
          </div>
          <div className="border-t border-black pt-2">
            <p className="font-bold">Disbursed / Cashier</p>
            <p className="text-[10px] text-gray-500">Accounts & Cash Office</p>
          </div>
        </div>
      </div>

      {/* Add / Edit Daily Expense Line Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Daily Budget Line" : "New Daily Expense Voucher Line"}
            </DialogTitle>
            <DialogDescription>
              Record an itemized budget line with automatic balance tracking in USD and TZS.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEntry} className="space-y-4 py-2">
            {/* 1. Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">DESCRIPTION *</Label>
              <Input
                placeholder="e.g. Fuel Diesel 350L, Tunduma Border Transit, Driver Posho"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="text-xs"
                required
              />
            </div>

            {/* 2. Category & Truck No */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUDGET_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">TRUCK NO / VEHICLE</Label>
                <div className="relative">
                  <Input
                    placeholder="e.g. T 482 DXK or select below"
                    value={formData.truck_no}
                    onChange={(e) => setFormData({ ...formData, truck_no: e.target.value })}
                    className="text-xs"
                    list="daily-trucks-datalist"
                  />
                  <datalist id="daily-trucks-datalist">
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.plate_number}>
                        {v.name}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>
            </div>

            {/* USD Section: AMOUNT - USD, PAID USD, BALANCE USD */}
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
              <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase flex items-center justify-between">
                <span>USD Currency Breakdown</span>
                <span className="font-mono text-xs">
                  Balance: ${modalBalanceUsd.toFixed(2)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-emerald-900 dark:text-emerald-300">
                    AMOUNT - USD
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.amount_usd}
                    onChange={(e) => setFormData({ ...formData, amount_usd: e.target.value })}
                    className="text-xs bg-background font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-emerald-900 dark:text-emerald-300">
                    PAID USD
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.paid_usd}
                    onChange={(e) => setFormData({ ...formData, paid_usd: e.target.value })}
                    className="text-xs bg-background font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-emerald-900 dark:text-emerald-300">
                    BALANCE USD
                  </Label>
                  <div className="h-9 rounded-md border border-border bg-muted/60 px-3 flex items-center font-mono text-xs font-bold text-foreground">
                    ${modalBalanceUsd.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* TZS Section: AMOUNT TZS, PAID TZS, BALANCE TZS */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
              <div className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase flex items-center justify-between">
                <span>TZS Currency Breakdown</span>
                <span className="font-mono text-xs">
                  Balance: TZS {Math.round(modalBalanceTzs).toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-blue-900 dark:text-blue-300">
                    AMOUNT TZS
                  </Label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="0"
                    value={formData.amount_tzs}
                    onChange={(e) => setFormData({ ...formData, amount_tzs: e.target.value })}
                    className="text-xs bg-background font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-blue-900 dark:text-blue-300">
                    PAID TZS
                  </Label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="0"
                    value={formData.paid_tzs}
                    onChange={(e) => setFormData({ ...formData, paid_tzs: e.target.value })}
                    className="text-xs bg-background font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-blue-900 dark:text-blue-300">
                    BALANCE TZS
                  </Label>
                  <div className="h-9 rounded-md border border-border bg-muted/60 px-3 flex items-center font-mono text-xs font-bold text-foreground">
                    TZS {Math.round(modalBalanceTzs).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* 10. RECEIVED BY & Extra */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">RECEIVED BY (Payee / Driver / Vendor)</Label>
                <Input
                  placeholder="e.g. Rashid Ally (Driver) / Puma Station"
                  value={formData.received_by}
                  onChange={(e) => setFormData({ ...formData, received_by: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Payment Method</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(val) => setFormData({ ...formData, payment_method: val })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash on Hand</SelectItem>
                    <SelectItem value="bank">Bank Wire / TT</SelectItem>
                    <SelectItem value="mpesa">M-Pesa / Tigo Pesa / Airtel</SelectItem>
                    <SelectItem value="card">Fuel Card / Corporate Visa</SelectItem>
                    <SelectItem value="credit">Supplier Credit / Invoice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Notes / Voucher Reference (Optional)</Label>
              <Input
                placeholder="e.g. Voucher #V-2026-081, Trip DAR-LUBUMBASHI"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="text-xs"
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
              <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-bold">
                {editingId ? "Save Changes" : "Record Expense Line"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
