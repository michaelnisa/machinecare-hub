import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/PageLoader";
import { AlertTriangle, Phone, ExternalLink, CheckCircle2, ClipboardPlus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Row = {
  id: string;
  machine_id: string;
  organisation_id: string;
  reporter_name: string;
  reporter_phone: string;
  description: string;
  status: string;
  work_order_id: string | null;
  created_at: string;
  machine?: { id: string; name: string; registration_number: string | null } | null;
};

const STATUS_VARIANTS: Record<string, string> = {
  new: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  triaged: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  converted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  dismissed: "bg-muted text-muted-foreground",
};

export default function FaultReports() {
  const { profile, user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open">("open");

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("fault_reports")
      .select("*, machine:machines(id, name, registration_number)")
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const visible = filter === "open" ? rows.filter((r) => r.status === "new" || r.status === "triaged") : rows;

  const convertToWO = async (r: Row) => {
    if (!profile) return;
    const { data: wo, error } = await supabase
      .from("work_orders")
      .insert({
        organisation_id: r.organisation_id,
        machine_id: r.machine_id,
        title: `Fault: ${r.description.slice(0, 80)}`,
        description: `Reported by ${r.reporter_name} (${r.reporter_phone})\n\n${r.description}`,
        priority: "high",
        status: "open",
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !wo) return toast.error(error?.message ?? "Failed");
    await (supabase as any).from("fault_reports").update({ status: "converted", work_order_id: wo.id }).eq("id", r.id);
    toast.success("Work order created");
    load();
  };

  const dismiss = async (r: Row) => {
    const { error } = await (supabase as any).from("fault_reports").update({ status: "dismissed" }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Dismissed");
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <AlertTriangle className="h-6 w-6 text-amber-500" /> Fault reports
          </h1>
          <p className="text-sm text-muted-foreground">Anonymous reports submitted via QR scan</p>
        </div>
        <div className="flex gap-2">
          <Button variant={filter === "open" ? "default" : "outline"} size="sm" onClick={() => setFilter("open")}>Open</Button>
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>All</Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No fault reports {filter === "open" ? "open" : "yet"}.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/machines/${r.machine_id}`} className="font-semibold hover:underline">
                      {r.machine?.name ?? "Machine"}
                    </Link>
                    {r.machine?.registration_number && (
                      <span className="text-xs text-muted-foreground">· {r.machine.registration_number}</span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_VARIANTS[r.status] ?? ""}`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{r.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>{r.reporter_name}</span>
                    <a href={`tel:${r.reporter_phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Phone className="h-3 w-3" /> {r.reporter_phone}
                    </a>
                    <span>· {format(new Date(r.created_at), "d MMM yy HH:mm")}</span>
                    {r.work_order_id && (
                      <Link to="/work-orders" className="inline-flex items-center gap-1 text-primary hover:underline">
                        <ExternalLink className="h-3 w-3" /> Linked WO
                      </Link>
                    )}
                  </div>
                </div>
                {(r.status === "new" || r.status === "triaged") && (
                  <div className="flex shrink-0 flex-col gap-2">
                    <Button size="sm" onClick={() => convertToWO(r)}>
                      <ClipboardPlus className="mr-1 h-4 w-4" /> Create WO
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => dismiss(r)}>
                      <CheckCircle2 className="mr-1 h-4 w-4" /> Dismiss
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
