import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { 
  UserCog, 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2, 
  Phone, 
  Wrench, 
  CheckCircle2, 
  Search, 
  ClipboardList,
  ShieldCheck,
  Tag
} from "lucide-react";
import { toast } from "sonner";

export interface WorkshopTechnician {
  id: string;
  name: string;
  phone: string | null;
  specialization: string | null;
  status: "active" | "inactive" | string;
  notes: string | null;
  organisation_id: string;
  created_at: string;
}

export const COMMON_SPECIALIZATIONS = [
  "Heavy Diesel Engine Specialist",
  "Auto-Electrician & ECM Diagnostics",
  "Air Brakes & Pneumatics",
  "Transmission & Differential",
  "Suspension, Kingpins & Chassis",
  "Tyre & Wheel Alignment Specialist",
  "Welder & Panel Beater",
  "Hydraulics & PTO Specialist",
  "Preventive Maintenance & Lube Technician",
  "General Fleet Mechanic",
];

const SPECIALIZATION_COLORS: Record<string, string> = {
  "Heavy Diesel Engine Specialist": "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  "Auto-Electrician & ECM Diagnostics": "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  "Air Brakes & Pneumatics": "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  "Transmission & Differential": "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  "Suspension, Kingpins & Chassis": "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  "Tyre & Wheel Alignment Specialist": "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
  "Welder & Panel Beater": "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20",
  "Hydraulics & PTO Specialist": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  "Preventive Maintenance & Lube Technician": "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20",
  "General Fleet Mechanic": "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",
};

