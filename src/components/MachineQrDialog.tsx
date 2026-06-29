import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machineId: string;
  machineName: string;
}

export function MachineQrDialog({ open, onOpenChange, machineId, machineName }: Props) {
  const url = `${window.location.origin}/m/${machineId}`;

  const downloadSvg = () => {
    const svg = document.getElementById("machine-qr-svg");
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = `${machineName.replace(/\s+/g, "-").toLowerCase()}-qr.svg`;
    a.click();
    URL.revokeObjectURL(u);
  };

  const print = () => {
    const svg = document.getElementById("machine-qr-svg")?.outerHTML ?? "";
    const w = window.open("", "_blank", "width=420,height=560");
    if (!w) return;
    w.document.write(`<html><head><title>${machineName} QR</title></head><body style="font-family:system-ui;text-align:center;padding:32px">
      <h2 style="margin:0 0 8px">${machineName}</h2>
      <p style="color:#666;margin:0 0 24px;font-size:13px">Scan to log a service</p>
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
          <DialogTitle>QR code · {machineName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-lg border border-border bg-white p-4">
            <QRCodeSVG id="machine-qr-svg" value={url} size={220} level="M" />
          </div>
          <p className="break-all text-center text-xs text-muted-foreground">{url}</p>
          <p className="text-center text-xs text-muted-foreground">Stick this on the machine. Scanning opens a mobile log-service page.</p>
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
