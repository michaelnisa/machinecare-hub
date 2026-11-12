/**
 * MachineCare GPS Tracking & Telematics Frontend Client Service
 * Interacts with Supabase tables:
 * - latest_vehicle_positions
 * - vehicle_positions
 * - gps_devices
 * - vehicle_gps_assignments
 * - geofences
 * - gps_alerts
 * - gps_events
 */

import { supabase } from "@/integrations/supabase/client";

export interface GpsDevice {
  id: string;
  organisation_id: string;
  imei: string;
  name: string;
  manufacturer: string;
  model: string;
  serial_number?: string | null;
  protocol: string;
  sim_phone_number?: string | null;
  sim_carrier?: string | null;
  status: "active" | "unassigned" | "suspended" | "offline" | "decommissioned";
  last_communication_at?: string | null;
  created_at: string;
  active_assignment?: {
    id: string;
    vehicle_id: string;
    vehicle_name?: string;
    vehicle_plate?: string;
    installed_at: string;
    technician_name?: string;
  } | null;
}

export interface LiveTrackedVehicle {
  vehicleId: string;
  name: string;
  plateNumber: string | null;
  make: string | null;
  model: string | null;
  status: string;
  currentOdometerKm: number | null;
  deviceId?: string | null;
  deviceImei?: string | null;
  latitude: number | null;
  longitude: number | null;
  speedKmh: number;
  heading: number;
  altitude: number;
  ignition: boolean;
  batteryVoltage?: number | null;
  motionStatus: "moving" | "idling" | "stopped" | "offline";
  satelliteCount: number;
  accuracyM?: number | null;
  recordedAt: string | null;
  address?: string | null;
}

export interface RouteBreadcrumb {
  id: number;
  latitude: number;
  longitude: number;
  speedKmh: number;
  heading: number;
  altitude: number;
  ignition: boolean;
  batteryVoltage?: number | null;
  recordedAt: string;
}

export interface RouteStop {
  latitude: number;
  longitude: number;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  address?: string;
}

export interface RouteHistoryReport {
  vehicleId: string;
  vehicleName: string;
  plateNumber: string | null;
  breadcrumbs: RouteBreadcrumb[];
  stops: RouteStop[];
  totalDistanceKm: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  drivingDurationMinutes: number;
  idleDurationMinutes: number;
  stopDurationMinutes: number;
}

export interface Geofence {
  id: string;
  organisation_id: string;
  name: string;
  description?: string | null;
  geofence_type: "circle" | "polygon";
  center_latitude?: number | null;
  center_longitude?: number | null;
  radius_meters?: number | null;
  polygon_coordinates?: [number, number][] | null;
  color?: string | null;
  speed_limit_kmh?: number | null;
  entry_alert: boolean;
  exit_alert: boolean;
  active: boolean;
  created_at: string;
}

export interface GpsAlert {
  id: string;
  organisation_id: string;
  vehicle_id: string;
  device_id?: string | null;
  alert_type: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  latitude?: number | null;
  longitude?: number | null;
  event_time: string;
  is_acknowledged: boolean;
  acknowledged_at?: string | null;
  notes?: string | null;
  vehicle?: {
    id: string;
    name: string;
    plate_number: string | null;
  } | null;
}

/**
 * Calculates distance between two points in km (Haversine Formula)
 */
export function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Loads all live vehicles with latest GPS positions for the active organization
 */
