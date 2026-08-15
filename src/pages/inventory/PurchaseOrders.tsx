import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ClipboardList, CheckCircle2, XCircle, Loader2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatNumber } from "@/lib/format";

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  pending_approval: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  sent: "bg-indigo-100 text-indigo-700",
  partially_received: "bg-blue-100 text-blue-700",
  received: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  closed: "bg-slate-100 text-slate-600",
};

export default function PurchaseOrders() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [receiveTarget, setReceiveTarget] = useState<any>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("purchase_orders")
      .select("*, suppliers(name), purchase_order_items(*, inventory_items(name, part_number, unit))")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setOrders(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const totalOf = (po: any) => (po.purchase_order_items ?? []).reduce((s: number, it: any) => s + Number(it.quantity) * Number(it.unit_price) * (1 + Number(it.tax_rate) / 100), 0);

  const filtered = useMemo(() => filter === "all" ? orders : orders.filter((o) => o.status === filter), [orders, filter]);

  const review = async (id: string, decision: "approved" | "cancelled") => {
    const { error } = await (supabase as any).rpc("review_purchase_order", { _po_id: id, _decision: decision });
    if (error) return toast.error(error.message);
    toast.success(decision === "approved" ? "Approved" : "Cancelled");
    load();
  };

  const markSent = async (id: string) => {
    const { error } = await (supabase as any).from("purchase_orders").update({ status: "sent" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked as sent");
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Purchase orders</h1>
        <p className="text-sm text-muted-foreground">Created from approved purchase requests. Receive goods here once they arrive.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", "draft", "approved", "sent", "partially_received", "received", "cancelled"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${filter === s ? "bg-primary text-primary-foreground" : "border-border bg-card"}`}>
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="No purchase orders" description="Approve a purchase request and convert it to a PO." />
      ) : (
        <div className="space-y-3">
          {filtered.map((po) => (
            <div key={po.id} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">PO-{po.po_year}-{String(po.po_number).padStart(4, "0")} — {po.suppliers?.name}</div>
                  <div className="text-xs text-muted-foreground">{po.delivery_date && `Due ${po.delivery_date} · `}{po.payment_terms}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{formatMoney(totalOf(po))}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_CLASS[po.status]}`}>{po.status.replace(/_/g, " ")}</span>
                </div>
              </div>
              <div className="space-y-1">
                {(po.purchase_order_items ?? []).map((it: any) => (
                  <div key={it.id} className="flex items-center justify-between rounded bg-muted/40 px-2 py-1 text-xs">
                    <span>{it.inventory_items?.name ?? it.item_description} — {formatNumber(it.quantity)} {it.inventory_items?.unit ?? ""} @ {formatMoney(it.unit_price)}</span>
                    <span className="text-muted-foreground">received {formatNumber(it.quantity_received)}/{formatNumber(it.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                {po.status === "draft" && (
                  <>
                    <Button size="sm" onClick={() => review(po.id, "approved")} className="gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => review(po.id, "cancelled")}><XCircle className="h-3.5 w-3.5" /> Cancel</Button>
                  </>
                )}
                {po.status === "approved" && <Button size="sm" onClick={() => markSent(po.id)}>Mark as sent</Button>}
                {(po.status === "sent" || po.status === "partially_received") && (
                  <Button size="sm" variant="outline" onClick={() => setReceiveTarget(po)} className="gap-1.5"><PackageCheck className="h-3.5 w-3.5" /> Receive goods</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ReceiveGoodsDialog po={receiveTarget} onClose={() => setReceiveTarget(null)} onSaved={load} />
    </div>
  );
}

function ReceiveGoodsDialog({ po, onClose, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [locationId, setLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Record<string, { accepted: string; rejected: string; reason: string; quarantine: boolean }>>({});

  useEffect(() => {
    if (po) {
      setNotes("");
      const init: Record<string, any> = {};
      (po.purchase_order_items ?? []).forEach((it: any) => {
        const outstanding = Number(it.quantity) - Number(it.quantity_received);
        init[it.id] = { accepted: outstanding > 0 ? String(outstanding) : "0", rejected: "0", reason: "", quarantine: false };
      });
      setLines(init);
      supabase.from("stock_locations" as any).select("id, name, is_default").order("name").then(({ data }: any) => {
        setLocations(data ?? []);
        setLocationId(data?.find((l: any) => l.is_default)?.id ?? data?.[0]?.id ?? "");
      });
    }
  }, [po]);

  if (!po) return null;

  const submit = async () => {
    const items = Object.entries(lines)
      .map(([po_item_id, l]) => ({
        po_item_id,
        quantity_accepted: Number(l.accepted) || 0,
        quantity_rejected: Number(l.rejected) || 0,
        quantity_received: (Number(l.accepted) || 0) + (Number(l.rejected) || 0),
        rejection_reason: l.reason || null,
        quarantined: l.quarantine,
      }))
      .filter((l) => l.quantity_received > 0);
    if (items.length === 0) return toast.error("Enter at least one received quantity");
    if (!locationId) return toast.error("Select a location");
    setSaving(true);
    const { error } = await (supabase as any).rpc("record_goods_receipt", {
      _po_id: po.id,
      _location_id: locationId,
      _items: items,
      _notes: notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Goods receipt recorded");
    onClose();
    onSaved();
  };

  return (
    <Dialog open={!!po} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Receive goods — PO-{po.po_year}-{String(po.po_number).padStart(4, "0")}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Receiving location</Label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          {(po.purchase_order_items ?? []).map((it: any) => {
            const outstanding = Number(it.quantity) - Number(it.quantity_received);
            if (outstanding <= 0) return null;
            const line = lines[it.id] ?? { accepted: "0", rejected: "0", reason: "", quarantine: false };
            return (
              <div key={it.id} className="rounded-lg border border-border p-3">
                <div className="mb-2 text-sm font-medium">{it.inventory_items?.name ?? it.item_description} — outstanding {formatNumber(outstanding)} {it.inventory_items?.unit}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Accepted qty</Label><Input type="number" min={0} value={line.accepted} onChange={(e) => setLines({ ...lines, [it.id]: { ...line, accepted: e.target.value } })} /></div>
                  <div><Label className="text-xs">Rejected qty</Label><Input type="number" min={0} value={line.rejected} onChange={(e) => setLines({ ...lines, [it.id]: { ...line, rejected: e.target.value } })} /></div>
                </div>
                {Number(line.rejected) > 0 && (
                  <Input className="mt-2" placeholder="Rejection reason" value={line.reason} onChange={(e) => setLines({ ...lines, [it.id]: { ...line, reason: e.target.value } })} />
                )}
                <label className="mt-2 flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={line.quarantine} onChange={(e) => setLines({ ...lines, [it.id]: { ...line, quarantine: e.target.checked } })} />
                  Hold accepted quantity in quarantine (inspection pending) instead of making it available immediately
                </label>
              </div>
            );
          })}
          <div><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record receipt"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
