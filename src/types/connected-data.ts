export type DeviceType =
  | "IoT Gateway"
  | "GPS/Telematics"
  | "CAN Gateway"
  | "PLC Gateway"
  | "Industrial Sensor"
  | "Edge Controller"
  | "Modbus Bridge";

export type ConnectionStatus = "ONLINE" | "OFFLINE" | "WARNING" | "NEVER_CONNECTED";

export type ProtocolType =
  | "CAN"
  | "J1939"
  | "Modbus"
  | "OPC-UA"
  | "PLC"
  | "MQTT"
  | "HTTP"
  | "REST API"
  | "Webhooks"
  | "GPS"
  | "Digital Input"
  | "Analog Input"
  | "Sensors"
  | "CSV"
  | "Excel"
  | "Manual Data";

export type QualityState = "GOOD" | "WARNING" | "DELAYED" | "MISSING" | "INVALID";

export type SeverityLevel = "CRITICAL" | "WARNING" | "INFO";

export type EventStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";

export type ApiScope =
  | "assets:read"
  | "devices:read"
  | "telemetry:read"
  | "events:read"
  | "alerts:read"
  | "sites:read"
  | "customers:read";

export interface ConnectedCustomer {
  id: string;
  name: string;
  code: string;
  industry: string;
  contact_person: string;
  email: string;
  phone: string;
  status: "ACTIVE" | "INACTIVE";
  site_count: number;
  asset_count: number;
  device_count: number;
  created_at: string;
}

export interface ConnectedSite {
  id: string;
  customer_id: string;
  customer_name: string;
  name: string;
  code: string;
  location: string;
  coordinates: string;
  asset_count: number;
  active_device_count: number;
  status: "OPERATIONAL" | "WARNING" | "OFFLINE";
  created_at: string;
}

export interface ConnectedAsset {
  id: string;
  asset_code: string;
  name: string;
  type: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  customer_id: string;
  customer_name: string;
  site_id: string;
  site_name: string;
  installation_date: string;
  status: "CONNECTED" | "OFFLINE" | "DEGRADED";
  description: string;
  device_id: string;
  device_name: string;
  device_type: DeviceType;
  connectivity_status: ConnectionStatus;
  last_communication: string;
  protocol: ProtocolType;
  parameter_count: number;
  data_frequency_sec: number;
  data_quality_percent: number;
  last_data_point: string;
}

export interface ConnectedDevice {
  id: string;
  device_id: string;
  name: string;
  imei: string;
  serial_number: string;
  manufacturer: string;
  model: string;
  firmware_version: string;
  device_type: DeviceType;
  protocol: ProtocolType;
  assigned_asset_id: string | null;
  assigned_asset_name: string | null;
  assigned_site_id: string | null;
  assigned_site_name: string | null;
  installation_date: string;
  last_seen: string;
  connection_status: ConnectionStatus;
  signal_strength_dbm: number;
  battery_percent: number | null;
  ip_address: string;
  configuration_json: string;
}

export interface ConnectedDataSource {
  id: string;
  asset_id: string;
  asset_name: string;
  source_name: string;
  protocol: ProtocolType;
  status: "ACTIVE" | "INACTIVE" | "ERROR";
  parameters_count: number;
  polling_interval_sec: number;
  last_sync: string;
  endpoint_or_channel: string;
}

export interface MachineDataParameter {
  id: string;
  standard_key: string;
  parameter_name: string;
  display_name: string;
  unit: string;
  data_type: "numeric" | "boolean" | "string" | "enum";
  category: "Engine" | "Electrical" | "Fluid" | "Environmental" | "Vibration" | "Operational";
  min_value: number | null;
  max_value: number | null;
  expected_frequency_sec: number;
  description: string;
  raw_mapping_keys: string[];
  quality_rules: string;
}

export interface TelemetryPoint {
  timestamp: string;
  asset_id: string;
  asset_name: string;
  parameter_key: string;
  display_name: string;
  value: number | string;
  unit: string;
  quality_state: QualityState;
  raw_key?: string;
}

export interface DataQualityRecord {
  id: string;
  asset_id: string;
  asset_name: string;
  parameter_key: string;
  parameter_name: string;
  quality_state: QualityState;
  missing_count_24h: number;
  delayed_count_24h: number;
  invalid_count_24h: number;
  stale_seconds: number;
  quality_score_percent: number;
  last_checked: string;
}

export interface ConnectedEvent {
  id: string;
  event_code: string;
  asset_id: string;
  asset_name: string;
  customer_name: string;
  site_name: string;
  parameter_key: string;
  parameter_name: string;
  triggered_value: string;
  threshold: string;
  timestamp: string;
  severity: SeverityLevel;
  status: EventStatus;
  description: string;
  source_rule_name: string;
}

export interface EventRule {
  id: string;
  name: string;
  asset_id: string | "ALL";
  asset_name: string;
  parameter_key: string;
  operator: ">" | "<" | "=" | ">=" | "<=" | "rate_of_change" | "missing_data" | "device_offline";
  threshold: number;
  unit: string;
  duration_minutes: number;
  logical_operator?: "AND" | "OR";
  secondary_rule_id?: string;
  actions: {
    create_event: boolean;
    send_email: boolean;
    send_notification: boolean;
    trigger_webhook: boolean;
    create_work_order: boolean;
  };
  active: boolean;
  created_at: string;
}

export interface ConnectedApiKey {
  id: string;
  name: string;
  key_prefix: string;
  full_key?: string;
  customer_id: string;
  customer_name: string;
  scopes: ApiScope[];
  created_at: string;
  expires_at: string;
  last_used_at: string;
  status: "ACTIVE" | "REVOKED";
}

export interface ConnectedWebhook {
  id: string;
  name: string;
  target_url: string;
  events_subscribed: string[];
  secret: string;
  status: "ACTIVE" | "FAILING" | "PAUSED";
  total_deliveries: number;
  failed_deliveries: number;
  last_delivery_at: string;
}

export interface AvailabilityReportRecord {
  asset_id: string;
  asset_name: string;
  customer_name: string;
  site_name: string;
  expected_datapoints_24h: number;
  received_datapoints_24h: number;
  availability_percent: number;
  uptime_hours: number;
  offline_hours: number;
  network_quality_score: number;
}
