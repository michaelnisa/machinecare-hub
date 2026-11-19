/**
 * Driver Complaints, Inspection Findings & Subsystem Classification Service
 * Implements Mega Beverages Slide 10 (Inspection Management) & Slide 11 (Component-Based Maintenance Tracking).
 */

import { supabase } from "@/integrations/supabase/client";
import { formatWoNumber } from "@/components/WorkOrderPreview";

export type DriverComplaintType =
  | "reported_defect"
  | "abnormal_condition"
  | "breakdown_report";

export type SubsystemCategory =
  | "Engine System"
  | "Fuel System"
  | "Brake System"
  | "Suspension System"
  | "Steering System"
  | "Transmission System"
  | "Electrical System"
  | "Electronics System"
  | "Air System"
  | "Body Works"
  | "Accident Repairs";

export const SUBSYSTEM_CATEGORIES: SubsystemCategory[] = [
  "Engine System",
  "Fuel System",
  "Brake System",
  "Suspension System",
  "Steering System",
  "Transmission System",
  "Electrical System",
  "Electronics System",
  "Air System",
  "Body Works",
  "Accident Repairs",
];

export interface ComplaintAttachment {
  name: string;
  url: string;
  file_type: "photo" | "video" | "report_pdf" | "document";
  size_kb?: number;
}

export interface WorkshopInspectionFindings {
  inspection_result?: string;
  defect_analysis?: string; // Root-cause analysis (e.g. fatigue wear, lack of lube, operator error)
  recommendations?: string; // Preventive recommendation (e.g. replace assembly, recalibrate valve)
  inspected_by?: string;
  inspector_name?: string;
  inspected_at?: string;
}

export interface DriverComplaintRecord {
  id: string;
  organisation_id: string;
  machine_id: string;
  vehicle_plate: string;
  vehicle_name: string;
  complaint_type: DriverComplaintType;
  subsystem: SubsystemCategory;
  title: string;
  description: string;
  abnormal_symptoms: string[]; // e.g. ["Abnormal Whistling Sound", "Black Exhaust Smoke", "Excessive Vibration", "Warning Light"]
  gps_location?: string;
  odometer_km?: number;
  reporter_type: "driver" | "workshop_inspector" | "field_technician";
  driver_id?: string;
  reporter_name: string;
  reporter_phone: string;
  severity: "minor" | "major" | "critical_breakdown";
  status: "open" | "under_inspection" | "converted_to_wo" | "dismissed";
  findings?: WorkshopInspectionFindings;
  attachments: ComplaintAttachment[];
  work_order_id?: string;
  created_at: string;
  updated_at: string;
}

export interface RecurringFailureAlert {
  machine_id: string;
  vehicle_plate: string;
  vehicle_name: string;
  subsystem: SubsystemCategory;
  incident_count: number;
  first_incident_at: string;
  last_incident_at: string;
  risk_level: "moderate" | "high" | "chronic";
  recommendation: string;
  related_complaint_ids: string[];
  related_wo_ids: string[];
}

const STORAGE_COMPLAINTS_KEY = "mc_driver_complaints_v1_";

