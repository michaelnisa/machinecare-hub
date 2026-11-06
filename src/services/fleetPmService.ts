// Fleet Preventive Maintenance Service
// Automates odometer-based maintenance intervals and work-order generation
// for transport vehicles using live cached telematics from Trakzee.

import { supabase } from "@/integrations/supabase/client";

export interface FleetPmPackage {
  id: string;
  name: string;
  serviceType: "small" | "medium" | "major";
  intervalKm: number;
  intervalDays?: number;
  description: string;
  checklist: string[];
}

export const STANDARD_FLEET_PM_PACKAGES: FleetPmPackage[] = [
  {
    id: "service_a_oil_filter",
    name: "Service A: Engine Oil & Filter Service",
    serviceType: "small",
    intervalKm: 10000,
    intervalDays: 90,
    description: "Scheduled 10,000 km minor service: oil, oil filter, water separator drain, belt tension and safety check.",
    checklist: [
      "Drain and replace engine oil (15W40 heavy duty)",
      "Replace primary & secondary engine oil filters",
      "Inspect and drain fuel water separator bowl",
      "Check engine coolant level and freeze point",
      "Inspect serpentine belt and tensioner",
      "Lubricate chassis grease points (kingpins, prop shafts, fifth wheel)",
      "Check exterior lighting, horn, and wiper blades",
    ],
  },
  {
    id: "service_b_brakes_air",
    name: "Service B: Brake System & Air Element Service",
    serviceType: "medium",
    intervalKm: 25000,
    intervalDays: 180,
    description: "Scheduled 25,000 km intermediate service: full brake inspection, slack adjuster check, air cleaner replacement, tyre rotation.",
    checklist: [
      "All items in Service A (Oil & Filters)",
      "Inspect brake linings / pads thickness (min 4mm threshold)",
      "Inspect brake drums and discs for scoring or heat cracks",
      "Check automatic slack adjusters and chamber stroke length",
      "Replace engine primary air filter element",
      "Inspect wheel hub seals for oil leakage",
      "Check tyre tread depth across all positions and torque wheel nuts",
      "Test battery specific gravity and clean battery terminals",
    ],
  },
  {
    id: "service_c_major_drivetrain",
    name: "Service C: Drivetrain & Major Transmission Service",
    serviceType: "major",
    intervalKm: 50000,
    intervalDays: 365,
    description: "Scheduled 50,000 km major service: gearbox oil, differential fluid, cooling system flush, wheel bearing repack.",
    checklist: [
      "All items in Service A & B",
      "Drain and replace manual/automated transmission gearbox oil (80W90 / 85W140)",
      "Drain and replace drive axle differential oils and inspect magnetic plugs",
      "Flush and replace engine radiator coolant (50/50 OAT mixture)",
      "Repack steer and trailer wheel bearings with high-temp EP2 grease",
      "Inspect suspension torque rods, air bags, and shock absorbers",
      "Replace air dryer desiccant cartridge",
      "Check driveline universal joints and center support bearings",
    ],
  },
];

export interface OdoPmStatus {
  scheduleId: string;
  machineId: string;
  name: string;
  serviceType: string;
  intervalKm: number;
  lastServiceOdo: number;
  nextDueOdo: number;
  currentOdo: number;
  remainingKm: number;
  progressPct: number;
  status: "ok" | "due_soon" | "overdue";
  statusLabel: string;
  openWorkOrderId?: string;
  openWoNumber?: string;
}

/**
 * Computes odometer PM status and progress percentage given a schedule and current vehicle odometer.
 */
export function computeOdoPmStatus(schedule: any, currentOdometerKm: number | null | undefined): OdoPmStatus {
  const current = Number(currentOdometerKm || 0);
  const interval = Number(schedule.interval_hours || 10000); // interval_hours stores interval km for vehicles
  const lastOdo = Number(schedule.last_service_hours || 0);
  let nextDue = Number(schedule.next_due_hours || 0);

  if (nextDue <= 0) {
    nextDue = lastOdo > 0 ? lastOdo + interval : current + interval;
  }

  const remaining = nextDue - current;
  const elapsed = Math.max(0, current - lastOdo);
  const progressPct = interval > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / interval) * 100))) : 0;

  let status: "ok" | "due_soon" | "overdue" = "ok";
  let statusLabel = `${remaining.toLocaleString()} km remaining`;

  if (remaining <= 0) {
    status = "overdue";
    const over = Math.abs(remaining);
    statusLabel = `Overdue by ${over.toLocaleString()} km`;
  } else if (remaining <= 1000) {
    status = "due_soon";
    statusLabel = `Due in ${remaining.toLocaleString()} km`;
  }

  return {
    scheduleId: schedule.id,
    machineId: schedule.machine_id,
    name: schedule.name,
    serviceType: schedule.service_type,
    intervalKm: interval,
    lastServiceOdo: lastOdo,
    nextDueOdo: nextDue,
    currentOdo: current,
    remainingKm: remaining,
    progressPct,
    status,
    statusLabel,
  };
}

