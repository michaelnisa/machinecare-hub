import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Truck, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatNumber, formatDate } from "@/lib/format";
import { STATUS_LABEL, STATUS_BADGE, formatJobNumber } from "@/lib/garage-constants";

export default function GarageVehicles() {
  const { profile, user } = useAuth();
  const { isManager } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [historyTarget, setHistoryTarget] = useState<any>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: v, error: e1 }, { data: c, error: e2 }] = await Promise.all([
      (supabase as any).from("garage_vehicles").select("*, garage_customers(id, name)").order("created_at", { ascending: false }),
      (supabase as any).from("garage_customers").select("id, name").order("name"),
    ]);
    const err = e1 || e2;
    if (err) toast.error(err.message);
    setVehicles(v ?? []);
    setCustomers(c ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const filtered = useMemo(() => {
    let out = vehicles;
    if (customerFilter !== "all") out = out.filter((v) => v.customer_id === customerFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((v) =>
        v.registration_number?.toLowerCase().includes(q) ||
        v.make?.toLowerCase().includes(q) ||
        v.model?.toLowerCase().includes(q) ||
        v.garage_customers?.name?.toLowerCase().includes(q)
      );
    }
    return out;
  }, [vehicles, customerFilter, search]);

  const remove = async () => {
    const { error } = await (supabase as any).from("garage_vehicles").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    if (error) return toast.error(error.message);
    toast.success("Vehicle removed");
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vehicles</h1>
          <p className="text-sm text-muted-foreground">Every customer vehicle on file — registration, mileage, and service status.</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} disabled={customers.length === 0}><Plus className="mr-2 h-4 w-4" />Add vehicle</Button>
      </div>

      {customers.length === 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">Add a customer first — every vehicle needs an owner.</div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search by plate, make, model or customer…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All customers</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Truck className="h-5 w-5" />} title={vehicles.length === 0 ? "No vehicles yet" : "No matches"} description={vehicles.length === 0 ? "Add your first customer vehicle to start tracking service history." : "Try a different search or filter."} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Vehicle</th>
                <th className="px-5 py-3 font-medium">Registration</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Mileage</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id} className="cursor-pointer border-t border-border hover:bg-muted/40" onClick={() => setHistoryTarget(v)}>
                  <td className="px-5 py-3">
                    <div className="font-medium">{[v.make, v.model].filter(Boolean).join(" ") || "—"}</div>
                    {v.year && <div className="text-xs text-muted-foreground">{v.year}</div>}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{v.registration_number ?? "—"}</td>
                  <td className="px-5 py-3">{v.garage_customers?.name ?? "—"}</td>
                  <td className="px-5 py-3">{formatNumber(v.mileage)} km</td>
                  <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(v); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    {isManager && <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(v)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VehicleFormDialog open={formOpen} setOpen={setFormOpen} editing={editing} customers={customers} orgId={profile?.organisation_id} userId={user?.id} onSaved={load} />
      <VehicleHistoryDialog vehicle={historyTarget} onClose={() => setHistoryTarget(null)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this vehicle?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VehicleFormDialog({ open, setOpen, editing, customers, orgId, userId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    customer_id: "", registration_number: "", vin: "", make: "", model: "", year: "", engine: "", fuel_type: "", transmission: "", mileage: "0",
    next_service_date: "", next_service_mileage: "", notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm(editing ? {
        customer_id: editing.customer_id ?? "", registration_number: editing.registration_number ?? "", vin: editing.vin ?? "",
        make: editing.make ?? "", model: editing.model ?? "", year: editing.year ?? "", engine: editing.engine ?? "",
        fuel_type: editing.fuel_type ?? "", transmission: editing.transmission ?? "", mileage: String(editing.mileage ?? 0),
        next_service_date: editing.next_service_date ?? "", next_service_mileage: editing.next_service_mileage != null ? String(editing.next_service_mileage) : "",
        notes: editing.notes ?? "",
      } : { customer_id: customers[0]?.id ?? "", registration_number: "", vin: "", make: "", model: "", year: "", engine: "", fuel_type: "", transmission: "", mileage: "0", next_service_date: "", next_service_mileage: "", notes: "" });
    }
  }, [open, editing]);

  const submit = async () => {
    if (!form.customer_id) return toast.error("Select a customer");
    setSaving(true);
    const payload = {
      customer_id: form.customer_id,
      registration_number: form.registration_number.trim() || null,
      vin: form.vin.trim() || null,
      make: form.make.trim() || null,
      model: form.model.trim() || null,
      year: form.year ? Number(form.year) : null,
      engine: form.engine.trim() || null,
      fuel_type: form.fuel_type.trim() || null,
      transmission: form.transmission.trim() || null,
      mileage: Number(form.mileage) || 0,
      next_service_date: form.next_service_date || null,
      next_service_mileage: form.next_service_mileage === "" ? null : Number(form.next_service_mileage),
      notes: form.notes.trim() || null,
    };
    const { error } = editing
      ? await (supabase as any).from("garage_vehicles").update(payload).eq("id", editing.id)
      : await (supabase as any).from("garage_vehicles").insert({ ...payload, organisation_id: orgId, created_by: userId });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Vehicle updated" : "Vehicle added");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit vehicle" : "Add vehicle"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Customer *</Label>
            <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select…</option>
              {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Make</Label><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} className="mt-1" placeholder="Toyota" /></div>
            <div><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="mt-1" placeholder="Hilux" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Registration number</Label><Input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} className="mt-1" placeholder="T 123 ABC" /></div>
            <div><Label>Year</Label><Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>VIN / Chassis</Label><Input value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} className="mt-1" /></div>
            <div><Label>Mileage (km)</Label><Input type="number" min={0} value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fuel type</Label><Input value={form.fuel_type} onChange={(e) => setForm({ ...form, fuel_type: e.target.value })} className="mt-1" placeholder="Diesel" /></div>
            <div><Label>Transmission</Label><Input value={form.transmission} onChange={(e) => setForm({ ...form, transmission: e.target.value })} className="mt-1" placeholder="Automatic" /></div>
          </div>
          <div><Label>Engine</Label><Input value={form.engine} onChange={(e) => setForm({ ...form, engine: e.target.value })} className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Next service date</Label><Input type="date" value={form.next_service_date} onChange={(e) => setForm({ ...form, next_service_date: e.target.value })} className="mt-1" /></div>
            <div><Label>Next service mileage</Label><Input type="number" min={0} value={form.next_service_mileage} onChange={(e) => setForm({ ...form, next_service_mileage: e.target.value })} className="mt-1" /></div>
          </div>
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const OPEN_STATUSES = new Set(["received", "diagnosing", "estimate", "awaiting_approval", "approved", "in_progress", "quality_check", "ready"]);

function VehicleHistoryDialog({ vehicle, onClose }: any) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!vehicle) return;
    setLoading(true);
    (supabase as any).from("garage_jobs").select("*").eq("vehicle_id", vehicle.id).order("created_at", { ascending: false })
      .then(({ data, error }: any) => { if (error) toast.error(error.message); setJobs(data ?? []); setLoading(false); });
  }, [vehicle?.id]);

  if (!vehicle) return null;
  const open = jobs.filter((j) => OPEN_STATUSES.has(j.status));
  const done = jobs.filter((j) => !OPEN_STATUSES.has(j.status));

  return (
    <Dialog open={!!vehicle} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle"} {vehicle.registration_number ? `· ${vehicle.registration_number}` : ""}</DialogTitle></DialogHeader>
        <div className="text-sm text-muted-foreground">
          {vehicle.garage_customers?.name} — {formatNumber(vehicle.mileage)} km
          {vehicle.next_service_date && <span> · next service due {formatDate(vehicle.next_service_date)}</span>}
        </div>
        {vehicle.notes && <p className="rounded-lg bg-muted/40 p-3 text-sm">{vehicle.notes}</p>}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs recorded for this vehicle yet.</p>
        ) : (
          <>
            {open.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium">Open jobs</h3>
                <ul className="space-y-1.5">
                  {open.map((j) => (
                    <li key={j.id}>
                      <Link to={`/garage/jobs/${j.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm hover:border-primary/50">
                        <span>{formatJobNumber(j)} — {j.reported_problem}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs shrink-0 ${STATUS_BADGE[j.status]}`}>{STATUS_LABEL[j.status]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {done.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium">Service history</h3>
                <ul className="space-y-1.5">
                  {done.map((j) => (
                    <li key={j.id}>
                      <Link to={`/garage/jobs/${j.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm hover:border-primary/50">
                        <span>{formatDate(j.created_at)} — {j.reported_problem}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs shrink-0 ${STATUS_BADGE[j.status]}`}>{STATUS_LABEL[j.status]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
