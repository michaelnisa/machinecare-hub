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
import { FileWarning, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { scheduleStatus } from "@/lib/machine-constants";
import { useI18n } from "@/i18n/I18nProvider";

const DOC_TYPES = [
  { value: "insurance", label: "Insurance" },
  { value: "road_licence", label: "Road licence" },
  { value: "inspection", label: "Inspection" },
  { value: "fitness", label: "Fitness" },
  { value: "permit", label: "Permit" },
  { value: "other", label: "Other" },
];

type VehicleDoc = {
  id: string;
  machine_id: string;
  doc_type: string;
  number: string | null;
  issued_on: string | null;
  expires_on: string | null;
  reminder_days: number;
  notes: string | null;
};

type Machine = { id: string; name: string; plate_number: string | null };
type Driver = { id: string; full_name: string; licence_expiry: string | null; medical_expiry: string | null };

type Row = {
  key: string;
  kind: "vehicle" | "driver";
  typeLabel: string;
  holderLabel: string;
  expiresOn: string | null;
  raw?: VehicleDoc;
};

const EMPTY_FORM = {
  machine_id: "",
  doc_type: "insurance",
  number: "",
  issued_on: "",
  expires_on: "",
  reminder_days: "30",
  notes: "",
};

export default function FleetDocuments() {
  const { profile } = useAuth();
  const { isManager, canWrite } = useUserRole();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<VehicleDoc[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleDoc | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: d, error: dErr }, { data: m }, { data: dr }] = await Promise.all([
      supabase.from("vehicle_documents").select("*"),
      supabase.from("machines").select("id, name, plate_number"),
      supabase.from("drivers").select("id, full_name, licence_expiry, medical_expiry").eq("status", "active"),
    ]);
    if (dErr) toast.error(dErr.message);
    setDocs((d ?? []) as VehicleDoc[]);
    setMachines((m ?? []) as Machine[]);
    setDrivers((dr ?? []) as Driver[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const machineMap = useMemo(() => new Map(machines.map((m) => [m.id, m])), [machines]);

  const rows: Row[] = useMemo(() => {
    const vehicleRows: Row[] = docs.map((d) => {
      const m = machineMap.get(d.machine_id);
      const label = m ? (m.plate_number ? `${m.name} (${m.plate_number})` : m.name) : "Vehicle";
      return {
        key: `doc-${d.id}`,
        kind: "vehicle",
        typeLabel: DOC_TYPES.find((t) => t.value === d.doc_type)?.label ?? d.doc_type,
        holderLabel: label,
        expiresOn: d.expires_on,
        raw: d,
      };
    });
    const driverRows: Row[] = [];
    for (const dr of drivers) {
      if (dr.licence_expiry) {
        driverRows.push({ key: `dl-${dr.id}`, kind: "driver", typeLabel: "Driving licence", holderLabel: dr.full_name, expiresOn: dr.licence_expiry });
      }
      if (dr.medical_expiry) {
        driverRows.push({ key: `dm-${dr.id}`, kind: "driver", typeLabel: "Medical certificate", holderLabel: dr.full_name, expiresOn: dr.medical_expiry });
      }
    }
    return [...vehicleRows, ...driverRows].sort((a, b) => {
      if (!a.expiresOn) return 1;
      if (!b.expiresOn) return -1;
      return new Date(a.expiresOn).getTime() - new Date(b.expiresOn).getTime();
    });
  }, [docs, drivers, machineMap]);

  const expiringSoonCount = rows.filter((r) => r.expiresOn && scheduleStatus(r.expiresOn) !== "ok").length;

  const handleDelete = async () => {
    if (!confirm) return;
    const { error } = await supabase.from("vehicle_documents").delete().eq("id", confirm);
    if (error) return toast.error(error.message);
    toast.success("Document removed");
    setConfirm(null);
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.fleet.documentsTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {t.fleet.documentsSub}
            {expiringSoonCount > 0 && (
              <span className="ml-2 font-medium text-amber-600">{expiringSoonCount} need attention</span>
            )}
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> {t.fleet.addDocument}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<FileWarning className="h-5 w-5" />}
          title="No documents tracked yet"
          description="Add vehicle documents (insurance, road licence, etc.) or driver licence/medical expiry dates to see them here."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">For</th>
                  <th className="px-5 py-3 font-medium">Expires on</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-t border-border">
                    <td className="px-5 py-3">{r.typeLabel}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {r.holderLabel}
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{r.kind}</span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(r.expiresOn)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={scheduleStatus(r.expiresOn)} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      {r.kind === "vehicle" && r.raw && (
                        <>
                          {canWrite && (
                            <Button variant="ghost" size="icon" onClick={() => { setEditing(r.raw!); setOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {isManager && (
                            <Button variant="ghost" size="icon" onClick={() => setConfirm(r.raw!.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <VehicleDocDialog open={open} onOpenChange={setOpen} doc={editing} machines={machines} onSaved={load} />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Remove this document?"
        description="This deletes the vehicle document record."
        onConfirm={async () => { await handleDelete(); }}
      />
    </div>
  );
}

function VehicleDocDialog({ open, onOpenChange, doc, machines, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  doc: VehicleDoc | null;
  machines: Machine[];
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      setForm(
        doc
          ? {
              machine_id: doc.machine_id,
              doc_type: doc.doc_type,
              number: doc.number ?? "",
              issued_on: doc.issued_on ?? "",
              expires_on: doc.expires_on ?? "",
              reminder_days: String(doc.reminder_days ?? 30),
              notes: doc.notes ?? "",
            }
          : EMPTY_FORM,
      );
    }
  }, [open, doc]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!form.machine_id) return toast.error("Pick a vehicle");
    if (!form.expires_on) return toast.error("Set an expiry date");
    setSubmitting(true);
    const payload = {
      organisation_id: profile.organisation_id,
      machine_id: form.machine_id,
      doc_type: form.doc_type,
      number: form.number || null,
      issued_on: form.issued_on || null,
      expires_on: form.expires_on || null,
      reminder_days: Number(form.reminder_days) || 30,
      notes: form.notes || null,
    };
    const { error } = doc
      ? await supabase.from("vehicle_documents").update(payload).eq("id", doc.id)
      : await supabase.from("vehicle_documents").insert(payload);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(doc ? "Document updated" : "Document added");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{doc ? "Edit vehicle document" : "Add vehicle document"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Vehicle *</Label>
              <Select value={form.machine_id} onValueChange={(v) => setForm({ ...form, machine_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pick a vehicle" /></SelectTrigger>
                <SelectContent>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.plate_number ? `${m.name} (${m.plate_number})` : m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Document type *</Label>
              <Select value={form.doc_type} onValueChange={(v) => setForm({ ...form, doc_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Document number</Label>
              <Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Remind me (days before)</Label>
              <Input type="number" min={1} value={form.reminder_days} onChange={(e) => setForm({ ...form, reminder_days: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Issued on</Label>
              <Input type="date" value={form.issued_on} onChange={(e) => setForm({ ...form, issued_on: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Expires on *</Label>
              <Input type="date" value={form.expires_on} onChange={(e) => setForm({ ...form, expires_on: e.target.value })} />
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
