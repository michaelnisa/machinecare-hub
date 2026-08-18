import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, Copy } from "lucide-react";
import { toast } from "sonner";
import { escapeHtml } from "@/lib/escapeHtml";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  jobId: string;
  jobLabel: string;
}

export function GarageJobStatusQrDialog({ open, onOpenChange, jobId, jobLabel }: Props) {
  const url = `${window.location.origin}/g/${jobId}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy — copy the link manually");
    }
  };

  const downloadSvg = () => {
    const svg = document.getElementById("garage-status-qr-svg");
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = `${jobLabel.toLowerCase()}-status-qr.svg`;
    a.click();
    URL.revokeObjectURL(u);
  };

  const print = () => {
    const svg = document.getElementById("garage-status-qr-svg")?.outerHTML ?? "";
    const w = window.open("", "_blank", "width=420,height=560");
    if (!w) {
      toast.error("Couldn't open the print window — check your browser's popup blocker.");
      return;
    }
    const safeLabel = escapeHtml(jobLabel);
    w.document.write(`<html><head><title>${safeLabel} status</title></head><body style="font-family:system-ui;text-align:center;padding:32px">
      <h2 style="margin:0 0 8px">${safeLabel}</h2>
      <p style="color:#666;margin:0 0 24px;font-size:13px">Scan to check your repair status</p>
      ${svg}
      <p style="margin-top:24px;font-size:11px;color:#888;word-break:break-all">${escapeHtml(url)}</p>
    </body></html>`);
    w.document.close();
    let printed = false;
    const doPrint = () => {
      if (printed) return;
      printed = true;
      w.print();
    };
    w.onload = doPrint;
    setTimeout(doPrint, 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Status link · {jobLabel}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-lg border border-border bg-white p-4">
            <QRCodeSVG id="garage-status-qr-svg" value={url} size={220} level="M" />
          </div>
          <p className="break-all text-center text-xs text-muted-foreground">{url}</p>
          <p className="text-center text-xs text-muted-foreground">Share this with the customer — no login needed. They'll see live status, and the estimate/invoice total once issued.</p>
          <div className="flex w-full gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={copyLink}>
              <Copy className="mr-2 h-4 w-4" /> Copy link
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={downloadSvg}>
              <Download className="mr-2 h-4 w-4" /> QR
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
