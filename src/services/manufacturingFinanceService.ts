/**
 * MachineCare Platform - Manufacturing Finance & Cost Accounting Engine
 * Provides Cost of Goods Manufactured (COGM), Batch/Job Costing,
 * Machine Maintenance Cost Centers, and Raw Material Valuation.
 */

import { supabase } from "@/integrations/supabase/client";

export interface ManufacturingOverviewMetrics {
  grossRevenue: number;
  cogm: number; // Cost of Goods Manufactured
  directMaterialCost: number;
  directLabourCost: number;
  maintenanceSpend: number;
  downtimeLoss: number;
  scrapLoss: number;
  grossMargin: number;
  grossMarginPct: number;
  netOperatingProfit: number;
  totalInventoryValuation: number;
  rawMaterialValuation: number;
  finishedGoodsValuation: number;
  sparesValuation: number;
  arOutstanding: number;
  apOutstanding: number;
  monthlyTrend: {
    month: string;
    revenue: number;
    productionCost: number;
    grossProfit: number;
  }[];
  costBreakdown: {
    category: string;
    amount: number;
    percentage: number;
  }[];
}

export interface BatchCostingRecord {
  orderId: string;
  poNumber: string;
  productName: string;
  productSku?: string;
  productionLine: string;
  status: string;
  plannedQty: number;
  completedQty: number;
  scrapQty: number;
  materialCost: number;
  labourCost: number;
  scrapCost: number;
  downtimeCost: number;
  totalBatchCost: number;
  unitCost: number;
  targetSellingPrice: number;
  unitMarginPct: number;
  startDate?: string | null;
  endDate?: string | null;
}

export interface MachineCostRecord {
  machineId: string;
  machineName: string;
  category?: string;
  partsCost: number;
  labourCost: number;
  externalExpenses: number;
  downtimeMinutes: number;
  downtimeCost: number;
  totalMaintenanceCost: number;
  workOrderCount: number;
}

export interface InventoryValuationMetrics {
  totalValue: number;
  rawMaterialsValue: number;
  sparesValue: number;
  finishedGoodsValue: number;
  otherValue: number;
  totalItemCount: number;
  lowStockItemsValue: number;
  recentScrapLoss30Days: number;
  scrapByReason: { reason: string; amount: number; count: number }[];
}

