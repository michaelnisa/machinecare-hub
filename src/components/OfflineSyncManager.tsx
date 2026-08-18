import { supabase } from "@/integrations/supabase/client";
import { useOfflineQueue, type FlushHandlers } from "@/lib/offlineQueue";

interface PreStartInspectionPayload {
  executionPayload: Record<string, unknown>;
  responseRows: Record<string, unknown>[];
}

interface ChecklistResponseUpdatePayload {
  responseId: string;
  patch: Record<string, unknown>;
}

interface ChecklistCompletePayload {
  executionId: string;
  patch: Record<string, unknown>;
}

interface FaultReportPayload {
  organisation_id: string;
  machine_id: string;
  reporter_name: string;
  reporter_phone: string;
  description: string;
  severity: string;
  created_by: string | null;
  photo: File | null;
}

interface InductionCompletePayload {
  recordId: string;
  signaturePngBase64: string;
}

const handlers: FlushHandlers = {
  pre_start_inspection: async (payload: PreStartInspectionPayload) => {
    const { executionPayload, responseRows } = payload;
    const { error: execErr } = await supabase.from("checklist_executions").insert(executionPayload as any);
    if (execErr) throw execErr;
    const { error: respErr } = await supabase.from("checklist_execution_responses").insert(responseRows as any);
    if (respErr) throw respErr;
  },
  checklist_response_update: async (payload: ChecklistResponseUpdatePayload) => {
    const { error } = await supabase
      .from("checklist_execution_responses")
      .update(payload.patch as any)
      .eq("id", payload.responseId);
    if (error) throw error;
  },
  checklist_complete: async (payload: ChecklistCompletePayload) => {
    const { error } = await supabase
      .from("checklist_executions")
      .update(payload.patch as any)
      .eq("id", payload.executionId);
    if (error) throw error;
  },
  fault_report: async (payload: FaultReportPayload) => {
    let photo_url: string | null = null;
    if (payload.photo) {
      const ext = (payload.photo.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${payload.organisation_id}/faults/${payload.machine_id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("machine-docs")
        .upload(path, payload.photo, { contentType: payload.photo.type, upsert: false });
      if (upErr) throw upErr;
      photo_url = path;
    }
    const { error } = await (supabase as any).from("fault_reports").insert({
      organisation_id: payload.organisation_id,
      machine_id: payload.machine_id,
      reporter_name: payload.reporter_name,
      reporter_phone: payload.reporter_phone,
      description: payload.description,
      severity: payload.severity,
      photo_url,
      created_by: payload.created_by,
    });
    if (error) throw error;
  },
  induction_complete: async (payload: InductionCompletePayload) => {
    const { error } = await supabase.functions.invoke("complete-induction-public", {
      body: { recordId: payload.recordId, signaturePngBase64: payload.signaturePngBase64 },
    });
    if (error) throw error;
  },
};

/**
 * Invisible, always-mounted: replays queued offline writes (pre-start
 * inspections, checklist edits) whenever the app regains connectivity,
 * regardless of which page the technician is currently on.
 */
export function OfflineSyncManager() {
  useOfflineQueue(handlers);
  return null;
}
