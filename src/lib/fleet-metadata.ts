// ─────────────────────────────────────────────────────────────
// Fleet Metadata Helpers
// Bridges rich fleet features (trailers, axle configurations,
// multi-tank capacities, driver KYC, client orders) with the
// confirmed remote Supabase database schema without schema mismatches.
// ─────────────────────────────────────────────────────────────

import type { TruckLayoutConfigId } from "./fleet-constants";
import { supabase } from "@/integrations/supabase/client";

export const SAFE_MACHINE_COLUMNS =
  "id, name, plate_number, make, model, year, vin, category, fuel_type, tank_capacity_l, current_odometer_km, current_hours, home_depot, cover_image_url, status, notes";

export const SAFE_DRIVER_COLUMNS =
  "id, full_name, phone, status, notes, photo_url";

export const SAFE_TRIP_COLUMNS =
  "id, machine_id, driver_id, status, start_at, end_at, start_odo, end_odo, origin, destination, cargo_description";

export const SAFE_TYRE_COLUMNS =
  "id, organisation_id, machine_id, position, brand, size, serial, fitted_at, fitted_odo, removed_at, removed_reason, current_tread_mm, target_replace_km, notes, created_at, updated_at";

export const AXLE_CONFIG_OPTIONS: { value: TruckLayoutConfigId; label: string; description: string; tyreCount: number }[] = [
  { value: "6x4", label: "6x4 Heavy Truck (10 Tyres)", description: "1 Steer Axle + 2 Dual Drive Rear Axles (Prime Mover / Heavy Hauler / Tanker Head)", tyreCount: 10 },
  { value: "4x2", label: "4x2 Rigid Truck (6 Tyres)", description: "1 Steer Axle + 1 Dual Drive Rear Axle (Distribution / Medium Cargo)", tyreCount: 6 },
  { value: "4x2_trailer", label: "4x2 with Rigid Trailer (12 Tyres)", description: "4x2 Rigid Truck (6 Tyres) + Drawbar Rigid Trailer (6 Tyres: 1 Steer + 1 Dual Axle)", tyreCount: 12 },
  { value: "8x4", label: "8x4 Multi-Axle Hauler (12 Tyres)", description: "2 Front Steer Axles + 2 Dual Drive Rear Axles (Heavy Tipper / Super Hauler)", tyreCount: 12 },
  { value: "trailer_tri", label: "Tri-Axle Trailer (12 Tyres)", description: "3 Dual Axles (Fuel Tanker Trailer / Heavy Flatbed)", tyreCount: 12 },
  { value: "trailer_tandem", label: "Tandem Axle Trailer (8 Tyres)", description: "2 Dual Axles (Standard Cargo / Semi-Trailer)", tyreCount: 8 },
  { value: "4_wheel", label: "4-Wheel Light Vehicle (4 Tyres)", description: "2 Single Axles (Pickup / Van / Utility)", tyreCount: 4 },
];

export interface FleetVehicle {
  id: string;
  vehicle_code: string; // Unique Fleet ID (e.g. TRK-001 or TRL-001)
  name: string;
  plate_number: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  category: "Vehicle" | "Trailer" | string;
  fuel_type: string | null;
  tank_capacity_l: number | null;
  current_odometer_km: number | null;
  current_hours: number | null;
  home_depot: string | null;
  cover_image_url: string | null;
  status: string;
  notes: string | null;

  // Live Telematics & GPS data
  telematics_imei?: string | null;
  telematics_speed?: number | null;
  telematics_ignition?: boolean | null;
  telematics_battery_volt?: number | null;
  telematics_battery_pct?: number | null;
  telematics_location?: string | null;
  telematics_driver_name?: string | null;
  telematics_heading?: number | null;
  telematics_device_model?: string | null;
  telematics_latitude?: number | null;
  telematics_longitude?: number | null;
  telematics_last_at?: string | null;
  telematics_status?: TelematicsStatus | null;

  // Rich metadata attributes (stored safely in notes)
  vehicle_type: string; // 'prime_mover' | 'rigid_truck' | 'tanker' | 'trailer' | 'van' | 'pickup' | 'bus' | 'other'
  axle_configuration: TruckLayoutConfigId;
  is_trailer: boolean;
  linked_trailer_id: string | null;
  linked_trailer_plate: string | null;
  linked_trailer_name: string | null;
  head_tank_capacity_l: number | null;
  trailer_tank_capacity_l: number | null;
  total_tank_capacity_l: number | null;
  auto_pm_enabled?: boolean;
  auto_pm_hours_interval?: number | null;
  auto_pm_km_interval?: number | null;
  user_notes: string | null;

  // Compatibility helpers
  has_trailer: boolean;
  trailer_plate: string | null;
  trailer_make_model: string | null;
}

export type TelematicsStatus = "Running" | "Idle" | "Inactive" | "Stopped";

export function normalizeTelematicsStatus(
  rawStatus?: string | null,
  speed?: number | null,
  ignition?: boolean | null,
  lastAt?: string | null,
  hasGps?: boolean | null
): TelematicsStatus {
  if (rawStatus) {
    const s = String(rawStatus).trim().toLowerCase();
    if (s === "running" || s === "moving") return "Running";
    if (s === "idle" || s === "idling") return "Idle";
    if (s === "inactive" || s === "offline" || s === "nodata" || s === "no_data") return "Inactive";
    if (s === "stopped" || s === "parked") return "Stopped";
  }

  // Fallback calculation if raw status is not provided or unrecognized
  if (hasGps === false && (!lastAt || isNaN(Date.parse(lastAt)))) {
    return "Inactive";
  }
  if (lastAt) {
    const timeDiff = Date.now() - new Date(lastAt).getTime();
    // Mark Inactive if no telemetry fix received in the last 24 hours
    if (timeDiff > 24 * 60 * 60 * 1000) {
      return "Inactive";
    }
  }
  const spd = Number(speed || 0);
  if (spd > 0) return "Running";
  if (ignition) return "Idle";
  return "Stopped";
}

