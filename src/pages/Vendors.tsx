import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { VendorContactButtons } from "@/components/VendorContactButtons";
import { Building2, Plus, Pencil, Trash2, Loader2, Clock, AlertTriangle, DollarSign, Send, ClipboardList, Search } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatTZS } from "@/lib/format";
import { cn } from "@/lib/utils";

type Vendor = {
  id: string;
  name: string;
  category: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  specialties: string | null;
  notes: string | null;
  active: boolean;
};

type Job = {
  id: string;
  vendor_id: string | null;
  machine_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  sent_date: string | null;
  promised_date: string | null;
  returned_date: string | null;
  vendor_cost: number | null;
  warranty_days: number | null;
  had_comeback: boolean;
};

const STATUS_CLASS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  returned: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-muted text-muted-foreground",
};

const MIN_JOBS_FOR_COLOR = 3;

export default function Vendors() {
  const { profile } = useAuth();
  const { isManager } = useUserRole();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [jobOpen, setJobOpen] = useState(false);
  const [jobEditing, setJobEditing] = useState<Job | null>(null);
  const [jobDefaultVendor, setJobDefaultVendor] = useState<string>("");
  const [confirmJob, setConfirmJob] = useState<string | null>(null);
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: v, error: vErr }, { data: o }, { data: m }] = await Promise.all([
      supabase.from("vendors").select("*").order("name"),
      supabase.from("work_orders")
        .select("id, vendor_id, machine_id, title, description, status, priority, sent_date, promised_date, returned_date, vendor_cost, warranty_days, had_comeback, created_at")
        .eq("is_outsourced", true)
        .order("created_at", { ascending: false }),
      supabase.from("machines").select("id, name").order("name"),
    ]);
    if (vErr) toast.error(vErr.message);
    setVendors((v ?? []) as Vendor[]);
    setJobs((o ?? []) as Job[]);
    setMachines((m ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const statsByVendor = useMemo(() => {
    const map = new Map<string, { jobs: number; returned: number; onTime: number; comebacks: number; totalCost: number }>();
    for (const o of jobs) {
      if (!o.vendor_id) continue;
      const s = map.get(o.vendor_id) ?? { jobs: 0, returned: 0, onTime: 0, comebacks: 0, totalCost: 0 };
      s.jobs += 1;
      if (o.had_comeback) s.comebacks += 1;
      if (o.vendor_cost) s.totalCost += Number(o.vendor_cost);
      if (o.returned_date) {
        s.returned += 1;
        if (o.promised_date && new Date(o.returned_date) <= new Date(o.promised_date)) s.onTime += 1;
      }
      map.set(o.vendor_id, s);
    }
    return map;
  }, [jobs]);

  const vendorMap = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);
  const machineMap = useMemo(() => new Map(machines.map((m) => [m.id, m.name])), [machines]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    vendors.forEach((v) => v.category && set.add(v.category));
    return Array.from(set).sort();
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter((v) => {
      if (categoryFilter !== "all" && (v.category ?? "") !== categoryFilter) return false;
      if (!q) return true;
      return [v.name, v.category, v.contact_name, v.phone, v.email, v.specialties]
        .filter(Boolean).some((s) => String(s).toLowerCase().includes(q));
    });
  }, [vendors, search, categoryFilter]);

  const filteredJobs = useMemo(() => {
    if (vendorFilter === "all") return jobs;
    return jobs.filter((j) => j.vendor_id === vendorFilter);
  }, [jobs, vendorFilter]);

  const totals = Array.from(statsByVendor.values()).reduce(
    (a, s) => ({
      jobs: a.jobs + s.jobs,
      onTime: a.onTime + s.onTime,
      returned: a.returned + s.returned,
      comebacks: a.comebacks + s.comebacks,
      totalCost: a.totalCost + s.totalCost,
    }),
    { jobs: 0, onTime: 0, returned: 0, comebacks: 0, totalCost: 0 },
  );

  const handleDelete = async () => {
    if (!confirm) return;
    const { error } = await supabase.from("vendors").delete().eq("id", confirm);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setConfirm(null);
    load();
  };

  const handleDeleteJob = async () => {
    if (!confirmJob) return;
    const { error } = await supabase.from("work_orders").delete().eq("id", confirmJob);
    if (error) return toast.error(error.message);
    toast.success("Job removed");
    setConfirmJob(null);
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendors & Workshops</h1>
          <p className="text-sm text-muted-foreground">Track outside workshops and every job you send to them.</p>
        </div>
        {isManager && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setJobEditing(null); setJobDefaultVendor(""); setJobOpen(true); }}>
              <Send className="mr-2 h-4 w-4" /> Record job
            </Button>
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> New vendor
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Building2 className="h-4 w-4" />} label="Active vendors" value={vendors.filter(v => v.active).length} />
        <StatCard icon={<ClipboardList className="h-4 w-4" />} label="Outsourced jobs" value={totals.jobs} caption={totals.jobs === 0 ? "No jobs recorded yet" : undefined} />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="On-time rate"
          value={totals.returned ? `${Math.round((totals.onTime / totals.returned) * 100)}%` : "—"}
          caption={totals.returned ? undefined : "Calculated after first returned job"}
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Total outsourced spend"
          value={totals.totalCost ? formatTZS(totals.totalCost) : "—"}
          caption={totals.totalCost ? undefined : "No cost recorded yet"}
        />
      </div>

      {/* Search + category chips */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors, contacts, specialties…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <CategoryChip active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>All</CategoryChip>
          {categories.map((c) => (
            <CategoryChip key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)}>{c}</CategoryChip>
          ))}
        </div>
      </div>

      {/* Vendors table */}
      {vendors.length === 0 ? (
        <EmptyState icon={<Building2 className="h-5 w-5" />} title="No vendors yet" description="Add your first external workshop or service provider." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3 text-sm font-medium">Vendors ({filteredVendors.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="sticky left-0 z-10 bg-card px-5 py-3 font-medium">Vendor</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 font-medium text-right">Jobs</th>
                  <th className="px-5 py-3 font-medium text-right">On-time %</th>
                  <th className="px-5 py-3 font-medium text-right">Comeback %</th>
                  <th className="px-5 py-3 font-medium text-right">Total spend</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredVendors.map((v) => {
                  const s = statsByVendor.get(v.id);
                  const completed = s?.returned ?? 0;
                  const onTime = s && s.returned ? Math.round((s.onTime / s.returned) * 100) : null;
                  const comeback = s && s.jobs ? Math.round((s.comebacks / s.jobs) * 100) : null;
                  const enoughForColor = completed >= MIN_JOBS_FOR_COLOR;
                  return (
                    <tr key={v.id} className="cursor-pointer border-t border-border hover:bg-muted/40" onClick={() => navigate(`/vendors/${v.id}`)}>
                      <td className="sticky left-0 z-10 max-w-[220px] bg-card px-5 py-3">
                        <div className="truncate font-medium" title={v.name}>{v.name}</div>
                        {!v.active && <div className="text-xs text-muted-foreground">Inactive</div>}
                        {v.specialties && <div className="line-clamp-1 text-xs text-muted-foreground">{v.specialties}</div>}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{v.category ?? "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        <div className="mb-1 text-xs">{v.contact_name ?? "—"}</div>
                        <VendorContactButtons phone={v.phone} />
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{s?.jobs ?? 0}</td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {onTime == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : enoughForColor ? (
                          <span className={onTime >= 80 ? "text-emerald-600" : onTime >= 50 ? "text-amber-600" : "text-red-600"}>{onTime}%</span>
                        ) : (
                          <span className="text-muted-foreground">{onTime}% <span className="text-[10px]">({completed} jobs)</span></span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {comeback == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (s?.jobs ?? 0) >= MIN_JOBS_FOR_COLOR ? (
                          <span className={comeback <= 5 ? "text-emerald-600" : comeback <= 15 ? "text-amber-600" : "text-red-600"}>{comeback}%</span>
                        ) : (
                          <span className="text-muted-foreground">{comeback}% <span className="text-[10px]">({s?.jobs ?? 0} jobs)</span></span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{s?.totalCost ? formatTZS(s.totalCost) : "—"}</td>
                      <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {isManager && (
                          <>
                            <Button variant="ghost" size="icon" title="Record job for this vendor" onClick={() => { setJobEditing(null); setJobDefaultVendor(v.id); setJobOpen(true); }}>
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setEditing(v); setOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setConfirm(v.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Jobs table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="text-sm font-medium">Vendor jobs</div>
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="all">All vendors</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        {filteredJobs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No jobs recorded yet. Click "Record job" to add one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">What they're doing</th>
                  <th className="px-5 py-3 font-medium">Vendor</th>
                  <th className="px-5 py-3 font-medium">Machine</th>
                  <th className="px-5 py-3 font-medium">Sent</th>
                  <th className="px-5 py-3 font-medium">Will finish</th>
                  <th className="px-5 py-3 font-medium">Returned</th>
                  <th className="px-5 py-3 font-medium text-right">Cost</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((j) => {
                  const overdue = !j.returned_date && j.promised_date && new Date(j.promised_date) < new Date() && j.status !== "completed" && j.status !== "cancelled";
                  return (
                    <tr key={j.id} className="border-t border-border">
                      <td className="px-5 py-3">
                        <div className="font-medium">{j.title}</div>
                        {j.description && <div className="line-clamp-1 text-xs text-muted-foreground">{j.description}</div>}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{j.vendor_id ? vendorMap.get(j.vendor_id)?.name ?? "—" : "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{j.machine_id ? machineMap.get(j.machine_id) ?? "—" : "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{formatDate(j.sent_date)}</td>
                      <td className="px-5 py-3">
                        <span className={overdue ? "font-medium text-red-600" : "text-muted-foreground"}>
                          {formatDate(j.promised_date)}
                          {overdue && <span className="ml-1 rounded bg-red-100 px-1 text-[10px] font-bold uppercase text-red-700">Overdue</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{formatDate(j.returned_date)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{j.vendor_cost ? formatTZS(j.vendor_cost) : "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${STATUS_CLASS[j.status] ?? "bg-muted"}`}>
                          {j.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {isManager && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => { setJobEditing(j); setJobOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setConfirmJob(j.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <VendorDialog open={open} onOpenChange={setOpen} vendor={editing} onSaved={load} />
      <JobDialog
        open={jobOpen}
        onOpenChange={setJobOpen}
        job={jobEditing}
        defaultVendorId={jobDefaultVendor}
        vendors={vendors}
        machines={machines}
        onSaved={load}
      />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Delete this vendor?"
        description="Linked work orders will keep their history but lose the vendor reference."
        onConfirm={async () => { await handleDelete(); }}
      />
      <ConfirmDialog
        open={!!confirmJob}
        onOpenChange={(v) => !v && setConfirmJob(null)}
        title="Remove this job?"
        description="This deletes the vendor job record."
        onConfirm={async () => { await handleDeleteJob(); }}
      />
    </div>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function StatCard({ icon, label, value, caption }: { icon: React.ReactNode; label: string; value: React.ReactNode; caption?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {caption && <div className="mt-1 text-[11px] text-muted-foreground">{caption}</div>}
      </CardContent>
    </Card>
  );
}

function VendorDialog({ open, onOpenChange, vendor, onSaved }: any) {
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (open) setForm(vendor ?? { name: "", category: "", contact_name: "", phone: "", email: "", address: "", specialties: "", notes: "", active: true });
  }, [open, vendor]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!form.name?.trim()) return toast.error("Name is required");
    setSubmitting(true);
    const payload: any = {
      organisation_id: profile.organisation_id,
      name: form.name.trim(),
      category: form.category || null,
      contact_name: form.contact_name || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      specialties: form.specialties || null,
      notes: form.notes || null,
      active: form.active ?? true,
    };
    const { error } = vendor
      ? await supabase.from("vendors").update(payload).eq("id", vendor.id)
      : await supabase.from("vendors").insert(payload);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(vendor ? "Updated" : "Created");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{vendor ? "Edit vendor" : "New vendor"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Name *</Label>
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Engine workshop, Dealer service" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact name</Label>
              <Input value={form.contact_name ?? ""} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0712 345 678 or +255712345678" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Address</Label>
              <Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Specialties</Label>
              <Input value={form.specialties ?? ""} onChange={(e) => setForm({ ...form, specialties: e.target.value })} placeholder="e.g. Diesel engines, hydraulics, gearboxes" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes</Label>
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                maxLength={2000}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active ?? true}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active vendor
            </label>
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

function JobDialog({ open, onOpenChange, job, defaultVendorId, vendors, machines, onSaved }: any) {
  const { profile, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (!open) return;
    if (job) {
      setForm({
        vendor_id: job.vendor_id ?? "",
        machine_id: job.machine_id ?? "",
        title: job.title ?? "",
        description: job.description ?? "",
        sent_date: job.sent_date ?? "",
        promised_date: job.promised_date ?? "",
        returned_date: job.returned_date ?? "",
        warranty_days: job.warranty_days ?? "",
        priority: job.priority ?? "normal",
        status: job.status ?? "in_progress",
        vendor_cost: job.vendor_cost ?? "",
        had_comeback: !!job.had_comeback,
      });
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setForm({
        vendor_id: defaultVendorId ?? "",
        machine_id: "",
        title: "",
        description: "",
        sent_date: today,
        promised_date: "",
        returned_date: "",
        warranty_days: "",
        priority: "normal",
        status: "in_progress",
        vendor_cost: "",
        had_comeback: false,
      });
    }
  }, [open, job, defaultVendorId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!form.vendor_id) return toast.error("Pick a vendor");
    if (!form.machine_id) return toast.error("Pick a machine");
    if (!form.title?.trim()) return toast.error("Describe what they are doing");
    if (!form.promised_date) return toast.error("Set the expected finish date");

    setSubmitting(true);
    const payload: any = {
      organisation_id: profile.organisation_id,
      machine_id: form.machine_id,
      title: form.title.trim(),
      description: form.description || null,
      priority: form.priority,
      status: form.status,
      is_outsourced: true,
      vendor_id: form.vendor_id,
      sent_date: form.sent_date || null,
      promised_date: form.promised_date || null,
      returned_date: form.returned_date || null,
      due_date: form.promised_date || null,
      warranty_days: form.warranty_days !== "" ? Number(form.warranty_days) : null,
      vendor_cost: form.vendor_cost !== "" ? Number(form.vendor_cost) : null,
      had_comeback: !!form.had_comeback,
    };
    if (form.status === "completed") payload.completed_at = new Date().toISOString();
    if (!job) payload.created_by = user?.id;

    const { error } = job
      ? await supabase.from("work_orders").update(payload).eq("id", job.id)
      : await supabase.from("work_orders").insert(payload);

    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(job ? "Job updated" : "Job recorded");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{job ? "Edit vendor job" : "Record vendor job"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Vendor *</Label>
              <Select value={form.vendor_id} onValueChange={(v) => setForm({ ...form, vendor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pick a workshop" /></SelectTrigger>
                <SelectContent>
                  {vendors.filter((x: Vendor) => x.active || x.id === form.vendor_id).map((x: Vendor) => (
                    <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Machine *</Label>
              <Select value={form.machine_id} onValueChange={(v) => setForm({ ...form, machine_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pick a machine" /></SelectTrigger>
                <SelectContent>
                  {machines.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>What they are doing *</Label>
              <Input
                value={form.title ?? ""}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Engine overhaul, gearbox rebuild"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Scope / details</Label>
              <textarea
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Parts to replace, symptoms, what 'done' looks like…"
                maxLength={2000}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date sent</Label>
              <Input type="date" value={form.sent_date ?? ""} onChange={(e) => setForm({ ...form, sent_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Expected to finish *</Label>
              <Input type="date" value={form.promised_date ?? ""} onChange={(e) => setForm({ ...form, promised_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Returned date</Label>
              <Input type="date" value={form.returned_date ?? ""} onChange={(e) => setForm({ ...form, returned_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Sent</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                  <SelectItem value="completed">Closed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cost (TZS)</Label>
              <Input type="number" min={0} step="0.01" value={form.vendor_cost ?? ""} onChange={(e) => setForm({ ...form, vendor_cost: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Warranty (days)</Label>
              <Input type="number" min={0} value={form.warranty_days ?? ""} onChange={(e) => setForm({ ...form, warranty_days: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={!!form.had_comeback}
                onChange={(e) => setForm({ ...form, had_comeback: e.target.checked })}
              />
              Came back / had to be reworked
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {job ? "Save changes" : "Record job"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
