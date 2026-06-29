import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/PageLoader";
import { Printer, ArrowLeft, Download } from "lucide-react";
import { formatDate } from "@/lib/format";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

function formatWoNumber(year: number | null | undefined, n: number | null | undefined) {
  if (!n) return "—";
  const y = year ?? new Date().getFullYear();
  return `WO-${y}-${String(n).padStart(4, "0")}`;
}

export default function WorkOrderPrint() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

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
      const woNum = formatWoNumber(data?.wo?.wo_year, data?.wo?.wo_number);
      pdf.save(`${woNum}.pdf`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };


  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data: wo } = await supabase.from("work_orders").select("*").eq("id", id).maybeSingle();
      if (!wo) { setLoading(false); return; }
      const [{ data: machine }, { data: org }, { data: assignee }, { data: vendor }, { data: createdBy }] = await Promise.all([
        supabase.from("machines").select("id,name,make,model,year,serial_number,registration_number,current_hours,category").eq("id", wo.machine_id).maybeSingle(),
        supabase.from("organisations").select("id,name").eq("id", wo.organisation_id).maybeSingle(),
        wo.assignee_id ? supabase.from("profiles").select("id,full_name").eq("id", wo.assignee_id).maybeSingle() : Promise.resolve({ data: null }),
        wo.vendor_id ? supabase.from("vendors").select("id,name,phone,email,category").eq("id", wo.vendor_id).maybeSingle() : Promise.resolve({ data: null }),
        wo.created_by ? supabase.from("profiles").select("id,full_name").eq("id", wo.created_by).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      setData({ wo, machine, org, assignee, vendor, createdBy });
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <PageLoader />;
  if (!data?.wo) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Work order not found.</p>
        <Link to="/work-orders" className="text-primary hover:underline">Back to work orders</Link>
      </div>
    );
  }

  const { wo, machine, org, assignee, vendor, createdBy } = data;
  const priorityLabel = wo.priority?.toUpperCase();

  return (
    <div className="min-h-screen bg-muted/40 print:bg-white">
      {/* Toolbar — hidden on print */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 py-3 print:hidden">
        <Link to={`/work-orders/${id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
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

      {/* A4 sheet */}
      <div ref={sheetRef} className="mx-auto my-6 w-[210mm] min-h-[297mm] bg-white p-[18mm] text-[11pt] text-slate-900 shadow-lg print:my-0 print:w-auto print:min-h-0 print:p-[14mm] print:shadow-none">

        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-teal-600 pb-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Work Order</div>
            <div className="mt-1 text-3xl font-bold tracking-tight">{formatWoNumber(wo.wo_year, wo.wo_number)}</div>
            <div className="mt-1 text-xs text-slate-500">Issued {formatDate(wo.created_at)}</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">{org?.name ?? "—"}</div>
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-700">
              Priority: <span className={
                wo.priority === "urgent" ? "text-red-600" :
                wo.priority === "high" ? "text-amber-600" :
                "text-slate-700"
              }>{priorityLabel}</span>
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">Status: {wo.status?.replace("_", " ")}</div>
          </div>
        </div>

        {/* Parties grid */}
        <div className="mt-5 grid grid-cols-2 gap-4">
          <Box title="Machine">
            <div className="font-semibold">{machine?.name ?? "—"}</div>
            <div className="text-xs text-slate-600">{[machine?.make, machine?.model, machine?.year].filter(Boolean).join(" · ")}</div>
            {machine?.serial_number && <Row label="Serial" value={machine.serial_number} />}
            {machine?.registration_number && <Row label="Reg" value={machine.registration_number} />}
            {machine?.current_hours != null && <Row label="Current hrs/km" value={String(machine.current_hours)} />}
          </Box>
          <Box title={wo.is_outsourced ? "Assigned vendor" : "Assigned to"}>
            {wo.is_outsourced ? (
              <>
                <div className="font-semibold">{vendor?.name ?? "—"}</div>
                {vendor?.category && <div className="text-xs text-slate-600">{vendor.category}</div>}
                {vendor?.phone && <Row label="Phone" value={vendor.phone} />}
                {vendor?.email && <Row label="Email" value={vendor.email} />}
              </>
            ) : (
              <>
                <div className="font-semibold">{assignee?.full_name ?? "Unassigned"}</div>
                <div className="text-xs text-slate-600">Internal technician</div>
              </>
            )}
          </Box>
        </div>

        {/* Dates */}
        <div className="mt-4 grid grid-cols-4 gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
          <Cell label="Issued" value={formatDate(wo.created_at)} />
          <Cell label="Due" value={formatDate(wo.due_date)} />
          {wo.is_outsourced ? (
            <>
              <Cell label="Sent" value={formatDate(wo.sent_date)} />
              <Cell label="Promised" value={formatDate(wo.promised_date)} />
            </>
          ) : (
            <>
              <Cell label="Started" value="—" />
              <Cell label="Completed" value={formatDate(wo.completed_at)} />
            </>
          )}
        </div>

        {/* Job */}
        <section className="mt-5">
          <SectionHeader>Job description</SectionHeader>
          <div className="mt-1 text-base font-semibold">{wo.title}</div>
          {wo.description && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{wo.description}</p>
          )}
        </section>

        {/* Work performed (signature areas) */}
        <section className="mt-5">
          <SectionHeader>Work performed</SectionHeader>
          <div className="mt-2 min-h-[28mm] rounded-md border border-dashed border-slate-300 p-3 text-xs text-slate-400">
            Record diagnosis, work done, parts replaced, and measurements here.
          </div>
        </section>

        {/* Parts used table */}
        <section className="mt-5">
          <SectionHeader>Parts &amp; materials</SectionHeader>
          <table className="mt-2 w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="border border-slate-300 px-2 py-1.5 font-medium">Part / material</th>
                <th className="border border-slate-300 px-2 py-1.5 font-medium">Part #</th>
                <th className="border border-slate-300 px-2 py-1.5 font-medium w-16 text-right">Qty</th>
                <th className="border border-slate-300 px-2 py-1.5 font-medium w-24 text-right">Unit cost</th>
                <th className="border border-slate-300 px-2 py-1.5 font-medium w-24 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {[0,1,2,3,4].map((i) => (
                <tr key={i}>
                  <td className="border border-slate-300 px-2 py-2">&nbsp;</td>
                  <td className="border border-slate-300 px-2 py-2"></td>
                  <td className="border border-slate-300 px-2 py-2"></td>
                  <td className="border border-slate-300 px-2 py-2"></td>
                  <td className="border border-slate-300 px-2 py-2"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Vendor cost if outsourced */}
        {wo.is_outsourced && (wo.vendor_cost || wo.warranty_days || wo.warranty_notes) && (
          <section className="mt-5">
            <SectionHeader>Vendor terms</SectionHeader>
            <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
              {wo.vendor_cost != null && <Cell label="Quoted cost" value={`${wo.vendor_cost} ${wo.vendor_currency ?? ""}`} />}
              {wo.warranty_days != null && <Cell label="Warranty" value={`${wo.warranty_days} days`} />}
              {wo.warranty_notes && <div className="col-span-2"><Cell label="Warranty notes" value={wo.warranty_notes} /></div>}
            </div>
          </section>
        )}

        {/* Signatures */}
        <section className="mt-8 grid grid-cols-2 gap-8">
          <SignatureBlock label="Issued by" name={createdBy?.full_name} />
          <SignatureBlock label={wo.is_outsourced ? "Vendor acceptance" : "Technician sign-off"} name={wo.is_outsourced ? vendor?.name : assignee?.full_name} />
        </section>

        <div className="mt-8 border-t border-slate-200 pt-2 text-center text-[9pt] text-slate-400">
          {org?.name} · Work Order {formatWoNumber(wo.wo_year, wo.wo_number)} · Generated {new Date().toLocaleDateString()}
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1.5 space-y-0.5 text-sm">{children}</div>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="text-xs"><span className="text-slate-500">{label}:</span> <span className="text-slate-800">{value}</span></div>;
}
function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9pt] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-slate-800">{value || "—"}</div>
    </div>
  );
}
function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-slate-300 pb-1 text-[10pt] font-semibold uppercase tracking-wider text-teal-700">{children}</div>;
}
function SignatureBlock({ label, name }: { label: string; name?: string | null }) {
  return (
    <div>
      <div className="h-[18mm] border-b border-slate-400"></div>
      <div className="mt-1 text-[9pt] uppercase tracking-wide text-slate-500">{label}</div>
      {name && <div className="text-sm text-slate-700">{name}</div>}
      <div className="text-[9pt] text-slate-400">Name · Signature · Date</div>
    </div>
  );
}
