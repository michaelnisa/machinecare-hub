-- ============================================================================
-- MachineCare Hub - Finance Module Migration
-- Tables: finance_invoices, finance_invoice_items, finance_supplier_bills, org_finance_invoice_counters
-- ============================================================================

-- 1. Invoice Number Counters per Organisation
CREATE TABLE IF NOT EXISTS public.org_finance_invoice_counters (
  organisation_id UUID NOT NULL,
  year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (organisation_id, year)
);

-- 2. Finance Invoices (Client / Freight / Service Invoices)
CREATE TABLE IF NOT EXISTS public.finance_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  invoice_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  currency TEXT NOT NULL DEFAULT 'TZS',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate_percent NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days')::DATE,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  payment_reference TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Finance Invoice Line Items
CREATE TABLE IF NOT EXISTS public.finance_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.finance_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Supplier / Vendor Bills (Fuel stations, spare parts vendors, workshops)
CREATE TABLE IF NOT EXISTS public.finance_supplier_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  bill_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('fuel', 'spare_parts', 'tyres', 'maintenance', 'insurance_permits', 'facility', 'other')),
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TZS',
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days')::DATE,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'partially_paid', 'overdue', 'rejected')),
  machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  payment_method TEXT,
  payment_reference TEXT,
  attachment_url TEXT,
  notes TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Indexes for fast dashboard and report aggregation
CREATE INDEX IF NOT EXISTS idx_finance_invoices_org ON public.finance_invoices(organisation_id);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_status ON public.finance_invoices(status);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_due ON public.finance_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_machine ON public.finance_invoices(machine_id);

CREATE INDEX IF NOT EXISTS idx_finance_invoice_items_inv ON public.finance_invoice_items(invoice_id);

CREATE INDEX IF NOT EXISTS idx_finance_supplier_bills_org ON public.finance_supplier_bills(organisation_id);
CREATE INDEX IF NOT EXISTS idx_finance_supplier_bills_status ON public.finance_supplier_bills(status);
CREATE INDEX IF NOT EXISTS idx_finance_supplier_bills_due ON public.finance_supplier_bills(due_date);
CREATE INDEX IF NOT EXISTS idx_finance_supplier_bills_category ON public.finance_supplier_bills(category);
CREATE INDEX IF NOT EXISTS idx_finance_supplier_bills_machine ON public.finance_supplier_bills(machine_id);

-- 6. Enable Row Level Security (RLS) for multi-tenant isolation
ALTER TABLE public.finance_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_supplier_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_finance_invoice_counters ENABLE ROW LEVEL SECURITY;

-- 7. Policies for finance_invoices
DROP POLICY IF EXISTS "finance_invoices_tenant_isolation" ON public.finance_invoices;
CREATE POLICY "finance_invoices_tenant_isolation" ON public.finance_invoices
  FOR ALL
  USING (
    organisation_id IN (
      SELECT p.organisation_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    organisation_id IN (
      SELECT p.organisation_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- 8. Policies for finance_invoice_items
DROP POLICY IF EXISTS "finance_invoice_items_tenant_isolation" ON public.finance_invoice_items;
CREATE POLICY "finance_invoice_items_tenant_isolation" ON public.finance_invoice_items
  FOR ALL
  USING (
    invoice_id IN (
      SELECT i.id FROM public.finance_invoices i
      WHERE i.organisation_id IN (
        SELECT p.organisation_id FROM public.profiles p WHERE p.id = auth.uid()
      )
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT i.id FROM public.finance_invoices i
      WHERE i.organisation_id IN (
        SELECT p.organisation_id FROM public.profiles p WHERE p.id = auth.uid()
      )
    )
  );

-- 9. Policies for finance_supplier_bills
DROP POLICY IF EXISTS "finance_supplier_bills_tenant_isolation" ON public.finance_supplier_bills;
CREATE POLICY "finance_supplier_bills_tenant_isolation" ON public.finance_supplier_bills
  FOR ALL
  USING (
    organisation_id IN (
      SELECT p.organisation_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    organisation_id IN (
      SELECT p.organisation_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- 10. Policies for org_finance_invoice_counters
DROP POLICY IF EXISTS "org_finance_invoice_counters_tenant_isolation" ON public.org_finance_invoice_counters;
CREATE POLICY "org_finance_invoice_counters_tenant_isolation" ON public.org_finance_invoice_counters
  FOR ALL
  USING (
    organisation_id IN (
      SELECT p.organisation_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    organisation_id IN (
      SELECT p.organisation_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );
