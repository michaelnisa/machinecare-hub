import { MachineDataParameter } from "@/types/connected-data";

/**
 * PHASE 3: MACHINE DATA DICTIONARY & NORMALIZATION ENGINE
 * Registers standard parameter definitions, unit conversions, and value validation.
 */

export interface DictionaryMappingRule {
  raw_key: string;
  standard_key: string;
  unit_conversion?: (val: number) => number;
}

export class DataDictionaryEngine {
  // Standard Registry
  private static dictionary: Record<string, MachineDataParameter> = {
    engine_coolant_temperature: {
      id: "param-001",
      standard_key: "engine_coolant_temperature",
      label: "Engine Coolant Temperature",
      category: "Engine & Thermal",
      data_type: "FLOAT",
      unit: "°C",
      min_expected_value: 0,
      max_expected_value: 110,
      description: "Engine block liquid coolant temperature",
    },
    engine_speed_rpm: {
      id: "param-002",
      standard_key: "engine_speed_rpm",
      label: "Engine Speed (RPM)",
      category: "Engine & Thermal",
      data_type: "FLOAT",
      unit: "RPM",
      min_expected_value: 0,
      max_expected_value: 3500,
      description: "Crankshaft rotation speed per minute",
    },
    hydraulic_system_pressure: {
      id: "param-003",
      standard_key: "hydraulic_system_pressure",
      label: "Hydraulic System Pressure",
      category: "Hydraulics",
      data_type: "FLOAT",
      unit: "bar",
      min_expected_value: 0,
      max_expected_value: 400,
      description: "Main hydraulic pump line pressure",
    },
    battery_terminal_voltage: {
      id: "param-004",
      standard_key: "battery_terminal_voltage",
      label: "Battery Terminal Voltage",
      category: "Electrical",
      data_type: "FLOAT",
      unit: "V",
      min_expected_value: 0,
      max_expected_value: 36,
      description: "DC electrical system supply voltage",
    },
    fuel_tank_level_percent: {
      id: "param-005",
      standard_key: "fuel_tank_level_percent",
      label: "Fuel Tank Level",
      category: "Fluid Systems",
      data_type: "FLOAT",
      unit: "%",
      min_expected_value: 0,
      max_expected_value: 100,
      description: "Percentage of fuel remaining in tank",
    },
    structural_vibration_hz: {
      id: "param-006",
      standard_key: "structural_vibration_hz",
      label: "Structural Vibration",
      category: "Vibration & Structure",
      data_type: "FLOAT",
      unit: "mm/s",
      min_expected_value: 0,
      max_expected_value: 25,
      description: "Tri-axial accelerometer peak vibration amplitude",
    },
    total_engine_operating_hours: {
      id: "param-007",
      standard_key: "total_engine_operating_hours",
      label: "Engine Operating Hours",
      category: "Counters",
      data_type: "FLOAT",
      unit: "h",
      min_expected_value: 0,
      max_expected_value: 100000,
      description: "Total non-decreasing engine runtime accumulator",
    },
  };

  /**
   * Returns all standard registered parameters
   */
  public static getDictionaryParameters(): MachineDataParameter[] {
    return Object.values(this.dictionary);
  }

  /**
   * Looks up parameter definition by standard key
   */
  public static lookup(standardKey: string): MachineDataParameter | null {
    return this.dictionary[standardKey] || null;
  }

  /**
   * Unit Conversion Utility (e.g. °F to °C, PSI to bar)
   */
  public static convertUnit(value: number, fromUnit: string, toUnit: string): number {
    if (fromUnit === fromUnit) return value;
    if (fromUnit === "°F" && toUnit === "°C") return (value - 32) * (5 / 9);
    if (fromUnit === "PSI" && toUnit === "bar") return value * 0.0689476;
    if (fromUnit === "kPa" && toUnit === "bar") return value * 0.01;
    return value;
  }
}
