/**
-- ============================================================================
-- MachineCare Platform - Finance & Commercial Services
-- Bridges freight billing, trip costs, fuel audits, supplier bills, and unit economics.
-- ============================================================================
*/

import { supabase } from "@/integrations/supabase/client";
import { parseCargoMeta } from "@/lib/fleet-metadata";

export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "cancelled";
export type BillStatus = "pending" | "approved" | "paid" | "partially_paid" | "overdue" | "rejected";
export type BillCategory = "fuel" | "spare_parts" | "tyres" | "maintenance" | "insurance_permits" | "facility" | "other";

export interface FinanceInvoiceItem {
  id?: string;
  invoice_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
}

export interface FinanceInvoice {
  id: string;
  organisation_id: string;
  invoice_number: string;
  invoice_year: number;
  client_name: string;
  client_email?: string | null;
  client_phone?: string | null;
  trip_id?: string | null;
  machine_id?: string | null;
  currency: string;
  subtotal: number;
  tax_rate_percent: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  status: InvoiceStatus;
  issued_at: string;
  due_date: string;
  paid_at?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  notes?: string | null;
  created_at?: string;
  items?: FinanceInvoiceItem[];
  machine?: { id: string; name: string; plate_number: string | null } | null;
  trip?: { id: string; origin: string; destination: string; cargo_description: string | null } | null;
}

export interface FinanceSupplierBill {
  id: string;
  organisation_id: string;
  bill_number: string;
  supplier_name: string;
  category: BillCategory;
  amount: number;
  currency: string;
  bill_date: string;
  due_date: string;
  paid_amount: number;
  status: BillStatus;
  machine_id?: string | null;
  trip_id?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  attachment_url?: string | null;
  notes?: string | null;
  approved_by?: string | null;
  created_at?: string;
  machine?: { id: string; name: string; plate_number: string | null } | null;
}

export interface FinancialOverviewMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  operatingMarginPct: number;
  netCashFlow: number;
  arOutstanding: number; // Accounts Receivable
  apOutstanding: number; // Accounts Payable
  fuelTotalCost: number;
  maintenanceTotalCost: number;
  tripExpensesTotal: number;
  uninvoicedTripsCount?: number;
  uninvoicedFreightAmount?: number;
  monthlyTrend: {
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
  }[];
  expenseCategoryBreakdown: {
    category: string;
    amount: number;
    percentage: number;
  }[];
}

export interface VehicleProfitability {
  machineId: string;
  plateNumber: string;
  machineName: string;
  revenue: number;
  fuelCost: number;
  maintenanceCost: number;
  tripExpenses: number;
  totalCost: number;
  netProfit: number;
  marginPct: number;
  kmDriven: number;
  costPerKm: number;
  revenuePerKm: number;
}

export interface ApArAging {
  receivables: {
    current: number; // 0 - 30 days
    days31to60: number;
    days61to90: number;
    days90Plus: number;
    total: number;
    invoices: FinanceInvoice[];
  };
  payables: {
    current: number;
    days31to60: number;
    days61to90: number;
    days90Plus: number;
    total: number;
    bills: FinanceSupplierBill[];
  };
}

export interface FuelFinanceStats {
  totalSpend: number;
  totalLitres: number;
  avgCostPerLitre: number;
  totalKm: number;
  avgCostPerKm: number;
  byStation: { station: string; spend: number; litres: number }[];
  byVehicle: { plate: string; machineName: string; spend: number; litres: number; km: number; cpk: number }[];
}

/**
 * Generate next sequential invoice number per organisation.
 */
export async function getNextFinanceInvoiceNumber(organisationId: string): Promise<string> {
  const currentYear = new Date().getFullYear();
  try {
    const { data: counter } = await (supabase as any)
      .from("org_finance_invoice_counters")
      .select("last_number")
      .eq("organisation_id", organisationId)
      .eq("year", currentYear)
      .maybeSingle();

    const nextNum = (counter?.last_number || 0) + 1;
    await (supabase as any).from("org_finance_invoice_counters").upsert({
      organisation_id: organisationId,
      year: currentYear,
      last_number: nextNum,
    });

    return `INV-${currentYear}-${String(nextNum).padStart(4, "0")}`;
  } catch {
    return `INV-${currentYear}-${String(Math.floor(1000 + Math.random() * 9000))}`;
  }
}