export async function getManufacturingFinancialOverview(orgId: string): Promise<ManufacturingOverviewMetrics> {
  const [
    { data: invoices },
    { data: expenses },
    { data: orgData },
    { data: orders },
    { data: scrapEvents },
    { data: downtimeEvents },
    { data: workOrders },
    { data: inventory },
    { data: boms },
  ] = await Promise.all([
    supabase.from("finance_invoices").select("*").eq("organisation_id", orgId),
    supabase.from("finance_expenses").select("*").eq("organisation_id", orgId),
    supabase.from("organisations").select("*").eq("id", orgId).maybeSingle(),
    supabase.from("production_orders").select("*").eq("organisation_id", orgId),
    (supabase as any).from("production_scrap_events").select("*").eq("organisation_id", orgId),
    (supabase as any).from("production_downtime_events").select("*").eq("organisation_id", orgId),
    supabase.from("work_orders").select("*").eq("organisation_id", orgId),
    supabase.from("inventory_items").select("*").eq("organisation_id", orgId),
    (supabase as any).from("product_materials").select("*, inventory_items(unit_cost)").eq("organisation_id", orgId),
  ]);

  const defaultDowntimeCostPerMin = Number(orgData?.production_cost_per_downtime_minute) || 1500;
  const defaultScrapCostPerUnit = Number(orgData?.production_cost_per_scrap_unit) || 2500;
  const defaultLabourRatePerHour = Number(orgData?.default_labour_rate_per_hour) || 12000;

  // 1. Gross Revenue & Accounts Receivable
  let grossRevenue = 0;
  let arOutstanding = 0;
  (invoices || []).forEach((inv: any) => {
    if (inv.status !== "cancelled") {
      grossRevenue += Number(inv.total_amount) || 0;
      if (inv.status !== "paid") {
        arOutstanding += Math.max(0, (Number(inv.total_amount) || 0) - (Number(inv.paid_amount) || 0));
      }
    }
  });

  // 2. Direct Material Costs (Calculated from completed BOM usage or production expenses)
  const bomCostPerProduct = new Map<string, number>();
  (boms || []).forEach((b: any) => {
    const unitCost = Number(b.inventory_items?.unit_cost) || 0;
    const qty = Number(b.qty_per_unit) || 0;
    const cur = bomCostPerProduct.get(b.product_id) || 0;
    bomCostPerProduct.set(b.product_id, cur + unitCost * qty);
  });

  let directMaterialCost = 0;
  let directLabourCost = 0;
  (orders || []).forEach((ord: any) => {
    const produced = Number(ord.quantity_produced) || 0;
    const bomCost = bomCostPerProduct.get(ord.product) || bomCostPerProduct.get(ord.id) || 0;
    directMaterialCost += produced * (bomCost > 0 ? bomCost : 1200);

    // Labour hours estimate based on run duration or order size
    let durationHours = 4;
    if (ord.actual_start_date && ord.actual_end_date) {
      const diff = new Date(ord.actual_end_date).getTime() - new Date(ord.actual_start_date).getTime();
      if (diff > 0) durationHours = Math.min(48, Math.max(1, diff / 3600000));
    }
    directLabourCost += durationHours * (defaultLabourRatePerHour / 2);
  });

  // 3. Machine Maintenance Spend
  let maintenanceSpend = 0;
  (workOrders || []).forEach((wo: any) => {
    maintenanceSpend += Number(wo.total_cost) || (Number(wo.labour_cost) || 0) + (Number(wo.parts_cost) || 0);
  });
  (expenses || []).forEach((exp: any) => {
    if (exp.category === "maintenance_service" || exp.category === "spares") {
      maintenanceSpend += Number(exp.amount) || 0;
    }
  });

  // 4. Downtime & Scrap Financial Losses
  let downtimeLoss = 0;
  (downtimeEvents || []).forEach((evt: any) => {
    if (Number(evt.cost_impact) > 0) {
      downtimeLoss += Number(evt.cost_impact);
    } else {
      downtimeLoss += (Number(evt.downtime_minutes) || 0) * defaultDowntimeCostPerMin;
    }
  });

  let scrapLoss = 0;
  (scrapEvents || []).forEach((evt: any) => {
    if (Number(evt.cost_impact) > 0) {
      scrapLoss += Number(evt.cost_impact);
    } else {
      scrapLoss += (Number(evt.scrap_quantity) || 0) * defaultScrapCostPerUnit;
    }
  });

  // Facility Overhead & Accounts Payable from general expenses
  let facilityOverhead = 0;
  let apOutstanding = 0;
  (expenses || []).forEach((exp: any) => {
    if (exp.category !== "maintenance_service" && exp.category !== "spares") {
      facilityOverhead += Number(exp.amount) || 0;
    }
    if (exp.payment_status === "pending" || exp.status === "pending") {
      apOutstanding += Number(exp.amount) || 0;
    }
  });

  // Cost of Goods Manufactured
  const cogm = directMaterialCost + directLabourCost + maintenanceSpend + downtimeLoss + scrapLoss;
  const totalCost = cogm + facilityOverhead;
  const grossMargin = grossRevenue - cogm;
  const grossMarginPct = grossRevenue > 0 ? (grossMargin / grossRevenue) * 100 : 0;
  const netOperatingProfit = grossRevenue - totalCost;

  // Inventory valuation
  let totalInventoryValuation = 0;
  let rawMaterialValuation = 0;
  let sparesValuation = 0;
  let finishedGoodsValuation = 0;
  (inventory || []).forEach((item: any) => {
    const val = (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0);
    totalInventoryValuation += val;
    const cat = (item.category || item.item_type || "").toLowerCase();
    if (cat.includes("raw") || cat.includes("material") || cat.includes("ingredient")) {
      rawMaterialValuation += val;
    } else if (cat.includes("finish") || cat.includes("product") || cat.includes("fg")) {
      finishedGoodsValuation += val;
    } else {
      sparesValuation += val;
    }
  });

  // Monthly trends for the last 6 months
  const months: { [key: string]: { revenue: number; productionCost: number; grossProfit: number } } = {};
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    months[key] = { revenue: 0, productionCost: 0, grossProfit: 0 };
  }

  (invoices || []).forEach((inv: any) => {
    if (inv.issued_at) {
      const d = new Date(inv.issued_at);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      if (months[key]) {
        months[key].revenue += Number(inv.total_amount) || 0;
      }
    }
  });

  const monthKeys = Object.keys(months);
  const costPerMonth = cogm / Math.max(1, monthKeys.length);
  monthKeys.forEach((key) => {
    months[key].productionCost = Math.round(costPerMonth);
    months[key].grossProfit = months[key].revenue - months[key].productionCost;
  });

  const monthlyTrend = monthKeys.map((k) => ({
    month: k,
    revenue: months[k].revenue,
    productionCost: months[k].productionCost,
    grossProfit: months[k].grossProfit,
  }));

  const totalCostPool = Math.max(1, cogm + facilityOverhead);
  const costBreakdown = [
    { category: "Direct Materials", amount: directMaterialCost, percentage: Math.round((directMaterialCost / totalCostPool) * 100) },
    { category: "Direct Labour", amount: directLabourCost, percentage: Math.round((directLabourCost / totalCostPool) * 100) },
    { category: "Machine Maintenance", amount: maintenanceSpend, percentage: Math.round((maintenanceSpend / totalCostPool) * 100) },
    { category: "Downtime Financial Loss", amount: downtimeLoss, percentage: Math.round((downtimeLoss / totalCostPool) * 100) },
    { category: "Scrap & Material Waste", amount: scrapLoss, percentage: Math.round((scrapLoss / totalCostPool) * 100) },
    { category: "Plant Overheads & Utilities", amount: facilityOverhead, percentage: Math.round((facilityOverhead / totalCostPool) * 100) },
  ].filter((c) => c.amount > 0);

  return {
    grossRevenue,
    cogm,
    directMaterialCost,
    directLabourCost,
    maintenanceSpend,
    downtimeLoss,
    scrapLoss,
    grossMargin,
    grossMarginPct,
    netOperatingProfit,
    totalInventoryValuation,
    rawMaterialValuation,
    finishedGoodsValuation,
    sparesValuation,
    arOutstanding,
    apOutstanding,
    monthlyTrend,
    costBreakdown,
  };
}

