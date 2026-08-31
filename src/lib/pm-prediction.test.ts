import { describe, it, expect } from "vitest";
import {
  estimateUsageRate,
  predictScheduleDue,
  formatDaysRemaining,
} from "./pm-prediction";

describe("pm-prediction", () => {
  describe("estimateUsageRate", () => {
    it("returns none confidence when fewer than 2 readings exist", () => {
      expect(estimateUsageRate([])).toEqual({
        ratePerDay: null,
        confidence: "none",
        sampleSize: 0,
      });
      expect(
        estimateUsageRate([{ reading: 100, reading_date: "2026-08-01T00:00:00Z" }]),
      ).toEqual({
        ratePerDay: null,
        confidence: "none",
        sampleSize: 1,
      });
    });

    it("calculates daily usage rate from meter readings", () => {
      const readings = [
        { reading: 100, reading_date: "2026-08-01T00:00:00Z" },
        { reading: 200, reading_date: "2026-08-11T00:00:00Z" }, // 10 days, 100 delta = 10/day, 2 samples -> low
      ];
      const result = estimateUsageRate(readings);
      expect(result.ratePerDay).toBeCloseTo(10, 1);
      expect(result.confidence).toBe("low");
      expect(result.sampleSize).toBe(2);
    });

    it("assigns medium confidence when sample size >= 3 and span >= 7 days", () => {
      const readings = [
        { reading: 100, reading_date: "2026-08-01T00:00:00Z" },
        { reading: 150, reading_date: "2026-08-05T00:00:00Z" },
        { reading: 200, reading_date: "2026-08-10T00:00:00Z" }, // 9 days, 3 samples
      ];
      const result = estimateUsageRate(readings);
      expect(result.confidence).toBe("medium");
      expect(result.ratePerDay).toBeCloseTo(11.1, 1);
    });

    it("assigns high confidence when sample size >= 5 and span >= 14 days", () => {
      const readings = [
        { reading: 100, reading_date: "2026-08-01T00:00:00Z" },
        { reading: 130, reading_date: "2026-08-05T00:00:00Z" },
        { reading: 160, reading_date: "2026-08-10T00:00:00Z" },
        { reading: 200, reading_date: "2026-08-15T00:00:00Z" },
        { reading: 250, reading_date: "2026-08-20T00:00:00Z" }, // 19 days, 5 readings
      ];
      const result = estimateUsageRate(readings);
      expect(result.confidence).toBe("high");
      expect(result.ratePerDay).toBeGreaterThan(0);
    });
  });

  describe("predictScheduleDue", () => {
    it("handles calendar-only schedules", () => {
      const futureDate = new Date(Date.now() + 10 * 86400000).toISOString();
      const prediction = predictScheduleDue({
        nextDueDate: futureDate,
        usage: { ratePerDay: null, confidence: "none", sampleSize: 0 },
      });
      expect(prediction.drivenBy).toBe("calendar");
      expect(prediction.status).toBe("due_soon");
      expect(prediction.daysRemaining).toBeCloseTo(10, 0);
    });

    it("handles usage-only schedules", () => {
      const prediction = predictScheduleDue({
        nextDueHours: 150,
        currentHours: 100, // 50 hours remaining
        usage: { ratePerDay: 5, confidence: "high", sampleSize: 5 }, // 10 days remaining
      });
      expect(prediction.drivenBy).toBe("usage");
      expect(prediction.status).toBe("due_soon");
      expect(prediction.daysRemaining).toBeCloseTo(10, 0);
    });

    it("picks the more urgent of calendar vs usage", () => {
      const futureDate = new Date(Date.now() + 20 * 86400000).toISOString(); // 20 days
      const prediction = predictScheduleDue({
        nextDueDate: futureDate,
        nextDueHours: 200,
        currentHours: 100, // 100 remaining
        usage: { ratePerDay: 20, confidence: "high", sampleSize: 5 }, // 5 days remaining
      });
      expect(prediction.drivenBy).toBe("both");
      expect(prediction.daysRemaining).toBeCloseTo(5, 0);
      expect(prediction.status).toBe("due_soon");
    });

    it("identifies overdue schedules", () => {
      const pastDate = new Date(Date.now() - 5 * 86400000).toISOString();
      const prediction = predictScheduleDue({
        nextDueDate: pastDate,
        usage: { ratePerDay: null, confidence: "none", sampleSize: 0 },
      });
      expect(prediction.status).toBe("overdue");
      expect(prediction.daysRemaining).toBeLessThan(0);
    });
  });

  describe("formatDaysRemaining", () => {
    it("formats overdue days", () => {
      expect(formatDaysRemaining(-5)).toBe("Overdue by 5 days");
      expect(formatDaysRemaining(-1)).toBe("Overdue by 1 day");
    });

    it("formats due today", () => {
      expect(formatDaysRemaining(0)).toBe("Due today");
    });

    it("formats remaining days", () => {
      expect(formatDaysRemaining(1)).toBe("1 day remaining");
      expect(formatDaysRemaining(7)).toBe("7 days remaining");
    });

    it("formats null or undefined as dash", () => {
      expect(formatDaysRemaining(null)).toBe("—");
    });
  });
});
