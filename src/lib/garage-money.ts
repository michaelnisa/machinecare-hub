/** Shared total math for garage estimates/invoices — was previously copy-pasted across 5 pages. */

interface LineItem {
  quantity: number;
  unit_price: number;
  line_total?: number | null;
}

interface Totals {
  itemsTotal: number;
  subtotal: number;
  taxAmount: number;
  total: number;
}

function itemsSum(items: LineItem[] | undefined | null): number {
  return (items ?? []).reduce((s, it) => s + Number(it.line_total ?? Number(it.quantity) * Number(it.unit_price)), 0);
}

function computeTotals(doc: {
  garage_estimate_items?: LineItem[];
  garage_invoice_items?: LineItem[];
  labour_cost?: number | null;
  other_cost?: number | null;
  discount?: number | null;
  tax_rate_percent?: number | null;
}): Totals {
  const itemsTotal = itemsSum(doc.garage_estimate_items ?? doc.garage_invoice_items);
  const subtotal = itemsTotal + Number(doc.labour_cost || 0) + Number(doc.other_cost || 0) - Number(doc.discount || 0);
  const taxAmount = subtotal * (Number(doc.tax_rate_percent || 0) / 100);
  return { itemsTotal, subtotal, taxAmount, total: subtotal + taxAmount };
}

export function estimateTotal(estimate: any): number {
  return computeTotals(estimate).total;
}

export function estimateTotals(estimate: any): Totals {
  return computeTotals(estimate);
}

export function invoiceTotal(invoice: any): number {
  return computeTotals(invoice).total;
}

export function invoiceTotals(invoice: any): Totals {
  return computeTotals(invoice);
}
