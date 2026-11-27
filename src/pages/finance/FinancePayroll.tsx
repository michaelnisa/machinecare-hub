import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Users,
  Clock,
  Banknote,
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  Printer,
  Download,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  Briefcase,
  Building2,
  Truck,
  Check,
  ArrowRight,
  TrendingUp,
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
import { FinanceNavHeader } from "./FinanceNavHeader";
import { cn } from "@/lib/utils";

export interface StaffWorker {
  id: string;
  organisation_id?: string;
  employee_id: string;
  full_name: string;
  department: string;
  designation: string;
  employment_type: "permanent" | "contract" | "casual" | "probation";
  phone: string;
  email?: string;
  national_id?: string;
  base_salary_tzs: number;
  base_salary_usd: number;
  overtime_rate_tzs: number; // TZS per hour
  daily_posho_tzs: number;   // Daily per diem
  payment_method: "bank" | "mpesa" | "airtel_money" | "cash" | "other";
  bank_name?: string;
  bank_account_no?: string;
  mobile_money_number?: string;
  status: "active" | "on_leave" | "suspended" | "terminated";
  notes?: string;
  created_at?: string;
}

export interface OvertimeLog {
  id: string;
  organisation_id?: string;
  worker_id: string;
  worker_name?: string;
  department?: string;
  log_date: string;
  normal_hours: number;
  overtime_hours: number;
  hourly_rate_tzs: number;
  multiplier: number;
  overtime_amount_tzs: number;
  truck_no?: string;
  job_reference?: string;
  reason?: string;
  status: "pending" | "approved" | "rejected" | "paid";
  notes?: string;
  created_at?: string;
}

export interface PayrollRecord {
  id: string;
  worker_id: string;
  worker_name: string;
  employee_id: string;
  department: string;
  designation: string;
  payroll_month: number;
  payroll_year: number;
  base_salary_tzs: number;
  overtime_hours_total: number;
  overtime_pay_tzs: number;
  allowances_tzs: number;
  deductions_tzs: number;
  net_salary_tzs: number;
  payment_status: "draft" | "pending_approval" | "approved" | "paid";
  payment_method: string;
  payment_reference?: string;
}

