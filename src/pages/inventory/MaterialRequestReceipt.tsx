import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/PageLoader";
import { ArrowLeft, Printer, PackageX } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/format";
import { formatWoNumber } from "@/components/WorkOrderPreview";

type IssuedLine = {
  item_id: string;
  name: string;
  part_number: string | null;
  unit: string | null;
  quantity: number;
  location_name: string | null;
  issued_at: string;
  issued_by_name: string;
};

export default function MaterialRequestReceipt() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<any>(null);
  const [request, setRequest] = useState<any>(null);
  const [lines, setLines] = useState<IssuedLine[]>([]);
  const [requesterName, setRequesterName] = useState("—");
  const [reviewerName, setReviewerName] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: req } = await (supabase as any)
        .from("material_requests")
        .select("*, work_orders(id, title, wo_number, wo_year), machines(name), material_request_items(*, inventory_items(name, part_number, unit), stock_locations(name))")
        .eq("id", id)
        .maybeSingle();

      if (!req) { setLoading(false); return; }
      setRequest(req);

      const { data: txns } = await (supabase as any)
        .from("stock_transactions")
        .select("item_id, quantity, created_at, performed_by, location_id")
        .eq("reference", id)
        .eq("transaction_type", "issue")
        .order("created_at", { ascending: true });

      const peopleIds = [
        ...new Set([req.requested_by, req.reviewed_by, ...(txns ?? []).map((t: any) => t.performed_by)].filter(Boolean)),
      ] as string[];
      const [{ data: profs }, { data: orgRow }] = await Promise.all([
        peopleIds.length ? supabase.from("profiles").select("id, full_name").in("id", peopleIds) : Promise.resolve({ data: [] }),
        req.organisation_id ? supabase.from("organisations").select("id, name").eq("id", req.organisation_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const nameMap: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { nameMap[p.id] = p.full_name ?? "—"; });
      setRequesterName(nameMap[req.requested_by] ?? "—");
      setReviewerName(req.reviewed_by ? (nameMap[req.reviewed_by] ?? "—") : null);
      setOrg(orgRow);

      const itemMeta: Record<string, { name: string; part_number: string | null; unit: string | null }> = {};
      const locMeta: Record<string, string> = {};
      for (const it of req.material_request_items ?? []) {
        itemMeta[it.item_id] = {
          name: it.inventory_items?.name ?? "—",
          part_number: it.inventory_items?.part_number ?? null,
          unit: it.inventory_items?.unit ?? null,
        };
        if (it.location_id) locMeta[it.location_id] = it.stock_locations?.name ?? "—";
      }

      // Group issue transactions by item — a line may have been issued in
      // more than one batch, but the receipt shows one row per item with
      // the total issued and the most recent handover.
      const grouped = new Map<string, IssuedLine>();
      for (const t of txns ?? []) {
        const meta = itemMeta[t.item_id];
        if (!meta) continue;
        const existing = grouped.get(t.item_id);
        const issuedByName = nameMap[t.performed_by] ?? "—";
        if (existing) {
          existing.quantity += Number(t.quantity) * -1; // quantity stored negative on physical_stock issue rows
          existing.issued_at = t.created_at;
          existing.issued_by_name = issuedByName;
        } else {
          grouped.set(t.item_id, {
            item_id: t.item_id,
            name: meta.name,
            part_number: meta.part_number,
            unit: meta.unit,
            quantity: Number(t.quantity) * -1,
            location_name: locMeta[t.location_id] ?? null,
            issued_at: t.created_at,
            issued_by_name: issuedByName,
          });
        }
      }
      setLines([...grouped.values()]);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <PageLoader />;
  if (!request) return <div className="p-6 text-sm text-muted-foreground">Request not found.</div>;

  const receiptRef = `GIR-${request.id.slice(0, 8).toUpperCase()}`;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between print:hidden">
        <Link to="/inventory/requests" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to requests
        </Link>
        {lines.length > 0 && (
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Print
          </Button>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <PackageX className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Nothing has been issued yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A receipt is only available once an inventory manager confirms the handover for at least one line on this request.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8 print:rounded-none print:border-none print:p-0 print:shadow-none">
          <div className="flex items-start justify-between border-b border-border pb-4">
            <div>
              <h1 className="text-lg font-semibold">{org?.name ?? "Goods Issue Receipt"}</h1>
              <p className="text-sm text-muted-foreground">Goods Issue Receipt</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p className="font-medium text-foreground">{receiptRef}</p>
              <p>{formatDate(lines[lines.length - 1]?.issued_at)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 py-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Requested by</p>
              <p>{requesterName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Approved by</p>
              <p>{reviewerName ?? "—"}</p>
            </div>
            {request.work_orders && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Work order</p>
                <p>{formatWoNumber(request.work_orders.wo_year, request.work_orders.wo_number)} — {request.work_orders.title}</p>
              </div>
            )}
            {request.machines && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Machine</p>
                <p>{request.machines.name}</p>
              </div>
            )}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 font-medium">Location</th>
                <th className="py-2 text-right font-medium">Qty issued</th>
                <th className="py-2 font-medium">Issued by</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.item_id} className="border-b border-border/60">
                  <td className="py-2">
                    <div className="font-medium">{l.name}</div>
                    {l.part_number && <div className="text-xs text-muted-foreground">{l.part_number}</div>}
                  </td>
                  <td className="py-2 text-muted-foreground">{l.location_name ?? "—"}</td>
                  <td className="py-2 text-right">{formatNumber(l.quantity)} {l.unit}</td>
                  <td className="py-2 text-muted-foreground">{l.issued_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-10 grid grid-cols-2 gap-8 text-xs">
            <div>
              <div className="h-10 border-b border-border" />
              <p className="mt-1 text-muted-foreground">Issued by (signature)</p>
            </div>
            <div>
              <div className="h-10 border-b border-border" />
              <p className="mt-1 text-muted-foreground">Received by (signature)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
