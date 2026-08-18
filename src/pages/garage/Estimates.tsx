import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatMoney } from "@/lib/format";
import { estimateTotal } from "@/lib/garage-money";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600", sent: "bg-amber-100 text-amber-700", approved: "bg-emerald-100 text-emerald-700",
  declined: "bg-red-100 text-red-700", changes_requested: "bg-purple-100 text-purple-700",
};

const TABS = [
  { value: "all", label: "All" }, { value: "draft", label: "Draft" }, { value: "sent", label: "Sent" },
  { value: "approved", label: "Approved" }, { value: "declined", label: "Declined" }, { value: "changes_requested", label: "Changes requested" },
];

export default function GarageEstimates() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [estimates, setEstimates] = useState<any[]>([]);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!profile) return;
    (supabase as any)
      .from("garage_estimates")
      .select("*, garage_estimate_items(*), garage_jobs(id, job_number, job_year, garage_customers(name), garage_vehicles(make, model, registration_number))")
      .order("created_at", { ascending: false })
      .then(({ data, error }: any) => { if (error) toast.error(error.message); setEstimates(data ?? []); setLoading(false); });
  }, [profile]);

  const filtered = useMemo(() => {
    let out = tab === "all" ? estimates : estimates.filter((e) => e.status === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((e) => e.garage_jobs?.garage_customers?.name?.toLowerCase().includes(q) || e.garage_jobs?.garage_vehicles?.registration_number?.toLowerCase().includes(q));
    }
    return out;
  }, [estimates, tab, search]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Estimates</h1>
        <p className="text-sm text-muted-foreground">Every quotation sent — and whether the customer approved it.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${tab === t.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted/60"}`}>
            {t.label}
          </button>
        ))}
        <Input placeholder="Search customer or plate…" value={search} onChange={(e) => setSearch(e.target.value)} className="ml-auto max-w-xs" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<FileText className="h-5 w-5" />} title="No estimates" description="Estimates are created from a job's Diagnosis section." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Job</th>
                <th className="px-5 py-3 font-medium">Customer / vehicle</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    {e.garage_jobs ? (
                      <Link to={`/garage/jobs/${e.garage_jobs.id}`} className="font-medium text-primary hover:underline">JOB-{e.garage_jobs.job_year}-{String(e.garage_jobs.job_number).padStart(4, "0")}</Link>
                    ) : "—"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {e.garage_jobs?.garage_customers?.name}
                    {e.garage_jobs?.garage_vehicles?.registration_number && ` · ${e.garage_jobs.garage_vehicles.registration_number}`}
                  </td>
                  <td className="px-5 py-3">{formatMoney(estimateTotal(e))}</td>
                  <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_BADGE[e.status]}`}>{e.status.replace("_", " ")}</span></td>
                  <td className="px-5 py-3 text-muted-foreground">{formatDate(e.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/garage/estimates/${e.id}/print`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Print</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
