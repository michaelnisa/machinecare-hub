import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useIndustry } from "./useIndustry";
import * as AuthContext from "@/contexts/AuthContext";

describe("useIndustry", () => {
  it("defaults to manufacturing when no organisation or industry profile is set", () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({
      user: null,
      session: null,
      profile: null,
      organisation: null,
      loading: false,
      refresh: vi.fn(),
      signOut: vi.fn(),
    });

    const { result } = renderHook(() => useIndustry());
    expect(result.current.profile).toBe("manufacturing");
    expect(result.current.isManufacturing).toBe(true);
    expect(result.current.isFleet).toBe(false);
    expect(result.current.isGarage).toBe(false);
    expect(result.current.isMixed).toBe(false);
  });

  it("identifies fleet_logistics profile", () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({
      user: { id: "user-1" } as any,
      session: null,
      profile: null,
      organisation: { industry_profile: "fleet_logistics" } as any,
      loading: false,
      refresh: vi.fn(),
      signOut: vi.fn(),
    });

    const { result } = renderHook(() => useIndustry());
    expect(result.current.profile).toBe("fleet_logistics");
    expect(result.current.isFleet).toBe(true);
    expect(result.current.isManufacturing).toBe(false);
    expect(result.current.isGarage).toBe(false);
  });

  it("identifies garage profile", () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({
      user: { id: "user-1" } as any,
      session: null,
      profile: null,
      organisation: { industry_profile: "garage" } as any,
      loading: false,
      refresh: vi.fn(),
      signOut: vi.fn(),
    });

    const { result } = renderHook(() => useIndustry());
    expect(result.current.profile).toBe("garage");
    expect(result.current.isGarage).toBe(true);
    expect(result.current.isFleet).toBe(false);
    expect(result.current.isManufacturing).toBe(false);
  });

  it("identifies mixed profile", () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({
      user: { id: "user-1" } as any,
      session: null,
      profile: null,
      organisation: { industry_profile: "mixed" } as any,
      loading: false,
      refresh: vi.fn(),
      signOut: vi.fn(),
    });

    const { result } = renderHook(() => useIndustry());
    expect(result.current.profile).toBe("mixed");
    expect(result.current.isMixed).toBe(true);
    expect(result.current.isFleet).toBe(false);
    expect(result.current.isManufacturing).toBe(false);
    expect(result.current.isGarage).toBe(false);
  });
});