const SEED_COMPLAINTS: Omit<DriverComplaintRecord, "organisation_id">[] = [
  {
    id: "comp-seed-01",
    machine_id: "seed-veh-01",
    vehicle_plate: "T 412 DFB",
    vehicle_name: "Scania R500 Prime Mover",
    complaint_type: "breakdown_report",
    subsystem: "Air System",
    title: "Air Brake System Pressure Drop - Grounded at Mikumi",
    description: "Rapid air pressure depletion when applying service brake. Audible whistling leak near primary foot valve relay.",
    abnormal_symptoms: ["Audible Air Leak Hiss", "Low Air Pressure Warning Alarm", "Brake Lockup"],
    gps_location: "Mikumi National Park Corridor, Morogoro Road",
    odometer_km: 184500,
    reporter_type: "driver",
    reporter_name: "Juma Said Mwinyi",
    reporter_phone: "+255 714 882 109",
    severity: "critical_breakdown",
    status: "open",
    findings: {
      inspection_result: "Confirmed crack on nylon high-pressure air supply line leading into relay valve.",
      defect_analysis: "Thermal fatigue and stone chip impact along corridor gravel detour.",
      recommendations: "Replace damaged airline section with reinforced braided hose; install stone guard bracket.",
      inspector_name: "Fundi Emmanuel (Field Rescue)",
      inspected_at: "2026-11-19T08:30:00Z",
    },
    attachments: [
      {
        name: "airline_crack_photo.jpg",
        url: "/placeholder.svg",
        file_type: "photo",
      },
      {
        name: "corridor_incident_report.pdf",
        url: "#",
        file_type: "report_pdf",
      },
    ],
    created_at: "2026-11-19T07:15:00Z",
    updated_at: "2026-11-19T08:30:00Z",
  },
  {
    id: "comp-seed-02",
    machine_id: "seed-veh-02",
    vehicle_plate: "T 619 DGB",
    vehicle_name: "Sinotruk Howo 371 Tipper",
    complaint_type: "abnormal_condition",
    subsystem: "Engine System",
    title: "Engine Knocking & Black Smoke Under Load",
    description: "Engine emitting heavy black exhaust smoke when pulling steep grades with full beverage payload. Unsteady idle rpm.",
    abnormal_symptoms: ["Heavy Black Smoke", "Engine Knocking Noise", "Loss of Power Under Load"],
    gps_location: "Chalinze Junction Weighbridge",
    odometer_km: 92400,
    reporter_type: "driver",
    reporter_name: "Bakari Ally",
    reporter_phone: "+255 754 331 445",
    severity: "major",
    status: "under_inspection",
    findings: {
      inspection_result: "Clogged primary fuel water-separator cartridge causing fuel starvation and injector nozzle dribbling.",
      defect_analysis: "Contaminated diesel from secondary corridor pump station.",
      recommendations: "Drain water separator, flush secondary fuel filter, clean injector nozzles and sample fuel batch.",
      inspector_name: "Workshop Supervisor Peter",
      inspected_at: "2026-11-18T16:00:00Z",
    },
    attachments: [
      {
        name: "exhaust_smoke_video.mp4",
        url: "#",
        file_type: "video",
      },
    ],
    created_at: "2026-11-18T14:20:00Z",
    updated_at: "2026-11-18T16:00:00Z",
  },
  {
    id: "comp-seed-03",
    machine_id: "seed-gen-01",
    vehicle_plate: "GEN-01",
    vehicle_name: "Cummins 500kVA Standby Generator",
    complaint_type: "abnormal_condition",
    subsystem: "Electrical System",
    title: "Output Voltage Hunting & High Frequency Fluctuation",
    description: "Generator hunted between 380V and 425V during plant blackout changeover test. Frequency fluctuated between 48Hz and 53Hz.",
    abnormal_symptoms: ["Voltage Fluctuations", "Audible Engine Speed Hunting"],
    gps_location: "Main Plant Generator Room Bay 1",
    odometer_km: 2450,
    reporter_type: "workshop_inspector",
    reporter_name: "Plant Operator Mwita",
    reporter_phone: "+255 784 990 123",
    severity: "major",
    status: "open",
    findings: {
      inspection_result: "AVR SX460 potentiometer trimmer oxidized; fuel actuator linkage slightly stiff.",
      defect_analysis: "Atmospheric moisture in plant room during monsoon rains.",
      recommendations: "Replace AVR board with sealed unit; lubricate actuator linkage.",
      inspector_name: "Senior Electrician Kassim",
      inspected_at: "2026-11-19T10:15:00Z",
    },
    attachments: [
      {
        name: "generator_test_chart.pdf",
        url: "#",
        file_type: "report_pdf",
      },
    ],
    created_at: "2026-11-19T09:45:00Z",
    updated_at: "2026-11-19T10:15:00Z",
  },
];

function getLocalStore(orgId: string): DriverComplaintRecord[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_COMPLAINTS_KEY}${orgId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Could not read local driver complaints:", e);
  }

  // Initialize seed complaints for this organisation
  const initial = SEED_COMPLAINTS.map((c) => ({
    ...c,
    organisation_id: orgId,
  }));
  saveLocalStore(orgId, initial);
  return initial;
}

function saveLocalStore(orgId: string, records: DriverComplaintRecord[]) {
  try {
    localStorage.setItem(
      `${STORAGE_COMPLAINTS_KEY}${orgId}`,
      JSON.stringify(records)
    );
  } catch (e) {
    console.warn("Could not save local driver complaints:", e);
  }
}

