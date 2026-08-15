import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  programmeId: string;
  programmeName: string;
  selfServiceEnabled: boolean;
}

export function InductionQrDialog({ open, onOpenChange, programmeId, programmeName, selfServiceEnabled }: Props) {
  const url = `${window.location.origin}/induction/qr/${programmeId}`;

  const downloadSvg = () => {
    const svg = document.getElementById("induction-qr-svg");
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = `${programmeName.replace(/\s+/g, "-").toLowerCase()}-induction-qr.svg`;
    a.click();
    URL.revokeObjectURL(u);
  };

  const print = () => {
    const svg = document.getElementById("induction-qr-svg")?.outerHTML ?? "";
    const w = window.open("", "_blank", "width=420,height=560");
    if (!w) return;
    w.document.write(`<html><head><title>${programmeName} QR</title></head><body style="font-family:system-ui;text-align:center;padding:32px">
      <h2 style="margin:0 0 8px">${programmeName}</h2>
      <p style="color:#666;margin:0 0 24px;font-size:13px">Scan to start induction</p>
      ${svg}
      <p style="margin-top:24px;font-size:11px;color:#888;word-break:break-all">${url}</p>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR code · {programmeName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          {!selfServiceEnabled && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Turn on self-service access below before sharing this QR — scanning it won't work yet.
            </div>
          )}
          <div className="rounded-lg border border-border bg-white p-4">
            <QRCodeSVG id="induction-qr-svg" value={url} size={220} level="M" />
          </div>
          <p className="break-all text-center text-xs text-muted-foreground">{url}</p>
          <p className="text-center text-xs text-muted-foreground">Post this at the induction point. Scanning lets a new inductee start on their own phone.</p>
          <div className="flex w-full gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={downloadSvg}>
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
            <Button type="button" className="flex-1" onClick={print}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
