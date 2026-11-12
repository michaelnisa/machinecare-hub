import { describe, it, expect, beforeEach } from "vitest";
import { DEFAULT_PAYMENT_TERM_PRESETS } from "@/components/fleet/PaymentTermsDesignerDialog";

describe("Payment Terms Presets & Configuration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("contains all 4 requested default presets", () => {
    expect(DEFAULT_PAYMENT_TERM_PRESETS).toContain("100% Full Payment");
    expect(DEFAULT_PAYMENT_TERM_PRESETS).toContain("Advance 70% and 30% after 30 days");
    expect(DEFAULT_PAYMENT_TERM_PRESETS).toContain("30 days after delivery Invoicing");
    expect(DEFAULT_PAYMENT_TERM_PRESETS).toContain("50% advance 50% after delivery");
    expect(DEFAULT_PAYMENT_TERM_PRESETS.length).toBe(4);
  });

  it("saves and loads custom presets in localStorage", () => {
    const key = "machinecare_custom_payment_terms";
    const customList = [
      "Advance 60% upon loading and 40% after 15 days",
      "Net 45 days after verified POD submission",
    ];

    localStorage.setItem(key, JSON.stringify(customList));
    const retrieved = JSON.parse(localStorage.getItem(key) || "[]");

    expect(retrieved).toHaveLength(2);
    expect(retrieved[0]).toBe("Advance 60% upon loading and 40% after 15 days");
  });
});
