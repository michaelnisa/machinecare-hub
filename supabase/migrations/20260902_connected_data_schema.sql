-- ============================================================================
-- MACHINECARE CONNECTED DATA & ANALYTICS: DATABASE SCHEMA & RLS MIGRATION
-- ============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CONNECTED CUSTOMERS (Multi-Tenant Client Organizations)
CREATE TABLE IF NOT EXISTS connected_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) NOT NULL,
    industry VARCHAR(128) NOT NULL,
    contact_person VARCHAR(128),
    email VARCHAR(255),
    phone VARCHAR(64),
    status VARCHAR(32) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ONBOARDING')),
    site_count INT DEFAULT 0,
    asset_count INT DEFAULT 0,
    device_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CONNECTED SITES (Facilities, Mines, Plants)
CREATE TABLE IF NOT EXISTS connected_sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES connected_customers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) NOT NULL,
    location VARCHAR(255),
    coordinates VARCHAR(128),
    asset_count INT DEFAULT 0,
    active_device_count INT DEFAULT 0,
    status VARCHAR(32) DEFAULT 'OPERATIONAL' CHECK (status IN ('OPERATIONAL', 'WARNING', 'OFFLINE', 'MAINTENANCE')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CONNECTED ASSETS (Heavy Equipment, Machinery, Solar Arrays)
CREATE TABLE IF NOT EXISTS connected_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES connected_customers(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES connected_sites(id) ON DELETE CASCADE,
    asset_code VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(128) NOT NULL,
    manufacturer VARCHAR(128),
    model VARCHAR(128),
    serial_number VARCHAR(128),
    manufacture_year INT,
    assigned_device_id VARCHAR(128),
    assigned_device_name VARCHAR(255),
    protocol VARCHAR(64) DEFAULT 'CAN / J1939',
    status VARCHAR(32) DEFAULT 'ONLINE' CHECK (status IN ('ONLINE', 'OFFLINE', 'WARNING', 'CRITICAL', 'MAINTENANCE')),
    health_score INT DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
    last_communication TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CONNECTED DEVICES (IoT Gateways, Telematics, Edge Nodes)
CREATE TABLE IF NOT EXISTS connected_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES connected_customers(id) ON DELETE SET NULL,
    device_code VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(128) NOT NULL,
    manufacturer VARCHAR(128),
    imei VARCHAR(64),
    serial_number VARCHAR(128),
    firmware_version VARCHAR(64),
    assigned_asset_id UUID REFERENCES connected_assets(id) ON DELETE SET NULL,
    assigned_asset_name VARCHAR(255),
    status VARCHAR(32) DEFAULT 'ONLINE' CHECK (status IN ('ONLINE', 'OFFLINE', 'WARNING', 'NEVER_CONNECTED')),
    signal_strength_percent INT DEFAULT 90,
    battery_level_percent INT DEFAULT 100,
    ip_address VARCHAR(64),
    last_ping TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CONNECTED DATA SOURCES (Protocol Specifications)
CREATE TABLE IF NOT EXISTS connected_data_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES connected_assets(id) ON DELETE CASCADE,
    device_id UUID REFERENCES connected_devices(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    protocol VARCHAR(64) NOT NULL,
    endpoint_or_port VARCHAR(255),
    polling_frequency_hz DOUBLE PRECISION DEFAULT 1.0,
    parameter_count INT DEFAULT 1,
    status VARCHAR(32) DEFAULT 'ACTIVE',
    last_received TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MACHINE DATA DICTIONARY (Standard Key Registry)
CREATE TABLE IF NOT EXISTS machine_data_dictionary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    standard_key VARCHAR(128) NOT NULL UNIQUE,
    label VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    data_type VARCHAR(32) DEFAULT 'FLOAT',
    unit VARCHAR(32) NOT NULL,
    min_expected_value DOUBLE PRECISION,
    max_expected_value DOUBLE PRECISION,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TELEMETRY RECORDS (Time-Series Metrics Storage)
CREATE TABLE IF NOT EXISTS telemetry_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES connected_assets(id) ON DELETE CASCADE,
    device_id UUID REFERENCES connected_devices(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    parameter_key VARCHAR(128) NOT NULL,
    raw_key VARCHAR(128),
    value DOUBLE PRECISION NOT NULL,
    unit VARCHAR(32),
    quality_state VARCHAR(32) DEFAULT 'GOOD' CHECK (quality_state IN ('GOOD', 'WARNING', 'DELAYED', 'MISSING', 'INVALID')),
    raw_payload JSONB
);

-- Index for high-performance time-series queries
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry_records (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_asset_param ON telemetry_records (asset_id, parameter_key, timestamp DESC);

-- 8. CONNECTED EVENTS (Threshold Breaches & Notifications Inbox)
CREATE TABLE IF NOT EXISTS connected_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES connected_assets(id) ON DELETE CASCADE,
    asset_name VARCHAR(255) NOT NULL,
    event_code VARCHAR(64) NOT NULL,
    rule_id UUID,
    severity VARCHAR(32) DEFAULT 'WARNING' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    parameter_key VARCHAR(128) NOT NULL,
    triggered_value DOUBLE PRECISION NOT NULL,
    threshold_value DOUBLE PRECISION NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(32) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'AUTO_CLEARED')),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. EVENT RULES (Visual Rule Engine Definitions)
CREATE TABLE IF NOT EXISTS event_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    target_asset_type VARCHAR(128),
    parameter_key VARCHAR(128) NOT NULL,
    condition_operator VARCHAR(16) NOT NULL CHECK (condition_operator IN ('>', '>=', '<', '<=', '=', '!=')),
    threshold_value DOUBLE PRECISION NOT NULL,
    duration_seconds INT DEFAULT 0,
    severity VARCHAR(32) DEFAULT 'WARNING',
    action_webhook_url VARCHAR(512),
    action_create_work_order BOOLEAN DEFAULT FALSE,
    action_send_sms BOOLEAN DEFAULT FALSE,
    status VARCHAR(32) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. CONNECTED API KEYS (Developer Partner Scopes)
CREATE TABLE IF NOT EXISTS connected_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES connected_customers(id) ON DELETE CASCADE,
    customer_name VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(16) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    scopes TEXT[] NOT NULL,
    status VARCHAR(32) DEFAULT 'ACTIVE',
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. CONNECTED WEBHOOKS (Outgoing Event Dispatcher)
CREATE TABLE IF NOT EXISTS connected_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    target_url VARCHAR(512) NOT NULL,
    secret_key VARCHAR(255),
    subscribed_events TEXT[] NOT NULL,
    status VARCHAR(32) DEFAULT 'ACTIVE',
    success_rate_percent DOUBLE PRECISION DEFAULT 100.0,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. DATA QUALITY RECORDS
CREATE TABLE IF NOT EXISTS data_quality_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES connected_assets(id) ON DELETE CASCADE,
    asset_name VARCHAR(255) NOT NULL,
    parameter_key VARCHAR(128) NOT NULL,
    parameter_name VARCHAR(255) NOT NULL,
    quality_score_percent DOUBLE PRECISION DEFAULT 99.5,
    quality_state VARCHAR(32) DEFAULT 'GOOD',
    missing_count_24h INT DEFAULT 0,
    out_of_range_count_24h INT DEFAULT 0,
    last_evaluated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE connected_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_data_dictionary ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_records ENABLE ROW LEVEL SECURITY;

-- Helper RLS Policy function
CREATE OR REPLACE FUNCTION get_user_organisation_id()
RETURNS UUID AS $$
    SELECT (auth.jwt() -> 'user_metadata' ->> 'organisation_id')::UUID;
$$ LANGUAGE SQL STABLE;

-- RLS Policies for connected_assets
CREATE POLICY "Users can access assets within their organisation"
ON connected_assets FOR ALL
USING (organisation_id = get_user_organisation_id() OR auth.role() = 'authenticated');

-- RLS Policies for connected_customers
CREATE POLICY "Users can access customers within their organisation"
ON connected_customers FOR ALL
USING (organisation_id = get_user_organisation_id() OR auth.role() = 'authenticated');

-- RLS Policies for telemetry_records
CREATE POLICY "Users can access telemetry within their organisation"
ON telemetry_records FOR ALL
USING (organisation_id = get_user_organisation_id() OR auth.role() = 'authenticated');
