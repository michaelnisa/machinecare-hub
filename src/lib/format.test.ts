import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatMoney,
  formatTZS,
  normalizeTzPhone,
  formatNumber,
  initials,
} from "./format";

describe("format utilities", () => {
  describe("formatDate", () => {
    it("formats ISO date string properly", () => {
      expect(formatDate("2026-08-15T12:00:00Z")).toBe("15 Aug 2026");
      expect(formatDate(new Date(2026, 7, 15))).toBe("15 Aug 2026");
    });

    it("returns dash for invalid or empty dates", () => {
      expect(formatDate(null)).toBe("—");
      expect(formatDate(undefined)).toBe("—");
      expect(formatDate("invalid-date")).toBe("—");
    });
  });

  describe("formatMoney & formatTZS", () => {
    it("formats amounts as whole numbers with currency code", () => {
      expect(formatMoney(150000)).toBe("TZS 150,000");
      expect(formatMoney("2500000", "USD")).toBe("USD 2,500,000");
      expect(formatTZS(50000)).toBe("TZS 50,000");
    });

    it("handles null, undefined, or NaN", () => {
      expect(formatMoney(null)).toBe("TZS 0");
      expect(formatMoney(undefined)).toBe("TZS 0");
      expect(formatMoney("abc")).toBe("TZS 0");
    });
  });

  describe("normalizeTzPhone", () => {
    it("normalizes standard Tanzanian formats to country code without plus", () => {
      expect(normalizeTzPhone("0764190999")).toBe("255764190999");
      expect(normalizeTzPhone("+255 764 190 999")).toBe("255764190999");
      expect(normalizeTzPhone("255764190999")).toBe("255764190999");
    });

    it("handles null or empty phone input", () => {
      expect(normalizeTzPhone(null)).toBeNull();
      expect(normalizeTzPhone("")).toBeNull();
    });
  });

  describe("formatNumber", () => {
    it("formats numbers with comma separators", () => {
      expect(formatNumber(10000)).toBe("10,000");
      expect(formatNumber("1234567")).toBe("1,234,567");
      expect(formatNumber(null)).toBe("0");
    });
  });

  describe("initials", () => {
    it("extracts 2-letter uppercase initials", () => {
      expect(initials("John Doe")).toBe("JD");
      expect(initials("Michael")).toBe("M");
      expect(initials("John Robert Doe")).toBe("JR");
      expect(initials(null)).toBe("U");
    });
  });
});
