/**
 * MachineCare Assets Domain Module
 * Manages asset register, hierarchy, health status, and meter readings.
 */

export interface Asset {
  id: string;
  name: string;
  asset_code?: string;
  status: string;
  location?: string;
  department?: string;
  operating_hours?: number;
}