/**
 * Robustly cleans and formats driver names from telematics payloads.
 * Filters out placeholder strings like '--', 'null', 'NA', 'None', etc.
 * Deduplicates repeated name parts (e.g. 'Adam Adam' -> 'Adam', 'simon simon' -> 'Simon')
 * and normalizes to clean Title Case.
 */
export function cleanDriverName(
  first?: any,
  middle?: any,
  last?: any,
  fallbackName?: any
): string | null {
  const isInvalid = (val: any) => {
    if (!val) return true;
    const s = String(val).trim().toLowerCase();
    return (
      !s ||
      s === "--" ||
      s === "null" ||
      s === "na" ||
      s === "n/a" ||
      s === "-" ||
      s === "none" ||
      s === "undefined"
    );
  };

  const rawParts = [first, middle, last]
    .filter((p) => !isInvalid(p))
    .map((p) => String(p).trim());

  let rawString = "";
  if (rawParts.length > 0) {
    rawString = rawParts.join(" ");
  } else if (!isInvalid(fallbackName)) {
    rawString = String(fallbackName).trim();
  }

  if (!rawString) return null;

  // Split into words and deduplicate repeated words (case-insensitive)
  // e.g. "Adam Adam" -> "Adam", "simon simon" -> "Simon"
  const words = rawString.split(/\s+/).filter(Boolean);
  const uniqueWords: string[] = [];
  for (const w of words) {
    const lower = w.toLowerCase();
    if (!uniqueWords.some((existing) => existing.toLowerCase() === lower)) {
      uniqueWords.push(w);
    }
  }

  if (uniqueWords.length === 0) return null;

  // Format into clean Title Case (e.g. "Majaliwa Lukama", "Saidi Kautipe")
  return uniqueWords
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function generateVehicleCode(category: "Vehicle" | "Trailer" | string = "Vehicle", seed?: string, index?: number): string {
  const isTrailer = String(category).toLowerCase().includes("trailer");
  const prefix = isTrailer ? "TRL" : "TRK";

  if (typeof index === "number" && index >= 0) {
    return `${prefix}-${String(index + 1).padStart(3, "0")}`;
  }
  if (seed) {
    const clean = seed.trim().toUpperCase();
    if (/^[A-Z]{2,4}-\d{2,4}$/.test(clean)) return clean;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 33 + seed.charCodeAt(i)) % 99;
    }
    return `${prefix}-${String((Math.abs(hash) % 99) + 1).padStart(3, "0")}`;
  }
  const rand = Math.floor(1 + Math.random() * 99);
  return `${prefix}-${String(rand).padStart(3, "0")}`;
}

