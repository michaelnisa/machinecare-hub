/**
 * MachineCare Platform - Fleet Multi-Department Approval Service
 * Designed for Commercial Logistics & Workshop Governance (e.g. Mega Beverages RFP).
 * Handles Spare Parts Requisitions, Emergency Roadside Breakdowns, Trip Safari Floats, and Tyres.
 */

import { supabase } from "@/integrations/supabase/client";

export type FleetApprovalType =
  | "spare_parts"
  | "emergency_breakdown"
  | "trip_float"
  | "tyre_replacement"
  | "outsourced_service"
  | "general_payment";

export type FleetApprovalPriority = "low" | "standard" | "urgent" | "emergency";

export type ApprovalStageId =
  | "supervisor"
  | "fleet_manager"
  | "procurement"
  | "finance"
  | "management";

export interface ApprovalItem {
  name: string;
  part_number?: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
}

export interface ApprovalChainStep {
  stage: ApprovalStageId;
  stage_label: string;
  role_required: string;
  status: "pending" | "approved" | "rejected" | "skipped";
  reviewed_by?: string;
  reviewer_name?: string;
  reviewed_at?: string;
  note?: string;
}

export interface DisbursementInfo {
  disbursed_at: string;
  disbursed_by: string;
  disburser_name?: string;
  method: "m_pesa" | "selcom" | "bank_transfer" | "petty_cash" | "store_grn";
  reference: string;
  note?: string;
}

export interface FleetApprovalRequest {
  id: string;
  organisation_id: string;
  request_number: string;
  request_type: FleetApprovalType;
  priority: FleetApprovalPriority;
  title: string;
  description?: string;
  vehicle_id?: string;
  vehicle_plate?: string;
  work_order_id?: string;
  job_card_id?: string;
  amount: number;
  currency: "TZS" | "USD";
  department: string;
  requested_by: string;
  requester_name: string;
  items: ApprovalItem[];
  evidence_urls: string[];
  gps_location?: string;
  vendor_name?: string;
  vendor_phone?: string;
  status:
    | "pending_supervisor"
    | "pending_fleet_manager"
    | "pending_procurement"
    | "pending_finance"
    | "pending_management"
    | "approved"
    | "disbursed"
    | "rejected"
    | "info_requested";
  current_stage: ApprovalStageId | "completed";
  approval_chain: ApprovalChainStep[];
  disbursement_info?: DisbursementInfo;
  created_at: string;
  updated_at: string;
}

const STORAGE_KEY_PREFIX = "machinecare_fleet_approvals_v1_";

export const STAGE_CONFIG: Record<
  ApprovalStageId,
  { label: string; roleRequired: string }
> = {
  supervisor: {
    label: "Workshop Supervisor",
    roleRequired: "engineer",
  },
  fleet_manager: {
    label: "Fleet Operations Manager",
    roleRequired: "manager",
  },
  procurement: {
    label: "Procurement / Sourcing",
    roleRequired: "manager",
  },
  finance: {
    label: "Finance & Accounts",
    roleRequired: "accountant",
  },
  management: {
    label: "General Management",
    roleRequired: "owner",
  },
};

/**
 * Builds the standard 5-stage approval chain as required by the Mega Beverages RFP:
 * Supervisor -> Fleet Manager -> Procurement -> Finance -> Management Approval
 */
export function buildApprovalChain(
  type: FleetApprovalType,
  amount: number,
  isMultiDepartment = true
): ApprovalChainStep[] {
  // For single-department / direct workflow (e.g. Logistixware), use 1-step direct manager sign-off
  if (!isMultiDepartment) {
    return [
      {
        stage: "fleet_manager",
        stage_label: "Operations Manager Approval",
        roleRequired: "manager",
        status: "pending",
      },
    ];
  }

  // Full enterprise multi-department chain
  const chain: ApprovalChainStep[] = [
    {
      stage: "supervisor",
      stage_label: STAGE_CONFIG.supervisor.label,
      roleRequired: STAGE_CONFIG.supervisor.roleRequired,
      status: "pending",
    },
    {
      stage: "fleet_manager",
      stage_label: STAGE_CONFIG.fleet_manager.label,
      roleRequired: STAGE_CONFIG.fleet_manager.roleRequired,
      status: "pending",
    },
  ];

  // If spare parts or outsourced service, require Procurement
  if (type === "spare_parts" || type === "outsourced_service") {
    chain.push({
      stage: "procurement",
      stage_label: STAGE_CONFIG.procurement.label,
      roleRequired: STAGE_CONFIG.procurement.roleRequired,
      status: "pending",
    });
  }

  // Finance is required for all monetary disbursements
  chain.push({
    stage: "finance",
    stage_label: STAGE_CONFIG.finance.label,
    roleRequired: STAGE_CONFIG.finance.roleRequired,
    status: "pending",
  });

  // High-value CapEx (> 10,000,000 TZS / $4,000 USD) requires Executive Management
  if (amount >= 10000000) {
    chain.push({
      stage: "management",
      stage_label: STAGE_CONFIG.management.label,
      roleRequired: STAGE_CONFIG.management.roleRequired,
      status: "pending",
    });
  }

  return chain;
}

