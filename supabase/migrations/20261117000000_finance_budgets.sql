-- ============================================================================
-- MachineCare Hub - Finance Budgeting Migration
-- Tables: finance_budgets, finance_budget_items
-- Supports company-wide budgeting, departmental allocations, and variance tracking.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.finance_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'Operations',
  fiscal_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  period_type TEXT NOT NULL DEFAULT 'annual' CHECK (period_type IN ('annual', 'q1', 'q2', 'q3', 'q4', 'monthly')),
  period_month INTEGER, -- 1 to 12 if period_type = 'monthly'
  allocated_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TZS',
  alert_threshold_pct NUMERIC NOT NULL DEFAULT 85,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for rapid multi-tenant filtering
CREATE INDEX IF NOT EXISTS idx_finance_budgets_org ON public.finance_budgets(organisation_id);
CREATE INDEX IF NOT EXISTS idx_finance_budgets_year ON public.finance_budgets(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_finance_budgets_dept ON public.finance_budgets(department);

-- Enable Row Level Security (RLS)
ALTER TABLE public.finance_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_budgets_org_read"
  ON public.finance_budgets
  FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "finance_budgets_org_write"
  ON public.finance_budgets
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

-- Trigger for updated_at
CREATE TRIGGER tr_finance_budgets_updated_at
  BEFORE UPDATE ON public.finance_budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
