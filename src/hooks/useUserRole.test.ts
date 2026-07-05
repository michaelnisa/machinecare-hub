import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useUserRole } from "./useUserRole";

const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockRpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

function mockRoles(roles: string[]) {
  mockRpc.mockReturnValue(Promise.resolve({ data: roles, error: null }));
}

beforeEach(() => {
  mockRpc.mockReset();
  mockUseAuth.mockReturnValue({
    user: { id: "user-1" },
    profile: { organisation_id: "org-1" },
  });
});

describe("useUserRole", () => {
  it("calls get_my_roles via RPC, never selects user_roles directly", async () => {
    mockRoles(["technician"]);
    renderHook(() => useUserRole());
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith("get_my_roles"));
  });

  it("picks the highest-ranked role when a user holds several", async () => {
    mockRoles(["technician", "owner", "viewer"]);
    const { result } = renderHook(() => useUserRole());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.role).toBe("owner");
    expect(result.current.isOwner).toBe(true);
  });

  it("treats no roles as no access", async () => {
    mockRoles([]);
    const { result } = renderHook(() => useUserRole());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.role).toBeNull();
    expect(result.current.can("viewer")).toBe(false);
  });

  it("can(min) respects the role hierarchy", async () => {
    mockRoles(["manager"]);
    const { result } = renderHook(() => useUserRole());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.can("viewer")).toBe(true);
    expect(result.current.can("technician")).toBe(true);
    expect(result.current.can("manager")).toBe(true);
    expect(result.current.can("owner")).toBe(false);
  });

  it("canAuthorTemplates is true only for owner and engineer", async () => {
    mockRoles(["engineer"]);
    const { result } = renderHook(() => useUserRole());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canAuthorTemplates).toBe(true);
    expect(result.current.isManager).toBe(false);
  });

  it("does not fetch roles when there is no signed-in user", () => {
    mockUseAuth.mockReturnValue({ user: null, profile: null });
    const { result } = renderHook(() => useUserRole());
    expect(result.current.loading).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
