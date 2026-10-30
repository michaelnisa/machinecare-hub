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
import { Truck, Search, Plus, Pencil, Loader2, Upload, ClipboardList, QrCode, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";
import { MachineQrDialog } from "@/components/MachineQrDialog";
import { BulkImporterModal } from "@/components/BulkImporterModal";

type Machine = {
  id: string;
  name: string;
  plate_number: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  fuel_type: string | null;
  vehicle_type: string | null;
  has_trailer: boolean | null;
  trailer_plate: string | null;
  trailer_make_model: string | null;
  head_tank_capacity_l: number | null;
  trailer_tank_capacity_l: number | null;
  total_tank_capacity_l: number | null;
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

const VEHICLE_TYPES = [
  { value: "truck", label: "Commercial Hauler / Truck" },
  { value: "prime_mover", label: "Prime Mover / Tractor Head" },
  { value: "tanker", label: "Tanker Truck (Fuel / Liquid)" },
  { value: "trailer", label: "Trailer / Semi-Trailer" },
  { value: "rigid", label: "Rigid Truck" },
  { value: "van_pickup", label: "Van / Pickup / Utility" },
  { value: "bus", label: "Bus / Commuter" },
  { value: "other", label: "Other" },
];

const EMPTY_FORM = {
  name: "",
  plate_number: "",
  make: "",
  model: "",
  year: "",
  vin: "",
  fuel_type: "diesel",
  vehicle_type: "truck",
  has_trailer: false,
  trailer_plate: "",
  trailer_make_model: "",
  head_tank_capacity_l: "",
  trailer_tank_capacity_l: "",
  total_tank_capacity_l: "",
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
  const [qrOpen, setQrOpen] = useState(false);
  const [qrMachine, setQrMachine] = useState<Machine | null>(null);
  const [importOpen, setImportOpen] = useState(false);

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
        .select("id, name, plate_number, make, model, year, vin, fuel_type, vehicle_type, has_trailer, trailer_plate, trailer_make_model, head_tank_capacity_l, trailer_tank_capacity_l, total_tank_capacity_l, tank_capacity_l, status, current_odometer_km, home_depot, cover_image_url")
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
      if (
        !m.name.toLowerCase().includes(q) &&
        !(m.plate_number ?? "").toLowerCase().includes(q) &&
        !(m.trailer_plate ?? "").toLowerCase().includes(q) &&
        !(m.make ?? "").toLowerCase().includes(q) &&
        !(m.model ?? "").toLowerCase().includes(q)
      ) return false;
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
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Import Excel / CSV
            </Button>
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> {t.fleet.addVehicle}
            </Button>
          </div>
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
            <table className="w-full min-w-[1150px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">{t.fleet.colVehicle}</th>
                  <th className="px-5 py-3 font-medium">Plate & Trailer</th>
                  <th className="px-5 py-3 font-medium">Tank (Head / Trailer / Total)</th>
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
                  const totalTank = m.total_tank_capacity_l ?? m.tank_capacity_l;
                  const hasMultiTank = m.has_trailer || m.head_tank_capacity_l != null || m.trailer_tank_capacity_l != null;

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
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                              {[m.make, m.model, m.year].filter(Boolean).join(" · ")}
                              {m.vehicle_type && (
                                <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-medium capitalize text-muted-foreground border">
                                  {m.vehicle_type.replace("_", " ")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-foreground">{m.plate_number ?? "—"}</div>
                        {m.has_trailer && m.trailer_plate ? (
                          <div className="mt-0.5 inline-flex items-center gap-1">
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary border border-primary/20">
                              Trailer: {m.trailer_plate}
                            </span>
                          </div>
                        ) : m.has_trailer ? (
                          <span className="text-[11px] text-muted-foreground italic">Trailer hitched</span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        {totalTank ? (
                          <div>
                            <div className="font-medium text-foreground">{formatNumber(totalTank)} L <span className="text-[10px] text-muted-foreground font-normal">Total</span></div>
                            {hasMultiTank && (m.head_tank_capacity_l != null || m.trailer_tank_capacity_l != null) && (
                              <div className="text-[11px] text-muted-foreground">
                                Head: {m.head_tank_capacity_l != null ? `${formatNumber(m.head_tank_capacity_l)}L` : "—"} · Trl: {m.trailer_tank_capacity_l != null ? `${formatNumber(m.trailer_tank_capacity_l)}L` : "—"}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {driver ? (
                          <>
                            {driver.name}
                            {driver.onTrip && <span className="ml-1.5 text-xs text-primary font-medium">· on trip</span>}
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
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setQrMachine(m); setQrOpen(true); }}
                            title="Vehicle QR Code"
                          >
                            <QrCode className="h-4 w-4 text-primary" />
                          </Button>
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

      {qrMachine && (
        <MachineQrDialog
          open={qrOpen}
          onOpenChange={setQrOpen}
          machineId={qrMachine.id}
          machineName={qrMachine.name}
          qrEnabled={true}
          plateNumber={qrMachine.plate_number}
          currentHours={qrMachine.current_odometer_km}
          category="Vehicle"
          organisationName={profile?.organisation_id}
        />
      )}

      <BulkImporterModal
        entity="vehicle"
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={load}
      />
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
              vehicle_type: machine.vehicle_type ?? "truck",
              has_trailer: !!machine.has_trailer,
              trailer_plate: machine.trailer_plate ?? "",
              trailer_make_model: machine.trailer_make_model ?? "",
              head_tank_capacity_l: machine.head_tank_capacity_l != null ? String(machine.head_tank_capacity_l) : (machine.tank_capacity_l != null ? String(machine.tank_capacity_l) : ""),
              trailer_tank_capacity_l: machine.trailer_tank_capacity_l != null ? String(machine.trailer_tank_capacity_l) : "",
              total_tank_capacity_l: machine.total_tank_capacity_l != null ? String(machine.total_tank_capacity_l) : (machine.tank_capacity_l != null ? String(machine.tank_capacity_l) : ""),
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

  const updateHeadTank = (val: string) => {
    const headNum = Number(val) || 0;
    const trailerNum = form.has_trailer ? (Number(form.trailer_tank_capacity_l) || 0) : 0;
    const total = headNum + trailerNum;
    setForm((prev) => ({
      ...prev,
      head_tank_capacity_l: val,
      total_tank_capacity_l: total > 0 ? String(total) : (val ? val : ""),
      tank_capacity_l: total > 0 ? String(total) : (val ? val : ""),
    }));
  };

  const updateTrailerTank = (val: string) => {
    const headNum = Number(form.head_tank_capacity_l) || 0;
    const trailerNum = Number(val) || 0;
    const total = headNum + trailerNum;
    setForm((prev) => ({
      ...prev,
      trailer_tank_capacity_l: val,
      total_tank_capacity_l: total > 0 ? String(total) : (headNum > 0 ? String(headNum) : ""),
      tank_capacity_l: total > 0 ? String(total) : (headNum > 0 ? String(headNum) : ""),
    }));
  };

  const toggleTrailer = (has: boolean) => {
    const headNum = Number(form.head_tank_capacity_l) || Number(form.tank_capacity_l) || 0;
    const trailerNum = has ? (Number(form.trailer_tank_capacity_l) || 0) : 0;
    const total = headNum + trailerNum;
    setForm((prev) => ({
      ...prev,
      has_trailer: has,
      head_tank_capacity_l: prev.head_tank_capacity_l || prev.tank_capacity_l || "",
      total_tank_capacity_l: total > 0 ? String(total) : (headNum > 0 ? String(headNum) : ""),
      tank_capacity_l: total > 0 ? String(total) : (headNum > 0 ? String(headNum) : ""),
    }));
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

      const headCap = form.head_tank_capacity_l ? Number(form.head_tank_capacity_l) : (form.tank_capacity_l ? Number(form.tank_capacity_l) : null);
      const trailerCap = form.has_trailer && form.trailer_tank_capacity_l ? Number(form.trailer_tank_capacity_l) : null;
      const totalCap = form.total_tank_capacity_l ? Number(form.total_tank_capacity_l) : ((headCap || 0) + (trailerCap || 0) || null);

      const payload = {
        name: form.name.trim(),
        plate_number: form.plate_number.trim() || null,
        make: form.make.trim() || null,
        model: form.model.trim() || null,
        year: form.year ? Number(form.year) : null,
        vin: form.vin.trim() || null,
        fuel_type: form.fuel_type || null,
        vehicle_type: form.vehicle_type || null,
        has_trailer: form.has_trailer,
        trailer_plate: form.has_trailer ? (form.trailer_plate.trim() || null) : null,
        trailer_make_model: form.has_trailer ? (form.trailer_make_model.trim() || null) : null,
        head_tank_capacity_l: headCap,
        trailer_tank_capacity_l: trailerCap,
        total_tank_capacity_l: totalCap,
        tank_capacity_l: totalCap ?? headCap,
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
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast.error(msg);
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
                placeholder="e.g. Scania R500 Prime Mover / Tanker 01"
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Vehicle Type</Label>
              <Select value={form.vehicle_type} onValueChange={(v) => {
                const isHeavy = v === "prime_mover" || v === "tanker" || v === "trailer";
                setForm((prev) => ({
                  ...prev,
                  vehicle_type: v,
                  has_trailer: isHeavy ? true : prev.has_trailer,
                }));
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((vt) => (
                    <SelectItem key={vt.value} value={vt.value}>{vt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="e.g. Scania / Mercedes-Benz / Sinotruk" />
            </div>

            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="e.g. R500 / Actros 3340" />
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
              <Label>Current odometer (km)</Label>
              <Input type="number" step="any" value={form.current_odometer_km} onChange={(e) => setForm({ ...form, current_odometer_km: e.target.value })} />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Home depot / Base station</Label>
              <Input value={form.home_depot} onChange={(e) => setForm({ ...form, home_depot: e.target.value })} placeholder="e.g. Dar es Salaam Depot / Kurasini Yard" />
            </div>

            {/* Trailer & Tank Capacity Specification Section */}
            <div className="sm:col-span-2 rounded-xl border border-border bg-muted/30 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" /> Trailer & Tank Specifications
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Configure attached trailer, head tank capacity, trailer tank, and total capacity.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.has_trailer}
                    onChange={(e) => toggleTrailer(e.target.checked)}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <span>Attach Trailer</span>
                </label>
              </div>

              {form.has_trailer && (
                <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-border">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Trailer Plate Number *</Label>
                    <Input
                      value={form.trailer_plate}
                      onChange={(e) => setForm({ ...form, trailer_plate: e.target.value })}
                      placeholder="e.g. T 892 DFE"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Trailer Model / Specification</Label>
                    <Input
                      value={form.trailer_make_model}
                      onChange={(e) => setForm({ ...form, trailer_make_model: e.target.value })}
                      placeholder="e.g. 40,000L Tri-Axle Tanker Semi-Trailer"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Tank Capacities: Head Tank, Trailer Tank, Total */}
              <div className="grid gap-3 sm:grid-cols-3 pt-2 border-t border-border">
                <div className="space-y-1.5">
                  <Label className="text-xs">Head Tank Capacity (L)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.head_tank_capacity_l}
                    onChange={(e) => updateHeadTank(e.target.value)}
                    placeholder="e.g. 450"
                    className="h-9 text-sm"
                  />
                  <span className="text-[10px] text-muted-foreground">Tractor / Head fuel tank</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Trailer Tank Capacity (L)</Label>
                  <Input
                    type="number"
                    step="any"
                    disabled={!form.has_trailer}
                    value={form.trailer_tank_capacity_l}
                    onChange={(e) => updateTrailerTank(e.target.value)}
                    placeholder={form.has_trailer ? "e.g. 40000" : "Enable trailer first"}
                    className="h-9 text-sm"
                  />
                  <span className="text-[10px] text-muted-foreground">Trailer payload / aux tank</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-primary">Total Tank Capacity (L)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="any"
                      value={form.total_tank_capacity_l}
                      onChange={(e) => setForm({ ...form, total_tank_capacity_l: e.target.value, tank_capacity_l: e.target.value })}
                      placeholder="e.g. 40450"
                      className="h-9 text-sm font-semibold border-primary/40 bg-background"
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Auto-sum: Head + Trailer = Total
                  </span>
                </div>
              </div>
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