export function parseMachine(raw: any, index?: number): FleetVehicle {
  let vehicle_type = "rigid_truck";
  let axle_configuration = "6x4";
  let is_trailer = raw.category === "Trailer";
  let linked_trailer_id: string | null = null;
  let linked_trailer_plate: string | null = null;
  let linked_trailer_name: string | null = null;
  let head_tank_capacity_l: number | null = raw.tank_capacity_l ?? null;
  let trailer_tank_capacity_l: number | null = null;
  let total_tank_capacity_l: number | null = raw.tank_capacity_l ?? null;
  let user_notes: string | null = raw.notes ?? null;
  let vehicle_code: string | null = null;

  let current_hours: number | null = raw.current_hours ?? null;
  let auto_pm_enabled: boolean = false;
  let auto_pm_hours_interval: number | null = null;
  let auto_pm_km_interval: number | null = null;

  let telematics_imei: string | null = (raw as any).telematics_imei ?? null;
  let telematics_speed: number | null = (raw as any).telematics_speed != null ? Number((raw as any).telematics_speed) : null;
  let telematics_ignition: boolean | null = (raw as any).telematics_ignition != null ? Boolean((raw as any).telematics_ignition) : null;
  let telematics_battery_volt: number | null = (raw as any).telematics_battery_volt != null ? Number((raw as any).telematics_battery_volt) : null;
  let telematics_battery_pct: number | null = (raw as any).telematics_battery_pct != null ? Number((raw as any).telematics_battery_pct) : null;
  let telematics_location: string | null = (raw as any).telematics_location ?? null;
  let telematics_driver_name: string | null = (raw as any).telematics_driver_name ?? null;
  let telematics_heading: number | null = (raw as any).telematics_heading != null ? Number((raw as any).telematics_heading) : null;
  let telematics_device_model: string | null = (raw as any).telematics_device_model ?? null;
  let telematics_latitude: number | null = (raw as any).telematics_latitude != null ? Number((raw as any).telematics_latitude) : null;
  let telematics_longitude: number | null = (raw as any).telematics_longitude != null ? Number((raw as any).telematics_longitude) : null;
  let telematics_last_at: string | null = (raw as any).telematics_last_at ?? null;
  let telematics_raw: any = (raw as any).telematics_raw ?? null;
  let telematics_obj: any = null;

  if (raw.notes && typeof raw.notes === "string" && raw.notes.startsWith("{") && raw.notes.endsWith("}")) {
    try {
      const parsed = JSON.parse(raw.notes);
      if (parsed.vehicle_code) vehicle_code = parsed.vehicle_code;
      if (parsed.vehicle_type) vehicle_type = parsed.vehicle_type;
      if (parsed.axle_configuration) axle_configuration = parsed.axle_configuration;
      if (parsed.is_trailer != null) is_trailer = Boolean(parsed.is_trailer);
      if (parsed.linked_trailer_id != null) linked_trailer_id = parsed.linked_trailer_id;
      if (parsed.linked_trailer_plate != null) linked_trailer_plate = parsed.linked_trailer_plate;
      if (parsed.linked_trailer_name != null) linked_trailer_name = parsed.linked_trailer_name;
      if (parsed.head_tank_capacity_l != null) head_tank_capacity_l = Number(parsed.head_tank_capacity_l);
      if (parsed.trailer_tank_capacity_l != null) trailer_tank_capacity_l = Number(parsed.trailer_tank_capacity_l);
      if (parsed.total_tank_capacity_l != null) total_tank_capacity_l = Number(parsed.total_tank_capacity_l);
      if (parsed.auto_pm_enabled != null) auto_pm_enabled = Boolean(parsed.auto_pm_enabled);
      if (parsed.auto_pm_hours_interval != null) auto_pm_hours_interval = Number(parsed.auto_pm_hours_interval);
      if (parsed.auto_pm_km_interval != null) auto_pm_km_interval = Number(parsed.auto_pm_km_interval);
      user_notes = parsed.text ?? null;

      // Extract telematics from structured notes JSON
      if (parsed.telematics) {
        telematics_obj = parsed.telematics;
        const t = parsed.telematics;
        if (telematics_imei == null && t.imei != null) telematics_imei = String(t.imei);
        if (telematics_speed == null && t.speed != null) telematics_speed = Number(t.speed);
        if (telematics_ignition == null && t.ignition != null) telematics_ignition = Boolean(t.ignition);
        if (telematics_battery_volt == null && t.battery_volt != null) telematics_battery_volt = Number(t.battery_volt);
        if (telematics_battery_pct == null && t.battery_percentage != null) telematics_battery_pct = Number(t.battery_percentage);
        if (telematics_location == null && t.location != null) telematics_location = String(t.location);
        if (telematics_heading == null && t.heading != null) telematics_heading = Number(t.heading);
        if (telematics_device_model == null && t.device_model != null) telematics_device_model = String(t.device_model);
        if (telematics_latitude == null && t.latitude != null) telematics_latitude = Number(t.latitude);
        if (telematics_longitude == null && t.longitude != null) telematics_longitude = Number(t.longitude);
        if (telematics_last_at == null && t.last_at != null) telematics_last_at = String(t.last_at);
        if (telematics_raw == null && t.raw != null) telematics_raw = t.raw;

        // Clean driver name from telematics or raw GPS data
        const extractedDriver = cleanDriverName(
          t.raw?.Driver_First_Name,
          t.raw?.Driver_Middle_Name,
          t.raw?.Driver_Last_Name,
          t.driver_name || t.raw?.Driver_Name || t.raw?.driver || parsed.driver_name
        );
        if (extractedDriver) {
          telematics_driver_name = extractedDriver;
        }

        // Fallback directly to t.raw fields if not yet populated
        if (!telematics_location && t.raw?.Location && t.raw.Location !== "--") telematics_location = String(t.raw.Location);
        if (telematics_battery_pct == null && t.raw?.battery_percentage != null && t.raw.battery_percentage !== "--") {
          telematics_battery_pct = Number(t.raw.battery_percentage);
        }
      }
      if (telematics_imei == null && parsed.telematics_imei != null) telematics_imei = String(parsed.telematics_imei);
    } catch {
      // Fallback on parse failure
    }
  } else if (raw.category === "Trailer") {
    vehicle_type = "trailer";
    axle_configuration = "trailer_tri";
    is_trailer = true;
  }

  // Ensure trailer default axle
  if (is_trailer && !axle_configuration.startsWith("trailer")) {
    axle_configuration = "trailer_tri";
  }

  // Deterministic fallback for sequential or seeded vehicle code
  if (!vehicle_code) {
    vehicle_code = generateVehicleCode(
      is_trailer ? "Trailer" : (raw.category || "Vehicle"),
      raw.plate_number || raw.name || raw.id,
      index
    );
  }

  const has_trailer = Boolean(is_trailer || linked_trailer_id || linked_trailer_plate);

  const rawTelematicsStatus = (raw as any).telematics_status ??
    telematics_obj?.status ??
    telematics_raw?.Status ??
    telematics_raw?.status ??
    null;

  const telematics_status = normalizeTelematicsStatus(
    rawTelematicsStatus,
    telematics_speed,
    telematics_ignition,
    telematics_last_at,
    telematics_latitude != null && telematics_longitude != null
  );

  return {
    ...raw,
    vehicle_code,
    current_hours,
    vehicle_type,
    axle_configuration: axle_configuration as TruckLayoutConfigId,
    is_trailer,
    linked_trailer_id,
    linked_trailer_plate,
    linked_trailer_name,
    head_tank_capacity_l,
    trailer_tank_capacity_l,
    total_tank_capacity_l,
    auto_pm_enabled,
    auto_pm_hours_interval,
    auto_pm_km_interval,
    user_notes,
    has_trailer,
    trailer_plate: linked_trailer_plate,
    trailer_make_model: linked_trailer_name,
    telematics_imei,
    telematics_speed,
    telematics_ignition,
    telematics_battery_volt,
    telematics_battery_pct,
    telematics_location,
    telematics_driver_name,
    telematics_heading,
    telematics_device_model,
    telematics_latitude,
    telematics_longitude,
    telematics_last_at,
    telematics_status,
    telematics_raw,
    telematics_obj,
  };
}

export function serializeMachinePayload(data: {
  vehicle_code?: string | null;
  name: string;
  plate_number: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  category: "Vehicle" | "Trailer" | string;
  fuel_type: string | null;
  tank_capacity_l: number | null;
  current_odometer_km: number | null;
  current_hours?: number | null;
  home_depot: string | null;
  status: string;
  cover_image_url: string | null;
  telematics_imei?: string | null;
  existing_telematics?: any;

  // Metadata attributes
  vehicle_type: string;
  axle_configuration: string;
  is_trailer: boolean;
  linked_trailer_id?: string | null;
  linked_trailer_plate?: string | null;
  linked_trailer_name?: string | null;
  head_tank_capacity_l?: number | null;
  trailer_tank_capacity_l?: number | null;
  total_tank_capacity_l?: number | null;
  auto_pm_enabled?: boolean;
  auto_pm_hours_interval?: number | null;
  auto_pm_km_interval?: number | null;
  user_notes?: string | null;
}) {
  const cleanImei = data.telematics_imei ? data.telematics_imei.trim() : null;

  const meta: any = {
    vehicle_code: data.vehicle_code ? data.vehicle_code.trim().toUpperCase() : null,
    vehicle_type: data.vehicle_type,
    axle_configuration: data.axle_configuration,
    is_trailer: data.is_trailer,
    linked_trailer_id: data.linked_trailer_id ?? null,
    linked_trailer_plate: data.linked_trailer_plate ?? null,
    linked_trailer_name: data.linked_trailer_name ?? null,
    head_tank_capacity_l: data.head_tank_capacity_l ?? null,
    trailer_tank_capacity_l: data.trailer_tank_capacity_l ?? null,
    total_tank_capacity_l: data.total_tank_capacity_l ?? null,
    auto_pm_enabled: data.auto_pm_enabled ?? false,
    auto_pm_hours_interval: data.auto_pm_hours_interval ?? null,
    auto_pm_km_interval: data.auto_pm_km_interval ?? null,
    text: data.user_notes ?? "",
  };

  if (cleanImei) {
    meta.telematics_imei = cleanImei;
  }
  if (data.existing_telematics) {
    meta.telematics = {
      ...data.existing_telematics,
      ...(cleanImei ? { imei: cleanImei } : {}),
    };
  }

  const payload: any = {
    name: data.name,
    plate_number: data.plate_number,
    make: data.make,
    model: data.model,
    year: data.year,
    vin: data.vin,
    category: data.category,
    fuel_type: data.fuel_type,
    tank_capacity_l: data.total_tank_capacity_l ?? data.head_tank_capacity_l ?? data.tank_capacity_l,
    current_odometer_km: data.current_odometer_km,
    current_hours: data.current_hours ?? null,
    home_depot: data.home_depot,
    status: data.status,
    cover_image_url: data.cover_image_url,
    notes: JSON.stringify(meta),
  };

  return payload;
}

