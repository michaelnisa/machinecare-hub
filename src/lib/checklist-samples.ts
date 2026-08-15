// Starter checklist templates offered when creating a new template, so a
// new org isn't staring at a blank form. Items are inserted as-is into
// checklist_template_items once the template row is created.

export type SampleItem = {
  text: string;
  item_type: "pass_fail" | "measurement" | "text" | "photo_required" | "tri_state";
  severity: "minor" | "major" | "critical";
  min_value?: number;
  max_value?: number;
  unit?: string;
};

export type SampleTemplate = {
  key: string;
  name: string;
  description: string;
  machine_category: string | null;
  items: SampleItem[];
};

export const CHECKLIST_SAMPLES: SampleTemplate[] = [
  {
    key: "daily-prestart",
    name: "Daily Pre-Start Inspection",
    description: "Quick tri-state check before a machine starts its shift.",
    machine_category: null,
    items: [
      { text: "Engine oil level", item_type: "tri_state", severity: "major" },
      { text: "Coolant level", item_type: "tri_state", severity: "major" },
      { text: "Fuel level adequate for shift", item_type: "tri_state", severity: "minor" },
      { text: "Tyres / tracks condition", item_type: "tri_state", severity: "major" },
      { text: "Lights and indicators working", item_type: "tri_state", severity: "minor" },
      { text: "Brakes functioning correctly", item_type: "tri_state", severity: "critical" },
      { text: "No visible leaks (oil, fuel, hydraulic)", item_type: "tri_state", severity: "critical" },
      { text: "Fire extinguisher present and charged", item_type: "tri_state", severity: "major" },
      { text: "Seatbelt / safety restraint functional", item_type: "tri_state", severity: "critical" },
      { text: "Unusual noise or vibration", item_type: "tri_state", severity: "major" },
      { text: "Notes / issues found", item_type: "text", severity: "minor" },
    ],
  },
  {
    key: "weekly-pm-general",
    name: "Weekly Preventive Maintenance — General Equipment",
    description: "Standard weekly PM pass for general industrial equipment.",
    machine_category: null,
    items: [
      { text: "Grease points lubricated", item_type: "pass_fail", severity: "major" },
      { text: "Belt tension checked", item_type: "pass_fail", severity: "major" },
      { text: "Air/oil filters inspected", item_type: "pass_fail", severity: "major" },
      { text: "Bolts and fasteners torque-checked", item_type: "pass_fail", severity: "minor" },
      { text: "Guards and covers secure", item_type: "pass_fail", severity: "critical" },
      { text: "Electrical connections inspected", item_type: "pass_fail", severity: "major" },
      { text: "Operating temperature", item_type: "measurement", severity: "major", unit: "°C" },
      { text: "Vibration level acceptable", item_type: "pass_fail", severity: "major" },
      { text: "Cleaning and housekeeping done", item_type: "pass_fail", severity: "minor" },
      { text: "Photo of equipment condition", item_type: "photo_required", severity: "minor" },
    ],
  },
  {
    key: "monthly-safety",
    name: "Monthly Safety Inspection",
    description: "Site/equipment safety walkdown, tri-state for fast completion.",
    machine_category: null,
    items: [
      { text: "Machine guards in place", item_type: "tri_state", severity: "critical" },
      { text: "Emergency stop functional", item_type: "tri_state", severity: "critical" },
      { text: "Fire extinguisher charged and accessible", item_type: "tri_state", severity: "critical" },
      { text: "PPE available and in good condition", item_type: "tri_state", severity: "major" },
      { text: "Warning labels and signage visible", item_type: "tri_state", severity: "minor" },
      { text: "Walkways clear of obstructions", item_type: "tri_state", severity: "major" },
      { text: "Lockout/tagout points accessible", item_type: "tri_state", severity: "critical" },
      { text: "Spill kit stocked", item_type: "tri_state", severity: "major" },
      { text: "First aid kit stocked and in date", item_type: "tri_state", severity: "major" },
      { text: "Corrective actions required", item_type: "text", severity: "minor" },
    ],
  },
  {
    key: "generator-pm",
    name: "Generator PM Checklist",
    description: "Preventive maintenance pass for stationary generators.",
    machine_category: "Generator",
    items: [
      { text: "Oil pressure", item_type: "measurement", severity: "critical", unit: "psi" },
      { text: "Coolant temperature", item_type: "measurement", severity: "major", unit: "°C" },
      { text: "Battery terminals clean and secure", item_type: "pass_fail", severity: "major" },
      { text: "Fuel level", item_type: "measurement", severity: "major", unit: "%" },
      { text: "Belt condition", item_type: "pass_fail", severity: "major" },
      { text: "Air filter condition", item_type: "pass_fail", severity: "major" },
      { text: "Exhaust system free of leaks", item_type: "pass_fail", severity: "critical" },
      { text: "Control panel / alarms functional", item_type: "pass_fail", severity: "critical" },
      { text: "Load test result", item_type: "text", severity: "major" },
    ],
  },
  {
    key: "vehicle-pretrip",
    name: "Vehicle Pre-Trip Inspection",
    description: "Driver-facing pre-trip check for fleet vehicles.",
    machine_category: "Vehicle",
    items: [
      { text: "Tyres and pressure", item_type: "tri_state", severity: "critical" },
      { text: "Brakes", item_type: "tri_state", severity: "critical" },
      { text: "Lights (head, tail, indicators, brake)", item_type: "tri_state", severity: "major" },
      { text: "Mirrors and windscreen condition", item_type: "tri_state", severity: "minor" },
      { text: "Horn functional", item_type: "tri_state", severity: "minor" },
      { text: "Seatbelts", item_type: "tri_state", severity: "critical" },
      { text: "Engine oil / coolant / fluid levels", item_type: "tri_state", severity: "major" },
      { text: "No visible leaks under vehicle", item_type: "tri_state", severity: "major" },
      { text: "Load secured (if applicable)", item_type: "tri_state", severity: "major" },
      { text: "Documents (licence, insurance) on board", item_type: "tri_state", severity: "minor" },
    ],
  },
];
