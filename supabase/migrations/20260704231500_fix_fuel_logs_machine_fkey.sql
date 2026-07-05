-- fuel_logs.machine_id was never given a real foreign key to machines, so
-- PostgREST cannot resolve the `machines(name)` embed the Fuel & Odometer
-- page depends on (every load 400s and silently renders as empty).
ALTER TABLE public.fuel_logs
  ADD CONSTRAINT fuel_logs_machine_id_fkey
  FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON DELETE CASCADE;