export async function getProductionBatchCosting(orgId: string): Promise<BatchCostingRecord[]> {
  const [
    { data: orders },
    { data: products },
    { data: boms },
    { data: orgData },
  ] = await Promise.all([
    supabase.from("production_orders").select("*").eq("organisation_id", orgId).order("created_at", { ascending: false }),
    (supabase as any).from("products").select("*").eq("organisation_id", orgId),
    (supabase as any).from("product_materials").select("*, inventory_items(unit_cost)").eq("organisation_id", orgId),
    supabase.from("organisations").select("*").eq("id", orgId).maybeSingle(),
  ]);

  const defaultDowntimeCostPerMin = Number(orgData?.production_cost_per_downtime_minute) || 1500;
  const defaultScrapCostPerUnit = Number(orgData?.production_cost_per_scrap_unit) || 2500;
  const defaultLabourRatePerHour = Number(orgData?.default_labour_rate_per_hour) || 12000;

  const productMap = new Map<string, any>();
  (products || []).forEach((p: any) => {
    productMap.set(p.id, p);
    if (p.name) productMap.set(p.name, p);
  });

  const bomCostMap = new Map<string, number>();
  (boms || []).forEach((b: any) => {
    const cost = Number(b.inventory_items?.unit_cost) || 0;
    const qty = Number(b.qty_per_unit) || 0;
    const cur = bomCostMap.get(b.product_id) || 0;
    bomCostMap.set(b.product_id, cur + cost * qty);
  });

  return (orders || []).map((ord: any) => {
    const prod = productMap.get(ord.product) || { name: ord.product || "Standard Assembly", sku: "SKU-STD" };
    const completedQty = Number(ord.quantity_produced) || 0;
    const plannedQty = Number(ord.quantity_ordered) || 0;
    const scrapQty = Math.max(0, plannedQty - completedQty);

    const unitBomCost = bomCostMap.get(ord.product) || bomCostMap.get(prod.id) || 1500;
    const materialCost = completedQty * unitBomCost;

    let runHours = 4;
    if (ord.actual_start_date && ord.actual_end_date) {
      const diff = new Date(ord.actual_end_date).getTime() - new Date(ord.actual_start_date).getTime();
      if (diff > 0) runHours = Math.min(48, Math.max(1, diff / 3600000));
    }
    const labourCost = runHours * defaultLabourRatePerHour;

    const scrapCost = scrapQty * defaultScrapCostPerUnit;
    const downtimeCost = (scrapQty > 5 ? 15 : 0) * defaultDowntimeCostPerMin;

    const totalBatchCost = materialCost + labourCost + scrapCost + downtimeCost;
    const unitCost = completedQty > 0 ? Math.round(totalBatchCost / completedQty) : Math.round(totalBatchCost / Math.max(1, plannedQty));
    const targetSellingPrice = Number(prod.selling_price) || unitCost * 1.35;
    const unitMarginPct = targetSellingPrice > 0 ? Math.round(((targetSellingPrice - unitCost) / targetSellingPrice) * 100) : 25;

    const poNumber = ord.po_number
      ? `PO-${ord.po_year || new Date().getFullYear()}-${String(ord.po_number).padStart(4, "0")}`
      : `PO-${ord.id.slice(0, 8).toUpperCase()}`;

    return {
      orderId: ord.id,
      poNumber,
      productName: prod.name,
      productSku: prod.sku,
      productionLine: ord.production_line || "Main Line",
      status: ord.status || "planned",
      plannedQty,
      completedQty,
      scrapQty,
      materialCost,
      labourCost,
      scrapCost,
      downtimeCost,
      totalBatchCost,
      unitCost,
      targetSellingPrice,
      unitMarginPct,
      startDate: ord.actual_start_date || ord.planned_start_date,
      endDate: ord.actual_end_date || ord.planned_end_date,
    };
  });
}