/**
 * Fetch all driver complaints and inspection findings for an organisation
 */
export async function getDriverComplaints(
  orgId: string,
  vehicleId?: string
): Promise<DriverComplaintRecord[]> {
  const localList = getLocalStore(orgId);

  // Sync with remote fault_reports table if available
  try {
    let query = (supabase as any)
      .from("fault_reports")
      .select("*, machine:machines(id, name, plate_number, registration_number)")
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false });

    if (vehicleId) {
      query = query.eq("machine_id", vehicleId);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      // Merge remote fault reports with local store
      const remoteParsed: DriverComplaintRecord[] = data.map((fr: any) => {
        let meta: any = {};
        try {
          if (fr.description && fr.description.includes("{")) {
            const start = fr.description.indexOf("{");
            meta = JSON.parse(fr.description.slice(start));
          }
        } catch {}

        return {
          id: fr.id,
          organisation_id: fr.organisation_id,
          machine_id: fr.machine_id,
          vehicle_plate: fr.machine?.plate_number || fr.machine?.registration_number || fr.machine?.name || "Vehicle",
          vehicle_name: fr.machine?.name || "Asset",
          complaint_type: meta.complaint_type || "reported_defect",
          subsystem: meta.subsystem || "Engine System",
          title: meta.title || `Fault: ${fr.description.slice(0, 50)}`,
          description: meta.clean_description || fr.description,
          abnormal_symptoms: meta.abnormal_symptoms || [],
          gps_location: meta.gps_location,
          odometer_km: meta.odometer_km,
          reporter_type: meta.reporter_type || "driver",
          reporter_name: fr.reporter_name,
          reporter_phone: fr.reporter_phone,
          severity: fr.severity === "critical" ? "critical_breakdown" : (fr.severity as any) || "major",
          status: fr.work_order_id ? "converted_to_wo" : fr.status === "dismissed" ? "dismissed" : "open",
          findings: meta.findings,
          attachments: meta.attachments || (fr.photo_url ? [{ name: "Attached Photo", url: fr.photo_url, file_type: "photo" }] : []),
          work_order_id: fr.work_order_id || undefined,
          created_at: fr.created_at,
          updated_at: fr.updated_at || fr.created_at,
        };
      });

      // Combine local records (which might have rich media) with remote records
      const combinedMap = new Map<string, DriverComplaintRecord>();
      localList.forEach((c) => combinedMap.set(c.id, c));
      remoteParsed.forEach((r) => combinedMap.set(r.id, r));
      const combined = Array.from(combinedMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      if (vehicleId) return combined.filter((c) => c.machine_id === vehicleId);
      return combined;
    }
  } catch (e) {
    // Fallback to local
  }

  if (vehicleId) return localList.filter((c) => c.machine_id === vehicleId);
  return localList;
}

/**
 * Submit a new driver complaint, defect report, or abnormal condition report
 */
