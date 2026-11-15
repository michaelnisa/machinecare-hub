-- ============================================================================
-- Migration: Platform Admin Account Switcher & MachineCare GPS Provisioning
-- Allows platform administrators (michaelnisa3@gmail.com) to switch active
-- organisation and automatically provisions the MachineCare GPS suite with
-- sample tracking hardware and live telemetry.
-- ============================================================================

-- 0. Ensure schema compatibility on organisations table
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS enabled_modules text[] DEFAULT '{}';

-- 1. Security definer RPC for platform admin to switch active organisation
CREATE OR REPLACE FUNCTION public.admin_switch_organisation(target_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _calling_email text;
  _org_name text;
BEGIN
  -- Verify caller is a platform administrator
  SELECT LOWER(COALESCE(auth.jwt() ->> 'email', '')) INTO _calling_email;
  IF _calling_email IS NULL OR _calling_email NOT IN ('michaelnisa3@gmail.com') THEN
    RAISE EXCEPTION 'Access denied. Platform Admin authorization required.';
  END IF;

  -- Verify target organisation exists
  SELECT name INTO _org_name FROM public.organisations WHERE id = target_org_id;
  IF _org_name IS NULL THEN
    RAISE EXCEPTION 'Target organisation not found.';
  END IF;

  -- Update caller's profile organisation_id
  UPDATE public.profiles
  SET organisation_id = target_org_id
  WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'success', true,
    'org_id', target_org_id,
    'org_name', _org_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_switch_organisation(uuid) TO authenticated;

-- 2. Allow Platform Admin to update their own organisation_id on profiles table directly
DROP POLICY IF EXISTS "platform admin update own org" ON public.profiles;
CREATE POLICY "platform admin update own org"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid() 
    AND LOWER(COALESCE(auth.jwt() ->> 'email', '')) IN ('michaelnisa3@gmail.com')
  )
  WITH CHECK (
    id = auth.uid() 
    AND LOWER(COALESCE(auth.jwt() ->> 'email', '')) IN ('michaelnisa3@gmail.com')
  );

-- 3. Security definer RPC to idempotently provision MachineCare GPS suite with demo data
CREATE OR REPLACE FUNCTION public.admin_provision_machinecare_gps()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _calling_email text;
  _org_id uuid;
  _v1_id uuid;
  _v2_id uuid;
  _v3_id uuid;
  _d1_id uuid;
  _d2_id uuid;
  _d3_id uuid;
  _d4_id uuid;
  _is_new boolean := false;
