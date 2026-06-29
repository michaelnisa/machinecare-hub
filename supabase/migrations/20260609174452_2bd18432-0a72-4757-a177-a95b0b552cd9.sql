ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_organisation_id_fkey
  FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_machine_id_fkey
  FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON DELETE CASCADE;

ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_assignee_id_fkey
  FOREIGN KEY (assignee_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';