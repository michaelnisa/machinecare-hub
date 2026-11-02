import { useState, useRef, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";
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

// Safely loads a remote image URL to a base64 Data URL for jsPDF & Print
async function loadImgDataUrl(
  src: string
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve({
            dataUrl: c.toDataURL("image/png"),
            width: c.width,
            height: c.height,
          });
          return;
        }
      } catch (e) {
        // Fallback if canvas is tainted
      }
      resolve(null);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
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
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

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
  const [copied, setCopied] = useState(false);
  const [pdfFormat, setPdfFormat] = useState<"sticker" | "a4">("sticker");

  const effectiveOrgName =
    initialOrgName || organisation?.name || "MachineCare Fleet";
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

  // Synchronous and guaranteed QR Data URL extractor
  const getQrDataUrl = (): string | null => {
    if (qrCanvasRef.current) {
      try {
        return qrCanvasRef.current.toDataURL("image/png");
      } catch (e) {
        console.error("Error extracting QR canvas data URL", e);
      }
    }
    const el = document.getElementById("machine-qr-canvas") as HTMLCanvasElement | null;
    return el ? el.toDataURL("image/png") : null;
  };

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

  const makeModelStr = [make, model].filter(Boolean).join(" ");
  const metaLineStr = [
    makeModelStr,
    year ? `Yr: ${year}` : null,
    serialNumber ? `S/N: ${serialNumber}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  // Pure Native Vector PDF Generation (100% Crisp Typography & Guaranteed QR Code)
  const downloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const qrData = getQrDataUrl();
      if (!qrData) {
        toast.error("QR Code canvas is initializing. Please click again.");
        return;
      }

      // Pre-load company logo if configured
      let logoObj: { dataUrl: string; width: number; height: number } | null = null;
      if (effectiveOrgLogo) {
        logoObj = await loadImgDataUrl(effectiveOrgLogo);
      }

      const isA4 = pdfFormat === "a4";
      const pdf = isA4
        ? new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
        : new jsPDF({ orientation: "portrait", unit: "mm", format: [100, 140] });

      const tagW = 100;
      const tagH = 140;
      const startX = isA4 ? (210 - tagW) / 2 : 0;
      const startY = isA4 ? (297 - tagH) / 2 - 8 : 0;

      // Draw dashed cut border on A4
      if (isA4) {
        pdf.setLineDashPattern([2, 2], 0);
        pdf.setDrawColor(148, 163, 184); // slate-400
        pdf.setLineWidth(0.3);
        pdf.rect(startX - 4, startY - 4, tagW + 8, tagH + 8);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(
          "✂ Cut along dashed guide · Affix to vehicle dashboard, windshield or equipment chassis",
          105,
          startY + tagH + 11,
          { align: "center" }
        );
        pdf.setLineDashPattern([], 0);
      }

      // 1. Tag Container Background & Heavy Slate Border
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(15, 23, 42); // slate-900
      pdf.setLineWidth(1.0);
      pdf.roundedRect(startX, startY, tagW, tagH, 4, 4, "FD");

      // 2. Top Color Stripe
      pdf.setFillColor(2, 132, 199); // sky-600
      pdf.roundedRect(startX, startY, tagW, 4.5, 4, 4, "F");
      pdf.rect(startX, startY + 2.5, tagW, 2, "F");

      let curY = startY + 8;

      // 3. Organization Header (Logo and/or Name)
      if (logoObj) {
        const aspect = logoObj.width / logoObj.height;
        const maxLogoH = 9.5;
        const maxLogoW = 38;
        let logoW = maxLogoH * aspect;
        let logoH = maxLogoH;
        if (logoW > maxLogoW) {
          logoW = maxLogoW;
          logoH = logoW / aspect;
        }
        pdf.addImage(logoObj.dataUrl, "PNG", startX + (tagW - logoW) / 2, curY, logoW, logoH);
        curY += logoH + 2.5;
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text(effectiveOrgName.toUpperCase(), startX + tagW / 2, curY, {
        align: "center",
        maxWidth: tagW - 14,
      });
      curY += 4.5;

      // Thin separator
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.3);
      pdf.line(startX + 10, curY, startX + tagW - 10, curY);
      curY += 4.5;

      // 4. Tag Classification Pill
      const catText = `OFFICIAL ASSET TAG · ${(category || "FLEET UNIT").toUpperCase()}`;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      const catWidth = pdf.getTextWidth(catText) + 8;
      pdf.setFillColor(240, 249, 255); // sky-50
      pdf.setDrawColor(186, 230, 253); // sky-200
      pdf.setLineWidth(0.3);
      pdf.roundedRect(startX + (tagW - catWidth) / 2, curY, catWidth, 5, 2.5, 2.5, "FD");
      pdf.setTextColor(2, 132, 199); // sky-600
      pdf.text(catText, startX + tagW / 2, curY + 3.5, { align: "center" });
      curY += 9;

      // 5. Machine / Vehicle Name
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13.5);
      pdf.setTextColor(15, 23, 42);
      const nameLines = pdf.splitTextToSize(machineName, tagW - 14);
      pdf.text(nameLines, startX + tagW / 2, curY, { align: "center" });
      curY += nameLines.length * 5.2 + 2;

      // 6. Plate & Unit Badges
      if (plateNumber && registrationNumber) {
        pdf.setFont("courier", "bold");
        pdf.setFontSize(10);
        const pText = `PLATE: ${plateNumber.toUpperCase()}`;
        const pW = pdf.getTextWidth(pText) + 6;

        pdf.setFont("courier", "bold");
        pdf.setFontSize(9);
        const uText = `UNIT: ${registrationNumber.toUpperCase()}`;
        const uW = pdf.getTextWidth(uText) + 6;

        const totalBadgesW = pW + uW + 4;
        if (totalBadgesW <= tagW - 14) {
          const pX = startX + (tagW - totalBadgesW) / 2;
          const uX = pX + pW + 4;

          pdf.setFillColor(15, 23, 42);
          pdf.roundedRect(pX, curY, pW, 6.2, 1.5, 1.5, "F");
          pdf.setFont("courier", "bold");
          pdf.setFontSize(10);
          pdf.setTextColor(255, 255, 255);
          pdf.text(pText, pX + pW / 2, curY + 4.4, { align: "center" });

          pdf.setFillColor(241, 245, 249);
          pdf.setDrawColor(203, 213, 225);
          pdf.setLineWidth(0.3);
          pdf.roundedRect(uX, curY, uW, 6.2, 1.5, 1.5, "FD");
          pdf.setFont("courier", "bold");
          pdf.setFontSize(9);
          pdf.setTextColor(30, 41, 59);
          pdf.text(uText, uX + uW / 2, curY + 4.4, { align: "center" });
          curY += 8.5;
        } else {
          pdf.setFillColor(15, 23, 42);
          pdf.roundedRect(startX + (tagW - pW) / 2, curY, pW, 6.2, 1.5, 1.5, "F");
          pdf.setFont("courier", "bold");
          pdf.setFontSize(10);
          pdf.setTextColor(255, 255, 255);
          pdf.text(pText, startX + tagW / 2, curY + 4.4, { align: "center" });
          curY += 7.5;

          pdf.setFillColor(241, 245, 249);
          pdf.setDrawColor(203, 213, 225);
          pdf.setLineWidth(0.3);
          pdf.roundedRect(startX + (tagW - uW) / 2, curY, uW, 5.5, 1.5, 1.5, "FD");
          pdf.setFont("courier", "bold");
          pdf.setFontSize(9);
          pdf.setTextColor(30, 41, 59);
          pdf.text(uText, startX + tagW / 2, curY + 4.0, { align: "center" });
          curY += 7.5;
        }
      } else if (plateNumber) {
        pdf.setFont("courier", "bold");
        pdf.setFontSize(10.5);
        const pText = `PLATE: ${plateNumber.toUpperCase()}`;
        const pW = pdf.getTextWidth(pText) + 7;
        pdf.setFillColor(15, 23, 42);
        pdf.roundedRect(startX + (tagW - pW) / 2, curY, pW, 6.5, 1.5, 1.5, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.text(pText, startX + tagW / 2, curY + 4.7, { align: "center" });
        curY += 8.5;
      } else if (registrationNumber) {
        pdf.setFont("courier", "bold");
        pdf.setFontSize(9.5);
        const uText = `UNIT: ${registrationNumber.toUpperCase()}`;
        const uW = pdf.getTextWidth(uText) + 6;
        pdf.setFillColor(241, 245, 249);
        pdf.setDrawColor(203, 213, 225);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(startX + (tagW - uW) / 2, curY, uW, 5.8, 1.5, 1.5, "FD");
        pdf.setTextColor(30, 41, 59);
        pdf.text(uText, startX + tagW / 2, curY + 4.2, { align: "center" });
        curY += 8;
      }

      // 7. Make / Model / Year / S/N
      if (metaLineStr) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(71, 85, 105);
        pdf.text(metaLineStr, startX + tagW / 2, curY, {
          align: "center",
          maxWidth: tagW - 14,
        });
        curY += 4.5;
      }

      // 8. Center QR Code (Guaranteed High-Res Image)
      const qrSizeMm = 45;
      const qrBoxX = startX + (tagW - (qrSizeMm + 4)) / 2;
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.4);
      pdf.roundedRect(qrBoxX, curY, qrSizeMm + 4, qrSizeMm + 4, 3, 3, "FD");
      pdf.addImage(qrData, "PNG", qrBoxX + 2, curY + 2, qrSizeMm, qrSizeMm);
      curY += qrSizeMm + 7;

      // 9. Scan Action Text
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text("SCAN WITH PHONE CAMERA", startX + tagW / 2, curY, { align: "center" });
      curY += 3.8;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(100, 116, 139);
      pdf.text("Daily Inspection · Maintenance Log · Report Faults", startX + tagW / 2, curY, {
        align: "center",
      });
      curY += 4.5;

      // 10. Tag Footer
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.3);
      pdf.line(startX + 8, curY, startX + tagW - 8, curY);
      curY += 3.5;

      pdf.setFont("courier", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`TAG: ${machineId.slice(0, 8).toUpperCase()}`, startX + 8, curY);

      pdf.setFont("helvetica", "bold");
      pdf.text("MachineCare Hub", startX + tagW - 8, curY, { align: "right" });

      const fname = `${safeFilename}${plateNumber ? `_${plateNumber.replace(/\s+/g, "")}` : ""}-qr-tag${isA4 ? "-a4" : ""}.pdf`;
      pdf.save(fname);
      toast.success("Asset Tag PDF downloaded successfully");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Download high-resolution PNG
  const downloadPng = () => {
    const qrData = getQrDataUrl();
    if (!qrData) {
      toast.error("QR Code image is not ready. Please try again.");
      return;
    }
    const a = document.createElement("a");
    a.href = qrData;
    a.download = `${safeFilename}${plateNumber ? `_${plateNumber.replace(/\s+/g, "")}` : ""}-qr-code.png`;
    a.click();
    toast.success("QR Code saved as PNG");
  };

  // Print function
  const print = () => {
    const qrData = getQrDataUrl();
    if (!qrData) {
      toast.error("QR Code is not ready yet. Please try again.");
      return;
    }

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
    const logoSrc = effectiveOrgLogo ? escapeHtml(effectiveOrgLogo) : "";

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
      max-height: 40px;
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
            ? `<img class="org-logo" src="${logoSrc}" alt="${safeOrg}" onerror="this.style.display='none'" />`
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
        <img class="qr-img" src="${qrData}" alt="QR Code" />
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

        <div className="space-y-3.5 py-1">
          {!qrEnabled && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>This QR code is currently inactive.</strong> Scanning it will display a &quot;Revoked&quot; status. Switch it back on below to activate.
              </span>
            </div>
          )}

          {/* Clean Visual Preview Card */}
          <div className="flex justify-center p-2.5 bg-muted/40 rounded-xl border border-dashed border-border/80">
            <div
              className="w-full max-w-[340px] bg-white text-slate-900 rounded-2xl border-2 border-slate-900 shadow-md p-4 text-center relative overflow-hidden select-none"
              style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
            >
              {/* Top Accent Stripe */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-sky-600" />

              {/* Company Logo and Header */}
              <div className="flex items-center justify-center gap-2 pt-1 pb-2 border-b border-slate-200 mb-2.5 min-h-[42px]">
                {effectiveOrgLogo ? (
                  <img
                    src={effectiveOrgLogo}
                    alt={effectiveOrgName}
                    crossOrigin="anonymous"
                    className="max-h-9 max-w-[130px] object-contain inline-block"
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
                <span className="text-[13px] font-extrabold uppercase tracking-tight text-slate-800">
                  {effectiveOrgName}
                </span>
              </div>

              {/* Tag Classification Badge */}
              <div className="inline-block text-[10px] font-extrabold uppercase text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200 mb-1.5">
                <ShieldCheck className="h-3 w-3 inline mr-1 text-sky-600" />
                OFFICIAL ASSET TAG · {category || "FLEET UNIT"}
              </div>

              {/* Machine / Vehicle Name */}
              <h3 className="text-lg font-black text-slate-900 leading-snug px-1 mb-2 break-words">
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
              {metaLineStr && (
                <p className="text-[11px] text-slate-600 font-semibold mb-2 px-1">
                  {metaLineStr}
                </p>
              )}

              {/* Center QR Code Canvas */}
              <div className="inline-block p-2 bg-white rounded-xl border-2 border-slate-200 shadow-sm mb-2">
                <QRCodeCanvas
                  id="machine-qr-canvas"
                  ref={qrCanvasRef}
                  value={url}
                  size={360}
                  level="Q"
                  marginSize={1}
                  style={{
                    width: "170px",
                    height: "170px",
                    display: "block",
                    margin: "0 auto",
                  }}
                />
              </div>

              {/* Call to Action Text */}
              <p className="text-xs font-black uppercase text-slate-900 tracking-wide mb-0.5">
                Scan With Phone Camera
              </p>
              <p className="text-[10.5px] text-slate-500 font-medium leading-tight max-w-[260px] mx-auto mb-2">
                Daily Inspection · Maintenance Log · Report Faults
              </p>

              {/* Footer */}
              <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-[9.5px] text-slate-400 font-mono">
                <span>TAG: {machineId.slice(0, 8).toUpperCase()}</span>
                <span className="font-sans font-semibold text-[9px]">MachineCare Hub</span>
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
            >
              <Download className="h-3.5 w-3.5" />
              Save Image (PNG)
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
