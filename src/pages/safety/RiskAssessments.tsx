import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { Link } from "react-router-dom";
import { formatWoNumber } from "@/components/WorkOrderPreview";

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  pending_approval: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};
const RISK_CLASS: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

export default function RiskAssessments() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("risk_assessments")
        .select("*, work_orders(id, title, wo_number, wo_year), machines(name)")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      setItems(data ?? []);
      setLoading(false);
    })();
  }, [profile]);

  const filtered = useMemo(() => filter === "all" ? items : items.filter((x) => x.status === filter), [items, filter]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Risk assessments</h1>
        <p className="text-sm text-muted-foreground">Job Safety Analyses linked to work orders and machines. Create a new one from the relevant work order.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", "draft", "pending_approval", "approved", "rejected"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${filter === s ? "bg-primary text-primary-foreground" : "border-border bg-card"}`}>
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="No risk assessments" description="Open a work order to create one." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Title</th>
                <th className="px-5 py-3 font-medium">Work order</th>
                <th className="px-5 py-3 font-medium">Machine</th>
                <th className="px-5 py-3 font-medium">Overall risk</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((x) => (
                <tr key={x.id} className="border-t border-border">
                  <td className="px-5 py-3">{x.title}</td>
                  <td className="px-5 py-3">
                    {x.work_orders ? (
                      <Link to={`/work-orders/${x.work_orders.id}`} className="text-primary hover:underline">
                        {formatWoNumber(x.work_orders.wo_year, x.work_orders.wo_number)}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{x.machines?.name ?? "—"}</td>
                  <td className="px-5 py-3">{x.overall_risk && <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${RISK_CLASS[x.overall_risk]}`}>{x.overall_risk}</span>}</td>
                  <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_CLASS[x.status]}`}>{x.status.replace(/_/g, " ")}</span></td>
                  <td className="px-5 py-3 text-muted-foreground">{formatDate(x.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
