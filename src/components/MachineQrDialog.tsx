import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Download, Printer, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { escapeHtml } from "@/lib/escapeHtml";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machineId: string;
  machineName: string;
  qrEnabled: boolean;
  onQrEnabledChange?: (v: boolean) => void;
}

export function MachineQrDialog({ open, onOpenChange, machineId, machineName, qrEnabled, onQrEnabledChange }: Props) {
  const url = `${window.location.origin}/m/${machineId}`;
  const [toggling, setToggling] = useState(false);

  const toggleQrEnabled = async (v: boolean) => {
    setToggling(true);
    const { error } = await supabase.from("machines").update({ qr_enabled: v }).eq("id", machineId);
    setToggling(false);
    if (error) { toast.error(error.message); return; }
    onQrEnabledChange?.(v);
  };

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
    if (!w) {
      toast.error("Couldn't open the print window — check your browser's popup blocker.");
      return;
    }
    const safeName = escapeHtml(machineName);
    w.document.write(`<html><head><title>${safeName} QR</title></head><body style="font-family:system-ui;text-align:center;padding:32px">
      <h2 style="margin:0 0 8px">${safeName}</h2>
      <p style="color:#666;margin:0 0 24px;font-size:13px">Scan to log a service</p>
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
    // Fallback in case onload doesn't fire (already-loaded blank document in some browsers)
    setTimeout(doPrint, 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR code · {machineName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          {!qrEnabled && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              This QR code is revoked — scanning it currently shows "not found". Turn it back on below to re-enable it.
            </div>
          )}
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
          <div className="flex w-full items-center justify-between rounded-lg border border-border p-3">
            <span className="text-sm">QR code active</span>
            <Switch checked={qrEnabled} onCheckedChange={toggleQrEnabled} disabled={toggling} />
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            Turn off if a sticker is lost or damaged — this revokes it without deleting the machine, so you can print a fresh one.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
