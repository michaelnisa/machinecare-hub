import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Role = "owner" | "manager" | "engineer" | "technician" | "viewer";

const RANK: Record<Role, number> = { owner: 5, manager: 4, engineer: 3, technician: 2, viewer: 1 };

export function useUserRole() {
  const { user, profile } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile) { setLoading(false); return; }
    setLoading(true);
    supabase
      .rpc("get_my_roles")
      .then(({ data }) => {
        const roles = (data ?? []) as Role[];
        if (roles.length === 0) { setRole(null); setLoading(false); return; }
        roles.sort((a, b) => RANK[b] - RANK[a]);
        setRole(roles[0]);
        setLoading(false);
      });
  }, [user, profile]);

  const can = (min: Role) => role !== null && RANK[role] >= RANK[min];
  const canAuthorTemplates = role === "owner" || role === "engineer";
  // Mirrors the DB's can_write(): owner/manager/technician may create and
  // update operational records (drivers, trips, tyres, fuel, documents…).
  // Engineer is intentionally excluded — RANK-based can() can't express this
  // since engineer outranks technician but isn't a can_write role.
  const canWrite = role === "owner" || role === "manager" || role === "technician";

  return { role, loading, can, canAuthorTemplates, canWrite, isOwner: role === "owner", isManager: can("manager"), isEngineer: role === "engineer", isTechnician: can("technician") };
}
