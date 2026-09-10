/**
 * MachineCare Platform - Demo Data Loader Modal
 * Empowers prospective customers and trial accounts to evaluate MachineCare
 * with 1-click realistic operational datasets.
 */

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
import { Sparkles, Trash2, CheckCircle2, Loader2, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { demoDataService } from "@/services/demoDataService";
import { toast } from "sonner";

interface DemoDataLoaderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDataChanged?: () => void;
}

export function DemoDataLoaderModal({
  open,
  onOpenChange,
  onDataChanged,
}: DemoDataLoaderModalProps) {
  const { organisation, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);

  const orgId = organisation?.id || profile?.organisation_id;

  const handleLoad = async () => {
    if (!orgId) {
      toast.error("No active organization found");
      return;
    }

    setLoading(true);
    const res = await demoDataService.loadDemoDataset(orgId);
    setLoading(false);

    if (res.success) {
      toast.success(res.message);
      onOpenChange(false);
      onDataChanged?.();
    } else {
      toast.error(res.message);
    }
  };

  const handleClear = async () => {
    if (!orgId) return;

    setClearing(true);
    const res = await demoDataService.clearDemoDataset(orgId);
    setClearing(false);

    if (res.success) {
      toast.success(res.message);
      onOpenChange(false);
      onDataChanged?.();
    } else {
      toast.error(res.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-amber-100 p-2 text-amber-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Sample Operational Data</DialogTitle>
              <DialogDescription>
                Populate sample records to test and evaluate MachineCare immediately.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-3 text-sm">
          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
            <div className="font-semibold text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              What will be populated:
            </div>
            <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
              <li>3 Industrial Machines & 2 Work Orders</li>
              <li>2 Spare Parts in Stock with Received Status</li>
              <li>3 Safety Incidents, Hazards & Near-Misses</li>
              <li>3 RAMS Risk Assessments (Electrical, Confined Space, Heights)</li>
              <li>2 Corrective Actions (CAPA) with Target Due Dates</li>
              <li>3 Safety Equipment Assets (Extinguishers, Eyewash, First Aid)</li>
              <li>2 Calibrated & Controlled Tools (Gas Detector, Torque Wrench)</li>
              <li>2 Hazardous Chemicals (COSHH) with GHS Hazard Pictograms</li>
              <li>Golden Safety Rules, PPE Matrix & Certified Contractors</li>
            </ul>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-sky-50 border border-sky-200 p-3 text-xs text-sky-800">
            <Info className="h-4 w-4 shrink-0 text-sky-600 mt-0.5" />
            <span>
              All demo items are tagged with <strong>[DEMO]</strong> and can be wiped with one click whenever you're ready to use real data.
            </span>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={clearing || loading}
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
          >
            {clearing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
            Clear Demo Data
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleLoad}
              disabled={loading || clearing}
              className="bg-primary text-primary-foreground"
            >
              {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
              Load Sample Data
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
