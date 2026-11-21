import { supabase } from "../config/supabase";
import { storageService, OfflineReceiptItem, OfflineInspectionItem } from "./storageService";

export interface SyncResult {
  receiptsSynced: number;
  inspectionsSynced: number;
  errors: string[];
}

const isUuid = (str?: string): boolean => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

export const syncEngine = {
  async syncAll(): Promise<SyncResult> {
    const result: SyncResult = {
      receiptsSynced: 0,
      inspectionsSynced: 0,
      errors: [],
    };

    // Helper map for vehicle organisation IDs
    const vehicleOrgCache: Record<string, string> = {};

    const getMachineOrg = async (machineId: string): Promise<string | null> => {
      if (vehicleOrgCache[machineId]) return vehicleOrgCache[machineId];
      if (!isUuid(machineId)) return null;

      try {
        const { data } = await supabase
          .from("machines")
          .select("organisation_id")
          .eq("id", machineId)
          .maybeSingle();

        if (data?.organisation_id) {
          vehicleOrgCache[machineId] = data.organisation_id;
          return data.organisation_id;
        }
      } catch {}
      return null;
    };

    // 1. Sync Receipts to trip_expenses
    const receipts = await storageService.getOfflineReceipts();
    if (receipts.length > 0) {
      const syncedIds: string[] = [];

      for (const r of receipts) {
        try {
          let targetTripId = isUuid(r.tripId) ? r.tripId : null;
          let targetOrgId = r.organisationId || null;
          let targetDriverId = r.driverId || null;

          // If no direct trip UUID, attempt to resolve from vehicle's active trip
          if (!targetTripId && isUuid(r.vehicleId)) {
            const { data: tripData } = await supabase
              .from("trips")
              .select("id, organisation_id, driver_id")
              .eq("machine_id", r.vehicleId)
              .in("status", ["in_progress", "active", "dispatched"])
              .order("start_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (tripData) {
              targetTripId = tripData.id;
              targetOrgId = targetOrgId || tripData.organisation_id;
              targetDriverId = targetDriverId || tripData.driver_id;
            }
          }

          if (!targetOrgId && isUuid(r.vehicleId)) {
            targetOrgId = await getMachineOrg(r.vehicleId);
          }

          // If we have a valid trip and machine, insert into trip_expenses
          if (targetTripId && isUuid(r.vehicleId) && targetOrgId) {
            const { error } = await (supabase as any).from("trip_expenses").insert({
              trip_id: targetTripId,
              machine_id: r.vehicleId,
              organisation_id: targetOrgId,
              driver_id: targetDriverId,
              expense_type: r.category,
              title: r.title,
              amount: r.amount,
              currency: r.currency || "TZS",
              reference_number: r.receiptNo || null,
              notes: `Mobile App Sync · [${r.category}] ${r.notes || ""}`.trim(),
              occurred_at: r.recordedAt || new Date().toISOString(),
            });

            if (!error) {
              syncedIds.push(r.id);
              result.receiptsSynced++;
            } else {
              result.errors.push(`Receipt error (${r.title}): ${error.message}`);
            }
          } else {
            // No active trip found yet: keep in offline queue until trip is dispatched
            console.log(`Receipt ${r.title} kept in queue pending active trip for vehicle ${r.vehicleId}`);
          }
        } catch (e: any) {
          result.errors.push(`Receipt sync failed: ${e?.message || e}`);
        }
      }

      if (syncedIds.length > 0) {
        await storageService.clearOfflineReceipts(syncedIds);
      }
    }

    // 2. Sync Inspections to fault_reports
    const inspections = await storageService.getOfflineInspections();
    if (inspections.length > 0) {
      const syncedIds: string[] = [];

      for (const ins of inspections) {
        try {
          const hasDefect = !ins.tyresOk || !ins.oilCoolantOk || !ins.brakesOk || !ins.lightsOk || !ins.trailerLockOk;

          if (hasDefect && isUuid(ins.vehicleId)) {
            let targetOrgId = ins.organisationId || (await getMachineOrg(ins.vehicleId));

            if (targetOrgId) {
              const defectsList = [
                !ins.tyresOk ? "Tyres" : null,
                !ins.oilCoolantOk ? "Engine Oil/Coolant" : null,
                !ins.brakesOk ? "Brakes" : null,
                !ins.lightsOk ? "Lights" : null,
                !ins.trailerLockOk ? "Trailer Coupling" : null,
              ].filter(Boolean).join(", ");

              const { error } = await supabase.from("fault_reports").insert({
                machine_id: ins.vehicleId,
                organisation_id: targetOrgId,
                reporter_name: ins.inspectorName || "Commercial Driver",
                reporter_phone: ins.inspectorPhone || "0700000000",
                severity: "high",
                description: `[Mobile Walkaround Pre-Start Defect]: ${defectsList}. Notes: ${ins.defectNotes || "None"} (ODO: ${ins.odometerKm || 0} km)`,
                status: "open",
                created_at: ins.recordedAt || new Date().toISOString(),
              });

              if (error) {
                result.errors.push(`Inspection defect sync error: ${error.message}`);
                continue;
              }
            }
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