export function generateDriverCode(seed?: string, index?: number): string {
  if (typeof index === "number" && index >= 0) {
    return `DRV-${String(index + 1).padStart(3, "0")}`;
  }
  if (seed) {
    const clean = seed.trim().toUpperCase();
    if (/^[A-Z]{2,4}-\d{2,4}$/.test(clean)) return clean;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 33 + seed.charCodeAt(i)) % 99;
    }
    return `DRV-${String((Math.abs(hash) % 99) + 1).padStart(3, "0")}`;
  }
  const rand = Math.floor(1 + Math.random() * 99);
  return `DRV-${String(rand).padStart(3, "0")}`;
}

/**
 * Scans all existing driver codes and deterministically generates
 * the next non-colliding unique Driver ID (e.g. DRV-001, DRV-002...).
 */
export function getGuaranteedUniqueDriverCode(
  existingCodes: (string | null | undefined)[],
  prefix: string = "DRV"
): string {
  const cleanPrefix = (prefix || "DRV").trim().toUpperCase();
  const pattern = new RegExp(`^${cleanPrefix}-(\\d+)$`, "i");

  const existingNormalized = new Set<string>();
  let maxNum = 0;

  for (const raw of existingCodes) {
    if (!raw) continue;
    const trimmed = String(raw).trim().toUpperCase();
    existingNormalized.add(trimmed);

    const match = trimmed.match(pattern);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!Number.isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  let candidateNum = maxNum + 1;
  let padLen = Math.max(3, String(candidateNum).length);
  let candidate = `${cleanPrefix}-${String(candidateNum).padStart(padLen, "0")}`;

  while (existingNormalized.has(candidate)) {
    candidateNum++;
    padLen = Math.max(3, String(candidateNum).length);
    candidate = `${cleanPrefix}-${String(candidateNum).padStart(padLen, "0")}`;
  }

  return candidate;
}

/**
 * Standard driving licence classes in Tanzania (Road Traffic Act / TRA / Tanzania Traffic Police).
 */
export interface TanzaniaDrivingClassOption {
  code: string;
  name: string;
  category: "commercial_heavy" | "commercial_bus" | "commercial_light" | "general" | "special";
  description: string;
}

export const TANZANIA_DRIVING_CLASSES: TanzaniaDrivingClassOption[] = [
  {
    code: "Class F",
    name: "Class F – Articulated Heavy Goods",
    category: "commercial_heavy",
    description: "Articulated trucks, semi-trailers, prime movers, cross-border multi-axle freight (Zambia, DRC, Rwanda)",
  },
  {
    code: "Class E",
    name: "Class E – Medium / Heavy Goods Vehicle",
    category: "commercial_heavy",
    description: "Heavy rigid trucks, tippers, fuel tankers, flatbeds exceeding 7,500 kg gross weight",
  },
  {
    code: "Class E & F",
    name: "Class E & F – Heavy Goods & Articulated Combination",
    category: "commercial_heavy",
    description: "Rigid commercial trucks and articulated tractor-trailer combinations",
  },
  {
    code: "Class C2",
    name: "Class C2 – Heavy Commercial Bus & Coach",
    category: "commercial_bus",
    description: "Heavy intercity passenger buses and luxury coaches (Mabasi ya Mikoani > 65 passengers)",
  },
  {
    code: "Class C1",
    name: "Class C1 – Medium Commercial Bus / Minibus",
    category: "commercial_bus",
    description: "Mid-size buses, Coasters, commuter minibuses (30 to 65 passengers)",
  },
  {
    code: "Class C",
    name: "Class C – Light PSV / Passenger Transport",
    category: "commercial_bus",
    description: "Public Service Vehicles (PSV), daladala, vans, taxis (up to 30 passengers)",
  },
  {
    code: "Class C, E & F",
    name: "Class C, E & F – All Commercial (Bus, Heavy Truck & Articulated)",
    category: "commercial_heavy",
    description: "All heavy commercial passenger coaches, rigid trucks and articulated semi-trailers",
  },
  {
    code: "Class D",
    name: "Class D – Light Commercial Goods",
    category: "commercial_light",
    description: "Canters, pickups, delivery vans, box trucks not exceeding 3,500 kg",
  },
  {
    code: "Class B",
    name: "Class B – Private / Light Motor Vehicle",
    category: "general",
    description: "Saloon cars, station wagons, SUVs, private motor cars (≤ 3,500 kg)",
  },
  {
    code: "Class A",
    name: "Class A – Motorcycles (Pikipiki)",
    category: "general",
    description: "Two-wheeled motorcycles and mopeds",
  },
  {
    code: "Class A3",
    name: "Class A3 – Motorized Tricycles (Bajaji)",
    category: "general",
    description: "Three-wheeled motorized passenger and cargo bajaji / rickshaws",
  },
  {
    code: "Class G",
    name: "Class G – Special Plant & Machinery",
    category: "special",
    description: "Tractors, excavators, wheel loaders, cranes, and heavy earthmoving machinery",
  },
  {
    code: "Other",
    name: "Other / Custom Licence Class",
    category: "general",
    description: "International licence, military/police endorsement, or custom class",
  },
];

/**
 * Common commercial truck, bus, and trailer makes in Tanzania.
 */
export interface CommercialMakeOption {
  name: string;
  category: "truck" | "bus" | "trailer";
  note: string;
}

export const TANZANIA_COMMERCIAL_MAKES: CommercialMakeOption[] = [
  // Heavy Haulage, Tippers, Tankers & Prime Movers
  { name: "Scania", category: "truck", note: "Leading prime mover & transit haulage in Tanzania" },
  { name: "Mercedes-Benz", category: "truck", note: "Actros, Axor, Arocs heavy haulage & tippers" },
  { name: "Sinotruk / Howo", category: "truck", note: "Very popular Howo & Sitrak tippers, tankers, prime movers" },
  { name: "FAW", category: "truck", note: "J5, J6 heavy freight and transit haulage" },
  { name: "Shacman", category: "truck", note: "F3000, X3000 heavy tippers and prime movers" },
  { name: "Foton", category: "truck", note: "Auman transit trucks & medium commercial" },
  { name: "Isuzu", category: "truck", note: "Giga, Forward, FVR, NPR delivery & distribution" },
  { name: "Mitsubishi Fuso", category: "truck", note: "Super Great, Fighter, Canter" },
  { name: "Volvo", category: "truck", note: "FH12, FH16 long-haul heavy haulage" },
  { name: "MAN", category: "truck", note: "TGA, TGX long-distance freight" },
  { name: "DAF", category: "truck", note: "XF, CF prime movers" },
  { name: "Iveco", category: "truck", note: "Stralis, Trakker heavy transport" },
  { name: "Tata", category: "truck", note: "Prima, Novus, LPT cargo & tippers" },
  { name: "Dongfeng", category: "truck", note: "Tianlong, Kingrun heavy commercial" },
  { name: "JAC", category: "truck", note: "Gallop heavy trucks & cargo" },
  { name: "Beiben", category: "truck", note: "V3 heavy prime movers and tippers" },
  { name: "Hino", category: "truck", note: "500, 700 series medium & heavy" },

  // Commercial Buses & Coaches (Mabasi ya Mikoani & Daladala / Coasters)
  { name: "Yutong", category: "bus", note: "Leading intercity passenger bus in Tanzania (Mabasi ya Mikoani)" },
  { name: "Zhongtong", category: "bus", note: "Widely used long-distance passenger coach" },
  { name: "Higer", category: "bus", note: "Intercity coaches & municipal buses" },
  { name: "Golden Dragon", category: "bus", note: "Long-distance passenger transport" },
  { name: "King Long", category: "bus", note: "Commercial passenger coaches" },
  { name: "Scania Marcopolo / Irizar", category: "bus", note: "Luxury intercity Tanzanian coaches" },
  { name: "Toyota", category: "bus", note: "Coaster (26-30 seater) & Hiace Daladala" },
  { name: "Nissan", category: "bus", note: "Civilian minibus & Caravan" },
  { name: "Ashok Leyland", category: "bus", note: "Falcon & Eagle commuter/staff buses" },
  { name: "Eicher", category: "bus", note: "Skyline commercial passenger buses" },
  { name: "Sunlong", category: "bus", note: "Intercity & tour buses" },
  { name: "Ankai", category: "bus", note: "Commuter & coach transport" },

  // Semi-Trailers, Fuel Tankers & Flatbeds
  { name: "Superdoll", category: "trailer", note: "Premier Tanzania local trailer manufacturer (Dar es Salaam)" },
  { name: "Afrit", category: "trailer", note: "Heavy interlink and flatbed trailers" },
  { name: "BPW", category: "trailer", note: "Heavy German axle & trailer systems" },
  { name: "CIMC", category: "trailer", note: "Fuel tankers, skeletal container chassis & flatbeds" },
  { name: "Henred Fruehauf", category: "trailer", note: "Heavy duty haulage trailers" },
  { name: "Fuwa", category: "trailer", note: "Heavy commercial trailer chassis" },
  { name: "GRW", category: "trailer", note: "Liquid fuel and chemical tanker trailers" },
  { name: "Randon", category: "trailer", note: "Heavy grain & cargo semi-trailers" },
  { name: "York", category: "trailer", note: "Commercial freight trailer systems" },
  { name: "SAF-Holland", category: "trailer", note: "Specialist suspension & trailer chassis" },
];

export interface FleetDriver {
  id: string;
  driver_code: string; // Unique Driver ID (e.g. DRV-001)
  full_name: string;
  phone: string | null;
  status: string;
  notes: string | null;
  photo_url: string | null;

  // Extended KYC metadata (safely parsed from notes)
  email: string | null;
  license_number: string | null;
  licence_number: string | null; // alias
  licence_class: string | null;
  licence_expiry: string | null;
  medical_expiry: string | null;
  nida_number: string | null;
  passport_number: string | null;
  other_id_type: string | null;
  other_id_number: string | null;
  next_of_kin_name: string | null;
  next_of_kin_relation: string | null;
  next_of_kin_phone: string | null;
  next_of_kin_nida: string | null;
  assigned_vehicle?: string | null;
  source?: string | null;
  user_notes: string | null;
  login_pin?: string | null;
}

export function normalizePhone(p?: string | null): string {
  if (!p) return "";
  let digits = p.replace(/\D/g, "");
  if (digits.startsWith("255") && digits.length === 12) {
    digits = "0" + digits.slice(3);
  }
  return digits;
}

export function parseDriver(raw: any, index?: number): FleetDriver {
  let driver_code: string | null = raw.driver_code ?? null;
  let email: string | null = raw.email ?? null;
  let license_number: string | null = raw.licence_number ?? raw.license_number ?? null;
  let licence_class: string | null = raw.licence_class ?? null;
  let licence_expiry: string | null = raw.licence_expiry ?? null;
  let medical_expiry: string | null = raw.medical_expiry ?? null;
  let nida_number: string | null = raw.nida_number ?? null;
  let passport_number: string | null = raw.passport_number ?? null;
  let other_id_type: string | null = raw.other_id_type ?? null;
  let other_id_number: string | null = raw.other_id_number ?? null;
  let next_of_kin_name: string | null = raw.next_of_kin_name ?? null;
  let next_of_kin_relation: string | null = raw.next_of_kin_relation ?? null;
  let next_of_kin_phone: string | null = raw.next_of_kin_phone ?? null;
  let next_of_kin_nida: string | null = raw.next_of_kin_nida ?? null;
  let next_of_kin_photo_url: string | null = raw.next_of_kin_photo_url ?? null;
  let assigned_vehicle: string | null = raw.assigned_vehicle ?? null;
  let source: string | null = raw.source ?? null;
  let user_notes: string | null = null;

  let login_pin: string | null = null;
  if (typeof window !== "undefined" && raw.id) {
    try {
      const cached = localStorage.getItem(`fleet_driver_pin_${raw.id}`);
      if (cached) login_pin = cached;
    } catch {}
  }

  if (raw.notes && typeof raw.notes === "string" && raw.notes.startsWith("{") && raw.notes.endsWith("}")) {
    try {
      const parsed = JSON.parse(raw.notes);
      if (parsed.driver_code) driver_code = parsed.driver_code;
      if (parsed.email) email = parsed.email;
      if (parsed.license_number || parsed.licence_number) license_number = parsed.licence_number ?? parsed.license_number;
      if (parsed.licence_class) licence_class = parsed.licence_class;
      if (parsed.licence_expiry) licence_expiry = parsed.licence_expiry;
      if (parsed.medical_expiry) medical_expiry = parsed.medical_expiry;
      if (parsed.nida_number) nida_number = parsed.nida_number;
      if (parsed.passport_number) passport_number = parsed.passport_number;
      if (parsed.other_id_type) other_id_type = parsed.other_id_type;
      if (parsed.other_id_number) other_id_number = parsed.other_id_number;
      if (parsed.next_of_kin_name) next_of_kin_name = parsed.next_of_kin_name;
      if (parsed.next_of_kin_relation) next_of_kin_relation = parsed.next_of_kin_relation;
      if (parsed.next_of_kin_phone) next_of_kin_phone = parsed.next_of_kin_phone;
      if (parsed.next_of_kin_nida) next_of_kin_nida = parsed.next_of_kin_nida;
      if (parsed.next_of_kin_photo_url) next_of_kin_photo_url = parsed.next_of_kin_photo_url;
      if (parsed.assigned_vehicle) assigned_vehicle = parsed.assigned_vehicle;
      if (parsed.source) source = parsed.source;
      if (parsed.login_pin || parsed.pin) login_pin = String(parsed.login_pin || parsed.pin).trim();
      user_notes = parsed.text ?? null;
    } catch {}
  } else if (raw.notes && typeof raw.notes === "string" && !raw.notes.startsWith("{")) {
    user_notes = raw.notes;
  }

  // Strip automated telematics import notes so "Imported live from Trakzee" never displays
  if (
    user_notes &&
    (user_notes.toLowerCase().includes("imported live from trakzee") ||
      user_notes.toLowerCase().includes("from trakzee telematics") ||
      user_notes.toLowerCase().includes("trakzee telematics") ||
      user_notes.toLowerCase().includes("telematics assigned to"))
  ) {
    user_notes = null;
  }

  let full_name = raw.full_name;
  if (full_name) {
    const cleaned = cleanDriverName(full_name);
    if (cleaned) full_name = cleaned;
  }

  if (!driver_code) {
    driver_code = generateDriverCode(raw.id || full_name, index);
  }

  return {
    ...raw,
    full_name: full_name || raw.full_name,
    driver_code,
    email,
    license_number,
    licence_number: license_number,
    licence_class,
    licence_expiry,
    medical_expiry,
    nida_number,
    passport_number,
    other_id_type,
    other_id_number,
    next_of_kin_name,
    next_of_kin_relation,
    next_of_kin_phone,
    next_of_kin_nida,
    next_of_kin_photo_url,
    assigned_vehicle,
    source,
    user_notes,
    login_pin: login_pin || null,
  };
}

/**
 * Saves or updates a driver's portal login PIN in database metadata.
 * Also caches in localStorage for instant access on personal mobile devices.
 */
export async function saveDriverPin(
  driverId: string,
  newPin: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanPin = newPin ? newPin.trim() : null;

    if (typeof window !== "undefined") {
      try {
        if (cleanPin) {
          localStorage.setItem(`fleet_driver_pin_${driverId}`, cleanPin);
        } else {
          localStorage.removeItem(`fleet_driver_pin_${driverId}`);
        }
      } catch {}
    }

    const { data: rawDriver } = await supabase
      .from("drivers")
      .select("notes")
      .eq("id", driverId)
      .maybeSingle();

    let meta: Record<string, any> = {};
    if (rawDriver?.notes && typeof rawDriver.notes === "string" && rawDriver.notes.startsWith("{")) {
      try {
        meta = JSON.parse(rawDriver.notes);
      } catch {
        meta = { text: rawDriver.notes };
      }
    } else if (rawDriver?.notes) {
      meta = { text: rawDriver.notes };
    }

    if (cleanPin) {
      meta.login_pin = cleanPin;
    } else {
      delete meta.login_pin;
      delete meta.pin;
    }

    const { error: updateErr } = await supabase
      .from("drivers")
      .update({ notes: JSON.stringify(meta) })
      .eq("id", driverId);

    if (updateErr) {
      console.warn("Notice: driver PIN stored locally, Supabase sync status:", updateErr.message);
    }

    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(`fleet_pin_lock_${driverId}`);
      }
    } catch {}

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to save driver PIN" };
  }
}

