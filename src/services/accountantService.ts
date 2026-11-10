/**
 * Accountant & Finance Service
 * Manages Payment Receipts, Disbursement Vouchers, and Service/Part payments.
 */

import { supabase } from "@/integrations/supabase/client";

export type ReceiptType = "spare_part" | "maintenance_service" | "other_service";
export type PaymentMethod = "cash" | "bank_transfer" | "mobile_money" | "cheque" | "card" | "selcom";
export type ReceiptStatus = "paid" | "pending" | "cancelled";

export interface ReceiptLineItem {
  id?: string;
  description: string;
  part_number?: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface AccountantReceipt {
  id: string;
  organisation_id: string;
  receipt_number: string;
  receipt_type: ReceiptType;
  title: string;
  category: string;
  payee_name: string;
  payee_id?: string | null;
  machine_id?: string | null;
  work_order_id?: string | null;
  purchase_order_id?: string | null;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  payment_reference?: string | null;
  payment_date: string;
  paid_by_name?: string | null;
  received_by_name?: string | null;
  items: ReceiptLineItem[];
  attachment_url?: string | null;
  notes?: string | null;
  status: ReceiptStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  // Expanded relations
  machines?: { id: string; name: string; plate_number?: string | null } | null;
  work_orders?: { id: string; title: string; wo_number?: number | null; wo_year?: number | null } | null;
}

export interface CreateReceiptPayload {
  organisation_id: string;
  receipt_type: ReceiptType;
  title: string;
  category: string;
  payee_name: string;
  payee_id?: string | null;
  machine_id?: string | null;
  work_order_id?: string | null;
  amount: number;
  currency?: string;
  payment_method: PaymentMethod;
  payment_reference?: string | null;
  payment_date?: string;
  paid_by_name?: string | null;
  received_by_name?: string | null;
  items?: ReceiptLineItem[];
  notes?: string | null;
  status?: ReceiptStatus;
}

export interface AccountingMetrics {
  totalAmountThisMonth: number;
  sparePartsAmount: number;
  sparePartsCount: number;
  maintenanceAmount: number;
  maintenanceCount: number;
  totalReceiptsCount: number;
  recentCount: number;
}

/**
 * Converts a numeric amount to English words (e.g. 150000 -> "One Hundred Fifty Thousand TZS Only").
 */
export function amountToWords(amount: number, currency: string = "TZS"): string {
  if (isNaN(amount) || amount <= 0) return `Zero ${currency} Only`;

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertNumber(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " and " + convertNumber(n % 100) : "");
    if (n < 1000000) return convertNumber(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + convertNumber(n % 1000) : "");
    if (n < 1000000000) return convertNumber(Math.floor(n / 1000000)) + " Million" + (n % 1000000 !== 0 ? " " + convertNumber(n % 1000000) : "");
    return convertNumber(Math.floor(n / 1000000000)) + " Billion" + (n % 1000000000 !== 0 ? " " + convertNumber(n % 1000000000) : "");
  }

  const intPart = Math.floor(amount);
  const words = convertNumber(intPart);
  return `${words} ${currency} Only`;
}

/**
 * Generates the next sequential payment voucher / receipt number.
 */
