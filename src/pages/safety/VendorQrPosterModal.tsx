import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { QrCode, Printer, Copy, Check, ExternalLink, ShieldCheck, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VendorQrPosterModal({ open, onOpenChange }: Props) {
  const { organisation } = useAuth();
  const [copied, setCopied] = useState(false);

  // Construct full public URL for vendor risk assessment
  const origin = typeof window !== "undefined" ? window.location.origin : "https://machinecare.app";
  const publicUrl = `${origin}/safety/qr-rams${organisation?.id ? `?org=${organisation.id}` : ""}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicUrl)}&bgcolor=ffffff&color=065f46&qzone=2`;

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Public link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Contractor QR Code Gate Poster</DialogTitle>
              <DialogDescription className="text-xs">
                Display at site entrances, security gates, and workshop reception.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Printable Flyer Preview */}
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-50/50 to-white dark:from-slate-900 dark:to-slate-950 p-6 text-center space-y-4 shadow-sm">
            <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4" /> {organisation?.name ?? "MachineCare"} Safety Care
            </div>

            <h3 className="text-base font-black text-foreground uppercase tracking-tight">
              Contractor & Vendor Safety Entry
            </h3>

            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Scan with your mobile camera to complete digital Job Safety Analysis (JSA / RAMS) before commencing work.
            </p>

            {/* QR Code Container */}
            <div className="flex justify-center py-2">
              <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200 inline-block">
                <img
                  src={qrImageUrl}
                  alt="Contractor Safety Assessment QR Code"
                  className="w-48 h-48 rounded-lg object-contain"
                />
              </div>
            </div>

            <div className="text-[11px] font-mono text-muted-foreground bg-muted/40 py-1.5 px-3 rounded-lg border border-border inline-block">
              {publicUrl}
            </div>
          </div>

          {/* Quick Copy Link Input */}
          <div className="flex gap-2">
            <Input readOnly value={publicUrl} className="text-xs font-mono bg-muted/30 h-9" />
            <Button size="sm" onClick={copyLink} variant="outline" className="h-9 px-3">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <DialogFooter className="flex-row sm:justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.open(publicUrl, "_blank")}
            className="text-xs gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Preview Form
          </Button>

          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="button" size="sm" onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Print Poster
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
