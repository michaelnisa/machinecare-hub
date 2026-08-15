import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { StatusBadge } from "@/components/StatusBadge";
import { CoverImage } from "@/components/CoverImage";
import { scheduleStatus } from "@/lib/machine-constants";
import { formatNumber } from "@/lib/format";
import { Truck, Search, Plus, Pencil, Loader2, Upload, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";

type Machine = {
  id: string;
  name: string;
  plate_number: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  fuel_type: string | null;
  tank_capacity_l: number | null;
  status: string;
  current_odometer_km: number | null;
  home_depot: string | null;
  cover_image_url: string | null;
};

type Trip = {
  machine_id: string;
  driver_id: string | null;
  status: string;
  start_at: string | null;
};

type Schedule = {
  machine_id: string;
  next_due_date: string | null;
};

type VehicleDoc = {
  machine_id: string;
  expires_on: string | null;
};

type Driver = { id: string; full_name: string };

const FUEL_TYPES = ["diesel", "petrol", "electric", "hybrid"];

const EMPTY_FORM = {
  name: "",
  plate_number: "",
  make: "",
  model: "",
  year: "",
  vin: "",
  fuel_type: "diesel",
  tank_capacity_l: "",
  current_odometer_km: "",
  home_depot: "",
  status: "active",
};

export default function Vehicles() {
  const { profile } = useAuth();
  const { canWrite } = useUserRole();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [docs, setDocs] = useState<VehicleDoc[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [
      { data: m, error: e1 },
      { data: t, error: e2 },
      { data: s, error: e3 },
      { data: doc, error: e4 },
      { data: d, error: e5 },
    ] = await Promise.all([
      supabase
        .from("machines")
        .select("id, name, plate_number, make, model, year, vin, fuel_type, tank_capacity_l, status, current_odometer_km, home_depot, cover_image_url")
        .eq("category", "Vehicle")
        .order("name"),
      supabase.from("trips").select("machine_id, driver_id, status, start_at").order("start_at", { ascending: false }),
      supabase.from("service_schedules").select("machine_id, next_due_date").order("next_due_date", { nullsFirst: false }),
      supabase.from("vehicle_documents").select("machine_id, expires_on").order("expires_on", { nullsFirst: false }),
      supabase.from("drivers").select("id, full_name"),
    ]);
    const err = e1 || e2 || e3 || e4 || e5;
    if (err) toast.error(err.message);
    setMachines((m ?? []) as Machine[]);
    setTrips((t ?? []) as Trip[]);
    setSchedules((s ?? []) as Schedule[]);
    setDocs((doc ?? []) as VehicleDoc[]);
    setDrivers((d ?? []) as Driver[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const driverMap = useMemo(() => new Map(drivers.map((d) => [d.id, d.full_name])), [drivers]);

  // Current driver per vehicle: driver on the latest in_progress trip, else the most recent trip's driver.
  const currentDriver = useMemo(() => {
    const map = new Map<string, { name: string; onTrip: boolean }>();
    for (const t of trips) {
      if (map.has(t.machine_id)) continue;
      if (!t.driver_id) continue;
      map.set(t.machine_id, { name: driverMap.get(t.driver_id) ?? "—", onTrip: t.status === "in_progress" });
    }
    return map;
  }, [trips, driverMap]);

  // Earliest upcoming service due date per vehicle
  const nextDueByMachine = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of schedules) {
      if (!s.next_due_date) continue;
      const existing = map.get(s.machine_id);
      if (!existing || new Date(s.next_due_date) < new Date(existing)) map.set(s.machine_id, s.next_due_date);
    }
    return map;
  }, [schedules]);

  // Earliest expiring document (insurance, road licence, etc.) per vehicle
  const nextDocExpiryByMachine = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of docs) {
      if (!doc.expires_on) continue;
      const existing = map.get(doc.machine_id);
      if (!existing || new Date(doc.expires_on) < new Date(existing)) map.set(doc.machine_id, doc.expires_on);
    }
    return map;
  }, [docs]);

  const filtered = machines.filter((m) => {
    if (status !== "all" && m.status !== status) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!m.name.toLowerCase().includes(q) && !(m.plate_number ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.fleet.vehiclesTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.fleet.vehiclesSub}</p>
        </div>
        {canWrite && (
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> {t.fleet.addVehicle}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.fleet.searchVehicles} className="pl-9" />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">{t.fleet.allStatuses}</option>
          <option value="active">Active</option>
          <option value="under_maintenance">Under maintenance</option>
          <option value="retired">Retired</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Truck className="h-5 w-5" />}
          title={machines.length === 0 ? t.fleet.noVehiclesTitle : t.fleet.noVehiclesFiltered}
          description={
            machines.length === 0
              ? t.fleet.noVehiclesDesc
              : "Try changing or clearing filters."
          }
          action={
            machines.length === 0 && canWrite ? (
              <Button onClick={() => { setEditing(null); setOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" /> {t.fleet.addVehicle}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3 text-sm font-medium">{t.fleet.vehiclesTitle} ({filtered.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">{t.fleet.colVehicle}</th>
                  <th className="px-5 py-3 font-medium">{t.fleet.colPlate}</th>
                  <th className="px-5 py-3 font-medium">{t.fleet.colDriver}</th>
                  <th className="px-5 py-3 font-medium">{t.fleet.colOdometer}</th>
                  <th className="px-5 py-3 font-medium">{t.fleet.colNextService}</th>
                  <th className="px-5 py-3 font-medium">{t.fleet.colDocs}</th>
                  <th className="px-5 py-3 font-medium">{t.fleet.colDepot}</th>
                  <th className="px-5 py-3 font-medium">{t.fleet.colStatus}</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const driver = currentDriver.get(m.id);
                  const nextDue = nextDueByMachine.get(m.id) ?? null;
                  const nextDocExpiry = nextDocExpiryByMachine.get(m.id) ?? null;
                  return (
                    <tr key={m.id} className="border-t border-border hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                            <CoverImage
                              value={m.cover_image_url}
                              alt={m.name}
                              className="h-full w-full object-cover"
                              fallback={<Truck className="h-4 w-4 text-muted-foreground" />}
                            />
                          </div>
                          <div>
                            <Link to={`/machines/${m.id}`} className="font-medium hover:underline">{m.name}</Link>
                            {(m.make || m.model) && (
                              <div className="text-xs text-muted-foreground">{[m.make, m.model, m.year].filter(Boolean).join(" · ")}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{m.plate_number ?? "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {driver ? (
                          <>
                            {driver.name}
                            {driver.onTrip && <span className="ml-1.5 text-xs text-primary">· on trip</span>}
                          </>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{formatNumber(m.current_odometer_km)} km</td>
                      <td className="px-5 py-3">
                        {nextDue ? <StatusBadge status={scheduleStatus(nextDue)} /> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        {nextDocExpiry ? (
                          <div className="flex flex-col gap-0.5">
                            <StatusBadge status={scheduleStatus(nextDocExpiry)} />
                            <span className="text-[10px] text-muted-foreground">exp. {new Date(nextDocExpiry).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{m.home_depot ?? "—"}</td>
                      <td className="px-5 py-3"><StatusBadge status={m.status} /></td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canWrite && (
                            <Button variant="ghost" size="icon" asChild title={t.fleet.newJobCard}>
                              <Link to={`/work-orders/new?machine=${m.id}`}>
                                <ClipboardList className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                          {canWrite && (
                            <Button variant="ghost" size="icon" onClick={() => { setEditing(m); setOpen(true); }} title={t.fleet.editVehicle}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <VehicleDialog open={open} onOpenChange={setOpen} machine={editing} onSaved={load} />
    </div>
  );
}

function VehicleDialog({ open, onOpenChange, machine, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machine: Machine | null;
  onSaved: () => void;
}) {
  const { profile, user } = useAuth();
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(
        machine
          ? {
              name: machine.name,
              plate_number: machine.plate_number ?? "",
              make: machine.make ?? "",
              model: machine.model ?? "",
              year: machine.year != null ? String(machine.year) : "",
              vin: machine.vin ?? "",
              fuel_type: machine.fuel_type ?? "diesel",
              tank_capacity_l: machine.tank_capacity_l != null ? String(machine.tank_capacity_l) : "",
              current_odometer_km: machine.current_odometer_km != null ? String(machine.current_odometer_km) : "",
              home_depot: machine.home_depot ?? "",
              status: machine.status,
            }
          : EMPTY_FORM,
      );
      setPhotoFile(null);
      setPhotoPreview(null);
    }
  }, [open, machine]);

  const onPhotoSelected = (file: File | null) => {
    if (!file) { setPhotoFile(null); setPhotoPreview(null); return; }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo too large. Please keep it under 5 MB.");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!form.name.trim()) return toast.error("Vehicle name is required");
    setSubmitting(true);
    try {
      let coverUrl: string | null = machine?.cover_image_url ?? null;
      if (photoFile) {
        const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${profile.organisation_id}/covers/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("machine-docs")
          .upload(path, photoFile, { contentType: photoFile.type, upsert: false });
        if (upErr) throw upErr;
        coverUrl = path;
      }

      const payload = {
        name: form.name.trim(),
        plate_number: form.plate_number.trim() || null,
        make: form.make.trim() || null,
        model: form.model.trim() || null,
        year: form.year ? Number(form.year) : null,
        vin: form.vin.trim() || null,
        fuel_type: form.fuel_type || null,
        tank_capacity_l: form.tank_capacity_l ? Number(form.tank_capacity_l) : null,
        current_odometer_km: form.current_odometer_km ? Number(form.current_odometer_km) : null,
        home_depot: form.home_depot.trim() || null,
        status: form.status,
        cover_image_url: coverUrl,
      };
      const { error } = machine
        ? await supabase.from("machines").update(payload).eq("id", machine.id)
        : await supabase.from("machines").insert({ ...payload, category: "Vehicle", organisation_id: profile.organisation_id });
      if (error) throw error;

      // Keep the status audit trail (used for downtime tracking) in sync — this
      // dialog can change status but, unlike MachineStatusControl, doesn't force
      // a reason through it, so log it as a quick edit.
      if (machine && form.status !== machine.status) {
        await supabase.from("machine_status_history").insert({
          organisation_id: profile.organisation_id,
          machine_id: machine.id,
          from_status: machine.status,
          to_status: form.status,
          reason: "Updated via vehicle edit form",
          changed_by: user?.id ?? null,
        });
      }

      toast.success(machine ? "Vehicle updated" : "Vehicle added");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{machine ? t.fleet.editVehicle : t.fleet.addVehicle}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Vehicle photo</Label>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Selected vehicle" className="h-full w-full object-cover" />
                  ) : (
                    <CoverImage
                      value={machine?.cover_image_url}
                      alt={form.name || "Vehicle"}
                      className="h-full w-full object-cover"
                      fallback={<Truck className="h-5 w-5 text-muted-foreground" />}
                    />
                  )}
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
                  <Upload className="h-4 w-4" />
                  <span>{photoFile ? photoFile.name : "Choose photo"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPhotoSelected(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                JPG or PNG, landscape works best. Max 5 MB — aim for under 500 KB for fast loading on mobile.
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Vehicle name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Toyota Hilux — Depot 2"
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Plate number</Label>
              <Input value={form.plate_number} onChange={(e) => setForm({ ...form, plate_number: e.target.value })} placeholder="e.g. T123 ABC" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="under_maintenance">Under maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Make</Label>
              <Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="e.g. Toyota" />
            </div>
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="e.g. Hilux" />
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="e.g. 2022" />
            </div>
            <div className="space-y-1.5">
              <Label>VIN / chassis number</Label>
              <Input value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Fuel type</Label>
              <Select value={form.fuel_type} onValueChange={(v) => setForm({ ...form, fuel_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FUEL_TYPES.map((f) => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tank capacity (litres)</Label>
              <Input type="number" step="any" value={form.tank_capacity_l} onChange={(e) => setForm({ ...form, tank_capacity_l: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Current odometer (km)</Label>
              <Input type="number" step="any" value={form.current_odometer_km} onChange={(e) => setForm({ ...form, current_odometer_km: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Home depot</Label>
              <Input value={form.home_depot} onChange={(e) => setForm({ ...form, home_depot: e.target.value })} placeholder="e.g. Dar es Salaam yard" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {machine ? t.common.save : t.fleet.addVehicle}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
