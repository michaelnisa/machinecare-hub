import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isPlatformAdmin, provisionMachineCareGpsAccount } from "@/lib/admin";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRightLeft,
  Building2,
  Check,
  Factory,
  Layers,
  Loader2,
  Plus,
  Radio,
  ShieldCheck,
  Truck,
  Wrench,
  Tv,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface OrgItem {
  id: string;
  name: string;
  industry_profile: string | null;
  industry?: string | null;
  logo_url: string | null;
}

export function PlatformAdminOrgSwitcher({ compact = false }: { compact?: boolean }) {
  const { user, organisation, switchOrganisation } = useAuth();
  const navigate = useNavigate();
  const isAdmin = isPlatformAdmin(user?.email);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [provisioning, setProvisioning] = useState(false);

  const fetchOrgs = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("organisations")
        .select("id, name, industry_profile, industry, logo_url")
        .order("name", { ascending: true });

      if (!error && data) {
        setOrgs(data as OrgItem[]);
      }
    } catch (e) {
      console.warn("Failed to fetch orgs for admin switcher:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && open) {
      fetchOrgs();
    }
  }, [isAdmin, open]);

  if (!isAdmin) return null;

  const handleSwitch = async (targetOrg: OrgItem) => {
    if (targetOrg.id === organisation?.id) {
      setOpen(false);
      return;
    }

    setSwitchingId(targetOrg.id);
    try {
      await switchOrganisation(targetOrg.id);
      toast.success(`Switched active account to: ${targetOrg.name}`);
      setOpen(false);
      window.location.href = "/dashboard";
    } catch (err: any) {
      toast.error(err?.message || "Failed to switch organisation");
    } finally {
      setSwitchingId(null);
    }
  };

  const handleProvisionGps = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setProvisioning(true);
    try {
      const res = await provisionMachineCareGpsAccount();
      if (!res.success) throw new Error(res.error || "Failed to provision GPS");

      await fetchOrgs();
      toast.success("MachineCare GPS account provisioned with demo tracking hardware!");

      if (res.orgId) {
        await switchOrganisation(res.orgId);
        setOpen(false);
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to provision GPS account");
    } finally {
      setProvisioning(false);
    }
  };

  const getProfileIcon = (profile: string | null) => {
    switch (profile) {
      case "gps_tracking":
        return <Radio className="h-3.5 w-3.5 text-sky-500 shrink-0" />;
      case "fleet_logistics":
        return <Truck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
      case "garage":
        return <Wrench className="h-3.5 w-3.5 text-orange-500 shrink-0" />;
      case "manufacturing":
        return <Factory className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
      default:
        return <Layers className="h-3.5 w-3.5 text-purple-500 shrink-0" />;
    }
  };

  const getProfileLabel = (profile: string | null) => {
    switch (profile) {
      case "gps_tracking":
        return "GPS Tracking";
      case "fleet_logistics":
        return "Fleet";
      case "garage":
        return "Workshop";
      case "manufacturing":
        return "Manufacturing";
      default:
        return "Enterprise";
    }
  };

  const hasGpsOrg = orgs.some(
    (o) =>
      o.industry_profile === "gps_tracking" ||
      (o.industry?.toLowerCase() === "gps_tracking" &&
        o.industry_profile !== "manufacturing" &&
        o.industry_profile !== "fleet_logistics" &&
        o.industry_profile !== "garage" &&
        o.industry_profile !== "mixed")
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            title="Platform Admin Account Switcher"
          >
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-2.5 text-xs gap-1.5 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-800 dark:text-amber-300 font-semibold shadow-2xs"
            title="Switch between tenant accounts"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden xl:inline">Account:</span>
            <span className="font-bold text-foreground truncate max-w-[120px]">
              {organisation?.name || "Select Account"}
            </span>
            <ArrowRightLeft className="h-3 w-3 text-muted-foreground ml-0.5 opacity-70" />
          </Button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 max-h-[85vh] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between text-xs py-2">
          <span className="flex items-center gap-1.5 font-bold text-foreground">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            Platform Admin Switcher
          </span>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-700 border-amber-500/30">
            Admin
          </Badge>
        </DropdownMenuLabel>
        <div className="px-2 pb-1.5 text-[11px] text-muted-foreground">
          Switch active organization to access specific solution suites & live features.
        </div>

        <DropdownMenuSeparator />

        <div className="px-1 py-1">
          <DropdownMenuItem asChild className="cursor-pointer gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10">
            <Link to="/factory/live-tv" onClick={() => setOpen(false)}>
              <Tv className="h-4 w-4" />
              <span>Factory Floor Live TV</span>
            </Link>
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator />

        {loading && orgs.length === 0 ? (
          <div className="py-6 flex items-center justify-center text-xs text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading accounts...
          </div>
        ) : (
          <div className="space-y-0.5 py-1">
            {orgs.map((org) => {
              const isActive = org.id === organisation?.id;
              const isGps =
                org.industry_profile === "gps_tracking" ||
                (org.industry?.toLowerCase() === "gps_tracking" &&
                  org.industry_profile !== "manufacturing" &&
                  org.industry_profile !== "fleet_logistics" &&
                  org.industry_profile !== "garage" &&
                  org.industry_profile !== "mixed");
              return (
                <DropdownMenuItem
                  key={org.id}
                  disabled={switchingId === org.id}
                  onClick={() => handleSwitch(org)}
                  className={cn(
                    "flex items-center justify-between gap-2 py-2 px-2.5 cursor-pointer rounded-lg text-xs",
                    isActive && "bg-emerald-500/10 font-semibold text-emerald-900 dark:text-emerald-200",
                    isGps && !isActive && "hover:bg-sky-500/10"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isGps ? (
                      <Radio className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                    ) : (
                      getProfileIcon(org.industry_profile)
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground flex items-center gap-1.5">
                        <span>{org.name}</span>
                        {isGps && (
                          <span className="text-[9px] px-1 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 font-bold">
                            GPS
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground capitalize">
                        {isGps ? "GPS Tracking" : getProfileLabel(org.industry_profile)}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1">
                    {switchingId === org.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    ) : isActive ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                        <Check className="h-3.5 w-3.5" />
                        Active
                      </span>
                    ) : null}
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}

        {!hasGpsOrg && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={provisioning}
              onClick={handleProvisionGps}
              className="py-2 px-2.5 text-xs text-sky-700 dark:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 font-semibold cursor-pointer rounded-lg flex items-center gap-2"
            >
              {provisioning ? (
                <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
              ) : (
                <Plus className="h-4 w-4 text-sky-600" />
              )}
              <span>+ Provision MachineCare GPS Suite</span>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer text-xs py-2 text-primary font-medium">
          <Link to="/admin" className="flex items-center justify-between w-full">
            <span>Manage All Companies in Admin</span>
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
