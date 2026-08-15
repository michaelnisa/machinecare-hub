import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ArrowLeftRight, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatNumber, formatDate } from "@/lib/format";

export default function Transfers() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("stock_transactions")
      .select(
        "*, inventory_items(name, unit), from_loc:location_id(name), to_loc:to_location_id(name), profiles:performed_by(full_name)",
      )
      .eq("transaction_type", "transfer")
      .gt("quantity", 0)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    setTransfers(data ?? []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, [profile]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Stock transfers
          </h1>
          <p className="text-sm text-muted-foreground">
            Move stock between locations. Updates both balances atomically.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New transfer
        </Button>
      </div>

      {transfers.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight className="h-5 w-5" />}
          title="No transfers yet"
          description="Move stock between stores when needed."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Item</th>
                  <th className="px-5 py-3 font-medium">From</th>
                  <th className="px-5 py-3 font-medium">To</th>
                  <th className="px-5 py-3 font-medium">Quantity</th>
                  <th className="px-5 py-3 font-medium">By</th>
                  <th className="px-5 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-5 py-3 text-muted-foreground">
                      {formatDate(t.created_at)}
                    </td>
                    <td className="px-5 py-3">{t.inventory_items?.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {t.from_loc?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {t.to_loc?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      {formatNumber(t.quantity)} {t.inventory_items?.unit}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {t.profiles?.full_name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {t.reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NewTransferDialog open={open} setOpen={setOpen} onSaved={load} />
    </div>
  );
}

function NewTransferDialog({ open, setOpen, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    item_id: "",
    from_location_id: "",
    to_location_id: "",
    quantity: "",
    reason: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        item_id: "",
        from_location_id: "",
        to_location_id: "",
        quantity: "",
        reason: "",
      });
      Promise.all([
        supabase
          .from("inventory_items")
          .select("id, name, part_number, unit")
          .order("name"),
        (supabase as any)
          .from("stock_locations")
          .select("id, name")
          .order("name"),
      ]).then(([{ data: i }, { data: l }]) => {
        setItems(i ?? []);
        setLocations(l ?? []);
      });
    }
  }, [open]);

  const submit = async () => {
    if (!form.item_id || !form.from_location_id || !form.to_location_id)
      return toast.error("Fill in item, source and destination");
    if (form.from_location_id === form.to_location_id)
      return toast.error("Source and destination must differ");
    const qty = Number(form.quantity);
    if (!qty || qty <= 0)
      return toast.error("Enter a quantity greater than zero");
    setSaving(true);
    const { error } = await (supabase as any).rpc("transfer_stock", {
      _item_id: form.item_id,
      _from_location_id: form.from_location_id,
      _to_location_id: form.to_location_id,
      _quantity: qty,
      _reason: form.reason || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Transfer recorded");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New transfer</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Item *</Label>
            <select
              value={form.item_id}
              onChange={(e) => setForm({ ...form, item_id: e.target.value })}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select…</option>
              {items.map((i: any) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                  {i.part_number ? ` · ${i.part_number}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>From *</Label>
              <select
                value={form.from_location_id}
                onChange={(e) =>
                  setForm({ ...form, from_location_id: e.target.value })
                }
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select…</option>
                {locations.map((l: any) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>To *</Label>
              <select
                value={form.to_location_id}
                onChange={(e) =>
                  setForm({ ...form, to_location_id: e.target.value })
                }
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select…</option>
                {locations.map((l: any) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label>Quantity *</Label>
            <Input
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Reason</Label>
            <Textarea
              rows={2}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
