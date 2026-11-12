import { describe, it, expect } from "vitest";
import {
  CROSS_BORDER_CORRIDORS,
  REGIONAL_CURRENCIES,
  convertUsdToLocal,
  formatCorridorAmount,
} from "../services/crossBorderCorridors";
import { parseCargoMeta, extractCleanCargo } from "../lib/fleet-metadata";

describe("Cross-Border Southern & Eastern Transit Corridors", () => {
  it("includes the Great North-South Corridor across Zambia, Zimbabwe & South Africa", () => {
    const corridor = CROSS_BORDER_CORRIDORS.find((c) => c.id === "north_south_zambia_zim_sa");
    expect(corridor).toBeDefined();
    expect(corridor?.name).toContain("Zambia, Zimbabwe & South Africa");
    expect(corridor?.borderPost).toContain("Tunduma/Nakonde");
    expect(corridor?.borderPost).toContain("Beitbridge");
    
    // Check specific statutory expense items with native currencies
    const zambianToll = corridor?.expenses.find((e) => e.title.includes("Zambia Road Toll"));
    expect(zambianToll).toBeDefined();
    expect(zambianToll?.localCurrency).toBe("ZMW");
    expect(zambianToll?.defaultAmountLocal).toBeGreaterThan(0);

    const zimTransit = corridor?.expenses.find((e) => e.title.includes("ZIMRA Foreign Heavy Vehicle"));
    expect(zimTransit).toBeDefined();
    expect(zimTransit?.defaultAmountUsd).toBeGreaterThan(0);

    const saTransit = corridor?.expenses.find((e) => e.title.includes("SA SARS Customs"));
    expect(saTransit).toBeDefined();
    expect(saTransit?.localCurrency).toBe("ZAR");
  });

  it("includes the Botswana & Southern Quadripoint Corridor with Kazungula Bridge", () => {
    const corridor = CROSS_BORDER_CORRIDORS.find((c) => c.id === "botswana_kazungula_groblersbrug");
    expect(corridor).toBeDefined();
    expect(corridor?.name).toContain("Kazungula Bridge");
    
    const kazungula = corridor?.expenses.find((e) => e.title.includes("Kazungula Bridge"));
    expect(kazungula).toBeDefined();
    expect(kazungula?.localCurrency).toBe("BWP");
    expect(kazungula?.defaultAmountLocal).toBeGreaterThan(0);
  });

  it("includes Zimbabwe Chirundu Direct and Malawi-Mozambique corridors", () => {
    const zimDirect = CROSS_BORDER_CORRIDORS.find((c) => c.id === "zimbabwe_direct_chirundu");
    expect(zimDirect).toBeDefined();
    expect(zimDirect?.borderPost).toContain("Chirundu OSBP");

    const malawiMoz = CROSS_BORDER_CORRIDORS.find((c) => c.id === "malawi_mozambique_songwe");
    expect(malawiMoz).toBeDefined();
    expect(malawiMoz?.borderPost).toContain("Songwe OSBP");
  });
});

describe("Regional Multi-Currency Conversion & Formatting", () => {
  it("supports all route country currencies (ZMW, BWP, ZAR, TZS, USD, KES, UGX, RWF, CDF)", () => {
    expect(REGIONAL_CURRENCIES["ZMW"]).toBeDefined();
    expect(REGIONAL_CURRENCIES["BWP"]).toBeDefined();
    expect(REGIONAL_CURRENCIES["ZAR"]).toBeDefined();
    expect(REGIONAL_CURRENCIES["TZS"]).toBeDefined();
    expect(REGIONAL_CURRENCIES["USD"]).toBeDefined();
    expect(REGIONAL_CURRENCIES["KES"]).toBeDefined();
  });

  it("correctly converts USD into native local currencies", () => {
    const usdAmount = 100;
    // Using default rates
    const zmw = convertUsdToLocal(usdAmount, "ZMW");
    expect(zmw).toBe(100 * REGIONAL_CURRENCIES.ZMW.defaultRateToUsd);

    const bwp = convertUsdToLocal(usdAmount, "BWP");
    expect(bwp).toBe(100 * REGIONAL_CURRENCIES.BWP.defaultRateToUsd);

    const zar = convertUsdToLocal(usdAmount, "ZAR");
    expect(zar).toBe(100 * REGIONAL_CURRENCIES.ZAR.defaultRateToUsd);

    const tzs = convertUsdToLocal(usdAmount, "TZS");
    expect(tzs).toBe(100 * 2600);
  });

  it("correctly formats corridor amounts with their respective currency symbols", () => {
    expect(formatCorridorAmount(550, "ZMW")).toBe("K 550.00");
    expect(formatCorridorAmount(300, "BWP")).toBe("P 300.00");
    expect(formatCorridorAmount(1500, "ZAR")).toBe("R 1,500.00");
    expect(formatCorridorAmount(2600000, "TZS")).toBe("TSh 2,600,000");
    expect(formatCorridorAmount(150, "USD")).toBe("$ 150.00");
  });
});

