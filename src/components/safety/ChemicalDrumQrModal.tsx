import React, { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Copy, Check, ExternalLink, ShieldAlert, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { GHS_MAP, PPE_ITEMS } from "@/pages/safety/ChemicalDetailPublic";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chemical: any;
}

export function ChemicalDrumQrModal({ open, onOpenChange, chemical }: Props) {
  const [copied, setCopied] = React.useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  if (!chemical) return null;

  const publicUrl = `${window.location.origin}/safety/chemical/${chemical.id}`;

  const pictograms = Array.isArray(chemical.ghs_pictograms)
    ? chemical.ghs_pictograms
    : typeof chemical.ghs_pictograms === "string"
    ? JSON.parse(chemical.ghs_pictograms || "[]")
    : [];

  const ppeList = Array.isArray(chemical.required_ppe)
    ? chemical.required_ppe
    : typeof chemical.required_ppe === "string"
    ? JSON.parse(chemical.required_ppe || "[]")
    : [];

  const isDanger = chemical.signal_word?.toLowerCase() === "danger";

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Emergency QR link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup blocker prevented printing. Please allow popups.");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GHS Drum Label - ${chemical.name}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 0;
              color: #000;
              background: #fff;
            }
            .label-border {
              border: 4px solid #000;
              padding: 16px;
              border-radius: 8px;
              max-width: 800px;
              margin: auto;
            }
            .header-banner {
              background: ${isDanger ? "#dc2626" : "#d97706"};
              color: white;
              padding: 10px 16px;
              font-weight: 900;
              font-size: 24px;
              letter-spacing: 2px;
              text-align: center;
              border-radius: 4px;
            }
            .title-area {
              margin-top: 14px;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
            }
            .chem-name {
              font-size: 28px;
              font-weight: 800;
              line-height: 1.1;
            }
            .sub-info {
              font-size: 14px;
              margin-top: 4px;
              color: #333;
            }
            .main-grid {
              display: flex;
              gap: 16px;
              margin-top: 16px;
            }
            .qr-column {
              width: 220px;
              text-align: center;
              border-right: 2px solid #ddd;
              padding-right: 16px;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .content-column {
              flex: 1;
            }
            .ghs-grid {
              display: flex;
              gap: 12px;
              flex-wrap: wrap;
              margin-bottom: 12px;
            }
            .ghs-box {
              border: 3px solid #dc2626;
              padding: 6px 12px;
              border-radius: 6px;
              font-weight: bold;
              font-size: 12px;
              text-transform: uppercase;
              background: #fef2f2;
            }
            .hazard-box {
              background: #fdf2f2;
              border-left: 4px solid #dc2626;
              padding: 8px 12px;
              font-size: 12px;
              margin-bottom: 12px;
            }
            .first-aid-box {
              border: 1px solid #999;
              padding: 10px;
              border-radius: 4px;
              font-size: 12px;
              line-height: 1.4;
            }
            .footer {
              margin-top: 16px;
              padding-top: 10px;
              border-top: 1px solid #999;
              font-size: 11px;
              display: flex;
              justify-content: space-between;
              color: #555;
            }
          </style>
        </head>
        <body>
          <div class="label-border">
            <div class="header-banner">
              SIGNAL WORD: ${chemical.signal_word?.toUpperCase() || "WARNING"}
            </div>
            <div class="title-area">
              <div class="chem-name">${chemical.name}</div>
              <div class="sub-info">
                <strong>Trade Name:</strong> ${chemical.trade_name || "N/A"} &nbsp;|&nbsp;
                <strong>CAS#:</strong> ${chemical.cas_number || "N/A"} &nbsp;|&nbsp;
                <strong>UN#:</strong> ${chemical.un_number || "N/A"} &nbsp;|&nbsp;
                <strong>Location:</strong> ${chemical.storage_location}
              </div>
            </div>
            <div class="main-grid">
              <div class="qr-column">
                <div style="font-weight:bold; font-size:12px; margin-bottom:8px; text-transform:uppercase;">
                  Scan for First-Aid & SDS
                </div>
                ${printContent.querySelector("svg")?.outerHTML || ""}
                <div style="font-size:10px; margin-top:8px; color:#666;">
                  OSHA HazCom / GHS Compliant
                </div>
                <div style="font-size:11px; font-weight:bold; margin-top:6px;">
                  Emergency: ${chemical.emergency_phone || "Contact Safety Office"}
                </div>
              </div>
              <div class="content-column">
                <div class="ghs-grid">
                  ${pictograms
                    .map(
                      (p: string) =>
                        `<div class="ghs-box">⚠️ ${GHS_MAP[p]?.label || p}</div>`
                    )
                    .join("")}
                </div>
                ${
                  chemical.hazard_statements
                    ? `<div class="hazard-box"><strong>HAZARDS:</strong> ${chemical.hazard_statements}</div>`
                    : ""
                }
                <div class="first-aid-box">
                  <strong>QUICK FIRST AID:</strong><br/>
                  • <strong>Eyes:</strong> ${chemical.first_aid_eyes || "Flush with clean water for 15 mins."}<br/>
                  • <strong>Skin:</strong> ${chemical.first_aid_skin || "Wash with soap and copious water."}<br/>
                  • <strong>Inhalation:</strong> ${chemical.first_aid_inhalation || "Move to fresh air."}
                </div>
              </div>
            </div>
            <div class="footer">
              <span>MachineCare Hub • GHS Drum Safety Label</span>
              <span>Storage Type: ${chemical.container_type || "Drum"}</span>
              <span>Printed: ${new Date().toLocaleDateString()}</span>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <ShieldAlert className="h-5 w-5 text-[#00A651]" />
            GHS Drum & Chemical Storage QR Label
          </DialogTitle>
          <DialogDescription>
            Print and affix this standardized label directly onto the chemical drum, carboy, or storage cabinet. Technicians scanning with any mobile camera will instantly view emergency first aid steps, spill response, and SDS.
          </DialogDescription>
        </DialogHeader>

        {/* Printable Card Preview */}
        <div
          ref={printRef}
          className="border-2 border-slate-900 dark:border-slate-700 rounded-xl p-5 bg-white dark:bg-slate-900 shadow-sm space-y-4"
        >
          {/* Signal word bar */}
          <div
            className={`text-center font-black py-2 rounded text-white tracking-widest text-lg ${
              isDanger ? "bg-red-600" : "bg-amber-600"
            }`}
          >
            {chemical.signal_word?.toUpperCase() || "WARNING"}
          </div>

          <div className="border-b border-border pb-3">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
              {chemical.name}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
              <span>CAS#: <strong className="text-foreground">{chemical.cas_number || "N/A"}</strong></span>
              <span>UN#: <strong className="text-foreground">{chemical.un_number || "N/A"}</strong></span>
              <span>Location: <strong className="text-foreground">{chemical.storage_location}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            {/* QR Code */}
            <div className="flex flex-col items-center justify-center p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-border">
              <QRCodeSVG value={publicUrl} size={150} level="H" includeMargin />
              <div className="text-[10px] uppercase font-bold text-muted-foreground mt-2 text-center">
                Scan with Phone Camera
              </div>
              <div className="text-[10px] font-semibold text-[#00A651] text-center">
                First Aid • Spill • SDS
              </div>
            </div>

            {/* Pictograms & Info */}
            <div className="sm:col-span-2 space-y-3">
              {pictograms.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5">
                    GHS Hazard Classes
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {pictograms.map((key: string) => {
                      const item = GHS_MAP[key];
                      return (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 text-xs font-bold border-2 border-red-600 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 px-2 py-1 rounded"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {item?.label || key}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {chemical.hazard_statements && (
                <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 p-2 rounded border border-red-200 dark:border-red-900">
                  <span className="font-bold">Hazards:</span> {chemical.hazard_statements}
                </div>
              )}

              <div className="text-xs text-muted-foreground space-y-0.5">
                <div><strong>Container:</strong> {chemical.container_type || "Drum"}</div>
                <div><strong>Emergency Hotline:</strong> {chemical.emergency_phone || "Internal Security / EHS"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5 text-xs"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Link Copied" : "Copy Emergency Link"}
          </Button>

          <div className="flex items-center gap-2">
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <ExternalLink className="h-4 w-4" /> Open Public Card
              </Button>
            </a>
            <Button
              onClick={handlePrint}
              size="sm"
              className="gap-1.5 bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-bold"
            >
              <Printer className="h-4 w-4" /> Print Drum Label
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
