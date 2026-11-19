/**
 * Smart Stores & Spare Parts Compatibility Service (Mega Beverages Slides 13, 14, 15)
 * 
 * Provides:
 * 1. Vehicle Model Compatibility Matching (When Scania, Howo, or Actros is selected, only compatible parts show).
 * 2. Min / Max Reorder Levels & Stockout Warnings.
 * 3. Automatic stock decrement and audit trail when spare parts are issued to a Job Card.
 */

import { supabase } from "@/integrations/supabase/client";

export interface CommercialSparePart {
  id: string;
  organisation_id: string;
  part_number: string;
  name: string;
  system_category:
    | "Brake System"
    | "Engine System"
    | "Fuel System"
    | "Suspension System"
    | "Steering System"
    | "Transmission System"
    | "Electrical System"
    | "Air System"
    | "Body Works"
    | "General Spares";
  compatible_makes: string[]; // e.g. ["Scania", "Sinotruk", "Mercedes-Benz", "Universal"]
  compatible_models: string[]; // e.g. ["R500", "Howo 371", "Actros 3340", "Universal Trailer"]
  bin_location: string;
  stock_quantity: number;
  min_reorder_level: number;
  max_capacity: number;
  unit_price_tzs: number;
  supplier_name: string;
  supplier_phone?: string;
  alternative_part_number?: string;
}

export interface PartIssuanceRecord {
  id: string;
  organisation_id: string;
  part_id: string;
  part_number: string;
  part_name: string;
  job_card_number: string;
  vehicle_plate: string;
  technician_name: string;
  quantity: number;
  unit_price: number;
  total_cost: number;
  issued_at: string;
  issued_by: string;
}

const STORAGE_SPARES_KEY = "mc_smart_spares_catalog_";
const STORAGE_ISSUANCE_KEY = "mc_parts_issuance_history_";

