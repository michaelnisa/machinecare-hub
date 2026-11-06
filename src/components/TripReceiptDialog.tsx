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

    let parsedMeta: any = {};
    if (trip.cargo_description && typeof trip.cargo_description === "string" && trip.cargo_description.startsWith("{")) {
      try {
        parsedMeta = JSON.parse(trip.cargo_description);
      } catch {}
    }

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
    const raw = trip?.cargo_description;
    if (!raw) return trip?.purpose || "Commercial Freight / General Cargo";
    if (typeof raw === "string") {
      if (raw.startsWith("{") || raw.endsWith("}")) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.cargo && typeof parsed.cargo === "string" && !parsed.cargo.startsWith("{")) {
            return parsed.cargo;
          }
          if (parsed.purpose && typeof parsed.purpose === "string") {
            return parsed.purpose;
          }
        } catch {}
        return trip?.purpose || "Commercial Freight / General Cargo";
      }
      return raw;
    }
    return trip?.purpose || "Commercial Freight / General Cargo";
  }, [trip]);

  // Save updated pricing back to trip's cargo_description
  const handleSavePricingToTrip = async () => {
    if (!trip?.id) return;
    try {
      let cargoMeta: any = {};
      if (trip.cargo_description && typeof trip.cargo_description === "string" && trip.cargo_description.startsWith("{")) {
        try {
          cargoMeta = JSON.parse(trip.cargo_description);
        } catch {}
      }

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
      toast.success("Receipt PDF downloaded successfully");
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-muted/40 print:p-0 print:bg-white print:overflow-visible">
          <div
            ref={sheetRef}
            className="w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 p-8 sm:p-12 rounded-xl shadow-md border border-slate-200 flex flex-col justify-between print:border-none print:shadow-none print:p-8 print:w-full print:rounded-none"
          >
            <div className="space-y-6">
              {/* HEADER SECTION: LOGO + COMPANY DETAILS */}
              <div className="flex items-start justify-between border-b-2 border-primary pb-5 gap-4">
                <div className="space-y-1 max-w-[60%]">
                  <div className="text-[10px] font-black tracking-[0.25em] uppercase text-primary">
                    Commercial Delivery Waybill & Freight Receipt
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
                  {customLogoUrl ? (
                    <div className="mb-1.5">
                      <img
                        src={customLogoUrl}
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
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">{companyTin}</div>
                </div>
              </div>

              {/* CLIENT & TRANSIT LOGISTICS CARDS */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                {/* Client Box */}
                <div className="rounded-lg border border-slate-200 p-3.5 space-y-1.5 bg-slate-50/50">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" /> Client / Consignee Information
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    {trip.client_name || "Commercial Cargo Consignee"}
                  </div>
                  <div className="text-slate-600">
                    Order / Delivery Note Ref: <strong className="font-mono text-slate-800">{trip.client_order_no || "N/A"}</strong>
                  </div>
                  <div className="text-slate-600 pt-0.5">
                    Consignment Specification: <span className="font-medium text-slate-800">{cleanCargo}</span>
                  </div>
                  <div className="text-slate-600 text-[11px]">
                    Payment Terms: <span className="font-semibold text-primary">{paymentTerms}</span>
                  </div>
                </div>

                {/* Logistics & Vehicle Box */}
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
                          Consignment: <span className="font-medium text-slate-800">{cleanCargo}</span>
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
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                        {billingCurrency === "USD"
                          ? `$${pricingCalculations.baseFreight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                          : `${Math.round(pricingCalculations.baseFreight).toLocaleString()} TZS`}
                        <div className="text-[10px] text-slate-500 font-normal">
                          {billingCurrency === "USD"
                            ? `≈ ${Math.round(pricingCalculations.baseFreight * exchangeRate).toLocaleString()} TZS`
                            : `≈ $${(pricingCalculations.baseFreight / exchangeRate).toFixed(2)} USD`}
                        </div>
                      </td>
                    </tr>

                    {/* VAT row if applicable */}
                    {taxPercent > 0 && (
                      <tr className="text-slate-700">
                        <td className="py-2.5 px-3 font-mono text-slate-400">02</td>
                        <td className="py-2.5 px-3" colSpan={2}>
                          <span className="font-semibold text-slate-800">Value Added Tax (VAT {taxPercent}%)</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          {taxPercent}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {billingCurrency === "USD"
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
                      {billingCurrency === "USD"
                        ? `$${pricingCalculations.baseFreight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                        : `${Math.round(pricingCalculations.baseFreight).toLocaleString()} TZS`}
                    </span>
                  </div>

                  {taxPercent > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>VAT / Tax ({taxPercent}%):</span>
                      <span className="font-mono font-semibold">
                        {billingCurrency === "USD"
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
                        {billingCurrency === "USD"
                          ? `$${pricingCalculations.totalPayableUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                          : `${Math.round(pricingCalculations.totalPayableTzs).toLocaleString()} TZS`}
                      </div>
                      <div className="text-xs font-bold text-slate-600 font-mono">
                        {billingCurrency === "USD"
                          ? `≈ ${Math.round(pricingCalculations.totalPayableTzs).toLocaleString()} TZS`
                          : `≈ $${pricingCalculations.totalPayableUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ACCOUNT TO PAY (BANK & MOBILE MONEY DETAILS) */}
              <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 space-y-2.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-primary flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Landmark className="h-4 w-4 text-primary" /> Official Payment Accounts / Bank Details
                  </span>
                  <span className="text-[10px] font-medium text-slate-500">
                    Strictly Direct Bank Transfer / Official Mobile Till
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 text-xs">
                  {/* Bank Account */}
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

                  {/* Mobile Money / Lipa Namba */}
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

              {/* SIGNATURES & STAMPS SECTION */}
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

            {/* FOOTER NOTE */}
            <div className="pt-6 border-t border-slate-200 text-center text-[10px] text-slate-400">
              This receipt & freight waybill certifies the dispatch of cargo under carrier liability terms. Thank you for your partnership.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
