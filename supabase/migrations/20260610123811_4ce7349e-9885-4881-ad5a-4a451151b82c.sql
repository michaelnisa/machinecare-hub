
ALTER TABLE public.production_kpis REPLICA IDENTITY FULL;
ALTER TABLE public.oee_records REPLICA IDENTITY FULL;
ALTER TABLE public.safety_incidents REPLICA IDENTITY FULL;
ALTER TABLE public.machines REPLICA IDENTITY FULL;
ALTER TABLE public.work_orders REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.production_kpis; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.oee_records; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.safety_incidents; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.machines; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.work_orders; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
