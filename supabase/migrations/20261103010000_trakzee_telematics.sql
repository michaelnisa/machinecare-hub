-- Migration: Add Trakzee Telematics and GPS tracking configuration
-- Supports Logistixwave Tanzania Limited and other fleet organizations

-- 1. Organization-level Trakzee Telematics configuration
ALTER TABLE public.organisations 
ADD COLUMN IF NOT EXISTS trakzee_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS trakzee_server_url text DEFAULT 'https://trakzee.uffizio.com/webservice',
ADD COLUMN IF NOT EXISTS trakzee_username text,
ADD COLUMN IF NOT EXISTS trakzee_password text,
ADD COLUMN IF NOT EXISTS trakzee_company_name text,
ADD COLUMN IF NOT EXISTS trakzee_project_id text DEFAULT '37',
ADD COLUMN IF NOT EXISTS trakzee_last_synced_at timestamptz;

-- 2. Vehicle telematics columns on machines
ALTER TABLE public.machines
ADD COLUMN IF NOT EXISTS telematics_imei text,
ADD COLUMN IF NOT EXISTS telematics_speed numeric,
ADD COLUMN IF NOT EXISTS telematics_ignition boolean,
ADD COLUMN IF NOT EXISTS telematics_battery_volt numeric,
ADD COLUMN IF NOT EXISTS telematics_latitude numeric,
ADD COLUMN IF NOT EXISTS telematics_longitude numeric,
ADD COLUMN IF NOT EXISTS telematics_last_at timestamptz,
ADD COLUMN IF NOT EXISTS telematics_raw jsonb;

-- 3. Indexes for rapid lookups during telematics sync
CREATE INDEX IF NOT EXISTS idx_machines_telematics_imei ON public.machines(telematics_imei) WHERE telematics_imei IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_machines_plate_number ON public.machines(plate_number) WHERE plate_number IS NOT NULL;
