import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { History as HistoryIcon } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatNumber } from "@/lib/format";

const TYPE_LABEL: Record<string, string> = {
  receipt: "Receipt", issue: "Issue", return: "Return", transfer: "Transfer",
  reservation: "Reservation", release: "Release", adjustment: "Adjustment",
  damage: "Damage", scrap: "Scrap", consumption: "Consumption", purchase: "Purchase",
  count_adjustment: "Count adjustment",
};

export default function InventoryHistory() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [txns, setTxns] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [itemFilter, setItemFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    let query = (supabase as any)
      .from("stock_transactions")
      .select("*, inventory_items(name, part_number, unit), stock_locations(name), machines(name), work_orders(wo_number), profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (itemFilter !== "all") query = query.eq("item_id", itemFilter);
    if (typeFilter !== "all") query = query.eq("transaction_type", typeFilter);
    if (from) query = query.gte("created_at", `${from}T00:00:00`);
    if (to) query = query.lte("created_at", `${to}T23:59:59`);

    const [{ data: t, error: e1 }, { data: i, error: e2 }] = await Promise.all([
      query,
      items.length ? Promise.resolve({ data: items, error: null }) : supabase.from("inventory_items").select("id, name, part_number").order("name"),
    ]);
    const err = e1 || e2;
    if (err) toast.error(err.message);
    setTxns(t ?? []);
    if (!items.length) setItems(i ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile, itemFilter, typeFilter, from, to]);

  const types = useMemo(() => Object.keys(TYPE_LABEL), []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory history</h1>
        <p className="text-sm text-muted-foreground">Every stock movement — immutable, with who, when, why, and what it's linked to.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={itemFilter} onChange={(e) => setItemFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All items</option>
          {items.map((i: any) => <option key={i.id} value={i.id}>{i.name}{i.part_number ? ` · ${i.part_number}` : ""}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All transaction types</option>
          {types.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
        <span className="text-xs text-muted-foreground">to</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
      </div>

      {loading ? (
        <PageLoader />
      ) : txns.length === 0 ? (
        <EmptyState icon={<HistoryIcon className="h-5 w-5" />} title="No transactions" description="No stock movements match this filter." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Item</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Qty</th>
                <th className="px-5 py-3 font-medium">Location</th>
                <th className="px-5 py-3 font-medium">Machine / WO</th>
                <th className="px-5 py-3 font-medium">By</th>
                <th className="px-5 py-3 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-5 py-3 text-muted-foreground">{formatDate(t.created_at)}</td>
                  <td className="px-5 py-3">
                    <div className="font-medium">{t.inventory_items?.name ?? "—"}</div>
                    {t.inventory_items?.part_number && <div className="text-xs text-muted-foreground">{t.inventory_items.part_number}</div>}
                  </td>
                  <td className="px-5 py-3">{TYPE_LABEL[t.transaction_type] ?? t.transaction_type}</td>
                  <td className={`px-5 py-3 font-medium ${Number(t.quantity) > 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {Number(t.quantity) > 0 ? "+" : ""}{formatNumber(t.quantity)} {t.inventory_items?.unit}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{t.stock_locations?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {t.machines?.name}
                    {t.machines?.name && t.work_orders?.wo_number ? " · " : ""}
                    {t.work_orders ? <Link to={`/work-orders/${t.work_order_id}`} className="text-primary hover:underline">WO-{t.work_orders.wo_number}</Link> : null}
                    {!t.machines?.name && !t.work_orders ? "—" : null}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{t.profiles?.full_name ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{t.reason ?? t.reference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
