export const TYRE_DUE_SOON_KM = 1000;
export const TYRE_MIN_TREAD_MM = 3.0; // Minimum legal/safe tread depth (mm)
export const TYRE_WARN_TREAD_MM = 6.0; // Warning threshold (mm)

// Standard commercial truck tyre pressures (PSI)
export const TRUCK_TYRE_MIN_PSI = 95;
export const TRUCK_TYRE_MAX_PSI = 125;

// Older tyre records may still use the pre-axle naming (FL/RR2/etc.) — map them
// onto axle-based codes so every view stays consistent.
const LEGACY_TYRE_POSITION_MAP: Record<string, string> = {
  FL: "A1L",
  FR: "A1R",
  RL: "B1-LO",
  RR: "B1-RO",
  RL1: "B1-LO",
  RR1: "B1-RO",
  RL2: "B2-LO",
  RR2: "B2-RO",
  RL3: "B3-LO",
  RR3: "B3-RO",
  B1L: "B1-LO",
  B1R: "B1-RO",
  B2L: "B2-LO",
  B2R: "B2-RO",
  B3L: "B3-LO",
  B3R: "B3-RO",
};

export const normalizeTyrePosition = (raw: string) => LEGACY_TYRE_POSITION_MAP[raw] ?? raw;

export function formatPositionName(pos: string): string {
  const normalized = normalizeTyrePosition(pos);
  const map: Record<string, string> = {
    A1L: "Front Axle Left (Steer L)",
    A1R: "Front Axle Right (Steer R)",
    A2L: "Front Axle 2 Left (Steer 2 L)",
    A2R: "Front Axle 2 Right (Steer 2 R)",
    "B1-LO": "Rear Axle 1 Left Outer",
    "B1-LI": "Rear Axle 1 Left Inner",
    "B1-RI": "Rear Axle 1 Right Inner",
    "B1-RO": "Rear Axle 1 Right Outer",
    "B2-LO": "Rear Axle 2 Left Outer",
    "B2-LI": "Rear Axle 2 Left Inner",
    "B2-RI": "Rear Axle 2 Right Inner",
    "B2-RO": "Rear Axle 2 Right Outer",
    "B3-LO": "Rear Axle 3 Left Outer",
    "B3-LI": "Rear Axle 3 Left Inner",
    "B3-RI": "Rear Axle 3 Right Inner",
    "B3-RO": "Rear Axle 3 Right Outer",
    "T1-LO": "Trailer Axle 1 Left Outer",
    "T1-LI": "Trailer Axle 1 Left Inner",
    "T1-RI": "Trailer Axle 1 Right Inner",
    "T1-RO": "Trailer Axle 1 Right Outer",
    "T2-LO": "Trailer Axle 2 Left Outer",
    "T2-LI": "Trailer Axle 2 Left Inner",
    "T2-RI": "Trailer Axle 2 Right Inner",
    "T2-RO": "Trailer Axle 2 Right Outer",
    "T3-LO": "Trailer Axle 3 Left Outer",
    "T3-LI": "Trailer Axle 3 Left Inner",
    "T3-RI": "Trailer Axle 3 Right Inner",
    "T3-RO": "Trailer Axle 3 Right Outer",
    Spare1: "Spare Tyre 1",
    Spare2: "Spare Tyre 2",
  };
  return map[normalized] || map[pos] || pos;
}

export type TruckLayoutConfigId = "6x4" | "4x2" | "8x4" | "trailer_tri" | "4_wheel";

export interface AxleWheelSlot {
  id: string;
  label: string;
  side: "left" | "right";
  tier?: "outer" | "inner";
}

export interface AxleDefinition {
  id: string;
  name: string;
  type: "front_steer" | "rear_drive" | "trailer" | "spare";
  isDual: boolean;
  slots: AxleWheelSlot[];
}

export interface TruckLayoutConfig {
  id: TruckLayoutConfigId;
  name: string;
  description: string;
  totalTyres: number;
  axles: AxleDefinition[];
}

