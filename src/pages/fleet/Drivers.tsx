import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { CoverImage } from "@/components/CoverImage";
import {
  Contact,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Upload,
  User,
  Shield,
  Phone,
  Eye,
  HeartHandshake,
  Copy,
  Check,
  RefreshCw,
  Mail,
  Calendar,
  CreditCard,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { scheduleStatus } from "@/lib/machine-constants";
import { useI18n } from "@/i18n/I18nProvider";
import {
  SAFE_DRIVER_COLUMNS,
  parseDriver,
  serializeDriverPayload,
  generateDriverCode,
  type FleetDriver,
} from "@/lib/fleet-metadata";

type Driver = FleetDriver;

const OTHER_ID_TYPES = [
  "Voter ID",
  "Resident Permit",
  "Alien ID",
  "Military ID",
  "Tax / TIN Card",
  "Other ID",
];

const NOK_RELATIONS = [
  "Spouse",
  "Parent",
  "Sibling",
  "Child",
  "Relative",
  "Next of Kin",
  "Other",
];

const EMPTY_FORM = {
  driver_code: "",
  full_name: "",
  phone: "",
  email: "",
  licence_number: "",
  licence_class: "",
  licence_expiry: "",
  medical_expiry: "",
  passport_number: "",
  nida_number: "",
  other_id_type: "Voter ID",
  other_id_number: "",
  photo_url: "",
  next_of_kin_name: "",
  next_of_kin_relation: "Spouse",
  next_of_kin_phone: "",
  next_of_kin_nida: "",
  next_of_kin_photo_url: "",
  status: "active",
  notes: "",
};

export default function Drivers() {
  const { profile } = useAuth();
  const { isManager, canWrite } = useUserRole();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [nokDriver, setNokDriver] = useState<Driver | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("drivers")
      .select(SAFE_DRIVER_COLUMNS)
      .order("full_name");
    if (error) toast.error(error.message);
    setDrivers((data ?? []).map(parseDriver));
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter((d) =>
      [
        d.full_name,
        d.driver_code,
        d.phone,
        d.email,
        d.licence_number,
        d.nida_number,
        d.passport_number,
        d.other_id_number,
        d.next_of_kin_name,
        d.next_of_kin_phone,
      ]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q)),
    );
  }, [drivers, search]);

  const worstExpiryStatus = (d: Driver) => {
    const lic = scheduleStatus(d.licence_expiry);
    const med = scheduleStatus(d.medical_expiry);
    if (lic === "overdue" || med === "overdue") return "overdue";
    if (lic === "due_soon" || med === "due_soon") return "due_soon";
    return "ok";
  };

  const handleDelete = async () => {
    if (!confirm) return;
    const { error } = await supabase.from("drivers").delete().eq("id", confirm);
    if (error) return toast.error(error.message);
    toast.success("Driver removed");
    setConfirm(null);
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.fleet.driversTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.fleet.driversSub}</p>
        </div>
        {canWrite && (
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> {t.fleet.addDriver}
          </Button>
        )}
      </div>

      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, driver ID, phone, licence, NIDA…"
          className="pl-9"
        />
      </div>

      {drivers.length === 0 ? (
        <EmptyState
          icon={<Contact className="h-5 w-5" />}
          title="No drivers yet"
          description="Add your first driver to start tracking licences, NIDA, and Next of Kin emergency details."
          action={canWrite ? <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> New driver</Button> : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="border-b border-border px-5 py-3.5 text-sm font-medium flex items-center justify-between">
            <span>Drivers List ({filtered.length})</span>
            <span className="text-xs text-muted-foreground">Click any driver name to view complete profile & KYC</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/20">
                <tr>
                  <th className="px-5 py-3.5 font-medium">Driver & ID</th>
                  <th className="px-5 py-3.5 font-medium">Contact</th>
                  <th className="px-5 py-3.5 font-medium">Licence</th>
                  <th className="px-5 py-3.5 font-medium">Status</th>
                  <th className="px-5 py-3.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr
                    key={d.id}
                    className="border-t border-border hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedDriver(d)}
                          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer focus:outline-none"
                          title="Click to view driver details"
                        >
                          <CoverImage
                            value={d.photo_url}
                            alt={d.full_name}
                            className="h-full w-full object-cover"
                            fallback={<User className="h-5 w-5 text-muted-foreground" />}
                          />
                        </button>
                        <div>
                          <button
                            type="button"
                            onClick={() => setSelectedDriver(d)}
                            className="text-left group cursor-pointer focus:outline-none block"
                            title="Click to view full driver details"
                          >
                            <div className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-2 flex-wrap">
                              <span className="text-base">{d.full_name}</span>
                              <span className="font-mono text-[11px] font-bold text-primary bg-primary/10 border border-primary/25 px-2 py-0.5 rounded inline-flex items-center gap-1 shadow-2xs">
                                <CreditCard className="h-3 w-3" />
                                {d.driver_code}
                              </span>
                            </div>
                          </button>
                          {d.user_notes ? (
                            <div className="text-xs text-muted-foreground line-clamp-1 italic mt-0.5">
                              {d.user_notes}
                            </div>
                          ) : (
                            <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                              <span className="text-primary hover:underline cursor-pointer" onClick={() => setSelectedDriver(d)}>View profile details</span>
                              {d.nida_number && <span className="text-[10px] text-muted-foreground font-mono">• NIDA: {d.nida_number}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      <div className="font-medium text-foreground">{d.phone ?? "—"}</div>
                      {d.email && <div className="text-xs text-muted-foreground">{d.email}</div>}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      <div className="font-medium text-foreground">
                        {d.licence_number ?? "—"} {d.licence_class ? `(${d.licence_class})` : ""}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs">
                        <span className="flex items-center gap-1">
                          <StatusBadge status={scheduleStatus(d.licence_expiry)} />
                          <span>Lic: {formatDate(d.licence_expiry)}</span>
                        </span>
                        {d.medical_expiry && (
                          <span className="text-[11px] text-muted-foreground">Med: {formatDate(d.medical_expiry)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={d.status === "active" ? worstExpiryStatus(d) === "overdue" ? "overdue" : "active" : "retired"} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5 cursor-pointer"
                          onClick={() => setSelectedDriver(d)}
                        >
                          <Eye className="h-3.5 w-3.5 text-primary" /> View Profile
                        </Button>
                        {canWrite && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 cursor-pointer"
                            onClick={() => { setEditing(d); setOpen(true); }}
                            title="Edit driver"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {isManager && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                            onClick={() => setConfirm(d.id)}
                            title="Remove driver"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DriverDialog open={open} onOpenChange={setOpen} driver={editing} onSaved={load} />

      {selectedDriver && (
        <DriverDetailModal
          open={!!selectedDriver}
          onOpenChange={(v) => !v && setSelectedDriver(null)}
          driver={selectedDriver}
          onEdit={() => {
            const d = selectedDriver;
            setSelectedDriver(null);
            setEditing(d);
            setOpen(true);
          }}
          onViewNextOfKin={() => {
            const d = selectedDriver;
            setSelectedDriver(null);
            setNokDriver(d);
          }}
        />
      )}

      {nokDriver && (
        <NextOfKinModal
          open={!!nokDriver}
          onOpenChange={(v) => !v && setNokDriver(null)}
          driver={nokDriver}
          onEdit={() => {
            const d = nokDriver;
            setNokDriver(null);
            setEditing(d);
            setOpen(true);
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Remove this driver?"
        description="This deletes the driver record permanently."
        onConfirm={async () => { await handleDelete(); }}
      />
    </div>
  );
}

function DriverDialog({ open, onOpenChange, driver, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  driver: Driver | null;
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [driverPhotoFile, setDriverPhotoFile] = useState<File | null>(null);
  const [driverPhotoPreview, setDriverPhotoPreview] = useState<string | null>(null);
  const [nokPhotoFile, setNokPhotoFile] = useState<File | null>(null);
  const [nokPhotoPreview, setNokPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(
        driver
          ? {
              driver_code: driver.driver_code,
              full_name: driver.full_name,
              phone: driver.phone ?? "",
              email: driver.email ?? "",
              licence_number: driver.licence_number ?? "",
              licence_class: driver.licence_class ?? "",
              licence_expiry: driver.licence_expiry ?? "",
              medical_expiry: driver.medical_expiry ?? "",
              passport_number: driver.passport_number ?? "",
              nida_number: driver.nida_number ?? "",
              other_id_type: driver.other_id_type ?? "Voter ID",
              other_id_number: driver.other_id_number ?? "",
              photo_url: driver.photo_url ?? "",
              next_of_kin_name: driver.next_of_kin_name ?? "",
              next_of_kin_relation: driver.next_of_kin_relation ?? "Spouse",
              next_of_kin_phone: driver.next_of_kin_phone ?? "",
              next_of_kin_nida: driver.next_of_kin_nida ?? "",
              next_of_kin_photo_url: driver.next_of_kin_photo_url ?? "",
              status: driver.status,
              notes: driver.user_notes ?? "",
            }
          : {
              ...EMPTY_FORM,
              driver_code: generateDriverCode(),
            },
      );
      setDriverPhotoFile(null);
      setDriverPhotoPreview(null);
      setNokPhotoFile(null);
      setNokPhotoPreview(null);
    }
  }, [open, driver]);

  const onDriverPhotoSelected = (file: File | null) => {
    if (!file) { setDriverPhotoFile(null); setDriverPhotoPreview(null); return; }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo too large. Keep under 5 MB.");
      return;
    }
    setDriverPhotoFile(file);
    setDriverPhotoPreview(URL.createObjectURL(file));
  };

  const onNokPhotoSelected = (file: File | null) => {
    if (!file) { setNokPhotoFile(null); setNokPhotoPreview(null); return; }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo too large. Keep under 5 MB.");
      return;
    }
    setNokPhotoFile(file);
    setNokPhotoPreview(URL.createObjectURL(file));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!form.full_name.trim()) return toast.error("Driver full name is required");
    setSubmitting(true);
    try {
      let driverPhotoUrl = driver?.photo_url ?? null;
      if (driverPhotoFile) {
        const ext = (driverPhotoFile.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${profile.organisation_id}/drivers/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("machine-docs")
          .upload(path, driverPhotoFile, { contentType: driverPhotoFile.type, upsert: false });
        if (upErr) throw upErr;
        driverPhotoUrl = path;
      }

      let nokPhotoUrl = driver?.next_of_kin_photo_url ?? null;
      if (nokPhotoFile) {
        const ext = (nokPhotoFile.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${profile.organisation_id}/drivers/nok_${crypto.randomUUID()}.${ext}`;
        const { error: upErr2 } = await supabase.storage
          .from("machine-docs")
          .upload(path, nokPhotoFile, { contentType: nokPhotoFile.type, upsert: false });
        if (upErr2) throw upErr2;
        nokPhotoUrl = path;
      }

      const safePayload = serializeDriverPayload({
        driver_code: form.driver_code.trim(),
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        licence_number: form.licence_number.trim() || null,
        licence_class: form.licence_class.trim() || null,
        licence_expiry: form.licence_expiry || null,
        medical_expiry: form.medical_expiry || null,
        passport_number: form.passport_number.trim() || null,
        nida_number: form.nida_number.trim() || null,
        other_id_type: form.other_id_number.trim() ? form.other_id_type : null,
        other_id_number: form.other_id_number.trim() || null,
        photo_url: driverPhotoUrl,
        next_of_kin_name: form.next_of_kin_name.trim() || null,
        next_of_kin_relation: form.next_of_kin_name.trim() ? form.next_of_kin_relation : null,
        next_of_kin_phone: form.next_of_kin_phone.trim() || null,
        next_of_kin_nida: form.next_of_kin_nida.trim() || null,
        next_of_kin_photo_url: nokPhotoUrl,
        status: form.status,
        user_notes: form.notes.trim() || null,
      });

      const { error } = driver
        ? await supabase.from("drivers").update(safePayload).eq("id", driver.id)
        : await supabase.from("drivers").insert({
            ...safePayload,
            organisation_id: profile.organisation_id,
          });

      if (error) throw error;
      toast.success(driver ? "Driver updated" : "Driver registered successfully");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save driver";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{driver ? "Edit Driver" : "Register New Driver"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          {/* Driver Portrait Photo & Basic Contact */}
          <div className="flex items-center gap-4 p-3 rounded-xl border border-border bg-muted/20">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
              {driverPhotoPreview ? (
                <img src={driverPhotoPreview} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <CoverImage
                  value={form.photo_url || driver?.photo_url}
                  alt={form.full_name || "Driver"}
                  className="h-full w-full object-cover"
                  fallback={<User className="h-8 w-8 text-muted-foreground" />}
                />
              )}
            </div>
            <div>
              <Label className="text-xs font-semibold">Driver Photo / Picture</Label>
              <div className="flex items-center gap-2 mt-1">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{driverPhotoFile ? driverPhotoFile.name : "Upload photo"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onDriverPhotoSelected(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Passport photo format recommended</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Driver Full Name *</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="e.g. Juma Hamisi Bakari"
                maxLength={200}
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Unique Driver ID *</Label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, driver_code: generateDriverCode() })}
                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                  title="Generate new ID"
                >
                  <RefreshCw className="h-2.5 w-2.5" /> Auto-Gen
                </button>
              </div>
              <Input
                value={form.driver_code}
                onChange={(e) => setForm({ ...form, driver_code: e.target.value.toUpperCase() })}
                placeholder="DRV-XXXX"
                className="font-mono font-bold text-primary tracking-wider uppercase h-10"
                required
              />
              <p className="text-[10px] text-muted-foreground">Unique ID for trips & dispatch</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Phone number *</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. +255 712 345 678"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Email address</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="driver@company.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Driver Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active (Authorized)</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Driving Licence Number</Label>
              <Input
                value={form.licence_number}
                onChange={(e) => setForm({ ...form, licence_number: e.target.value })}
                placeholder="e.g. 1002345678"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Licence Class</Label>
              <Input
                value={form.licence_class}
                onChange={(e) => setForm({ ...form, licence_class: e.target.value })}
                placeholder="e.g. Class C, CE, E (Heavy Trailer / Tanker)"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Licence Expiry Date</Label>
              <Input
                type="date"
                value={form.licence_expiry}
                onChange={(e) => setForm({ ...form, licence_expiry: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Medical Certificate Expiry</Label>
              <Input
                type="date"
                value={form.medical_expiry}
                onChange={(e) => setForm({ ...form, medical_expiry: e.target.value })}
              />
            </div>
          </div>

          {/* National & State ID Verification Section */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Driver Legal Identification (KYC)
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">NIDA Number (National ID)</Label>
                <Input
                  value={form.nida_number}
                  onChange={(e) => setForm({ ...form, nida_number: e.target.value })}
                  placeholder="e.g. 19880415-14118-00001-24"
                  className="h-9 text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Passport Number</Label>
                <Input
                  value={form.passport_number}
                  onChange={(e) => setForm({ ...form, passport_number: e.target.value })}
                  placeholder="e.g. AB123456"
                  className="h-9 text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Other Secondary ID Type</Label>
                <Select value={form.other_id_type} onValueChange={(v) => setForm({ ...form, other_id_type: v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OTHER_ID_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Other ID Number</Label>
                <Input
                  value={form.other_id_number}
                  onChange={(e) => setForm({ ...form, other_id_number: e.target.value })}
                  placeholder="e.g. T-129-3891"
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Next of Kin Information Section */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <HeartHandshake className="h-4 w-4 text-rose-500" /> Next of Kin Emergency Information
              </h4>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Emergency Contact</span>
            </div>

            <div className="flex items-center gap-4 p-2.5 rounded-lg border border-border bg-background">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                {nokPhotoPreview ? (
                  <img src={nokPhotoPreview} alt="Next of Kin Preview" className="h-full w-full object-cover" />
                ) : (
                  <CoverImage
                    value={form.next_of_kin_photo_url || driver?.next_of_kin_photo_url}
                    alt={form.next_of_kin_name || "Next of Kin"}
                    className="h-full w-full object-cover"
                    fallback={<User className="h-6 w-6 text-muted-foreground" />}
                  />
                )}
              </div>
              <div>
                <Label className="text-xs font-semibold">Next of Kin Photo</Label>
                <div className="flex items-center gap-2 mt-0.5">
                  <label className="flex cursor-pointer items-center gap-1.5 rounded border border-input bg-muted/40 px-2.5 py-1 text-xs hover:bg-accent">
                    <Upload className="h-3 w-3" />
                    <span>{nokPhotoFile ? nokPhotoFile.name : "Attach photo"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onNokPhotoSelected(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Next of Kin Full Name *</Label>
                <Input
                  value={form.next_of_kin_name}
                  onChange={(e) => setForm({ ...form, next_of_kin_name: e.target.value })}
                  placeholder="e.g. Rehema Said Bakari"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Relationship</Label>
                <Select value={form.next_of_kin_relation} onValueChange={(v) => setForm({ ...form, next_of_kin_relation: v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NOK_RELATIONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Next of Kin Phone Number *</Label>
                <Input
                  value={form.next_of_kin_phone}
                  onChange={(e) => setForm({ ...form, next_of_kin_phone: e.target.value })}
                  placeholder="e.g. +255 754 112 233"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Next of Kin NIDA Number</Label>
                <Input
                  value={form.next_of_kin_nida}
                  onChange={(e) => setForm({ ...form, next_of_kin_nida: e.target.value })}
                  placeholder="e.g. 19900820-21345-00002-18"
                  className="h-9 text-sm font-mono"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes & Remarks</Label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Driver certifications, health conditions, or route preferences…"
              maxLength={2000}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Driver
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NextOfKinModal({
  open,
  onOpenChange,
  driver,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  driver: Driver;
  onEdit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <HeartHandshake className="h-5 w-5 text-rose-500" /> Next of Kin Emergency Profile
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-4 p-3 rounded-xl border border-border bg-muted/30">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
              <CoverImage
                value={driver.next_of_kin_photo_url}
                alt={driver.next_of_kin_name || "Next of Kin"}
                className="h-full w-full object-cover"
                fallback={<User className="h-8 w-8 text-muted-foreground" />}
              />
            </div>
            <div>
              <div className="text-base font-bold text-foreground">{driver.next_of_kin_name || "—"}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span>Relationship:</span>
                <span className="font-semibold text-foreground rounded bg-primary/10 text-primary px-1.5 py-0.2">
                  {driver.next_of_kin_relation || "Next of Kin"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Driver: <span className="font-medium text-foreground">{driver.full_name}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 rounded-lg border border-border bg-card p-3.5 text-sm">
            <div className="flex justify-between items-center py-1 border-b border-border">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3.5 w-3.5 text-primary" /> Phone Number:
              </span>
              {driver.next_of_kin_phone ? (
                <a
                  href={`tel:${driver.next_of_kin_phone}`}
                  className="font-bold text-primary hover:underline flex items-center gap-1"
                >
                  {driver.next_of_kin_phone}
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>

            <div className="flex justify-between items-center py-1 border-b border-border">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Shield className="h-3.5 w-3.5 text-primary" /> NIDA Number:
              </span>
              <span className="font-mono font-medium text-xs text-foreground">
                {driver.next_of_kin_nida || "Not recorded"}
              </span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-primary" /> Driver Contact:
              </span>
              <span className="font-medium text-foreground text-xs">
                {driver.phone || "—"}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit Details
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DriverDetailModal({
  open,
  onOpenChange,
  driver,
  onEdit,
  onViewNextOfKin,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  driver: Driver;
  onEdit: () => void;
  onViewNextOfKin: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    if (!driver.driver_code) return;
    navigator.clipboard.writeText(driver.driver_code);
    setCopied(true);
    toast.success(`Driver ID ${driver.driver_code} copied!`);
    setTimeout(() => setCopied(false), 2000);
  };

  const licStatus = scheduleStatus(driver.licence_expiry);
  const medStatus = scheduleStatus(driver.medical_expiry);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-lg pr-4">
            <span className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Driver Profile & KYC Dossier
            </span>
            <div className="flex items-center gap-2">
              <StatusBadge status={driver.status === "active" ? (licStatus === "overdue" || medStatus === "overdue") ? "overdue" : "active" : "retired"} />
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Top Profile Summary Card */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-xl border border-border bg-muted/20">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-card shadow-sm">
              <CoverImage
                value={driver.photo_url}
                alt={driver.full_name}
                className="h-full w-full object-cover"
                fallback={<User className="h-10 w-10 text-muted-foreground" />}
              />
            </div>
            <div className="flex-1 text-center sm:text-left space-y-1.5">
              <div className="text-xl font-bold text-foreground">{driver.full_name}</div>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-0.5">
                <div className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/25 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 shadow-2xs">
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>ID: {driver.driver_code}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 cursor-pointer"
                  onClick={copyCode}
                  title="Copy Driver Unique ID"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? "Copied" : "Copy ID"}</span>
                </Button>
              </div>

              <p className="text-xs text-muted-foreground pt-1">
                Unique system ID connected to Trips, Dispatch, and QR Driver Inspections.
              </p>
            </div>
          </div>

          {/* Quick Contact & Communications */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-primary" /> Phone Number
              </span>
              <div>
                {driver.phone ? (
                  <a
                    href={`tel:${driver.phone}`}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    {driver.phone}
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" /> Email Address
              </span>
              <div>
                {driver.email ? (
                  <a
                    href={`mailto:${driver.email}`}
                    className="text-sm font-semibold text-primary hover:underline break-all"
                  >
                    {driver.email}
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Driving Licence & Medical Examination */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" /> Driving Licence & Medical Clearance
            </h4>

            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
                <span className="text-xs text-muted-foreground">Licence Number & Class</span>
                <div className="font-bold text-foreground">
                  {driver.licence_number ?? "Not registered"} {driver.licence_class ? `(${driver.licence_class})` : ""}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Licence Expiry
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{formatDate(driver.licence_expiry)}</span>
                  <StatusBadge status={licStatus} />
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1 sm:col-span-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Medical Certificate Expiry
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{formatDate(driver.medical_expiry)}</span>
                  {driver.medical_expiry && <StatusBadge status={medStatus} />}
                </div>
              </div>
            </div>
          </div>

          {/* National Legal Identification (KYC) */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Legal Identification & KYC Documents
            </h4>

            <div className="grid gap-3 sm:grid-cols-3 text-sm">
              <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
                <span className="text-xs text-muted-foreground uppercase font-bold text-primary">NIDA Number</span>
                <div className="font-mono font-medium text-xs break-all text-foreground">
                  {driver.nida_number || "Not recorded"}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
                <span className="text-xs text-muted-foreground uppercase font-bold text-foreground">Passport No.</span>
                <div className="font-mono font-medium text-xs text-foreground">
                  {driver.passport_number || "Not recorded"}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
                <span className="text-xs text-muted-foreground uppercase font-bold text-foreground">
                  {driver.other_id_type || "Secondary ID"}
                </span>
                <div className="font-medium text-xs text-foreground">
                  {driver.other_id_number || "Not recorded"}
                </div>
              </div>
            </div>
          </div>

          {/* Next of Kin Emergency Profile */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <HeartHandshake className="h-4 w-4 text-rose-500" /> Next of Kin (Emergency Contact)
              </h4>
              {driver.next_of_kin_name && (
                <span className="text-[10px] uppercase font-bold text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded">
                  {driver.next_of_kin_relation || "Emergency Contact"}
                </span>
              )}
            </div>

            {driver.next_of_kin_name ? (
              <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-background">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                  <CoverImage
                    value={driver.next_of_kin_photo_url}
                    alt={driver.next_of_kin_name}
                    className="h-full w-full object-cover"
                    fallback={<User className="h-7 w-7 text-muted-foreground" />}
                  />
                </div>
                <div className="space-y-1 flex-1">
                  <div className="font-bold text-foreground text-sm">{driver.next_of_kin_name}</div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {driver.next_of_kin_phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-primary" />
                        <a href={`tel:${driver.next_of_kin_phone}`} className="font-semibold text-primary hover:underline">
                          {driver.next_of_kin_phone}
                        </a>
                      </span>
                    )}
                    {driver.next_of_kin_nida && (
                      <span className="font-mono text-[11px]">
                        NIDA: {driver.next_of_kin_nida}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic p-2">
                No next of kin recorded. You can register emergency contacts by editing this driver.
              </div>
            )}
          </div>

          {/* User Notes */}
          {driver.user_notes && (
            <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-1">
              <span className="text-xs font-semibold text-foreground">Operational Notes & Remarks</span>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{driver.user_notes}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5 cursor-pointer">
            <Pencil className="h-3.5 w-3.5" /> Edit Driver Profile
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)} className="cursor-pointer">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