/**
 * Loads executive financial metrics across all tables:
 * - Revenue from finance_invoices & trips
 * - Expenses from fuel_logs, accountant_receipts, trip_expenses, finance_supplier_bills
 */
export async function getFinancialOverview(organisationId: string): Promise<FinancialOverviewMetrics> {
  // Query organisation machines first to accurately scope fuel logs (since fuel_logs links by machine_id)
  const { data: orgMachines } = await (supabase as any)
    .from("machines")
    .select("id")
    .eq("organisation_id", organisationId);
  const machineIds = (orgMachines || []).map((m: any) => m.id);

  let fuelPromise: Promise<any> = Promise.resolve({ data: [] });
  if (machineIds.length > 0) {
    fuelPromise = (supabase as any)
      .from("fuel_logs")
      .select("fuel_cost, fuel_litres, recorded_at, machine_id")
      .in("machine_id", machineIds);
  }

  const [
    { data: invoices },
    { data: bills },
    { data: fuelLogs },
    { data: receipts },
    { data: tripExps },
    { data: trips },
  ] = await Promise.all([
    (supabase as any).from("finance_invoices").select("*").eq("organisation_id", organisationId),
    (supabase as any).from("finance_supplier_bills").select("*").eq("organisation_id", organisationId),
    fuelPromise,
    (supabase as any).from("accountant_receipts").select("amount, category, receipt_type, payment_date").eq("organisation_id", organisationId),
    (supabase as any).from("trip_expenses").select("amount, expense_type, occurred_at").eq("organisation_id", organisationId),
    (supabase as any).from("trips").select("id, cost, cargo_description, start_at, status").eq("organisation_id", organisationId),
  ]);

  // 1. Revenue: Collected Invoices + Accrued Uninvoiced Freight
  const allInvoices: FinanceInvoice[] = invoices || [];
  let invoiceRevenue = 0;
  let arOutstanding = 0;
  const invoicedTripIds = new Set<string>();

  for (const inv of allInvoices) {
    if (inv.trip_id) invoicedTripIds.add(inv.trip_id);
    if (inv.status === "paid") {
      invoiceRevenue += Number(inv.total_amount || 0);
    } else if (inv.status !== "cancelled") {
      invoiceRevenue += Number(inv.paid_amount || 0);
      arOutstanding += Math.max(Number(inv.total_amount || 0) - Number(inv.paid_amount || 0), 0);
    }
  }

  // Calculate uninvoiced trips ready for commercial billing
  let uninvoicedTripsCount = 0;
  let uninvoicedFreightAmount = 0;

  (trips || []).forEach((t: any) => {
    if (!invoicedTripIds.has(t.id)) {
      uninvoicedTripsCount++;
      const meta = parseCargoMeta(t.cargo_description);
      let freight = Number(meta?.client_billing_amount || 0);
      if (freight > 0) {
        const isUsd = (meta?.billing_currency || meta?.currency || "").toUpperCase() === "USD";
        if (isUsd) freight = freight * (Number(meta?.exchange_rate) || 2600);
      } else if (Number(t.cost) > 0) {
        freight = Number(t.cost) * 1.35;
      }
      uninvoicedFreightAmount += freight;
    }
  });

  const totalRevenue = invoiceRevenue > 0 ? invoiceRevenue : Math.round(uninvoicedFreightAmount);

  // 2. Expenses by category
  let fuelTotalCost = 0;
  (fuelLogs || []).forEach((f: any) => {
    fuelTotalCost += Number(f.fuel_cost || 0);
  });

  let maintenanceTotalCost = 0;
  (receipts || []).forEach((r: any) => {
    maintenanceTotalCost += Number(r.amount || 0);
  });

  let tripExpensesTotal = 0;
  (tripExps || []).forEach((e: any) => {
    tripExpensesTotal += Number(e.amount || 0);
  });

  let supplierBillsPaid = 0;
  let apOutstanding = 0;
  const allBills: FinanceSupplierBill[] = bills || [];
  for (const b of allBills) {
    if (b.status === "paid") {
      supplierBillsPaid += Number(b.amount || 0);
    } else if (b.status !== "rejected") {
      supplierBillsPaid += Number(b.paid_amount || 0);
      apOutstanding += Math.max(Number(b.amount || 0) - Number(b.paid_amount || 0), 0);
    }
  }

  const totalExpenses = fuelTotalCost + maintenanceTotalCost + tripExpensesTotal + supplierBillsPaid;
  const netProfit = totalRevenue - totalExpenses;
  const operatingMarginPct = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
  const netCashFlow = totalRevenue - totalExpenses;

  // 3. Category Breakdown
  const totalExpenseSum = Math.max(totalExpenses, 1);
  const expenseCategoryBreakdown = [
    { category: "Fuel & Lubricants", amount: fuelTotalCost, percentage: Math.round((fuelTotalCost / totalExpenseSum) * 100) },
    { category: "Spare Parts & Maintenance", amount: maintenanceTotalCost, percentage: Math.round((maintenanceTotalCost / totalExpenseSum) * 100) },
    { category: "Trip & Driver Expenses", amount: tripExpensesTotal, percentage: Math.round((tripExpensesTotal / totalExpenseSum) * 100) },
    { category: "Supplier & Vendor Bills", amount: supplierBillsPaid, percentage: Math.round((supplierBillsPaid / totalExpenseSum) * 100) },
  ];

  // 4. Monthly Trend (last 6 months)
  const monthMap = new Map<string, { revenue: number; expenses: number }>();
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mKey = d.toLocaleString("default", { month: "short", year: "2-digit" });
    monthMap.set(mKey, { revenue: 0, expenses: 0 });
  }

  // Aggregate invoice revenue into months
  allInvoices.forEach((inv) => {
    if (inv.issued_at) {
      const d = new Date(inv.issued_at);
      const mKey = d.toLocaleString("default", { month: "short", year: "2-digit" });
      if (monthMap.has(mKey)) {
        const entry = monthMap.get(mKey)!;
        entry.revenue += Number(inv.paid_amount || (inv.status === "paid" ? inv.total_amount : 0));
      }
    }
  });

  // Aggregate fuel costs into months
  (fuelLogs || []).forEach((f: any) => {
    if (f.recorded_at) {
      const d = new Date(f.recorded_at);
      const mKey = d.toLocaleString("default", { month: "short", year: "2-digit" });
      if (monthMap.has(mKey)) {
        monthMap.get(mKey)!.expenses += Number(f.fuel_cost || 0);
      }
    }
  });

  // Aggregate maintenance into months
  (receipts || []).forEach((r: any) => {
    if (r.payment_date) {
      const d = new Date(r.payment_date);
      const mKey = d.toLocaleString("default", { month: "short", year: "2-digit" });
      if (monthMap.has(mKey)) {
        monthMap.get(mKey)!.expenses += Number(r.amount || 0);
      }
    }
  });

  const monthlyTrend = Array.from(monthMap.entries()).map(([month, data]) => ({
    month,
    revenue: Math.round(data.revenue),
    expenses: Math.round(data.expenses),
    profit: Math.round(data.revenue - data.expenses),
  }));

  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    operatingMarginPct,
    netCashFlow,
    arOutstanding,
    apOutstanding,
    fuelTotalCost,
    maintenanceTotalCost,
    tripExpensesTotal,
    monthlyTrend,
    expenseCategoryBreakdown,
  };
}