export async function createDriverComplaint(
  payload: Omit<DriverComplaintRecord, "id" | "created_at" | "updated_at">
): Promise<DriverComplaintRecord> {
  const existing = getLocalStore(payload.organisation_id);
  const now = new Date().toISOString();
  const id = `comp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const newRecord: DriverComplaintRecord = {
    ...payload,
    id,
    created_at: now,
    updated_at: now,
  };

  // Try storing in remote fault_reports table with serialized JSON metadata
  try {
    const metaPayload = {
      complaint_type: payload.complaint_type,
      subsystem: payload.subsystem,
      title: payload.title,
      clean_description: payload.description,
      abnormal_symptoms: payload.abnormal_symptoms,
      gps_location: payload.gps_location,
      odometer_km: payload.odometer_km,
      reporter_type: payload.reporter_type,
      findings: payload.findings,
      attachments: payload.attachments,
    };

    const firstPhoto = payload.attachments?.find((a) => a.file_type === "photo")?.url;

    await (supabase as any).from("fault_reports").insert({
      id,
      organisation_id: payload.organisation_id,
      machine_id: payload.machine_id,
      reporter_name: payload.reporter_name,
      reporter_phone: payload.reporter_phone,
      description: `${payload.title}\n\n${payload.description}\n\n${JSON.stringify(metaPayload)}`,
      severity: payload.severity === "critical_breakdown" ? "critical" : payload.severity,
      status: "new",
      photo_url: firstPhoto || null,
    });
  } catch (e) {
    console.warn("Could not push complaint to remote fault_reports:", e);
  }

  const updated = [newRecord, ...existing];
  saveLocalStore(payload.organisation_id, updated);
  return newRecord;
}

/**
 * Update workshop inspection findings, defect analysis, and recommendations
 */
export async function updateComplaintFindings(
  orgId: string,
  complaintId: string,
  findings: WorkshopInspectionFindings
): Promise<DriverComplaintRecord> {
  const complaints = await getDriverComplaints(orgId);
  const record = complaints.find((c) => c.id === complaintId);
  if (!record) throw new Error("Complaint record not found");

  record.findings = {
    ...record.findings,
    ...findings,
    inspected_at: findings.inspected_at || new Date().toISOString(),
  };
  record.status = "under_inspection";
  record.updated_at = new Date().toISOString();

  // Update local
  const updated = complaints.map((c) => (c.id === complaintId ? record : c));
  saveLocalStore(orgId, updated);

  // Sync to remote if possible
  try {
    await (supabase as any)
      .from("fault_reports")
      .update({ status: "triaged" })
      .eq("id", complaintId);
  } catch {}

  return record;
}

/**
 * Convert a driver complaint directly into a Digital Job Card (Work Order)
 * Seamlessly brings forward all defect analysis, recommendations, and subsystem classification (Slide 9 & 10)
 */
export async function convertComplaintToWorkOrder(
  orgId: string,
  complaintId: string,
  userId?: string
): Promise<{ success: boolean; workOrderId: string; woNumber: string }> {
  const complaints = await getDriverComplaints(orgId);
  const record = complaints.find((c) => c.id === complaintId);
  if (!record) throw new Error("Complaint record not found");

  const year = new Date().getFullYear();

  // Get next WO number
  let nextWoNum = 1;
  try {
    const { data: counter } = await (supabase as any)
      .from("org_wo_counters")
      .select("next_number")
      .eq("organisation_id", orgId)
      .eq("year", year)
      .maybeSingle();
    if (counter?.next_number) nextWoNum = counter.next_number;
  } catch {}

  const formattedRemedy = `[COMPONENT: ${record.subsystem}] [LOCATION: ${record.complaint_type === "breakdown_report" ? "offsite" : "onsite"}]\n` +
    `Defect Analysis: ${record.findings?.defect_analysis || "Inspected upon arrival"}\n` +
    `Recommendation: ${record.findings?.recommendations || "Perform corrective repair and road test"}`;

  const formattedDesc = `Driver Complaint (${record.complaint_type.replace(/_/g, " ").toUpperCase()}):\n` +
    `${record.description}\n\n` +
    `Symptoms: ${record.abnormal_symptoms.join(", ") || "None specified"}\n` +
    `Corridor/Location: ${record.gps_location || "Depot"}\n` +
    `Reported By: ${record.reporter_name} (${record.reporter_phone})`;

  const { data: wo, error } = await supabase
    .from("work_orders")
    .insert({
      organisation_id: orgId,
      machine_id: record.machine_id,
      title: `${record.complaint_type === "breakdown_report" ? "Breakdown Repair" : "Defect Rectification"}: ${record.title}`,
      description: formattedDesc,
      proposed_remedy: formattedRemedy,
      priority: record.severity === "critical_breakdown" ? "urgent" : record.severity === "major" ? "high" : "normal",
      status: "open",
      created_by: userId || null,
    })
    .select("id, wo_number, wo_year")
    .single();

  if (error || !wo) {
    throw new Error(error?.message || "Failed to create work order");
  }

  // Update complaint status
  record.status = "converted_to_wo";
  record.work_order_id = wo.id;
  record.updated_at = new Date().toISOString();

  const updated = complaints.map((c) => (c.id === complaintId ? record : c));
  saveLocalStore(orgId, updated);

  try {
    await (supabase as any)
      .from("fault_reports")
      .update({ status: "converted", work_order_id: wo.id })
      .eq("id", complaintId);
  } catch {}

  const woNumber = formatWoNumber(wo.wo_year, wo.wo_number);
  return { success: true, workOrderId: wo.id, woNumber };
}

/**
 * Slide 11: Recurring Failure Detection Engine
 * Scans complaints and work orders to identify recurring component failures per vehicle/asset.
 * Identifies chronic repeat issues within 90 days.
 */
export function detectRecurringFailures(
  complaints: DriverComplaintRecord[],
  workOrders: any[]
): RecurringFailureAlert[] {
  // Group incidents by machine_id + subsystem
  const groups: Record<
    string,
    {
      machine_id: string;
      vehicle_plate: string;
      vehicle_name: string;
      subsystem: SubsystemCategory;
      dates: string[];
      complaint_ids: string[];
      wo_ids: string[];
    }
  > = {};

  // Process complaints
  for (const c of complaints) {
    const key = `${c.machine_id}_${c.subsystem}`;
    if (!groups[key]) {
      groups[key] = {
        machine_id: c.machine_id,
        vehicle_plate: c.vehicle_plate,
        vehicle_name: c.vehicle_name,
        subsystem: c.subsystem,
        dates: [],
        complaint_ids: [],
        wo_ids: [],
      };
    }
    groups[key].dates.push(c.created_at);
    groups[key].complaint_ids.push(c.id);
    if (c.work_order_id) groups[key].wo_ids.push(c.work_order_id);
  }

  // Process work orders that have [COMPONENT: ...]
  for (const w of workOrders) {
    const text = `${w.proposed_remedy || ""} ${w.description || ""}`;
    const match = text.match(/\[COMPONENT:\s*([^\]]+)\]/);
    if (match && w.machine_id) {
      const sub = match[1].trim() as SubsystemCategory;
      const key = `${w.machine_id}_${sub}`;
      if (!groups[key]) {
        groups[key] = {
          machine_id: w.machine_id,
          vehicle_plate: w.machine?.plate_number || w.machine?.name || "Asset",
          vehicle_name: w.machine?.name || "Asset",
          subsystem: sub,
          dates: [],
          complaint_ids: [],
          wo_ids: [],
        };
      }
      groups[key].dates.push(w.created_at);
      groups[key].wo_ids.push(w.id);
    }
  }

  // Filter groups with >= 2 incidents in the last 90 days
  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const alerts: RecurringFailureAlert[] = [];

  for (const item of Object.values(groups)) {
    const recentDates = item.dates
      .map((d) => new Date(d).getTime())
      .filter((t) => now - t <= ninetyDaysMs)
      .sort((a, b) => a - b);

    if (recentDates.length >= 2) {
      const count = recentDates.length;
      const risk_level: "moderate" | "high" | "chronic" =
        count >= 4 ? "chronic" : count >= 3 ? "high" : "moderate";

      let recommendation = "";
      switch (item.subsystem) {
        case "Brake System":
          recommendation = "Chronic brake overheating or lining degradation. Inspect relay valves, air line pressure balance, and drum concentricity.";
          break;
        case "Air System":
          recommendation = "Repeated air leaks or pressure loss. Overhaul air dryer desiccant cartridge and test four-circuit protection valve.";
          break;
        case "Engine System":
          recommendation = "Recurring engine fault. Perform comprehensive cylinder compression test, inspect turbocharger boost, and check oil analysis.";
          break;
        case "Fuel System":
          recommendation = "Repeated fuel delivery issues. Inspect fuel tank bottom sediment, replace suction strainer, and check high pressure pump.";
          break;
        case "Suspension System":
          recommendation = "Chronic leaf spring or bushing failure. Verify payload axle weight limits and inspect shock absorber damping.";
          break;
        case "Electrical System":
          recommendation = "Recurring electrical faults. Test alternator charging ripple, check chassis ground straps, and inspect starter relay harness.";
          break;
        default:
          recommendation = `Recurring failure on ${item.subsystem}. Conduct root-cause teardown and review parts supplier batch quality.`;
      }

      alerts.push({
        machine_id: item.machine_id,
        vehicle_plate: item.vehicle_plate,
        vehicle_name: item.vehicle_name,
        subsystem: item.subsystem,
        incident_count: count,
        first_incident_at: new Date(recentDates[0]).toISOString(),
        last_incident_at: new Date(recentDates[recentDates.length - 1]).toISOString(),
        risk_level,
        recommendation,
        related_complaint_ids: Array.from(new Set(item.complaint_ids)),
        related_wo_ids: Array.from(new Set(item.wo_ids)),
      });
    }
  }

  return alerts.sort((a, b) => b.incident_count - a.incident_count);
}
