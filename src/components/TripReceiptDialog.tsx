import { useState, useRef, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  Download,
  Building2,
  MapPin,
  Truck,
  User,
  CreditCard,
  FileText,
  DollarSign,
  Edit3,
  Check,
  Globe2,
  Calendar,
  X,
  Phone,
  Mail,
  ShieldCheck,
  Landmark,
  Smartphone,
  AlertCircle,
  FileCheck2,
  Package,
  Scale,
  Route,
  CheckCircle2,
} from "lucide-react";
import { formatDate, formatMoney } from "@/lib/format";
import { DEFAULT_USD_TO_TZS_RATE, formatTripCurrency } from "@/services/crossBorderCorridors";
import { parseCargoMeta, extractCleanCargo } from "@/lib/fleet-metadata";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PaymentTermsInput } from "@/components/fleet/PaymentTermsInput";

export interface PaymentAccountSettings {
  bankName: string;
  accountName: string;
  accountNumberTzs: string;
  accountNumberUsd: string;
  swiftCode: string;
  branch: string;
  mobileMoneyName: string;
  mobileMoneyNumber: string;
  paymentInstructions: string;
}

export const DEFAULT_PAYMENT_ACCOUNTS: PaymentAccountSettings = {
  bankName: "CRDB Bank PLC",
  accountName: "LOGISTIXWARE LOGISTICS LIMITED",
  accountNumberTzs: "0150244891000",
  accountNumberUsd: "0250244891000",
  swiftCode: "CORUTZTZ",
  branch: "Dar es Salaam Main Branch",
  mobileMoneyName: "M-Pesa / Tigo Pesa Merchant",
  mobileMoneyNumber: "Lipa Namba: 5549021 (LOGISTIXWARE)",
  paymentInstructions: "Please quote the Receipt / Order Reference number when making bank deposits or mobile money transfers.",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: any;
  machine?: any;
  driver?: any;
  org?: any;
  onPriceUpdated?: () => void;
}

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

