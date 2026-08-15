import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { MapPin, Plus, Loader2, Star } from "lucide-react";
import { toast } from "sonner";

export default function Locations() {
  const { profile, user } = useAuth();
  const { isManager } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<any[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: l, error: e1 }, { data: b, error: e2 }] = await Promise.all([
      (supabase as any).from("stock_locations").select("*, profiles:manager(full_name)").order("name"),
      (supabase as any).from("stock_balances").select("location_id").gt("physical_stock", 0),
    ]);
    const err = e1 || e2;
    if (err) toast.error(err.message);
    setLocations(l ?? []);
    const counts: Record<string, number> = {};
    (b ?? []).forEach((row: any) => { counts[row.location_id] = (counts[row.location_id] ?? 0) + 1; });
    setItemCounts(counts);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock locations</h1>
          <p className="text-sm text-muted-foreground">Warehouses and storage areas — the "where is it" for every item.</p>
        </div>
        {isManager && <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Add location</Button>}
      </div>

      {locations.length === 0 ? (
        <EmptyState icon={<MapPin className="h-5 w-5" />} title="No locations yet" description="Add your first store or warehouse." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((l) => (
            <div key={l.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  {l.name}
                  {l.is_default && <Star className="h-3.5 w-3.5 text-amber-500" />}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${l.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{l.status}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {[l.site, l.building, l.area].filter(Boolean).join(" · ") || "No site details"}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{itemCounts[l.id] ?? 0} item{itemCounts[l.id] === 1 ? "" : "s"} in stock</span>
                {l.profiles && <span>Manager: {l.profiles.full_name}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewLocationDialog open={open} setOpen={setOpen} orgId={profile?.organisation_id} onSaved={load} />
    </div>
  );
}

function NewLocationDialog({ open, setOpen, orgId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ name: "", site: "", building: "", area: "" });

  useEffect(() => { if (open) setForm({ name: "", site: "", building: "", area: "" }); }, [open]);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    setSaving(true);
    const { error } = await (supabase as any).from("stock_locations").insert({
      organisation_id: orgId,
      name: form.name.trim(),
      site: form.site || null,
      building: form.building || null,
      area: form.area || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Location added");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add stock location</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" placeholder="e.g. Maintenance Store" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Site</Label><Input value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} className="mt-1" /></div>
            <div><Label>Building</Label><Input value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} className="mt-1" /></div>
          </div>
          <div><Label>Area</Label><Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
