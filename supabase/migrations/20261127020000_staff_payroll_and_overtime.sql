-- ============================================================================
-- Migration: Staff Workers, Overtime Logs & Monthly Payroll
-- Supports adding company workers across departments, setting base salaries,
-- hourly overtime rates, daily posho rates, tracking daily overtime claims,
-- and running monthly payroll summaries.
-- ============================================================================

-- 1. Company Workers Registry
CREATE TABLE IF NOT EXISTS public.staff_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'Fleet Operations',
  designation TEXT NOT NULL DEFAULT 'Driver',
  employment_type TEXT NOT NULL DEFAULT 'permanent' CHECK (employment_type IN ('permanent', 'contract', 'casual', 'probation')),
  phone TEXT,
  email TEXT,
  national_id TEXT, -- NIDA or Passport
  base_salary_tzs NUMERIC NOT NULL DEFAULT 0,
  base_salary_usd NUMERIC NOT NULL DEFAULT 0,
  overtime_rate_tzs NUMERIC NOT NULL DEFAULT 0, -- Overtime Rate per hour
  daily_posho_tzs NUMERIC NOT NULL DEFAULT 0,   -- Standard Posho per diem
  payment_method TEXT DEFAULT 'bank' CHECK (payment_method IN ('bank', 'mpesa', 'airtel_money', 'cash', 'other')),
  bank_name TEXT,
  bank_account_no TEXT,
  mobile_money_number TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'suspended', 'terminated')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_workers_org ON public.staff_workers(organisation_id);
CREATE INDEX IF NOT EXISTS idx_staff_workers_dept ON public.staff_workers(department);

-- 2. Daily & Shift Overtime Logs
CREATE TABLE IF NOT EXISTS public.staff_overtime_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.staff_workers(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  normal_hours NUMERIC NOT NULL DEFAULT 8,
  overtime_hours NUMERIC NOT NULL DEFAULT 0,
  hourly_rate_tzs NUMERIC NOT NULL DEFAULT 0,
  overtime_amount_tzs NUMERIC NOT NULL DEFAULT 0,
  truck_no TEXT,
  job_reference TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_overtime_org_date ON public.staff_overtime_logs(organisation_id, log_date);
CREATE INDEX IF NOT EXISTS idx_staff_overtime_worker ON public.staff_overtime_logs(worker_id);

-- 3. Monthly Payroll Records
CREATE TABLE IF NOT EXISTS public.staff_payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.staff_workers(id) ON DELETE CASCADE,
  payroll_month INTEGER NOT NULL CHECK (payroll_month BETWEEN 1 AND 12),
  payroll_year INTEGER NOT NULL,
  base_salary_tzs NUMERIC NOT NULL DEFAULT 0,
  overtime_hours_total NUMERIC NOT NULL DEFAULT 0,
  overtime_pay_tzs NUMERIC NOT NULL DEFAULT 0,
  allowances_tzs NUMERIC NOT NULL DEFAULT 0,   -- Posho, transport, bonuses
  deductions_tzs NUMERIC NOT NULL DEFAULT 0,   -- NSSF, PAYE, cash advances
  net_salary_tzs NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TZS',
  payment_status TEXT NOT NULL DEFAULT 'draft' CHECK (payment_status IN ('draft', 'pending_approval', 'approved', 'paid')),
  payment_date DATE,
  payment_reference TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, worker_id, payroll_year, payroll_month)
);

CREATE INDEX IF NOT EXISTS idx_staff_payroll_org_period ON public.staff_payroll_records(organisation_id, payroll_year, payroll_month);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.staff_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_overtime_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_payroll_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_workers_org_all" ON public.staff_workers
  FOR ALL TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "staff_overtime_org_all" ON public.staff_overtime_logs
  FOR ALL TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "staff_payroll_org_all" ON public.staff_payroll_records
  FOR ALL TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM public.profiles WHERE id = auth.uid()));
