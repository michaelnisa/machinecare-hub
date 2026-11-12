import { TraccarPosition } from "../traccar/client";

export interface NormalizedPosition {
  deviceId: string; // Supabase gps_devices.id
  vehicleId: string; // Supabase machines.id
  organisationId: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  heading: number;
  altitude: number;
  ignition: boolean;
  batteryVoltage?: number;
  externalPower: boolean;
  motionStatus: "moving" | "idling" | "stopped" | "offline";
  satelliteCount: number;
  accuracyM?: number;
  odometerKm?: number;
  address?: string;
  recordedAt: string;
  receivedAt: string;
  rawAttributes: Record<string, any>;
}

/**
 * Calculates great-circle distance between two points in kilometers (Haversine Formula)
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isValidCoordinate(lat: number, lon: number): boolean {
  if (lat == null || lon == null) return false;
  if (isNaN(lat) || isNaN(lon)) return false;
  if (lat === 0 && lon === 0) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  return true;
}

export function normalizeTraccarPosition(
  pos: TraccarPosition,
  vehicleId: string,
  deviceId: string,
  organisationId: string,
  previousPos?: { latitude: number; longitude: number; recordedAt: string }
): NormalizedPosition | null {
  if (!isValidCoordinate(pos.latitude, pos.longitude)) {
    return null;
  }

  // Speed in Traccar is reported in knots (1 knot = 1.852 km/h)
  const speedKmh = Math.round(Number(pos.speed || 0) * 1.852 * 10) / 10;
  const ignition = Boolean(pos.attributes?.ignition ?? (speedKmh > 3));

  // Determine motion status
  let motionStatus: "moving" | "idling" | "stopped" = "stopped";
  if (speedKmh > 3) {
    motionStatus = "moving";
  } else if (ignition) {
    motionStatus = "idling";
  }

  // Odometer: Teltonika / Traccar reports totalDistance in meters
  let odometerKm: number | undefined;
  if (pos.attributes?.totalDistance != null) {
    odometerKm = Math.round((Number(pos.attributes.totalDistance) / 1000) * 10) / 10;
  } else if (pos.attributes?.odometer != null) {
    odometerKm = Math.round((Number(pos.attributes.odometer) / 1000) * 10) / 10;
  }

  // Battery voltage
  const batteryVoltage = pos.attributes?.power ?? pos.attributes?.battery;

  // GPS Jump Detection (e.g. invalid leap > 150km in 10 seconds)
  if (previousPos) {
    const timeDeltaSeconds = Math.max(
      (new Date(pos.deviceTime).getTime() - new Date(previousPos.recordedAt).getTime()) / 1000,
      1
    );
    const distKm = calculateDistanceKm(previousPos.latitude, previousPos.longitude, pos.latitude, pos.longitude);
    const impliedSpeed = (distKm / timeDeltaSeconds) * 3600;

    // Speeds exceeding 200 km/h for heavy fleet indicate a satellite multipath glitch
    if (distKm > 20 && impliedSpeed > 220) {
      console.warn(`[Normalizer] Rejected GPS multipath jump: ${distKm.toFixed(1)}km in ${timeDeltaSeconds}s (${impliedSpeed.toFixed(0)} km/h)`);
      return null;
    }
  }

  return {
    deviceId,
    vehicleId,
    organisationId,
    latitude: pos.latitude,
    longitude: pos.longitude,
    speedKmh,
    heading: Number(pos.course || 0),
    altitude: Number(pos.altitude || 0),
    ignition,
    batteryVoltage: batteryVoltage != null ? Number(batteryVoltage) : undefined,
    externalPower: pos.attributes?.charge !== false,
    motionStatus,
    satelliteCount: Number(pos.attributes?.sat || 0),
    accuracyM: pos.accuracy != null ? Number(pos.accuracy) : undefined,
    odometerKm,
    address: pos.address,
    recordedAt: pos.deviceTime || pos.fixTime || new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    rawAttributes: pos.attributes || {},
  };
}
