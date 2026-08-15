import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Boxes } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatNumber } from "@/lib/format";

interface Props {
  machineId: string;
}

export function MachinePartsList({ machineId }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState<any[]>([]);
  const [available, setAvailable] = useState<Record<string, number>>({});
  const [costThisMonth, setCostThisMonth] = useState(0);
  const [costTotal, setCostTotal] = useState(0);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [{ data: mp }, { data: bal }, { data: txns }] = await Promise.all([
      (supabase as any).from("machine_parts").select("*, inventory_items(name, part_number, unit, unit_cost, criticality)").eq("machine_id", machineId).order("created_at"),
      (supabase as any).from("stock_balances").select("item_id, available_stock"),
      (supabase as any).from("stock_transactions").select("quantity, created_at, inventory_items(unit_cost)").eq("machine_id", machineId).in("transaction_type", ["issue", "consumption"]),
    ]);
    setParts(mp ?? []);
    const map: Record<string, number> = {};
    (bal ?? []).forEach((b: any) => { map[b.item_id] = (map[b.item_id] ?? 0) + Number(b.available_stock); });
    setAvailable(map);

    let month = 0, total = 0;
    (txns ?? []).forEach((t: any) => {
      const cost = Math.abs(Number(t.quantity)) * Number(t.inventory_items?.unit_cost ?? 0);
      total += cost;
      if (new Date(t.created_at) >= monthStart) month += cost;
    });
    setCostThisMonth(month);
    setCostTotal(total);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile, machineId]);

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("machine_parts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const missing = parts.filter((p) => p.is_required && (available[p.item_id] ?? 0) <= 0);

  if (loading) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Required spare parts ({parts.length})</h3>
          <p className="text-xs text-muted-foreground">
            Maintenance parts cost — this month: {formatMoney(costThisMonth)} · all time: {formatMoney(costTotal)}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Link part
        </Button>
      </div>

      {missing.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">
          Maintenance cannot be fully prepared — {missing.map((p) => p.inventory_items?.name).join(", ")} unavailable.
        </div>
      )}

      {parts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
          <Boxes className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No spare parts linked to this machine yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {parts.map((p) => {
            const avail = available[p.item_id] ?? 0;
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.inventory_items?.name}</span>
                    {p.inventory_items?.part_number && <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{p.inventory_items.part_number}</span>}
                    {p.inventory_items?.criticality === "critical" && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] text-red-700">critical</span>}
                    {p.is_required && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-700">required</span>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatNumber(p.quantity_per_unit)} per service · {formatMoney(p.inventory_items?.unit_cost)} each</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={`text-xs font-medium ${avail > 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {avail > 0 ? `${formatNumber(avail)} available` : "unavailable"}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <LinkPartDialog open={open} setOpen={setOpen} machineId={machineId} orgId={profile?.organisation_id} userId={profile?.id} onSaved={load} />
    </div>
  );
}

function LinkPartDialog({ open, setOpen, machineId, orgId, userId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ item_id: "", quantity_per_unit: "1", is_required: true, notes: "" });

  useEffect(() => {
    if (open) {
      setForm({ item_id: "", quantity_per_unit: "1", is_required: true, notes: "" });
      supabase.from("inventory_items").select("id, name, part_number").eq("status", "active").order("name").then(({ data }) => setItems(data ?? []));
    }
  }, [open]);

  const submit = async () => {
    if (!form.item_id) return toast.error("Select a part");
    setSaving(true);
    const { error } = await (supabase as any).from("machine_parts").insert({
      organisation_id: orgId,
      machine_id: machineId,
      item_id: form.item_id,
      quantity_per_unit: Number(form.quantity_per_unit) || 1,
      is_required: !!form.is_required,
      notes: form.notes || null,
      created_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.code === "23505" ? "This part is already linked to this machine" : error.message);
    toast.success("Part linked");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Link spare part to machine</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Part *</Label>
            <select value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select…</option>
              {items.map((i: any) => <option key={i.id} value={i.id}>{i.name}{i.part_number ? ` · ${i.part_number}` : ""}</option>)}
            </select>
          </div>
          <div><Label>Quantity per service</Label><Input type="number" min={0} step="any" value={form.quantity_per_unit} onChange={(e) => setForm({ ...form, quantity_per_unit: e.target.value })} className="mt-1" /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_required} onChange={(e) => setForm({ ...form, is_required: e.target.checked })} />
            Required for maintenance prep (flags as unavailable if out of stock)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
