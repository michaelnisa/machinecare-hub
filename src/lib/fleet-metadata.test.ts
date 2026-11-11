import { describe, it, expect } from "vitest";
import { parseCargoMeta, extractCleanCargo, parseTrip } from "./fleet-metadata";

describe("fleet-metadata cargo and corridor parser", () => {
  it("should extract fields from intact JSON cargo description", () => {
    const rawJson = JSON.stringify({
      client: "RTW - DUBAI",
      order_no: "ORD-9921",
      cargo: "CONTAINER",
      purpose: "Transit Run: Zambia Corridor",
      client_billing_amount: 7300,
      billing_currency: "USD",
      exchange_rate: 2600,
    });

    const parsed = parseCargoMeta(rawJson);
    expect(parsed).not.toBeNull();
    expect(parsed?.client).toBe("RTW - DUBAI");
    expect(parsed?.order_no).toBe("ORD-9921");
    expect(parsed?.cargo).toBe("CONTAINER");
    expect(parsed?.client_billing_amount).toBe(7300);

    const clean = extractCleanCargo(rawJson);
    expect(clean).toBe("CONTAINER");
  });

  it("should gracefully extract fields from truncated JSON strings without error", () => {
    // Truncated string missing closing brackets/braces (identical to user reported error)
    const truncatedPayload = `{"client":"RTW - DUBAI","order_no":"NONE","client_billing_amount":7300,"billing_currency":"USD","payment_terms":"70% Adance and 30% after submission POD and interchange","tax_percent":0,"include_statutory_tolls":true,"est_hours":96,"is_round_trip":true,"purpose":"Transit Run: Zambia Corridor – Tunduma / Nakonde Border","cargo":"CONTAINER","route_notes":"Primary SADC freight corridor connecting Dar Port to Zambia, DRC Katanga, and Zimbabwe via Tunduma/Nakonde OSBP. (Primary Border: Tunduma / Nakonde OSBP)","estimated_return_at":"2026-11-14T07:18:13.417Z","corridor_id":"zambia_tunduma_nakonde","corridor_name":"Zambia Corridor – Tunduma / Nakonde Border","border_post":"Tunduma / Nakonde OSBP","currency":"USD","exchange_rate":2600,"expenses":[{"id":"zm_road_toll","title":"Road Toll (RDA User Charges)","category":"toll","amountUsd":369,"amountTzs":959400,"amount":369,"currency":"USD","notes":"Road Development Agency (RDA) heavy`;

    const parsed = parseCargoMeta(truncatedPayload);
    expect(parsed).not.toBeNull();
    expect(parsed?.client).toBe("RTW - DUBAI");
    expect(parsed?.order_no).toBe("NONE");
    expect(parsed?.cargo).toBe("CONTAINER");
    expect(parsed?.client_billing_amount).toBe(7300);
    expect(parsed?.billing_currency).toBe("USD");
    expect(parsed?.exchange_rate).toBe(2600);
    expect(parsed?.corridor_id).toBe("zambia_tunduma_nakonde");

    const clean = extractCleanCargo(truncatedPayload);
    expect(clean).toBe("CONTAINER");
    // Ensure raw JSON never leaks
    expect(clean.startsWith("{")).toBe(false);
  });

  it("should preserve plain text cargo description", () => {
    expect(extractCleanCargo("20ft Container of Copper Cathodes")).toBe("20ft Container of Copper Cathodes");
    expect(extractCleanCargo(null, "Fertilizer Delivery")).toBe("Fertilizer Delivery");
    expect(extractCleanCargo(undefined, null)).toBe("Commercial Freight");
  });

  it("should never leave raw_cargo as raw JSON string in parseTrip", () => {
    const rawTrip = {
      id: "trip-123",
      cargo_description: `{"client":"Bollore Logistics","order_no":"BOL-55","cargo":"Loose Timber","est_hours":48`,
      origin: "Dar es Salaam",
      destination: "Mbeya",
    };

    const trip = parseTrip(rawTrip);
    expect(trip.client_name).toBe("Bollore Logistics");
    expect(trip.client_order_number).toBe("BOL-55");
    expect(trip.raw_cargo).toBe("Loose Timber");
    expect(trip.raw_cargo?.startsWith("{")).toBe(false);
  });
});
