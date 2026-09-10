/**
 * MachineCare Maintenance Domain Module
 * Manages work orders, preventive schedules, downtime logs, and checklists.
 */

export interface WorkOrder {
  id: string;
  work_order_number: string;
  asset_id: string;
  title: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "pending_approval" | "completed" | "cancelled";
  estimated_cost?: number;
  actual_cost?: number;
}
