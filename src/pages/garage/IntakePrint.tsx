import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/PageLoader";
import { Printer, ArrowLeft, Download, Wrench, ShieldAlert } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/format";
import { formatJobNumber } from "@/lib/garage-constants";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

const FUEL_LABELS = ["Empty (0%)", "¼ Tank (25%)", "½ Tank (50%)", "¾ Tank (75%)", "Full Tank (100%)"];

export default function GarageIntakePrint() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data: job, error } = await (supabase as any)
        .from("garage_jobs")
        .select(`
          *,
          garage_customers(*),
          garage_vehicles(*),
          garage_mechanics(name)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error || !job) {
        setLoading(false);
        return;
      }

      const [{ data: org }, { data: intake }] = await Promise.all([
        supabase.from("organisations").select("*").eq("id", job.organisation_id).maybeSingle(),
        (supabase as any).from("garage_intake_checklists").select("*").eq("job_id", id).maybeSingle(),
      ]);

      setData({ job, customer: job.garage_customers, vehicle: job.garage_vehicles, org, intake });
      setLoading(false);
    })();
  }, [id]);

  const handleDownload = async () => {
    if (!sheetRef.current || !data) return;
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
      pdf.save(`INTAKE-${formatJobNumber(data.job)}.pdf`);
    } catch (e: any) {
      toast.error(e.message ?? "PDF export failed");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!data || !data.job) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Job intake record not found.
      </div>
    );
  }

  const { job, customer, vehicle, org, intake } = data;
  const fuelIdx = intake?.fuel_level ?? 2;

  return (
    <div className="min-h-screen bg-muted/30 p-4 sm:p-6 print:bg-white print:p-0">
      {/* Action Bar (hidden on print) */}
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between print:hidden">
        <Link
          to={`/garage/jobs/${job.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to job
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-3.5 w-3.5" /> Print Receipt
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={downloading}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {downloading ? "Exporting…" : "Save as PDF"}
          </Button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div
        ref={sheetRef}
        className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-8 shadow-sm print:rounded-none print:border-none print:p-6 print:shadow-none text-foreground font-sans text-sm"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground print:border print:border-black">
              <Wrench className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{org?.name ?? "Auto Care Workshop"}</h1>
              <p className="text-xs text-muted-foreground">{org?.address || "Professional Automotive Service & Repair"}</p>
              {org?.phone && <p className="text-xs text-muted-foreground">Phone: {org.phone}</p>}
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary print:border print:border-black print:text-black">
              Vehicle Intake Handover Slip
            </span>
            <div className="mt-1 font-mono text-base font-bold">{formatJobNumber(job)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Intake Date: {formatDate(job.created_at)}
            </div>
          </div>
        </div>

        {/* Customer & Vehicle Info Grid */}
        <div className="grid grid-cols-2 gap-6 py-4 border-b border-border text-xs">
          <div>
            <h3 className="font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Customer Information
            </h3>
            <p className="font-medium text-sm text-foreground">{customer?.name ?? "—"}</p>
            {customer?.phone && <p className="text-muted-foreground">Tel: {customer.phone}</p>}
            {customer?.email && <p className="text-muted-foreground">Email: {customer.email}</p>}
            {customer?.address && <p className="text-muted-foreground">Address: {customer.address}</p>}
          </div>

          <div>
            <h3 className="font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Vehicle Specification
            </h3>
            <p className="font-medium text-sm text-foreground">
              {[vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle"}
              {vehicle?.year ? ` (${vehicle.year})` : ""}
            </p>
            <p className="font-semibold text-foreground">
              Plate: <span className="font-mono">{vehicle?.registration_number ?? "—"}</span>
            </p>
            <p className="text-muted-foreground">
              Odometer: {job.mileage_at_intake != null ? `${formatNumber(job.mileage_at_intake)} km` : "Not recorded"}
            </p>
            {vehicle?.vin && <p className="text-muted-foreground font-mono">VIN: {vehicle.vin}</p>}
            {vehicle?.color && <p className="text-muted-foreground">Color: {vehicle.color}</p>}
          </div>
        </div>

        {/* Service Requested */}
        <div className="py-4 border-b border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Reported Complaints & Service Instructions
          </h3>
          <div className="rounded-lg bg-muted/40 p-3 border border-border text-sm leading-relaxed">
            {job.reported_problem}
          </div>
          {job.expected_completion && (
            <p className="mt-2 text-xs text-muted-foreground">
              <strong>Promised Delivery Date:</strong> {formatDate(job.expected_completion)}
            </p>
          )}
        </div>

        {/* Vehicle Condition & Inventory Check */}
        <div className="py-4 border-b border-border space-y-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Vehicle Check-in Condition Assessment
          </h3>

          {/* Fuel Level */}
          <div>
            <div className="flex justify-between text-xs font-medium mb-1.5">
              <span>Fuel Tank Level:</span>
              <span className="font-bold text-foreground">{FUEL_LABELS[fuelIdx]}</span>
            </div>
            <div className="grid grid-cols-5 gap-1 text-center text-[10px] font-medium">
              {["E (0%)", "¼", "½", "¾", "F (100%)"].map((label, idx) => (
                <div
                  key={label}
                  className={`py-1 rounded border ${
                    fuelIdx === idx
                      ? "bg-foreground text-background font-bold border-foreground print:bg-black print:text-white"
                      : "bg-muted/30 text-muted-foreground border-border"
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Exterior Damage Record */}
          <div>
            <div className="text-xs font-medium mb-1.5">Pre-existing Body Condition & Scratches:</div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
              {[
                { key: "damage_front", label: "Front / Bumper" },
                { key: "damage_rear", label: "Rear / Tailgate" },
                { key: "damage_left", label: "Left / Driver" },
                { key: "damage_right", label: "Right / Passenger" },
                { key: "damage_roof", label: "Roof / Glass" },
              ].map((item) => {
                const hasDamage = intake?.[item.key];
                return (
                  <div
                    key={item.key}
                    className={`rounded p-1.5 text-center border ${
                      hasDamage
                        ? "bg-amber-100 text-amber-900 border-amber-300 font-medium print:border-black"
                        : "bg-muted/30 text-muted-foreground border-border"
                    }`}
                  >
                    {item.label}: <strong>{hasDamage ? "DAMAGED" : "Clean"}</strong>
                  </div>
                );
              })}
            </div>
            {intake?.damage_notes && (
              <p className="mt-2 text-xs italic text-muted-foreground">
                Damage Notes: {intake.damage_notes}
              </p>
            )}
          </div>

          {/* Equipment / Valuables checked */}
          <div>
            <div className="text-xs font-medium mb-1.5">Equipment & Personal Items Present:</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { label: "Radio / Audio", present: intake?.radio_present ?? true },
                { label: "Spare Tyre", present: intake?.spare_tyre_present ?? true },
                { label: "Jack & Tools", present: intake?.jack_present ?? true },
                { label: "Documents", present: intake?.vehicle_documents_present ?? true },
              ].map((item) => (
                <div key={item.label} className="rounded border border-border p-1.5 flex justify-between items-center">
                  <span>{item.label}:</span>
                  <span className={`font-bold ${item.present ? "text-emerald-700" : "text-destructive"}`}>
                    {item.present ? "YES (✓)" : "NO (✗)"}
                  </span>
                </div>
              ))}
            </div>
            {intake?.other_items && (
              <p className="mt-2 text-xs text-muted-foreground">
                <strong>Other Items:</strong> {intake.other_items}
              </p>
            )}
          </div>
        </div>

        {/* Handover Disclaimer */}
        <div className="py-4 border-b border-border text-[11px] text-muted-foreground space-y-1 leading-relaxed">
          <div className="flex items-center gap-1 font-semibold text-foreground">
            <ShieldAlert className="h-3.5 w-3.5" /> Customer Acknowledgment & Authorization
          </div>
          <p>
            1. I hereby authorize {org?.name ?? "the workshop"} to perform the diagnostic evaluation and agreed repair works on the vehicle listed above.
          </p>
          <p>
            2. I acknowledge that the fuel level, pre-existing exterior damage, and items listed above accurately reflect the condition of the vehicle at the time of check-in.
          </p>
          <p>
            3. The workshop is not responsible for loss of undeclared personal belongings left inside the vehicle. Vehicles left over 14 days following completion notice may be subject to storage fees.
          </p>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 pt-8 text-xs">
          <div>
            <div className="border-b border-foreground/40 pb-1 mb-1">
              <span className="font-semibold text-foreground">Customer Signature:</span>
            </div>
            <div className="h-10"></div>
            <p className="text-muted-foreground">Date: ________________________</p>
          </div>

          <div>
            <div className="border-b border-foreground/40 pb-1 mb-1">
              <span className="font-semibold text-foreground">Service Advisor / Receiver Signature:</span>
            </div>
            <div className="h-10"></div>
            <p className="text-muted-foreground">
              Received By: {job.garage_mechanics?.name || "Service Team"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