const MAX_FAILED_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function checkPinLockout(driverId: string): { isLocked: boolean; remainingMinutes?: number } {
  try {
    if (typeof window === "undefined") return { isLocked: false };
    const raw = localStorage.getItem(`fleet_pin_lock_${driverId}`);
    if (!raw) return { isLocked: false };
    const { lockedUntil } = JSON.parse(raw);
    const now = Date.now();
    if (lockedUntil && now < lockedUntil) {
      const remainingMinutes = Math.ceil((lockedUntil - now) / 60000);
      return { isLocked: true, remainingMinutes };
    }
    if (lockedUntil && now >= lockedUntil) {
      localStorage.removeItem(`fleet_pin_lock_${driverId}`);
    }
  } catch {}
  return { isLocked: false };
}

export function recordFailedPinAttempt(driverId: string): { isLocked: boolean; remainingAttempts: number; remainingMinutes?: number } {
  try {
    if (typeof window === "undefined") return { isLocked: false, remainingAttempts: 3 };
    const key = `fleet_pin_lock_${driverId}`;
    const raw = localStorage.getItem(key);
    let attempts = 0;
    if (raw) {
      try { attempts = JSON.parse(raw).attempts || 0; } catch {}
    }
    attempts += 1;
    if (attempts >= MAX_FAILED_PIN_ATTEMPTS) {
      const lockedUntil = Date.now() + PIN_LOCKOUT_DURATION_MS;
      localStorage.setItem(key, JSON.stringify({ attempts, lockedUntil }));
      return { isLocked: true, remainingAttempts: 0, remainingMinutes: 5 };
    } else {
      localStorage.setItem(key, JSON.stringify({ attempts }));
      return { isLocked: false, remainingAttempts: MAX_FAILED_PIN_ATTEMPTS - attempts };
    }
  } catch {
    return { isLocked: false, remainingAttempts: 3 };
  }
}

