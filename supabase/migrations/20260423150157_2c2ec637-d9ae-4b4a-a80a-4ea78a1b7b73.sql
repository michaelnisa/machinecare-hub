CREATE OR REPLACE FUNCTION public.seed_first_org()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  org_count INT;
  m1 UUID; m2 UUID; m3 UUID;
  s1 UUID; s2 UUID; s3 UUID;
  l1 UUID; l2 UUID; l3 UUID;
BEGIN
  SELECT COUNT(*) INTO org_count FROM public.organisations;
  -- Only seed on the FIRST organisation ever created
  IF org_count <> 1 THEN RETURN NEW; END IF;

  INSERT INTO public.machines (organisation_id, name, category, make, model, year, registration_number, current_hours, status, notes)
  VALUES (NEW.id, 'Toyota Land Cruiser #1', 'Vehicle', 'Toyota', 'Land Cruiser 79', 2021, 'T 123 ABC', 48230, 'active', 'Field operations vehicle.')
  RETURNING id INTO m1;

  INSERT INTO public.machines (organisation_id, name, category, make, model, year, serial_number, current_hours, status, notes)
  VALUES (NEW.id, 'CAT 320 Excavator #3', 'Heavy Equipment', 'Caterpillar', '320 GC', 2020, 'CAT320-9988', 4120, 'active', 'Site B excavator.')
  RETURNING id INTO m2;

  INSERT INTO public.machines (organisation_id, name, category, make, model, year, serial_number, current_hours, status)
  VALUES (NEW.id, 'Perkins 100kVA Generator', 'Generator', 'Perkins', '1104A-44TG2', 2019, 'PRK-100K-552', 2210, 'active')
  RETURNING id INTO m3;

  -- Schedules
  INSERT INTO public.service_schedules (machine_id, name, service_type, interval_days, last_service_date, next_due_date)
  VALUES (m1, 'Engine oil change', 'small', 90, CURRENT_DATE - 80, CURRENT_DATE + 10) RETURNING id INTO s1;
  INSERT INTO public.service_schedules (machine_id, name, service_type, interval_days, last_service_date, next_due_date)
  VALUES (m1, 'Annual inspection', 'inspection', 365, CURRENT_DATE - 200, CURRENT_DATE + 165);

  INSERT INTO public.service_schedules (machine_id, name, service_type, interval_hours, last_service_hours, next_due_hours, last_service_date, next_due_date)
  VALUES (m2, '250hr small service', 'small', 250, 4000, 4250, CURRENT_DATE - 30, CURRENT_DATE - 5) RETURNING id INTO s2;
  INSERT INTO public.service_schedules (machine_id, name, service_type, interval_hours, last_service_hours, next_due_hours, last_service_date, next_due_date)
  VALUES (m2, '1000hr major service', 'major', 1000, 4000, 5000, CURRENT_DATE - 30, CURRENT_DATE + 220);

  INSERT INTO public.service_schedules (machine_id, name, service_type, interval_hours, last_service_hours, next_due_hours, last_service_date, next_due_date)
  VALUES (m3, 'Generator oil & filter', 'small', 500, 1800, 2300, CURRENT_DATE - 60, CURRENT_DATE + 25) RETURNING id INTO s3;

  -- Logs
  INSERT INTO public.service_logs (machine_id, schedule_id, service_type, title, description, performed_by, performed_at, hours_at_service, cost, currency, status)
  VALUES (m1, s1, 'small_service', 'Oil & filter change', '5W-30 fully synthetic, replaced oil filter.', 'Juma Auto Services', CURRENT_DATE - 80, 47900, 320000, 'TZS', 'completed') RETURNING id INTO l1;
  INSERT INTO public.service_parts (service_log_id, part_name, part_number, quantity, unit, part_type, supplier, unit_cost) VALUES
    (l1, 'Engine oil 5W-30', 'CAS-5W30-4L', 6, 'litres', 'original', 'Toyota TZ', 28000),
    (l1, 'Oil filter', '90915-YZZD2', 1, 'pcs', 'original', 'Toyota TZ', 45000);

  INSERT INTO public.service_logs (machine_id, schedule_id, service_type, title, description, performed_by, performed_at, hours_at_service, cost, currency, status)
  VALUES (m2, s2, 'small_service', '250hr service – CAT 320', 'Engine oil, hydraulic filter, fuel filter.', 'In-house', CURRENT_DATE - 30, 4000, 1250000, 'TZS', 'completed') RETURNING id INTO l2;
  INSERT INTO public.service_parts (service_log_id, part_name, part_number, quantity, unit, part_type, supplier, unit_cost) VALUES
    (l2, 'Hydraulic filter', '5I-8670', 1, 'pcs', 'original', 'Mantrac', 320000),
    (l2, 'Engine oil 15W-40', 'CAT-DEO-15W40', 18, 'litres', 'original', 'Mantrac', 35000),
    (l2, 'Fuel filter', '326-1644', 2, 'pcs', 'original', 'Mantrac', 90000);

  INSERT INTO public.service_logs (machine_id, schedule_id, service_type, title, description, performed_by, performed_at, hours_at_service, cost, currency, status)
  VALUES (m3, s3, 'small_service', 'Generator service 1800h', 'Routine oil and filter service.', 'PowerTech Ltd', CURRENT_DATE - 60, 1800, 480000, 'TZS', 'completed') RETURNING id INTO l3;
  INSERT INTO public.service_parts (service_log_id, part_name, quantity, unit, part_type, supplier, unit_cost) VALUES
    (l3, 'Engine oil 15W-40', 14, 'litres', 'original', 'PowerTech', 32000);

  INSERT INTO public.service_logs (machine_id, service_type, title, description, performed_by, performed_at, hours_at_service, cost, currency, status)
  VALUES (m2, 'repair', 'Replaced bucket pin', 'Worn bucket pin replaced on-site.', 'In-house', CURRENT_DATE - 12, 4090, 180000, 'TZS', 'completed');

  INSERT INTO public.service_logs (machine_id, service_type, title, description, performed_by, performed_at, hours_at_service, cost, currency, status)
  VALUES (m1, 'inspection', 'Annual safety inspection', 'Brakes, lights, suspension all OK.', 'TanRoads inspection', CURRENT_DATE - 200, 45200, 90000, 'TZS', 'completed');

  -- Knowledge items
  INSERT INTO public.knowledge_items (machine_id, title, category, content) VALUES
    (m2, 'Daily pre-start checks', 'procedure', E'1. Walk-around inspection\n2. Check engine oil and coolant levels\n3. Inspect tracks and undercarriage\n4. Test all lights and horn\n5. Grease pivot points'),
    (m3, 'Generator safety', 'safety', 'Always isolate the load before servicing. Wear hearing protection within 5m of running unit.'),
    (m1, 'Tyre pressure spec', 'specification', 'Front: 280 kPa, Rear: 320 kPa (loaded). Check cold weekly.');

  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_first_org_trigger
AFTER INSERT ON public.organisations
FOR EACH ROW EXECUTE FUNCTION public.seed_first_org();