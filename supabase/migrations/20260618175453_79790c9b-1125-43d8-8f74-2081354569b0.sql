-- GSM-style fields on work_orders
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS requested_by_name text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS plant_area text,
  ADD COLUMN IF NOT EXISTS nature_of_problem text,
  ADD COLUMN IF NOT EXISTS equipment_label text,
  ADD COLUMN IF NOT EXISTS model_no text,
  ADD COLUMN IF NOT EXISTS serial_no text,
  ADD COLUMN IF NOT EXISTS permit_cold_work boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permit_hot_work boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permit_jsea boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permit_isolation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permit_confined_space boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS time_received timestamptz,
  ADD COLUMN IF NOT EXISTS proposed_remedy text,
  ADD COLUMN IF NOT EXISTS actual_work_done text,
  ADD COLUMN IF NOT EXISTS inspected_by_name text,
  ADD COLUMN IF NOT EXISTS inspected_at timestamptz,
  ADD COLUMN IF NOT EXISTS handed_over_by_name text,
  ADD COLUMN IF NOT EXISTS handed_over_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by_name text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

-- PM detail fields on service_schedules
ALTER TABLE public.service_schedules
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS trade text,
  ADD COLUMN IF NOT EXISTS shutdown_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS spares text,
  ADD COLUMN IF NOT EXISTS work_instruction_no text,
  ADD COLUMN IF NOT EXISTS component text,
  ADD COLUMN IF NOT EXISTS sub_assembly text,
  ADD COLUMN IF NOT EXISTS schedule_label text;