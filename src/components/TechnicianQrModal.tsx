/**
 * MachineCare Platform - Technician Mobile QR Fast Action Mode
 * Field-optimized, touch-friendly QR scanner and fast-action sheet
 * for shop floor operators, mechanics, and maintenance technicians.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  QrCode,
  Wrench,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ClipboardList,
  Plus,
  Loader2,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface TechnicianQrModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TechnicianQrModal({ open, onOpenChange }: TechnicianQrModalProps) {
  const navigate = useNavigate();
  const { organisation, user } = useAuth();

  const [code, setCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [machines, setMachines] = useState<{ id: string; name: string; category?: string; status: string; current_hours?: number }[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<any | null>(null);

  // Meter Reading Fast Input
  const [readingValue, setReadingValue] = useState("");
  const [savingReading, setSavingReading] = useState(false);

  // Load sample or recent machines
  useEffect(() => {
    if (!organisation?.id || !open) return;
    supabase
      .from("machines")
      .select("id, name, category, status, current_hours")
      .eq("organisation_id", organisation.id)
      .limit(6)
      .then(({ data }) => {
        if (data) setMachines(data);
      });
  }, [organisation?.id, open]);

  const handleSearch = async (targetCode?: string) => {
    const q = (targetCode ?? code).trim();
    if (!q || !organisation?.id) return;

    setSearching(true);
    const { data } = await supabase
      .from("machines")
      .select("id, name, category, status, current_hours, make, model")
      .eq("organisation_id", organisation.id)
      .or(`name.ilike.%${q}%,id.eq.${q}`)
      .limit(1)
      .maybeSingle();

    setSearching(false);

    if (data) {
      setSelectedMachine(data);
      setReadingValue(String(data.current_hours ?? ""));
    } else {
      toast.error(`No asset found matching "${q}"`);
    }
  };

  const handleSaveReading = async () => {
    if (!selectedMachine || !readingValue || !organisation?.id) return;
    const num = parseFloat(readingValue);
    if (isNaN(num)) return toast.error("Please enter a valid numeric reading");

    setSavingReading(true);
    try {
      // 1. Insert meter reading
      await supabase.from("meter_readings").insert({
        organisation_id: organisation.id,
        machine_id: selectedMachine.id,
        reading: num,
        reading_date: new Date().toISOString(),
        created_by: user?.id,
      });

      // 2. Update machine current_hours
      await supabase
        .from("machines")
        .update({ current_hours: num })
        .eq("id", selectedMachine.id);

      setSelectedMachine((prev: any) => ({ ...prev, current_hours: num }));
      toast.success(`Recorded ${num} hours on ${selectedMachine.name}`);
      setSavingReading(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to record reading");
      setSavingReading(false);
    }
  };

  const resetSelection = () => {
    setSelectedMachine(null);
    setCode("");
    setReadingValue("");
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { onOpenChange(val); if (!val) resetSelection(); }}>
      <DialogContent className="sm:max-w-lg p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Technician Fast Action Mode</DialogTitle>
              <DialogDescription>
                Scan asset QR tag or enter machine identifier for rapid floor actions.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!selectedMachine ? (
          <div className="space-y-4 py-2">
            {/* Quick Code Lookup */}
            <div className="space-y-1.5">
              <Label htmlFor="tech-qr-input">Asset Code / Name / Plate</Label>
              <div className="flex gap-2">
                <Input
                  id="tech-qr-input"
                  placeholder="e.g. CNC, Compressor, or ID..."
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  autoFocus
                />
                <Button onClick={() => handleSearch()} disabled={searching || !code.trim()}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Quick Select Grid */}
            {machines.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Quick Select Equipment
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {machines.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedMachine(m);
                        setReadingValue(String(m.current_hours ?? ""));
                      }}
                      className="flex items-center justify-between rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/60"
                    >
                      <div className="truncate pr-2">
                        <div className="text-sm font-semibold truncate">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.category || "Asset"} · {m.current_hours ?? 0}h</div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          m.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }
                      >
                        {m.status}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* FAST ACTION SHEET FOR SCANNED ASSET */
          <div className="space-y-5 py-2">
            {/* Asset Header Card */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{selectedMachine.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[selectedMachine.make, selectedMachine.model].filter(Boolean).join(" · ") || selectedMachine.category || "Industrial Asset"}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    selectedMachine.status === "active"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs px-2.5 py-0.5"
                      : "bg-amber-50 text-amber-700 border-amber-200 text-xs px-2.5 py-0.5"
                  }
                >
                  {selectedMachine.status}
                </Badge>
              </div>

              <div className="mt-3 flex items-center gap-4 text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Current: <strong className="text-foreground">{selectedMachine.current_hours ?? 0} hrs</strong>
                </span>
                <button
                  type="button"
                  onClick={resetSelection}
                  className="text-primary hover:underline ml-auto text-xs"
                >
                  Change Asset
                </button>
              </div>
            </div>

            {/* Quick 1-Tap Action 1: Meter Reading */}
            <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-primary" />
                1-Tap Meter Reading
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Operating Hours"
                  value={readingValue}
                  onChange={(e) => setReadingValue(e.target.value)}
                  className="font-mono"
                />
                <Button
                  size="sm"
                  onClick={handleSaveReading}
                  disabled={savingReading || !readingValue}
                  className="bg-primary text-primary-foreground shrink-0"
                >
                  {savingReading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Reading"}
                </Button>
              </div>
            </div>

            {/* Fast Floor Action Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                variant="outline"
                className="h-auto flex flex-col items-start p-3 gap-1 hover:border-primary hover:bg-primary/5"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/work-orders/new?machine_id=${selectedMachine.id}&work_type=corrective`);
                }}
              >
                <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Report Fault
                </div>
                <span className="text-[11px] text-muted-foreground text-left">Log machine breakdown or issue</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto flex flex-col items-start p-3 gap-1 hover:border-primary hover:bg-primary/5"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/m/${selectedMachine.id}/inspect`);
                }}
              >
                <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Pre-Start Check
                </div>
                <span className="text-[11px] text-muted-foreground text-left">Run daily safety checklist</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto flex flex-col items-start p-3 gap-1 hover:border-primary hover:bg-primary/5"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/work-orders?machine_id=${selectedMachine.id}`);
                }}
              >
                <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                  <ClipboardList className="h-4 w-4 text-sky-500" />
                  Work Orders
                </div>
                <span className="text-[11px] text-muted-foreground text-left">View active jobs for asset</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto flex flex-col items-start p-3 gap-1 hover:border-primary hover:bg-primary/5"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/machines/${selectedMachine.id}`);
                }}
              >
                <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                  <Wrench className="h-4 w-4 text-purple-500" />
                  Full Asset Card
                </div>
                <span className="text-[11px] text-muted-foreground text-left">Docs, parts, knowledge base</span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