export async function getNextReceiptNumber(orgId: string, prefix = "PV"): Promise<string> {
  const currentYear = new Date().getFullYear();
  try {
    const { data: counter } = await (supabase as any)
      .from("org_receipt_counters")
      .select("next_number")
      .eq("organisation_id", orgId)
      .eq("year", currentYear)
      .maybeSingle();

    let seq = 1;
    if (counter && typeof counter.next_number === "number") {
      seq = counter.next_number;
      await (supabase as any)
        .from("org_receipt_counters")
        .update({ next_number: seq + 1, updated_at: new Date().toISOString() })
        .eq("organisation_id", orgId)
        .eq("year", currentYear);
    } else {
      await (supabase as any)
        .from("org_receipt_counters")
        .upsert({ organisation_id: orgId, year: currentYear, next_number: 2 });
    }

    return `${prefix}-${currentYear}-${String(seq).padStart(4, "0")}`;
  } catch {
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${currentYear}-${rand}`;
  }
}

/**
 * Uploads an invoice or physical receipt file to storage.
 */
export async function uploadReceiptAttachment(file: File, orgId: string): Promise<string | null> {
  try {
    const fileExt = file.name.split(".").pop();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `receipts/${orgId}/${Date.now()}-${cleanFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("machine-docs")
      .upload(filePath, file, { cacheControl: "3600", upsert: true });

    if (uploadError) {
      console.warn("Storage upload error:", uploadError);
      return null;
    }

    const { data } = supabase.storage.from("machine-docs").getPublicUrl(filePath);
    return data.publicUrl;
  } catch (err) {
    console.warn("Failed to upload receipt attachment:", err);
    return null;
  }
}

/**
 * Fetches all accountant receipts for an organisation with optional filters.
 */
export async function getAccountantReceipts(
  orgId: string,
  options?: {
    receiptType?: ReceiptType | "all";
    status?: ReceiptStatus | "all";
    search?: string;
  }
): Promise<AccountantReceipt[]> {
  try {
    let query = (supabase as any)
      .from("accountant_receipts")
      .select(`
        *,
        machines:machine_id (id, name, plate_number),
        work_orders:work_order_id (id, title, wo_number, wo_year)
      `)
      .eq("organisation_id", orgId)
      .order("payment_date", { ascending: false });

    if (options?.receiptType && options.receiptType !== "all") {
      query = query.eq("receipt_type", options.receiptType);
    }

    if (options?.status && options.status !== "all") {
      query = query.eq("status", options.status);
    }

    const { data, error } = await query;
    if (error) {
      // If table doesn't exist yet or schema cache is updating, return empty list gracefully
      if (
        error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message?.includes("does not exist") ||
        error.message?.includes("schema cache")
      ) {
        return [];
      }
      throw error;
    }

    let results = (data || []) as AccountantReceipt[];

    if (options?.search) {
      const q = options.search.toLowerCase().trim();
      results = results.filter((r) => {
        const titleMatch = r.title?.toLowerCase().includes(q);
        const payeeMatch = r.payee_name?.toLowerCase().includes(q);
        const numMatch = r.receipt_number?.toLowerCase().includes(q);
        const refMatch = r.payment_reference?.toLowerCase().includes(q);
        const plateMatch = r.machines?.plate_number?.toLowerCase().includes(q) || r.machines?.name?.toLowerCase().includes(q);
        return titleMatch || payeeMatch || numMatch || refMatch || plateMatch;
      });
    }

    return results;
  } catch (err: any) {
    console.warn("Failed to fetch accountant receipts:", err?.message);
    return [];
  }
}

/**
 * Fetches a single receipt by ID with joined relations.
 */
export async function getAccountantReceiptById(receiptId: string): Promise<AccountantReceipt | null> {
  try {
    const { data, error } = await (supabase as any)
      .from("accountant_receipts")
      .select(`
        *,
        machines:machine_id (id, name, plate_number),
        work_orders:work_order_id (id, title, wo_number, wo_year)
      `)
      .eq("id", receiptId)
      .maybeSingle();

    if (error || !data) return null;
    return data as AccountantReceipt;
  } catch {
    return null;
  }
}

/**
 * Creates a new Accountant Payment Receipt / Disbursement Voucher.
 */
export async function createAccountantReceipt(
  payload: CreateReceiptPayload,
  attachmentFile?: File | null
): Promise<{ success: boolean; data?: AccountantReceipt; error?: string }> {
  try {
    let attachmentUrl = null;
    if (attachmentFile) {
      attachmentUrl = await uploadReceiptAttachment(attachmentFile, payload.organisation_id);
    }

    const receiptNumber = await getNextReceiptNumber(payload.organisation_id, "PV");
    const { data: authData } = await supabase.auth.getUser();

    const insertPayload = {
      organisation_id: payload.organisation_id,
      receipt_number: receiptNumber,
      receipt_type: payload.receipt_type,
      title: payload.title.trim(),
      category: payload.category || "Spare Parts",
      payee_name: payload.payee_name.trim(),
      payee_id: payload.payee_id || null,
      machine_id: payload.machine_id || null,
      work_order_id: payload.work_order_id || null,
      amount: Number(payload.amount),
      currency: payload.currency || "TZS",
      payment_method: payload.payment_method,
      payment_reference: payload.payment_reference?.trim() || null,
      payment_date: payload.payment_date || new Date().toISOString(),
      paid_by_name: payload.paid_by_name?.trim() || "Accountant",
      received_by_name: payload.received_by_name?.trim() || null,
      items: payload.items || [],
      attachment_url: attachmentUrl,
      notes: payload.notes?.trim() || null,
      status: payload.status || "paid",
      created_by: authData?.user?.id || null,
    };

    const { data, error } = await (supabase as any)
      .from("accountant_receipts")
      .insert(insertPayload)
      .select(`
        *,
        machines:machine_id (id, name, plate_number),
        work_orders:work_order_id (id, title, wo_number, wo_year)
      `)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as AccountantReceipt };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create receipt" };
  }
}

/**
 * Voids or updates an accountant receipt status.
 */
export async function updateAccountantReceiptStatus(
  receiptId: string,
  status: ReceiptStatus,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (notes) updateData.notes = notes;

    const { error } = await (supabase as any)
      .from("accountant_receipts")
      .update(updateData)
      .eq("id", receiptId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update receipt" };
  }
}

/**
 * Calculates high-level accounting metrics for dashboard cards.
 */
export async function getAccountingMetrics(orgId: string): Promise<AccountingMetrics> {
  const receipts = await getAccountantReceipts(orgId);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let totalAmountThisMonth = 0;
  let sparePartsAmount = 0;
  let sparePartsCount = 0;
  let maintenanceAmount = 0;
  let maintenanceCount = 0;

  for (const r of receipts) {
    if (r.status === "cancelled") continue;
    const amount = Number(r.amount || 0);
    const dateMs = new Date(r.payment_date).getTime();

    if (dateMs >= startOfMonth) {
      totalAmountThisMonth += amount;
    }

    if (r.receipt_type === "spare_part") {
      sparePartsAmount += amount;
      sparePartsCount++;
    } else if (r.receipt_type === "maintenance_service") {
      maintenanceAmount += amount;
      maintenanceCount++;
    }
  }

  return {
    totalAmountThisMonth,
    sparePartsAmount,
    sparePartsCount,
    maintenanceAmount,
    maintenanceCount,
    totalReceiptsCount: receipts.length,
    recentCount: receipts.filter((r) => r.status === "paid").length,
  };
}
