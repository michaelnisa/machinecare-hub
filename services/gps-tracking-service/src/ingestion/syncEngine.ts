import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config";
import { TraccarPosition } from "../traccar/client";
import { normalizeTraccarPosition, NormalizedPosition } from "./normalizer";
import { AlertEvaluator } from "../alerts/alertEvaluator";

interface DeviceMapping {
  deviceId: string;
  vehicleId: string;
  organisationId: string;
  imei: string;
  traccarDeviceId?: number;
}

export class GpsSyncEngine {
  private supabase: SupabaseClient;
  private alertEvaluator: AlertEvaluator;
  private imeiMap: Map<string, DeviceMapping> = new Map(); // imei -> mapping
  private traccarIdMap: Map<number, DeviceMapping> = new Map(); // traccarDeviceId -> mapping
  private latestPositionsCache: Map<string, NormalizedPosition> = new Map(); // vehicleId -> last pos
  private positionBatch: any[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false },
    });
    this.alertEvaluator = new AlertEvaluator(this.supabase);
  }

  public async initialize() {
    console.log("[SyncEngine] Initializing and loading active GPS device assignments...");
    await this.refreshDeviceMappings();

    // Start background batch flusher for vehicle_positions breadcrumbs
    this.flushTimer = setInterval(() => {
      this.flushPositionsBatch();
    }, config.telematics.batchFlushIntervalMs);
  }

  public async refreshDeviceMappings() {
    // Query active vehicle GPS assignments
    const { data: assignments, error } = await this.supabase
      .from("vehicle_gps_assignments")
      .select(`
        id,
        device_id,
        vehicle_id,
        organisation_id,
        status,
        gps_devices:device_id (
          id,
          imei,
          traccar_device_id
        )
      `)
      .eq("status", "active");

    if (error) {
      console.error("[SyncEngine] Failed to load vehicle_gps_assignments:", error.message);
      return;
    }

    this.imeiMap.clear();
    this.traccarIdMap.clear();

    (assignments || []).forEach((row: any) => {
      const dev = row.gps_devices;
      if (dev && dev.imei) {
        const mapping: DeviceMapping = {
          deviceId: dev.id,
          vehicleId: row.vehicle_id,
          organisationId: row.organisation_id,
          imei: dev.imei.trim(),
          traccarDeviceId: dev.traccar_device_id,
        };
        this.imeiMap.set(mapping.imei, mapping);
        if (dev.traccar_device_id) {
          this.traccarIdMap.set(dev.traccar_device_id, mapping);
        }
      }
    });

    console.log(`[SyncEngine] Active device mappings loaded: ${this.imeiMap.size} devices mapped to fleet vehicles.`);
  }

  /**
   * Process a single incoming position from Traccar WebSocket or REST
   */
  public async processPosition(pos: TraccarPosition, explicitImei?: string) {
    let mapping: DeviceMapping | undefined;

    if (explicitImei) {
      mapping = this.imeiMap.get(explicitImei);
    } else if (pos.deviceId) {
      mapping = this.traccarIdMap.get(pos.deviceId);
    }

    if (!mapping) {
      // Unmapped device pinging Traccar - ignore or log diagnostic
      return;
    }

    const prevPos = this.latestPositionsCache.get(mapping.vehicleId);
    const normalized = normalizeTraccarPosition(
      pos,
      mapping.vehicleId,
      mapping.deviceId,
      mapping.organisationId,
      prevPos ? { latitude: prevPos.latitude, longitude: prevPos.longitude, recordedAt: prevPos.recordedAt } : undefined
    );

    if (!normalized) return;

    this.latestPositionsCache.set(mapping.vehicleId, normalized);

    // 1. Update latest_vehicle_positions (upsert)
    await this.updateLatestPosition(normalized);

    // 2. Queue for historical vehicle_positions batch insert
    this.positionBatch.push({
      organisation_id: normalized.organisationId,
      vehicle_id: normalized.vehicleId,
      device_id: normalized.deviceId,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      speed_kmh: normalized.speedKmh,
      heading: normalized.heading,
      altitude: normalized.altitude,
      ignition: normalized.ignition,
      odometer_km: normalized.odometerKm,
      battery_voltage: normalized.batteryVoltage,
      satellite_count: normalized.satelliteCount,
      accuracy_m: normalized.accuracyM,
      recorded_at: normalized.recordedAt,
      received_at: normalized.receivedAt,
      raw_attributes: normalized.rawAttributes,
    });

    if (this.positionBatch.length >= config.telematics.maxBatchSize) {
      this.flushPositionsBatch();
    }

    // 3. Evaluate alerts (overspeed, geofences, power cut)
    this.alertEvaluator.evaluate(normalized).catch((err) => {
      console.error("[SyncEngine] Alert evaluation error:", err.message);
    });

    // 4. Update machines table with live telematics telemetry
    this.updateVehicleMetrics(normalized).catch((err) => {
      console.error("[SyncEngine] Error updating machine record:", err.message);
    });
  }

  private async updateLatestPosition(pos: NormalizedPosition) {
    try {
      await this.supabase.from("latest_vehicle_positions").upsert({
        vehicle_id: pos.vehicleId,
        device_id: pos.deviceId,
        organisation_id: pos.organisationId,
        latitude: pos.latitude,
        longitude: pos.longitude,
        speed_kmh: pos.speedKmh,
        heading: pos.heading,
        altitude: pos.altitude,
        ignition: pos.ignition,
        battery_voltage: pos.batteryVoltage,
        external_power_connected: pos.externalPower,
        motion_status: pos.motionStatus,
        satellite_count: pos.satelliteCount,
        accuracy_m: pos.accuracyM,
        odometer_km: pos.odometerKm,
        address: pos.address,
        recorded_at: pos.recordedAt,
        received_at: pos.receivedAt,
        raw_attributes: pos.rawAttributes,
      });
    } catch (err: any) {
      console.error("[SyncEngine] Error upserting latest_vehicle_positions:", err.message);
    }
  }

  private async updateVehicleMetrics(pos: NormalizedPosition) {
    const updatePayload: Record<string, any> = {
      telematics_latitude: pos.latitude,
      telematics_longitude: pos.longitude,
      telematics_speed: pos.speedKmh,
      telematics_ignition: pos.ignition,
      telematics_battery_volt: pos.batteryVoltage,
      telematics_last_at: pos.recordedAt,
      telematics_raw: {
        heading: pos.heading,
        motion_status: pos.motionStatus,
        satellites: pos.satelliteCount,
        external_power: pos.externalPower,
      },
    };

    // Update odometer if valid and greater than zero
    if (pos.odometerKm != null && pos.odometerKm > 0) {
      updatePayload.current_odometer_km = pos.odometerKm;
    }

    await this.supabase.from("machines").update(updatePayload).eq("id", pos.vehicleId);

    // Update device last communication time
    await this.supabase
      .from("gps_devices")
      .update({ last_communication_at: pos.recordedAt, status: "active" })
      .eq("id", pos.deviceId);
  }

  private async flushPositionsBatch() {
    if (this.positionBatch.length === 0) return;
    const batch = [...this.positionBatch];
    this.positionBatch = [];

    try {
      const { error } = await this.supabase.from("vehicle_positions").insert(batch);
      if (error) {
        console.error("[SyncEngine] Error flushing vehicle_positions batch:", error.message);
      }
    } catch (err: any) {
      console.error("[SyncEngine] Failed to write positions batch:", err.message);
    }
  }

  public stop() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushPositionsBatch();
  }
}