export const TRUCK_LAYOUTS: Record<TruckLayoutConfigId, TruckLayoutConfig> = {
  "6x4": {
    id: "6x4",
    name: "6x4 Heavy Truck (10 Tyres)",
    description: "1 Steer Axle + 2 Dual Drive Rear Axles (Standard Tanker / Hauler / Prime Mover)",
    totalTyres: 10,
    axles: [
      {
        id: "A1",
        name: "Front Steer Axle",
        type: "front_steer",
        isDual: false,
        slots: [
          { id: "A1L", label: "Steer Left", side: "left" },
          { id: "A1R", label: "Steer Right", side: "right" },
        ],
      },
      {
        id: "B1",
        name: "Rear Axle 1 (Forward Drive)",
        type: "rear_drive",
        isDual: true,
        slots: [
          { id: "B1-LO", label: "Left Outer", side: "left", tier: "outer" },
          { id: "B1-LI", label: "Left Inner", side: "left", tier: "inner" },
          { id: "B1-RI", label: "Right Inner", side: "right", tier: "inner" },
          { id: "B1-RO", label: "Right Outer", side: "right", tier: "outer" },
        ],
      },
      {
        id: "B2",
        name: "Rear Axle 2 (Rear Drive / Tandem)",
        type: "rear_drive",
        isDual: true,
        slots: [
          { id: "B2-LO", label: "Left Outer", side: "left", tier: "outer" },
          { id: "B2-LI", label: "Left Inner", side: "left", tier: "inner" },
          { id: "B2-RI", label: "Right Inner", side: "right", tier: "inner" },
          { id: "B2-RO", label: "Right Outer", side: "right", tier: "outer" },
        ],
      },
    ],
  },
  "4x2": {
    id: "4x2",
    name: "4x2 Rigid Truck (6 Tyres)",
    description: "1 Steer Axle + 1 Dual Drive Rear Axle (Medium Truck / Distribution)",
    totalTyres: 6,
    axles: [
      {
        id: "A1",
        name: "Front Steer Axle",
        type: "front_steer",
        isDual: false,
        slots: [
          { id: "A1L", label: "Steer Left", side: "left" },
          { id: "A1R", label: "Steer Right", side: "right" },
        ],
      },
      {
        id: "B1",
        name: "Rear Axle 1 (Drive Axle)",
        type: "rear_drive",
        isDual: true,
        slots: [
          { id: "B1-LO", label: "Left Outer", side: "left", tier: "outer" },
          { id: "B1-LI", label: "Left Inner", side: "left", tier: "inner" },
          { id: "B1-RI", label: "Right Inner", side: "right", tier: "inner" },
          { id: "B1-RO", label: "Right Outer", side: "right", tier: "outer" },
        ],
      },
    ],
  },
  "8x4": {
    id: "8x4",
    name: "8x4 Multi-Axle Hauler (12 Tyres)",
    description: "2 Front Steer Axles + 2 Dual Drive Rear Axles (Heavy Tipper / Super Hauler)",
    totalTyres: 12,
    axles: [
      {
        id: "A1",
        name: "Front Steer Axle 1",
        type: "front_steer",
        isDual: false,
        slots: [
          { id: "A1L", label: "Steer 1 Left", side: "left" },
          { id: "A1R", label: "Steer 1 Right", side: "right" },
        ],
      },
      {
        id: "A2",
        name: "Front Steer Axle 2",
        type: "front_steer",
        isDual: false,
        slots: [
          { id: "A2L", label: "Steer 2 Left", side: "left" },
          { id: "A2R", label: "Steer 2 Right", side: "right" },
        ],
      },
      {
        id: "B1",
        name: "Rear Axle 1 (Forward Drive)",
        type: "rear_drive",
        isDual: true,
        slots: [
          { id: "B1-LO", label: "Left Outer", side: "left", tier: "outer" },
          { id: "B1-LI", label: "Left Inner", side: "left", tier: "inner" },
          { id: "B1-RI", label: "Right Inner", side: "right", tier: "inner" },
          { id: "B1-RO", label: "Right Outer", side: "right", tier: "outer" },
        ],
      },
      {
        id: "B2",
        name: "Rear Axle 2 (Rear Drive / Tandem)",
        type: "rear_drive",
        isDual: true,
        slots: [
          { id: "B2-LO", label: "Left Outer", side: "left", tier: "outer" },
          { id: "B2-LI", label: "Left Inner", side: "left", tier: "inner" },
          { id: "B2-RI", label: "Right Inner", side: "right", tier: "inner" },
          { id: "B2-RO", label: "Right Outer", side: "right", tier: "outer" },
        ],
      },
    ],
  },
  trailer_tri: {
    id: "trailer_tri",
    name: "Tri-Axle Trailer (12 Tyres)",
    description: "3 Dual Trailer Axles (Fuel Tanker Trailer / Flatbed Trailer)",
    totalTyres: 12,
    axles: [
      {
        id: "T1",
        name: "Trailer Axle 1",
        type: "trailer",
        isDual: true,
        slots: [
          { id: "T1-LO", label: "Left Outer", side: "left", tier: "outer" },
          { id: "T1-LI", label: "Left Inner", side: "left", tier: "inner" },
          { id: "T1-RI", label: "Right Inner", side: "right", tier: "inner" },
          { id: "T1-RO", label: "Right Outer", side: "right", tier: "outer" },
        ],
      },
      {
        id: "T2",
        name: "Trailer Axle 2",
        type: "trailer",
        isDual: true,
        slots: [
          { id: "T2-LO", label: "Left Outer", side: "left", tier: "outer" },
          { id: "T2-LI", label: "Left Inner", side: "left", tier: "inner" },
          { id: "T2-RI", label: "Right Inner", side: "right", tier: "inner" },
          { id: "T2-RO", label: "Right Outer", side: "right", tier: "outer" },
        ],
      },
      {
        id: "T3",
        name: "Trailer Axle 3",
        type: "trailer",
        isDual: true,
        slots: [
          { id: "T3-LO", label: "Left Outer", side: "left", tier: "outer" },
          { id: "T3-LI", label: "Left Inner", side: "left", tier: "inner" },
          { id: "T3-RI", label: "Right Inner", side: "right", tier: "inner" },
          { id: "T3-RO", label: "Right Outer", side: "right", tier: "outer" },
        ],
      },
    ],
  },
  "4_wheel": {
    id: "4_wheel",
    name: "Light Vehicle (4 Tyres)",
    description: "Standard 2-Axle Single Wheel (Pickup / Van / Light Truck)",
    totalTyres: 4,
    axles: [
      {
        id: "A1",
        name: "Front Axle",
        type: "front_steer",
        isDual: false,
        slots: [
          { id: "A1L", label: "Front Left", side: "left" },
          { id: "A1R", label: "Front Right", side: "right" },
        ],
      },
      {
        id: "B1",
        name: "Rear Axle",
        type: "rear_drive",
        isDual: false,
        slots: [
          { id: "B1-LO", label: "Rear Left", side: "left" },
          { id: "B1-RO", label: "Rear Right", side: "right" },
        ],
      },
    ],
  },
};

export function tyreStatus(
  tyre: { target_replace_km: number | null; fitted_odo: number | null; current_tread_mm?: number | null },
  currentOdo: number | null,
): "ok" | "due_soon" | "overdue" {
  if (tyre.current_tread_mm != null && tyre.current_tread_mm <= TYRE_MIN_TREAD_MM) {
    return "overdue";
  }
  if (tyre.current_tread_mm != null && tyre.current_tread_mm <= TYRE_WARN_TREAD_MM) {
    return "due_soon";
  }
  if (!tyre.target_replace_km || tyre.fitted_odo == null || currentOdo == null) return "ok";
  const kmSinceFit = currentOdo - tyre.fitted_odo;
  const remaining = tyre.target_replace_km - kmSinceFit;
  if (remaining <= 0) return "overdue";
  if (remaining <= TYRE_DUE_SOON_KM) return "due_soon";
  return "ok";
}
