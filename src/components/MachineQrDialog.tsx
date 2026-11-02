import { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Download,
  Printer,
  AlertTriangle,
  Copy,
  Check,
  FileDown,
  Building2,
  Truck,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { escapeHtml } from "@/lib/escapeHtml";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machineId: string;
  machineName: string;
  qrEnabled?: boolean;
  onQrEnabledChange?: (v: boolean) => void;
  plateNumber?: string | null;
  registrationNumber?: string | null;
  currentHours?: number | null;
  category?: string | null;
  organisationName?: string | null;
  organisationLogoUrl?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  serialNumber?: string | null;
  vin?: string | null;
}

export function MachineQrDialog({
  open,
  onOpenChange,
  machineId,
  machineName: initialMachineName,
  qrEnabled: initialQrEnabled = true,
  onQrEnabledChange,
  plateNumber: initialPlateNumber,
  registrationNumber: initialRegistrationNumber,
  currentHours: initialCurrentHours,
  category: initialCategory,
  organisationName: initialOrgName,
  organisationLogoUrl: initialOrgLogo,
  make: initialMake,
  model: initialModel,
  year: initialYear,
  serialNumber: initialSerialNumber,
  vin: initialVin,
}: Props) {
  const { organisation } = useAuth();
  const badgeRef = useRef<HTMLDivElement>(null);

  // Local state enriched from props or auto-fetched if missing
  const [machineName, setMachineName] = useState(initialMachineName);
  const [plateNumber, setPlateNumber] = useState(initialPlateNumber);
  const [registrationNumber, setRegistrationNumber] = useState(initialRegistrationNumber);
  const [category, setCategory] = useState(initialCategory);
  const [make, setMake] = useState(initialMake);
  const [model, setModel] = useState(initialModel);
  const [year, setYear] = useState(initialYear);
  const [serialNumber, setSerialNumber] = useState(initialSerialNumber);
  const [vin, setVin] = useState(initialVin);
  const [currentHours, setCurrentHours] = useState(initialCurrentHours);
  const [qrEnabled, setQrEnabled] = useState(initialQrEnabled);

  const [toggling, setToggling] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingPng, setDownloadingPng] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  const effectiveOrgName =
    initialOrgName || organisation?.name || "MachineCare Hub";
  const effectiveOrgLogo = initialOrgLogo || organisation?.logo_url || null;

  // Sync state when props change
  useEffect(() => {
    setMachineName(initialMachineName);
    setPlateNumber(initialPlateNumber);
    setRegistrationNumber(initialRegistrationNumber);
    setCategory(initialCategory);
    setMake(initialMake);
    setModel(initialModel);
    setYear(initialYear);
    setSerialNumber(initialSerialNumber);
    setVin(initialVin);
    setCurrentHours(initialCurrentHours);
    setQrEnabled(initialQrEnabled);
  }, [
    initialMachineName,
    initialPlateNumber,
    initialRegistrationNumber,
    initialCategory,
    initialMake,
    initialModel,
    initialYear,
    initialSerialNumber,
    initialVin,
    initialCurrentHours,
    initialQrEnabled,
  ]);

  // Backfill any missing vehicle fields from database when modal opens
  useEffect(() => {
    if (!open || !machineId) return;

    let isMounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("machines")
          .select(
            "name, plate_number, registration_number, category, make, model, year, serial_number, vin, current_hours, current_odometer_km, qr_enabled"
          )
          .eq("id", machineId)
          .maybeSingle();

        if (!error && data && isMounted) {
          if (data.name) setMachineName(data.name);
          if (data.plate_number !== undefined) setPlateNumber(data.plate_number);
          if (data.registration_number !== undefined) setRegistrationNumber(data.registration_number);
          if (data.category) setCategory(data.category);
          if (data.make !== undefined) setMake(data.make);
          if (data.model !== undefined) setModel(data.model);
          if (data.year !== undefined) setYear(data.year);
          if (data.serial_number !== undefined) setSerialNumber(data.serial_number);
          if (data.vin !== undefined) setVin(data.vin);
          if (data.current_odometer_km != null) setCurrentHours(data.current_odometer_km);
          else if (data.current_hours != null) setCurrentHours(data.current_hours);
          if (data.qr_enabled !== undefined) setQrEnabled(data.qr_enabled);
        }
      } catch (e) {
        // Non-blocking fallback
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [open, machineId]);

  // Convert company logo to base64 Data URL to guarantee clean rendering in html2canvas & jsPDF
  useEffect(() => {
    if (!effectiveOrgLogo) {
      setLogoDataUrl(null);
      return;
    }

    let isCancelled = false;
    (async () => {
      try {
        const res = await fetch(effectiveOrgLogo, { mode: "cors" });
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (!isCancelled && typeof reader.result === "string") {
            setLogoDataUrl(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      } catch {
        if (!isCancelled) {
          setLogoDataUrl(effectiveOrgLogo);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [effectiveOrgLogo]);

  // Build clean mobile URL
  const queryParams = new URLSearchParams();
  if (machineName) queryParams.set("n", machineName);
  if (plateNumber) queryParams.set("p", plateNumber);
  if (registrationNumber) queryParams.set("r", registrationNumber);
  if (currentHours != null) queryParams.set("h", String(currentHours));
  if (category) queryParams.set("c", category);
  if (effectiveOrgName) queryParams.set("o", effectiveOrgName);

  const queryString = queryParams.toString();
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/m/${machineId}${
    queryString ? `?${queryString}` : ""
  }`;

  const toggleQrEnabled = async (v: boolean) => {
    setToggling(true);
    const { error } = await supabase.from("machines").update({ qr_enabled: v }).eq("id", machineId);
    setToggling(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setQrEnabled(v);
    onQrEnabledChange?.(v);
    toast.success(v ? "QR code activated" : "QR code revoked");
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Asset link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const safeFilename = (machineName || "asset")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .toLowerCase();

  // 1-Click PDF Download: Generates a high-resolution, industrial-grade Asset Tag sticker PDF
  const downloadPdf = async () => {
    if (!badgeRef.current) return;
    setDownloadingPdf(true);
    try {
      const canvas = await html2canvas(badgeRef.current, {
        scale: 3, // Ultra-sharp 300 DPI equivalent
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
      });

      const imgData = canvas.toDataURL("image/png");

      // Standard 100mm x 140mm asset sticker format (fits 4" x 5.5" sticker paper & thermal rolls)
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [100, 140],
      });

      pdf.addImage(imgData, "PNG", 0, 0, 100, 140);
      const filename = `${safeFilename}${plateNumber ? `_${plateNumber.replace(/\s+/g, "")}` : ""}-qr-tag.pdf`;
      pdf.save(filename);
      toast.success("Asset Tag PDF downloaded successfully");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Download high-resolution PNG for digital signage or printing shops
  const downloadPng = async () => {
    if (!badgeRef.current) return;
    setDownloadingPng(true);
    try {
      const canvas = await html2canvas(badgeRef.current, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${safeFilename}${plateNumber ? `_${plateNumber.replace(/\s+/g, "")}` : ""}-qr-tag.png`;
      a.click();
      toast.success("Asset Tag image saved as PNG");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save image");
    } finally {
      setDownloadingPng(false);
    }
  };

  // SVG download of QR code
  const downloadSvg = () => {
    const svg = document.getElementById("machine-qr-svg");
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = `${safeFilename}-qr.svg`;
    a.click();
    URL.revokeObjectURL(u);
    toast.success("QR SVG downloaded");
  };

  // Print function with dedicated print styling, cut guides, company logo, and vehicle details
  const print = () => {
    const svg = document.getElementById("machine-qr-svg")?.outerHTML ?? "";
    const w = window.open("", "_blank", "width=700,height=880");
    if (!w) {
      toast.error("Couldn't open print window. Please check your browser popup blocker.");
      return;
    }

    const safeOrg = escapeHtml(effectiveOrgName);
    const safeName = escapeHtml(machineName || "Fleet Asset");
    const safePlate = plateNumber ? escapeHtml(plateNumber) : "";
    const safeReg = registrationNumber ? escapeHtml(registrationNumber) : "";
    const safeMakeModel = [make, model].filter(Boolean).join(" ");
    const safeCat = escapeHtml(category || "Vehicle");
    const logoSrc = logoDataUrl || effectiveOrgLogo || "";

    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${safeName} - Asset QR Tag</title>
  <style>
    @page {
      size: auto;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .print-wrapper {
      max-width: 420px;
      width: 100%;
      text-align: center;
    }
    .tag-container {
      background: #ffffff;
      border: 3px solid #0f172a;
      border-radius: 18px;
      padding: 24px 20px 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      position: relative;
      overflow: hidden;
    }
    .top-stripe {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 6px;
      background: #0284c7;
    }
    .org-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 14px;
    }
    .org-logo {
      max-height: 38px;
      max-width: 130px;
      object-fit: contain;
    }
    .org-name {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.3px;
      text-transform: uppercase;
    }
    .tag-type-badge {
      display: inline-block;
      font-size: 9px;
      font-weight: 700;
      color: #0284c7;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }
    .asset-title {
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
      margin: 0 0 8px;
      line-height: 1.2;
      word-break: break-word;
    }
    .identifiers {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 14px;
    }
    .plate-badge {
      background: #0f172a;
      color: #ffffff;
      font-family: monospace;
      font-weight: 800;
      font-size: 13px;
      padding: 4px 10px;
      border-radius: 6px;
      letter-spacing: 1px;
    }
    .code-badge {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
      font-family: monospace;
      font-weight: 700;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .meta-line {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 14px;
      font-weight: 500;
    }
    .qr-box {
      background: #ffffff;
      padding: 12px;
      display: inline-block;
      border: 2px solid #e2e8f0;
      border-radius: 14px;
      margin-bottom: 12px;
    }
    .qr-box svg {
      width: 190px !important;
      height: 190px !important;
      display: block;
    }
    .scan-action {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 4px;
    }
    .scan-sub {
      font-size: 10px;
      color: #64748b;
      margin: 0 0 12px;
      line-height: 1.4;
    }
    .tag-footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      color: #94a3b8;
    }
    .cut-guide {
      margin-top: 16px;
      padding: 6px;
      font-size: 10px;
      color: #64748b;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
    }
    @media print {
      body {
        padding: 0;
        background: #ffffff;
      }
      .cut-guide {
        border-color: #94a3b8;
      }
    }
  </style>
</head>
<body>
  <div class="print-wrapper">
    <div class="tag-container">
      <div class="top-stripe"></div>
      <div class="org-header">
        ${
          logoSrc
            ? `<img class="org-logo" src="${escapeHtml(logoSrc)}" alt="${safeOrg}" onerror="this.style.display='none'" />`
            : ""
        }
        <div class="org-name">${safeOrg}</div>
      </div>

      <div class="tag-type-badge">Official Asset Tag · ${safeCat}</div>
      <div class="asset-title">${safeName}</div>

      <div class="identifiers">
        ${safePlate ? `<div class="plate-badge">PLATE: ${safePlate}</div>` : ""}
        ${safeReg ? `<div class="code-badge">UNIT: ${safeReg}</div>` : ""}
      </div>

      ${
        safeMakeModel || year || serialNumber
          ? `<div class="meta-line">
              ${[
                safeMakeModel,
                year ? `Year: ${year}` : null,
                serialNumber ? `S/N: ${serialNumber}` : null,
              ]
                .filter(Boolean)
                .join(" • ")}
             </div>`
          : ""
      }

      <div class="qr-box">
        ${svg}
      </div>

      <div class="scan-action">Scan With Phone Camera</div>
      <div class="scan-sub">Log daily pre-start inspection · Record service · Report fault</div>

      <div class="tag-footer">
        <span>TAG: ${escapeHtml(machineId.slice(0, 8).toUpperCase())}</span>
        <span>MachineCare Hub</span>
      </div>
    </div>

    <div class="cut-guide">
      ✂ Cut along the outer line · Affix to vehicle dashboard, door jamb or machine chassis
    </div>
  </div>
</body>
</html>`);
    w.document.close();

    let printed = false;
    const doPrint = () => {
      if (printed) return;
      printed = true;
      w.focus();
      w.print();
    };
    w.onload = doPrint;
    setTimeout(doPrint, 500);
  };

  const makeModelStr = [make, model].filter(Boolean).join(" ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <QrCode className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Vehicle & Machine Asset Tag
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Official scannable QR label for {machineName}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {!qrEnabled && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>This QR code is currently inactive.</strong> Scanning it will display a &quot;Revoked&quot; status. Switch it back on below to activate.
              </span>
            </div>
          )}

          {/* Realistic Printable Sticker Preview */}
          <div className="flex justify-center p-2 bg-muted/40 rounded-xl border border-dashed border-border/80">
            <div
              ref={badgeRef}
              id="machine-asset-tag-badge"
              className="w-full max-w-[340px] bg-white text-slate-900 rounded-2xl border-2 border-slate-900 shadow-md p-4 text-center relative overflow-hidden select-none"
            >
              {/* Top Accent Stripe */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500" />

              {/* Company Logo and Header */}
              <div className="flex items-center justify-center gap-2 pt-1 pb-2 border-b border-slate-200 mb-2.5 min-h-[44px]">
                {logoDataUrl || effectiveOrgLogo ? (
                  <img
                    src={logoDataUrl || effectiveOrgLogo || ""}
                    alt={effectiveOrgName}
                    crossOrigin="anonymous"
                    className="max-h-9 max-w-[130px] object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase text-slate-800">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span>{effectiveOrgName}</span>
                  </div>
                )}
                {logoDataUrl && (
                  <span className="text-[13px] font-extrabold uppercase tracking-tight text-slate-800 truncate max-w-[170px]">
                    {effectiveOrgName}
                  </span>
                )}
              </div>

              {/* Tag Classification */}
              <div className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200 mb-1.5">
                <ShieldCheck className="h-3 w-3 text-sky-600" />
                <span>Official Asset Tag • {category || "Fleet Unit"}</span>
              </div>

              {/* Machine / Vehicle Name */}
              <h3 className="text-base font-black text-slate-900 leading-snug line-clamp-2 px-1 mb-2">
                {machineName}
              </h3>

              {/* License Plate & Unit Number Badges */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mb-2.5">
                {plateNumber && (
                  <span className="inline-flex items-center gap-1 bg-slate-950 text-white font-mono font-black text-xs px-2.5 py-1 rounded shadow-sm border border-slate-800 tracking-wider">
                    <Truck className="h-3 w-3 text-sky-400" />
                    PLATE: {plateNumber}
                  </span>
                )}
                {registrationNumber && (
                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 font-mono font-bold text-[11px] px-2 py-0.5 rounded border border-slate-300">
                    UNIT: {registrationNumber}
                  </span>
                )}
              </div>

              {/* Make / Model / Year / Serial */}
              {(makeModelStr || year || serialNumber) && (
                <p className="text-[10px] text-slate-500 font-medium mb-2.5 truncate px-2">
                  {[
                    makeModelStr,
                    year ? `Yr: ${year}` : null,
                    serialNumber ? `S/N: ${serialNumber}` : null,
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </p>
              )}

              {/* Center QR Code */}
              <div className="inline-block p-2.5 bg-white rounded-xl border-2 border-slate-200 shadow-sm mb-2">
                <QRCodeSVG
                  id="machine-qr-svg"
                  value={url}
                  size={170}
                  level="Q"
                  includeMargin={false}
                />
              </div>

              {/* Call to action instruction */}
              <p className="text-[11px] font-black uppercase text-slate-900 tracking-wide mb-0.5">
                Scan With Phone Camera
              </p>
              <p className="text-[9.5px] text-slate-500 leading-tight max-w-[260px] mx-auto mb-2">
                Log inspections · Record service & fuel · Report faults immediately
              </p>

              {/* Footer */}
              <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                <span>TAG: {machineId.slice(0, 8).toUpperCase()}</span>
                <span className="font-sans font-medium text-[8.5px]">MachineCare Hub</span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              className="gap-2 bg-primary text-primary-foreground font-semibold"
              onClick={downloadPdf}
              disabled={downloadingPdf}
            >
              <FileDown className="h-4 w-4" />
              {downloadingPdf ? "Generating..." : "Download PDF"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-slate-300 dark:border-slate-700"
              onClick={print}
            >
              <Printer className="h-4 w-4" />
              Print Label
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flex-1 text-xs gap-1.5"
              onClick={downloadPng}
              disabled={downloadingPng}
            >
              <Download className="h-3.5 w-3.5" />
              {downloadingPng ? "Saving..." : "Save Image (PNG)"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flex-1 text-xs gap-1.5"
              onClick={copyUrl}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied Link" : "Copy Scan Link"}
            </Button>
          </div>

          {/* Active status & Revocation control */}
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold">QR Code Active</span>
                <p className="text-[11px] text-muted-foreground">
                  Deactivate if sticker is lost or damaged to prevent unauthorized scans.
                </p>
              </div>
              <Switch checked={qrEnabled} onCheckedChange={toggleQrEnabled} disabled={toggling} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
