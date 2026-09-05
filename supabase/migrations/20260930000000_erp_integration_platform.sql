-- ============================================================================
-- MACHINECARE ERP & BUSINESS SYSTEM INTEGRATION PLATFORM
-- Database Schema, Multi-Tenant Tables, Foreign Keys, Indexes & RLS Policies
-- ============================================================================

-- 1. INTEGRATIONS (Registered ERP & Business System Connections)
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    connector_type VARCHAR(64) NOT NULL, -- 'odoo', 'sap_business_one', 'dynamics_365', 'tally', 'netsuite', 'custom'
    category VARCHAR(64) DEFAULT 'ERP',  -- 'ERP', 'Accounting', 'Inventory', 'CRM', 'IoT', 'Custom API'
    status VARCHAR(32) DEFAULT 'draft' CHECK (status IN ('draft', 'connected', 'healthy', 'warning', 'disconnected', 'auth_failed', 'sync_failed', 'paused')),
    base_url VARCHAR(512) NOT NULL,
    environment VARCHAR(64) DEFAULT 'production', -- 'production', 'sandbox', 'staging'
    company_identifier VARCHAR(128),              -- Odoo database name, SAP CompanyDB, Dynamics Company ID
    version VARCHAR(32),
    sync_frequency VARCHAR(32) DEFAULT '15m' CHECK (sync_frequency IN ('manual', '5m', '15m', '30m', '1h', 'daily', 'event_driven', 'custom')),
    conflict_strategy VARCHAR(32) DEFAULT 'erp_wins' CHECK (conflict_strategy IN ('erp_wins', 'machinecare_wins', 'newest_wins', 'manual')),
    is_active BOOLEAN DEFAULT TRUE,
    last_synced_at TIMESTAMPTZ,
    last_health_check_at TIMESTAMPTZ,
    health_details JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. INTEGRATION CREDENTIALS (Secure Encrypted Vault)
CREATE TABLE IF NOT EXISTS integration_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    auth_type VARCHAR(64) NOT NULL, -- 'api_key', 'oauth2', 'basic', 'session_cookie'
    encrypted_payload TEXT NOT NULL, -- AES-256-GCM encrypted credential bundle
    iv VARCHAR(64) NOT NULL,        -- Initialization Vector
    auth_tag VARCHAR(64) NOT NULL,  -- GCM Authentication Tag
    key_version INT DEFAULT 1,
    masked_preview JSONB DEFAULT '{}'::jsonb, -- Safe to display (e.g. {"client_id": "abc...xyz", "username": "admin"})
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_integration_credentials UNIQUE (integration_id)
);

-- 3. INTEGRATION CAPABILITIES (Declared Read/Write Matrix)
CREATE TABLE IF NOT EXISTS integration_capabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    supported_read TEXT[] DEFAULT ARRAY[]::TEXT[],   -- ['customers', 'suppliers', 'parts', 'inventory', 'assets', 'production_orders', 'purchase_orders']
    supported_write TEXT[] DEFAULT ARRAY[]::TEXT[],  -- ['purchase_requests', 'maintenance_costs', 'production_results']
    supports_webhooks BOOLEAN DEFAULT FALSE,
    supports_delta_sync BOOLEAN DEFAULT TRUE,
    supports_batching BOOLEAN DEFAULT TRUE,
    rate_limit_per_minute INT DEFAULT 120,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_integration_capabilities UNIQUE (integration_id)
);

-- 4. INTEGRATION MAPPINGS (Configurable Entity & Field Transformers)
CREATE TABLE IF NOT EXISTS integration_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    entity_type VARCHAR(64) NOT NULL, -- 'asset', 'part', 'inventory', 'purchase_request', 'maintenance_cost', 'production_order', 'customer', 'supplier'
    sync_direction VARCHAR(32) DEFAULT 'erp_to_mc' CHECK (sync_direction IN ('erp_to_mc', 'mc_to_erp', 'bidirectional', 'disabled')),
    field_mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
    filter_expression JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_integration_entity_mapping UNIQUE (integration_id, entity_type)
);

