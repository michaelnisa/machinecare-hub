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
