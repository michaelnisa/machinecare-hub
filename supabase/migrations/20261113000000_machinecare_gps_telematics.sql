-- ============================================================================
-- MachineCare Platform - GPS Tracking & Vehicle Telematics Migration
-- Supports multi-tenant GPS hardware integration, Traccar bridge,
-- real-time positions, historical breadcrumbs, geofences, alerts & assignments.
-- ============================================================================

-- 1. GPS Devices Registry
CREATE TABLE IF NOT EXISTS public.gps_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  imei TEXT NOT NULL,
  name TEXT NOT NULL,
  manufacturer TEXT NOT NULL DEFAULT 'Teltonika',
  model TEXT NOT NULL DEFAULT 'FMC920',
  serial_number TEXT,
  protocol TEXT NOT NULL DEFAULT 'teltonika',
  traccar_device_id INTEGER,
  sim_phone_number TEXT,
  sim_carrier TEXT DEFAULT 'Vodacom TZ',
  status TEXT NOT NULL DEFAULT 'unassigned' CHECK (status IN ('active', 'unassigned', 'suspended', 'offline', 'decommissioned')),
  firmware_version TEXT,
  last_communication_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_gps_devices_org_imei UNIQUE (organisation_id, imei)
);

CREATE INDEX IF NOT EXISTS idx_gps_devices_org ON public.gps_devices(organisation_id);
CREATE INDEX IF NOT EXISTS idx_gps_devices_imei ON public.gps_devices(imei);
CREATE INDEX IF NOT EXISTS idx_gps_devices_status ON public.gps_devices(status);