export async function getLiveGpsFleet(organisationId: string): Promise<LiveTrackedVehicle[]> {
  try {
    const [{ data: machines }, { data: positions }] = await Promise.all([
      (supabase as any)
        .from("machines")
        .select("id, name, plate_number, make, model, status, current_odometer_km, telematics_latitude, telematics_longitude, telematics_speed, telematics_ignition, telematics_battery_volt, telematics_last_at")
        .eq("organisation_id", organisationId)
        .in("category", ["Vehicle", "Trailer", "Fleet", "Truck", "heavy_equipment"])
        .order("name"),
      (supabase as any)
        .from("latest_vehicle_positions")
        .select("*")
        .eq("organisation_id", organisationId),
    ]);

    const posMap = new Map<string, any>();
    (positions || []).forEach((p: any) => {
      posMap.set(p.vehicle_id, p);
    });

    const now = Date.now();
    const result: LiveTrackedVehicle[] = (machines || []).map((m: any) => {
      const p = posMap.get(m.id);

      const lat = p ? Number(p.latitude) : m.telematics_latitude ? Number(m.telematics_latitude) : null;
      const lng = p ? Number(p.longitude) : m.telematics_longitude ? Number(m.telematics_longitude) : null;
      const speed = p ? Number(p.speed_kmh || 0) : Number(m.telematics_speed || 0);
      const ignition = p ? Boolean(p.ignition) : Boolean(m.telematics_ignition);
      const recordedAt = p ? p.recorded_at : m.telematics_last_at;

      // Determine motion status
      let motionStatus: "moving" | "idling" | "stopped" | "offline" = "offline";
      const isRecent = recordedAt && (now - new Date(recordedAt).getTime()) < 24 * 3600 * 1000;

      if (!isRecent || !lat || !lng) {
        motionStatus = "offline";
      } else if (speed > 3) {
        motionStatus = "moving";
      } else if (ignition) {
        motionStatus = "idling";
      } else {
        motionStatus = "stopped";
      }

      return {
        vehicleId: m.id,
        name: m.name,
        plateNumber: m.plate_number,
        make: m.make,
        model: m.model,
        status: m.status,
        currentOdometerKm: p?.odometer_km ?? m.current_odometer_km ?? 0,
        deviceId: p?.device_id,
        latitude: lat,
        longitude: lng,
        speedKmh: speed,
        heading: p ? Number(p.heading || 0) : 0,
        altitude: p ? Number(p.altitude || 0) : 0,
        ignition,
        batteryVoltage: p?.battery_voltage ?? m.telematics_battery_volt,
        motionStatus,
        satelliteCount: p ? Number(p.satellite_count || 0) : 0,
        accuracyM: p?.accuracy_m,
        recordedAt,
        address: p?.address,
      };
    });

    return result;
  } catch (err) {
    console.error("Failed to load live GPS fleet:", err);
    return [];
  }
}

/**
 * Loads route history and computes trajectory breadcrumbs and stops
 */
