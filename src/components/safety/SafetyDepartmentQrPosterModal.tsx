import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  QrCode,
  Printer,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  PhoneCall,
  Flame,
  Heart,
  AlertTriangle,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SafetyDepartmentQrPosterModal({ open, onOpenChange }: Props) {
  const { organisation } = useAuth();
  const [copied, setCopied] = useState(false);

  // Construct full public URL for official Safety Department Gateway
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://machinecarehub.com";
  const publicUrl = `${origin}/safety/gateway${
    organisation?.id ? `?org=${organisation.id}` : ""
  }`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(
    publicUrl
  )}&bgcolor=ffffff&color=00A651&qzone=2`;

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Safety Gateway link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-[#00A651] dark:text-emerald-400 flex items-center justify-center font-bold">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Safety Department Official QR Poster
              </DialogTitle>
              <DialogDescription className="text-xs">
                Print & display at site gates, workshop muster points, and reception.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 print:p-0">
          {/* Printable Flyer Preview */}
          <div
            id="safety-qr-printable"
            className="rounded-2xl border-2 border-[#00A651]/40 bg-gradient-to-b from-emerald-50/60 via-white to-emerald-50/20 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 p-6 text-center space-y-4 shadow-md"
          >
            <div className="flex items-center justify-center gap-2 text-[#00A651] dark:text-emerald-400 text-xs font-black uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4 text-[#00A651]" /> {organisation?.name ?? "MachineCare"} EHS & Safety Care
            </div>

            <h3 className="text-lg font-black text-foreground uppercase tracking-tight">
              Safety Care & Incident Portal
            </h3>

            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Scan with your smartphone camera to immediately report hazards/accidents or log in for Contractor Toolbox Talks.
            </p>

            {/* QR Code Container */}
            <div className="flex justify-center py-2">
              <div className="p-3 bg-white rounded-2xl shadow-lg border-2 border-emerald-500/30 inline-block">
                <img
                  src={qrImageUrl}
                  alt="Official Safety Department QR Code"
                  className="w-48 h-48 rounded-lg object-contain"
                />
              </div>
            </div>

            {/* Emergency Hotline Info */}
            <div className="grid grid-cols-2 gap-2 text-left pt-1">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#00A651] uppercase tracking-wider">
                  <PhoneCall className="h-3 w-3" /> Safety Officer
                </div>
                <div className="text-xs font-semibold text-foreground mt-0.5">
                  {(organisation as any)?.safety_emergency_phone || "Radio Ch 1 / Security Gate"}
                </div>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 uppercase tracking-wider">
                  <Heart className="h-3 w-3" /> First Aid Post
                </div>
                <div className="text-xs font-semibold text-foreground mt-0.5">
                  {(organisation as any)?.safety_first_aid_phone || "Extension 999 / Clinic"}
                </div>
              </div>
            </div>

            <div className="text-[11px] font-mono text-muted-foreground bg-muted/50 py-1.5 px-3 rounded-lg border border-border inline-block break-all">
              {publicUrl}
            </div>
          </div>

          {/* Quick Copy Link Input */}
          <div className="flex gap-2">
            <Input
              readOnly
              value={publicUrl}
              className="text-xs font-mono bg-muted/30 h-9"
            />
            <Button
              size="sm"
              onClick={copyLink}
              variant="outline"
              className="h-9 px-3 border-emerald-600/30 text-[#00A651]"
            >
              {copied ? (
                <Check className="h-4 w-4 text-[#00A651]" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
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
            <ExternalLink className="h-3.5 w-3.5" /> Preview Portal
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handlePrint}
            className="text-xs gap-1.5 bg-[#00A651] hover:bg-[#008f45] text-white"
          >
            <Printer className="h-3.5 w-3.5" /> Print A4 Poster
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
