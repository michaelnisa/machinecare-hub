import { SupabaseClient } from "@supabase/supabase-js";
import { NormalizedPosition, calculateDistanceKm } from "../ingestion/normalizer";
import { config } from "../config";

export interface GeofenceZone {
  id: string;
  name: string;
  geofence_type: "circle" | "polygon";
  center_latitude?: number;
  center_longitude?: number;
  radius_meters?: number;
  polygon_coordinates?: [number, number][];
  entry_alert: boolean;
  exit_alert: boolean;
  speed_limit_kmh?: number;
}

export class AlertEvaluator {
  private supabase: SupabaseClient;
  private geofencesCache: Map<string, GeofenceZone[]> = new Map(); // orgId -> geofences
  private vehicleGeofenceState: Map<string, Set<string>> = new Map(); // vehicleId -> Set of geofenceIds vehicle is currently inside

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  public async loadGeofences(organisationId: string): Promise<GeofenceZone[]> {
    const { data } = await this.supabase
      .from("geofences")
      .select("*")
      .eq("organisation_id", organisationId)
      .eq("active", true);

    const zones = (data || []) as GeofenceZone[];
    this.geofencesCache.set(organisationId, zones);
    return zones;
  }

  /**
   * Evaluates speed, power and geofence rules for a new incoming position
   */
  public async evaluate(pos: NormalizedPosition): Promise<void> {
    const alertsToInsert: any[] = [];
    const eventsToInsert: any[] = [];

    // 1. Overspeed Evaluation
    const speedLimit = config.telematics.overspeedThresholdKmh;
    if (pos.speedKmh > speedLimit) {
      alertsToInsert.push({
        organisation_id: pos.organisationId,
        vehicle_id: pos.vehicleId,
        device_id: pos.deviceId,
        alert_type: "overspeed",
        severity: pos.speedKmh > speedLimit + 20 ? "critical" : "warning",
        title: `Overspeed Detected: ${pos.speedKmh.toFixed(0)} km/h`,
        message: `Vehicle exceeded road speed threshold of ${speedLimit} km/h (actual: ${pos.speedKmh.toFixed(0)} km/h).`,
        latitude: pos.latitude,
        longitude: pos.longitude,
        event_time: pos.recordedAt,
      });

      eventsToInsert.push({
        organisation_id: pos.organisationId,
        vehicle_id: pos.vehicleId,
        device_id: pos.deviceId,
        event_type: "overspeed",
        title: "Overspeed Event",
        description: `Vehicle traveled at ${pos.speedKmh.toFixed(0)} km/h`,
        latitude: pos.latitude,
        longitude: pos.longitude,
        speed_kmh: pos.speedKmh,
        event_time: pos.recordedAt,
      });
    }

    // 2. External Power Loss & Tampering
    const isPowerCut =
      !pos.externalPower ||
      pos.rawAttributes?.alarm === "powerCut" ||
      pos.rawAttributes?.alarm === "tamper" ||
      pos.rawAttributes?.power === 0;

    if (isPowerCut) {
      alertsToInsert.push({
        organisation_id: pos.organisationId,
        vehicle_id: pos.vehicleId,
        device_id: pos.deviceId,
        alert_type: "power_cut",
        severity: "critical",
        title: "Tracker Power Disconnected / Tamper Alert",
        message: "External 12V/24V power supply removed or cut. Tracker running on internal backup battery.",
        latitude: pos.latitude,
        longitude: pos.longitude,
        event_time: pos.recordedAt,
      });

      eventsToInsert.push({
        organisation_id: pos.organisationId,
        vehicle_id: pos.vehicleId,
        device_id: pos.deviceId,
        event_type: "power_cut",
        title: "External Power Disconnected",
        description: "Main 12V/24V supply dropped to zero or alarm received.",
        latitude: pos.latitude,
        longitude: pos.longitude,
        event_time: pos.recordedAt,
      });
    }

    // 3. Internal Backup Battery Critical Alert
    const backupVolts = pos.batteryVoltage;
    const backupLevel = pos.rawAttributes?.batteryLevel;
    const isLowBackup =
      (backupVolts != null && backupVolts > 0 && backupVolts < 3.65) ||
      (backupLevel != null && backupLevel > 0 && backupLevel <= 15);

    if (isLowBackup) {
      alertsToInsert.push({
        organisation_id: pos.organisationId,
        vehicle_id: pos.vehicleId,
        device_id: pos.deviceId,
        alert_type: "low_battery",
        severity: "warning",
        title: "Tracker Backup Battery Critical",
        message: `Device internal reserve battery low (${backupVolts ? `${backupVolts.toFixed(2)}V` : `${backupLevel}%`}). Reconnect external vehicle power.`,
        latitude: pos.latitude,
        longitude: pos.longitude,
        event_time: pos.recordedAt,
      });
    }

    // 4. Geofence Evaluation
    let zones = this.geofencesCache.get(pos.organisationId);
    if (!zones) {
      zones = await this.loadGeofences(pos.organisationId);
    }

    if (zones && zones.length > 0) {
      let currentInside = this.vehicleGeofenceState.get(pos.vehicleId);
      if (!currentInside) {
        currentInside = new Set<string>();
        this.vehicleGeofenceState.set(pos.vehicleId, currentInside);
      }

      for (const zone of zones) {
        const isInside = this.checkInside(pos.latitude, pos.longitude, zone);
        const wasInside = currentInside.has(zone.id);

        if (isInside && !wasInside) {
          // Geofence Entry Event
          currentInside.add(zone.id);
          if (zone.entry_alert) {
            alertsToInsert.push({
              organisation_id: pos.organisationId,
              vehicle_id: pos.vehicleId,
              device_id: pos.deviceId,
              alert_type: "geofence_enter",
              severity: "info",
              title: `Entered Geofence: ${zone.name}`,
              message: `Vehicle entered designated perimeter '${zone.name}'.`,
              latitude: pos.latitude,
              longitude: pos.longitude,
              event_time: pos.recordedAt,
            });
          }
        } else if (!isInside && wasInside) {
          // Geofence Exit Event
          currentInside.delete(zone.id);
          if (zone.exit_alert) {
            alertsToInsert.push({
              organisation_id: pos.organisationId,
              vehicle_id: pos.vehicleId,
              device_id: pos.deviceId,
              alert_type: "geofence_exit",
              severity: "warning",
              title: `Exited Geofence: ${zone.name}`,
              message: `Vehicle departed from perimeter '${zone.name}'.`,
              latitude: pos.latitude,
              longitude: pos.longitude,
              event_time: pos.recordedAt,
            });
          }
        }
      }
    }

    // Batch insert alerts and events
    if (alertsToInsert.length > 0) {
      await this.supabase.from("gps_alerts").insert(alertsToInsert);
    }
    if (eventsToInsert.length > 0) {
      await this.supabase.from("gps_events").insert(eventsToInsert);
    }
  }

  private checkInside(lat: number, lon: number, zone: GeofenceZone): boolean {
    if (zone.geofence_type === "circle" && zone.center_latitude != null && zone.center_longitude != null) {
      const distKm = calculateDistanceKm(lat, lon, zone.center_latitude, zone.center_longitude);
      const radiusKm = (zone.radius_meters || 500) / 1000;
      return distKm <= radiusKm;
    }
    // Point-in-polygon algorithm
    if (zone.geofence_type === "polygon" && zone.polygon_coordinates && zone.polygon_coordinates.length >= 3) {
      const poly = zone.polygon_coordinates;
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1];
        const xj = poly[j][0], yj = poly[j][1];
        const intersect = yi > lon !== yj > lon && lat < ((xj - xi) * (lon - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    }
    return false;
  }
}
