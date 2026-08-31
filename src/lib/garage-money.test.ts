import { describe, it, expect } from "vitest";
import {
  estimateTotals,
  estimateTotal,
  invoiceTotals,
  invoiceTotal,
} from "./garage-money";

describe("garage-money", () => {
  it("calculates estimate totals with line items, labour, and tax", () => {
    const estimate = {
      garage_estimate_items: [
        { quantity: 2, unit_price: 50000, line_total: 100000 },
        { quantity: 1, unit_price: 25000 }, // computed dynamically: 1 * 25000 = 25000
      ],
      labour_cost: 30000,
      other_cost: 5000,
      discount: 10000,
      tax_rate_percent: 18,
    };

    const totals = estimateTotals(estimate);
    // itemsTotal: 100000 + 25000 = 125000
    // subtotal: 125000 + 30000 + 5000 - 10000 = 150000
    // taxAmount: 150000 * 0.18 = 27000
    // total: 150000 + 27000 = 177000
    expect(totals.itemsTotal).toBe(125000);
    expect(totals.subtotal).toBe(150000);
    expect(totals.taxAmount).toBe(27000);
    expect(totals.total).toBe(177000);
    expect(estimateTotal(estimate)).toBe(177000);
  });

  it("calculates invoice totals with default zero tax and discounts", () => {
    const invoice = {
      garage_invoice_items: [
        { quantity: 4, unit_price: 15000, line_total: 60000 },
      ],
      labour_cost: 40000,
      other_cost: null,
      discount: null,
      tax_rate_percent: null,
    };

    const totals = invoiceTotals(invoice);
    expect(totals.itemsTotal).toBe(60000);
    expect(totals.subtotal).toBe(100000);
    expect(totals.taxAmount).toBe(0);
    expect(totals.total).toBe(100000);
    expect(invoiceTotal(invoice)).toBe(100000);
  });

  it("handles empty items or empty object gracefully", () => {
    const totals = invoiceTotals({});
    expect(totals.itemsTotal).toBe(0);
    expect(totals.subtotal).toBe(0);
    expect(totals.taxAmount).toBe(0);
    expect(totals.total).toBe(0);
  });
});
