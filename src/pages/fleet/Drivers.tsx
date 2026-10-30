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
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { scheduleStatus } from "@/lib/machine-constants";
import { useI18n } from "@/i18n/I18nProvider";

type Driver = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  licence_number: string | null;
  licence_class: string | null;
  licence_expiry: string | null;
  medical_expiry: string | null;
  passport_number: string | null;
  nida_number: string | null;
  other_id_type: string | null;
  other_id_number: string | null;
  photo_url: string | null;
  next_of_kin_name: string | null;
  next_of_kin_relation: string | null;
  next_of_kin_phone: string | null;
  next_of_kin_nida: string | null;
  next_of_kin_photo_url: string | null;
  status: string;
  notes: string | null;
};

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
  const [confirm, setConfirm] = useState<string | null>(null);
  const [nokDriver, setNokDriver] = useState<Driver | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .order("full_name");
    if (error) toast.error(error.message);
    setDrivers((data ?? []) as Driver[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter((d) =>
      [
        d.full_name,
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
          placeholder="Search name, phone, licence, NIDA, passport…"
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
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3 text-sm font-medium">Drivers ({filtered.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Driver</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 font-medium">National / State IDs</th>
                  <th className="px-5 py-3 font-medium">Licence</th>
                  <th className="px-5 py-3 font-medium">Next of Kin</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                          <CoverImage
                            value={d.photo_url}
                            alt={d.full_name}
                            className="h-full w-full object-cover"
                            fallback={<User className="h-5 w-5 text-muted-foreground" />}
                          />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{d.full_name}</div>
                          {d.notes && <div className="text-xs text-muted-foreground line-clamp-1">{d.notes}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <div className="font-medium text-foreground">{d.phone ?? "—"}</div>
                      {d.email && <div className="text-xs">{d.email}</div>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="space-y-1">
                        {d.nida_number ? (
                          <div className="text-xs flex items-center gap-1 font-mono">
                            <span className="font-bold text-[10px] text-primary uppercase">NIDA:</span> {d.nida_number}
                          </div>
                        ) : null}
                        {d.passport_number ? (
                          <div className="text-xs flex items-center gap-1 font-mono text-muted-foreground">
                            <span className="font-semibold text-[10px] uppercase">PPT:</span> {d.passport_number}
                          </div>
                        ) : null}
                        {d.other_id_number ? (
                          <div className="text-[11px] text-muted-foreground">
                            {d.other_id_type || "Other"}: {d.other_id_number}
                          </div>
                        ) : null}
                        {!d.nida_number && !d.passport_number && !d.other_id_number && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <div className="font-medium text-foreground">
                        {d.licence_number ?? "—"} {d.licence_class ? `(${d.licence_class})` : ""}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs">
                        <span className="flex items-center gap-1">
                          <StatusBadge status={scheduleStatus(d.licence_expiry)} />
                          <span>Lic: {formatDate(d.licence_expiry)}</span>
                        </span>
                        {d.medical_expiry && (
                          <span className="text-[11px]">Med: {formatDate(d.medical_expiry)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {d.next_of_kin_name ? (
                        <button
                          type="button"
                          onClick={() => setNokDriver(d)}
                          className="text-left group cursor-pointer"
                          title="Click to view full Next of Kin profile & photo"
                        >
                          <div className="font-medium text-xs group-hover:text-primary transition-colors flex items-center gap-1">
                            <HeartHandshake className="h-3.5 w-3.5 text-rose-500" />
                            {d.next_of_kin_name}
                            {d.next_of_kin_relation && (
                              <span className="text-[10px] text-muted-foreground">({d.next_of_kin_relation})</span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3" />
                            <span>{d.next_of_kin_phone || "No phone"}</span>
                            {d.next_of_kin_photo_url && (
                              <span className="ml-1 rounded bg-muted px-1 text-[9px] font-semibold text-primary">Photo</span>
                            )}
                          </div>
                        </button>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">Not registered</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={d.status === "active" ? worstExpiryStatus(d) === "overdue" ? "overdue" : "active" : "retired"} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {d.next_of_kin_name && (
                          <Button variant="ghost" size="icon" onClick={() => setNokDriver(d)} title="View Next of Kin">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                        {canWrite && (
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(d); setOpen(true); }} title="Edit driver">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {isManager && (
                          <Button variant="ghost" size="icon" onClick={() => setConfirm(d.id)} title="Remove driver">
                            <Trash2 className="h-4 w-4 text-destructive" />
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
              notes: driver.notes ?? "",
            }
          : EMPTY_FORM,
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

      const payload = {
        organisation_id: profile.organisation_id,
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
        notes: form.notes.trim() || null,
      };

      const { error } = driver
        ? await supabase.from("drivers").update(payload).eq("id", driver.id)
        : await supabase.from("drivers").insert(payload);

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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Full name *</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="e.g. Juma Hamisi Bakari"
                maxLength={200}
              />
            </div>

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