export async function getVehicleRouteHistory(
  vehicleId: string,
  startAt: string,
  endAt: string
): Promise<RouteHistoryReport | null> {
  try {
    const [{ data: vehicle }, { data: positions }] = await Promise.all([
      (supabase as any)
        .from("machines")
        .select("id, name, plate_number")
        .eq("id", vehicleId)
        .single(),
      (supabase as any)
        .from("vehicle_positions")
        .select("id, latitude, longitude, speed_kmh, heading, altitude, ignition, battery_voltage, recorded_at")
        .eq("vehicle_id", vehicleId)
        .gte("recorded_at", startAt)
        .lte("recorded_at", endAt)
        .order("recorded_at", { ascending: true })
        .limit(2000),
    ]);

    if (!vehicle) return null;

    const breadcrumbs: RouteBreadcrumb[] = (positions || []).map((p: any) => ({
      id: p.id,
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      speedKmh: Number(p.speed_kmh || 0),
      heading: Number(p.heading || 0),
      altitude: Number(p.altitude || 0),
      ignition: Boolean(p.ignition),
      batteryVoltage: p.battery_voltage ? Number(p.battery_voltage) : undefined,
      recordedAt: p.recorded_at,
    }));

    let totalDist = 0;
    let maxSpeed = 0;
    let speedSum = 0;
    let movingCount = 0;
    const stops: RouteStop[] = [];

    let currentStopStart: string | null = null;
    let currentStopCoords: [number, number] | null = null;

    for (let i = 0; i < breadcrumbs.length; i++) {
      const pt = breadcrumbs[i];
      if (pt.speedKmh > maxSpeed) maxSpeed = pt.speedKmh;

      if (i > 0) {
        const prev = breadcrumbs[i - 1];
        const dist = calculateHaversineDistance(prev.latitude, prev.longitude, pt.latitude, pt.longitude);
        // Discard GPS drift jumps (> 150 km between pings)
        if (dist < 150) {
          totalDist += dist;
        }

        if (pt.speedKmh > 3) {
          speedSum += pt.speedKmh;
          movingCount++;

          // If was in a stop, close it
          if (currentStopStart && currentStopCoords) {
            const durationMin = Math.round((new Date(pt.recordedAt).getTime() - new Date(currentStopStart).getTime()) / 60000);
            if (durationMin >= 3) {
              stops.push({
                latitude: currentStopCoords[0],
                longitude: currentStopCoords[1],
                startAt: currentStopStart,
                endAt: pt.recordedAt,
                durationMinutes: durationMin,
              });
            }
            currentStopStart = null;
            currentStopCoords = null;
          }
        } else {
          // Stationary
          if (!currentStopStart) {
            currentStopStart = pt.recordedAt;
            currentStopCoords = [pt.latitude, pt.longitude];
          }
        }
      }
    }

    const avgSpeed = movingCount > 0 ? Math.round((speedSum / movingCount) * 10) / 10 : 0;
    const totalDurationMin = breadcrumbs.length > 1
      ? Math.round((new Date(breadcrumbs[breadcrumbs.length - 1].recordedAt).getTime() - new Date(breadcrumbs[0].recordedAt).getTime()) / 60000)
      : 0;
    const stopDuration = stops.reduce((acc, s) => acc + s.durationMinutes, 0);

    return {
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      plateNumber: vehicle.plate_number,
      breadcrumbs,
      stops,
      totalDistanceKm: Math.round(totalDist * 10) / 10,
      maxSpeedKmh: Math.round(maxSpeed),
      avgSpeedKmh: avgSpeed,
      drivingDurationMinutes: Math.max(totalDurationMin - stopDuration, 0),
      idleDurationMinutes: 0,
      stopDurationMinutes: stopDuration,
    };
  } catch (err) {
    console.error("Failed to load vehicle route history:", err);
    return null;
  }
}

/**
 * Loads Geofences for the active organization
 */
export async function getGeofences(organisationId: string): Promise<Geofence[]> {
  const { data, error } = await (supabase as any)
    .from("geofences")
    .select("*")
    .eq("organisation_id", organisationId)
    .order("name");

  if (error) {
    console.error("Failed to load geofences:", error);
    return [];
  }
  return data || [];
}

/**
 * Creates a new Geofence
 */