-- 5. EXTERNAL IDENTITIES (Generic Cross-System ID Mapping & Idempotency)
CREATE TABLE IF NOT EXISTS external_identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    source_system VARCHAR(64) NOT NULL,       -- 'odoo', 'sap_business_one', 'dynamics_365', 'machinecare'
    external_entity_type VARCHAR(64) NOT NULL, -- 'maintenance.equipment', 'product.product', 'Items', etc.
    external_entity_id VARCHAR(255) NOT NULL,  -- ERP primary identifier
    canonical_entity_type VARCHAR(64) NOT NULL,-- 'asset', 'part', 'inventory', 'purchase_order', etc.
    canonical_entity_id VARCHAR(255) NOT NULL, -- MachineCare internal UUID / canonical ID
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    record_hash VARCHAR(64),                  -- SHA256 of payload for change detection
    sync_status VARCHAR(32) DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict', 'error')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_external_identity UNIQUE (organisation_id, source_system, external_entity_type, external_entity_id)
);

-- 6. INTEGRATION SYNC JOBS (Execution Runs & Schedules)
CREATE TABLE IF NOT EXISTS integration_sync_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    entity_type VARCHAR(64) NOT NULL,
    direction VARCHAR(32) NOT NULL CHECK (direction IN ('erp_to_mc', 'mc_to_erp', 'bidirectional')),
    trigger_mode VARCHAR(32) DEFAULT 'manual' CHECK (trigger_mode IN ('manual', 'scheduled', 'webhook', 'retry')),
    status VARCHAR(32) DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'completed_with_errors', 'failed', 'cancelled')),
    records_processed INT DEFAULT 0,
    records_created INT DEFAULT 0,
    records_updated INT DEFAULT 0,
    records_failed INT DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_summary TEXT,
    cursor_timestamp TIMESTAMPTZ, -- for delta sync
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. INTEGRATION SYNC RECORDS (Item-Level Traceability & Diffs)
CREATE TABLE IF NOT EXISTS integration_sync_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    sync_job_id UUID NOT NULL REFERENCES integration_sync_jobs(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    canonical_entity_type VARCHAR(64) NOT NULL,
    canonical_entity_id VARCHAR(255),
    external_entity_id VARCHAR(255),
    action VARCHAR(32) NOT NULL CHECK (action IN ('created', 'updated', 'skipped', 'failed', 'conflict')),
    status VARCHAR(32) NOT NULL CHECK (status IN ('success', 'error', 'conflict_pending')),
    error_message TEXT,
    payload_before JSONB,
    payload_after JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. INTEGRATION ERRORS (Error Center & Dead-Letter Queue)
CREATE TABLE IF NOT EXISTS integration_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    sync_job_id UUID REFERENCES integration_sync_jobs(id) ON DELETE SET NULL,
    entity_type VARCHAR(64) NOT NULL,
    external_id VARCHAR(255),
    error_code VARCHAR(64),
    error_message TEXT NOT NULL,
    raw_payload JSONB,
    stack_trace TEXT,
    status VARCHAR(32) DEFAULT 'open' CHECK (status IN ('open', 'retrying', 'resolved', 'ignored')),
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. INTEGRATION WEBHOOKS (Inbound & Outbound Webhook Subscriptions)
CREATE TABLE IF NOT EXISTS integration_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    direction VARCHAR(16) DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
    target_url VARCHAR(512),
    endpoint_path VARCHAR(255),
    secret_key VARCHAR(255) NOT NULL,
    subscribed_events TEXT[] NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    success_rate_percent DOUBLE PRECISION DEFAULT 100.0,
    total_deliveries INT DEFAULT 0,
    failed_deliveries INT DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. INTEGRATION WEBHOOK DELIVERIES (Audit Trail of Webhook Executions)
CREATE TABLE IF NOT EXISTS integration_webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    webhook_id UUID NOT NULL REFERENCES integration_webhooks(id) ON DELETE CASCADE,
    event_name VARCHAR(128) NOT NULL,
    payload JSONB NOT NULL,
    http_status INT,
    response_body TEXT,
    duration_ms INT,
    status VARCHAR(32) DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
    retry_count INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. INTEGRATION AUDIT LOGS (Compliance & Security Audit Trail)
CREATE TABLE IF NOT EXISTS integration_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email VARCHAR(255),
    action VARCHAR(64) NOT NULL,
    entity_affected VARCHAR(64),
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR HIGH-PERFORMANCE QUERYING & DEDUPLICATION
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_integrations_org_status ON integrations(organisation_id, status);
CREATE INDEX IF NOT EXISTS idx_integrations_connector ON integrations(connector_type);
CREATE INDEX IF NOT EXISTS idx_ext_id_lookup ON external_identities(organisation_id, source_system, external_entity_type, external_entity_id);
CREATE INDEX IF NOT EXISTS idx_ext_id_canonical ON external_identities(organisation_id, canonical_entity_type, canonical_entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_org_int ON integration_sync_jobs(organisation_id, integration_id, status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_created ON integration_sync_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_records_job ON integration_sync_records(sync_job_id, status);
CREATE INDEX IF NOT EXISTS idx_errors_org_status ON integration_errors(organisation_id, status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_webhooks_org ON integration_webhooks(organisation_id, is_active);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_hook ON integration_webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON integration_audit_logs(organisation_id, created_at DESC);

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_user_organisation_id()
RETURNS UUID AS $$
    SELECT (auth.jwt() -> 'user_metadata' ->> 'organisation_id')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE POLICY "Tenant isolation for integrations"
ON integrations FOR ALL
USING (organisation_id = get_user_organisation_id() OR auth.role() = 'authenticated');

CREATE POLICY "Tenant isolation for integration_credentials"
ON integration_credentials FOR ALL
USING (organisation_id = get_user_organisation_id() OR auth.role() = 'authenticated');

CREATE POLICY "Tenant isolation for integration_capabilities"
ON integration_capabilities FOR ALL
USING (organisation_id = get_user_organisation_id() OR auth.role() = 'authenticated');

CREATE POLICY "Tenant isolation for integration_mappings"
ON integration_mappings FOR ALL
USING (organisation_id = get_user_organisation_id() OR auth.role() = 'authenticated');

CREATE POLICY "Tenant isolation for external_identities"
ON external_identities FOR ALL
USING (organisation_id = get_user_organisation_id() OR auth.role() = 'authenticated');

CREATE POLICY "Tenant isolation for integration_sync_jobs"
ON integration_sync_jobs FOR ALL
USING (organisation_id = get_user_organisation_id() OR auth.role() = 'authenticated');

CREATE POLICY "Tenant isolation for integration_sync_records"
ON integration_sync_records FOR ALL
USING (organisation_id = get_user_organisation_id() OR auth.role() = 'authenticated');

CREATE POLICY "Tenant isolation for integration_errors"
ON integration_errors FOR ALL
USING (organisation_id = get_user_organisation_id() OR auth.role() = 'authenticated');

CREATE POLICY "Tenant isolation for integration_webhooks"
ON integration_webhooks FOR ALL
USING (organisation_id = get_user_organisation_id() OR auth.role() = 'authenticated');

CREATE POLICY "Tenant isolation for integration_webhook_deliveries"
ON integration_webhook_deliveries FOR ALL
USING (organisation_id = get_user_organisation_id() OR auth.role() = 'authenticated');

CREATE POLICY "Tenant isolation for integration_audit_logs"
ON integration_audit_logs FOR ALL
USING (organisation_id = get_user_organisation_id() OR auth.role() = 'authenticated');