-- 2. Vehicle GPS Device Assignments
CREATE TABLE IF NOT EXISTS public.vehicle_gps_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.gps_devices(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at TIMESTAMPTZ,
  technician_name TEXT,
  technician_phone TEXT,
  installation_location TEXT DEFAULT 'Under Dashboard / OBD / Fuse Box',
  odometer_at_install NUMERIC DEFAULT 0,
  odometer_at_removal NUMERIC,
  installation_notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'historical', 'decommissioned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gps_assign_org ON public.vehicle_gps_assignments(organisation_id);
CREATE INDEX IF NOT EXISTS idx_gps_assign_vehicle ON public.vehicle_gps_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_gps_assign_device ON public.vehicle_gps_assignments(device_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gps_assign_unique_active_device 
ON public.vehicle_gps_assignments(device_id) 
WHERE status = 'active';

-- 3. Latest Vehicle Positions (Fast cache for live map & dashboard)
CREATE TABLE IF NOT EXISTS public.latest_vehicle_positions (
  vehicle_id UUID PRIMARY KEY REFERENCES public.machines(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.gps_devices(id) ON DELETE SET NULL,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  speed_kmh NUMERIC(6, 2) NOT NULL DEFAULT 0,
  heading NUMERIC(5, 2) NOT NULL DEFAULT 0,
  altitude NUMERIC(7, 2) DEFAULT 0,
  ignition BOOLEAN DEFAULT false,
  battery_voltage NUMERIC(5, 2),
  external_power_connected BOOLEAN DEFAULT true,
  motion_status TEXT NOT NULL DEFAULT 'stopped' CHECK (motion_status IN ('moving', 'idling', 'stopped', 'offline')),
  satellite_count INTEGER DEFAULT 0,
  accuracy_m NUMERIC(6, 2),
  odometer_km NUMERIC(10, 2),
  address TEXT,
  recorded_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_attributes JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_latest_pos_org ON public.latest_vehicle_positions(organisation_id);
CREATE INDEX IF NOT EXISTS idx_latest_pos_motion ON public.latest_vehicle_positions(motion_status);
CREATE INDEX IF NOT EXISTS idx_latest_pos_recorded ON public.latest_vehicle_positions(recorded_at DESC);

-- 4. Vehicle Historical Positions (High-frequency breadcrumbs for route playback)
CREATE TABLE IF NOT EXISTS public.vehicle_positions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.gps_devices(id) ON DELETE SET NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  speed_kmh NUMERIC(6, 2) NOT NULL DEFAULT 0,
  heading NUMERIC(5, 2) NOT NULL DEFAULT 0,
  altitude NUMERIC(7, 2) DEFAULT 0,
  ignition BOOLEAN DEFAULT false,
  odometer_km NUMERIC(10, 2),
  battery_voltage NUMERIC(5, 2),
  satellite_count INTEGER DEFAULT 0,
  accuracy_m NUMERIC(6, 2),
  recorded_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_attributes JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_positions_vehicle_time ON public.vehicle_positions(vehicle_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_positions_org_time ON public.vehicle_positions(organisation_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_positions_org_veh_time ON public.vehicle_positions(organisation_id, vehicle_id, recorded_at DESC);

-- 5. Geofences
CREATE TABLE IF NOT EXISTS public.geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  geofence_type TEXT NOT NULL DEFAULT 'circle' CHECK (geofence_type IN ('circle', 'polygon')),
  center_latitude NUMERIC(10, 7),
  center_longitude NUMERIC(10, 7),
  radius_meters NUMERIC(10, 2),
  polygon_coordinates JSONB,
  color TEXT DEFAULT '#3b82f6',
  speed_limit_kmh NUMERIC(6, 2),
  entry_alert BOOLEAN NOT NULL DEFAULT true,
  exit_alert BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geofences_org ON public.geofences(organisation_id);

-- 6. GPS Events Log
CREATE TABLE IF NOT EXISTS public.gps_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.gps_devices(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'ignition_on', 'ignition_off', 'overspeed', 'device_offline', 
    'device_online', 'power_cut', 'low_battery', 'geofence_enter', 
    'geofence_exit', 'harsh_braking', 'harsh_acceleration', 'sos_panic', 'tamper'
  )),
  title TEXT NOT NULL,
  description TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  speed_kmh NUMERIC(6, 2),
  geofence_id UUID REFERENCES public.geofences(id) ON DELETE SET NULL,
  event_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_gps_events_vehicle ON public.gps_events(vehicle_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_gps_events_org ON public.gps_events(organisation_id, event_time DESC);

-- 7. GPS Alerts Center (User-facing actionable alerts)
CREATE TABLE IF NOT EXISTS public.gps_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.gps_devices(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('critical', 'warning', 'info')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  event_time TIMESTAMPTZ NOT NULL,
  is_acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gps_alerts_org ON public.gps_alerts(organisation_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_gps_alerts_unack ON public.gps_alerts(organisation_id) WHERE is_acknowledged = false;
CREATE INDEX IF NOT EXISTS idx_gps_alerts_org_unack_time ON public.gps_alerts(organisation_id, is_acknowledged, event_time DESC);

-- 8. GPS Installation Signoffs
CREATE TABLE IF NOT EXISTS public.gps_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.gps_devices(id) ON DELETE CASCADE,
  technician_name TEXT NOT NULL,
  technician_phone TEXT,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  location_address TEXT,
  power_source TEXT DEFAULT 'Permanent 12V/24V + Ignition ACC',
  antenna_placement TEXT DEFAULT 'Hidden under plastic windshield cowl',
  gps_fix_verified BOOLEAN NOT NULL DEFAULT true,
  ignition_sense_verified BOOLEAN NOT NULL DEFAULT true,
  engine_cut_relay_installed BOOLEAN NOT NULL DEFAULT false,
  photo_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  customer_contact_name TEXT,
  customer_signature_verified BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gps_installs_org ON public.gps_installations(organisation_id);

-- ============================================================================
-- Row Level Security (RLS) Configuration
-- ============================================================================

ALTER TABLE public.gps_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_gps_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.latest_vehicle_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_installations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gps_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_gps_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.latest_vehicle_positions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_positions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geofences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gps_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gps_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gps_installations TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 1. gps_devices policies
CREATE POLICY "org members can view gps devices"
ON public.gps_devices FOR SELECT
TO authenticated
USING (organisation_id = public.current_org_id());

CREATE POLICY "org writers can insert gps devices"
ON public.gps_devices FOR INSERT
TO authenticated
WITH CHECK (public.can_write(organisation_id));

CREATE POLICY "org writers can update gps devices"
ON public.gps_devices FOR UPDATE
TO authenticated
USING (public.can_write(organisation_id));

CREATE POLICY "org managers can delete gps devices"
ON public.gps_devices FOR DELETE
TO authenticated
USING (public.can_manage(organisation_id));

-- 2. vehicle_gps_assignments policies
CREATE POLICY "org members can view gps assignments"
ON public.vehicle_gps_assignments FOR SELECT
TO authenticated
USING (organisation_id = public.current_org_id());

CREATE POLICY "org writers can manage gps assignments"
ON public.vehicle_gps_assignments FOR INSERT
TO authenticated
WITH CHECK (public.can_write(organisation_id));

CREATE POLICY "org writers can update gps assignments"
ON public.vehicle_gps_assignments FOR UPDATE
TO authenticated
USING (public.can_write(organisation_id));

-- 3. latest_vehicle_positions policies
CREATE POLICY "org members can view latest vehicle positions"
ON public.latest_vehicle_positions FOR SELECT
TO authenticated
USING (organisation_id = public.current_org_id());

CREATE POLICY "org writers can update latest positions"
ON public.latest_vehicle_positions FOR ALL
TO authenticated
USING (public.can_write(organisation_id));

-- 4. vehicle_positions policies (historical breadcrumbs)
CREATE POLICY "org members can view vehicle positions"
ON public.vehicle_positions FOR SELECT
TO authenticated
USING (organisation_id = public.current_org_id());

CREATE POLICY "org writers can insert vehicle positions"
ON public.vehicle_positions FOR INSERT
TO authenticated
WITH CHECK (public.can_write(organisation_id));

-- 5. geofences policies
CREATE POLICY "org members can view geofences"
ON public.geofences FOR SELECT
TO authenticated
USING (organisation_id = public.current_org_id());

CREATE POLICY "org writers can manage geofences"
ON public.geofences FOR ALL
TO authenticated
USING (public.can_write(organisation_id));

-- 6. gps_events policies
CREATE POLICY "org members can view gps events"
ON public.gps_events FOR SELECT
TO authenticated
USING (organisation_id = public.current_org_id());

CREATE POLICY "org writers can insert gps events"
ON public.gps_events FOR INSERT
TO authenticated
WITH CHECK (public.can_write(organisation_id));

-- 7. gps_alerts policies
CREATE POLICY "org members can view gps alerts"
ON public.gps_alerts FOR SELECT
TO authenticated
USING (organisation_id = public.current_org_id());

CREATE POLICY "org writers can update gps alerts"
ON public.gps_alerts FOR UPDATE
TO authenticated
USING (public.can_write(organisation_id));

-- 8. gps_installations policies
CREATE POLICY "org members can view gps installations"
ON public.gps_installations FOR SELECT
TO authenticated
USING (organisation_id = public.current_org_id());

CREATE POLICY "org writers can manage gps installations"
ON public.gps_installations FOR ALL
TO authenticated
USING (public.can_write(organisation_id));