const DEFAULT_ENTERPRISE_SPARES: Omit<CommercialSparePart, "organisation_id">[] = [
  // Scania Parts
  {
    id: "sp-sca-01",
    part_number: "SCA-2195142",
    name: "Scania High-Capacity Primary Fuel Filter Separator",
    system_category: "Fuel System",
    compatible_makes: ["Scania", "All Heavy Trucks"],
    compatible_models: ["R500", "R420", "G460"],
    bin_location: "BIN-04-A",
    stock_quantity: 14,
    min_reorder_level: 6,
    max_capacity: 40,
    unit_price_tzs: 185000,
    supplier_name: "Scania Tanzania Ltd (Vingunguti)",
    supplier_phone: "+255 22 286 0290",
    alternative_part_number: "FLEETGUARD-FS19914",
  },
  {
    id: "sp-sca-02",
    part_number: "SCA-1854201",
    name: "Scania R-Series Front Drive Brake Linings (Pair)",
    system_category: "Brake System",
    compatible_makes: ["Scania"],
    compatible_models: ["R500", "R420"],
    bin_location: "BIN-07-C",
    stock_quantity: 8,
    min_reorder_level: 4,
    max_capacity: 25,
    unit_price_tzs: 340000,
    supplier_name: "Heavy Commercial Spares Dar",
    supplier_phone: "+255 754 112 890",
  },
  {
    id: "sp-sca-03",
    part_number: "SCA-1786523",
    name: "Scania V8 Air Cleaner Safety Cartridge",
    system_category: "Engine System",
    compatible_makes: ["Scania"],
    compatible_models: ["R500", "G460"],
    bin_location: "BIN-02-B",
    stock_quantity: 3,
    min_reorder_level: 5, // Triggers reorder alert
    max_capacity: 20,
    unit_price_tzs: 245000,
    supplier_name: "Scania Tanzania Ltd (Vingunguti)",
  },

  // Sinotruk Howo Parts
  {
    id: "sp-howo-01",
    part_number: "HOWO-WG9100440027",
    name: "Howo Sinotruk Heavy Duty Drive Axle Brake Lining Kit",
    system_category: "Brake System",
    compatible_makes: ["Sinotruk", "Howo"],
    compatible_models: ["Howo 371", "Howo A7", "Howo 380"],
    bin_location: "BIN-12-A",
    stock_quantity: 22,
    min_reorder_level: 8,
    max_capacity: 60,
    unit_price_tzs: 260000,
    supplier_name: "Sinotruk Tanzania Authorized Depot",
    supplier_phone: "+255 713 884 900",
  },
  {
    id: "sp-howo-02",
    part_number: "HOWO-VG1540080311",
    name: "Howo Spin-On Engine Oil Filter Cartridge (WD615)",
    system_category: "Engine System",
    compatible_makes: ["Sinotruk", "Howo"],
    compatible_models: ["Howo 371", "Howo 380"],
    bin_location: "BIN-05-D",
    stock_quantity: 34,
    min_reorder_level: 10,
    max_capacity: 100,
    unit_price_tzs: 75000,
    supplier_name: "Sinotruk Tanzania Authorized Depot",
  },
  {
    id: "sp-howo-03",
    part_number: "HOWO-AZ9725520278",
    name: "Howo Rear Multi-Leaf Spring Bushing & Pin Set",
    system_category: "Suspension System",
    compatible_makes: ["Sinotruk", "Howo"],
    compatible_models: ["Howo 371"],
    bin_location: "BIN-16-A",
    stock_quantity: 6,
    min_reorder_level: 4,
    max_capacity: 20,
    unit_price_tzs: 180000,
    supplier_name: "Kariakoo Heavy Truck Spares",
  },

  // Mercedes-Benz Actros Parts
  {
    id: "sp-actros-01",
    part_number: "MB-0004204520",
    name: "Mercedes Actros 3340 Disc Brake Pad Overhaul Kit",
    system_category: "Brake System",
    compatible_makes: ["Mercedes-Benz", "Mercedes"],
    compatible_models: ["Actros 3340", "Actros 2640", "Actros 3348"],
    bin_location: "BIN-09-B",
    stock_quantity: 12,
    min_reorder_level: 4,
    max_capacity: 30,
    unit_price_tzs: 420000,
    supplier_name: "CFAO Motors Tanzania",
  },
  {
    id: "sp-actros-02",
    part_number: "MB-5410900151",
    name: "Mercedes Actros OM501LA Fuel Filter Element",
    system_category: "Fuel System",
    compatible_makes: ["Mercedes-Benz", "Mercedes"],
    compatible_models: ["Actros 3340"],
    bin_location: "BIN-03-C",
    stock_quantity: 18,
    min_reorder_level: 6,
    max_capacity: 50,
    unit_price_tzs: 145000,
    supplier_name: "CFAO Motors Tanzania",
  },

  // Universal Trailer & Fluid Spares
  {
    id: "sp-uni-01",
    part_number: "BPW-0509127840",
    name: "BPW Heavy Trailer Axle Brake Drum (420x180)",
    system_category: "Brake System",
    compatible_makes: ["Universal", "BPW", "Trailer"],
    compatible_models: ["Universal Trailer", "Tri-Axle", "Flatbed", "Skeletal"],
    bin_location: "YARD-RACK-01",
    stock_quantity: 8,
    min_reorder_level: 2,
    max_capacity: 16,
    unit_price_tzs: 480000,
    supplier_name: "Trailer World Tanzania",
  },
  {
    id: "sp-uni-02",
    part_number: "LUB-15W40-DRUM",
    name: "Total Rubia TIR 7400 15W-40 Heavy Diesel Engine Oil (208L)",
    system_category: "Engine System",
    compatible_makes: ["Universal"],
    compatible_models: ["Universal", "Scania", "Howo", "Actros"],
    bin_location: "OIL-STORE-01",
    stock_quantity: 6, // 6 drums
    min_reorder_level: 3,
    max_capacity: 15,
    unit_price_tzs: 1850000,
    supplier_name: "TotalEnergies Tanzania",
  },
];