export async function createGeofence(
  organisationId: string,
  payload: Omit<Geofence, "id" | "organisation_id" | "created_at">
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await (supabase as any).from("geofences").insert({
      organisation_id: organisationId,
      ...payload,
    });
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Deletes a Geofence
 */
export async function deleteGeofence(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await (supabase as any).from("geofences").delete().eq("id", id);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Loads GPS Alerts
 */
export async function getGpsAlerts(organisationId: string): Promise<GpsAlert[]> {
  const { data, error } = await (supabase as any)
    .from("gps_alerts")
    .select(`
      id,
      organisation_id,
      vehicle_id,
      device_id,
      alert_type,
      severity,
      title,
      message,
      latitude,
      longitude,
      event_time,
      is_acknowledged,
      acknowledged_at,
      notes,
      vehicle:machines(id, name, plate_number)
    `)
    .eq("organisation_id", organisationId)
    .order("event_time", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Failed to load GPS alerts:", error);
    return [];
  }
  return (data || []).map((row: any) => ({
    ...row,
    vehicle: row.vehicle || null,
  }));
}

/**
 * Acknowledges an active GPS Alert
 */
export async function acknowledgeGpsAlert(alertId: string, notes?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await (supabase as any)
      .from("gps_alerts")
      .update({
        is_acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        notes: notes || "Acknowledged by fleet controller",
      })
      .eq("id", alertId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Loads registered GPS devices with active assignments
 */
export async function getGpsDevices(organisationId: string): Promise<GpsDevice[]> {
  try {
    const [{ data: devices }, { data: assignments }] = await Promise.all([
      (supabase as any)
        .from("gps_devices")
        .select("*")
        .eq("organisation_id", organisationId)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("vehicle_gps_assignments")
        .select(`
          id,
          device_id,
          vehicle_id,
          installed_at,
          technician_name,
          vehicle:machines(id, name, plate_number)
        `)
        .eq("organisation_id", organisationId)
        .eq("status", "active"),
    ]);

    const assignMap = new Map<string, any>();
    (assignments || []).forEach((a: any) => {
      assignMap.set(a.device_id, {
        id: a.id,
        vehicle_id: a.vehicle_id,
        vehicle_name: a.vehicle?.name,
        vehicle_plate: a.vehicle?.plate_number,
        installed_at: a.installed_at,
        technician_name: a.technician_name,
      });
    });

    return (devices || []).map((d: any) => ({
      ...d,
      active_assignment: assignMap.get(d.id) || null,
    }));
  } catch (err) {
    console.error("Failed to load GPS devices:", err);
    return [];
  }
}

/**
 * Registers a new GPS device in the organization
 */
export async function registerGpsDevice(
  organisationId: string,
  payload: {
    imei: string;
    name: string;
    manufacturer: string;
    model: string;
    serial_number?: string;
    sim_phone_number?: string;
    sim_carrier?: string;
  }
): Promise<{ success: boolean; device?: GpsDevice; error?: string }> {
  try {
    const { data, error } = await (supabase as any)
      .from("gps_devices")
      .insert({
        organisation_id: organisationId,
        imei: payload.imei.trim(),
        name: payload.name.trim(),
        manufacturer: payload.manufacturer,
        model: payload.model,
        serial_number: payload.serial_number || null,
        sim_phone_number: payload.sim_phone_number || null,
        sim_carrier: payload.sim_carrier || "Vodacom TZ",
        protocol: payload.manufacturer.toLowerCase().includes("teltonika") ? "teltonika" : "gt06",
        status: "unassigned",
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, device: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Assigns a GPS device to a vehicle (updating assignment history)
 */
export async function assignDeviceToVehicle(
  organisationId: string,
  deviceId: string,
  vehicleId: string,
  technicianName: string,
  installationNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Decommission any existing active assignment for this device
    await (supabase as any)
      .from("vehicle_gps_assignments")
      .update({ status: "historical", removed_at: new Date().toISOString() })
      .eq("device_id", deviceId)
      .eq("status", "active");

    // 2. Also close any previous active device for this vehicle
    await (supabase as any)
      .from("vehicle_gps_assignments")
      .update({ status: "historical", removed_at: new Date().toISOString() })
      .eq("vehicle_id", vehicleId)
      .eq("status", "active");

    // 3. Create active assignment
    const { error: assignErr } = await (supabase as any)
      .from("vehicle_gps_assignments")
      .insert({
        organisation_id: organisationId,
        device_id: deviceId,
        vehicle_id: vehicleId,
        technician_name: technicianName.trim(),
        installation_notes: installationNotes || null,
        status: "active",
      });

    if (assignErr) throw assignErr;

    // 4. Update device status
    await (supabase as any)
      .from("gps_devices")
      .update({ status: "active" })
      .eq("id", deviceId);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Unassigns a GPS device from a vehicle
 */
export async function unassignDevice(assignmentId: string, deviceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await (supabase as any)
      .from("vehicle_gps_assignments")
      .update({ status: "historical", removed_at: new Date().toISOString() })
      .eq("id", assignmentId);

    await (supabase as any)
      .from("gps_devices")
      .update({ status: "unassigned" })
      .eq("id", deviceId);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Converts speed from nautical knots to kilometers per hour
 */
export function knotsToKmh(knots: number): number {
  return knots * 1.852;
}

/**
 * Checks if a coordinate is inside a circular geofence
 */
export function isPointInCircleGeofence(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  radiusMeters: number
): boolean {
  const distKm = calculateHaversineDistance(lat, lon, centerLat, centerLon);
  return distKm <= radiusMeters / 1000;
}

/**
 * Checks if a coordinate is inside a polygon using ray-casting point-in-polygon
 */
export function isPointInPolygonGeofence(
  lat: number,
  lon: number,
  polygon: [number, number][]
): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = yi > lon !== yj > lon && lat < ((xj - xi) * (lon - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

