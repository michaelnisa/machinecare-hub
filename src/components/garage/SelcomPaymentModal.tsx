import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  CheckCircle2,
  Loader2,
  AlertCircle,
  QrCode,
  ShieldCheck,
  RefreshCw,
  Copy,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  createSelcomOrder,
  checkSelcomOrderStatus,
  simulateSelcomApproval,
  detectCarrier,
  CARRIER_INFO,
  CarrierNetwork,
} from "@/services/selcomService";

interface SelcomPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId?: string;
  invoiceNumber?: string;
  jobId?: string;
  amount: number;
  customerPhone?: string;
  customerName?: string;
  onSuccess: () => void;
}

export function SelcomPaymentModal({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  jobId,
  amount,
  customerPhone = "",
  customerName = "",
  onSuccess,
}: SelcomPaymentModalProps) {
  const { organisation, profile } = useAuth();

  const [phone, setPhone] = useState(customerPhone);
  const [payAmount, setPayAmount] = useState(amount);
  const [mode, setMode] = useState<"ussd" | "qr">("ussd");

  const [status, setStatus] = useState<"idle" | "dispatching" | "waiting" | "completed" | "failed">("idle");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(60);
  const [simulating, setSimulating] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open) {
      setPhone(customerPhone || "");
      setPayAmount(amount);
      setStatus("idle");
      setOrderId(null);
      setStatusMessage("");
      setCountdown(60);
    } else {
      clearTimers();
    }
    return () => clearTimers();
  }, [open, customerPhone, amount]);

  const clearTimers = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    pollIntervalRef.current = null;
    countdownIntervalRef.current = null;
  };

  const detectedCarrier: CarrierNetwork = detectCarrier(phone);
  const carrierDetails = CARRIER_INFO[detectedCarrier];

  const handleSendUSSDPush = async () => {
    if (!organisation?.id) {
      toast.error("Organisation not found");
      return;
    }
    if (!phone.trim()) {
      toast.error("Please enter a valid mobile number");
      return;
    }
    if (payAmount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }

    setStatus("dispatching");
    setStatusMessage("Connecting to Selcom Gateway...");

    try {
      const res = await createSelcomOrder({
        organisation_id: organisation.id,
        invoice_id: invoiceId,
        job_id: jobId,
        amount: payAmount,
        phone_number: phone,
        customer_name: customerName,
        initiated_by: profile?.id,
      });

      if (!res.success || !res.order_id) {
        setStatus("failed");
        setStatusMessage(res.error || "Failed to dispatch USSD prompt. Please try again.");
        toast.error(res.error || "Payment dispatch failed");
        return;
      }

      setOrderId(res.order_id);
      setStatus("waiting");
      setStatusMessage(res.message || `USSD prompt sent to ${res.phone_number}. Awaiting PIN entry...`);
      toast.success("Payment prompt dispatched!");

      // Start 60s countdown
      setCountdown(60);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearTimers();
            setStatus("failed");
            setStatusMessage("Payment prompt timed out. Please retry if not received.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Start polling every 3 seconds
      pollIntervalRef.current = setInterval(async () => {
        if (!res.order_id) return;
        const check = await checkSelcomOrderStatus(res.order_id);
        if (check.status === "completed") {
          clearTimers();
          setStatus("completed");
          setStatusMessage("Payment received and verified successfully!");
          toast.success("Payment confirmed!");
          setTimeout(() => {
            onSuccess();
            onOpenChange(false);
          }, 1600);
        } else if (check.status === "failed" || check.status === "cancelled") {
          clearTimers();
          setStatus("failed");
          setStatusMessage("Transaction failed or was cancelled on phone.");
        }
      }, 3000);
    } catch (err: any) {
      setStatus("failed");
      setStatusMessage(err.message || "Failed to initiate payment");
      toast.error("Error initiating payment");
    }
  };

  const handleSimulateUserPIN = async () => {
    if (!orderId) return;
    setSimulating(true);
    try {
      const success = await simulateSelcomApproval(orderId);
      if (success) {
        clearTimers();
        setStatus("completed");
        setStatusMessage("Customer approved PIN on phone. Payment posted to ledger!");
        toast.success("Payment confirmed!");
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
        }, 1500);
      } else {
        toast.error("Simulation failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Simulation error");
    } finally {
      setSimulating(false);
    }
  };

  const copyPayDetails = () => {
    navigator.clipboard.writeText(`MachineCare Hub Payment: TZS ${payAmount.toLocaleString()} via Selcom`);
    toast.success("Payment details copied to clipboard");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Selcom Pay / Mobile Money</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Collect instant digital payment via M-Pesa, Tigo Pesa, Airtel Money, or Halopesa
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Invoice & Summary Banner */}
        <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Reference / Invoice:</span>
            <span className="font-semibold text-foreground">{invoiceNumber || "Direct Counter Order"}</span>
          </div>
          {customerName && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Customer:</span>
              <span className="text-foreground">{customerName}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm pt-1 border-t">
            <span className="font-medium text-foreground">Total Amount:</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              TZS {payAmount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Mode switcher tabs */}
        <div className="flex rounded-md bg-muted p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode("ussd")}
            className={`flex-1 py-1.5 rounded text-center font-medium transition-colors ${
              mode === "ussd" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Smartphone className="inline h-3.5 w-3.5 mr-1.5" />
            Mobile Money USSD Push
          </button>
          <button
            type="button"
            onClick={() => setMode("qr")}
            className={`flex-1 py-1.5 rounded text-center font-medium transition-colors ${
              mode === "qr" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <QrCode className="inline h-3.5 w-3.5 mr-1.5" />
            Selcom QR / Link
          </button>
        </div>

        {/* USSD PUSH MODE */}
        {mode === "ussd" && (
          <div className="space-y-4 py-1">
            {status === "idle" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Customer Mobile Phone (Tanzania)</Label>
                  <div className="relative">
                    <Input
                      placeholder="e.g. 0754123456 or 255754123456"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pr-28 font-mono text-sm"
                    />
                    <div className="absolute right-2.5 top-2.5">
                      <Badge variant="outline" className={`text-[10px] font-normal px-2 ${carrierDetails.bg} ${carrierDetails.color}`}>
                        {carrierDetails.name}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    A USSD prompt will pop up on the customer&apos;s phone asking for their mobile money PIN.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Amount to Collect (TZS)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            )}

            {status === "dispatching" && (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                <div>
                  <p className="font-medium text-sm">Dispatched request to Selcom Gateway...</p>
                  <p className="text-xs text-muted-foreground mt-1">Connecting to {carrierDetails.name} network</p>
                </div>
              </div>
            )}

            {status === "waiting" && (
              <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-pulse">
                    <Smartphone className="h-8 w-8" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white shadow">
                    {countdown}s
                  </span>
                </div>

                <div className="space-y-1 max-w-sm">
                  <p className="font-semibold text-sm">Prompt Sent to {phone}</p>
                  <p className="text-xs text-muted-foreground">{statusMessage}</p>
                  <p className="text-[11px] text-muted-foreground pt-1">
                    Please ask customer to check their screen and enter their PIN.
                  </p>
                </div>

                {/* Sandbox / Demo Simulation Button */}
                <div className="pt-2 border-t w-full flex flex-col items-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs border-dashed border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    onClick={handleSimulateUserPIN}
                    disabled={simulating}
                  >
                    {simulating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                    Simulate Customer Entering PIN (Sandbox)
                  </Button>
                  <span className="text-[10px] text-muted-foreground mt-1">
                    Click to instantly simulate customer approving on M-Pesa / Tigo
                  </span>
                </div>
              </div>
            )}

            {status === "completed" && (
              <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400 animate-bounce" />
                </div>
                <div>
                  <h4 className="font-semibold text-base text-emerald-700 dark:text-emerald-400">Payment Confirmed!</h4>
                  <p className="text-xs text-muted-foreground mt-1">{statusMessage}</p>
                  <p className="text-[11px] font-mono text-muted-foreground mt-2">
                    Order ID: {orderId}
                  </p>
                </div>
              </div>
            )}

            {status === "failed" && (
              <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
                <div className="h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400">
                  <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-red-700 dark:text-red-400">Payment Unsuccessful</h4>
                  <p className="text-xs text-muted-foreground mt-1">{statusMessage}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setStatus("idle")} className="mt-2 text-xs">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try Again
                </Button>
              </div>
            )}
          </div>
        )}

        {/* QR & LINK MODE */}
        {mode === "qr" && (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto w-48 h-48 rounded-lg border-2 border-dashed flex flex-col items-center justify-center bg-white p-2">
              {/* Dynamic visual representation of Selcom QR code */}
              <div className="w-full h-full bg-slate-900 rounded flex flex-col items-center justify-center p-3 text-white text-center">
                <QrCode className="h-20 w-20 text-emerald-400 mb-2" />
                <span className="text-[11px] font-bold tracking-wider text-emerald-300">SELCOM PAY</span>
                <span className="text-[9px] text-slate-300 font-mono">SCAN TO PAY TZS {payAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium">Scan using any Banking or Mobile Money App</p>
              <p className="text-[11px] text-muted-foreground">
                Supported: M-Pesa, Mixx by Yas, Airtel, Halopesa, CRDB SimBanking, NMB Mkononi
              </p>
            </div>

            <div className="flex justify-center gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={copyPayDetails} className="text-xs">
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Details
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => toast.info("Opening Selcom Hosted Checkout page...")}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open Checkout Link
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-3 border-t">
          <div className="flex items-center text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" />
            <span>256-bit Encrypted Selcom Gateway</span>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={status === "dispatching"}
            >
              {status === "completed" ? "Close" : "Cancel"}
            </Button>
            {mode === "ussd" && status === "idle" && (
              <Button
                size="sm"
                onClick={handleSendUSSDPush}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Smartphone className="h-3.5 w-3.5 mr-1.5" />
                Send USSD Prompt
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
