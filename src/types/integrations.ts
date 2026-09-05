/**
 * MachineCare ERP Integration Platform - TypeScript Interfaces
 */

export type IntegrationStatus =
  | 'draft'
  | 'connected'
  | 'healthy'
  | 'warning'
  | 'disconnected'
  | 'auth_failed'
  | 'sync_failed'
  | 'paused'
  | 'coming_soon';

export type IntegrationCategory =
  | 'All'
  | 'ERP'
  | 'EAM'
  | 'Accounting'
  | 'Inventory'
  | 'Procurement'
  | 'CRM'
  | 'IoT'
  | 'Analytics'
  | 'Custom API';

export type SyncFrequency = 'manual' | '5m' | '15m' | '30m' | '1h' | 'daily' | 'event_driven';

export type ConflictStrategy = 'erp_wins' | 'machinecare_wins' | 'newest_wins' | 'manual';

export type SyncDirection = 'erp_to_mc' | 'mc_to_erp' | 'bidirectional' | 'disabled';

export type TransformType =
  | 'direct'
  | 'rename'
  | 'constant'
  | 'lookup'
  | 'formula'
  | 'enum_map'
  | 'unit_convert'
  | 'custom';

export interface FieldMappingRule {
  source_field: string;
  target_field: string;
  transform_type: TransformType;
  transform_config?: Record<string, any>;
  default_value?: any;
  is_required?: boolean;
}

export interface ConnectorCatalogItem {
  slug: string;
  name: string;
  category: string;
  description: string;
  version: string;
  status: 'available' | 'coming_soon';
  logo: string;
  docs_url: string;
  config_fields: { key: string; label: string; type: string; placeholder?: string; required: boolean }[];
  credential_fields: { key: string; label: string; type: string; placeholder?: string; required: boolean }[];
  capabilities: {
    read: string[];
    write: string[];
    supports_webhooks?: boolean;
    supports_delta_sync?: boolean;
  };
  default_mappings?: Record<string, FieldMappingRule[]>;
  last_updated?: string;
}

export interface ConnectedIntegration {
  id: string;
  organisation_id: string;
  name: string;
  connector_type: string;
  category: string;
  status: IntegrationStatus;
  base_url: string;
  environment: string;
  company_identifier: string;
  version: string;
  sync_frequency: SyncFrequency;
  conflict_strategy: ConflictStrategy;
  is_active: boolean;
  last_synced_at?: string;
  last_health_check_at?: string;
  health_details?: {
    latency_ms?: number;
    api_health?: 'healthy' | 'warning' | 'error';
    sync_health?: 'healthy' | 'warning' | 'error';
    server_version?: string;
    synced_records_count?: {
      assets?: number;
      parts?: number;
      inventory?: number;
      orders?: number;
    };
  };
  credentials_preview?: Record<string, string>;
  created_at: string;
}

export interface SyncJobRecord {
  id: string;
  integration_id: string;
  integration_name: string;
  connector_type: string;
  entity_type: string;
  direction: SyncDirection;
  status: 'queued' | 'running' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled';
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  started_at: string;
  completed_at?: string;
  error_summary?: string;
}

export interface IntegrationErrorItem {
  id: string;
  integration_id: string;
  integration_name: string;
  connector_type: string;
  entity_type: string;
  external_id: string;
  error_code: string;
  error_message: string;
  raw_payload?: Record<string, any>;
  status: 'open' | 'retrying' | 'resolved' | 'dead_letter';
  retry_count: number;
  max_retries: number;
  created_at: string;
  next_retry_at?: string;
  resolution_notes?: string;
}

export interface WebhookItem {
  id: string;
  integration_id?: string;
  name: string;
  direction: 'inbound' | 'outbound';
  target_url?: string;
  endpoint_path?: string;
  secret_key: string;
  subscribed_events: string[];
  is_active: boolean;
  success_rate_percent: number;
  total_deliveries: number;
  failed_deliveries: number;
  last_triggered_at?: string;
  created_at: string;
}

export interface WebhookDeliveryLog {
  id: string;
  webhook_id: string;
  event_name: string;
  status: 'delivered' | 'failed' | 'retrying';
  http_status?: number;
  duration_ms?: number;
  retry_count: number;
  error_message?: string;
  timestamp: string;
  payload: Record<string, any>;
}
