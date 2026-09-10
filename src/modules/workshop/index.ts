/**
 * MachineCare Workshop / Garage Domain Module
 */

export interface WorkshopJob {
  id: string;
  job_number: string;
  customer_name: string;
  vehicle_plate: string;
  description: string;
  status: "received" | "diagnosed" | "in_progress" | "completed" | "invoiced";
}

export interface GarageCustomer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  total_jobs_count?: number;
}

export interface GarageVehicle {
  id: string;
  customer_id: string;
  registration_number: string;
  make: string;
  model: string;
  year?: number;
  vin?: string;
  current_mileage?: number;
}

export interface Estimate {
  id: string;
  job_id: string;
  total_parts: number;
  total_labor: number;
  total_amount: number;
  status: "draft" | "sent" | "approved" | "rejected";
}

export interface Invoice {
  id: string;
  job_id: string;
  invoice_number: string;
  total_amount: number;
  paid_amount: number;
  status: "issued" | "partially_paid" | "paid" | "overdue";
  issued_at: string;
}

export interface Mechanic {
  id: string;
  name: string;
  specialization?: string;
  active_jobs_count?: number;
  status: "available" | "busy" | "off_duty";
}
