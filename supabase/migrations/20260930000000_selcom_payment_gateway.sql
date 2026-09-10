-- Migration: Selcom Payment Gateway Integration
-- Date: 2026-09-30

-- 1. Extend organisations with Selcom configuration
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS selcom_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS selcom_vendor_id text,
  ADD COLUMN IF NOT EXISTS selcom_api_key text,
  ADD COLUMN IF NOT EXISTS selcom_api_secret text,
  ADD COLUMN IF NOT EXISTS selcom_is_sandbox boolean NOT NULL DEFAULT true;

-- 2. Create garage_payment_transactions table
CREATE TABLE IF NOT EXISTS public.garage_payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.garage_invoices(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.garage_jobs(id) ON DELETE SET NULL,
  gateway text NOT NULL DEFAULT 'selcom',
  order_id text NOT NULL UNIQUE,
  trans_id text,
  reference text,
  phone_number text NOT NULL,
  channel text NOT NULL DEFAULT 'ussd_push', -- ussd_push | checkout_link | qr
  payment_method text DEFAULT 'selcom_mobile', -- mpesa | tigopesa | airtel | halopesa | card
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'TZS',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled', 'timed_out')),
  result_code text,
  result_message text,
  raw_request jsonb,
  raw_response jsonb,
  initiated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Grants & RLS
GRANT SELECT, INSERT, UPDATE ON public.garage_payment_transactions TO authenticated;
GRANT ALL ON public.garage_payment_transactions TO service_role;
ALTER TABLE public.garage_payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gpt_order_id ON public.garage_payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_gpt_invoice_id ON public.garage_payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_gpt_org_status ON public.garage_payment_transactions(organisation_id, status, created_at DESC);

DROP POLICY IF EXISTS "gpt select" ON public.garage_payment_transactions;
CREATE POLICY "gpt select" ON public.garage_payment_transactions FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());

DROP POLICY IF EXISTS "gpt insert" ON public.garage_payment_transactions;
CREATE POLICY "gpt insert" ON public.garage_payment_transactions FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));

DROP POLICY IF EXISTS "gpt update" ON public.garage_payment_transactions;
CREATE POLICY "gpt update" ON public.garage_payment_transactions FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id))
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));

-- 3. Stored procedure to atomically complete a Selcom payment and post to garage_payments ledger
CREATE OR REPLACE FUNCTION public.complete_selcom_payment(
  p_order_id text,
  p_trans_id text DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_txn public.garage_payment_transactions%ROWTYPE;
  v_payment_id uuid;
BEGIN
  -- Fetch transaction
  SELECT * INTO v_txn
  FROM public.garage_payment_transactions
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction not found');
  END IF;

  IF v_txn.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true, 'order_id', p_order_id);
  END IF;

  -- Update transaction status
  UPDATE public.garage_payment_transactions
  SET status = 'completed',
      trans_id = COALESCE(p_trans_id, trans_id),
      reference = COALESCE(p_reference, reference),
      result_code = '000',
      result_message = COALESCE(p_notes, 'Payment completed successfully'),
      updated_at = now()
  WHERE id = v_txn.id;

  -- If tied to an invoice, post to immutable ledger garage_payments
  IF v_txn.invoice_id IS NOT NULL THEN
    INSERT INTO public.garage_payments (
      organisation_id,
      invoice_id,
      type,
      amount,
      method,
      reference,
      notes,
      received_by,
      paid_at
    ) VALUES (
      v_txn.organisation_id,
      v_txn.invoice_id,
      'payment',
      v_txn.amount,
      'mobile_money',
      COALESCE(p_reference, p_trans_id, p_order_id),
      'Selcom Pay: ' || COALESCE(p_notes, 'Mobile payment verified (' || v_txn.phone_number || ')'),
      v_txn.initiated_by,
      now()
    ) RETURNING id INTO v_payment_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'payment_id', v_payment_id,
    'amount', v_txn.amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_selcom_payment(text, text, text, text) TO authenticated, service_role;
