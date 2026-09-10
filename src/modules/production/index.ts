/**
 * MachineCare Production Domain Module
 */

export interface ProductionOrder {
  id: string;
  order_number: string;
  product_name: string;
  planned_quantity: number;
  produced_quantity: number;
  status: string;
}

export interface ProductionPlanningItem {
  id: string;
  line_id: string;
  product_name: string;
  scheduled_start: string;
  scheduled_end: string;
  target_output: number;
  status: "draft" | "confirmed" | "in_production" | "completed";
}

export interface OeeRecord {
  id: string;
  line_id: string;
  date: string;
  availability: number;
  performance: number;
  quality: number;
  overall_oee: number;
}

export interface DowntimeLog {
  id: string;
  machine_id: string;
  reason_category: "breakdown" | "changeover" | "operator_shortage" | "power_cut" | "material_delay";
  duration_minutes: number;
  started_at: string;
  resolved_at?: string;
}

export interface WasteRecord {
  id: string;
  line_id: string;
  material_name: string;
  scrap_quantity: number;
  unit: string;
  cost_impact: number;
  recorded_at: string;
}