BEGIN
  -- Verify caller is a platform administrator
  SELECT LOWER(COALESCE(auth.jwt() ->> 'email', '')) INTO _calling_email;
  IF _calling_email IS NULL OR _calling_email NOT IN ('michaelnisa3@gmail.com') THEN
    RAISE EXCEPTION 'Access denied. Platform Admin authorization required.';
  END IF;

  -- Check if MachineCare GPS already exists
  SELECT id INTO _org_id
  FROM public.organisations
  WHERE LOWER(name) LIKE '%machinecare gps%'
     OR LOWER(COALESCE(industry, '')) = 'gps_tracking'
  LIMIT 1;

  IF _org_id IS NULL THEN
    _is_new := true;
    INSERT INTO public.organisations (
      name,
      industry_profile,
      industry,
      plan
    ) VALUES (
      'MachineCare GPS Tracking',
      'fleet_logistics',
      'gps_tracking',
      'enterprise'
    )
    RETURNING id INTO _org_id;

    -- Provision demo vehicles (machines)
    INSERT INTO public.machines (
      organisation_id,
      name,
      plate_number,
      category,
      type,
      status,
      current_odometer_km,
      notes
    ) VALUES 
    (_org_id, 'Scania R500 Prime Mover', 'T 842 DKL', 'Vehicle', 'Truck', 'operational', 412500, 'GPS tracked cross-border hauler'),
    (_org_id, 'Mercedes Actros 3340', 'T 619 DSE', 'Vehicle', 'Truck', 'operational', 389200, 'GPS tracked transit tanker'),
    (_org_id, 'Toyota Hilux GD-6 Support', 'T 194 EAP', 'Vehicle', 'Pickup', 'operational', 84300, 'GPS tracked escort unit')
    RETURNING id INTO _v1_id;

    SELECT id INTO _v2_id FROM public.machines WHERE organisation_id = _org_id AND plate_number = 'T 619 DSE' LIMIT 1;
    SELECT id INTO _v3_id FROM public.machines WHERE organisation_id = _org_id AND plate_number = 'T 194 EAP' LIMIT 1;

    -- Provision GPS hardware devices (gps_devices)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gps_devices') THEN
      INSERT INTO public.gps_devices (
        organisation_id,
        imei,
        name,
        manufacturer,
        model,
        protocol,
        sim_carrier,
        status
      ) VALUES
      (_org_id, '863452041234561', 'Teltonika FMC920 #1', 'Teltonika', 'FMC920', 'teltonika', 'Vodacom TZ', 'active'),
      (_org_id, '863452041234562', 'Teltonika FMC130 #2', 'Teltonika', 'FMC130', 'teltonika', 'Airtel TZ', 'active'),
      (_org_id, '863452041234563', 'Concox WeTrack2 #3', 'Concox', 'WeTrack2', 'gt06', 'Tigo TZ', 'active'),
      (_org_id, '863452041234564', 'Queclink GV300 #4', 'Queclink', 'GV300', 'gl200', 'Halotel TZ', 'unassigned')
      ON CONFLICT DO NOTHING;

      SELECT id INTO _d1_id FROM public.gps_devices WHERE organisation_id = _org_id AND imei = '863452041234561' LIMIT 1;
      SELECT id INTO _d2_id FROM public.gps_devices WHERE organisation_id = _org_id AND imei = '863452041234562' LIMIT 1;
      SELECT id INTO _d3_id FROM public.gps_devices WHERE organisation_id = _org_id AND imei = '863452041234563' LIMIT 1;

      -- Assign devices to vehicles
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicle_gps_assignments') THEN
        IF _v1_id IS NOT NULL AND _d1_id IS NOT NULL THEN
          INSERT INTO public.vehicle_gps_assignments (organisation_id, device_id, vehicle_id, status, installation_location)
          VALUES (_org_id, _d1_id, _v1_id, 'active', 'Under Dashboard OBD');
        END IF;
        IF _v2_id IS NOT NULL AND _d2_id IS NOT NULL THEN
          INSERT INTO public.vehicle_gps_assignments (organisation_id, device_id, vehicle_id, status, installation_location)
          VALUES (_org_id, _d2_id, _v2_id, 'active', 'Fuse Box / Main Harness');
        END IF;
        IF _v3_id IS NOT NULL AND _d3_id IS NOT NULL THEN
          INSERT INTO public.vehicle_gps_assignments (organisation_id, device_id, vehicle_id, status, installation_location)
          VALUES (_org_id, _d3_id, _v3_id, 'active', 'Behind Instrument Cluster');
        END IF;
      END IF;

      -- Seed latest positions
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'latest_vehicle_positions') THEN
        IF _v1_id IS NOT NULL THEN
          INSERT INTO public.latest_vehicle_positions (
            vehicle_id, device_id, organisation_id, latitude, longitude, speed_kmh, heading, ignition, motion_status, satellite_count, address, recorded_at
          ) VALUES (
            _v1_id, _d1_id, _org_id, -6.816200, 39.280400, 38.5, 270.0, true, 'moving', 14, 'Kurasini Port Terminal, Dar es Salaam', now()
          ) ON CONFLICT (vehicle_id) DO UPDATE SET latitude = EXCLUDED.latitude, recorded_at = now();
        END IF;

        IF _v2_id IS NOT NULL THEN
          INSERT INTO public.latest_vehicle_positions (
            vehicle_id, device_id, organisation_id, latitude, longitude, speed_kmh, heading, ignition, motion_status, satellite_count, address, recorded_at
          ) VALUES (
            _v2_id, _d2_id, _org_id, -6.822200, 37.661200, 64.0, 285.0, true, 'moving', 16, 'Morogoro Highway, Morogoro', now()
          ) ON CONFLICT (vehicle_id) DO UPDATE SET latitude = EXCLUDED.latitude, recorded_at = now();
        END IF;

        IF _v3_id IS NOT NULL THEN
          INSERT INTO public.latest_vehicle_positions (
            vehicle_id, device_id, organisation_id, latitude, longitude, speed_kmh, heading, ignition, motion_status, satellite_count, address, recorded_at
          ) VALUES (
            _v3_id, _d3_id, _org_id, -6.173000, 35.741900, 0.0, 0.0, false, 'stopped', 12, 'Dodoma Capital Operations Yard, Dodoma', now()
          ) ON CONFLICT (vehicle_id) DO UPDATE SET latitude = EXCLUDED.latitude, recorded_at = now();
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'org_id', _org_id,
    'is_new', _is_new,
    'org_name', 'MachineCare GPS'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_provision_machinecare_gps() TO authenticated;

NOTIFY pgrst, 'reload schema';
