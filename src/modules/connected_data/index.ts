/**
 * MachineCare Connected Data (IoT & Telemetry) Domain Module
 */

export interface TelemetryPoint {
  id: string;
  device_id: string;
  asset_id?: string;
  metric_name: string;
  metric_value: number;
  unit: string;
  timestamp: string;
}

export interface ConnectedDevice {
  id: string;
  device_code: string;
  name: string;
  asset_id?: string;
  device_type: "gateway" | "sensor" | "plc" | "scada" | "meter";
  status: "ONLINE" | "OFFLINE" | "DEGRADED";
  ip_address?: string;
  last_heartbeat: string;
}

export interface ConnectedDataSource {
  id: string;
  name: string;
  source_type: "MQTT" | "OPC_UA" | "MODBUS" | "REST_API" | "DATABASE";
  endpoint_url: string;
  status: "CONNECTED" | "ERROR" | "PAUSED";
  records_per_minute: number;
}

export interface DataQualityRecord {
  id: string;
  source_id: string;
  completeness_pct: number;
  latency_ms: number;
  error_rate_pct: number;
  evaluated_at: string;
}