/**
 * Fetch all smart stores spares for an organization, optionally filtered by vehicle model or make
 */
export async function getSmartSpares(
  orgId: string,
  vehicleModelOrMake?: string
): Promise<CommercialSparePart[]> {
  let catalog: CommercialSparePart[] = [];
  try {
    const raw = localStorage.getItem(`${STORAGE_SPARES_KEY}${orgId}`);
    if (raw) {
      catalog = JSON.parse(raw);
    }
  } catch (_e) {}

  if (!catalog || catalog.length === 0) {
    catalog = DEFAULT_ENTERPRISE_SPARES.map((s) => ({
      ...s,
      organisation_id: orgId,
    }));
    try {
      localStorage.setItem(`${STORAGE_SPARES_KEY}${orgId}`, JSON.stringify(catalog));
    } catch (_e) {}
  }

  if (!vehicleModelOrMake || vehicleModelOrMake.trim() === "") {
    return catalog;
  }

  const query = vehicleModelOrMake.toLowerCase().trim();
  return catalog.filter((p) => {
    // Universal parts match everything
    if (p.compatible_makes.some((m) => m.toLowerCase().includes("universal"))) {
      return true;
    }
    const matchesMake = p.compatible_makes.some((m) => query.includes(m.toLowerCase()) || m.toLowerCase().includes(query));
    const matchesModel = p.compatible_models.some((mod) => query.includes(mod.toLowerCase()) || mod.toLowerCase().includes(query));
    return matchesMake || matchesModel;
  });
}

/**
 * Automatically decrements stock and logs consumption when a part is issued to a Job Card (Slide 15).
 */
export async function issuePartToJobCard(
  orgId: string,
  issuance: Omit<PartIssuanceRecord, "id" | "issued_at">
): Promise<{ success: boolean; newStock: number; error?: string }> {
  try {
    const catalog = await getSmartSpares(orgId);
    const targetPart = catalog.find((p) => p.id === issuance.part_id || p.part_number === issuance.part_number);

    if (!targetPart) {
      return { success: false, newStock: 0, error: "Part not found in inventory catalog." };
    }

    if (targetPart.stock_quantity < issuance.quantity) {
      return {
        success: false,
        newStock: targetPart.stock_quantity,
        error: `Insufficient stock! Requested ${issuance.quantity}, but only ${targetPart.stock_quantity} available in ${targetPart.bin_location}.`,
      };
    }

    // Decrement stock
    targetPart.stock_quantity -= issuance.quantity;
    localStorage.setItem(`${STORAGE_SPARES_KEY}${orgId}`, JSON.stringify(catalog));

    // Record audit trail
    const record: PartIssuanceRecord = {
      ...issuance,
      id: `iss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      issued_at: new Date().toISOString(),
    };

    let history: PartIssuanceRecord[] = [];
    try {
      const rawHist = localStorage.getItem(`${STORAGE_ISSUANCE_KEY}${orgId}`);
      if (rawHist) history = JSON.parse(rawHist);
    } catch (_e) {}

    history.unshift(record);
    localStorage.setItem(`${STORAGE_ISSUANCE_KEY}${orgId}`, JSON.stringify(history));

    return { success: true, newStock: targetPart.stock_quantity };
  } catch (err: any) {
    return { success: false, newStock: 0, error: err.message || "Failed to issue part" };
  }
}

/**
 * Get parts consumption history for auditing and monthly reports (Slide 15).
 */
export async function getPartsIssuanceHistory(
  orgId: string,
  vehiclePlate?: string
): Promise<PartIssuanceRecord[]> {
  try {
    const raw = localStorage.getItem(`${STORAGE_ISSUANCE_KEY}${orgId}`);
    if (!raw) return [];
    const parsed: PartIssuanceRecord[] = JSON.parse(raw);
    if (!vehiclePlate) return parsed;
    return parsed.filter((r) => r.vehicle_plate.toLowerCase() === vehiclePlate.toLowerCase());
  } catch (_e) {
    return [];
  }
}