export function clearPinLockout(driverId: string): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(`fleet_pin_lock_${driverId}`);
    }
  } catch {}
}

export function verifyDriverIdentitySecret(
  driver: {
    driver_code?: string | null;
    licence_number?: string | null;
    phone?: string | null;
  },
  secretInput: string
): boolean {
  if (!secretInput || !secretInput.trim()) return false;
  const clean = secretInput.trim().toUpperCase().replace(/[\s-]/g, "");
  const code = (driver.driver_code || "").trim().toUpperCase().replace(/[\s-]/g, "");
  const lic = (driver.licence_number || "").trim().toUpperCase().replace(/[\s-]/g, "");
  const phoneDigits = (driver.phone || "").replace(/\D/g, "");
  const last4 = phoneDigits.slice(-4);

  if (code && clean === code) return true;
  if (lic && clean === lic) return true;
  if (last4 && clean === last4) return true;
  return false;
}

export function serializeDriverPayload(data: {
  driver_code?: string | null;
  full_name: string;
  phone: string | null;
  status: string;
  email?: string | null;
  photo_url?: string | null;
  login_pin?: string | null;
  license_number?: string | null;
  licence_number?: string | null;
  licence_class?: string | null;
  licence_expiry?: string | null;
  medical_expiry?: string | null;
  nida_number?: string | null;
  passport_number?: string | null;
  other_id_type?: string | null;
  other_id_number?: string | null;
  next_of_kin_name?: string | null;
  next_of_kin_relation?: string | null;
  next_of_kin_phone?: string | null;
  next_of_kin_nida?: string | null;
  next_of_kin_photo_url?: string | null;
  user_notes?: string | null;
}) {
  const code = data.driver_code && data.driver_code.trim() ? data.driver_code.trim().toUpperCase() : generateDriverCode();
  const meta = {
    driver_code: code,
    email: data.email ?? null,
    login_pin: data.login_pin?.trim() || null,
    license_number: data.license_number ?? data.licence_number ?? null,
    licence_class: data.licence_class ?? null,
    licence_expiry: data.licence_expiry ?? null,
    medical_expiry: data.medical_expiry ?? null,
    nida_number: data.nida_number ?? null,
    passport_number: data.passport_number ?? null,
    other_id_type: data.other_id_type ?? null,
    other_id_number: data.other_id_number ?? null,
    next_of_kin_name: data.next_of_kin_name ?? null,
    next_of_kin_relation: data.next_of_kin_relation ?? null,
    next_of_kin_phone: data.next_of_kin_phone ?? null,
    next_of_kin_nida: data.next_of_kin_nida ?? null,
    next_of_kin_photo_url: data.next_of_kin_photo_url ?? null,
    text: data.user_notes ?? "",
  };

  return {
    full_name: data.full_name,
    phone: data.phone,
    status: data.status,
    photo_url: data.photo_url ?? null,
    notes: JSON.stringify(meta),
  };
}