/**
 * Loads all customer invoices with line items and relations.
 */
export async function getFinanceInvoices(
  organisationId: string,
  options?: { status?: string; limit?: number }
): Promise<FinanceInvoice[]> {
  let query = (supabase as any)
    .from("finance_invoices")
    .select(`
      *,
      items:finance_invoice_items(*),
      machine:machines(id, name, plate_number),
      trip:trips(id, origin, destination, cargo_description)
    `)
    .eq("organisation_id", organisationId)
    .order("issued_at", { ascending: false });

  if (options?.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Failed to load invoices:", error);
    return [];
  }
  return data || [];
}

/**
 * Creates a new finance invoice with child line items in Supabase.
 */
export async function createFinanceInvoice(
  organisationId: string,
  payload: {
    client_name: string;
    client_email?: string;
    client_phone?: string;
    trip_id?: string;
    machine_id?: string;
    issued_at?: string;
    due_date?: string;
    tax_rate_percent?: number;
    discount_amount?: number;
    notes?: string;
    items: { description: string; quantity: number; unit_price: number }[];
  }
): Promise<{ success: boolean; invoice?: FinanceInvoice; error?: string }> {
  try {
    const invoiceNumber = await getNextFinanceInvoiceNumber(organisationId);
    const subtotal = (payload.items || []).reduce((sum, item) => sum + (Number(item.quantity || 1) * Number(item.unit_price || 0)), 0);
    const taxRate = Number(payload.tax_rate_percent || 0);
    const taxAmount = Math.round((subtotal * taxRate) / 100);
    const discount = Number(payload.discount_amount || 0);
    const totalAmount = Math.max(subtotal + taxAmount - discount, 0);

    const { data: inv, error: invErr } = await (supabase as any)
      .from("finance_invoices")
      .insert({
        organisation_id: organisationId,
        invoice_number: invoiceNumber,
        client_name: payload.client_name.trim(),
        client_email: payload.client_email?.trim() || null,
        client_phone: payload.client_phone?.trim() || null,
        trip_id: payload.trip_id || null,
        machine_id: payload.machine_id || null,
        subtotal,
        tax_rate_percent: taxRate,
        tax_amount: taxAmount,
        discount_amount: discount,
        total_amount: totalAmount,
        paid_amount: 0,
        status: "sent",
        issued_at: payload.issued_at || new Date().toISOString().slice(0, 10),
        due_date: payload.due_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        notes: payload.notes || null,
      })
      .select()
      .single();

    if (invErr) throw invErr;

    if (payload.items?.length > 0) {
      const lineItems = payload.items.map((it) => ({
        invoice_id: inv.id,
        description: it.description,
        quantity: Number(it.quantity || 1),
        unit_price: Number(it.unit_price || 0),
        total_amount: Number(it.quantity || 1) * Number(it.unit_price || 0),
      }));
      await (supabase as any).from("finance_invoice_items").insert(lineItems);
    }

    return { success: true, invoice: inv };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create invoice" };
  }
}

