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
import { parseCargoMeta, extractCleanCargo } from "@/lib/fleet-metadata";
import { useAuth } from "@/contexts/AuthContext";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

function BarcodeGraphic({ code }: { code: string }) {
  const bars = [2, 1, 3, 1, 1, 4, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 4, 1, 3, 2, 1, 3, 1, 2, 4, 1, 2, 3, 2, 1, 3];
  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-[1.5px] h-6 overflow-hidden py-0.5">
        {bars.map((w, i) => (
          <div
            key={i}
            className="bg-slate-900 h-full"
            style={{ width: `${w * 1.1}px` }}
          />
        ))}
      </div>
      <div className="text-[8px] font-mono tracking-[0.2em] text-slate-500 font-bold uppercase mt-0.5">
        *{code}*
      </div>
    </div>
  );
}

export default function TripReceiptPrint() {
  const { id } = useParams<{ id: string }>();
  const { organisation: authOrg } = useAuth();
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
      const fleetBank = localStorage.getItem("fleet_corridor_bank_settings");
      if (fleetBank) {
        const b = JSON.parse(fleetBank);
        return {
          ...DEFAULT_PAYMENT_ACCOUNTS,
          bankName: b.bankName || DEFAULT_PAYMENT_ACCOUNTS.bankName,
          accountName: b.accountName || DEFAULT_PAYMENT_ACCOUNTS.accountName,
          accountNumberTzs: b.accountNumberTzs || DEFAULT_PAYMENT_ACCOUNTS.accountNumberTzs,
          accountNumberUsd: b.accountNumberUsd || DEFAULT_PAYMENT_ACCOUNTS.accountNumberUsd,
          swiftCode: b.swiftCode || DEFAULT_PAYMENT_ACCOUNTS.swiftCode,
          branch: b.branch || DEFAULT_PAYMENT_ACCOUNTS.branch,
          mobileMoneyNumber: b.lipaNumber || DEFAULT_PAYMENT_ACCOUNTS.mobileMoneyNumber,
        };
      }
    } catch (_err) {
      // Use defaults if storage read fails
    }
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

      const parsedMeta = parseCargoMeta(tripData.cargo_description) || {};
      const cleanCargo = extractCleanCargo(tripData.cargo_description, tripData.purpose);

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
      setOrg(orgRes.data || authOrg);
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
      const element = sheetRef.current;
      const canvas = await html2canvas(element, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        windowWidth: 840,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
      const margin = 8; // 8mm margin
      const maxW = pageWidth - margin * 2; // 194mm
      const maxH = pageHeight - margin * 2; // 281mm

      let imgW = maxW;
      let imgH = (canvas.height * imgW) / canvas.width;

      // Auto-fit to single page if within 18% threshold so it never splits into a tiny second page
      if (imgH > maxH && imgH <= maxH * 1.18) {
        const factor = maxH / imgH;
        imgH = maxH;
        imgW = imgW * factor;
      }

      const posX = margin + (maxW - imgW) / 2;
      const posY = margin;

      if (imgH <= maxH) {
        pdf.addImage(imgData, "JPEG", posX, posY, imgW, imgH, undefined, "FAST");
      } else {
        let heightLeft = imgH;
        let position = margin;
        pdf.addImage(imgData, "JPEG", posX, position, imgW, imgH, undefined, "FAST");
        heightLeft -= maxH;
        while (heightLeft > 5) {
          position = heightLeft - imgH + margin;
          pdf.addPage();
          pdf.addImage(imgData, "JPEG", posX, position, imgW, imgH, undefined, "FAST");
          heightLeft -= maxH;
        }
      }

      const refCode = trip.client_order_no || trip.id?.slice(0, 8) || "TRIP";
      pdf.save(`WAYBILL-${refCode}.pdf`);
      toast.success("Waybill PDF downloaded successfully");
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
  const companyName = org?.name || authOrg?.name || "LOGISTIXWARE LOGISTICS LIMITED";
  const companyPhone = org?.phone || authOrg?.phone || "+255 754 123 456 / +255 22 286 1900";
  const companyAddress = org?.address || authOrg?.address || "Kurasini Depot, Nelson Mandela Road, Dar es Salaam, Tanzania";
  const companyLogo = trip?.custom_logo_url || org?.logo_url || authOrg?.logo_url;

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
      <div className="py-6 px-4 flex justify-center print:p-0 print:py-0">
        <div
          ref={sheetRef}
          className="w-full max-w-[820px] bg-white text-slate-900 p-6 sm:p-8 rounded-xl shadow-xl border border-slate-200 flex flex-col justify-between print:border-none print:shadow-none print:p-4 print:w-full print:rounded-none"
          style={{ boxSizing: "border-box" }}
        >
          <div className="space-y-4">
            {/* Top Accent Gradient Line */}
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-700 via-indigo-600 to-emerald-500 rounded-full" />

            {/* HEADER SECTION: LOGO + COMPANY DETAILS + WAYBILL REF & BARCODE */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3.5 gap-4">
              <div className="space-y-1 max-w-[55%]">
                <div className="flex items-center gap-2">
                  {companyLogo ? (
                    <img
                      src={companyLogo}
                      alt={companyName}
                      className="h-12 w-auto max-w-[190px] object-contain"
                    />
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs">
                        <Truck className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <span className="text-lg font-black tracking-tight text-slate-900 block leading-tight">
                          {companyName}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-primary block">
                          Cross-Border Heavy Haulage & Freight Logistics
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                {companyLogo && (
                  <div className="text-xs font-bold text-slate-900">{companyName}</div>
                )}
                <div className="text-[11px] text-slate-600 leading-tight pt-0.5">
                  <div className="flex items-center gap-1 font-medium">
                    <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="line-clamp-1">{companyAddress}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500">
                    <span>Tel: <strong className="text-slate-700">{companyPhone}</strong></span>
                    <span>·</span>
                    <span className="font-mono">TIN: 142-990-811 / VRN: 40-029188</span>
                  </div>
                </div>
              </div>

              <div className="text-right flex flex-col items-end space-y-1">
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[9px] font-bold uppercase tracking-wider">
                  <span>Commercial Tax Invoice & Freight Waybill</span>
                  <span className="text-emerald-400">· ORIGINAL</span>
                </div>

                <div className="font-mono text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {receiptRef}
                </div>

                <BarcodeGraphic code={receiptRef} />

                <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-0.5">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    Issued: <strong className="text-slate-700">{formatDate(trip.created_at || new Date().toISOString())}</strong>
                  </span>
                  <span>·</span>
                  <span className="capitalize font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {trip.status === "in_progress" ? "In Transit" : trip.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Bill To & Operational Reference (Aligned with Finance Invoice) */}
            <div className="grid grid-cols-2 gap-4 text-xs border border-gray-200 rounded-lg p-3 bg-gray-50/70">
              <div className="space-y-1">
                <span className="font-bold uppercase tracking-wider text-gray-500 text-[10px] block">
                  Billed To / Consignee:
                </span>
                <p className="text-sm font-bold text-gray-900">{trip.client_name || "Commercial Cargo Client"}</p>
                {trip.client_order_no && (
                  <p className="text-gray-600">
                    Order / Delivery Note: <strong className="font-mono text-gray-900">{trip.client_order_no}</strong>
                  </p>
                )}
                <p className="text-gray-600 truncate">
                  Consignment Cargo: <span className="font-medium text-gray-900">{trip.cargo_description || "Commercial Cargo / General Freight"}</span>
                </p>
                <p className="text-primary font-semibold text-[11px]">
                  Agreed Payment Terms: {trip.payment_terms}
                </p>
              </div>

              <div className="text-right space-y-1">
                <span className="font-bold uppercase tracking-wider text-gray-500 text-[10px] block">
                  Operational & Transit Reference:
                </span>
                <p className="text-sm font-semibold text-gray-900">
                  Vehicle: {machine?.plate_number ? `${machine.name} (${machine.plate_number})` : machine?.name || "Heavy Freight Truck"}
                  {machine?.trailer_plate && <span className="text-primary ml-1 font-mono">[{machine.trailer_plate}]</span>}
                </p>
                <p className="text-xs text-gray-700">
                  Route: <strong className="text-gray-900">{trip.origin || "Origin"}</strong> ➔ <strong className="text-primary">{trip.destination || "Destination"}</strong>
                </p>
                {trip.corridor_name && (
                  <p className="text-[11px] text-gray-600">
                    Corridor: {trip.corridor_name} {trip.border_post ? `(${trip.border_post})` : ""}
                  </p>
                )}
                <p className="text-[11px] text-gray-600">
                  Driver: <span className="font-medium text-gray-900">{driver?.full_name || "Assigned Driver"}</span> {driver?.phone ? `· ${driver.phone}` : ""}
                </p>
              </div>
            </div>

            {/* Items Table (Exact match with FinanceInvoices) */}
            <table className="w-full text-left text-xs border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-100 uppercase tracking-wider text-gray-600">
                <tr>
                  <th className="p-2.5">Description</th>
                  <th className="p-2.5 text-center">Qty / Route</th>
                  <th className="p-2.5 text-right">Agreed Rate</th>
                  <th className="p-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="p-2.5 space-y-0.5">
                    <p className="font-bold text-gray-900 text-xs">
                      Commercial Freight Haulage & Consignment Delivery
                    </p>
                    <p className="text-[11px] text-gray-600">
                      Route Transit: {trip.origin || "Origin Depot"} ➔ {trip.destination || "Destination"}
                      {trip.corridor_name ? ` via ${trip.corridor_name}` : ""}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      Cargo: {trip.cargo_description || "Commercial Cargo"} · Asset: {machine?.plate_number || "Truck"} · Driver: {driver?.full_name || "Fleet Driver"}
                    </p>
                  </td>
                  <td className="p-2.5 text-center font-mono align-middle">1 Run</td>
                  <td className="p-2.5 text-right font-mono align-middle">
                    {isUsd
                      ? `$${pricingCalculations.baseFreight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : `${Math.round(pricingCalculations.baseFreight).toLocaleString()} TZS`}
                  </td>
                  <td className="p-2.5 text-right font-semibold font-mono align-middle">
                    {isUsd
                      ? `$${pricingCalculations.baseFreight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : `${Math.round(pricingCalculations.baseFreight).toLocaleString()} TZS`}
                  </td>
                </tr>

                {pricingCalculations.taxPercent > 0 && (
                  <tr className="bg-gray-50/50">
                    <td className="p-2.5 font-medium text-gray-700">
                      Value Added Tax (VAT {pricingCalculations.taxPercent}%)
                    </td>
                    <td className="p-2.5 text-center font-mono">1</td>
                    <td className="p-2.5 text-right font-mono">{pricingCalculations.taxPercent}%</td>
                    <td className="p-2.5 text-right font-semibold font-mono">
                      {isUsd
                        ? `$${pricingCalculations.taxAmountUsd.toFixed(2)}`
                        : `${Math.round(pricingCalculations.taxAmountTzs).toLocaleString()} TZS`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Totals Section */}
            <div className="flex justify-end text-xs">
              <div className="w-72 space-y-1.5 text-right">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal Freight:</span>
                  <span className="font-semibold font-mono">
                    {isUsd
                      ? `$${pricingCalculations.baseFreight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : `${Math.round(pricingCalculations.baseFreight).toLocaleString()} TZS`}
                  </span>
                </div>

                {pricingCalculations.taxPercent > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">VAT ({pricingCalculations.taxPercent}%):</span>
                    <span className="font-semibold font-mono">
                      {isUsd
                        ? `$${pricingCalculations.taxAmountUsd.toFixed(2)}`
                        : `${Math.round(pricingCalculations.taxAmountTzs).toLocaleString()} TZS`}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-sm font-bold border-t pt-2 text-gray-900">
                  <span>Total Amount:</span>
                  <span className="font-mono text-primary">
                    {isUsd
                      ? `$${pricingCalculations.totalPayableUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                      : `${Math.round(pricingCalculations.totalPayableTzs).toLocaleString()} TZS`}
                  </span>
                </div>

                <div className="flex justify-between text-[11px] text-gray-500 font-mono">
                  <span>Equivalent (FX {exchangeRate}):</span>
                  <span>
                    {isUsd
                      ? `≈ ${Math.round(pricingCalculations.totalPayableTzs).toLocaleString()} TZS`
                      : `≈ $${pricingCalculations.totalPayableUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`}
                  </span>
                </div>

                <div className="flex justify-between font-bold text-amber-600 border-t pt-1">
                  <span>Balance Due:</span>
                  <span className="font-mono">
                    {isUsd
                      ? `$${pricingCalculations.totalPayableUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                      : `${Math.round(pricingCalculations.totalPayableTzs).toLocaleString()} TZS`}
                  </span>
                </div>
              </div>
            </div>

            {/* Official Settlement & Commercial Wire Accounts (2 cols matching FinanceInvoices) */}
            <div className="border-t pt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div>
                <span className="font-bold uppercase tracking-wider text-gray-700 block mb-1">
                  Official Settlement & Commercial Wire Accounts
                </span>
                <p className="text-gray-600">
                  <span className="font-semibold text-gray-900">Beneficiary:</span> {paymentAccounts.accountName || companyName}
                </p>
                <p className="text-gray-600">
                  <span className="font-semibold text-gray-900">Primary Bank:</span> {paymentAccounts.bankName || "CRDB Bank / Standard Chartered"}
                </p>
                <p className="text-gray-600">
                  <span className="font-semibold text-gray-900">Branch:</span> {paymentAccounts.branch || "Corporate Branch"} {paymentAccounts.swiftCode ? ` · SWIFT: ${paymentAccounts.swiftCode}` : ""}
                </p>
              </div>
              <div>
                <span className="font-bold uppercase tracking-wider text-gray-700 block mb-1">
                  Direct Account Numbers
                </span>
                <p className="text-gray-600">
                  <span className="font-semibold text-gray-900">TZS Account:</span> <span className="font-mono font-semibold">{paymentAccounts.accountNumberTzs || "0150248839200"}</span>
                </p>
                <p className="text-gray-600">
                  <span className="font-semibold text-gray-900">USD Account:</span> <span className="font-mono font-semibold">{paymentAccounts.accountNumberUsd || "0250248839201"}</span>
                </p>
                {paymentAccounts.mobileMoneyNumber && (
                  <p className="text-gray-600">
                    <span className="font-semibold text-gray-900">Merchant / Lipa Namba:</span> <span className="font-mono font-semibold text-emerald-700">{paymentAccounts.mobileMoneyNumber}</span>
                  </p>
                )}
              </div>
            </div>

            {paymentAccounts.paymentInstructions && (
              <div className="text-[11px] text-gray-500 border-t pt-2">
                <span className="font-bold text-gray-700">Payment Instructions:</span> {paymentAccounts.paymentInstructions}
              </div>
            )}

            {/* CARRIER DISPATCH & CONSIGNEE RECEIVING POD STAMPS */}
            <div className="grid grid-cols-2 gap-6 pt-1 text-xs">
              {/* Carrier Dispatch Signature */}
              <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 space-y-1.5">
                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-500">
                  <span>01. Carrier Release & Dispatch</span>
                  <span className="text-primary font-bold">CARRIER STAMP</span>
                </div>
                <div className="h-8 border-b border-dashed border-slate-300 flex items-end pb-0.5">
                  <span className="text-[9px] text-slate-400 italic font-serif">Authorized Operations Dispatcher</span>
                </div>
                <div className="flex justify-between items-baseline text-[9px]">
                  <div>
                    <div className="font-bold text-slate-800">{companyName}</div>
                    <div className="text-slate-500">Operations Dispatch Desk</div>
                  </div>
                  <div className="text-right text-slate-500 font-mono">
                    Date: {formatDate(trip.created_at || new Date().toISOString())}
                  </div>
                </div>
              </div>

              {/* Client Receiver POD Signature */}
              <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 space-y-1.5">
                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-500">
                  <span>02. Consignee Proof of Delivery (POD)</span>
                  <span className="text-emerald-700 font-bold">RECEIVER STAMP</span>
                </div>
                <div className="h-8 border-b border-dashed border-slate-300 flex items-end pb-0.5">
                  <span className="text-[9px] text-slate-400 italic font-serif">Received in Good Order & Condition</span>
                </div>
                <div className="flex justify-between items-baseline text-[9px]">
                  <div>
                    <div className="font-bold text-slate-800">{trip.client_name || "Authorized Consignee"}</div>
                    <div className="text-slate-500">Official Receiving Signature & Stamp</div>
                  </div>
                  <div className="text-right text-slate-500 font-mono">
                    Date: ____ / ____ / 202___
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECURITY MICRO-FOOTER */}
          <div className="pt-2 border-t border-slate-200 text-center text-[8px] text-slate-400 leading-tight">
            Cargo dispatch and carriage subject to standard international freight transit terms and carrier liability limits. This electronic delivery note & freight invoice is computer generated and valid without alterations. Ref: {receiptRef}
          </div>
        </div>
      </div>
    </div>
  );
}