export const STAFF_DEPARTMENTS = [
  "Fleet Operations",
  "Workshop & Engineering",
  "Freight Logistics",
  "Procurement & Inventory",
  "Finance & Accounts",
  "Administration & HR",
  "Depot & Security",
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DEFAULT_SAMPLE_WORKERS: StaffWorker[] = [
  {
    id: "w-001",
    employee_id: "EMP-0101",
    full_name: "Juma Baraka",
    department: "Fleet Operations",
    designation: "Heavy Commercial Driver",
    employment_type: "permanent",
    phone: "+255 754 112 233",
    base_salary_tzs: 900000,
    base_salary_usd: 350,
    overtime_rate_tzs: 6500,
    daily_posho_tzs: 30000,
    payment_method: "bank",
    bank_name: "CRDB Bank",
    bank_account_no: "0152488392100",
    status: "active",
  },
  {
    id: "w-002",
    employee_id: "EMP-0102",
    full_name: "Emmanuel Mushi",
    department: "Workshop & Engineering",
    designation: "Senior Diesel Mechanic",
    employment_type: "permanent",
    phone: "+255 784 445 566",
    base_salary_tzs: 1200000,
    base_salary_usd: 460,
    overtime_rate_tzs: 8500,
    daily_posho_tzs: 25000,
    payment_method: "bank",
    bank_name: "NMB Bank",
    bank_account_no: "20810034921",
    status: "active",
  },
  {
    id: "w-003",
    employee_id: "EMP-0103",
    full_name: "Amina Salum",
    department: "Procurement & Inventory",
    designation: "Procurement & Spares Officer",
    employment_type: "permanent",
    phone: "+255 713 778 899",
    base_salary_tzs: 1100000,
    base_salary_usd: 420,
    overtime_rate_tzs: 7500,
    daily_posho_tzs: 20000,
    payment_method: "bank",
    bank_name: "CRDB Bank",
    bank_account_no: "0152009817201",
    status: "active",
  },
  {
    id: "w-004",
    employee_id: "EMP-0104",
    full_name: "Selemani Kassim",
    department: "Fleet Operations",
    designation: "Interstate Transit Driver",
    employment_type: "contract",
    phone: "+255 767 990 011",
    base_salary_tzs: 850000,
    base_salary_usd: 330,
    overtime_rate_tzs: 6000,
    daily_posho_tzs: 35000,
    payment_method: "mpesa",
    mobile_money_number: "+255 767 990 011",
    status: "active",
  },
  {
    id: "w-005",
    employee_id: "EMP-0105",
    full_name: "John Mwita",
    department: "Workshop & Engineering",
    designation: "Auto Electrician & Diagnostic Tech",
    employment_type: "permanent",
    phone: "+255 755 223 344",
    base_salary_tzs: 1050000,
    base_salary_usd: 400,
    overtime_rate_tzs: 7500,
    daily_posho_tzs: 25000,
    payment_method: "bank",
    bank_name: "Stanbic Bank",
    bank_account_no: "904000389102",
    status: "active",
  },
];

const DEFAULT_SAMPLE_OVERTIME: OvertimeLog[] = [
  {
    id: "ot-001",
    worker_id: "w-002",
    worker_name: "Emmanuel Mushi",
    department: "Workshop & Engineering",
    log_date: new Date().toISOString().slice(0, 10),
    normal_hours: 8,
    overtime_hours: 3.5,
    hourly_rate_tzs: 8500,
    multiplier: 1.5,
    overtime_amount_tzs: 44625,
    truck_no: "T 482 DXK",
    job_reference: "WO-2026-089",
    reason: "Emergency differential gearbox overhaul after hours",
    status: "approved",
  },
  {
    id: "ot-002",
    worker_id: "w-001",
    worker_name: "Juma Baraka",
    department: "Fleet Operations",
    log_date: new Date().toISOString().slice(0, 10),
    normal_hours: 8,
    overtime_hours: 4.0,
    hourly_rate_tzs: 6500,
    multiplier: 1.5,
    overtime_amount_tzs: 39000,
    truck_no: "T 915 DBM",
    job_reference: "TRIP-KASUMB-04",
    reason: "Late night border weighbridge queue clearance",
    status: "approved",
  },
  {
    id: "ot-003",
    worker_id: "w-005",
    worker_name: "John Mwita",
    department: "Workshop & Engineering",
    log_date: new Date().toISOString().slice(0, 10),
    normal_hours: 8,
    overtime_hours: 2.0,
    hourly_rate_tzs: 7500,
    multiplier: 1.5,
    overtime_amount_tzs: 22500,
    truck_no: "T 230 CTY",
    job_reference: "WO-2026-092",
    reason: "Alternator wiring repair for scheduled morning dispatch",
    status: "pending",
  },
];

export function FinancePayroll() {
  const { currentOrganisation } = useAuth();
  const orgId = currentOrganisation?.id;

  const [activeTab, setActiveTab] = useState<"workers" | "overtime" | "payroll">("workers");

  // Workers State
  const [workers, setWorkers] = useState<StaffWorker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [workerSearch, setWorkerSearch] = useState("");
  const [workerDeptFilter, setWorkerDeptFilter] = useState("all");

  // Worker Modal
  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [workerForm, setWorkerForm] = useState({
    employee_id: "",
    full_name: "",
    department: STAFF_DEPARTMENTS[0],
    designation: "Driver",
    employment_type: "permanent" as "permanent" | "contract" | "casual" | "probation",
    phone: "",
    email: "",
    national_id: "",
    base_salary_tzs: "",
    base_salary_usd: "",
    overtime_rate_tzs: "",
    daily_posho_tzs: "",
    payment_method: "bank" as "bank" | "mpesa" | "airtel_money" | "cash" | "other",
    bank_name: "",
    bank_account_no: "",
    mobile_money_number: "",
    status: "active" as "active" | "on_leave" | "suspended" | "terminated",
    notes: "",
  });

  // Overtime State
  const [overtimeLogs, setOvertimeLogs] = useState<OvertimeLog[]>([]);
  const [otDate, setOtDate] = useState(new Date().toISOString().slice(0, 10));
  const [otSearch, setOtSearch] = useState("");
  const [otModalOpen, setOtModalOpen] = useState(false);
  const [otForm, setOtForm] = useState({
    worker_id: "",
    log_date: new Date().toISOString().slice(0, 10),
    normal_hours: "8",
    overtime_hours: "2",
    multiplier: "1.5",
    truck_no: "",
    job_reference: "",
    reason: "",
  });

  // Payroll Period State
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [payrollDeductions, setPayrollDeductions] = useState<Record<string, number>>({});
  const [payrollAllowances, setPayrollAllowances] = useState<Record<string, number>>({});

  // Payslip Modal
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const [activePayslip, setActivePayslip] = useState<PayrollRecord | null>(null);
  const payslipPrintRef = useRef<HTMLDivElement>(null);

  // Load Workers
  const loadWorkers = async () => {
    setLoadingWorkers(true);
    const storageKey = `mc_staff_workers_${orgId || "default"}`;
    try {
      if (orgId) {
        const { data, error } = await supabase
          .from("staff_workers" as any)
          .select("*")
          .eq("organisation_id", orgId)
          .order("full_name");

        if (!error && data && data.length > 0) {
          const mapped: StaffWorker[] = data.map((d: any) => ({
            id: d.id,
            organisation_id: d.organisation_id,
            employee_id: d.employee_id || `EMP-${d.id.slice(0, 4)}`,
            full_name: d.full_name,
            department: d.department || "Fleet Operations",
            designation: d.designation || "Staff",
            employment_type: d.employment_type || "permanent",
            phone: d.phone || "",
            email: d.email || "",
            national_id: d.national_id || "",
            base_salary_tzs: Number(d.base_salary_tzs || 0),
            base_salary_usd: Number(d.base_salary_usd || 0),
            overtime_rate_tzs: Number(d.overtime_rate_tzs || 0),
            daily_posho_tzs: Number(d.daily_posho_tzs || 0),
            payment_method: d.payment_method || "bank",
            bank_name: d.bank_name || "",
            bank_account_no: d.bank_account_no || "",
            mobile_money_number: d.mobile_money_number || "",
            status: d.status || "active",
            notes: d.notes || "",
            created_at: d.created_at,
          }));
          setWorkers(mapped);
          localStorage.setItem(storageKey, JSON.stringify(mapped));
          setLoadingWorkers(false);
          return;
        }
      }

      const cached = localStorage.getItem(storageKey);
      if (cached) {
        setWorkers(JSON.parse(cached));
      } else {
        setWorkers(DEFAULT_SAMPLE_WORKERS);
        localStorage.setItem(storageKey, JSON.stringify(DEFAULT_SAMPLE_WORKERS));
      }
    } catch (err) {
      console.warn("Workers fetch fallback:", err);
      const cached = localStorage.getItem(storageKey);
      if (cached) setWorkers(JSON.parse(cached));
      else setWorkers(DEFAULT_SAMPLE_WORKERS);
    } finally {
      setLoadingWorkers(false);
    }
  };

  // Load Overtime Logs
  const loadOvertime = async () => {
    const storageKey = `mc_staff_overtime_${orgId || "default"}`;
    try {
      if (orgId) {
        const { data, error } = await supabase
          .from("staff_overtime_logs" as any)
          .select("*, worker:staff_workers(full_name, department)")
          .eq("organisation_id", orgId)
          .order("log_date", { ascending: false });

        if (!error && data && data.length > 0) {
          const mapped: OvertimeLog[] = data.map((d: any) => ({
            id: d.id,
            organisation_id: d.organisation_id,
            worker_id: d.worker_id,
            worker_name: d.worker?.full_name || "Unknown Worker",
            department: d.worker?.department || "Operations",
            log_date: d.log_date,
            normal_hours: Number(d.normal_hours || 8),
            overtime_hours: Number(d.overtime_hours || 0),
            hourly_rate_tzs: Number(d.hourly_rate_tzs || 0),
            multiplier: 1.5,
            overtime_amount_tzs: Number(d.overtime_amount_tzs || 0),
            truck_no: d.truck_no || "--",
            job_reference: d.job_reference || "",
            reason: d.reason || "",
            status: d.status || "pending",
            notes: d.notes || "",
          }));
          setOvertimeLogs(mapped);
          localStorage.setItem(storageKey, JSON.stringify(mapped));
          return;
        }
      }

      const cached = localStorage.getItem(storageKey);
      if (cached) {
        setOvertimeLogs(JSON.parse(cached));
      } else {
        setOvertimeLogs(DEFAULT_SAMPLE_OVERTIME);
        localStorage.setItem(storageKey, JSON.stringify(DEFAULT_SAMPLE_OVERTIME));
      }
    } catch (err) {
      console.warn("Overtime fetch fallback:", err);
      const cached = localStorage.getItem(storageKey);
      if (cached) setOvertimeLogs(JSON.parse(cached));
      else setOvertimeLogs(DEFAULT_SAMPLE_OVERTIME);
    }
  };

  useEffect(() => {
    loadWorkers();
    loadOvertime();
  }, [orgId]);

  // Handle Save Worker
  const handleSaveWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerForm.full_name.trim()) {
      toast.error("Worker full name is required");
      return;
    }

    const empId = workerForm.employee_id.trim() || `EMP-${Date.now().toString().slice(-4)}`;
    const baseTzs = parseFloat(workerForm.base_salary_tzs) || 0;
    const baseUsd = parseFloat(workerForm.base_salary_usd) || 0;

    // Auto compute overtime rate if empty: Base / (26 days * 8 hrs) * 1.5
    let otRate = parseFloat(workerForm.overtime_rate_tzs);
    if (isNaN(otRate) || otRate <= 0) {
      otRate = baseTzs > 0 ? Math.round((baseTzs / 208) * 1.5) : 5000;
    }
    const poshoRate = parseFloat(workerForm.daily_posho_tzs) || 0;

    const storageKey = `mc_staff_workers_${orgId || "default"}`;

    if (editingWorkerId) {
      const updated = workers.map((w) => {
        if (w.id === editingWorkerId) {
          return {
            ...w,
            employee_id: empId,
            full_name: workerForm.full_name.trim(),
            department: workerForm.department,
            designation: workerForm.designation.trim(),
            employment_type: workerForm.employment_type,
            phone: workerForm.phone.trim(),
            email: workerForm.email.trim(),
            national_id: workerForm.national_id.trim(),
            base_salary_tzs: baseTzs,
            base_salary_usd: baseUsd,
            overtime_rate_tzs: otRate,
            daily_posho_tzs: poshoRate,
            payment_method: workerForm.payment_method,
            bank_name: workerForm.bank_name.trim(),
            bank_account_no: workerForm.bank_account_no.trim(),
            mobile_money_number: workerForm.mobile_money_number.trim(),
            status: workerForm.status,
            notes: workerForm.notes.trim(),
          };
        }
        return w;
      });
      setWorkers(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));

      if (orgId && !editingWorkerId.startsWith("w-")) {
        try {
          await supabase
            .from("staff_workers" as any)
            .update({
              employee_id: empId,
              full_name: workerForm.full_name.trim(),
              department: workerForm.department,
              designation: workerForm.designation.trim(),
              employment_type: workerForm.employment_type,
              phone: workerForm.phone.trim(),
              email: workerForm.email.trim() || null,
              national_id: workerForm.national_id.trim() || null,
              base_salary_tzs: baseTzs,
              base_salary_usd: baseUsd,
              overtime_rate_tzs: otRate,
              daily_posho_tzs: poshoRate,
              payment_method: workerForm.payment_method,
              bank_name: workerForm.bank_name.trim() || null,
              bank_account_no: workerForm.bank_account_no.trim() || null,
              mobile_money_number: workerForm.mobile_money_number.trim() || null,
              status: workerForm.status,
              notes: workerForm.notes.trim() || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", editingWorkerId);
        } catch (err) {
          console.warn("Worker update sync failed:", err);
        }
      }
      toast.success("Worker updated successfully");
    } else {
      const newId = `w-${Date.now()}`;
      const newWorker: StaffWorker = {
        id: newId,
        organisation_id: orgId,
        employee_id: empId,
        full_name: workerForm.full_name.trim(),
        department: workerForm.department,
        designation: workerForm.designation.trim(),
        employment_type: workerForm.employment_type,
        phone: workerForm.phone.trim(),
        email: workerForm.email.trim(),
        national_id: workerForm.national_id.trim(),
        base_salary_tzs: baseTzs,
        base_salary_usd: baseUsd,
        overtime_rate_tzs: otRate,
        daily_posho_tzs: poshoRate,
        payment_method: workerForm.payment_method,
        bank_name: workerForm.bank_name.trim(),
        bank_account_no: workerForm.bank_account_no.trim(),
        mobile_money_number: workerForm.mobile_money_number.trim(),
        status: workerForm.status,
        notes: workerForm.notes.trim(),
        created_at: new Date().toISOString(),
      };

      if (orgId) {
        try {
          const { data, error } = await supabase
            .from("staff_workers" as any)
            .insert({
              organisation_id: orgId,
              employee_id: newWorker.employee_id,
              full_name: newWorker.full_name,
              department: newWorker.department,
              designation: newWorker.designation,
              employment_type: newWorker.employment_type,
              phone: newWorker.phone,
              email: newWorker.email || null,
              national_id: newWorker.national_id || null,
              base_salary_tzs: newWorker.base_salary_tzs,
              base_salary_usd: newWorker.base_salary_usd,
              overtime_rate_tzs: newWorker.overtime_rate_tzs,
              daily_posho_tzs: newWorker.daily_posho_tzs,
              payment_method: newWorker.payment_method,
              bank_name: newWorker.bank_name || null,
              bank_account_no: newWorker.bank_account_no || null,
              mobile_money_number: newWorker.mobile_money_number || null,
              status: newWorker.status,
              notes: newWorker.notes || null,
            })
            .select()
            .single();

          if (!error && data) {
            newWorker.id = data.id;
          }
        } catch (err) {
          console.warn("Worker create Supabase fallback:", err);
        }
      }

      const updated = [...workers, newWorker];
      setWorkers(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      toast.success("New company worker registered");
    }

    setWorkerModalOpen(false);
    resetWorkerForm();
  };

  const resetWorkerForm = () => {
    setEditingWorkerId(null);
    setWorkerForm({
      employee_id: "",
      full_name: "",
      department: STAFF_DEPARTMENTS[0],
      designation: "Driver",
      employment_type: "permanent",
      phone: "",
      email: "",
      national_id: "",
      base_salary_tzs: "",
      base_salary_usd: "",
      overtime_rate_tzs: "",
      daily_posho_tzs: "",
      payment_method: "bank",
      bank_name: "",
      bank_account_no: "",
      mobile_money_number: "",
      status: "active",
      notes: "",
    });
  };

  const handleEditWorker = (w: StaffWorker) => {
    setEditingWorkerId(w.id);
    setWorkerForm({
      employee_id: w.employee_id,
      full_name: w.full_name,
      department: w.department,
      designation: w.designation,
      employment_type: w.employment_type,
      phone: w.phone || "",
      email: w.email || "",
      national_id: w.national_id || "",
      base_salary_tzs: w.base_salary_tzs ? String(w.base_salary_tzs) : "",
      base_salary_usd: w.base_salary_usd ? String(w.base_salary_usd) : "",
      overtime_rate_tzs: w.overtime_rate_tzs ? String(w.overtime_rate_tzs) : "",
      daily_posho_tzs: w.daily_posho_tzs ? String(w.daily_posho_tzs) : "",
      payment_method: w.payment_method || "bank",
      bank_name: w.bank_name || "",
      bank_account_no: w.bank_account_no || "",
      mobile_money_number: w.mobile_money_number || "",
      status: w.status,
      notes: w.notes || "",
    });
    setWorkerModalOpen(true);
  };

  const handleDeleteWorker = (id: string) => {
    if (!window.confirm("Remove this worker from payroll registry?")) return;
    const storageKey = `mc_staff_workers_${orgId || "default"}`;
    const updated = workers.filter((w) => w.id !== id);
    setWorkers(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));

    if (orgId && !id.startsWith("w-")) {
      supabase.from("staff_workers" as any).delete().eq("id", id).catch(console.warn);
    }
    toast.success("Worker removed");
  };

  // Quick Import from Drivers & Technicians
  const handleImportFleetCrew = async () => {
    try {
      // 1. Fetch Drivers
      const { data: drivers } = await supabase.from("drivers").select("id, full_name, phone");
      // 2. Fetch Technicians / Team Profiles
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, role");

      let count = 0;
      const existingNames = new Set(workers.map((w) => w.full_name.toLowerCase()));
      const newItems: StaffWorker[] = [];

      if (drivers) {
        for (const d of drivers) {
          if (!existingNames.has(d.full_name.toLowerCase())) {
            newItems.push({
              id: `w-driver-${d.id}`,
              employee_id: `DRV-${d.id.slice(0, 4)}`,
              full_name: d.full_name,
              department: "Fleet Operations",
              designation: "Heavy Commercial Driver",
              employment_type: "permanent",
              phone: d.phone || "",
              base_salary_tzs: 850000,
              base_salary_usd: 330,
              overtime_rate_tzs: 6000,
              daily_posho_tzs: 30000,
              payment_method: "mpesa",
              status: "active",
            });
            existingNames.add(d.full_name.toLowerCase());
            count++;
          }
        }
      }

      if (profiles) {
        for (const p of profiles) {
          if (p.full_name && !existingNames.has(p.full_name.toLowerCase())) {
            newItems.push({
              id: `w-profile-${p.id}`,
              employee_id: `STF-${p.id.slice(0, 4)}`,
              full_name: p.full_name,
              department: p.role?.includes("tech") ? "Workshop & Engineering" : "Administration & HR",
              designation: p.role || "Specialist",
              employment_type: "permanent",
              phone: "",
              email: p.email || "",
              base_salary_tzs: 1100000,
              base_salary_usd: 420,
              overtime_rate_tzs: 8000,
              daily_posho_tzs: 20000,
              payment_method: "bank",
              status: "active",
            });
            existingNames.add(p.full_name.toLowerCase());
            count++;
          }
        }
      }

      if (count > 0) {
        const combined = [...workers, ...newItems];
        setWorkers(combined);
        const storageKey = `mc_staff_workers_${orgId || "default"}`;
        localStorage.setItem(storageKey, JSON.stringify(combined));
        toast.success(`Imported ${count} fleet personnel into Payroll Registry!`);
      } else {
        toast.info("All existing drivers and staff are already in the payroll registry.");
      }
    } catch (err) {
      toast.error("Failed to import personnel: " + String(err));
    }
  };

  // Add Overtime Claim
  const handleSaveOvertime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otForm.worker_id) {
      toast.error("Please select a worker");
      return;
    }

    const worker = workers.find((w) => w.id === otForm.worker_id);
    if (!worker) {
      toast.error("Worker not found");
      return;
    }

    const hours = parseFloat(otForm.overtime_hours) || 0;
    const mult = parseFloat(otForm.multiplier) || 1.5;
    const rate = worker.overtime_rate_tzs || 6000;
    const otAmount = Math.round(hours * rate * mult);

    const storageKey = `mc_staff_overtime_${orgId || "default"}`;

    const newLog: OvertimeLog = {
      id: `ot-${Date.now()}`,
      organisation_id: orgId,
      worker_id: worker.id,
      worker_name: worker.full_name,
      department: worker.department,
      log_date: otForm.log_date,
      normal_hours: parseFloat(otForm.normal_hours) || 8,
      overtime_hours: hours,
      hourly_rate_tzs: rate,
      multiplier: mult,
      overtime_amount_tzs: otAmount,
      truck_no: otForm.truck_no.trim() || "--",
      job_reference: otForm.job_reference.trim() || "",
      reason: otForm.reason.trim() || "Extended operational shift",
      status: "pending",
      created_at: new Date().toISOString(),
    };

    if (orgId && !worker.id.startsWith("w-")) {
      try {
        const { data, error } = await supabase
          .from("staff_overtime_logs" as any)
          .insert({
            organisation_id: orgId,
            worker_id: worker.id,
            log_date: newLog.log_date,
            normal_hours: newLog.normal_hours,
            overtime_hours: newLog.overtime_hours,
            hourly_rate_tzs: newLog.hourly_rate_tzs,
            overtime_amount_tzs: newLog.overtime_amount_tzs,
            truck_no: newLog.truck_no === "--" ? null : newLog.truck_no,
            job_reference: newLog.job_reference || null,
            reason: newLog.reason || null,
            status: "pending",
          })
          .select()
          .single();

        if (!error && data) {
          newLog.id = data.id;
        }
      } catch (err) {
        console.warn("Supabase OT insert fallback:", err);
      }
    }

    const updated = [newLog, ...overtimeLogs];
    setOvertimeLogs(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    toast.success(`Overtime logged for ${worker.full_name}: TZS ${otAmount.toLocaleString()}`);

    setOtModalOpen(false);
    setOtForm({
      worker_id: "",
      log_date: new Date().toISOString().slice(0, 10),
      normal_hours: "8",
      overtime_hours: "2",
      multiplier: "1.5",
      truck_no: "",
      job_reference: "",
      reason: "",
    });
  };

  // Toggle Overtime Approval
  const handleToggleOtStatus = (id: string, newStatus: "approved" | "rejected") => {
    const storageKey = `mc_staff_overtime_${orgId || "default"}`;
    const updated = overtimeLogs.map((log) => {
      if (log.id === id) {
        return { ...log, status: newStatus };
      }
      return log;
    });
    setOvertimeLogs(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));

    if (orgId && !id.startsWith("ot-")) {
      supabase
        .from("staff_overtime_logs" as any)
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", id)
        .catch(console.warn);
    }
    toast.success(`Overtime claim marked as ${newStatus}`);
  };

  // Filtered Workers
  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      const matchSearch =
        w.full_name.toLowerCase().includes(workerSearch.toLowerCase()) ||
        w.employee_id.toLowerCase().includes(workerSearch.toLowerCase()) ||
        w.designation.toLowerCase().includes(workerSearch.toLowerCase());
      const matchDept = workerDeptFilter === "all" || w.department === workerDeptFilter;
      return matchSearch && matchDept;
    });
  }, [workers, workerSearch, workerDeptFilter]);

  // Filtered Overtime
  const filteredOvertime = useMemo(() => {
    return overtimeLogs.filter((l) => {
      const matchSearch =
        (l.worker_name || "").toLowerCase().includes(otSearch.toLowerCase()) ||
        (l.truck_no || "").toLowerCase().includes(otSearch.toLowerCase()) ||
        (l.reason || "").toLowerCase().includes(otSearch.toLowerCase());
      return matchSearch;
    });
  }, [overtimeLogs, otSearch]);

  // Aggregate Payroll for Month
  const monthlyPayrollRegister: PayrollRecord[] = useMemo(() => {
    return workers.map((worker) => {
      // Find all approved overtime logs for this worker in selected month & year
      const workerOtLogs = overtimeLogs.filter((l) => {
        if (l.worker_id !== worker.id) return false;
        if (l.status !== "approved") return false;
        const [y, m] = l.log_date.split("-").map(Number);
        return y === selectedYear && m === selectedMonth;
      });

      const totalOtHours = workerOtLogs.reduce((sum, l) => sum + (l.overtime_hours || 0), 0);
      const totalOtPay = workerOtLogs.reduce((sum, l) => sum + (l.overtime_amount_tzs || 0), 0);

      const allowances = payrollAllowances[worker.id] ?? (worker.daily_posho_tzs > 0 ? worker.daily_posho_tzs * 4 : 0);
      const deductions = payrollDeductions[worker.id] ?? 0;
      const netPay = (worker.base_salary_tzs || 0) + totalOtPay + allowances - deductions;

      return {
        id: `pay-${worker.id}-${selectedYear}-${selectedMonth}`,
        worker_id: worker.id,
        worker_name: worker.full_name,
        employee_id: worker.employee_id,
        department: worker.department,
        designation: worker.designation,
        payroll_month: selectedMonth,
        payroll_year: selectedYear,
        base_salary_tzs: worker.base_salary_tzs || 0,
        overtime_hours_total: totalOtHours,
        overtime_pay_tzs: totalOtPay,
        allowances_tzs: allowances,
        deductions_tzs: deductions,
        net_salary_tzs: Math.max(0, netPay),
        payment_status: "approved",
        payment_method: worker.payment_method,
      };
    });
  }, [workers, overtimeLogs, selectedMonth, selectedYear, payrollAllowances, payrollDeductions]);

  // Payroll Totals
  const payrollTotals = useMemo(() => {
    return monthlyPayrollRegister.reduce(
      (acc, cur) => {
        acc.base += cur.base_salary_tzs;
        acc.overtime += cur.overtime_pay_tzs;
        acc.allowances += cur.allowances_tzs;
        acc.deductions += cur.deductions_tzs;
        acc.net += cur.net_salary_tzs;
        acc.totalOtHours += cur.overtime_hours_total;
        return acc;
      },
      { base: 0, overtime: 0, allowances: 0, deductions: 0, net: 0, totalOtHours: 0 }
    );
  }, [monthlyPayrollRegister]);

  // Export Payroll to CSV
  const handleExportPayrollCSV = () => {
    const headers = [
      "EMP ID",
      "FULL NAME",
      "DEPARTMENT",
      "DESIGNATION",
      "BASE SALARY TZS",
      "OT HOURS",
      "OVERTIME PAY TZS",
      "ALLOWANCES TZS",
      "DEDUCTIONS TZS",
      "NET PAY TZS",
      "PAYMENT METHOD",
      "MONTH",
      "YEAR",
    ];

    const rows = monthlyPayrollRegister.map((r) => [
      r.employee_id,
      `"${r.worker_name}"`,
      `"${r.department}"`,
      `"${r.designation}"`,
      Math.round(r.base_salary_tzs),
      r.overtime_hours_total.toFixed(1),
      Math.round(r.overtime_pay_tzs),
      Math.round(r.allowances_tzs),
      Math.round(r.deductions_tzs),
      Math.round(r.net_salary_tzs),
      r.payment_method,
      MONTH_NAMES[selectedMonth - 1],
      selectedYear,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Payroll_Register_${MONTH_NAMES[selectedMonth - 1]}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Payroll register exported to CSV");
  };

  const handleOpenPayslip = (record: PayrollRecord) => {
    setActivePayslip(record);
    setPayslipModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <FinanceNavHeader
        title="Staff Payroll, Wages & Overtime Control"
        subtitle="Manage company workers across fleet operations, workshop mechanics, drivers, and logistics staff. Control base salaries, hourly overtime, posho allowances, and generate monthly payslips."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportFleetCrew}
              className="text-xs font-semibold gap-1.5"
            >
              <Users className="h-3.5 w-3.5" />
              Sync Fleet Drivers & Team
            </Button>
            <Button
              size="sm"
              onClick={() => {
                resetWorkerForm();
                setWorkerModalOpen(true);
              }}
              className="text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Worker
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 border border-border p-1.5 rounded-xl">
        <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg p-1">
          <button
            type="button"
            onClick={() => setActiveTab("workers")}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all",
              activeTab === "workers"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="h-3.5 w-3.5" /> Worker Registry & Salary ({workers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("overtime")}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all",
              activeTab === "overtime"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Clock className="h-3.5 w-3.5" /> Overtime & Shift Claims ({overtimeLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("payroll")}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all",
              activeTab === "payroll"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Banknote className="h-3.5 w-3.5" /> Monthly Payroll Sheet & Payslips
          </button>
        </div>

        {/* Quick KPI in header */}
        <div className="hidden sm:flex items-center gap-3 text-xs pr-2">
          <div className="text-right">
            <span className="text-muted-foreground block text-[10px] uppercase font-bold">Monthly Base Wages</span>
            <span className="font-mono font-bold text-foreground">
              TZS {Math.round(payrollTotals.base).toLocaleString()}
            </span>
          </div>
          <div className="h-6 w-px bg-border" />
          <div className="text-right">
            <span className="text-muted-foreground block text-[10px] uppercase font-bold">Approved OT Pay</span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
              TZS {Math.round(payrollTotals.overtime).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: WORKERS & SALARIES */}
      {/* ========================================================================= */}
      {activeTab === "workers" && (
        <div className="space-y-4">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Active Staff</span>
              <div className="mt-1 text-2xl font-black text-foreground">
                {workers.filter((w) => w.status === "active").length} <span className="text-xs text-muted-foreground font-normal">/ {workers.length} registered</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Drivers, mechanics & logistics personnel</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Monthly Wage Bill</span>
              <div className="mt-1 text-2xl font-black font-mono text-foreground">
                TZS {Math.round(workers.reduce((s, w) => s + (w.base_salary_tzs || 0), 0)).toLocaleString()}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Contracted regular monthly payroll base</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">USD Base Equivalent</span>
              <div className="mt-1 text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                ${workers.reduce((s, w) => s + (w.base_salary_usd || 0), 0).toLocaleString()}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Cross-border driver base allocation</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Avg. Overtime Rate</span>
              <div className="mt-1 text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
                TZS {workers.length > 0 ? Math.round(workers.reduce((s, w) => s + (w.overtime_rate_tzs || 0), 0) / workers.length).toLocaleString() : 0} <span className="text-xs text-muted-foreground font-normal">/hr</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Benchmark rate across workshop & road crew</p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20 border border-border p-3 rounded-xl">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search worker name, ID, role..."
                  value={workerSearch}
                  onChange={(e) => setWorkerSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-background"
                />
              </div>

              <Select value={workerDeptFilter} onValueChange={setWorkerDeptFilter}>
                <SelectTrigger className="h-8 text-xs w-48 bg-background">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments ({workers.length})</SelectItem>
                  {STAFF_DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              size="sm"
              onClick={() => {
                resetWorkerForm();
                setWorkerModalOpen(true);
              }}
              className="h-8 text-xs font-bold gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Worker
            </Button>
          </div>

          {/* Workers Table */}
          <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted/50 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3">Emp ID</th>
                    <th className="py-3 px-3">Worker Name</th>
                    <th className="py-3 px-3">Department & Role</th>
                    <th className="py-3 px-3 text-right">Base Salary (TZS)</th>
                    <th className="py-3 px-3 text-right">USD Base</th>
                    <th className="py-3 px-3 text-right">OT Rate (TZS/hr)</th>
                    <th className="py-3 px-3 text-right">Daily Posho</th>
                    <th className="py-3 px-3">Payment Channel</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-2 text-center w-16">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-sans">
                  {filteredWorkers.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-muted-foreground">
                        No workers found. Click "Add Worker" or "Sync Fleet Drivers & Team" to populate.
                      </td>
                    </tr>
                  ) : (
                    filteredWorkers.map((w) => (
                      <tr key={w.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="py-2.5 px-3 font-mono font-bold text-muted-foreground">{w.employee_id}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-foreground">{w.full_name}</div>
                          <div className="text-[11px] text-muted-foreground">{w.phone || w.email || "--"}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className="text-[10px] font-semibold">
                            {w.department}
                          </Badge>
                          <div className="text-[11px] text-foreground font-medium mt-0.5">{w.designation}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                          {Math.round(w.base_salary_tzs).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                          {w.base_salary_usd > 0 ? `$${w.base_salary_usd.toFixed(2)}` : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                          {Math.round(w.overtime_rate_tzs).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                          {w.daily_posho_tzs > 0 ? Math.round(w.daily_posho_tzs).toLocaleString() : "-"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="capitalize font-medium text-foreground">{w.payment_method}</span>
                          {w.bank_name && (
                            <span className="block text-[10px] text-muted-foreground">{w.bank_name}</span>
                          )}
                          {w.mobile_money_number && (
                            <span className="block text-[10px] text-muted-foreground">{w.mobile_money_number}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge
                            className={cn(
                              "text-[10px] capitalize",
                              w.status === "active"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {w.status.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              onClick={() => handleEditWorker(w)}
                              title="Edit Worker"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                              onClick={() => handleDeleteWorker(w.id)}
                              title="Delete Worker"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: OVERTIME LOGS & APPROVALS */}
      {/* ========================================================================= */}
      {activeTab === "overtime" && (
        <div className="space-y-4">
          {/* Overtime Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20 border border-border p-3 rounded-xl">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search worker, truck, reason..."
                  value={otSearch}
                  onChange={(e) => setOtSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-background"
                />
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => setOtModalOpen(true)}
              className="h-8 text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Log Overtime Hours
            </Button>
          </div>

          {/* Overtime Table */}
          <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted/50 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Worker Name</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3 text-right">OT Hours</th>
                    <th className="py-3 px-3 text-right">Hourly Rate (TZS)</th>
                    <th className="py-3 px-3 text-center">Multiplier</th>
                    <th className="py-3 px-3 text-right">Overtime Pay (TZS)</th>
                    <th className="py-3 px-3">Truck / Job Ref</th>
                    <th className="py-3 px-3">Reason / Details</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-2 text-center w-28">Approval</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-sans">
                  {filteredOvertime.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-muted-foreground">
                        No overtime claims recorded yet. Click "Log Overtime Hours" to register extra shifts.
                      </td>
                    </tr>
                  ) : (
                    filteredOvertime.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="py-2.5 px-3 font-mono text-muted-foreground">{log.log_date}</td>
                        <td className="py-2.5 px-3 font-bold text-foreground">{log.worker_name}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{log.department}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                          {log.overtime_hours} hrs
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                          {Math.round(log.hourly_rate_tzs).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          <Badge variant="outline" className="text-[10px]">
                            {log.multiplier || 1.5}x
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-foreground">
                          TZS {Math.round(log.overtime_amount_tzs).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-muted-foreground">
                          {log.truck_no && log.truck_no !== "--" ? (
                            <span className="inline-flex items-center gap-1 font-bold text-foreground">
                              <Truck className="h-3 w-3 text-muted-foreground" />
                              {log.truck_no}
                            </span>
                          ) : (
                            log.job_reference || "--"
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground max-w-xs truncate" title={log.reason}>
                          {log.reason || "--"}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge
                            className={cn(
                              "text-[10px] capitalize",
                              log.status === "approved"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                : log.status === "rejected"
                                ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                            )}
                          >
                            {log.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          {log.status === "pending" ? (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px] font-bold text-emerald-600 hover:bg-emerald-500/10"
                                onClick={() => handleToggleOtStatus(log.id, "approved")}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px] font-bold text-rose-600 hover:bg-rose-500/10"
                                onClick={() => handleToggleOtStatus(log.id, "rejected")}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              {log.status === "approved" ? "Verified" : "Declined"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MONTHLY PAYROLL REGISTER & PAYSLIPS */}
      {/* ========================================================================= */}
      {activeTab === "payroll" && (
        <div className="space-y-4">
          {/* Month Selector & Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border p-3.5 rounded-xl shadow-xs">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <div className="flex items-center gap-1.5">
                <Select
                  value={String(selectedMonth)}
                  onValueChange={(val) => setSelectedMonth(Number(val))}
                >
                  <SelectTrigger className="h-8 text-xs font-bold w-36 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, idx) => (
                      <SelectItem key={idx} value={String(idx + 1)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={String(selectedYear)}
                  onValueChange={(val) => setSelectedYear(Number(val))}
                >
                  <SelectTrigger className="h-8 text-xs font-bold w-24 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2025, 2026, 2027].map((yr) => (
                      <SelectItem key={yr} value={String(yr)}>
                        {yr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPayrollCSV}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Export Payroll Sheet (CSV)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Register
              </Button>
            </div>
          </div>

          {/* Monthly Totals Breakdown Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Base Monthly Wages</span>
              <div className="mt-1 text-lg font-black font-mono text-foreground">
                TZS {Math.round(payrollTotals.base).toLocaleString()}
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 shadow-xs">
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">Approved Overtime</span>
              <div className="mt-1 text-lg font-black font-mono text-amber-950 dark:text-amber-200">
                TZS {Math.round(payrollTotals.overtime).toLocaleString()}
              </div>
              <span className="text-[10px] text-muted-foreground">{payrollTotals.totalOtHours} total hours logged</span>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 shadow-xs">
              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase">Posho & Allowances</span>
              <div className="mt-1 text-lg font-black font-mono text-blue-950 dark:text-blue-200">
                TZS {Math.round(payrollTotals.allowances).toLocaleString()}
              </div>
            </div>

            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 shadow-xs">
              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase">Deductions (Loans / NSSF)</span>
              <div className="mt-1 text-lg font-black font-mono text-rose-950 dark:text-rose-200">
                TZS {Math.round(payrollTotals.deductions).toLocaleString()}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 shadow-xs">
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">Total Net Disbursement</span>
              <div className="mt-1 text-lg font-black font-mono text-emerald-950 dark:text-emerald-100">
                TZS {Math.round(payrollTotals.net).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Full Monthly Payroll Table */}
          <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted/50 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3">Emp ID</th>
                    <th className="py-3 px-3">Employee Name</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3 text-right">Base Salary (TZS)</th>
                    <th className="py-3 px-3 text-right">OT Hours</th>
                    <th className="py-3 px-3 text-right">Overtime Pay (TZS)</th>
                    <th className="py-3 px-3 text-right">Posho / Allowances</th>
                    <th className="py-3 px-3 text-right">Deductions</th>
                    <th className="py-3 px-3 text-right font-black text-foreground">Net Pay (TZS)</th>
                    <th className="py-3 px-3 text-center">Payslip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-sans">
                  {monthlyPayrollRegister.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-muted-foreground">{row.employee_id}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-foreground">{row.worker_name}</div>
                        <div className="text-[10px] text-muted-foreground">{row.designation}</div>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">{row.department}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-foreground">
                        {Math.round(row.base_salary_tzs).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-600 dark:text-amber-400">
                        {row.overtime_hours_total > 0 ? `${row.overtime_hours_total}h` : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                        {row.overtime_pay_tzs > 0 ? Math.round(row.overtime_pay_tzs).toLocaleString() : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-blue-600 dark:text-blue-400">
                        {row.allowances_tzs > 0 ? Math.round(row.allowances_tzs).toLocaleString() : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-600 dark:text-rose-400">
                        {row.deductions_tzs > 0 ? Math.round(row.deductions_tzs).toLocaleString() : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                        TZS {Math.round(row.net_salary_tzs).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px] font-bold gap-1"
                          onClick={() => handleOpenPayslip(row)}
                        >
                          <Printer className="h-3 w-3" />
                          Slip
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/80 border-t-2 border-border font-extrabold text-foreground">
                    <td colSpan={3} className="py-3 px-3 text-right uppercase tracking-wider text-[11px]">
                      Monthly Payroll Totals:
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      TZS {Math.round(payrollTotals.base).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-amber-600 dark:text-amber-400">
                      {payrollTotals.totalOtHours}h
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-amber-600 dark:text-amber-400">
                      TZS {Math.round(payrollTotals.overtime).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-blue-600 dark:text-blue-400">
                      TZS {Math.round(payrollTotals.allowances).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-rose-600 dark:text-rose-400">
                      TZS {Math.round(payrollTotals.deductions).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                      TZS {Math.round(payrollTotals.net).toLocaleString()}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT WORKER */}
      {/* ========================================================================= */}
      <Dialog open={workerModalOpen} onOpenChange={setWorkerModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingWorkerId ? "Edit Company Worker" : "Register Company Worker"}</DialogTitle>
            <DialogDescription>
              Set base monthly salaries, hourly overtime rates, and payment credentials.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveWorker} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Employee / Worker ID</Label>
                <Input
                  placeholder="e.g. EMP-0106"
                  value={workerForm.employee_id}
                  onChange={(e) => setWorkerForm({ ...workerForm, employee_id: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Full Name *</Label>
                <Input
                  placeholder="e.g. Juma Ally Baraka"
                  value={workerForm.full_name}
                  onChange={(e) => setWorkerForm({ ...workerForm, full_name: e.target.value })}
                  className="text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Department</Label>
                <Select
                  value={workerForm.department}
                  onValueChange={(val) => setWorkerForm({ ...workerForm, department: val })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Role / Job Title</Label>
                <Input
                  placeholder="e.g. Heavy Commercial Driver, Mechanic"
                  value={workerForm.designation}
                  onChange={(e) => setWorkerForm({ ...workerForm, designation: e.target.value })}
                  className="text-xs"
                  required
                />
              </div>
            </div>

            {/* Compensation Details */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Salary & Overtime Rates
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold">Base Salary (TZS) *</Label>
                  <Input
                    type="number"
                    step="1000"
                    placeholder="900000"
                    value={workerForm.base_salary_tzs}
                    onChange={(e) => setWorkerForm({ ...workerForm, base_salary_tzs: e.target.value })}
                    className="text-xs font-mono"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold">Base USD (Optional)</Label>
                  <Input
                    type="number"
                    step="1"
                    placeholder="350"
                    value={workerForm.base_salary_usd}
                    onChange={(e) => setWorkerForm({ ...workerForm, base_salary_usd: e.target.value })}
                    className="text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold">OT Rate (TZS/hr)</Label>
                  <Input
                    type="number"
                    step="500"
                    placeholder="6500"
                    value={workerForm.overtime_rate_tzs}
                    onChange={(e) => setWorkerForm({ ...workerForm, overtime_rate_tzs: e.target.value })}
                    className="text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold">Daily Posho (TZS)</Label>
                  <Input
                    type="number"
                    step="1000"
                    placeholder="30000"
                    value={workerForm.daily_posho_tzs}
                    onChange={(e) => setWorkerForm({ ...workerForm, daily_posho_tzs: e.target.value })}
                    className="text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Payment & Contact Details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Payment Method</Label>
                <Select
                  value={workerForm.payment_method}
                  onValueChange={(val: any) => setWorkerForm({ ...workerForm, payment_method: val })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Wire / TT</SelectItem>
                    <SelectItem value="mpesa">Vodacom M-Pesa</SelectItem>
                    <SelectItem value="airtel_money">Airtel Money</SelectItem>
                    <SelectItem value="cash">Cash on Hand</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Phone Number</Label>
                <Input
                  placeholder="+255 754 000 000"
                  value={workerForm.phone}
                  onChange={(e) => setWorkerForm({ ...workerForm, phone: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>

            {workerForm.payment_method === "bank" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Bank Name</Label>
                  <Input
                    placeholder="e.g. CRDB Bank, NMB Bank"
                    value={workerForm.bank_name}
                    onChange={(e) => setWorkerForm({ ...workerForm, bank_name: e.target.value })}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Bank Account Number</Label>
                  <Input
                    placeholder="e.g. 0152488392100"
                    value={workerForm.bank_account_no}
                    onChange={(e) => setWorkerForm({ ...workerForm, bank_account_no: e.target.value })}
                    className="text-xs font-mono"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Mobile Money Number</Label>
                <Input
                  placeholder="e.g. +255 767 000 000"
                  value={workerForm.mobile_money_number}
                  onChange={(e) => setWorkerForm({ ...workerForm, mobile_money_number: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setWorkerModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-bold">
                {editingWorkerId ? "Save Changes" : "Register Worker"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: LOG OVERTIME HOURS */}
      {/* ========================================================================= */}
      <Dialog open={otModalOpen} onOpenChange={setOtModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Worker Overtime</DialogTitle>
            <DialogDescription>
              Record extra hours worked on fleet operations, repairs, or late dispatch.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveOvertime} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Select Worker *</Label>
              <Select
                value={otForm.worker_id}
                onValueChange={(val) => setOtForm({ ...otForm, worker_id: val })}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Choose Worker" />
                </SelectTrigger>
                <SelectContent>
                  {workers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.full_name} ({w.designation} - {w.department})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Date of Work</Label>
                <Input
                  type="date"
                  value={otForm.log_date}
                  onChange={(e) => setOtForm({ ...otForm, log_date: e.target.value })}
                  className="text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Overtime Hours *</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="16"
                  placeholder="e.g. 3.5"
                  value={otForm.overtime_hours}
                  onChange={(e) => setOtForm({ ...otForm, overtime_hours: e.target.value })}
                  className="text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Rate Multiplier</Label>
                <Select
                  value={otForm.multiplier}
                  onValueChange={(val) => setOtForm({ ...otForm, multiplier: val })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1.5">1.5x (Standard Weekday Shift)</SelectItem>
                    <SelectItem value="2.0">2.0x (Sunday / Public Holiday)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Truck No (Optional)</Label>
                <Input
                  placeholder="e.g. T 482 DXK"
                  value={otForm.truck_no}
                  onChange={(e) => setOtForm({ ...otForm, truck_no: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Reason / Work Order Details</Label>
              <Input
                placeholder="e.g. Late night brake overhaul, delayed border queue"
                value={otForm.reason}
                onChange={(e) => setOtForm({ ...otForm, reason: e.target.value })}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOtModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-bold">
                Submit Overtime Claim
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 3: CORPORATE PAYSLIP GENERATOR & PRINTER */}
      {/* ========================================================================= */}
      <Dialog open={payslipModalOpen} onOpenChange={setPayslipModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Worker Payslip Voucher</DialogTitle>
            <DialogDescription>
              Official earnings statement for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.
            </DialogDescription>
          </DialogHeader>

          {activePayslip && (
            <div className="border border-border rounded-xl p-5 space-y-4 bg-card" ref={payslipPrintRef}>
              <div className="flex justify-between items-start border-b border-border pb-3">
                <div>
                  <h3 className="font-extrabold text-base tracking-wide text-foreground uppercase">
                    LOGISTIXWARE / MACHINECARE HUB
                  </h3>
                  <p className="text-xs text-muted-foreground">Confidential Employee Salary Voucher</p>
                </div>
                <div className="text-right text-xs">
                  <Badge variant="outline" className="font-bold">
                    {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                  </Badge>
                  <p className="text-muted-foreground mt-1 font-mono text-[11px]">
                    Emp ID: {activePayslip.employee_id}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs py-1 bg-muted/30 p-2.5 rounded-lg">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Worker Name:</span>
                  <span className="font-bold text-foreground">{activePayslip.worker_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Department:</span>
                  <span className="font-semibold text-foreground">{activePayslip.department}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Designation:</span>
                  <span className="text-foreground">{activePayslip.designation}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Payment Method:</span>
                  <span className="capitalize font-mono text-foreground">{activePayslip.payment_method}</span>
                </div>
              </div>

              {/* Earnings Table */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-foreground">Earnings & Allowances</div>
                <div className="divide-y divide-border text-xs">
                  <div className="flex justify-between py-1.5">
                    <span>Base Monthly Salary</span>
                    <span className="font-mono font-bold">
                      TZS {Math.round(activePayslip.base_salary_tzs).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 text-amber-600 dark:text-amber-400">
                    <span>Approved Overtime Pay ({activePayslip.overtime_hours_total} hrs)</span>
                    <span className="font-mono font-bold">
                      TZS {Math.round(activePayslip.overtime_pay_tzs).toLocaleString()}
                    </span>
                  </div>
                  {activePayslip.allowances_tzs > 0 && (
                    <div className="flex justify-between py-1.5 text-blue-600 dark:text-blue-400">
                      <span>Posho & Route Allowances</span>
                      <span className="font-mono font-bold">
                        TZS {Math.round(activePayslip.allowances_tzs).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {activePayslip.deductions_tzs > 0 && (
                    <div className="flex justify-between py-1.5 text-rose-600 dark:text-rose-400">
                      <span>Statutory / Cash Advances Deductions</span>
                      <span className="font-mono font-bold">
                        - TZS {Math.round(activePayslip.deductions_tzs).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Net Pay */}
                <div className="border-t-2 border-primary/30 pt-3 flex justify-between items-center bg-primary/5 p-3 rounded-lg">
                  <div>
                    <span className="text-xs font-extrabold uppercase text-foreground">NET PAYABLE DISBURSEMENT</span>
                    <p className="text-[10px] text-muted-foreground">Cleared for electronic transfer / disbursement</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black font-mono text-primary">
                      TZS {Math.round(activePayslip.net_salary_tzs).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-6 pt-6 text-[11px] text-center">
                <div className="border-t border-dashed border-border pt-2">
                  <p className="font-semibold">Prepared By (Payroll & Accounts)</p>
                </div>
                <div className="border-t border-dashed border-border pt-2">
                  <p className="font-semibold">Worker Acknowledgment / Signature</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setPayslipModalOpen(false)}>
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="bg-primary text-primary-foreground font-bold gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Payslip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
