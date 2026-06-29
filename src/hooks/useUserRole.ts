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
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organisation_id", profile.organisation_id)
      .then(({ data }) => {
        const roles = (data ?? []).map((r: any) => r.role as Role);
        if (roles.length === 0) { setRole(null); setLoading(false); return; }
        roles.sort((a, b) => RANK[b] - RANK[a]);
        setRole(roles[0]);
        setLoading(false);
      });
  }, [user, profile]);

  const can = (min: Role) => role !== null && RANK[role] >= RANK[min];
  const canAuthorTemplates = role === "owner" || role === "engineer";

  return { role, loading, can, canAuthorTemplates, isOwner: role === "owner", isManager: can("manager"), isEngineer: role === "engineer", isTechnician: can("technician") };
}
