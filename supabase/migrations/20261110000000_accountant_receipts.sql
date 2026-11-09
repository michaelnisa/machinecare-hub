-- ============================================================
-- Accountant Module: Payment Receipts & Disbursement Vouchers
-- ============================================================

CREATE TABLE IF NOT EXISTS public.accountant_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  receipt_number text NOT NULL,
  receipt_type text NOT NULL CHECK (receipt_type IN ('spare_part', 'maintenance_service', 'other_service')),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Spare Parts',
  payee_name text NOT NULL,
  payee_id uuid,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'TZS',
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank_transfer', 'mobile_money', 'cheque', 'card', 'selcom')),
  payment_reference text,
  payment_date timestamptz NOT NULL DEFAULT now(),
  paid_by_name text,
  received_by_name text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachment_url text,
  notes text,
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'cancelled')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Organization voucher sequence counter
CREATE TABLE IF NOT EXISTS public.org_receipt_counters (
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  year int NOT NULL,
  next_number int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, year)
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accountant_receipts TO authenticated;
GRANT ALL ON public.accountant_receipts TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.org_receipt_counters TO authenticated;
GRANT ALL ON public.org_receipt_counters TO service_role;

-- RLS
ALTER TABLE public.accountant_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_receipt_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can view accountant receipts" ON public.accountant_receipts;
CREATE POLICY "org members can view accountant receipts"
ON public.accountant_receipts FOR SELECT
TO authenticated
USING (organisation_id = public.current_org_id());

DROP POLICY IF EXISTS "org writers can insert accountant receipts" ON public.accountant_receipts;
CREATE POLICY "org writers can insert accountant receipts"
ON public.accountant_receipts FOR INSERT
TO authenticated
WITH CHECK (public.can_write(organisation_id));

DROP POLICY IF EXISTS "org writers can update accountant receipts" ON public.accountant_receipts;
CREATE POLICY "org writers can update accountant receipts"
ON public.accountant_receipts FOR UPDATE
TO authenticated
USING (public.can_write(organisation_id))
WITH CHECK (public.can_write(organisation_id));

DROP POLICY IF EXISTS "org managers can delete accountant receipts" ON public.accountant_receipts;
CREATE POLICY "org managers can delete accountant receipts"
ON public.accountant_receipts FOR DELETE
TO authenticated
USING (public.can_manage(organisation_id));

DROP POLICY IF EXISTS "org members can view receipt counters" ON public.org_receipt_counters;
CREATE POLICY "org members can view receipt counters"
ON public.org_receipt_counters FOR SELECT
TO authenticated
USING (organisation_id = public.current_org_id());

DROP POLICY IF EXISTS "org writers can update receipt counters" ON public.org_receipt_counters;
CREATE POLICY "org writers can update receipt counters"
ON public.org_receipt_counters FOR ALL
TO authenticated
USING (public.can_write(organisation_id))
WITH CHECK (public.can_write(organisation_id));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accountant_receipts_org ON public.accountant_receipts(organisation_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_accountant_receipts_machine ON public.accountant_receipts(machine_id);
CREATE INDEX IF NOT EXISTS idx_accountant_receipts_wo ON public.accountant_receipts(work_order_id);
CREATE INDEX IF NOT EXISTS idx_accountant_receipts_type ON public.accountant_receipts(receipt_type);
