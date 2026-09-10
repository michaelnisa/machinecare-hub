/**
 * MachineCare Fleet Domain Module
 */

export interface Vehicle {
  id: string;
  plate_number: string;
  make: string;
  model: string;
  current_odometer: number;
  status: string;
}

export interface Driver {
  id: string;
  name: string;
  license_number: string;
  license_expiry?: string;
  status: "active" | "on_trip" | "inactive";
  phone?: string;
}

export interface Trip {
  id: string;
  vehicle_id: string;
  driver_id: string;
  destination: string;
  departure_time: string;
  return_time?: string;
  start_odometer: number;
  end_odometer?: number;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
}

export interface FuelLog {
  id: string;
  vehicle_id: string;
  litres: number;
  cost: number;
  odometer: number;
  date: string;
}

export interface TyreInspection {
  id: string;
  vehicle_id: string;
  tyre_position: string;
  tread_depth_mm: number;
  pressure_psi: number;
  condition: "good" | "warning" | "critical";
  inspected_at: string;
}
