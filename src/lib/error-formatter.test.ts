import { describe, it, expect, vi } from "vitest";
import { formatAppError } from "./error-formatter";

vi.mock("./sentry", () => ({
  captureReactError: vi.fn(),
}));

describe("formatAppError", () => {
  it("returns fallback for null or undefined errors", () => {
    expect(formatAppError(null)).toBe("An unexpected error occurred. Please try again.");
    expect(formatAppError(undefined, "Custom fallback")).toBe("Custom fallback");
  });

  it("handles string errors and network issues", () => {
    expect(formatAppError("Something broke")).toBe("Something broke");
    expect(formatAppError("TypeError: Failed to fetch")).toBe(
      "Network connection issue. Please check your internet connection.",
    );
  });

  it("translates common Postgres error codes", () => {
    expect(formatAppError({ code: "23505", message: "duplicate key value" })).toBe(
      "A record with this identifier or name already exists.",
    );
    expect(formatAppError({ code: "23503", message: "fk violation" })).toBe(
      "This action cannot be completed because the record is linked to other data.",
    );
    expect(formatAppError({ code: "42501", message: "permission denied" })).toBe(
      "You do not have permission to perform this action.",
    );
    expect(formatAppError({ code: "55006", message: "rate limit" })).toBe(
      "Too many requests. Please wait a few minutes before trying again.",
    );
    expect(formatAppError({ code: "23502", message: "null value" })).toBe(
      "A required field was missing. Please check your input.",
    );
    expect(formatAppError({ code: "22P02", message: "invalid text" })).toBe(
      "Invalid data format submitted. Please check the entered values.",
    );
    expect(formatAppError({ code: "PGRST116", message: "not found" })).toBe(
      "The requested record was not found.",
    );
  });

  it("handles session expiration", () => {
    expect(formatAppError({ message: "JWT expired" })).toBe(
      "Your session has expired. Please sign in again.",
    );
  });
});
