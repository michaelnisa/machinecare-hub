import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { Link } from "react-router-dom";

type Row = {
  key: string;
  category: string;
  subject: string;
  name: string;
  expiry: string;
  link?: string;
};

export default function Certificates() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const [{ data: comp, error: e1 }, { data: cdocs, error: e2 }, { data: ind, error: e3 }, { data: ppe, error: e4 }, { data: eq, error: e5 }, { data: tools, error: e6 }] = await Promise.all([
        (supabase as any).from("employee_competencies").select("id, competency_name, expiry_date, status, profiles:employee_id(full_name)").not("expiry_date", "is", null).eq("status", "active"),
        (supabase as any).from("contractor_documents").select("id, name, expires_on, contractors(id, company_name)").not("expires_on", "is", null),
        (supabase as any).from("induction_records").select("id, expires_at, inductees(full_name)").not("expires_at", "is", null),
        (supabase as any).from("ppe_issues").select("id, ppe_type, expiry_date, status, profiles:employee_id(full_name), contractor_workers(full_name)").not("expiry_date", "is", null).eq("status", "issued"),
        (supabase as any).from("safety_equipment").select("id, name, certificate_expiry").not("certificate_expiry", "is", null),
        (supabase as any).from("controlled_tools").select("id, name, calibration_due_date").not("calibration_due_date", "is", null),
      ]);
      const err = e1 || e2 || e3 || e4 || e5 || e6;
      if (err) toast.error(err.message);

      const out: Row[] = [];
      (comp ?? []).forEach((r: any) => out.push({
        key: `comp-${r.id}`, category: "Employee competency", subject: r.profiles?.full_name ?? "—",
        name: r.competency_name, expiry: r.expiry_date, link: "/safety/competency",
      }));
      (cdocs ?? []).forEach((r: any) => out.push({
        key: `cdoc-${r.id}`, category: "Contractor document", subject: r.contractors?.company_name ?? "—",
        name: r.name, expiry: r.expires_on, link: r.contractors ? `/safety/contractors/${r.contractors.id}` : undefined,
      }));
      (ind ?? []).forEach((r: any) => out.push({
        key: `ind-${r.id}`, category: "Induction", subject: r.inductees?.full_name ?? "—",
        name: "Safety induction", expiry: r.expires_at?.slice(0, 10), link: "/induction/dashboard",
      }));
      (ppe ?? []).forEach((r: any) => out.push({
        key: `ppe-${r.id}`, category: "PPE", subject: r.profiles?.full_name ?? r.contractor_workers?.full_name ?? "—",
        name: r.ppe_type, expiry: r.expiry_date, link: "/safety/ppe",
      }));
      (eq ?? []).forEach((r: any) => out.push({
        key: `eq-${r.id}`, category: "Equipment certificate", subject: r.name,
        name: "Certificate", expiry: r.certificate_expiry, link: "/safety/equipment",
      }));
      (tools ?? []).forEach((r: any) => out.push({
        key: `tool-${r.id}`, category: "Tool calibration", subject: r.name,
        name: "Calibration", expiry: r.calibration_due_date, link: "/safety/controlled-tools",
      }));

      out.sort((a, b) => (a.expiry < b.expiry ? -1 : 1));
      setRows(out);
      setLoading(false);
    })();
  }, [profile]);

  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const bucket = (r: Row) => (r.expiry < today ? "expired" : r.expiry <= in30 ? "expiring" : "ok");
  const BUCKET_CLASS: Record<string, string> = {
    expired: "bg-red-100 text-red-700",
    expiring: "bg-amber-100 text-amber-700",
    ok: "bg-emerald-100 text-emerald-700",
  };

  const filtered = useMemo(() => filter === "all" ? rows : rows.filter((r) => bucket(r) === filter), [rows, filter]);

  const stats = useMemo(() => ({
    expired: rows.filter((r) => bucket(r) === "expired").length,
    expiring: rows.filter((r) => bucket(r) === "expiring").length,
  }), [rows]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Certificates &amp; compliance</h1>
        <p className="text-sm text-muted-foreground">Every expiring certificate across competencies, contractors, induction, PPE and safety equipment — in one register.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Expired</div>
          <div className={`mt-1 text-2xl font-semibold ${stats.expired > 0 ? "text-red-600" : ""}`}>{stats.expired}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Expiring ≤30 days</div>
          <div className={`mt-1 text-2xl font-semibold ${stats.expiring > 0 ? "text-amber-600" : ""}`}>{stats.expiring}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", "expired", "expiring", "ok"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${filter === s ? "bg-primary text-primary-foreground" : "border-border bg-card"}`}>
            {s === "ok" ? "current" : s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<BadgeCheck className="h-5 w-5" />} title="Nothing to show" description="No certificates match this filter." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Subject</th>
                <th className="px-5 py-3 font-medium">Certificate</th>
                <th className="px-5 py-3 font-medium">Expiry</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.key} className="border-t border-border">
                  <td className="px-5 py-3 text-muted-foreground">{r.category}</td>
                  <td className="px-5 py-3">{r.link ? <Link to={r.link} className="text-primary hover:underline">{r.subject}</Link> : r.subject}</td>
                  <td className="px-5 py-3">{r.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{formatDate(r.expiry)}</td>
                  <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${BUCKET_CLASS[bucket(r)]}`}>{bucket(r) === "ok" ? "current" : bucket(r)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
