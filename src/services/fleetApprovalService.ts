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
    if (raw) return JSON.parse(raw);
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
 * Returns initial realistic starter approvals for demonstration (Mega Beverages context)
 */
function getInitialSeedData(orgId: string, isMultiDepartment = true): FleetApprovalRequest[] {
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 72 * 3600 * 1000).toISOString();

  if (!isMultiDepartment) {
    return [
      {
        id: "seed-app-01",
        organisation_id: orgId,
        request_number: "REQ-2026-0081",
        request_type: "emergency_breakdown",
        priority: "emergency",
        title: "Highway Turbo Hose Failure & Emergency Towing",
        description:
          "Truck T 412 DFB blew high-pressure turbocharger intercooler hose at Mikumi Escarpment. Engine derated to limp home mode. Roadside mobile rescue mechanic requires emergency parts & labor payment.",
        vehicle_plate: "T 412 DFB",
        amount: 480000,
        currency: "TZS",
        department: "Fleet Operations & Dispatch",
        requested_by: "driver-seed-1",
        requester_name: "Hamisi Juma (Driver)",
        gps_location: "Morogoro-Iringa Highway KM 182 (Mikumi)",
        vendor_name: "Mikumi Highway Mobile Truck Service",
        vendor_phone: "+255 754 889 120",
        items: [
          { name: "Heavy Duty Silicon Turbo Hose 90mm", quantity: 1, unit_price: 280000, total_price: 280000 },
          { name: "Corridor Emergency Mobile Labor Callout", quantity: 1, unit_price: 200000, total_price: 200000 },
        ],
        evidence_urls: [],
        status: "pending_fleet_manager",
        current_stage: "fleet_manager",
        approval_chain: [
          {
            stage: "fleet_manager",
            stage_label: "Operations Manager Approval",
            roleRequired: "manager",
            status: "pending",
          },
        ],
        created_at: twoHoursAgo,
        updated_at: twoHoursAgo,
      },
      {
        id: "seed-app-02",
        organisation_id: orgId,
        request_number: "REQ-2026-0082",
        request_type: "spare_parts",
        priority: "urgent",
        title: "Full Set Brake Linings & S-Cam Repair Kit (Howo 6x4)",
        description:
          "Scheduled 60,000 KM major brake overhaul for prime mover T 839 EDK. Friction material worn down to rivets.",
        vehicle_plate: "T 839 EDK",
        amount: 1450000,
        currency: "TZS",
        department: "Workshop & Maintenance",
        requested_by: "mechanic-seed-1",
        requester_name: "Emanuel Kweka (Lead Mechanic)",
        items: [
          { name: "Howo Sinotruk Original Brake Linings (Drive Axles)", quantity: 4, unit_price: 260000, total_price: 1040000 },
          { name: "S-Camshaft Heavy Bushing & Roller Overhaul Kit", quantity: 2, unit_price: 205000, total_price: 410000 },
        ],
        evidence_urls: [],
        status: "pending_fleet_manager",
        current_stage: "fleet_manager",
        approval_chain: [
          {
            stage: "fleet_manager",
            stage_label: "Operations Manager Approval",
            roleRequired: "manager",
            status: "pending",
          },
        ],
        created_at: yesterday,
        updated_at: yesterday,
      },
      {
        id: "seed-app-03",
        organisation_id: orgId,
        request_number: "REQ-2026-0083",
        request_type: "trip_float",
        priority: "standard",
        title: "Transit Safari Float: Dar es Salaam to Lusaka / Ndola",
        description:
          "Pre-allocated trip disbursement for consignment of commercial cargo. Covers fuel allowance card, road tolls, weighbridge passes, and driver per diem for 8 days transit.",
        vehicle_plate: "T 281 CXY",
        amount: 4200000,
        currency: "TZS",
        department: "Fleet Operations & Dispatch",
        requested_by: "dispatcher-seed",
        requester_name: "Amina Salum (Dispatcher)",
        items: [
          { name: "Enroute Diesel Float (1,250 Liters)", quantity: 1, unit_price: 3375000, total_price: 3375000 },
          { name: "TANROADS & Zambia Road User Tolls", quantity: 1, unit_price: 350000, total_price: 350000 },
          { name: "Driver Cross-Border Per Diem (8 Days)", quantity: 8, unit_price: 59375, total_price: 475000 },
        ],
        evidence_urls: [],
        status: "approved",
        current_stage: "completed",
        approval_chain: [
          {
            stage: "fleet_manager",
            stage_label: "Operations Manager Approval",
            roleRequired: "manager",
            status: "approved",
            reviewer_name: "Operations Manager",
            reviewed_at: threeDaysAgo,
            note: "Journey management plan verified. Approved.",
          },
        ],
        created_at: yesterday,
        updated_at: yesterday,
      },
      {
        id: "seed-app-04",
        organisation_id: orgId,
        request_number: "REQ-2026-0084",
        request_type: "tyre_replacement",
        priority: "standard",
        title: "Steer Axle Tyre Replacement (Serial: BR-8829-X)",
        description:
          "Tread depth down to 2.8mm on Left Steer Tyre (minimum safety threshold 3.0mm). Requesting brand new 315/80R22.5 Bridgestone R150.",
        vehicle_plate: "T 619 DZA",
        amount: 1100000,
        currency: "TZS",
        department: "Workshop & Maintenance",
        requested_by: "tyre-tech-1",
        requester_name: "John Mtui (Tyre Controller)",
        items: [
          { name: "315/80R22.5 Premium Steer Commercial Tyre", quantity: 1, unit_price: 1100000, total_price: 1100000 },
        ],
        evidence_urls: [],
        status: "pending_fleet_manager",
        current_stage: "fleet_manager",
        approval_chain: [
          {
            stage: "fleet_manager",
            stage_label: "Operations Manager Approval",
            roleRequired: "manager",
            status: "pending",
          },
        ],
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ];
  }

  return [
    {
      id: "seed-app-01",
      organisation_id: orgId,
      request_number: "REQ-2026-0081",
      request_type: "emergency_breakdown",
      priority: "emergency",
      title: "Highway Turbo Hose Failure & Emergency Towing",
      description:
        "Truck T 412 DFB blew high-pressure turbocharger intercooler hose at Mikumi Escarpment. Engine derated to limp home mode. Roadside mobile rescue mechanic requires emergency parts & labor payment.",
      vehicle_plate: "T 412 DFB",
      amount: 480000,
      currency: "TZS",
      department: "Fleet Operations & Dispatch",
      requested_by: "driver-seed-1",
      requester_name: "Hamisi Juma (Driver)",
      gps_location: "Morogoro-Iringa Highway KM 182 (Mikumi)",
      vendor_name: "Mikumi Highway Mobile Truck Service",
      vendor_phone: "+255 754 889 120",
      items: [
        { name: "Heavy Duty Silicon Turbo Hose 90mm", quantity: 1, unit_price: 280000, total_price: 280000 },
        { name: "Corridor Emergency Mobile Labor Callout", quantity: 1, unit_price: 200000, total_price: 200000 },
      ],
      evidence_urls: [],
      status: "pending_fleet_manager",
      current_stage: "fleet_manager",
      approval_chain: [
        {
          stage: "supervisor",
          stage_label: "Workshop Supervisor",
          roleRequired: "engineer",
          status: "approved",
          reviewer_name: "Eng. Baraka M.",
          reviewed_at: twoHoursAgo,
          note: "Fault verified via telematics boost pressure fault code (SPN 102). Approved for highway roadside rescue.",
        },
        {
          stage: "fleet_manager",
          stage_label: "Fleet Operations Manager",
          roleRequired: "manager",
          status: "pending",
        },
        {
          stage: "finance",
          stage_label: "Finance & Accounts",
          roleRequired: "accountant",
          status: "pending",
        },
      ],
      created_at: twoHoursAgo,
      updated_at: twoHoursAgo,
    },
    {
      id: "seed-app-02",
      organisation_id: orgId,
      request_number: "REQ-2026-0082",
      request_type: "spare_parts",
      priority: "urgent",
      title: "Full Set Brake Linings & S-Cam Repair Kit (Howo 6x4)",
      description:
        "Scheduled 60,000 KM major brake overhaul for prime mover T 839 EDK. Friction material worn down to rivets.",
      vehicle_plate: "T 839 EDK",
      amount: 1450000,
      currency: "TZS",
      department: "Workshop & Maintenance",
      requested_by: "mechanic-seed-1",
      requester_name: "Emanuel Kweka (Lead Mechanic)",
      items: [
        { name: "Howo Sinotruk Original Brake Linings (Drive Axles)", quantity: 4, unit_price: 260000, total_price: 1040000 },
        { name: "S-Camshaft Heavy Bushing & Roller Overhaul Kit", quantity: 2, unit_price: 205000, total_price: 410000 },
      ],
      evidence_urls: [],
      status: "pending_procurement",
      current_stage: "procurement",
      approval_chain: [
        {
          stage: "supervisor",
          stage_label: "Workshop Supervisor",
          roleRequired: "engineer",
          status: "approved",
          reviewer_name: "Eng. Baraka M.",
          reviewed_at: yesterday,
          note: "Brake drums inspected and within permissible wear limit. Approved for lining replacement.",
        },
        {
          stage: "fleet_manager",
          stage_label: "Fleet Operations Manager",
          roleRequired: "manager",
          status: "approved",
          reviewer_name: "Kassim Mwinyi",
          reviewed_at: yesterday,
          note: "Truck scheduled for Lubumbashi dispatch on Friday. Expedite parts sourcing.",
        },
        {
          stage: "procurement",
          stage_label: "Procurement / Sourcing",
          roleRequired: "manager",
          status: "pending",
        },
        {
          stage: "finance",
          stage_label: "Finance & Accounts",
          roleRequired: "accountant",
          status: "pending",
        },
      ],
      created_at: yesterday,
      updated_at: yesterday,
    },
    {
      id: "seed-app-03",
      organisation_id: orgId,
      request_number: "REQ-2026-0083",
      request_type: "trip_float",
      priority: "standard",
      title: "Transit Safari Float: Dar es Salaam to Lusaka / Ndola",
      description:
        "Pre-allocated trip disbursement for consignment of beverage products. Covers fuel allowance card, road tolls, weighbridge passes, and driver per diem for 8 days transit.",
      vehicle_plate: "T 281 CXY",
      amount: 4200000,
      currency: "TZS",
      department: "Fleet Operations & Dispatch",
      requested_by: "dispatcher-seed",
      requester_name: "Amina Salum (Dispatcher)",
      items: [
        { name: "Enroute Diesel Float (1,250 Liters)", quantity: 1, unit_price: 3375000, total_price: 3375000 },
        { name: "TANROADS & Zambia Road User Tolls", quantity: 1, unit_price: 350000, total_price: 350000 },
        { name: "Driver Cross-Border Per Diem (8 Days)", quantity: 8, unit_price: 59375, total_price: 475000 },
      ],
      evidence_urls: [],
      status: "approved",
      current_stage: "completed",
      approval_chain: [
        {
          stage: "supervisor",
          stage_label: "Workshop Supervisor",
          roleRequired: "engineer",
          status: "approved",
          reviewer_name: "Eng. Baraka M.",
          reviewed_at: threeDaysAgo,
          note: "Pre-trip mechanical inspection passed.",
        },
        {
          stage: "fleet_manager",
          stage_label: "Fleet Operations Manager",
          roleRequired: "manager",
          status: "approved",
          reviewer_name: "Kassim Mwinyi",
          reviewed_at: threeDaysAgo,
          note: "Journey management plan verified.",
        },
        {
          stage: "finance",
          stage_label: "Finance & Accounts",
          roleRequired: "accountant",
          status: "approved",
          reviewer_name: "Neema Lyimo (Accountant)",
          reviewed_at: threeDaysAgo,
          note: "Budget allocated under Transit Operations. Authorized for M-Pesa / corporate card release.",
        },
      ],
      disbursement_info: {
        disbursed_at: threeDaysAgo,
        disbursed_by: "finance-neema",
        disburser_name: "Neema Lyimo",
        method: "selcom",
        reference: "SEL-89214-TZ",
        note: "Disbursed to driver corporate Puma Fuel card & M-Pesa float.",
      },
      created_at: threeDaysAgo,
      updated_at: threeDaysAgo,
    },
    {
      id: "seed-app-04",
      organisation_id: orgId,
      request_number: "REQ-2026-0084",
      request_type: "tyre_replacement",
      priority: "standard",
      title: "Steer Axle Tyre Replacement (Serial: BR-8829-X)",
      description:
        "Tread depth down to 2.8mm on Left Steer Tyre (minimum safety threshold 3.0mm). Requesting brand new 315/80R22.5 Bridgestone R150.",
      vehicle_plate: "T 619 DZA",
      amount: 1100000,
      currency: "TZS",
      department: "Workshop & Maintenance",
      requested_by: "tyre-tech-1",
      requester_name: "John Mtui (Tyre Controller)",
      items: [
        { name: "315/80R22.5 Premium Steer Commercial Tyre", quantity: 1, unit_price: 1100000, total_price: 1100000 },
      ],
      evidence_urls: [],
      status: "pending_supervisor",
      current_stage: "supervisor",
      approval_chain: [
        {
          stage: "supervisor",
          stage_label: "Workshop Supervisor",
          roleRequired: "engineer",
          status: "pending",
        },
        {
          stage: "fleet_manager",
          stage_label: "Fleet Operations Manager",
          roleRequired: "manager",
          status: "pending",
        },
        {
          stage: "procurement",
          stage_label: "Procurement / Sourcing",
          roleRequired: "manager",
          status: "pending",
        },
        {
          stage: "finance",
          stage_label: "Finance & Accounts",
          roleRequired: "accountant",
          status: "pending",
        },
      ],
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
  ];
}

/**
 * Fetch all fleet approval requests for the organization
 */
export async function getFleetApprovalRequests(
  orgId: string,
  isMultiDepartment = true
): Promise<FleetApprovalRequest[]> {
  try {
    const { data, error } = await (supabase as any)
      .from("fleet_approvals")
      .select("*")
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (err) {
    // remote table does not exist or network unavailable
  }

  // Fallback to local store or initial seed
  const stored = getLocalStore(orgId);
  if (stored && stored.length > 0) {
    return stored;
  }

  const seeded = getInitialSeedData(orgId, isMultiDepartment);
  saveLocalStore(orgId, seeded);
  return seeded;
}

/**
 * Create a new fleet requisition / approval request
 */
export async function createFleetApprovalRequest(
  payload: Omit<FleetApprovalRequest, "id" | "request_number" | "created_at" | "updated_at">
): Promise<FleetApprovalRequest> {
  const existing = getLocalStore(payload.organisation_id);
  const nextNum = existing.length + 85;
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
