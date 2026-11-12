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
  private retryQueue: any[] = []; // In-memory resilient buffer for Supabase write failures
  private readonly maxRetryBufferSize: number = 5000;
  private retryDelayMs: number = 1000;
  private isFlushing: boolean = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private offlineCheckTimer: NodeJS.Timeout | null = null;

  // Deduplication suppression set: "vehicleId:recordedAt"
  private recentPingsCache: Set<string> = new Set();
  private readonly maxCacheEntries: number = 10000;

  // Rate limiter for unmapped device logging
  private unmappedImeiLogTime: Map<string, number> = new Map();

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

    // Periodic check for devices offline > 24 hours (runs every 15 minutes)
    this.offlineCheckTimer = setInterval(() => {
      this.checkOfflineDevices();
    }, 15 * 60 * 1000);

    // Run first offline check shortly after startup
    setTimeout(() => {
      this.checkOfflineDevices();
    }, 10000);
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
   * Process a burst batch of positions (e.g. after GSM network reconnection)
   * Sorted strictly by recorded_at ascending so chronological transitions are preserved.
   */
  public async processPositionsBatch(positions: TraccarPosition[], explicitImei?: string) {
    if (!positions || positions.length === 0) return;

    // Chronological sort: earlier satellite timestamp first
    const sorted = [...positions].sort((a, b) => {
      const tA = new Date(a.deviceTime || a.fixTime).getTime();
      const tB = new Date(b.deviceTime || b.fixTime).getTime();
      return tA - tB;
    });

    for (const pos of sorted) {
      await this.processPosition(pos, explicitImei);
    }
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
      // Diagnostic logging for unmapped device (rate-limited to once every 10 mins)
      const imeiKey = explicitImei || `traccarId:${pos.deviceId}`;
      const lastLogged = this.unmappedImeiLogTime.get(imeiKey) || 0;
      if (Date.now() - lastLogged > 10 * 60 * 1000) {
        console.warn(`[SyncEngine] Position received from unmapped device (${imeiKey}). Device not assigned to any vehicle.`);
        this.unmappedImeiLogTime.set(imeiKey, Date.now());
      }
      return;
    }

    // Duplicate Ping Suppression: discard duplicate packets retransmitted by hardware
    const recordedTimestamp = pos.deviceTime || pos.fixTime;
    const dedupeKey = `${mapping.vehicleId}:${recordedTimestamp}`;
    if (this.recentPingsCache.has(dedupeKey)) {
      return; // Duplicate ping ignored
    }
    this.recentPingsCache.add(dedupeKey);
    if (this.recentPingsCache.size > this.maxCacheEntries) {
      // Clean oldest 2,000 entries
      const iter = this.recentPingsCache.values();
      for (let i = 0; i < 2000; i++) {
        const next = iter.next();
        if (!next.done) this.recentPingsCache.delete(next.value);
      }
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
      recorded_at: normalized.recordedAt, // Preserved satellite fix timestamp
      received_at: normalized.receivedAt, // Ingestion timestamp
      raw_attributes: normalized.rawAttributes,
    });

    if (this.positionBatch.length >= config.telematics.maxBatchSize) {
      this.flushPositionsBatch();
    }

    // 3. Evaluate alerts (overspeed, geofences, power cut, low battery)
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

  /**
   * Resilient batch flush with in-memory retry buffer
   * Prevents silent telemetry loss during Supabase maintenance or network glitches.
   */
  private async flushPositionsBatch() {
    if (this.isFlushing) return;
    if (this.positionBatch.length === 0 && this.retryQueue.length === 0) return;

    this.isFlushing = true;

    // Build batch prioritizing retryQueue items first
    const batch: any[] = [];
    while (this.retryQueue.length > 0 && batch.length < config.telematics.maxBatchSize) {
      batch.push(this.retryQueue.shift());
    }

    while (this.positionBatch.length > 0 && batch.length < config.telematics.maxBatchSize) {
      batch.push(this.positionBatch.shift());
    }

    if (batch.length === 0) {
      this.isFlushing = false;
      return;
    }

    try {
      const { error } = await this.supabase.from("vehicle_positions").insert(batch);
      if (error) {
        throw error;
      }
      // Success: reset retry backoff
      this.retryDelayMs = 1000;
    } catch (err: any) {
      console.error(
        `[SyncEngine] Supabase write failed (${err.message}). Buffering ${batch.length} positions in retry queue.`
      );

      // Re-queue items back to retry buffer (capping at max buffer size)
      this.retryQueue.unshift(...batch);
      if (this.retryQueue.length > this.maxRetryBufferSize) {
        console.warn(`[SyncEngine] Retry buffer full (${this.retryQueue.length}). Dropping oldest records.`);
        this.retryQueue.splice(0, this.retryQueue.length - this.maxRetryBufferSize);
      }

      // Exponential backoff up to 30s
      this.retryDelayMs = Math.min(this.retryDelayMs * 2, 30000);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Detects devices that have not communicated for > 24 hours and creates alerts
   */
  public async checkOfflineDevices(thresholdHours: number = 24) {
    try {
      const cutoff = new Date(Date.now() - thresholdHours * 60 * 60 * 1000).toISOString();

      const { data: offlineDevices, error } = await this.supabase
        .from("gps_devices")
        .select(`
          id,
          imei,
          name,
          organisation_id,
          last_communication_at,
          vehicle_gps_assignments!inner(
            vehicle_id,
            status,
            vehicle:machines(id, name, plate_number)
          )
        `)
        .eq("vehicle_gps_assignments.status", "active")
        .or(`last_communication_at.lt.${cutoff},last_communication_at.is.null`)
        .neq("status", "offline");

      if (error) {
        console.error("[SyncEngine] Error querying offline devices:", error.message);
        return;
      }

      for (const dev of offlineDevices || []) {
        // Mark device as offline
        await this.supabase.from("gps_devices").update({ status: "offline" }).eq("id", dev.id);

        const assignment = (dev as any).vehicle_gps_assignments?.[0];
        const vehicle = assignment?.vehicle;
        const vehicleLabel = vehicle ? `${vehicle.name} (${vehicle.plate_number || "No Plate"})` : "Vehicle";

        // Insert warning alert
        await this.supabase.from("gps_alerts").insert({
          organisation_id: dev.organisation_id,
          vehicle_id: assignment?.vehicle_id,
          device_id: dev.id,
          alert_type: "device_offline",
          severity: "warning",
          title: `GPS Tracker Offline > ${thresholdHours} Hours`,
          message: `Tracker ${dev.imei} on ${vehicleLabel} has not transmitted a telematics ping in over ${thresholdHours} hours. Verify power and SIM network.`,
          event_time: new Date().toISOString(),
        });

        console.log(`[SyncEngine] Device ${dev.imei} flagged as offline (>24h). Alert generated.`);
      }
    } catch (err: any) {
      console.error("[SyncEngine] checkOfflineDevices error:", err.message);
    }
  }

  public stop() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.offlineCheckTimer) clearInterval(this.offlineCheckTimer);
    this.flushPositionsBatch();
  }
}
