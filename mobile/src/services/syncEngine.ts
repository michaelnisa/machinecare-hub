import { supabase } from "../config/supabase";
import { storageService, OfflineReceiptItem, OfflineInspectionItem } from "./storageService";
import { manufacturingService } from "./manufacturingService";

export interface SyncResult {
  receiptsSynced: number;
  inspectionsSynced: number;
  downtimesSynced: number;
  scrapsSynced: number;
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
      downtimesSynced: 0,
      scrapsSynced: 0,
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
              // Fallback: If trip_expenses table fails, append expense to trip route_notes
              const expenseNote = `[Expense ${r.category.toUpperCase()}]: ${r.title} (TZS ${r.amount.toLocaleString()})`;
              const { data: tripData } = await supabase
                .from("trips")
                .select("route_notes")
                .eq("id", targetTripId)
                .maybeSingle();

              const prevNotes = tripData?.route_notes || "";
              await supabase
                .from("trips")
                .update({
                  route_notes: prevNotes ? `${prevNotes}\n${expenseNote}` : expenseNote,
                })
                .eq("id", targetTripId);

              syncedIds.push(r.id);
              result.receiptsSynced++;
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

    // 2. Sync Inspections to fault_reports & machines odometer
    const inspections = await storageService.getOfflineInspections();
    if (inspections.length > 0) {
      const syncedIds: string[] = [];

      for (const ins of inspections) {
        try {
          const hasDefect = !ins.tyresOk || !ins.oilCoolantOk || !ins.brakesOk || !ins.lightsOk || !ins.trailerLockOk;

          // Sync defect report to workshop if any check failed
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

          // Always synchronize latest vehicle odometer if provided
          if (ins.odometerKm && ins.odometerKm > 0 && isUuid(ins.vehicleId)) {
            await supabase
              .from("machines")
              .update({ current_odometer_km: ins.odometerKm })
              .eq("id", ins.vehicleId);
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

    // 3. Sync Manufacturing Downtime Events
    const downtimes = await storageService.getOfflineDowntimes();
    if (downtimes.length > 0) {
      const syncedDowntimeIds: string[] = [];
      const today = new Date().toISOString().slice(0, 10);
      for (const dt of downtimes) {
        try {
          if (dt.organisationId) {
            const kpi = await manufacturingService.getOrCreateTodayKpi(dt.organisationId, dt.productionLine || "Line 1");
            const kpiId = kpi?.id;

            if (kpiId && isUuid(kpiId)) {
              const { error } = await (supabase as any).from("production_downtime_events").insert({
                organisation_id: dt.organisationId,
                production_kpi_id: kpiId,
                machine_id: isUuid(dt.machineId) ? dt.machineId : null,
                category: dt.category || "unplanned",
                reason_code: dt.reason,
                duration_minutes: dt.downtimeMinutes,
                record_date: dt.recordedAt ? dt.recordedAt.slice(0, 10) : today,
                notes: dt.notes || `Synced from Mobile App [${dt.category}]`,
              });

              if (!error) {
                // Increment kpi accumulator
                await supabase
                  .from("production_kpis")
                  .update({
                    downtime_minutes: (Number(kpi.downtime_minutes) || 0) + dt.downtimeMinutes,
                  })
                  .eq("id", kpiId);

                syncedDowntimeIds.push(dt.id);
                result.downtimesSynced++;
              }
            }
          }
        } catch (e: any) {
          result.errors.push(`Downtime sync error: ${e?.message || e}`);
        }
      }
      if (syncedDowntimeIds.length > 0) {
        await storageService.clearOfflineDowntimes(syncedDowntimeIds);
      }
    }

    // 4. Sync Manufacturing Scrap Events
    const scraps = await storageService.getOfflineScraps();
    if (scraps.length > 0) {
      const syncedScrapIds: string[] = [];
      const today = new Date().toISOString().slice(0, 10);
      for (const sc of scraps) {
        try {
          if (sc.organisationId) {
            const kpi = await manufacturingService.getOrCreateTodayKpi(sc.organisationId, sc.productionLine || "Line 1");
            const kpiId = kpi?.id;

            if (kpiId && isUuid(kpiId)) {
              const { error } = await (supabase as any).from("production_scrap_events").insert({
                organisation_id: sc.organisationId,
                production_kpi_id: kpiId,
                machine_id: isUuid(sc.machineId) ? sc.machineId : null,
                reason_code: sc.reason,
                quantity: sc.scrapUnits,
                record_date: sc.recordedAt ? sc.recordedAt.slice(0, 10) : today,
                notes: sc.notes ? `[${sc.unit}] ${sc.notes}` : `[${sc.unit}] Cost: TZS ${sc.costImpact}`,
              });

              if (!error) {
                // Increment kpi accumulator
                await supabase
                  .from("production_kpis")
                  .update({
                    scrap_units: (Number(kpi.scrap_units) || 0) + sc.scrapUnits,
                  })
                  .eq("id", kpiId);

                syncedScrapIds.push(sc.id);
                result.scrapsSynced++;
              }
            }
          }
        } catch (e: any) {
          result.errors.push(`Scrap sync error: ${e?.message || e}`);
        }
      }
      if (syncedScrapIds.length > 0) {
        await storageService.clearOfflineScraps(syncedScrapIds);
      }
    }

    return result;
  },
};
