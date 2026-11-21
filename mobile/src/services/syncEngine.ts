import { supabase } from "../config/supabase";
import { storageService, OfflineReceiptItem, OfflineInspectionItem } from "./storageService";

export interface SyncResult {
  receiptsSynced: number;
  inspectionsSynced: number;
  errors: string[];
}

export const syncEngine = {
  async syncAll(): Promise<SyncResult> {
    const result: SyncResult = {
      receiptsSynced: 0,
      inspectionsSynced: 0,
      errors: [],
    };

    // 1. Sync Receipts to trip_expenses & trip safari_float
    const receipts = await storageService.getOfflineReceipts();
    if (receipts.length > 0) {
      const syncedIds: string[] = [];

      for (const r of receipts) {
        try {
          const { error } = await supabase.from("trip_expenses").insert({
            trip_id: r.tripId,
            machine_id: r.vehicleId,
            expense_type: r.category,
            title: r.title,
            amount: r.amount,
            currency: r.currency,
            reference_number: r.receiptNo || null,
            notes: `Mobile App Sync · [${r.category}] ${r.notes || ""}`.trim(),
            occurred_at: r.recordedAt,
          });

          if (!error) {
            syncedIds.push(r.id);
            result.receiptsSynced++;
          } else {
            result.errors.push(`Receipt error (${r.title}): ${error.message}`);
          }
        } catch (e: any) {
          result.errors.push(`Receipt sync failed: ${e?.message || e}`);
        }
      }

      if (syncedIds.length > 0) {
        await storageService.clearOfflineReceipts(syncedIds);
      }
    }

    // 2. Sync Inspections
    const inspections = await storageService.getOfflineInspections();
    if (inspections.length > 0) {
      const syncedIds: string[] = [];

      for (const ins of inspections) {
        try {
          // If there is any defect, log a fault report
          const hasDefect = !ins.tyresOk || !ins.oilCoolantOk || !ins.brakesOk || !ins.lightsOk || !ins.trailerLockOk;

          if (hasDefect) {
            const defectsList = [
              !ins.tyresOk ? "Tyres" : null,
              !ins.oilCoolantOk ? "Engine Oil/Coolant" : null,
              !ins.brakesOk ? "Brakes" : null,
              !ins.lightsOk ? "Lights" : null,
              !ins.trailerLockOk ? "Trailer Coupling" : null,
            ].filter(Boolean).join(", ");

            await supabase.from("fault_reports").insert({
              machine_id: ins.vehicleId,
              reporter_name: ins.inspectorName,
              description: `[Mobile Pre-Trip Walkaround Defect]: Issues with: ${defectsList}. Notes: ${ins.defectNotes || "None"}`,
              status: "open",
            });
          }

          syncedIds.push(ins.id);
          result.inspectionsSynced++;
        } catch (e: any) {
          result.errors.push(`Inspection sync failed: ${e?.message || e}`);
        }
      }

      if (syncedIds.length > 0) {
        await storageService.clearOfflineInspections(syncedIds);
      }
    }

    return result;
  },
};