/**
 * Updates an invoice's payment status or registers payments.
 */
export async function updateFinanceInvoicePayment(
  invoiceId: string,
  payment: {
    paid_amount: number;
    payment_method: string;
    payment_reference?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: current } = await (supabase as any)
      .from("finance_invoices")
      .select("total_amount, paid_amount")
      .eq("id", invoiceId)
      .single();

    if (!current) throw new Error("Invoice not found");

    const newPaidTotal = Number(current.paid_amount || 0) + Number(payment.paid_amount);
    const isFullyPaid = newPaidTotal >= Number(current.total_amount);

    const { error } = await (supabase as any)
      .from("finance_invoices")
      .update({
        paid_amount: newPaidTotal,
        status: isFullyPaid ? "paid" : "partially_paid",
        paid_at: isFullyPaid ? new Date().toISOString() : null,
        payment_method: payment.payment_method,
        payment_reference: payment.payment_reference || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Payment update failed" };
  }
}

/**
 * Loads supplier / vendor bills.
 */
export async function getSupplierBills(
  organisationId: string,
  options?: { status?: string; category?: string }
): Promise<FinanceSupplierBill[]> {
  let query = (supabase as any)
    .from("finance_supplier_bills")
    .select(`
      *,
      machine:machines(id, name, plate_number)
    `)
    .eq("organisation_id", organisationId)
    .order("bill_date", { ascending: false });

  if (options?.status && options.status !== "all") query = query.eq("status", options.status);
  if (options?.category && options.category !== "all") query = query.eq("category", options.category);

  const { data, error } = await query;
  if (error) {
    console.error("Failed to load supplier bills:", error);
    return [];
  }
  return data || [];
}

/**
 * Creates a new supplier bill.
 */
export async function createSupplierBill(
  organisationId: string,
  payload: {
    bill_number: string;
    supplier_name: string;
    category: BillCategory;
    amount: number;
    currency?: string;
    bill_date?: string;
    due_date?: string;
    machine_id?: string;
    trip_id?: string;
    notes?: string;
    attachment_url?: string;
  }
): Promise<{ success: boolean; bill?: FinanceSupplierBill; error?: string }> {
  try {
    const { data, error } = await (supabase as any)
      .from("finance_supplier_bills")
      .insert({
        organisation_id: organisationId,
        bill_number: payload.bill_number.trim(),
        supplier_name: payload.supplier_name.trim(),
        category: payload.category,
        amount: Number(payload.amount || 0),
        currency: payload.currency || "TZS",
        bill_date: payload.bill_date || new Date().toISOString().slice(0, 10),
        due_date: payload.due_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        paid_amount: 0,
        status: "pending",
        machine_id: payload.machine_id || null,
        trip_id: payload.trip_id || null,
        notes: payload.notes || null,
        attachment_url: payload.attachment_url || null,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, bill: data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create supplier bill" };
  }
}

/**
 * Computes individual vehicle profitability and unit economics (Cost Per Kilometer).
 */
export async function getVehicleProfitability(organisationId: string): Promise<VehicleProfitability[]> {
  const { data: machines } = await (supabase as any)
    .from("machines")
    .select("id, name, plate_number, current_odometer_km")
    .eq("organisation_id", organisationId);

  const machineIds = (machines || []).map((m: any) => m.id);

  let fuelPromise: Promise<any> = Promise.resolve({ data: [] });
  if (machineIds.length > 0) {
    fuelPromise = (supabase as any)
      .from("fuel_logs")
      .select("machine_id, fuel_cost, fuel_litres")
      .in("machine_id", machineIds);
  }

  const [
    { data: invoices },
    { data: fuelLogs },
    { data: receipts },
    { data: tripExps },
    { data: trips },
  ] = await Promise.all([
    (supabase as any).from("finance_invoices").select("machine_id, total_amount, paid_amount").eq("organisation_id", organisationId),
    fuelPromise,
    (supabase as any).from("accountant_receipts").select("machine_id, amount").eq("organisation_id", organisationId),
    (supabase as any).from("trip_expenses").select("machine_id, amount").eq("organisation_id", organisationId),
    (supabase as any).from("trips").select("machine_id, start_odo, end_odo, cost").eq("organisation_id", organisationId),
  ]);

  const map = new Map<string, VehicleProfitability>();

  (machines || []).forEach((m: any) => {
    map.set(m.id, {
      machineId: m.id,
      plateNumber: m.plate_number || m.name,
      machineName: m.name,
      revenue: 0,
      fuelCost: 0,
      maintenanceCost: 0,
      tripExpenses: 0,
      totalCost: 0,
      netProfit: 0,
      marginPct: 0,
      kmDriven: Number(m.current_odometer_km || 0),
      costPerKm: 0,
      revenuePerKm: 0,
    });
  });

  // Aggregate invoice revenue
  (invoices || []).forEach((inv: any) => {
    if (inv.machine_id && map.has(inv.machine_id)) {
      map.get(inv.machine_id)!.revenue += Number(inv.paid_amount || inv.total_amount || 0);
    }
  });

  // Aggregate fuel
  (fuelLogs || []).forEach((f: any) => {
    if (f.machine_id && map.has(f.machine_id)) {
      map.get(f.machine_id)!.fuelCost += Number(f.fuel_cost || 0);
    }
  });

  // Aggregate maintenance receipts
  (receipts || []).forEach((r: any) => {
    if (r.machine_id && map.has(r.machine_id)) {
      map.get(r.machine_id)!.maintenanceCost += Number(r.amount || 0);
    }
  });

  // Aggregate trip expenses
  (tripExps || []).forEach((t: any) => {
    if (t.machine_id && map.has(t.machine_id)) {
      map.get(t.machine_id)!.tripExpenses += Number(t.amount || 0);
    }
  });

  // Compute final profit, CPK and margins
  const results: VehicleProfitability[] = [];
  map.forEach((vp) => {
    vp.totalCost = vp.fuelCost + vp.maintenanceCost + vp.tripExpenses;
    vp.netProfit = vp.revenue - vp.totalCost;
    vp.marginPct = vp.revenue > 0 ? Math.round((vp.netProfit / vp.revenue) * 100) : vp.totalCost > 0 ? -100 : 0;
    vp.costPerKm = vp.kmDriven > 0 ? Math.round(vp.totalCost / vp.kmDriven) : 0;
    vp.revenuePerKm = vp.kmDriven > 0 ? Math.round(vp.revenue / vp.kmDriven) : 0;
    results.push(vp);
  });

  // Sort by highest net profit first
  return results.sort((a, b) => b.netProfit - a.netProfit);
}

/**
 * Computes Accounts Payable (AP) and Accounts Receivable (AR) aging schedules.
 */
export async function getApArAging(organisationId: string): Promise<ApArAging> {
  const [
    { data: invoices },
    { data: bills },
  ] = await Promise.all([
    (supabase as any).from("finance_invoices").select("*").eq("organisation_id", organisationId).not("status", "in", '("paid","cancelled")'),
    (supabase as any).from("finance_supplier_bills").select("*").eq("organisation_id", organisationId).not("status", "in", '("paid","rejected")'),
  ]);

  const now = Date.now();
  const ar = { current: 0, days31to60: 0, days61to90: 0, days90Plus: 0, total: 0, invoices: (invoices || []) as FinanceInvoice[] };
  const ap = { current: 0, days31to60: 0, days61to90: 0, days90Plus: 0, total: 0, bills: (bills || []) as FinanceSupplierBill[] };

  ar.invoices.forEach((inv) => {
    const balance = Math.max(Number(inv.total_amount || 0) - Number(inv.paid_amount || 0), 0);
    const dueDate = new Date(inv.due_date).getTime();
    const overdueDays = Math.floor((now - dueDate) / 86400000);

    ar.total += balance;
    if (overdueDays <= 0) ar.current += balance;
    else if (overdueDays <= 30) ar.days31to60 += balance;
    else if (overdueDays <= 60) ar.days61to90 += balance;
    else ar.days90Plus += balance;
  });

  ap.bills.forEach((b) => {
    const balance = Math.max(Number(b.amount || 0) - Number(b.paid_amount || 0), 0);
    const dueDate = new Date(b.due_date).getTime();
    const overdueDays = Math.floor((now - dueDate) / 86400000);

    ap.total += balance;
    if (overdueDays <= 0) ap.current += balance;
    else if (overdueDays <= 30) ap.days31to60 += balance;
    else if (overdueDays <= 60) ap.days61to90 += balance;
    else ap.days90Plus += balance;
  });

  return { receivables: ar, payables: ap };
}

/**
 * Fuel finance, efficiency, and vendor station analysis.
 */
export async function getFuelFinanceStats(organisationId: string): Promise<FuelFinanceStats> {
  const { data: machines } = await (supabase as any)
    .from("machines")
    .select("id, name, plate_number, current_odometer_km")
    .eq("organisation_id", organisationId);

  const machineIds = (machines || []).map((m: any) => m.id);

  let fuelLogs: any[] = [];
  if (machineIds.length > 0) {
    const { data } = await (supabase as any)
      .from("fuel_logs")
      .select("machine_id, fuel_cost, fuel_litres, station, odometer")
      .in("machine_id", machineIds);
    fuelLogs = data || [];
  }

  let totalSpend = 0;
  let totalLitres = 0;
  let totalKm = 0;

  const stationMap = new Map<string, { spend: number; litres: number }>();
  const vehicleMap = new Map<string, { plate: string; machineName: string; spend: number; litres: number; km: number; cpk: number }>();

  (machines || []).forEach((m: any) => {
    vehicleMap.set(m.id, {
      plate: m.plate_number || m.name,
      machineName: m.name,
      spend: 0,
      litres: 0,
      km: Number(m.current_odometer_km || 0),
      cpk: 0,
    });
    totalKm += Number(m.current_odometer_km || 0);
  });

  (fuelLogs || []).forEach((f: any) => {
    const cost = Number(f.fuel_cost || 0);
    const litres = Number(f.fuel_litres || 0);
    const station = f.station?.trim() || "Local Station";

    totalSpend += cost;
    totalLitres += litres;

    if (!stationMap.has(station)) stationMap.set(station, { spend: 0, litres: 0 });
    const s = stationMap.get(station)!;
    s.spend += cost;
    s.litres += litres;

    if (f.machine_id && vehicleMap.has(f.machine_id)) {
      const v = vehicleMap.get(f.machine_id)!;
      v.spend += cost;
      v.litres += litres;
    }
  });

  vehicleMap.forEach((v) => {
    v.cpk = v.km > 0 ? Math.round(v.spend / v.km) : 0;
  });

  const avgCostPerLitre = totalLitres > 0 ? Math.round(totalSpend / totalLitres) : 0;
  const avgCostPerKm = totalKm > 0 ? Math.round(totalSpend / totalKm) : 0;

  const byStation = Array.from(stationMap.entries())
    .map(([station, s]) => ({ station, spend: s.spend, litres: s.litres }))
    .sort((a, b) => b.spend - a.spend);

  const byVehicle = Array.from(vehicleMap.values())
    .sort((a, b) => b.spend - a.spend);

  return {
    totalSpend,
    totalLitres,
    avgCostPerLitre,
    totalKm,
    avgCostPerKm,
    byStation,
    byVehicle,
  };
}
