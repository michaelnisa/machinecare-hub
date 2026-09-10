/**
 * MachineCare Safety (HSE) Domain Module
 */

export interface IncidentReport {
  id: string;
  title: string;
  severity: "near_miss" | "low" | "medium" | "high" | "fatal";
  description: string;
  reported_by: string;
}

export interface PermitToWork {
  id: string;
  permit_number: string;
  work_order_id?: string;
  permit_type: string;
  status: "draft" | "approved" | "active" | "closed";
}

export interface RiskAssessment {
  id: string;
  title: string;
  activity: string;
  hazard: string;
  initial_risk_score: number;
  residual_risk_score: number;
  control_measures: string[];
  status: "draft" | "submitted" | "approved" | "expired";
}

export interface SafetyInspection {
  id: string;
  location: string;
  inspector_name: string;
  checklist_id: string;
  score_percentage: number;
  hazards_identified: number;
  completed_at: string;
}

export interface ChemicalRecord {
  id: string;
  chemical_name: string;
  cas_number?: string;
  un_number?: string;
  sds_url?: string;
  storage_location: string;
  hazard_class: string;
}
