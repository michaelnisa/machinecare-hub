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
} from "lucide-react";
import { formatDate, formatMoney } from "@/lib/format";
import { DEFAULT_USD_TO_TZS_RATE, formatTripCurrency } from "@/services/crossBorderCorridors";
import { parseCargoMeta, extractCleanCargo } from "@/lib/fleet-metadata";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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

      const refCode = trip.client_order_no || trip.id?.slice(0, 8) || "TRIP";
      pdf.save(`WAYBILL-${refCode}.pdf`);
      toast.success("Waybill PDF downloaded successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to export PDF");
    } finally {
      setDownloading(false);
    }
  };

  if (!trip) return null;

  const receiptRef = trip.client_order_no ? `RCP-${trip.client_order_no}` : `RCP-${trip.id.slice(0, 8).toUpperCase()}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] p-0 overflow-hidden flex flex-col bg-muted/40">
        {/* TOP CONTROLS BAR (hidden when printing) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-b border-border bg-background print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Client Freight Receipt & Delivery Waybill
              </DialogTitle>
              <div className="text-xs text-muted-foreground">
                {trip.client_name || "Client Order"} · Ref: <span className="font-mono font-semibold">{receiptRef}</span>
              </div>
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
              {editingSettings ? "Close Customizer" : "Customize Price & Bank Accounts"}
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
              <Printer className="h-3.5 w-3.5" /> Print Receipt
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
                <Label className="text-[11px] font-semibold">Payment Terms / Conditions</Label>
                <Input
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g. Upon Delivery & Offloading / Net 30 Days"
                  className="h-8 text-xs"
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

        {/* QUICK CUSTOMER PRICE ENTRY BAR (shown when freight price is 0) */}
        {!editingSettings && pricingCalculations.baseFreight === 0 && (
          <div className="px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 print:hidden">
            <div className="flex items-center gap-2">
              <span className="font-bold">⚠️ Customer Agreed Freight Price is not set ($0.00).</span>
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
            <div className="space-y-4">
              {/* Top Accent Gradient Line */}
              <div className="h-1.5 w-full bg-gradient-to-r from-blue-700 via-indigo-600 to-emerald-500 rounded-full" />

              {/* HEADER SECTION: LOGO + COMPANY DETAILS + WAYBILL REF & BARCODE */}
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
                    <span>Commercial Freight Waybill</span>
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

              {/* 3-COLUMN LOGISTICS DOSSIER: CARRIER, CLIENT, ROUTE & ASSET */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                {/* 01. Carrier / Shipper */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 space-y-1">
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-primary" /> 01. Carrier / Shipper
                  </div>
                  <div className="font-bold text-slate-900 text-xs truncate">{companyName}</div>
                  <div className="text-[10px] text-slate-600">Operations Dispatch Center</div>
                  <div className="text-[10px] text-slate-500 truncate">Kurasini Freight Depot · DSM</div>
                  <div className="text-[9px] font-mono text-slate-500">Carrier Reg: EAC-TZ-LOG-04</div>
                </div>

                {/* 02. Consignee / Client */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 space-y-1">
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <User className="h-3 w-3 text-primary" /> 02. Consignee / Client
                  </div>
                  <div className="font-bold text-slate-900 text-xs truncate">
                    {trip.client_name || "Commercial Cargo Consignee"}
                  </div>
                  <div className="text-[10px] text-slate-700">
                    Order / DO: <strong className="font-mono text-slate-900">{trip.client_order_no || "N/A"}</strong>
                  </div>
                  <div className="text-[10px] text-slate-600 truncate">
                    Cargo: <span className="font-medium text-slate-800">{cleanCargo}</span>
                  </div>
                  <div className="text-[9px] text-primary font-semibold truncate">
                    Terms: {paymentTerms}
                  </div>
                </div>

                {/* 03. Transport Asset & Route */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 space-y-1">
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Truck className="h-3 w-3 text-primary" /> 03. Transit Asset & Route
                  </div>
                  <div className="flex items-center gap-1 font-bold text-slate-900 text-[11px] truncate">
                    <MapPin className="h-3 w-3 text-rose-500 shrink-0" />
                    <span className="truncate">{trip.origin || "Origin"}</span>
                    <span>→</span>
                    <span className="text-primary truncate">{trip.destination || "Destination"}</span>
                  </div>
                  {trip.corridor_name && (
                    <div className="text-[9px] text-slate-600 flex items-center gap-1 truncate">
                      <Globe2 className="h-2.5 w-2.5 text-primary shrink-0" />
                      <span className="font-medium truncate">{trip.corridor_name}</span>
                    </div>
                  )}
                  <div className="pt-0.5 text-[10px] text-slate-700 space-y-0.5 leading-tight">
                    <div className="truncate">
                      Head: <strong className="text-slate-900">{machine?.plate_number ? `${machine.name} (${machine.plate_number})` : machine?.name || "Vehicle"}</strong>
                    </div>
                    <div className="truncate">
                      Trailer: <strong className="text-primary">{machine?.trailer_plate ? machine.trailer_plate : "Standard Trailer Unit"}</strong>
                    </div>
                    <div className="truncate">
                      Driver: <strong className="text-slate-900">{driver?.full_name || "Fleet Driver"}</strong> {driver?.phone ? `(${driver.phone})` : ""}
                    </div>
                  </div>
                </div>
              </div>

              {/* ITEMISED COMMERCIAL FREIGHT SERVICE TABLE */}
              <div className="overflow-hidden rounded-lg border border-slate-200 shadow-2xs">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white text-left text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-3 font-bold w-8 text-center">#</th>
                      <th className="py-2.5 px-3 font-bold">Description of Commercial Haulage Service</th>
                      <th className="py-2.5 px-3 font-bold text-center">Assigned Asset & Crew</th>
                      <th className="py-2.5 px-3 font-bold text-right">Agreed Rate</th>
                      <th className="py-2.5 px-3 font-bold text-right">Amount Payable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {/* Main Haulage row */}
                    <tr>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400">01</td>
                      <td className="py-2.5 px-3 space-y-0.5">
                        <div className="font-bold text-xs text-slate-900 leading-snug">
                          Cross-Border Commercial Freight Haulage & Consignment Delivery
                        </div>
                        <div className="text-[11px] text-slate-600">
                          Route Transit: <strong className="text-slate-800">{trip.origin || "Origin Depot"}</strong> ➔ <strong className="text-primary">{trip.destination || "Destination"}</strong>
                          {trip.corridor_name ? ` via ${trip.corridor_name}` : ""}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Consignment Cargo: <span className="font-medium text-slate-800">{cleanCargo}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center align-middle">
                        <div className="inline-block text-left bg-slate-50 border border-slate-200 rounded p-1.5 text-[10px]">
                          <div className="font-bold text-slate-900">
                            {machine?.plate_number ? `${machine.name} (${machine.plate_number})` : machine?.name || "Vehicle"}
                          </div>
                          <div className="text-primary font-medium">
                            {machine?.trailer_plate ? `Trailer: ${machine.trailer_plate}` : "Standard Trailer Unit"}
                          </div>
                          <div className="text-slate-600 mt-0.5">
                            Driver: <strong className="text-slate-800">{driver?.full_name || "Fleet Driver"}</strong>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 text-xs align-middle">
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
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 text-xs align-middle">
                        {billingCurrency === "USD"
                          ? `$${pricingCalculations.baseFreight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                          : `${Math.round(pricingCalculations.baseFreight).toLocaleString()} TZS`}
                        <div className="text-[9px] text-slate-500 font-normal">
                          {billingCurrency === "USD"
                            ? `≈ ${Math.round(pricingCalculations.baseFreight * exchangeRate).toLocaleString()} TZS`
                            : `≈ $${(pricingCalculations.baseFreight / exchangeRate).toFixed(2)} USD`}
                        </div>
                      </td>
                    </tr>

                    {/* VAT row if applicable */}
                    {taxPercent > 0 && (
                      <tr className="bg-slate-50/50">
                        <td className="py-2 px-3 text-center font-mono text-slate-400">02</td>
                        <td className="py-2 px-3" colSpan={2}>
                          <span className="font-semibold text-slate-800">Value Added Tax (VAT {taxPercent}%)</span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">
                          {taxPercent}%
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {billingCurrency === "USD"
                            ? `$${pricingCalculations.taxAmountUsd.toFixed(2)} USD`
                            : `${Math.round(pricingCalculations.taxAmountTzs).toLocaleString()} TZS`}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* SETTLEMENT CARD & PAYMENT ACCOUNTS */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-1">
                {/* Left: Official Wire & Lipa Namba Accounts (3 cols) */}
                <div className="md:col-span-3 rounded-lg border border-slate-300 bg-slate-50/90 p-3 space-y-2">
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-between border-b border-slate-200 pb-1">
                    <span className="flex items-center gap-1.5 text-slate-900">
                      <Landmark className="h-3.5 w-3.5 text-blue-700" /> Official Settlement & Wire Details
                    </span>
                    <span className="text-[8px] font-semibold text-slate-500 uppercase">Direct Deposit · Lipa Namba</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900">{paymentAccounts.bankName}</div>
                      <div className="text-slate-600 text-[10px]">Beneficiary: <strong className="text-slate-800">{paymentAccounts.accountName}</strong></div>
                      <div className="text-slate-600 text-[10px]">
                        USD Account: <strong className="font-mono text-blue-700 font-bold">{paymentAccounts.accountNumberUsd}</strong>
                      </div>
                      {paymentAccounts.accountNumberTzs && (
                        <div className="text-slate-600 text-[10px]">
                          TZS Account: <strong className="font-mono text-slate-800">{paymentAccounts.accountNumberTzs}</strong>
                        </div>
                      )}
                      <div className="text-[9px] font-mono text-slate-500">
                        SWIFT: {paymentAccounts.swiftCode} · {paymentAccounts.branch}
                      </div>
                    </div>

                    <div className="border-l border-slate-200 pl-2.5 space-y-0.5">
                      <div className="font-bold text-slate-900 flex items-center gap-1 text-[11px]">
                        <Smartphone className="h-3.5 w-3.5 text-emerald-600" /> {paymentAccounts.mobileMoneyName}
                      </div>
                      <div className="text-[10px] text-slate-500">Lipa Namba Reference:</div>
                      <div className="text-xs font-black font-mono text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300 w-fit">
                        {paymentAccounts.mobileMoneyNumber}
                      </div>
                      <div className="text-[9px] text-slate-500 leading-tight pt-0.5">
                        {paymentAccounts.paymentInstructions}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Total Price to Pay Card (2 cols) */}
                <div className="md:col-span-2 rounded-lg border-2 border-slate-900 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-3 flex flex-col justify-between shadow-sm">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-300">
                      <span>Agreed Freight Price:</span>
                      <span className="font-mono font-bold text-white">
                        {billingCurrency === "USD"
                          ? `$${pricingCalculations.baseFreight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                          : `${Math.round(pricingCalculations.baseFreight).toLocaleString()} TZS`}
                      </span>
                    </div>

                    {taxPercent > 0 && (
                      <div className="flex justify-between text-[11px] text-slate-300">
                        <span>VAT / Tax ({taxPercent}%):</span>
                        <span className="font-mono font-semibold text-white">
                          {billingCurrency === "USD"
                            ? `$${pricingCalculations.taxAmountUsd.toFixed(2)} USD`
                            : `${Math.round(pricingCalculations.taxAmountTzs).toLocaleString()} TZS`}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-700 pt-1.5 mt-1.5">
                    <div className="text-[9px] font-black uppercase tracking-wider text-emerald-400">
                      Total Freight Price to Pay:
                    </div>
                    <div className="text-lg font-black text-white font-mono tracking-tight mt-0.5">
                      {billingCurrency === "USD"
                        ? `$${pricingCalculations.totalPayableUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                        : `${Math.round(pricingCalculations.totalPayableTzs).toLocaleString()} TZS`}
                    </div>
                    <div className="text-[10px] font-bold text-slate-300 font-mono">
                      {billingCurrency === "USD"
                        ? `≈ ${Math.round(pricingCalculations.totalPayableTzs).toLocaleString()} TZS`
                        : `≈ $${pricingCalculations.totalPayableUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`}
                    </div>
                    <div className="text-[8px] text-slate-400 mt-0.5 font-mono">
                      FX Rate: 1 USD = {exchangeRate} TZS
                    </div>
                  </div>
                </div>
              </div>

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
      </DialogContent>
    </Dialog>
  );
}
