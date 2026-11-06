import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/PageLoader";
import {
  Printer,
  ArrowLeft,
  Download,
  Building2,
  MapPin,
  Truck,
  FileText,
  Calendar,
  Globe2,
  Landmark,
  Smartphone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney } from "@/lib/format";
import { DEFAULT_USD_TO_TZS_RATE } from "@/services/crossBorderCorridors";
import { DEFAULT_PAYMENT_ACCOUNTS, type PaymentAccountSettings } from "@/components/TripReceiptDialog";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

export default function TripReceiptPrint() {
  const { id } = useParams<{ id: string }>();
  const [trip, setTrip] = useState<any>(null);
  const [machine, setMachine] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const [paymentAccounts] = useState<PaymentAccountSettings>(() => {
    try {
      const saved = localStorage.getItem("trip_receipt_payment_settings");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_PAYMENT_ACCOUNTS;
  });

  useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);
      const { data: tripData } = await supabase
        .from("trips")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!tripData) {
        setLoading(false);
        return;
      }

      let parsedMeta: any = {};
      let cleanCargo: string | null = null;
      if (tripData.cargo_description && typeof tripData.cargo_description === "string" && tripData.cargo_description.startsWith("{")) {
        try {
          parsedMeta = JSON.parse(tripData.cargo_description);
          if (parsedMeta.cargo && typeof parsedMeta.cargo === "string" && !parsedMeta.cargo.startsWith("{")) {
            cleanCargo = parsedMeta.cargo;
          }
        } catch {}
      } else {
        cleanCargo = tripData.cargo_description;
      }
      if (typeof cleanCargo === "string" && cleanCargo.startsWith("{")) {
        cleanCargo = null;
      }

      const mergedTrip = {
        ...tripData,
        client_name: parsedMeta.client || tripData.client_name,
        client_order_no: parsedMeta.order_no || tripData.client_order_no,
        cargo_description: cleanCargo || tripData.purpose || "Commercial Freight / General Cargo",
        corridor_id: parsedMeta.corridor_id,
        corridor_name: parsedMeta.corridor_name,
        border_post: parsedMeta.border_post,
        currency: parsedMeta.currency || parsedMeta.billing_currency || "USD",
        exchange_rate: parsedMeta.exchange_rate || DEFAULT_USD_TO_TZS_RATE,
        client_billing_amount: parsedMeta.client_billing_amount ?? null,
        payment_terms: parsedMeta.payment_terms || "Upon Delivery & Offloading",
        tax_percent: parsedMeta.tax_percent ?? 0,
        custom_logo_url: parsedMeta.custom_logo_url || null,
        expenses: Array.isArray(parsedMeta.expenses) ? parsedMeta.expenses : [],
      };

      setTrip(mergedTrip);

      const [machineRes, driverRes, orgRes] = await Promise.all([
        supabase.from("machines").select("*").eq("id", tripData.machine_id).maybeSingle(),
        tripData.driver_id
          ? supabase.from("drivers").select("*").eq("id", tripData.driver_id).maybeSingle()
          : Promise.resolve({ data: null }),
        tripData.organisation_id
          ? supabase.from("organisations").select("*").eq("id", tripData.organisation_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      setMachine(machineRes.data);
      setDriver(driverRes.data);
      setOrg(orgRes.data);
      setLoading(false);
    })();
  }, [id]);

  const exchangeRate = Number(trip?.exchange_rate) || DEFAULT_USD_TO_TZS_RATE;
  const isUsd = (trip?.currency || "USD").toUpperCase() === "USD";
  const baseFreight = Number(trip?.client_billing_amount) || 0;
  const taxPercent = Number(trip?.tax_percent) || 0;

  const pricingCalculations = useMemo(() => {
    let subtotalUsd = 0;
    let subtotalTzs = 0;

    if (isUsd) {
      subtotalUsd = baseFreight;
      subtotalTzs = Math.round(subtotalUsd * exchangeRate);
    } else {
      subtotalTzs = baseFreight;
      subtotalUsd = Number((subtotalTzs / exchangeRate).toFixed(2));
    }

    const taxAmountUsd = (subtotalUsd * taxPercent) / 100;
    const taxAmountTzs = Math.round((subtotalTzs * taxPercent) / 100);

    const totalPayableUsd = subtotalUsd + taxAmountUsd;
    const totalPayableTzs = subtotalTzs + taxAmountTzs;

    return {
      baseFreight,
      taxPercent,
      taxAmountUsd,
      taxAmountTzs,
      totalPayableUsd,
      totalPayableTzs,
    };
  }, [baseFreight, isUsd, exchangeRate, taxPercent]);

  const handleDownloadPdf = async () => {
    if (!sheetRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(sheetRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
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
      const refCode = trip.client_order_no || trip.id?.slice(0, 8) || "TRIP";
      pdf.save(`WAYBILL-RECEIPT-${refCode}.pdf`);
      toast.success("Receipt PDF downloaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <PageLoader />;

  if (!trip) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-muted-foreground">Trip record not found.</p>
        <Link to="/fleet/trips" className="text-primary hover:underline">
          Back to Trips
        </Link>
      </div>
    );
  }

  const receiptRef = trip.client_order_no ? `RCP-${trip.client_order_no}` : `RCP-${trip.id.slice(0, 8).toUpperCase()}`;
  const companyName = org?.name || "LOGISTIXWARE LOGISTICS LIMITED";
  const companyPhone = org?.phone || "+255 754 123 456 / +255 22 286 1900";
  const companyAddress = org?.address || "Kurasini Depot, Nelson Mandela Road, Dar es Salaam, Tanzania";
  const companyLogo = trip?.custom_logo_url || org?.logo_url;

  return (
    <div className="min-h-screen bg-muted/40 print:bg-white text-slate-900">
      {/* Top Navbar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-6 py-3 print:hidden">
        <Link
          to="/fleet/trips"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Fleet Trips
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDownloadPdf} disabled={downloading}>
            <Download className="mr-2 h-4 w-4" /> {downloading ? "Generating…" : "Download PDF"}
          </Button>
          <Button onClick={() => window.print()} className="shadow-xs">
            <Printer className="mr-2 h-4 w-4" /> Print Receipt
          </Button>
        </div>
      </div>

      {/* A4 Printable Sheet */}
      <div className="py-8 px-4 flex justify-center print:p-0 print:py-0">
        <div
          ref={sheetRef}
          className="w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 p-8 sm:p-12 rounded-xl shadow-lg border border-slate-200 flex flex-col justify-between print:border-none print:shadow-none print:p-8 print:w-full print:rounded-none"
        >
          <div className="space-y-6">
            {/* Header: Company Logo & Receipt Ref */}
            <div className="flex items-start justify-between border-b-2 border-primary pb-5 gap-4">
              <div className="space-y-1 max-w-[60%]">
                <div className="text-[10px] font-black tracking-[0.25em] uppercase text-primary">
                  Official Freight Receipt & Delivery Waybill
                </div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 font-mono">
                  {receiptRef}
                </h1>
                <div className="text-xs text-slate-500 flex items-center gap-2 pt-0.5">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Issued: {formatDate(trip.created_at || new Date().toISOString())}
                  </span>
                  <span>·</span>
                  <span className="capitalize font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Status: {trip.status === "in_progress" ? "In Transit" : trip.status}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                {companyLogo ? (
                  <div className="mb-1.5">
                    <img
                      src={companyLogo}
                      alt="Company Logo"
                      className="h-14 w-auto max-w-[190px] ml-auto object-contain"
                    />
                    <div className="text-xs font-bold text-slate-800 mt-1">{companyName}</div>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-1.5 text-primary font-black text-xl mb-1">
                    <Truck className="h-6 w-6" />
                    <span>{companyName}</span>
                  </div>
                )}
                <div className="text-[11px] text-slate-600 max-w-[260px] ml-auto line-clamp-2">
                  {companyAddress}
                </div>
                <div className="text-[11px] text-slate-600">{companyPhone}</div>
                <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                  TIN: 142-990-811 / VRN: 40-029188
                </div>
              </div>
            </div>

            {/* Client & Logistics Details */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="rounded-lg border border-slate-200 p-3.5 space-y-1.5 bg-slate-50/50">
                <div className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> Client / Consignee Information
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {trip.client_name || "Commercial Cargo Consignee"}
                </div>
                <div className="text-slate-600">
                  Order / DO Reference: <strong className="font-mono text-slate-800">{trip.client_order_no || "N/A"}</strong>
                </div>
                <div className="text-slate-600 pt-0.5">
                  Consignment Specification: <span className="font-medium text-slate-800">{trip.cargo_description || "Commercial Cargo / General Freight"}</span>
                </div>
                <div className="text-slate-600 text-[11px]">
                  Payment Terms: <span className="font-semibold text-primary">{trip.payment_terms}</span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3.5 space-y-1.5 bg-slate-50/50">
                <div className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5" /> Fleet & Transit Route Logistics
                </div>
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  <span>{trip.origin || "Origin Depot"}</span>
                  <span>→</span>
                  <span className="text-primary">{trip.destination || "Destination"}</span>
                </div>
                {trip.corridor_name && (
                  <div className="text-[11px] text-slate-600 flex items-center gap-1">
                    <Globe2 className="h-3 w-3 text-primary" /> Corridor: <span className="font-semibold">{trip.corridor_name}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-0.5">
                  <div>
                    Vehicle Head: <strong className="text-slate-800">{machine?.plate_number ? `${machine.name} (${machine.plate_number})` : machine?.name || "Vehicle"}</strong>
                  </div>
                  <div>
                    Trailer: <strong className="text-primary">{machine?.trailer_plate || "N/A"}</strong>
                  </div>
                  <div>
                    Assigned Driver: <strong className="text-slate-800">{driver?.full_name || "Fleet Driver"}</strong>
                  </div>
                  <div>
                    Driver Phone: <span className="font-mono">{driver?.phone || "N/A"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ITEMISED COMMERCIAL FREIGHT SERVICE TABLE */}
            <div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-800 text-left text-[10px] uppercase tracking-wide text-slate-600">
                    <th className="py-2.5 px-3 font-bold w-10">#</th>
                    <th className="py-2.5 px-3 font-bold">Description of Commercial Freight Service</th>
                    <th className="py-2.5 px-3 text-center font-bold">Assigned Truck & Driver</th>
                    <th className="py-2.5 px-3 text-right font-bold">Agreed Freight Price</th>
                    <th className="py-2.5 px-3 text-right font-bold">Total to Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {/* Main Freight Transport Charge */}
                  <tr className="font-semibold text-slate-900 bg-slate-50/40">
                    <td className="py-3 px-3 font-mono text-slate-500">01</td>
                    <td className="py-3 px-3 space-y-1">
                      <div className="font-bold text-sm text-slate-900">
                        Commercial Freight Haulage & Cross-Border Delivery
                      </div>
                      <div className="text-xs text-slate-600">
                        Transit Route: <strong className="text-slate-800">{trip.origin || "Origin Depot"}</strong> → <strong className="text-primary">{trip.destination || "Destination"}</strong>
                        {trip.corridor_name ? ` via ${trip.corridor_name}` : ""}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Consignment: <span className="font-medium text-slate-800">{trip.cargo_description || "Commercial Cargo / General Freight"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="font-bold text-xs text-slate-800">
                        {machine?.plate_number ? `${machine.name} (${machine.plate_number})` : machine?.name || "Vehicle"}
                      </div>
                      <div className="text-[10px] text-primary font-medium mt-0.5">
                        {machine?.trailer_plate ? `Trailer: ${machine.trailer_plate}` : "Standard Trailer Unit"}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Driver: <strong className="text-slate-700">{driver?.full_name || "Fleet Driver"}</strong>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                      {isUsd
                        ? `$${pricingCalculations.baseFreight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : `${Math.round(pricingCalculations.baseFreight).toLocaleString()} TZS`}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                      {isUsd
                        ? `$${pricingCalculations.baseFreight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                        : `${Math.round(pricingCalculations.baseFreight).toLocaleString()} TZS`}
                      <div className="text-[10px] text-slate-500 font-normal">
                        {isUsd
                          ? `≈ ${Math.round(pricingCalculations.baseFreight * exchangeRate).toLocaleString()} TZS`
                          : `≈ $${(pricingCalculations.baseFreight / exchangeRate).toFixed(2)} USD`}
                      </div>
                    </td>
                  </tr>

                  {/* VAT row if applicable */}
                  {pricingCalculations.taxPercent > 0 && (
                    <tr className="text-slate-700">
                      <td className="py-2.5 px-3 font-mono text-slate-400">02</td>
                      <td className="py-2.5 px-3" colSpan={2}>
                        <span className="font-semibold text-slate-800">Value Added Tax (VAT {pricingCalculations.taxPercent}%)</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        {pricingCalculations.taxPercent}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {isUsd
                          ? `$${pricingCalculations.taxAmountUsd.toFixed(2)} USD`
                          : `${Math.round(pricingCalculations.taxAmountTzs).toLocaleString()} TZS`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* TOTAL PRICE TO PAY (HIGHLIGHTED CARD) */}
            <div className="flex justify-end pt-2">
              <div className="w-88 rounded-xl border-2 border-primary bg-primary/5 p-4 space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Agreed Freight Price:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {isUsd
                      ? `$${pricingCalculations.baseFreight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                      : `${Math.round(pricingCalculations.baseFreight).toLocaleString()} TZS`}
                  </span>
                </div>

                {pricingCalculations.taxPercent > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>VAT / Tax ({pricingCalculations.taxPercent}%):</span>
                    <span className="font-mono font-semibold">
                      {isUsd
                        ? `$${pricingCalculations.taxAmountUsd.toFixed(2)} USD`
                        : `${Math.round(pricingCalculations.taxAmountTzs).toLocaleString()} TZS`}
                    </span>
                  </div>
                )}

                <div className="border-t-2 border-primary/30 pt-2 flex items-baseline justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Total Price to Pay:
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Exchange Rate: 1 USD = {exchangeRate} TZS
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-black text-primary font-mono tracking-tight">
                      {isUsd
                        ? `$${pricingCalculations.totalPayableUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                        : `${Math.round(pricingCalculations.totalPayableTzs).toLocaleString()} TZS`}
                    </div>
                    <div className="text-xs font-bold text-slate-600 font-mono">
                      {isUsd
                        ? `≈ ${Math.round(pricingCalculations.totalPayableTzs).toLocaleString()} TZS`
                        : `≈ $${pricingCalculations.totalPayableUsd.toFixed(2)} USD`}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Account to Pay Card */}
            <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 space-y-2.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-primary flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span className="flex items-center gap-1.5">
                  <Landmark className="h-4 w-4 text-primary" /> Official Payment Accounts / Bank Details
                </span>
                <span className="text-[10px] font-medium text-slate-500">
                  Direct Bank Transfer / Official Mobile Till
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-slate-600" />
                    {paymentAccounts.bankName}
                  </div>
                  <div className="text-slate-600">
                    Account Name: <strong className="text-slate-800">{paymentAccounts.accountName}</strong>
                  </div>
                  <div className="text-slate-600">
                    Account No (USD): <strong className="font-mono text-primary text-sm">{paymentAccounts.accountNumberUsd}</strong>
                  </div>
                  {paymentAccounts.accountNumberTzs && (
                    <div className="text-slate-600">
                      Account No (TZS): <strong className="font-mono text-slate-800">{paymentAccounts.accountNumberTzs}</strong>
                    </div>
                  )}
                  <div className="text-[11px] text-slate-500">
                    SWIFT / Branch: <span className="font-mono">{paymentAccounts.swiftCode}</span> ({paymentAccounts.branch})
                  </div>
                </div>

                <div className="space-y-1 border-l-0 sm:border-l border-slate-200 sm:pl-4">
                  <div className="font-bold text-slate-900 flex items-center gap-1">
                    <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                    {paymentAccounts.mobileMoneyName}
                  </div>
                  <div className="text-slate-600 text-[11px]">
                    Merchant Payment Reference:
                  </div>
                  <div className="text-sm font-black font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 w-fit">
                    {paymentAccounts.mobileMoneyNumber}
                  </div>
                  <p className="text-[10px] text-slate-500 pt-1 leading-tight">
                    {paymentAccounts.paymentInstructions}
                  </p>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-12 pt-6 text-xs text-slate-600">
              <div>
                <div className="h-12 border-b-2 border-dashed border-slate-400" />
                <div className="mt-1.5 font-bold text-slate-800">Authorized Logistics Dispatcher</div>
                <div className="text-[10px] text-slate-500">{companyName} · Operations Department</div>
              </div>

              <div>
                <div className="h-12 border-b-2 border-dashed border-slate-400" />
                <div className="mt-1.5 font-bold text-slate-800">Client / Consignee Receiver</div>
                <div className="text-[10px] text-slate-500">Official Receiving Signature & Stamp</div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 text-center text-[10px] text-slate-400">
            This receipt & freight waybill certifies the dispatch of cargo under carrier liability terms. Thank you for your partnership.
          </div>
        </div>
      </div>
    </div>
  );
}