/**
 * Scans active vehicle service schedules against cached odometers and auto-generates
 * high-priority work orders for overdue or due-soon thresholds with zero duplication.
 */
export async function autoGenerateDuePmWorkOrders(
  organisationId: string,
  targetMachineIds?: string[]
): Promise<{ createdCount: number; checkedCount: number; details: string[] }> {
  try {
    // 1. Fetch fleet machines with their cached odometers
    let machineQuery = supabase
      .from("machines")
      .select("id, name, plate_number, current_odometer_km, status")
      .eq("organisation_id", organisationId)
      .in("category", ["Vehicle", "Trailer"]);

    if (targetMachineIds && targetMachineIds.length > 0) {
      machineQuery = machineQuery.in("id", targetMachineIds);
    }

    const { data: machines, error: mErr } = await machineQuery;
    if (mErr) throw mErr;
    if (!machines || machines.length === 0) return { createdCount: 0, checkedCount: 0, details: [] };

    const machineMap = new Map(machines.map((m) => [m.id, m]));
    const machineIds = machines.map((m) => m.id);

    // 2. Fetch active service schedules for these machines
    const { data: schedules, error: sErr } = await supabase
      .from("service_schedules")
      .select("*")
      .in("machine_id", machineIds);

    if (sErr) throw sErr;
    if (!schedules || schedules.length === 0) return { createdCount: 0, checkedCount: 0, details: [] };

    // 3. Fetch all open work orders for these machines to prevent duplicates
    const { data: openWos, error: wErr } = await supabase
      .from("work_orders")
      .select("id, machine_id, schedule_id, status")
      .in("machine_id", machineIds)
      .in("status", ["open", "assigned", "in_progress", "waiting_parts"]);

    if (wErr) throw wErr;

    const existingOpenSet = new Set<string>();
    for (const wo of openWos ?? []) {
      if (wo.machine_id && wo.schedule_id) {
        existingOpenSet.add(`${wo.machine_id}_${wo.schedule_id}`);
      }
    }

    let createdCount = 0;
    const details: string[] = [];

    // 4. Evaluate each schedule
    for (const sched of schedules) {
      const machine = machineMap.get(sched.machine_id);
      if (!machine) continue;

      const currentOdo = Number(machine.current_odometer_km || 0);
      const nextDue = Number(sched.next_due_hours || 0);
      const interval = Number(sched.interval_hours || 10000);

      // Only evaluate if vehicle has an active odometer reading and target due odometer is set
      if (currentOdo <= 0 || nextDue <= 0) continue;

      const remaining = nextDue - currentOdo;
      const isDue = remaining <= 500; // Trigger when within 500 km or overdue

      if (!isDue) continue;

      const dedupeKey = `${sched.machine_id}_${sched.id}`;
      if (existingOpenSet.has(dedupeKey)) {
        // Already has an open work order
        continue;
      }

      const isOverdue = remaining <= 0;
      const plate = machine.plate_number || machine.name;
      const title = `PM: ${sched.name} · ${plate}`;
      const description = `Automated Odometer-Triggered PM Work Order.\n` +
        `Vehicle: ${plate} (${machine.name})\n` +
        `Live Odometer: ${currentOdo.toLocaleString()} km\n` +
        `Scheduled Target: ${nextDue.toLocaleString()} km (Interval: ${interval.toLocaleString()} km)\n` +
        `Status: ${isOverdue ? `Overdue by ${Math.abs(remaining).toLocaleString()} km` : `Due in ${remaining.toLocaleString()} km`}\n\n` +
        `Maintenance Tasks:\n${sched.instructions || "Perform scheduled preventive maintenance inspection and fluid replacement."}`;

      const { data: newWo, error: insErr } = await supabase
        .from("work_orders")
        .insert({
          organisation_id: organisationId,
          machine_id: sched.machine_id,
          schedule_id: sched.id,
          title,
          description,
          priority: isOverdue ? "high" : "normal",
          status: "open",
          due_date: new Date().toISOString().slice(0, 10),
        })
        .select("id")
        .maybeSingle();

      if (insErr) {
        console.error("Failed to insert PM work order:", insErr);
        continue;
      }

      // Mark schedule status
      await supabase
        .from("service_schedules")
        .update({ status: isOverdue ? "overdue" : "due_soon" })
        .eq("id", sched.id);

      existingOpenSet.add(dedupeKey);
      createdCount++;
      details.push(`${plate}: ${sched.name} (${currentOdo.toLocaleString()} km)`);
    }

    return { createdCount, checkedCount: schedules.length, details };
  } catch (err: any) {
    console.error("Error in autoGenerateDuePmWorkOrders:", err);
    throw err;
  }
}

/**
 * Initializes standard fleet PM packages (e.g. 10,000 km Oil & 25,000 km Brakes)
 * across selected or all fleet vehicles.
 */