export async function getMachineMaintenanceFinancials(orgId: string): Promise<MachineCostRecord[]> {
  const [
    { data: machines },
    { data: workOrders },
    { data: downtimeEvents },
    { data: expenses },
    { data: orgData },
  ] = await Promise.all([
    supabase.from("machines").select("id, name, category, type").eq("organisation_id", orgId),
    supabase.from("work_orders").select("*").eq("organisation_id", orgId),
    (supabase as any).from("production_downtime_events").select("*").eq("organisation_id", orgId),
    supabase.from("finance_expenses").select("*").eq("organisation_id", orgId),
    supabase.from("organisations").select("*").eq("id", orgId).maybeSingle(),
  ]);

  const defaultDowntimeCostPerMin = Number(orgData?.production_cost_per_downtime_minute) || 1500;

  const recordsMap = new Map<string, MachineCostRecord>();

  (machines || []).forEach((m: any) => {
    recordsMap.set(m.id, {
      machineId: m.id,
      machineName: m.name,
      category: m.category || m.type || "Production Machinery",
      partsCost: 0,
      labourCost: 0,
      externalExpenses: 0,
      downtimeMinutes: 0,
      downtimeCost: 0,
      totalMaintenanceCost: 0,
      workOrderCount: 0,
    });
  });

  (workOrders || []).forEach((wo: any) => {
    if (!wo.machine_id) return;
    const rec = recordsMap.get(wo.machine_id);
    if (rec) {
      rec.partsCost += Number(wo.parts_cost) || 0;
      rec.labourCost += Number(wo.labour_cost) || 0;
      rec.workOrderCount += 1;
    }
  });

  (downtimeEvents || []).forEach((evt: any) => {
    if (!evt.machine_id) return;
    const rec = recordsMap.get(evt.machine_id);
    if (rec) {
      const mins = Number(evt.downtime_minutes) || 0;
      rec.downtimeMinutes += mins;
      rec.downtimeCost += Number(evt.cost_impact) || mins * defaultDowntimeCostPerMin;
    }
  });

  (expenses || []).forEach((exp: any) => {
    if (exp.machine_id && recordsMap.has(exp.machine_id)) {
      const rec = recordsMap.get(exp.machine_id)!;
      rec.externalExpenses += Number(exp.amount) || 0;
    }
  });

  const records = Array.from(recordsMap.values()).map((r) => {
    r.totalMaintenanceCost = r.partsCost + r.labourCost + r.externalExpenses + r.downtimeCost;
    return r;
  });

  return records.sort((a, b) => b.totalMaintenanceCost - a.totalMaintenanceCost);
}

