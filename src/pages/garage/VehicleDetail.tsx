import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader } from "@/components/PageLoader";
import { ArrowLeft, Truck, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatNumber, formatMoney } from "@/lib/format";
import { STATUS_LABEL, STATUS_BADGE, formatJobNumber } from "@/lib/garage-constants";
import { invoiceTotal } from "@/lib/garage-money";

export default function GarageVehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isManager } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [editOpen, setEditOpen] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: v, error }, { data: j }] = await Promise.all([
      (supabase as any)
        .from("garage_vehicles")
        .select("*, garage_customers(*)")
        .eq("id", id)
        .maybeSingle(),
      (supabase as any)
        .from("garage_jobs")
        .select("id, job_number, job_year, status, priority, reported_problem, created_at, garage_invoices(*, garage_invoice_items(*))")
        .eq("vehicle_id", id)
        .order("created_at", { ascending: false }),
    ]);
    if (error) toast.error(error.message);
    setVehicle(v);
    setCustomer(v?.garage_customers ?? null);
    setJobs(j ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  if (loading) return <PageLoader />;
  if (!vehicle) return (
    <div className="space-y-4 p-6">
      <Link to="/garage/vehicles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <p className="text-muted-foreground">Vehicle not found.</p>
    </div>
  );

  const totalSpend = jobs
    .map((j: any) => j.garage_invoices ? invoiceTotal(j.garage_invoices) : 0)
    .reduce((s: number, v: number) => s + v, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/garage/vehicles" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to vehicles
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">
              {[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle"}
              {vehicle.registration_number && <span className="ml-2 text-muted-foreground">· {vehicle.registration_number}</span>}
            </h1>
          </div>
          {customer && (
            <p className="mt-1 text-sm text-muted-foreground">
              Owner: <Link to={`/garage/customers`} className="text-primary hover:underline">{customer.name}</Link>
            </p>
          )}
        </div>
        {isManager && (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit vehicle
          </Button>
        )}
      </div>

      {/* Vehicle details + stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total jobs", value: jobs.length },
          { label: "Open jobs", value: jobs.filter((j) => !["delivered", "closed", "cancelled"].includes(j.status)).length },
          { label: "Lifetime spend", value: formatMoney(totalSpend) },
          { label: "Current mileage", value: `${formatNumber(vehicle.mileage)} km` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Vehicle info */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Vehicle details</h2>
          <dl className="space-y-2.5 text-sm">
            {[
              { label: "Make", value: vehicle.make },
              { label: "Model", value: vehicle.model },
              { label: "Year", value: vehicle.year },
              { label: "Fuel type", value: vehicle.fuel_type },
              { label: "Engine", value: vehicle.engine },
              { label: "Transmission", value: vehicle.transmission },
              { label: "VIN", value: vehicle.vin },
              { label: "Registration", value: vehicle.registration_number },
              { label: "Mileage", value: vehicle.mileage ? `${formatNumber(vehicle.mileage)} km` : null },
              { label: "Next service date", value: formatDate(vehicle.next_service_date) },
              { label: "Next service km", value: vehicle.next_service_mileage ? `${formatNumber(vehicle.next_service_mileage)} km` : null },
            ].filter((r) => r.value && r.value !== "—").map((r) => (
              <div key={r.label} className="flex justify-between">
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd className="font-medium text-right">{r.value}</dd>
              </div>
            ))}
          </dl>
          {vehicle.notes && (
            <div className="mt-4 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              {vehicle.notes}
            </div>
          )}
        </div>

        {/* Service history */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">Service history ({jobs.length} job{jobs.length !== 1 ? "s" : ""})</h2>
          </div>
          {jobs.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No jobs recorded for this vehicle yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Job</th>
                  <th className="px-5 py-3 font-medium">Problem</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Value</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j: any) => (
                  <tr
                    key={j.id}
                    onClick={() => navigate(`/garage/jobs/${j.id}`)}
                    className="cursor-pointer border-t border-border hover:bg-muted/30"
                  >
                    <td className="px-5 py-3 text-xs font-medium text-muted-foreground">{formatJobNumber(j)}</td>
                    <td className="px-5 py-3 max-w-[200px]">
                      <p className="truncate">{j.reported_problem}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[j.status] ?? ""}`}>
                        {STATUS_LABEL[j.status] ?? j.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-muted-foreground">
                      {j.garage_invoices ? formatMoney(invoiceTotal(j.garage_invoices)) : "—"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">{formatDate(j.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <EditVehicleDialog open={editOpen} onOpenChange={setEditOpen} vehicle={vehicle} onSaved={load} />
    </div>
  );
}

function EditVehicleDialog({ open, onOpenChange, vehicle, onSaved }: any) {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({
      make: vehicle.make ?? "",
      model: vehicle.model ?? "",
      year: vehicle.year ?? "",
      fuel_type: vehicle.fuel_type ?? "",
      engine: vehicle.engine ?? "",
      transmission: vehicle.transmission ?? "",
      vin: vehicle.vin ?? "",
      registration_number: vehicle.registration_number ?? "",
      mileage: vehicle.mileage ?? "",
      next_service_date: vehicle.next_service_date ?? "",
      next_service_mileage: vehicle.next_service_mileage ?? "",
      notes: vehicle.notes ?? "",
    });
  }, [open, vehicle.id]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await (supabase as any).from("garage_vehicles").update({
      make: form.make.trim() || null,
      model: form.model.trim() || null,
      year: form.year ? Number(form.year) : null,
      fuel_type: form.fuel_type || null,
      engine: form.engine.trim() || null,
      transmission: form.transmission || null,
      vin: form.vin.trim() || null,
      registration_number: form.registration_number.trim() || null,
      mileage: form.mileage !== "" ? Number(form.mileage) : null,
      next_service_date: form.next_service_date || null,
      next_service_mileage: form.next_service_mileage !== "" ? Number(form.next_service_mileage) : null,
      notes: form.notes.trim() || null,
    }).eq("id", vehicle.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Vehicle updated");
    onOpenChange(false);
    onSaved();
  };

  const f = (k: string) => ({ value: form[k] ?? "", onChange: (e: any) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit vehicle</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Make</Label><Input {...f("make")} className="mt-1" /></div>
            <div><Label>Model</Label><Input {...f("model")} className="mt-1" /></div>
            <div><Label>Year</Label><Input type="number" {...f("year")} className="mt-1" /></div>
            <div><Label>Registration</Label><Input {...f("registration_number")} className="mt-1" /></div>
            <div><Label>VIN</Label><Input {...f("vin")} className="mt-1" /></div>
            <div><Label>Engine</Label><Input {...f("engine")} placeholder="e.g. 2.0L" className="mt-1" /></div>
            <div>
              <Label>Fuel type</Label>
              <select {...f("fuel_type")} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {["", "petrol", "diesel", "hybrid", "electric", "lpg", "other"].map((o) => <option key={o} value={o}>{o || "—"}</option>)}
              </select>
            </div>
            <div>
              <Label>Transmission</Label>
              <select {...f("transmission")} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {["", "manual", "automatic", "cvt", "other"].map((o) => <option key={o} value={o}>{o || "—"}</option>)}
              </select>
            </div>
            <div><Label>Current mileage (km)</Label><Input type="number" min={0} {...f("mileage")} className="mt-1" /></div>
            <div><Label>Next service date</Label><Input type="date" {...f("next_service_date")} className="mt-1" /></div>
            <div className="col-span-2"><Label>Next service mileage (km)</Label><Input type="number" min={0} {...f("next_service_mileage")} className="mt-1" /></div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <textarea {...f("notes")} rows={2} className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