export async function applyFleetPmPackages(
  organisationId: string,
  vehicleIds: string[],
  packageIds: string[]
): Promise<{ addedCount: number; error?: string }> {
  try {
    const selectedPackages = STANDARD_FLEET_PM_PACKAGES.filter((p) => packageIds.includes(p.id));
    if (selectedPackages.length === 0) return { addedCount: 0, error: "No packages selected" };

    // Fetch vehicles
    const { data: vehicles, error: vErr } = await supabase
      .from("machines")
      .select("id, name, plate_number, current_odometer_km")
      .in("id", vehicleIds);

    if (vErr) throw vErr;
    if (!vehicles || vehicles.length === 0) return { addedCount: 0, error: "No vehicles found" };

    // Fetch existing schedules to prevent duplicate names
    const { data: existingSchedules } = await supabase
      .from("service_schedules")
      .select("machine_id, name")
      .in("machine_id", vehicleIds);

    const existingSet = new Set((existingSchedules ?? []).map((s) => `${s.machine_id}_${s.name.trim().toLowerCase()}`));

    let addedCount = 0;
    const inserts: any[] = [];

    for (const v of vehicles) {
      const currentOdo = Number(v.current_odometer_km || 0);

      for (const pkg of selectedPackages) {
        const key = `${v.id}_${pkg.name.trim().toLowerCase()}`;
        if (existingSet.has(key)) continue;

        // Calculate next due odometer aligned to interval multiples (or current + interval)
        const nextDueOdo = currentOdo > 0
          ? Math.ceil((currentOdo + 1) / pkg.intervalKm) * pkg.intervalKm
          : pkg.intervalKm;

        inserts.push({
          machine_id: v.id,
          name: pkg.name,
          service_type: pkg.serviceType,
          interval_hours: pkg.intervalKm, // stores km
          last_service_hours: Math.max(0, nextDueOdo - pkg.intervalKm),
          next_due_hours: nextDueOdo,
          interval_days: pkg.intervalDays ?? null,
          next_due_date: pkg.intervalDays
            ? new Date(Date.now() + pkg.intervalDays * 86400000).toISOString().slice(0, 10)
            : null,
          instructions: pkg.checklist.map((item, i) => `${i + 1}. ${item}`).join("\n"),
          status: currentOdo >= nextDueOdo ? "overdue" : "ok",
        });
      }
    }

    if (inserts.length > 0) {
      const { error: insErr } = await supabase.from("service_schedules").insert(inserts);
      if (insErr) throw insErr;
      addedCount = inserts.length;
    }

    return { addedCount };
  } catch (err: any) {
    console.error("Error applying fleet PM packages:", err);
    return { addedCount: 0, error: err.message };
  }
}

/**
 * Records a completed PM service, logs to service_logs, advances the next due odometer,
 * and completes any linked open PM work order.
 */
export async function recordCompletedPmService(params: {
  scheduleId: string;
  machineId: string;
  completedOdometerKm: number;
  costTotal?: number;
  performedBy?: string;
  notes?: string;
}): Promise<{ success: boolean; nextDueOdo: number; error?: string }> {
  try {
    const { scheduleId, machineId, completedOdometerKm, costTotal, performedBy, notes } = params;

    // Fetch the schedule
    const { data: sched, error: sErr } = await supabase
      .from("service_schedules")
      .select("*")
      .eq("id", scheduleId)
      .single();

    if (sErr) throw sErr;

    const interval = Number(sched.interval_hours || 10000);
    const newNextDueOdo = completedOdometerKm + interval;
    const today = new Date().toISOString().slice(0, 10);

    // 1. Log to service_logs
    await supabase.from("service_logs").insert({
      machine_id: machineId,
      schedule_id: scheduleId,
      service_type: sched.service_type,
      title: `Completed PM: ${sched.name}`,
      description: notes || `Service performed at ${completedOdometerKm.toLocaleString()} km. Next due at ${newNextDueOdo.toLocaleString()} km.`,
      service_date: today,
      meter_hours: completedOdometerKm,
      cost_total: costTotal ?? null,
      performed_by: performedBy ?? null,
    });

    // 2. Advance schedule next_due_hours
    await supabase
      .from("service_schedules")
      .update({
        last_service_hours: completedOdometerKm,
        last_service_date: today,
        next_due_hours: newNextDueOdo,
        next_due_date: sched.interval_days
          ? new Date(Date.now() + sched.interval_days * 86400000).toISOString().slice(0, 10)
          : null,
        status: "ok",
      })
      .eq("id", scheduleId);

    // 3. Complete linked open work order if any exists
    const { data: openWos } = await supabase
      .from("work_orders")
      .select("id")
      .eq("machine_id", machineId)
      .eq("schedule_id", scheduleId)
      .in("status", ["open", "assigned", "in_progress", "waiting_parts"]);

    for (const wo of openWos ?? []) {
      await supabase
        .from("work_orders")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          resolution_notes: `PM completed at ${completedOdometerKm.toLocaleString()} km.`,
        })
        .eq("id", wo.id);
    }

    return { success: true, nextDueOdo: newNextDueOdo };
  } catch (err: any) {
    console.error("Error recording completed PM service:", err);
    return { success: false, nextDueOdo: 0, error: err.message };
  }
}
