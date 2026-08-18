import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageLoader } from "@/components/PageLoader";
import { Wrench, CheckCircle2, Clock } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/format";
import { STATUS_FLOW, STATUS_LABEL } from "@/lib/garage-constants";

export default function GarageJobStatusPublic() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    (supabase as any).rpc("get_garage_job_status_public", { _job_id: jobId }).then(({ data, error }: any) => {
      if (error || !data || data.length === 0) {
        setNotFound(true);
      } else {
        setJob(data[0]);
      }
      setLoading(false);
    });
  }, [jobId]);

  if (loading) return <PageLoader />;

  if (notFound || !job) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div>
          <p className="text-muted-foreground">We couldn't find that job.</p>
          <Link to="/" className="mt-4 inline-block text-primary hover:underline">Home</Link>
        </div>
      </div>
    );
  }

  const currentIndex = Math.max(0, STATUS_FLOW.indexOf(job.status));
  const isCancelled = job.status === "cancelled";
  const jobLabel = `JOB-${job.job_year}-${String(job.job_number).padStart(4, "0")}`;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wrench className="h-5 w-5" />
          </div>
          <span className="font-semibold">{job.organisation_name ?? "Workshop"}</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold leading-tight">{jobLabel}</h1>
              <p className="text-sm text-muted-foreground">
                {[job.vehicle_make, job.vehicle_model].filter(Boolean).join(" ") || "Vehicle"}
                {job.vehicle_registration ? ` · ${job.vehicle_registration}` : ""}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${isCancelled ? "bg-red-50 text-red-600" : "bg-primary-soft text-primary"}`}>
              {STATUS_LABEL[job.status] ?? job.status}
            </span>
          </div>
          {job.customer_name && <p className="mt-2 text-xs text-muted-foreground">Hi {job.customer_name.split(" ")[0]}, here's where things stand.</p>}
        </div>

        {!isCancelled && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <ol className="space-y-3">
              {STATUS_FLOW.map((s, i) => {
                const done = i < currentIndex;
                const active = i === currentIndex;
                return (
                  <li key={s} className="flex items-center gap-3 text-sm">
                    {done || active ? (
                      <CheckCircle2 className={`h-5 w-5 shrink-0 ${active ? "text-primary" : "text-emerald-500"}`} />
                    ) : (
                      <Clock className="h-5 w-5 shrink-0 text-muted-foreground/40" />
                    )}
                    <span className={active ? "font-medium text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/60"}>
                      {STATUS_LABEL[s]}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {job.expected_completion && !["ready", "delivered", "closed"].includes(job.status) && (
          <div className="rounded-2xl border border-border bg-card p-4 text-sm">
            <span className="text-muted-foreground">Expected completion:</span> <span className="font-medium">{formatDate(job.expected_completion)}</span>
          </div>
        )}

        {job.estimate_status === "sent" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-medium">We've sent you an estimate</p>
            {job.estimate_total != null && <p className="mt-1">Estimated total: {formatMoney(job.estimate_total)}</p>}
            <p className="mt-1 text-xs">Please contact the workshop to approve before we proceed.</p>
          </div>
        )}

        {job.invoice_number != null && (
          <div className="rounded-2xl border border-border bg-card p-5 text-sm">
            <h2 className="mb-2 font-medium">Invoice INV-{job.invoice_year}-{String(job.invoice_number).padStart(4, "0")}</h2>
            <div className="space-y-1.5">
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span>{formatMoney(job.invoice_total)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>{formatMoney(job.invoice_paid)}</span></div>
              <div className="flex justify-between font-medium"><span>Outstanding</span><span>{formatMoney(job.invoice_outstanding)}</span></div>
            </div>
          </div>
        )}

        {job.mechanic_name && (
          <p className="text-center text-xs text-muted-foreground">Being handled by {job.mechanic_name}</p>
        )}

        {(job.organisation_phone || job.organisation_address || job.business_hours) && (
          <div className="rounded-2xl border border-border bg-card p-4 text-center text-xs text-muted-foreground">
            {job.organisation_phone && <p>{job.organisation_phone}</p>}
            {job.organisation_address && <p>{job.organisation_address}</p>}
            {job.business_hours && <p className="mt-1">{formatHoursToday(job.business_hours)}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
function formatHoursToday(hours: Record<string, { open: string; close: string; closed: boolean }>) {
  const key = DAY_KEYS[new Date().getDay()];
  const today = hours[key];
  if (!today) return null;
  return today.closed ? "Closed today" : `Open today ${today.open}–${today.close}`;
}