export async function getInventoryValuation(orgId: string): Promise<InventoryValuationMetrics> {
  const [
    { data: inventory },
    { data: scrapEvents },
    { data: orgData },
  ] = await Promise.all([
    supabase.from("inventory_items").select("*").eq("organisation_id", orgId),
    (supabase as any).from("production_scrap_events").select("*").eq("organisation_id", orgId),
    supabase.from("organisations").select("*").eq("id", orgId).maybeSingle(),
  ]);

  const defaultScrapCostPerUnit = Number(orgData?.production_cost_per_scrap_unit) || 2500;

  let totalValue = 0;
  let rawMaterialsValue = 0;
  let sparesValue = 0;
  let finishedGoodsValue = 0;
  let otherValue = 0;
  let lowStockItemsValue = 0;

  (inventory || []).forEach((item: any) => {
    const qty = Number(item.quantity) || 0;
    const cost = Number(item.unit_cost) || 0;
    const val = qty * cost;
    totalValue += val;

    const cat = (item.category || item.item_type || "").toLowerCase();
    if (cat.includes("raw") || cat.includes("material") || cat.includes("ingredient")) {
      rawMaterialsValue += val;
    } else if (cat.includes("finish") || cat.includes("product") || cat.includes("fg")) {
      finishedGoodsValue += val;
    } else if (cat.includes("spare") || cat.includes("part") || cat.includes("maintenance")) {
      sparesValue += val;
    } else {
      otherValue += val;
    }

    if (qty <= (Number(item.reorder_level) || 0)) {
      lowStockItemsValue += val;
    }
  });

  let recentScrapLoss30Days = 0;
  const reasonMap = new Map<string, { amount: number; count: number }>();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600000);
  (scrapEvents || []).forEach((evt: any) => {
    const cost = Number(evt.cost_impact) || (Number(evt.scrap_quantity) || 0) * defaultScrapCostPerUnit;
    if (new Date(evt.created_at) >= thirtyDaysAgo) {
      recentScrapLoss30Days += cost;
    }
    const reason = evt.reason || "Process Defect";
    const cur = reasonMap.get(reason) || { amount: 0, count: 0 };
    cur.amount += cost;
    cur.count += 1;
    reasonMap.set(reason, cur);
  });

  const scrapByReason = Array.from(reasonMap.entries()).map(([reason, data]) => ({
    reason,
    amount: data.amount,
    count: data.count,
  }));

  return {
    totalValue,
    rawMaterialsValue,
    sparesValue,
    finishedGoodsValue,
    otherValue,
    totalItemCount: (inventory || []).length,
    lowStockItemsValue,
    recentScrapLoss30Days,
    scrapByReason,
  };
}
