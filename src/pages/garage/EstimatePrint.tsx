import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/PageLoader";
import { Printer, ArrowLeft, Download } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/format";
import { estimateTotals } from "@/lib/garage-money";
import { formatJobNumber } from "@/lib/garage-constants";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

export default function GarageEstimatePrint() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data: estimate } = await (supabase as any)
        .from("garage_estimates")
        .select("*, garage_estimate_items(*), garage_jobs(*, garage_customers(name, phone, email, address), garage_vehicles(make, model, registration_number, mileage))")
        .eq("id", id)
        .maybeSingle();
      if (!estimate) { setLoading(false); return; }
      const { data: org } = await supabase.from("organisations").select("id,name,phone,address").eq("id", estimate.organisation_id).maybeSingle();
      setData({ estimate, job: estimate.garage_jobs, org });
      setLoading(false);
    })();
  }, [id]);

  const handleDownload = async () => {
    if (!sheetRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(sheetRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`Estimate-${formatJobNumber(data.job)}.pdf`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!data?.estimate) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Estimate not found.</p>
        <Link to="/garage/estimates" className="text-primary hover:underline">Back to estimates</Link>
      </div>
    );
  }

  const { estimate, job, org } = data;
  const totals = estimateTotals(estimate);
  const items = estimate.garage_estimate_items ?? [];

  return (
    <div className="min-h-screen bg-muted/40 print:bg-white">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 py-3 print:hidden">
        <Link to={`/garage/jobs/${job.id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={downloading}>
            <Download className="mr-2 h-4 w-4" /> {downloading ? "Generating…" : "Download PDF"}
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      <div ref={sheetRef} className="mx-auto my-6 w-[210mm] min-h-[297mm] bg-white p-[18mm] text-[11pt] text-slate-900 shadow-lg print:my-0 print:w-auto print:min-h-0 print:p-[14mm] print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-teal-600 pb-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Estimate</div>
            <div className="mt-1 text-3xl font-bold tracking-tight">{formatJobNumber(job)}</div>
            <div className="mt-1 text-xs text-slate-500">
              {estimate.sent_at ? `Issued ${formatDate(estimate.sent_at)}` : `Drafted ${formatDate(estimate.created_at)}`}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">{org?.name ?? "—"}</div>
            {org?.phone && <div className="text-xs text-slate-600">{org.phone}</div>}
            {org?.address && <div className="text-xs text-slate-600">{org.address}</div>}
            <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">Status: {estimate.status.replace(/_/g, " ")}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <Box title="Customer">
            <div className="font-semibold">{job.garage_customers?.name ?? "—"}</div>
            {job.garage_customers?.phone && <div className="text-xs text-slate-600">{job.garage_customers.phone}</div>}
            {job.garage_customers?.email && <div className="text-xs text-slate-600">{job.garage_customers.email}</div>}
          </Box>
          <Box title="Vehicle">
            <div className="font-semibold">{[job.garage_vehicles?.make, job.garage_vehicles?.model].filter(Boolean).join(" ") || "—"}</div>
            <div className="text-xs text-slate-600">
              {job.garage_vehicles?.registration_number && `${job.garage_vehicles.registration_number} · `}
              {job.garage_vehicles?.mileage != null ? `${job.garage_vehicles.mileage} km` : ""}
            </div>
          </Box>
        </div>

        {job.reported_problem && (
          <div className="mt-5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Reported problem</div>
            <p className="mt-1 text-sm text-slate-700">{job.reported_problem}</p>
          </div>
        )}

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-800 text-left text-[10px] uppercase tracking-wide text-slate-600">
              <th className="py-2 font-semibold">Description</th>
              <th className="py-2 text-right font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Unit price</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any) => (
              <tr key={it.id} className="border-b border-slate-200">
                <td className="py-2">{it.description}</td>
                <td className="py-2 text-right">{it.quantity}</td>
                <td className="py-2 text-right">{formatMoney(it.unit_price)}</td>
                <td className="py-2 text-right">{formatMoney(it.line_total ?? it.quantity * it.unit_price)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={4} className="py-3 text-center text-slate-400">No parts/items — labour or other cost only</td></tr>
            )}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-1.5 text-sm">
            {Number(estimate.labour_cost) > 0 && <Row label="Labour" value={formatMoney(estimate.labour_cost)} />}
            {Number(estimate.other_cost) > 0 && <Row label="Other" value={formatMoney(estimate.other_cost)} />}
            {Number(estimate.discount) > 0 && <Row label="Discount" value={`-${formatMoney(estimate.discount)}`} />}
            {Number(estimate.tax_rate_percent) > 0 && <Row label={`Tax (${estimate.tax_rate_percent}%)`} value={formatMoney(totals.taxAmount)} />}
            <div className="flex justify-between border-t-2 border-slate-800 pt-1.5 text-base font-bold"><span>Total</span><span>{formatMoney(totals.total)}</span></div>
          </div>
        </div>

        {estimate.status === "approved" && estimate.approved_at && (
          <div className="mt-6 rounded-md bg-emerald-50 p-3 text-xs text-emerald-800">
            Approved by {estimate.approved_by_name} via {estimate.approval_method?.replace(/_/g, " ")} on {formatDate(estimate.approved_at)} — {formatMoney(estimate.approved_amount)}
          </div>
        )}

        <div className="mt-10 grid grid-cols-2 gap-8 text-xs text-slate-500">
          <div>
            <div className="h-10 border-b border-slate-400" />
            <p className="mt-1">Prepared by</p>
          </div>
          <div>
            <div className="h-10 border-b border-slate-400" />
            <p className="mt-1">Customer approval (signature)</p>
          </div>
        </div>

        <p className="mt-8 text-center text-[10px] text-slate-400">This is an estimate, not an invoice — prices may change if additional work is required.</p>
      </div>
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
