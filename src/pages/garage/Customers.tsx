import { useEffect, useMemo, useState } from "react";
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
import { Users, Plus, Loader2, Phone, Mail, Truck, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export default function GarageCustomers() {
  const { profile, user } = useAuth();
  const { isManager } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vehicleCounts, setVehicleCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: c, error: e1 }, { data: v, error: e2 }] = await Promise.all([
      (supabase as any).from("garage_customers").select("*").order("name"),
      (supabase as any).from("garage_vehicles").select("customer_id"),
    ]);
    const err = e1 || e2;
    if (err) toast.error(err.message);
    setCustomers(c ?? []);
    const counts: Record<string, number> = {};
    (v ?? []).forEach((row: any) => { counts[row.customer_id] = (counts[row.customer_id] ?? 0) + 1; });
    setVehicleCounts(counts);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter((c) => c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q));
  }, [customers, search]);

  const remove = async () => {
    const { error } = await (supabase as any).from("garage_customers").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    if (error) return toast.error(error.code === "23503" ? "This customer has vehicles on file — remove those first" : error.message);
    toast.success("Customer removed");
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">Everyone who brings a vehicle in — their contact details, vehicles, and history.</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="mr-2 h-4 w-4" />Add customer</Button>
      </div>

      <Input placeholder="Search by name, phone or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title={customers.length === 0 ? "No customers yet" : "No matches"} description={customers.length === 0 ? "Add your first customer to start tracking their vehicles and jobs." : "Try a different search."} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">Vehicles</th>
                <th className="px-5 py-3 font-medium">Added</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="cursor-pointer border-t border-border hover:bg-muted/40" onClick={() => setDetail(c)}>
                  <td className="px-5 py-3 font-medium">{c.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    <div className="flex flex-col gap-0.5">
                      {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                      {c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3">{vehicleCounts[c.id] ?? 0}</td>
                  <td className="px-5 py-3 text-muted-foreground">{formatDate(c.created_at)}</td>
                  <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    {isManager && <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CustomerFormDialog open={formOpen} setOpen={setFormOpen} editing={editing} orgId={profile?.organisation_id} userId={user?.id} onSaved={load} />
      <CustomerDetailDialog customer={detail} onClose={() => setDetail(null)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone. Customers with vehicles on file can't be removed until those vehicles are reassigned or deleted.</AlertDialogDescription>
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

function CustomerFormDialog({ open, setOpen, editing, orgId, userId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", notes: "" });

  useEffect(() => {
    if (open) setForm(editing ? { name: editing.name ?? "", phone: editing.phone ?? "", email: editing.email ?? "", address: editing.address ?? "", notes: editing.notes ?? "" } : { name: "", phone: "", email: "", address: "", notes: "" });
  }, [open, editing]);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error } = editing
      ? await (supabase as any).from("garage_customers").update(payload).eq("id", editing.id)
      : await (supabase as any).from("garage_customers").insert({ ...payload, organisation_id: orgId, created_by: userId });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Customer updated" : "Customer added");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Edit customer" : "Add customer"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" /></div>
          </div>
          <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1" /></div>
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

function CustomerDetailDialog({ customer, onClose }: any) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customer) return;
    setLoading(true);
    Promise.all([
      (supabase as any).from("garage_vehicles").select("*").eq("customer_id", customer.id).order("created_at", { ascending: false }),
      (supabase as any).from("garage_customer_messages").select("*").eq("customer_id", customer.id).order("created_at", { ascending: false }).limit(10),
    ]).then(([{ data: v, error: e1 }, { data: m, error: e2 }]) => {
      const err = e1 || e2;
      if (err) toast.error(err.message);
      setVehicles(v ?? []); setMessages(m ?? []); setLoading(false);
    });
  }, [customer?.id]);

  if (!customer) return null;

  return (
    <Dialog open={!!customer} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{customer.name}</DialogTitle></DialogHeader>
        <div className="space-y-1 text-sm text-muted-foreground">
          {customer.phone && <div className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{customer.phone}</div>}
          {customer.email && <div className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{customer.email}</div>}
          {customer.address && <div>{customer.address}</div>}
        </div>
        {customer.notes && <p className="rounded-lg bg-muted/40 p-3 text-sm">{customer.notes}</p>}

        <div>
          <h3 className="mb-2 text-sm font-medium">Vehicles ({vehicles.length})</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vehicles on file yet.</p>
          ) : (
            <ul className="space-y-2">
              {vehicles.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div>
                    <div className="font-medium">{[v.make, v.model].filter(Boolean).join(" ") || "Vehicle"}</div>
                    <div className="text-xs text-muted-foreground">{v.registration_number ?? "No plate on file"}</div>
                  </div>
                  <Truck className="h-4 w-4 text-muted-foreground" />
                </li>
              ))}
            </ul>
          )}
        </div>

        {messages.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium">Recent messages</h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {messages.map((m) => (
                <li key={m.id}>{formatDate(m.created_at)} — {m.trigger_event?.replace(/_/g, " ") ?? "message"} via {m.channel.replace("_", " ")}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Open a vehicle from Vehicles to see its full job and service history.</p>

        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