function getLocalStore(orgId: string): FleetApprovalRequest[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${orgId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Automatically purge any legacy mock/seed data
        const cleaned = parsed.filter((r: FleetApprovalRequest) => !r.id?.startsWith("seed-app-"));
        if (cleaned.length !== parsed.length) {
          saveLocalStore(orgId, cleaned);
        }
        return cleaned;
      }
    }
  } catch (e) {
    console.warn("Failed to read local fleet approvals:", e);
  }
  return [];
}

function saveLocalStore(orgId: string, requests: FleetApprovalRequest[]) {
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${orgId}`,
      JSON.stringify(requests)
    );
  } catch (e) {
    console.warn("Failed to save local fleet approvals:", e);
  }
}


/**
 * Fetch all fleet approval requests for the organization (real user data only)
 */
export async function getFleetApprovalRequests(
  orgId: string,
  _isMultiDepartment = true
): Promise<FleetApprovalRequest[]> {
  try {
    const { data, error } = await (supabase as any)
      .from("fleet_approvals")
      .select("*")
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      return data.filter((r) => !r.id?.startsWith("seed-app-"));
    }
  } catch (err) {
    // remote table does not exist or network unavailable
  }

  // Fallback to local store (real user-created requests only)
  return getLocalStore(orgId);
}

/**
 * Create a new fleet requisition / approval request
 */
export async function createFleetApprovalRequest(
  payload: Omit<FleetApprovalRequest, "id" | "request_number" | "created_at" | "updated_at">
): Promise<FleetApprovalRequest> {
  const existing = getLocalStore(payload.organisation_id);
  const nextNum = existing.length + 1;
  const request_number = `REQ-2026-${String(nextNum).padStart(4, "0")}`;
  const now = new Date().toISOString();

  const newRecord: FleetApprovalRequest = {
    ...payload,
    id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    request_number,
    created_at: now,
    updated_at: now,
  };

  try {
    const { data, error } = await (supabase as any)
      .from("fleet_approvals")
      .insert(newRecord)
      .select()
      .single();

    if (!error && data) {
      return data;
    }
  } catch (err) {
    // fallback
  }

  const updatedList = [newRecord, ...existing];
  saveLocalStore(payload.organisation_id, updatedList);
  return newRecord;
}

/**
 * Review an approval step: approve, reject, or request clarification
 */
export async function reviewFleetApprovalStep(
  orgId: string,
  requestId: string,
  stage: ApprovalStageId,
  decision: "approved" | "rejected" | "info_requested",
  reviewerId: string,
  reviewerName: string,
  note?: string
): Promise<FleetApprovalRequest> {
  const requests = await getFleetApprovalRequests(orgId);
  const req = requests.find((r) => r.id === requestId);
  if (!req) throw new Error("Requisition request not found");

  const now = new Date().toISOString();
  const stepIdx = req.approval_chain.findIndex((s) => s.stage === stage);
  if (stepIdx === -1) throw new Error(`Approval stage ${stage} not in workflow`);

  // Update current step
  req.approval_chain[stepIdx].status = decision === "approved" ? "approved" : "rejected";
  req.approval_chain[stepIdx].reviewed_by = reviewerId;
  req.approval_chain[stepIdx].reviewer_name = reviewerName;
  req.approval_chain[stepIdx].reviewed_at = now;
  req.approval_chain[stepIdx].note = note;

  if (decision === "rejected") {
    req.status = "rejected";
  } else if (decision === "info_requested") {
    req.status = "info_requested";
  } else {
    // If approved, check if there are subsequent steps
    const nextPendingStep = req.approval_chain.find((s) => s.status === "pending");
    if (nextPendingStep) {
      req.current_stage = nextPendingStep.stage;
      req.status = `pending_${nextPendingStep.stage}` as any;
    } else {
      // All steps approved!
      req.current_stage = "completed";
      req.status = "approved";
    }
  }

  req.updated_at = now;

  try {
    await (supabase as any)
      .from("fleet_approvals")
      .update(req)
      .eq("id", requestId);
  } catch (e) {
    // fallback
  }

  const updatedList = requests.map((r) => (r.id === requestId ? req : r));
  saveLocalStore(orgId, updatedList);
  return req;
}

/**
 * Disburse funds or issue spare parts once requisition is fully approved
 */
export async function disburseFleetApproval(
  orgId: string,
  requestId: string,
  disbursement: DisbursementInfo
): Promise<FleetApprovalRequest> {
  const requests = await getFleetApprovalRequests(orgId);
  const req = requests.find((r) => r.id === requestId);
  if (!req) throw new Error("Requisition request not found");

  req.status = "disbursed";
  req.disbursement_info = disbursement;
  req.updated_at = new Date().toISOString();

  try {
    await (supabase as any)
      .from("fleet_approvals")
      .update(req)
      .eq("id", requestId);
  } catch (e) {
    // fallback
  }

  const updatedList = requests.map((r) => (r.id === requestId ? req : r));
  saveLocalStore(orgId, updatedList);
  return req;
}
