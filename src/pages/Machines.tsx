import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { CATEGORIES, CATEGORY_ICONS } from "@/lib/machine-constants";
import { Plus, Search, Wrench } from "lucide-react";
import { toast } from "sonner";
import { MachineFormDialog } from "@/components/MachineFormDialog";
import { CoverImage } from "@/components/CoverImage";
import { formatNumber } from "@/lib/format";

interface Machine {
  id: string;
  name: string;
  category: string;
  make: string | null;
  model: string | null;
  status: string;
  current_hours: number | null;
  cover_image_url: string | null;
  department: string | null;
}

export default function Machines() {
  const { profile } = useAuth();
  const { role } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [department, setDepartment] = useState<string>("");
  const [dialog, setDialog] = useState(false);

  // Auto-scope viewers and technicians to their own department
  useEffect(() => {
    if ((role === "viewer" || role === "technician") && profile?.department) {
      setDepartment(profile.department);
    }
  }, [role, profile?.department]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("machines")
      .select(
        "id, name, category, make, model, status, current_hours, cover_image_url, department",
      )
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    // Cast via unknown: 'department' column is added by migration 20260629000100
    // and will not appear in generated types until `supabase gen types` is re-run.
    else setMachines((data ?? []) as unknown as Machine[]);
    setLoading(false);
  };

  useEffect(() => {
    if (profile) load();
  }, [profile]);

  // Unique departments found across all machines
  const departments = useMemo(
    () =>
      [
        ...new Set(machines.map((m) => m.department).filter(Boolean)),
      ] as string[],
    [machines],
  );

  const filtered = machines.filter((m) => {
    if (category !== "all" && m.category !== category) return false;
    if (status !== "all" && m.status !== status) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    // Department filter: skip machines without a department only when user has none
    if (department && m.department !== department) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Machines</h1>
          <p className="text-sm text-muted-foreground">
            Every vehicle, generator and piece of equipment in your fleet.
          </p>
        </div>
        <Button onClick={() => setDialog(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add machine
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search machines..."
            className="pl-9"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="under_maintenance">Under maintenance</option>
          <option value="retired">Retired</option>
        </select>
        {departments.length > 0 && (
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-5 w-5" />}
          title={
            machines.length === 0
              ? "No machines yet"
              : "No machines match your filters"
          }
          description={
            machines.length === 0
              ? "Add your first machine to start tracking maintenance."
              : "Try changing or clearing filters."
          }
          action={
            machines.length === 0 ? (
              <Button onClick={() => setDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add machine
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((m) => {
            const Icon = CATEGORY_ICONS[m.category] ?? CATEGORY_ICONS.Other;
            return (
              <div
                key={m.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:border-primary/40"
              >
                <div className="flex h-36 items-center justify-center bg-muted/40">
                  <CoverImage
                    value={m.cover_image_url}
                    alt={m.name}
                    className="h-full w-full object-cover"
                    fallback={
                      <Icon className="h-10 w-10 text-muted-foreground" />
                    }
                  />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{m.name}</h3>
                      <p className="truncate text-xs text-muted-foreground">
                        {[m.make, m.model].filter(Boolean).join(" ") || "—"}
                      </p>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="rounded-md bg-muted px-2 py-0.5">
                      {m.category}
                    </span>
                    <span>{formatNumber(m.current_hours)} hrs/km</span>
                  </div>
                  <Link to={`/machines/${m.id}`} className="mt-2">
                    <Button variant="outline" size="sm" className="w-full">
                      View
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MachineFormDialog
        open={dialog}
        onOpenChange={setDialog}
        onSaved={load}
      />
    </div>
  );
}
