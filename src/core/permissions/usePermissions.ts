/**
 * MachineCare Core - Granular Permissions Hook
 * Provides resource:action RBAC checks alongside legacy role access.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Role = "owner" | "manager" | "engineer" | "technician" | "viewer";

const RANK: Record<Role, number> = { owner: 5, manager: 4, engineer: 3, technician: 2, viewer: 1 };

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  owner: ["*:*"],
  manager: [
    "assets:*",
    "maintenance:*",
    "production:*",
    "inventory:*",
    "fleet:*",
    "safety:*",
    "workshop:*",
    "connected_data:*",
    "reports:*",
    "integrations:read",
    "integrations:test",
    "integrations:sync",
    "users:read",
  ],
  engineer: [
    "assets:read",
    "assets:update",
    "maintenance:read",
    "maintenance:create",
    "maintenance:update",
    "maintenance:author_templates",
    "production:read",
    "inventory:read",
    "fleet:read",
    "safety:read",
    "safety:create",
    "safety:update",
    "workshop:read",
    "connected_data:*",
    "reports:read",
  ],
  technician: [
    "assets:read",
    "maintenance:read",
    "maintenance:create",
    "maintenance:update",
    "inventory:read",
    "inventory:request",
    "fleet:read",
    "fleet:create_log",
    "safety:read",
    "safety:report_incident",
    "workshop:read",
    "workshop:update_job",
    "connected_data:read",
  ],
  viewer: [
    "assets:read",
    "maintenance:read",
    "production:read",
    "inventory:read",
    "fleet:read",
    "safety:read",
    "workshop:read",
    "connected_data:read",
    "reports:read",
  ],
};

export function usePermissions() {
  const { user, profile } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .rpc("get_my_roles")
      .then(({ data }) => {
        const roles = (data ?? []) as Role[];
        if (roles.length === 0) {
          setRole(null);
          setLoading(false);
          return;
        }
        roles.sort((a, b) => RANK[b] - RANK[a]);
        setRole(roles[0]);
        setLoading(false);
      })
      .catch(() => {
        setRole(null);
        setLoading(false);
      });
  }, [user, profile]);

  const can = (min: Role) => role !== null && RANK[role] >= RANK[min];

  const hasPermission = (resourceAction: string): boolean => {
    if (!role) return false;
    const perms = ROLE_PERMISSIONS[role] || [];
    if (perms.includes("*:*")) return true;
    if (perms.includes(resourceAction)) return true;
    if (resourceAction.includes(":")) {
      const [res] = resourceAction.split(":");
      if (perms.includes(`${res}:*`)) return true;
    }
    return false;
  };

  const canAuthorTemplates = role === "owner" || role === "engineer";
  const canWrite = role === "owner" || role === "manager" || role === "technician";

  return {
    role,
    loading,
    can,
    hasPermission,
    canAuthorTemplates,
    canWrite,
    isOwner: role === "owner",
    isManager: can("manager"),
    isEngineer: role === "engineer",
    isTechnician: can("technician"),
  };
}