export function TripReceiptDialog({
  open,
  onOpenChange,
  trip,
  machine,
  driver,
  org,
  onPriceUpdated,
}: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [docMode, setDocMode] = useState<"waybill" | "invoice">("waybill");
  const [downloading, setDownloading] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);

  // Billing and pricing state
  const [clientPrice, setClientPrice] = useState<string>("");
  const [billingCurrency, setBillingCurrency] = useState<"USD" | "TZS">("USD");
  const [paymentTerms, setPaymentTerms] = useState<string>("Upon Delivery & Offloading");
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [includeStatutoryTolls, setIncludeStatutoryTolls] = useState<boolean>(true);
  const [customLogoUrl, setCustomLogoUrl] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [companyPhone, setCompanyPhone] = useState<string>("");
  const [companyAddress, setCompanyAddress] = useState<string>("");
  const [companyTin, setCompanyTin] = useState<string>("TIN: 142-990-811 / VRN: 40-029188");

  // Payment accounts
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccountSettings>(() => {
    try {
      const saved = localStorage.getItem("trip_receipt_payment_settings");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_PAYMENT_ACCOUNTS;
  });

  // Load existing trip data and org details
  useEffect(() => {
    if (!open || !trip) return;

    const parsedMeta = parseCargoMeta(trip.cargo_description) || {};

    const price = parsedMeta.client_billing_amount ?? trip.client_billing_amount ?? parsedMeta.client_price ?? "";
    setClientPrice(price ? String(price) : "");
    setBillingCurrency(parsedMeta.billing_currency || trip.billing_currency || parsedMeta.currency || (trip.currency === "USD" ? "USD" : "TZS"));
    setPaymentTerms(parsedMeta.payment_terms || trip.payment_terms || "Upon Delivery & Offloading");
    setTaxPercent(parsedMeta.tax_percent ?? trip.tax_percent ?? 0);
    if (parsedMeta.include_statutory_tolls != null) setIncludeStatutoryTolls(Boolean(parsedMeta.include_statutory_tolls));
    if (parsedMeta.custom_logo_url || trip.custom_logo_url) setCustomLogoUrl(parsedMeta.custom_logo_url || trip.custom_logo_url);

    // Company branding
    setCompanyName(org?.name || "LOGISTIXWARE LOGISTICS LIMITED");
    setCompanyPhone(org?.phone || "+255 754 123 456 / +255 22 286 1900");
    setCompanyAddress(org?.address || "Kurasini Depot, Nelson Mandela Road, Dar es Salaam, Tanzania");
    if (!parsedMeta.custom_logo_url && org?.logo_url) setCustomLogoUrl(org.logo_url);
  }, [open, trip, org]);

  const exchangeRate = Number(trip?.exchange_rate) || DEFAULT_USD_TO_TZS_RATE;

  // Calculate customer pricing numbers
  const pricingCalculations = useMemo(() => {
    const baseFreight = Number(clientPrice) || 0;
    let subtotalUsd = 0;
    let subtotalTzs = 0;

    if (billingCurrency === "USD") {
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
      subtotalUsd,
      subtotalTzs,
      taxAmountUsd,
      taxAmountTzs,
      totalPayableUsd,
      totalPayableTzs,
    };
  }, [clientPrice, billingCurrency, taxPercent, exchangeRate]);

  const cleanCargo = useMemo(() => {
    return extractCleanCargo(trip?.cargo_description, trip?.purpose);
  }, [trip]);

  // Save updated pricing back to trip's cargo_description
  const handleSavePricingToTrip = async () => {
    if (!trip?.id) return;
    try {
      const cargoMeta: any = parseCargoMeta(trip.cargo_description) || {};

      cargoMeta.client_billing_amount = Number(clientPrice) || 0;
      cargoMeta.billing_currency = billingCurrency;
      cargoMeta.payment_terms = paymentTerms;
      cargoMeta.tax_percent = taxPercent;
      cargoMeta.include_statutory_tolls = includeStatutoryTolls;
      if (customLogoUrl) cargoMeta.custom_logo_url = customLogoUrl;

      await supabase
        .from("trips")
        .update({
          cargo_description: JSON.stringify(cargoMeta),
        })
        .eq("id", trip.id);

      // Save payment account preferences locally
      localStorage.setItem("trip_receipt_payment_settings", JSON.stringify(paymentAccounts));

      toast.success("Receipt details and payment terms saved");
      setEditingSettings(false);
      onPriceUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to update trip receipt settings");
    }
  };

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

      const prefix = docMode === "waybill" ? "WAYBILL" : "INVOICE";
      const refCode = trip.client_order_no || trip.id?.slice(0, 8) || "TRIP";
      pdf.save(`${prefix}-${refCode}.pdf`);
      toast.success(`${docMode === "waybill" ? "Road Freight Waybill (POD)" : "Commercial Freight Invoice"} PDF downloaded successfully`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to export PDF");
    } finally {
      setDownloading(false);
    }
  };

  if (!trip) return null;

  const waybillRef = trip.client_order_no
    ? (trip.client_order_no.toUpperCase().startsWith("WB-") ? trip.client_order_no.toUpperCase() : `WB-${trip.client_order_no.toUpperCase()}`)
    : `WB-${trip.id.slice(0, 8).toUpperCase()}`;

  const invoiceRef = trip.client_order_no
    ? (trip.client_order_no.toUpperCase().startsWith("INV-") ? trip.client_order_no.toUpperCase() : `INV-${trip.client_order_no.toUpperCase()}`)
    : `INV-${trip.id.slice(0, 8).toUpperCase()}`;

  const activeRef = docMode === "waybill" ? waybillRef : invoiceRef;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] p-0 overflow-hidden flex flex-col bg-muted/40">
        {/* TOP CONTROLS BAR (hidden when printing) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-border bg-background print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setDocMode("waybill")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                  docMode === "waybill"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileCheck2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Road Waybill (P.O.D.)</span>
              </button>
              <button
                type="button"
                onClick={() => setDocMode("invoice")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                  docMode === "invoice"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <DollarSign className="h-3.5 w-3.5" />
                <span>Commercial Invoice</span>
              </button>
            </div>

            <div className="hidden sm:block text-xs text-muted-foreground">
              {trip.client_name || "Client"} · <span className="font-mono font-bold text-foreground">{activeRef}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingSettings(!editingSettings)}
              className="text-xs gap-1.5 h-8.5"
            >
              <Edit3 className="h-3.5 w-3.5" />
              {editingSettings ? "Close Customizer" : docMode === "waybill" ? "Customize Waybill" : "Customize Price & Bank"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="text-xs gap-1.5 h-8.5"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading ? "Generating…" : "Download PDF"}
            </Button>

            <Button
              size="sm"
              onClick={() => window.print()}
              className="text-xs gap-1.5 h-8.5 shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              {docMode === "waybill" ? "Print Waybill" : "Print Invoice"}
            </Button>
          </div>
        </div>

        {/* CUSTOMIZER DRAWER (Toggled by user) */}
        {editingSettings && (
          <div className="p-4 bg-background border-b border-border animate-fade-in text-xs space-y-3 print:hidden">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
                <CreditCard className="h-4 w-4" /> Configure Client Total Price & Payment Accounts
              </span>
              <Button size="sm" onClick={handleSavePricingToTrip} className="h-7 text-xs gap-1">
                <Check className="h-3 w-3" /> Save Changes
              </Button>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              {/* Total Price to Pay */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold">Client Freight Price *</Label>
                  <div className="flex rounded bg-muted p-0.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setBillingCurrency("USD")}
                      className={`px-1.5 py-0.5 rounded font-semibold ${
                        billingCurrency === "USD" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      USD ($)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCurrency("TZS")}
                      className={`px-1.5 py-0.5 rounded font-semibold ${
                        billingCurrency === "TZS" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      TZS (Tsh)
                    </button>
                  </div>
                </div>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 3500"
                  value={clientPrice}
                  onChange={(e) => setClientPrice(e.target.value)}
                  className="h-8 text-xs font-mono font-bold"
                />
              </div>

              {/* Payment Terms */}
              <div className="space-y-1">
                <PaymentTermsInput
                  label="Payment Terms / Conditions"
                  value={paymentTerms}
                  onChange={setPaymentTerms}
                  inputClassName="h-8 text-xs"
                />
              </div>

              {/* Company Logo URL */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">Company Logo Image URL</Label>
                <Input
                  value={customLogoUrl}
                  onChange={(e) => setCustomLogoUrl(e.target.value)}
                  placeholder="https://.../logo.png"
                  className="h-8 text-xs"
                />
              </div>

              {/* Bank Name & Branch */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">Primary Bank Name</Label>
                <Input
                  value={paymentAccounts.bankName}
                  onChange={(e) => setPaymentAccounts({ ...paymentAccounts, bankName: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              {/* Bank Account Name */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">Bank Account Name</Label>
                <Input
                  value={paymentAccounts.accountName}
                  onChange={(e) => setPaymentAccounts({ ...paymentAccounts, accountName: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              {/* Bank Account Numbers */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">Account No (USD / TZS)</Label>
                <Input
                  value={paymentAccounts.accountNumberUsd}
                  onChange={(e) => setPaymentAccounts({ ...paymentAccounts, accountNumberUsd: e.target.value })}
                  placeholder="USD Account No."
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* SWIFT / Branch */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">SWIFT Code & Branch</Label>
                <Input
                  value={paymentAccounts.swiftCode}
                  onChange={(e) => setPaymentAccounts({ ...paymentAccounts, swiftCode: e.target.value })}
                  placeholder="SWIFT / Branch"
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* Mobile Money Till */}
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[11px] font-semibold">Mobile Money / Lipa Namba Details</Label>
                <Input
                  value={paymentAccounts.mobileMoneyNumber}
                  onChange={(e) => setPaymentAccounts({ ...paymentAccounts, mobileMoneyNumber: e.target.value })}
                  placeholder="e.g. M-Pesa Lipa Namba: 5549021"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* QUICK CUSTOMER PRICE ENTRY BAR (shown only in invoice mode when freight price is 0) */}
        {!editingSettings && docMode === "invoice" && pricingCalculations.baseFreight === 0 && (
          <div className="px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 print:hidden">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="font-semibold">Customer agreed freight price is not set ($0.00).</span>
              <span className="text-amber-800/90 dark:text-amber-300/90">
                Enter the amount the client agreed to pay for this shipment:
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded bg-muted/80 p-0.5 text-[10px] font-semibold border border-amber-300/50">
                <button
                  type="button"
                  onClick={() => setBillingCurrency("USD")}
                  className={`px-1.5 py-0.5 rounded ${billingCurrency === "USD" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  USD
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCurrency("TZS")}
                  className={`px-1.5 py-0.5 rounded ${billingCurrency === "TZS" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  TZS
                </button>
              </div>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 3500"
                value={clientPrice}
                onChange={(e) => setClientPrice(e.target.value)}
                className="h-7 w-28 text-xs font-mono font-bold bg-white dark:bg-slate-900 border-amber-400"
              />
              <Button
                size="sm"
                onClick={handleSavePricingToTrip}
                className="h-7 text-xs px-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                Save Price
              </Button>
            </div>
          </div>
        )}

        {/* PRINTABLE SHEET CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center bg-muted/40 print:p-0 print:bg-white print:overflow-visible">
          <div
            ref={sheetRef}
            className="w-full max-w-[820px] bg-white text-slate-900 p-6 sm:p-8 rounded-xl shadow-xl border border-slate-200 flex flex-col justify-between print:border-none print:shadow-none print:p-4 print:w-full print:rounded-none"
            style={{ boxSizing: "border-box" }}
          >
            {docMode === "waybill" ? (
              /* =========================================================================
                 AUTHENTIC ROAD FREIGHT WAYBILL & CONSIGNMENT NOTE (P.O.D.)
                 - NO PRICING / NO TAX / NO BANK WIRE CLUTTER
                 - PURE LOGISTICS ROAD CONSIGNMENT & PROOF OF DELIVERY
                 ========================================================================= */
              <div className="space-y-3.5">
                {/* Top Solid Accent Line */}
                <div className="h-1.5 w-full bg-slate-900 rounded-xs" />

                {/* HEADER SECTION: CARRIER BRANDING + TITLE + WAYBILL REF & BARCODE */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 gap-4">
                  <div className="space-y-1 max-w-[55%]">
                    <div className="flex items-center gap-2">
                      {customLogoUrl ? (
                        <img
                          src={customLogoUrl}
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
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 block">
                              Cross-Border Heavy Haulage & Bulk Freight Logistics
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    {customLogoUrl && (
                      <div className="text-xs font-bold text-slate-900">{companyName}</div>
                    )}
                    <div className="text-[11px] text-slate-600 leading-tight pt-0.5 space-y-0.5">
                      <div className="flex items-center gap-1 font-medium">
                        <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{companyAddress}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500">
                        <span>Tel: <strong className="text-slate-700">{companyPhone}</strong></span>
                        <span>·</span>
                        <span className="font-mono">{companyTin}</span>
                        <span>·</span>
                        <span className="font-medium text-slate-600">LATRA / SADC Permit: <strong className="font-mono text-slate-800">TZ-DAR-8849</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                      <FileCheck2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>ROAD FREIGHT WAYBILL & CONSIGNMENT NOTE</span>
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      PROOF OF DELIVERY (P.O.D.) · NON-NEGOTIABLE
                    </div>

                    <div className="font-mono text-2xl font-black text-slate-900 tracking-tight pt-0.5">
                      {waybillRef}
                    </div>

                    <BarcodeGraphic code={waybillRef} />

                    <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        Date: <strong className="text-slate-700">{formatDate(trip.created_at || new Date().toISOString())}</strong>
                      </span>
                      <span>·</span>
                      <span className="capitalize font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300">
                        {trip.status === "in_progress" ? "In Transit" : trip.status || "Dispatched"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3-BOX CONSIGNMENT ENTITY MATRIX (CONSIGNOR, CARRIER, CONSIGNEE) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                  {/* BOX 1: CONSIGNOR / SHIPPER */}
                  <div className="border border-slate-300 rounded-lg overflow-hidden bg-slate-50/40">
                    <div className="bg-slate-800 text-white px-2.5 py-1 text-[10px] font-black tracking-wider uppercase flex items-center justify-between">
                      <span>01. Consignor / Shipper</span>
                      <Building2 className="h-3 w-3 text-slate-300" />
                    </div>
                    <div className="p-2.5 space-y-1">
                      <div className="text-xs font-black text-slate-900 leading-tight">
                        {trip.client_name || "Commercial Cargo Consignor"}
                      </div>
                      <div className="text-[11px] text-slate-600 leading-snug">
                        <span className="font-semibold text-slate-700">Loading Terminal:</span> {trip.origin || "Origin Depot / Port"}
                      </div>
                      {trip.client_order_no && (
                        <div className="text-[11px] text-slate-600 font-mono">
                          <span className="font-semibold text-slate-700 font-sans">D.O. / Order Ref:</span> {trip.client_order_no}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                        Handover: Loading Bay Dispatch Desk
                      </div>
                    </div>
                  </div>

                  {/* BOX 2: CARRIER & TRANSIT EQUIPMENT */}
                  <div className="border border-slate-300 rounded-lg overflow-hidden bg-slate-50/40">
                    <div className="bg-slate-800 text-white px-2.5 py-1 text-[10px] font-black tracking-wider uppercase flex items-center justify-between">
                      <span>02. Carrier & Vehicle Particulars</span>
                      <Truck className="h-3 w-3 text-emerald-400" />
                    </div>
                    <div className="p-2.5 space-y-1">
                      <div className="text-xs font-black text-slate-900 leading-tight">
                        {companyName}
                      </div>
                      <div className="text-[11px] text-slate-700 leading-snug font-medium">
                        Truck: <strong className="font-mono text-slate-900">{machine?.plate_number ? `${machine.name} (${machine.plate_number})` : machine?.name || "Freight Truck"}</strong>
                        {machine?.trailer_plate && (
                          <span className="text-slate-700 font-mono block">Trailer: <strong className="text-slate-900">{machine.trailer_plate}</strong></span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Driver: <strong className="text-slate-900">{driver?.full_name || "Assigned Driver"}</strong> {driver?.phone ? `(${driver.phone})` : ""}
                      </div>
                      <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                        Route: <strong className="text-slate-700">{trip.origin || "Origin"}</strong> ➔ <strong className="text-slate-700">{trip.destination || "Destination"}</strong>
                        {trip.corridor_name && <span className="block truncate text-primary font-medium">Corridor: {trip.corridor_name}</span>}
                      </div>
                    </div>
                  </div>

                  {/* BOX 3: CONSIGNEE / RECEIVING POINT */}
                  <div className="border border-slate-300 rounded-lg overflow-hidden bg-slate-50/40">
                    <div className="bg-slate-800 text-white px-2.5 py-1 text-[10px] font-black tracking-wider uppercase flex items-center justify-between">
                      <span>03. Consignee / Delivery Point</span>
                      <MapPin className="h-3 w-3 text-amber-300" />
                    </div>
                    <div className="p-2.5 space-y-1">
                      <div className="text-xs font-black text-slate-900 leading-tight">
                        {trip.client_name || "Authorized Consignee"}
                      </div>
                      <div className="text-[11px] text-slate-600 leading-snug">
                        <span className="font-semibold text-slate-700">Offload Facility:</span> {trip.destination || "Destination Terminal"}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-700">Delivery Terms:</span> {paymentTerms || "Direct Gate-In & Ullage Inspection"}
                      </div>
                      <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                        Receipt: Subject to Intact Tamper Seals
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARGO MANIFEST & CUSTOMS SECURITY SEALS TABLE */}
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5 text-slate-700" /> Cargo Manifest & Transit Security Seals
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      Cross-Border Transit Bond Compliance
                    </span>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-2 text-center w-10">Item</th>
                        <th className="p-2">Description of Goods & Cargo Particulars</th>
                        <th className="p-2">Vehicle / Packaging Spec</th>
                        <th className="p-2 text-center">Declared Quantity</th>
                        <th className="p-2">Security Transit Seals</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="p-2.5 text-center font-bold text-slate-700 align-top">01</td>
                        <td className="p-2.5 space-y-0.5 align-top">
                          <div className="font-bold text-slate-900 text-xs">
                            {cleanCargo || "Commercial Cargo / General Consignment"}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Transit: <strong className="text-slate-700">{trip.origin || "Origin Depot"}</strong> to <strong className="text-slate-700">{trip.destination || "Destination Depot"}</strong>
                            {trip.corridor_name ? ` via ${trip.corridor_name}` : ""}
                          </div>
                          {trip.border_post && (
                            <div className="text-[9px] text-primary font-semibold">
                              Designated Border Post: {trip.border_post}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-700 align-top">
                          <div className="font-semibold text-slate-800">
                            {machine?.vehicle_type || "Heavy Haulage Semi-Trailer"}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Plate: <span className="font-mono font-bold text-slate-700">{machine?.plate_number || "T-TRUCK"}</span>
                            {machine?.trailer_plate && <span className="font-mono text-slate-600 ml-1">/ {machine.trailer_plate}</span>}
                          </div>
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-slate-800 text-xs align-top">
                          1 FTL Consignment
                          {trip.start_km && (
                            <div className="text-[9px] text-slate-500 font-normal font-sans">
                              Dep. Odo: {Number(trip.start_km).toLocaleString()} km
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-[11px] space-y-1 align-top">
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 text-emerald-400 font-mono text-[10px] font-bold">
                            <ShieldCheck className="h-3 w-3" />
                            SEAL-{trip.id.slice(0, 4).toUpperCase()}-01 / SEAL-{trip.id.slice(4, 8).toUpperCase()}-02
                          </div>
                          <div className="text-[9px] text-slate-500">
                            Tamper-Evident High-Security Bolt Seals (TRA / SADC Standard)
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* TRANSIT STATUTORY & GPS TELEMATICS NOTICE STRIP */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg border border-slate-200 bg-slate-50/70 text-[10px] space-y-0.5">
                    <span className="font-bold text-slate-800 uppercase flex items-center gap-1">
                      <Scale className="h-3 w-3 text-slate-600" /> Tanroads & SADC Axle Load Weighbridge Compliance
                    </span>
                    <p className="text-slate-600 leading-snug">
                      Consignment is loaded strictly within statutory Gross Vehicle Weight (GVW) limits. Mandatory axle verification at all designated government weigh stations.
                    </p>
                  </div>

                  <div className="p-2 rounded-lg border border-slate-200 bg-slate-50/70 text-[10px] space-y-0.5">
                    <span className="font-bold text-slate-800 uppercase flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-emerald-600" /> 24/7 Live GPS Telematics & Geo-fence Monitored
                    </span>
                    <p className="text-slate-600 leading-snug">
                      Asset tracked live via satellite GPS telematics with automated corridor speed limit governing (80 km/h) and real-time seal tampering detection.
                    </p>
                  </div>
                </div>

                {/* THREE-WAY OFFICIAL CUSTODY TRANSFER & SIGNATURE STAMPS */}
                <div className="grid grid-cols-3 gap-3 pt-1 text-xs">
                  {/* 01. CONSIGNOR DISPATCH */}
                  <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50/60 flex flex-col justify-between h-36">
                    <div>
                      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-200">
                        <span>01. Consignor Handover</span>
                        <span className="text-slate-500 font-bold">STAGE 1</span>
                      </div>
                      <p className="text-[9px] text-slate-500 pt-1 leading-snug">
                        Goods inspected, stowed & sealed in good external order.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="border-b border-dashed border-slate-400 pb-0.5 text-[9px] text-slate-400 italic">
                        Loaded By: ________________________
                      </div>
                      <div className="flex justify-between items-baseline text-[9px] text-slate-600">
                        <span className="font-bold">Date: {formatDate(trip.created_at || new Date().toISOString())}</span>
                        <span className="font-mono text-[8px] text-slate-400">[SHIPPER STAMP]</span>
                      </div>
                    </div>
                  </div>

                  {/* 02. CARRIER / DRIVER ACCEPTANCE */}
                  <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50/60 flex flex-col justify-between h-36">
                    <div>
                      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-200">
                        <span>02. Carrier Acceptance</span>
                        <span className="text-primary font-bold">STAGE 2</span>
                      </div>
                      <p className="text-[9px] text-slate-500 pt-1 leading-snug">
                        Intact seals & cargo received for carriage to destination.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="border-b border-dashed border-slate-400 pb-0.5 text-[9px] text-slate-700 font-semibold truncate">
                        Driver: {driver?.full_name || "Authorized Fleet Driver"}
                      </div>
                      <div className="flex justify-between items-baseline text-[9px] text-slate-600">
                        <span className="font-mono">Odo: {trip.start_km ? `${Number(trip.start_km).toLocaleString()} km` : "_________ km"}</span>
                        <span className="font-mono text-[8px] text-slate-400">[CARRIER STAMP]</span>
                      </div>
                    </div>
                  </div>

                  {/* 03. CONSIGNEE PROOF OF DELIVERY (POD) */}
                  <div className="border-2 border-emerald-600/40 rounded-lg p-2.5 bg-emerald-50/30 flex flex-col justify-between h-36">
                    <div>
                      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-emerald-900 pb-1 border-b border-emerald-300">
                        <span>03. Consignee Receipt (P.O.D.)</span>
                        <span className="text-emerald-700 font-bold">STAGE 3</span>
                      </div>
                      <div className="pt-1 flex items-center gap-1.5 text-[9px] font-bold text-emerald-900">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span>Clean Delivery · Seals Intact</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="border-b border-dashed border-slate-400 pb-0.5 text-[9px] text-slate-400 italic">
                        Received By (Print & Sign): _______________
                      </div>
                      <div className="flex justify-between items-baseline text-[9px] text-slate-600">
                        <span className="font-mono">Date: ___/___/202___</span>
                        <span className="font-mono text-[8px] text-emerald-700 font-bold">[CONSIGNEE STAMP]</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECURITY MICRO-FOOTER */}
                <div className="pt-2 border-t border-slate-200 text-center text-[8px] text-slate-400 leading-tight">
                  NON-NEGOTIABLE ROAD CONSIGNMENT NOTE & PROOF OF DELIVERY (P.O.D.). Issued under SADC / EAC Cross-Border Freight Carriage Regulations. Consignee must endorse this document upon receipt. Computer generated copy — Valid without alterations. Ref: {waybillRef}
                </div>
              </div>
            ) : (
              /* =========================================================================
                 COMMERCIAL FREIGHT INVOICE
                 - INCLUDES AGREED RATE, VAT (18%), TOTAL PAYABLE, FX RATE, AND BANK WIRES
                 ========================================================================= */
              <div className="space-y-4">
                {/* Top Solid Accent Line */}
                <div className="h-1 w-full bg-slate-900 rounded-xs" />

                {/* HEADER SECTION: LOGO + COMPANY DETAILS + INVOICE REF & BARCODE */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3.5 gap-4">
                  <div className="space-y-1 max-w-[55%]">
                    <div className="flex items-center gap-2">
                      {customLogoUrl ? (
                        <img
                          src={customLogoUrl}
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
                    {customLogoUrl && (
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
                        <span className="font-mono">{companyTin}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end space-y-1">
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[9px] font-bold uppercase tracking-wider">
                      <span>Commercial Freight Tax Invoice</span>
                      <span className="text-emerald-400">· ORIGINAL</span>
                    </div>

                    <div className="font-mono text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {invoiceRef}
                    </div>

                    <BarcodeGraphic code={invoiceRef} />

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

                {/* Bill To & Operational Reference */}
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
                      Consignment Cargo: <span className="font-medium text-gray-900">{cleanCargo || "Commercial Cargo / General Freight"}</span>
                    </p>
                    <p className="text-primary font-semibold text-[11px]">
                      Agreed Payment Terms: {paymentTerms}
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
                      Route: <strong className="text-gray-900">{trip.origin || "Origin"}</strong> to <strong className="text-primary">{trip.destination || "Destination"}</strong>
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

                {/* Items Table */}
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
                          Route Transit: {trip.origin || "Origin Depot"} to {trip.destination || "Destination"}
                          {trip.corridor_name ? ` via ${trip.corridor_name}` : ""}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          Cargo: {cleanCargo || "Commercial Cargo"} · Asset: {machine?.plate_number || "Truck"} · Driver: {driver?.full_name || "Fleet Driver"}
                        </p>
                      </td>
                      <td className="p-2.5 text-center font-mono align-middle">1 Run</td>
                      <td className="p-2.5 text-right font-mono align-middle">
                        {billingCurrency === "USD"
                          ? `$${pricingCalculations.baseFreight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `${Math.round(pricingCalculations.baseFreight).toLocaleString()} TZS`}
                        {pricingCalculations.baseFreight === 0 && (
                          <div className="print:hidden">
                            <button
                              type="button"
                              onClick={() => setEditingSettings(true)}
                              className="text-[10px] text-amber-600 hover:underline font-sans font-medium"
                            >
                              + Set Price
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-semibold font-mono align-middle">
                        {billingCurrency === "USD"
                          ? `$${pricingCalculations.baseFreight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `${Math.round(pricingCalculations.baseFreight).toLocaleString()} TZS`}
                      </td>
                    </tr>

                    {taxPercent > 0 && (
                      <tr className="bg-gray-50/50">
                        <td className="p-2.5 font-medium text-gray-700">
                          Value Added Tax (VAT {taxPercent}%)
                        </td>
                        <td className="p-2.5 text-center font-mono">1</td>
                        <td className="p-2.5 text-right font-mono">{taxPercent}%</td>
                        <td className="p-2.5 text-right font-semibold font-mono">
                          {billingCurrency === "USD"
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
                        {billingCurrency === "USD"
                          ? `$${pricingCalculations.baseFreight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `${Math.round(pricingCalculations.baseFreight).toLocaleString()} TZS`}
                      </span>
                    </div>

                    {taxPercent > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">VAT ({taxPercent}%):</span>
                        <span className="font-semibold font-mono">
                          {billingCurrency === "USD"
                            ? `$${pricingCalculations.taxAmountUsd.toFixed(2)}`
                            : `${Math.round(pricingCalculations.taxAmountTzs).toLocaleString()} TZS`}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm font-bold border-t pt-2 text-gray-900">
                      <span>Total Amount:</span>
                      <span className="font-mono text-primary">
                        {billingCurrency === "USD"
                          ? `$${pricingCalculations.totalPayableUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                          : `${Math.round(pricingCalculations.totalPayableTzs).toLocaleString()} TZS`}
                      </span>
                    </div>

                    <div className="flex justify-between text-[11px] text-gray-500 font-mono">
                      <span>Equivalent (FX {exchangeRate}):</span>
                      <span>
                        {billingCurrency === "USD"
                          ? `≈ ${Math.round(pricingCalculations.totalPayableTzs).toLocaleString()} TZS`
                          : `≈ $${pricingCalculations.totalPayableUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`}
                      </span>
                    </div>

                    <div className="flex justify-between font-bold text-amber-600 border-t pt-1">
                      <span>Balance Due:</span>
                      <span className="font-mono">
                        {billingCurrency === "USD"
                          ? `$${pricingCalculations.totalPayableUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                          : `${Math.round(pricingCalculations.totalPayableTzs).toLocaleString()} TZS`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Official Settlement & Commercial Wire Accounts */}
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

                {/* CARRIER DISPATCH & CONSIGNEE RECEIVING STAMPS */}
                <div className="grid grid-cols-2 gap-6 pt-1 text-xs">
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

                {/* SECURITY MICRO-FOOTER */}
                <div className="pt-2 border-t border-slate-200 text-center text-[8px] text-slate-400 leading-tight">
                  Cargo dispatch and carriage subject to standard international freight transit terms and carrier liability limits. This electronic delivery note & freight invoice is computer generated and valid without alterations. Ref: {invoiceRef}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
