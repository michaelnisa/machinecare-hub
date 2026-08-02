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
import { Contact, Plus, Pencil, Trash2, Loader2, Search } from "lucide-react";
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
  status: string;
  notes: string | null;
};

const EMPTY_FORM = {
  full_name: "",
  phone: "",
  email: "",
  licence_number: "",
  licence_class: "",
  licence_expiry: "",
  medical_expiry: "",
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
      [d.full_name, d.phone, d.email, d.licence_number].filter(Boolean).some((s) => String(s).toLowerCase().includes(q)),
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
          placeholder="Search drivers, phone, licence…"
          className="pl-9"
        />
      </div>

      {drivers.length === 0 ? (
        <EmptyState
          icon={<Contact className="h-5 w-5" />}
          title="No drivers yet"
          description="Add your first driver to start tracking licences and assignments."
          action={canWrite ? <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> New driver</Button> : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3 text-sm font-medium">Drivers ({filtered.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 font-medium">Licence</th>
                  <th className="px-5 py-3 font-medium">Licence expiry</th>
                  <th className="px-5 py-3 font-medium">Medical expiry</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-5 py-3 font-medium">{d.full_name}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <div>{d.phone ?? "—"}</div>
                      {d.email && <div className="text-xs">{d.email}</div>}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {d.licence_number ?? "—"} {d.licence_class ? `(${d.licence_class})` : ""}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={scheduleStatus(d.licence_expiry)} /> <span className="text-muted-foreground">{formatDate(d.licence_expiry)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={scheduleStatus(d.medical_expiry)} /> <span className="text-muted-foreground">{formatDate(d.medical_expiry)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={d.status === "active" ? worstExpiryStatus(d) === "overdue" ? "overdue" : "active" : "retired"} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      {canWrite && (
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(d); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {isManager && (
                        <Button variant="ghost" size="icon" onClick={() => setConfirm(d.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DriverDialog open={open} onOpenChange={setOpen} driver={editing} onSaved={load} />
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
              status: driver.status,
              notes: driver.notes ?? "",
            }
          : EMPTY_FORM,
      );
    }
  }, [open, driver]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!form.full_name.trim()) return toast.error("Name is required");
    setSubmitting(true);
    const payload = {
      organisation_id: profile.organisation_id,
      full_name: form.full_name.trim(),
      phone: form.phone || null,
      email: form.email || null,
      licence_number: form.licence_number || null,
      licence_class: form.licence_class || null,
      licence_expiry: form.licence_expiry || null,
      medical_expiry: form.medical_expiry || null,
      status: form.status,
      notes: form.notes || null,
    };
    const { error } = driver
      ? await supabase.from("drivers").update(payload).eq("id", driver.id)
      : await supabase.from("drivers").insert(payload);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(driver ? "Driver updated" : "Driver added");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{driver ? "Edit driver" : "New driver"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Full name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0712 345 678" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Used for expiry alerts" />
            </div>
            <div className="space-y-1.5">
              <Label>Licence number</Label>
              <Input value={form.licence_number} onChange={(e) => setForm({ ...form, licence_number: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Licence class</Label>
              <Input value={form.licence_class} onChange={(e) => setForm({ ...form, licence_class: e.target.value })} placeholder="e.g. C, CE" />
            </div>
            <div className="space-y-1.5">
              <Label>Licence expiry</Label>
              <Input type="date" value={form.licence_expiry} onChange={(e) => setForm({ ...form, licence_expiry: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Medical expiry</Label>
              <Input type="date" value={form.medical_expiry} onChange={(e) => setForm({ ...form, medical_expiry: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes</Label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                maxLength={2000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
