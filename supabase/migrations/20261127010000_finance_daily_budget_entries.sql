-- ============================================================================
-- Migration: Daily Fleet Operating Budget Entries
-- Supports the 10-column daily expense sheet:
-- Description, Category, Truck No, Amount USD, Paid USD, Balance USD,
-- Amount TZS, Paid TZS, Balance TZS, Received By.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.finance_daily_budget_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  budget_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  truck_no TEXT,
  vehicle_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  amount_usd NUMERIC NOT NULL DEFAULT 0,
  paid_usd NUMERIC NOT NULL DEFAULT 0,
  balance_usd NUMERIC NOT NULL DEFAULT 0,
  amount_tzs NUMERIC NOT NULL DEFAULT 0,
  paid_tzs NUMERIC NOT NULL DEFAULT 0,
  balance_tzs NUMERIC NOT NULL DEFAULT 0,
  received_by TEXT,
  payment_method TEXT DEFAULT 'cash',
  voucher_no TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_daily_budget_org_date 
  ON public.finance_daily_budget_entries(organisation_id, budget_date);

CREATE INDEX IF NOT EXISTS idx_finance_daily_budget_truck 
  ON public.finance_daily_budget_entries(truck_no);

ALTER TABLE public.finance_daily_budget_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_budget_entries_org_read"
  ON public.finance_daily_budget_entries
  FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "daily_budget_entries_org_write"
  ON public.finance_daily_budget_entries
  FOR ALL
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM public.profiles WHERE id = auth.uid()
    )
  );
