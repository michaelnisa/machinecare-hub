// ─────────────────────────────────────────────────────────────
// Fleet Metadata Helpers
// Bridges rich fleet features (trailers, axle configurations,
// multi-tank capacities, driver KYC, client orders) with the
// confirmed remote Supabase database schema without schema mismatches.
// ─────────────────────────────────────────────────────────────

import type { TruckLayoutConfigId } from "./fleet-constants";

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
  const meta = {
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

  return {
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
  next_of_kin_photo_url: string | null;
  user_notes: string | null;
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
  let user_notes: string | null = null;

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
      user_notes = parsed.text ?? null;
    } catch {}
  } else if (raw.notes && typeof raw.notes === "string" && !raw.notes.startsWith("{")) {
    user_notes = raw.notes;
  }

  if (!driver_code) {
    driver_code = generateDriverCode(raw.id || raw.full_name, index);
  }

  return {
    ...raw,
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
    user_notes,
  };
}

export function serializeDriverPayload(data: {
  driver_code?: string | null;
  full_name: string;
  phone: string | null;
  status: string;
  email?: string | null;
  photo_url?: string | null;
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

export function parseTrip(raw: any): FleetTrip {
  let client_name: string | null = null;
  let client_order_number: string | null = null;
  let estimated_hours: number | null = null;
  let raw_cargo: string | null = raw.cargo_description ?? null;

  if (raw.cargo_description && typeof raw.cargo_description === "string" && raw.cargo_description.startsWith("{") && raw.cargo_description.endsWith("}")) {
    try {
      const parsed = JSON.parse(raw.cargo_description);
      client_name = parsed.client ?? null;
      client_order_number = parsed.order_no ?? null;
      estimated_hours = parsed.est_hours != null ? Number(parsed.est_hours) : null;
      raw_cargo = parsed.cargo ?? null;
    } catch {}
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