export interface FleetTrip {
  id: string;
  machine_id: string;
  driver_id: string | null;
  status: string;
  start_at: string | null;
  end_at: string | null;
  start_odo: number | null;
  end_odo: number | null;
  origin: string | null;
  destination: string | null;
  cargo_description: string | null;

  // Extended client order & turnaround fields
  client_name: string | null;
  client_order_number: string | null;
  estimated_hours: number | null;
  raw_cargo: string | null;
}

export interface TripCargoMetadata {
  client?: string | null;
  order_no?: string | null;
  cargo?: string | null;
  purpose?: string | null;
  route_notes?: string | null;
  corridor_id?: string | null;
  corridor_name?: string | null;
  border_post?: string | null;
  currency?: string | null;
  exchange_rate?: number | null;
  client_billing_amount?: number | null;
  billing_currency?: string | null;
  payment_terms?: string | null;
  tax_percent?: number | null;
  include_statutory_tolls?: boolean | null;
  est_hours?: number | null;
  is_round_trip?: boolean | null;
  custom_logo_url?: string | null;
  expenses?: any[] | null;
  safari_float?: SafariFloatRecord | null;
}

export interface SafariFloatReceipt {
  id: string;
  category: string;
  title: string;
  amount: number;
  currency: "TZS" | "USD";
  receipt_no?: string;
  notes?: string;
  occurred_at?: string;
}