export default function FleetTechnicians() {
  const { profile, user } = useAuth();
  const { canWrite } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [technicians, setTechnicians] = useState<WorkshopTechnician[]>([]);
  const [search, setSearch] = useState("");
  const [specializationFilter, setSpecializationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WorkshopTechnician | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<WorkshopTechnician | null>(null);
  const [activeJobCounts, setActiveJobCounts] = useState<Record<string, number>>({});

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [{ data: techs, error: tErr }, { data: wos, error: wErr }] = await Promise.all([
        (supabase as any)
          .from("garage_mechanics")
          .select("*")
          .order("name"),
        supabase
          .from("work_orders")
          .select("id, status, assignee_id, remarks")
          .in("status", ["open", "assigned", "in_progress", "waiting_parts"]),
      ]);

      if (tErr) toast.error(tErr.message);
      setTechnicians((techs as WorkshopTechnician[]) ?? []);

      // Calculate active assigned work orders
      const counts: Record<string, number> = {};
      (wos ?? []).forEach((w: any) => {
        if (w.assignee_id) {
          counts[w.assignee_id] = (counts[w.assignee_id] || 0) + 1;
        }
        if (w.remarks && typeof w.remarks === "string") {
          (techs ?? []).forEach((t: any) => {
            if (w.remarks.includes(t.id) || w.remarks.includes(t.name)) {
              counts[t.id] = (counts[t.id] || 0) + 1;
            }
          });
        }
      });
      setActiveJobCounts(counts);
    } catch (err: any) {
      toast.error(err.message || "Failed to load technicians");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [profile]);

  const filtered = useMemo(() => {
    return technicians.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (specializationFilter !== "all" && t.specialization !== specializationFilter) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = t.name.toLowerCase().includes(query);
        const matchesPhone = (t.phone || "").toLowerCase().includes(query);
        const matchesSpec = (t.specialization || "").toLowerCase().includes(query);
        const matchesNotes = (t.notes || "").toLowerCase().includes(query);
        if (!matchesName && !matchesPhone && !matchesSpec && !matchesNotes) return false;
      }
      return true;
    });
  }, [technicians, search, specializationFilter, statusFilter]);

  const activeCount = useMemo(() => technicians.filter((t) => t.status === "active").length, [technicians]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const { error } = await (supabase as any)
        .from("garage_mechanics")
        .delete()
        .eq("id", deleteConfirm.id);
      if (error) throw error;
      toast.success(`Technician "${deleteConfirm.name}" removed`);
      setDeleteConfirm(null);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete technician");
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <UserCog className="h-6 w-6 text-primary" />
            Fleet Workshop Technicians
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Register and manage workshop mechanics, auto-electricians, and technicians assigned to vehicle maintenance work orders.
          </p>
        </div>

        {canWrite && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2 shadow-xs cursor-pointer">
            <Plus className="h-4 w-4" /> Register Technician
          </Button>
        )}
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3.5 p-3.5 rounded-xl border border-border bg-card shadow-2xs">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserCog className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-foreground leading-none">{technicians.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Technicians Registered</div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-3.5 rounded-xl border border-border bg-card shadow-2xs">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-foreground leading-none">{activeCount} Active</div>
            <div className="text-xs text-muted-foreground mt-1">Available for Workshop Dispatch</div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-3.5 rounded-xl border border-border bg-card shadow-2xs">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-foreground leading-none">
              {Object.values(activeJobCounts).reduce((acc, c) => acc + c, 0)} Active
            </div>
            <div className="text-xs text-muted-foreground mt-1">Active Assigned Maintenance Jobs</div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, trade, notes..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={specializationFilter} onValueChange={setSpecializationFilter}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <SelectValue placeholder="All Specializations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Specializations</SelectItem>
              {COMMON_SPECIALIZATIONS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Technicians List / Cards */}
      {technicians.length === 0 ? (
        <EmptyState
          icon={<UserCog className="h-5 w-5" />}
          title="No workshop technicians registered yet"
          description="Register your fleet workshop mechanics and technicians to assign maintenance work orders directly to them."
          action={
            canWrite ? (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2">
                <Plus className="h-4 w-4" /> Register First Technician
              </Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
          No technicians found matching your search filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tech) => {
            const activeJobs = activeJobCounts[tech.id] || 0;
            const badgeClass = tech.specialization ? SPECIALIZATION_COLORS[tech.specialization] || "bg-muted text-foreground" : "bg-muted text-muted-foreground";

            return (
              <div
                key={tech.id}
                className="group relative rounded-xl border border-border bg-card p-4 space-y-3.5 shadow-2xs hover:shadow-md transition-all hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                      <Wrench className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-sm leading-tight group-hover:text-primary transition-colors">
                        {tech.name}
                      </h3>
                      {tech.phone ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                          <Phone className="h-3 w-3" />
                          <a href={`tel:${tech.phone}`} className="hover:underline font-mono">
                            {tech.phone}
                          </a>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/60 italic mt-1 block">No phone recorded</span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
                      tech.status === "active"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {tech.status}
                  </span>
                </div>

                {tech.specialization && (
                  <div className="flex items-center gap-1.5">
                    <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className={`text-xs px-2 py-0.5 rounded-md border font-medium truncate ${badgeClass}`}>
                      {tech.specialization}
                    </span>
                  </div>
                )}

                {tech.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/30 p-2 rounded-lg border border-border/50">
                    {tech.notes}
                  </p>
                )}

                <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-medium">
                    <ClipboardList className="h-3.5 w-3.5 text-primary" />
                    <span>{activeJobs} active {activeJobs === 1 ? "work order" : "work orders"}</span>
                  </div>

                  {canWrite && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Edit Technician"
                        onClick={() => { setEditing(tech); setFormOpen(true); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive cursor-pointer"
                        title="Delete Technician"
                        onClick={() => setDeleteConfirm(tech)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Technician Dialog */}
      <TechnicianDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        orgId={profile?.organisation_id}
        userId={user?.id}
        onSaved={load}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(v) => !v && setDeleteConfirm(null)}
        title={`Delete technician "${deleteConfirm?.name}"?`}
        description="This will remove the technician record. Past work orders referencing this technician will remain in the system."
        onConfirm={handleDelete}
      />
    </div>
  );
}

export function TechnicianDialog({
  open,
  onOpenChange,
  editing,
  orgId,
  userId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: WorkshopTechnician | null;
  orgId?: string;
  userId?: string;
  onSaved: (createdOrUpdated?: WorkshopTechnician) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [customSpec, setCustomSpec] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    specialization: "",
    status: "active",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      if (editing) {
        const inCommon = COMMON_SPECIALIZATIONS.includes(editing.specialization || "");
        setCustomSpec(!inCommon && Boolean(editing.specialization));
        setForm({
          name: editing.name || "",
          phone: editing.phone || "",
          specialization: editing.specialization || "",
          status: editing.status || "active",
          notes: editing.notes || "",
        });
      } else {
        setCustomSpec(false);
        setForm({
          name: "",
          phone: "",
          specialization: COMMON_SPECIALIZATIONS[0],
          status: "active",
          notes: "",
        });
      }
    }
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Technician full name is required");
      return;
    }
    if (!orgId) {
      toast.error("Organisation missing");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        specialization: form.specialization.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
      };

      if (editing) {
        const { data, error } = await (supabase as any)
          .from("garage_mechanics")
          .update(payload)
          .eq("id", editing.id)
          .select()
          .single();
        if (error) throw error;
        toast.success(`Technician "${form.name}" updated successfully`);
        onOpenChange(false);
        onSaved(data);
      } else {
        const { data, error } = await (supabase as any)
          .from("garage_mechanics")
          .insert({
            ...payload,
            organisation_id: orgId,
            created_by: userId || null,
          })
          .select()
          .single();
        if (error) throw error;
        toast.success(`Technician "${form.name}" registered successfully`);
        onOpenChange(false);
        onSaved(data);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save technician");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            {editing ? "Edit Workshop Technician" : "Register Workshop Technician"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Technician Full Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Rashid Hamisi Mwamba"
              required
              autoFocus
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Phone Number</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. +255 754 123 456"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active (On Duty)</SelectItem>
                  <SelectItem value="inactive">Inactive / On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Trade / Primary Specialization</Label>
              {form.specialization && (
                <span className="text-[10px] font-mono text-primary font-medium truncate max-w-[200px]">
                  {form.specialization}
                </span>
              )}
            </div>
            <Select
              value={
                customSpec
                  ? "OTHER"
                  : (COMMON_SPECIALIZATIONS.includes(form.specialization) ? form.specialization : "OTHER")
              }
              onValueChange={(val) => {
                if (val === "OTHER") {
                  setCustomSpec(true);
                } else {
                  setCustomSpec(false);
                  setForm({ ...form, specialization: val });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select trade specialization..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {COMMON_SPECIALIZATIONS.map((spec) => (
                  <SelectItem key={spec} value={spec}>
                    {spec}
                  </SelectItem>
                ))}
                <SelectItem value="OTHER">Other / Custom Trade...</SelectItem>
              </SelectContent>
            </Select>

            {customSpec && (
              <Input
                value={form.specialization}
                onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                placeholder="Type custom trade (e.g. Cummins ISX Diagnostic Specialist)"
                className="text-xs mt-1.5"
                autoFocus
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Notes, Certifications or Bay (Optional)</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Certified Scania technician, Workshop Bay 3, night shift"
              className="text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save Changes" : "Register Technician"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
