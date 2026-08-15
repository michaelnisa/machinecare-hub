import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { PackageX, CheckCircle2, XCircle, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/format";

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  returned_to_supplier: "bg-slate-100 text-slate-600",
};

export default function Quarantine() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<any[]>([]);
  const [filter, setFilter] = useState("pending");

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("goods_receipt_items")
      .select(
        "*, purchase_order_items(item_id, inventory_items(name, part_number, unit)), goods_receipts(received_at, purchase_orders(po_number, po_year, suppliers(name)), stock_locations(name))",
      )
      .eq("quarantined", true)
      .order("id", { ascending: false });
    if (error) toast.error(error.message);
    setLines(data ?? []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, [profile]);

  const filtered =
    filter === "all"
      ? lines
      : lines.filter((l) => l.quarantine_status === filter);

  const resolve = async (
    id: string,
    decision: "approved" | "rejected" | "returned_to_supplier",
  ) => {
    const { error } = await (supabase as any).rpc("resolve_quarantine_item", {
      _goods_receipt_item_id: id,
      _decision: decision,
    });
    if (error) return toast.error(error.message);
    toast.success("Resolved");
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quarantine</h1>
        <p className="text-sm text-muted-foreground">
          Received stock held back from availability pending inspection, damage
          review, or missing documentation.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", "pending", "approved", "rejected", "returned_to_supplier"].map(
          (s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full border px-3 py-1 text-xs capitalize ${filter === s ? "bg-primary text-primary-foreground" : "border-border bg-card"}`}
            >
              {s.replace(/_/g, " ")}
            </button>
          ),
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<PackageX className="h-5 w-5" />}
          title="Nothing in quarantine"
          description="Received items flagged for inspection will show up here."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Item</th>
                  <th className="px-5 py-3 font-medium">PO</th>
                  <th className="px-5 py-3 font-medium">Location</th>
                  <th className="px-5 py-3 font-medium">Qty</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const po = l.goods_receipts?.purchase_orders;
                  return (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-5 py-3">
                        {l.purchase_order_items?.inventory_items?.name}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {po
                          ? `PO-${po.po_year}-${String(po.po_number).padStart(4, "0")} · ${po.suppliers?.name}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {l.goods_receipts?.stock_locations?.name}
                      </td>
                      <td className="px-5 py-3">
                        {formatNumber(l.quantity_accepted)}{" "}
                        {l.purchase_order_items?.inventory_items?.unit}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_CLASS[l.quarantine_status]}`}
                        >
                          {l.quarantine_status?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {l.quarantine_status === "pending" && (
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => resolve(l.id, "approved")}
                              className="gap-1"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resolve(l.id, "rejected")}
                              className="gap-1"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                resolve(l.id, "returned_to_supplier")
                              }
                              className="gap-1"
                            >
                              <Undo2 className="h-3.5 w-3.5" /> Return
                            </Button>
                          </div>
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
    </div>
  );
}