export interface SafariFloatRecord {
  dispatched_amount: number;
  currency: "TZS" | "USD";
  payment_method: "mpesa" | "tigo_pesa" | "airtel_money" | "cash" | "bank_transfer";
  reference_no?: string;
  disbursed_at?: string;
  driver_id?: string | null;
  driver_name?: string | null;
  posho_amount?: number;
  emergency_float?: number;
  notes?: string;
  surrendered?: boolean;
  surrendered_at?: string;
  surrender_status?: "pending" | "reconciled" | "refund_due_company" | "reimbursement_due_driver";
  total_receipts_amount?: number;
  balance_amount?: number;
  receipts?: SafariFloatReceipt[];
  surrender_notes?: string;
}

/**
 * Resilient JSON parser for trip cargo metadata.
 * Successfully parses intact JSON or gracefully extracts key values even if the payload
 * was truncated or cut off in storage.
 */
export function parseCargoMeta(raw: any): TripCargoMetadata | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    // Regex extraction fallback for truncated JSON strings
    const extract = (key: string): any => {
      const match = trimmed.match(new RegExp(`"${key}"\\s*:\\s*("(?:\\\\.|[^"\\\\])*"|\\d+(?:\\.\\d+)?|true|false|null)`));
      if (!match) return null;
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    };

    return {
      client: extract("client"),
      order_no: extract("order_no"),
      cargo: extract("cargo"),
      purpose: extract("purpose"),
      route_notes: extract("route_notes"),
      corridor_id: extract("corridor_id"),
      corridor_name: extract("corridor_name"),
      border_post: extract("border_post"),
      currency: extract("currency"),
      exchange_rate: extract("exchange_rate") != null ? Number(extract("exchange_rate")) : null,
      client_billing_amount: extract("client_billing_amount") != null ? Number(extract("client_billing_amount")) : null,
      billing_currency: extract("billing_currency"),
      payment_terms: extract("payment_terms"),
      tax_percent: extract("tax_percent") != null ? Number(extract("tax_percent")) : null,
      include_statutory_tolls: extract("include_statutory_tolls"),
      est_hours: extract("est_hours") != null ? Number(extract("est_hours")) : null,
      is_round_trip: extract("is_round_trip"),
      estimated_return_at: extract("estimated_return_at"),
      custom_logo_url: extract("custom_logo_url"),
      safari_float: extract("safari_float"),
    };
  }
}

/**
 * Extracts a human-readable cargo name and guarantees raw JSON never spills into the UI.
 */
export function extractCleanCargo(rawCargo: any, fallbackPurpose?: string | null): string {
  if (!rawCargo && !fallbackPurpose) return "Commercial Freight";
  if (typeof rawCargo === "string") {
    const trimmed = rawCargo.trim();
    if (trimmed.startsWith("{")) {
      const meta = parseCargoMeta(trimmed);
      if (meta?.cargo && typeof meta.cargo === "string" && !meta.cargo.trim().startsWith("{")) {
        return meta.cargo.trim();
      }
      if (meta?.purpose && typeof meta.purpose === "string") {
        return meta.purpose.trim();
      }
      if (fallbackPurpose && typeof fallbackPurpose === "string" && !fallbackPurpose.trim().startsWith("{")) {
        return fallbackPurpose.trim();
      }
      return "Commercial Freight";
    }
    return trimmed;
  }
  return (fallbackPurpose && !fallbackPurpose.trim().startsWith("{")) ? fallbackPurpose.trim() : "Commercial Freight";
}

export function parseTrip(raw: any): FleetTrip {
  let client_name: string | null = raw.client_name ?? null;
  let client_order_number: string | null = raw.client_order_no ?? raw.client_order_number ?? null;
  let estimated_hours: number | null = raw.roundtrip_hours_est ?? raw.estimated_hours ?? null;
  let raw_cargo: string | null = raw.cargo_description ?? null;

  if (raw.cargo_description && typeof raw.cargo_description === "string" && raw.cargo_description.trim().startsWith("{")) {
    const meta = parseCargoMeta(raw.cargo_description);
    if (meta) {
      if (meta.client) client_name = meta.client;
      if (meta.order_no) client_order_number = meta.order_no;
      if (meta.est_hours != null) estimated_hours = Number(meta.est_hours);
      if (meta.cargo && typeof meta.cargo === "string" && !meta.cargo.trim().startsWith("{")) {
        raw_cargo = meta.cargo;
      } else if (meta.purpose && typeof meta.purpose === "string") {
        raw_cargo = meta.purpose;
      } else {
        raw_cargo = null;
      }
    } else {
      raw_cargo = null;
    }
  }

  // Double defense: raw_cargo must NEVER be a raw JSON string
  if (typeof raw_cargo === "string" && raw_cargo.trim().startsWith("{")) {
    raw_cargo = null;
  }

  if (client_name) {
    client_name = client_name.replace(/^[,\s]+|[,\s]+$/g, "").trim() || null;
  }
  if (!client_name && raw.purpose && typeof raw.purpose === "string" && raw.purpose.toLowerCase().startsWith("client:")) {
    client_name = raw.purpose.replace(/^client:\s*/i, "").replace(/^[,\s]+|[,\s]+$/g, "").trim() || null;
  }
  if (client_order_number) {
    client_order_number = client_order_number.replace(/^[,\s]+|[,\s]+$/g, "").trim() || null;
  }

  return {
    ...raw,
    client_name,
    client_order_number,
    estimated_hours,
    raw_cargo,
  };
}


export function serializeTripPayload(data: {
  machine_id: string;
  driver_id: string | null;
  status: string;
  start_at: string | null;
  end_at: string | null;
  start_odo: number | null;
  end_odo: number | null;
  origin: string | null;
  destination: string | null;
  client_name?: string | null;
  client_order_number?: string | null;
  cargo?: string | null;
  estimated_hours?: number | null;
}) {
  const cargoMeta = {
    client: data.client_name ?? null,
    order_no: data.client_order_number ?? null,
    est_hours: data.estimated_hours ?? null,
    cargo: data.cargo ?? null,
  };

  return {
    machine_id: data.machine_id,
    driver_id: data.driver_id,
    status: data.status,
    start_at: data.start_at,
    end_at: data.end_at,
    start_odo: data.start_odo,
    end_odo: data.end_odo,
    origin: data.origin,
    destination: data.destination,
    cargo_description: JSON.stringify(cargoMeta),
  };
}
