import { useState, useRef, useEffect } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
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
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [pdfFormat, setPdfFormat] = useState<"sticker" | "a4">("sticker");

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

  // Generate ultra-reliable base64 QR code image from offscreen canvas
  useEffect(() => {
    const extractQrDataUrl = () => {
      const canvas = document.getElementById("offscreen-qr-canvas") as HTMLCanvasElement | null;
      if (canvas) {
        try {
          const data = canvas.toDataURL("image/png");
          if (data && data.length > 50) {
            setQrDataUrl(data);
          }
        } catch (e) {
          console.error("Error generating QR image data", e);
        }
      }
    };

    extractQrDataUrl();
    const timer = setTimeout(extractQrDataUrl, 80);
    return () => clearTimeout(timer);
  }, [url, open]);

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

  // 1-Click PDF Download: Generates razor-sharp, aspect-ratio-accurate PDF
  const downloadPdf = async () => {
    if (!badgeRef.current) return;
    setDownloadingPdf(true);
    try {
      const canvas = await html2canvas(badgeRef.current, {
        scale: 2.5, // 250 DPI equivalent - crisp text and crisp QR
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      if (pdfFormat === "a4") {
        // Standard A4 sheet (210mm x 297mm) with centered badge and dashed cut guides
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
        });

        const pageWidth = 210;
        const pageHeight = 297;
        const stickerWidth = 105;
        const stickerHeight = (canvasHeight * stickerWidth) / canvasWidth;
        const x = (pageWidth - stickerWidth) / 2;
        const y = (pageHeight - stickerHeight) / 2 - 12;

        // Cut guidelines
        pdf.setLineDashPattern([2, 2], 0);
        pdf.setDrawColor(160, 174, 192);
        pdf.rect(x - 4, y - 4, stickerWidth + 8, stickerHeight + 8);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(
          "✂ Cut along dashed guide · Affix to vehicle dashboard, windshield or equipment chassis",
          pageWidth / 2,
          y + stickerHeight + 11,
          { align: "center" }
        );

        pdf.addImage(imgData, "PNG", x, y, stickerWidth, stickerHeight);
        const filename = `${safeFilename}${plateNumber ? `_${plateNumber.replace(/\s+/g, "")}` : ""}-qr-tag-a4.pdf`;
        pdf.save(filename);
      } else {
        // Exact 100mm wide sticker format with 100% accurate aspect ratio (ZERO stretching)
        const pdfWidthMm = 100;
        const pdfHeightMm = Number(((canvasHeight * pdfWidthMm) / canvasWidth).toFixed(2));

        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [pdfWidthMm, pdfHeightMm],
        });

        pdf.addImage(imgData, "PNG", 0, 0, pdfWidthMm, pdfHeightMm);
        const filename = `${safeFilename}${plateNumber ? `_${plateNumber.replace(/\s+/g, "")}` : ""}-qr-tag.pdf`;
        pdf.save(filename);
      }

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
        logging: false,
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

  // Print function with dedicated print styling, cut guides, company logo, and vehicle details
  const print = () => {
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
    const qrSrc = qrDataUrl || "";

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
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      padding: 24px;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .print-wrapper {
      max-width: 400px;
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
      max-height: 42px;
      max-width: 140px;
      object-fit: contain;
    }
    .org-name {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.2px;
      text-transform: uppercase;
    }
    .tag-type-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 800;
      color: #0284c7;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      padding: 3px 10px;
      border-radius: 9999px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .asset-title {
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
      margin: 0 0 10px;
      line-height: 1.25;
      word-break: break-word;
    }
    .identifiers {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .plate-badge {
      background: #0f172a;
      color: #ffffff;
      font-family: monospace;
      font-weight: 800;
      font-size: 14px;
      padding: 5px 12px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }
    .code-badge {
      background: #f1f5f9;
      color: #1e293b;
      border: 1px solid #cbd5e1;
      font-family: monospace;
      font-weight: 700;
      font-size: 13px;
      padding: 5px 10px;
      border-radius: 6px;
    }
    .meta-line {
      font-size: 12px;
      color: #475569;
      margin-bottom: 12px;
      font-weight: 600;
      line-height: 1.3;
    }
    .qr-box {
      background: #ffffff;
      padding: 12px;
      display: inline-block;
      border: 2px solid #e2e8f0;
      border-radius: 14px;
      margin-bottom: 12px;
    }
    .qr-img {
      width: 190px !important;
      height: 190px !important;
      display: block;
      margin: 0 auto;
    }
    .scan-action {
      font-size: 13px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 4px;
    }
    .scan-sub {
      font-size: 11px;
      color: #64748b;
      margin: 0 0 12px;
      line-height: 1.4;
      font-weight: 500;
    }
    .tag-footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      font-family: monospace;
      color: #94a3b8;
    }
    .cut-guide {
      margin-top: 18px;
      padding: 8px;
      font-size: 11px;
      color: #64748b;
      border: 1px dashed #94a3b8;
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
        ${
          qrSrc
            ? `<img class="qr-img" src="${escapeHtml(qrSrc)}" alt="QR Code" />`
            : `<div id="fallback-qr"></div>`
        }
      </div>

      <div class="scan-action">Scan With Phone Camera</div>
      <div class="scan-sub">Daily Inspection · Maintenance Log · Report Faults</div>

      <div class="tag-footer">
        <span>TAG: ${escapeHtml(machineId.slice(0, 8).toUpperCase())}</span>
        <span>MachineCare Hub</span>
      </div>
    </div>

    <div class="cut-guide">
      ✂ Cut along dashed guide · Affix to vehicle dashboard, windshield or equipment chassis
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
  const metaLineStr = [
    makeModelStr,
    year ? `Year: ${year}` : null,
    serialNumber ? `S/N: ${serialNumber}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[94vh] overflow-y-auto p-4 sm:p-6">
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

        {/* Offscreen hidden canvas for guaranteed immediate base64 QR generation */}
        <div style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0 }}>
          <QRCodeCanvas
            id="offscreen-qr-canvas"
            value={url}
            size={360}
            level="Q"
            marginSize={1}
          />
        </div>

        <div className="space-y-3.5 py-1">
          {!qrEnabled && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>This QR code is currently inactive.</strong> Scanning it will display a &quot;Revoked&quot; status. Switch it back on below to activate.
              </span>
            </div>
          )}

          {/* Realistic Printable Sticker Preview (Engineered for Pixel-Perfect HTML2Canvas & Print Capture) */}
          <div className="flex justify-center p-2.5 bg-muted/40 rounded-xl border border-dashed border-border/80">
            <div
              ref={badgeRef}
              id="machine-asset-tag-badge"
              style={{
                width: "350px",
                maxWidth: "100%",
                backgroundColor: "#ffffff",
                color: "#0f172a",
                borderRadius: "16px",
                border: "2.5px solid #0f172a",
                padding: "18px 16px 14px",
                textAlign: "center",
                position: "relative",
                boxSizing: "border-box",
                fontFamily: "Arial, Helvetica, -apple-system, sans-serif",
              }}
            >
              {/* Top Accent Stripe */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "5px",
                  backgroundColor: "#0284c7",
                  borderTopLeftRadius: "14px",
                  borderTopRightRadius: "14px",
                }}
              />

              {/* Company Logo and Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  paddingBottom: "8px",
                  borderBottom: "1px solid #e2e8f0",
                  marginBottom: "10px",
                  minHeight: "42px",
                }}
              >
                {logoDataUrl || effectiveOrgLogo ? (
                  <img
                    src={logoDataUrl || effectiveOrgLogo || ""}
                    alt={effectiveOrgName}
                    crossOrigin="anonymous"
                    style={{
                      maxHeight: "38px",
                      maxWidth: "130px",
                      objectFit: "contain",
                      display: "inline-block",
                    }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      color: "#0f172a",
                    }}
                  >
                    <Building2 className="h-4 w-4 text-primary" />
                    <span>{effectiveOrgName}</span>
                  </div>
                )}
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    color: "#0f172a",
                    letterSpacing: "0.2px",
                  }}
                >
                  {effectiveOrgName}
                </span>
              </div>

              {/* Tag Classification Badge */}
              <div
                style={{
                  display: "inline-block",
                  fontSize: "10px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: "#0284c7",
                  backgroundColor: "#f0f9ff",
                  border: "1px solid #bae6fd",
                  padding: "3px 10px",
                  borderRadius: "9999px",
                  marginBottom: "6px",
                }}
              >
                OFFICIAL ASSET TAG · {category || "FLEET UNIT"}
              </div>

              {/* Machine / Vehicle Name (Full visibility, no clipping) */}
              <div
                style={{
                  fontSize: "19px",
                  fontWeight: 900,
                  color: "#0f172a",
                  lineHeight: "1.25",
                  margin: "2px 0 8px",
                  wordBreak: "break-word",
                  padding: "0 4px",
                }}
              >
                {machineName}
              </div>

              {/* License Plate & Unit Number Badges */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  marginBottom: "8px",
                }}
              >
                {plateNumber && (
                  <span
                    style={{
                      display: "inline-block",
                      backgroundColor: "#0f172a",
                      color: "#ffffff",
                      fontFamily: "monospace",
                      fontWeight: 800,
                      fontSize: "13px",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      letterSpacing: "0.5px",
                    }}
                  >
                    PLATE: {plateNumber}
                  </span>
                )}
                {registrationNumber && (
                  <span
                    style={{
                      display: "inline-block",
                      backgroundColor: "#f1f5f9",
                      color: "#1e293b",
                      fontFamily: "monospace",
                      fontWeight: 700,
                      fontSize: "12px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    UNIT: {registrationNumber}
                  </span>
                )}
              </div>

              {/* Make / Model / Year / Serial */}
              {metaLineStr && (
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#475569",
                    marginBottom: "8px",
                    lineHeight: "1.3",
                    padding: "0 4px",
                  }}
                >
                  {metaLineStr}
                </div>
              )}

              {/* Center QR Code (Guaranteed Bitmap for HTML2Canvas & Print) */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  padding: "10px",
                  borderRadius: "12px",
                  border: "2px solid #e2e8f0",
                  display: "inline-block",
                  marginBottom: "8px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR Code"
                    style={{
                      width: "175px",
                      height: "175px",
                      display: "block",
                      margin: "0 auto",
                    }}
                  />
                ) : (
                  <QRCodeCanvas
                    id="machine-qr-canvas"
                    value={url}
                    size={175}
                    level="Q"
                    marginSize={1}
                    style={{ display: "block", margin: "0 auto" }}
                  />
                )}
              </div>

              {/* Call to Action Text */}
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  color: "#0f172a",
                  letterSpacing: "0.3px",
                  marginBottom: "2px",
                }}
              >
                Scan With Phone Camera
              </div>
              <div
                style={{
                  fontSize: "10.5px",
                  fontWeight: 500,
                  color: "#64748b",
                  lineHeight: "1.35",
                  maxWidth: "270px",
                  margin: "0 auto 8px",
                }}
              >
                Daily Inspection · Maintenance Log · Report Faults
              </div>

              {/* Footer */}
              <div
                style={{
                  borderTop: "1px solid #e2e8f0",
                  paddingTop: "6px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "9.5px",
                  fontFamily: "monospace",
                  color: "#94a3b8",
                }}
              >
                <span>TAG: {machineId.slice(0, 8).toUpperCase()}</span>
                <span style={{ fontFamily: "sans-serif", fontWeight: 600 }}>
                  MachineCare Hub
                </span>
              </div>
            </div>
          </div>

          {/* PDF Format Selector */}
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-muted-foreground font-medium">PDF Layout:</span>
            <div className="flex rounded-lg border border-border p-0.5 bg-muted/60">
              <button
                type="button"
                onClick={() => setPdfFormat("sticker")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  pdfFormat === "sticker"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sticker (100mm)
              </button>
              <button
                type="button"
                onClick={() => setPdfFormat("a4")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  pdfFormat === "a4"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                A4 Sheet with Cut Guide
              </button>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
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
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
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