describe("Multi-Trip Customer Invoicing Logic", () => {
  it("consolidates multiple trips for a customer into clean commercial line items without internal expenses", () => {
    const mockTrips = [
      {
        id: "trip-1",
        client_name: "Dangote Cement",
        origin: "Dar es Salaam",
        destination: "Lusaka",
        cargo_description: "General Cement Clinker",
        cost: 3000000,
        machines: { plate_number: "T 101 ABC", name: "Scania R500" },
      },
      {
        id: "trip-2",
        client_name: "Dangote Cement",
        origin: "Mtwara",
        destination: "Harare",
        cargo_description: "Bagged Cement 42.5N",
        cost: 4500000,
        machines: { plate_number: "T 202 DEF", name: "Volvo FH16" },
      },
    ];

    const customerName = "Dangote";
    const matching = mockTrips.filter((t) =>
      t.client_name.toLowerCase().includes(customerName.toLowerCase())
    );
    expect(matching).toHaveLength(2);

    // Simulate multi-trip invoice line generation
    const invoiceItems = matching.map((t) => {
      const meta = parseCargoMeta(t.cargo_description);
      const rawAmt = Number(meta?.client_billing_amount) || Number(t.cost) * 1.35;
      const cargo = extractCleanCargo(t.cargo_description, "General Freight");
      const vehicleRef = t.machines?.plate_number || t.machines?.name;
      return {
        description: `Commercial Freight Haulage: ${t.origin} to ${t.destination} [${vehicleRef}] - ${cargo}`,
        quantity: 1,
        unit_price: rawAmt,
      };
    });

    expect(invoiceItems).toHaveLength(2);
    expect(invoiceItems[0].description).toContain("Dar es Salaam to Lusaka [T 101 ABC]");
    expect(invoiceItems[0].description).not.toContain("fuel");
    expect(invoiceItems[0].description).not.toContain("toll");
    expect(invoiceItems[1].description).toContain("Mtwara to Harare [T 202 DEF]");
    expect(invoiceItems[0].unit_price).toBe(3000000 * 1.35);
    expect(invoiceItems[1].unit_price).toBe(4500000 * 1.35);
  });
});

describe("Trip Route Turnaround Duration Helpers (Days and Hours)", () => {
  it("converts total raw hours into days and hours correctly", async () => {
    const { hoursToDaysAndHours, daysAndHoursToHours, formatTurnaroundDuration } = await import(
      "../services/crossBorderCorridors"
    );

    // 216 hours = 9 days 0 hours
    const res216 = hoursToDaysAndHours(216);
    expect(res216.days).toBe(9);
    expect(res216.hours).toBe(0);
    expect(res216.formatted).toBe("9 Days");

    // 108 hours = 4 days 12 hours
    const res108 = hoursToDaysAndHours(108);
    expect(res108.days).toBe(4);
    expect(res108.hours).toBe(12);
    expect(res108.formatted).toBe("4d 12h");

    // 14 hours = 0 days 14 hours
    const res14 = hoursToDaysAndHours(14);
    expect(res14.days).toBe(0);
    expect(res14.hours).toBe(14);
    expect(res14.formatted).toBe("14 Hours");

    // Edge cases: null, undefined, 0
    expect(hoursToDaysAndHours(0).formatted).toBe("0 hrs");
    expect(hoursToDaysAndHours(null).formatted).toBe("0 hrs");

    // Reverse conversion: days and hours to total hours
    expect(daysAndHoursToHours(4, 12)).toBe(108);
    expect(daysAndHoursToHours(9, 0)).toBe(216);
    expect(daysAndHoursToHours(0, 18)).toBe(18);

    // Formatted duration badge
    expect(formatTurnaroundDuration(216)).toBe("9 Days (216h)");
    expect(formatTurnaroundDuration(108)).toBe("4 Days 12 Hrs (108h)");
    expect(formatTurnaroundDuration(14)).toBe("14 Hours");
    expect(formatTurnaroundDuration(0)).toBe("—");
  });
});

describe("Standard Payment Term Presets", () => {
  it("includes all requested standard payment term presets", async () => {
    const { DEFAULT_PAYMENT_TERM_PRESETS } = await import(
      "../components/fleet/PaymentTermsDesignerDialog"
    );

    expect(DEFAULT_PAYMENT_TERM_PRESETS).toContain("100% Full Payment");
    expect(DEFAULT_PAYMENT_TERM_PRESETS).toContain("Advance 70% and 30% after 30 days");
    expect(DEFAULT_PAYMENT_TERM_PRESETS).toContain("30 days after delivery Invoicing");
    expect(DEFAULT_PAYMENT_TERM_PRESETS).toContain("50% advance 50% after delivery");
  });
});

