import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, CheckCircle2, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { formatJobNumber } from "@/lib/garage-constants";

interface QualityControlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: any;
  onQCPassed: () => void;
}

export function QualityControlDialog({
  open,
  onOpenChange,
  job,
  onQCPassed,
}: QualityControlDialogProps) {
  const { profile, user, organisation } = useAuth();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    fluids_checked: true,
    wheel_nuts_torqued: true,
    dtc_codes_cleared: true,
    road_test_passed: true,
    old_parts_retained: false,
    vehicle_cleaned: true,
    inspector_name: profile?.full_name || "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        fluids_checked: true,
        wheel_nuts_torqued: true,
        dtc_codes_cleared: true,
        road_test_passed: true,
        old_parts_retained: false,
        vehicle_cleaned: true,
        inspector_name: profile?.full_name || "",
        notes: "",
      });
    }
  }, [open, profile?.full_name]);

  const toggle = (key: string) => {
    setForm((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSignOff = async () => {
    if (!form.inspector_name.trim()) {
      return toast.error("Inspector name is required for QC sign-off");
    }

    const orgId = organisation?.id || profile?.organisation_id || job.organisation_id;
    setSaving(true);

    try {
      // 1. Save QC record
      const { error: qcErr } = await (supabase as any).from("garage_job_qc_checks").insert({
        organisation_id: orgId,
        job_id: job.id,
        fluids_checked: form.fluids_checked,
        wheel_nuts_torqued: form.wheel_nuts_torqued,
        dtc_codes_cleared: form.dtc_codes_cleared,
        road_test_passed: form.road_test_passed,
        old_parts_retained: form.old_parts_retained,
        vehicle_cleaned: form.vehicle_cleaned,
        inspector_name: form.inspector_name.trim(),
        inspector_id: user?.id,
        notes: form.notes.trim() || null,
      });

      if (qcErr) {
        console.warn("QC checks insert note:", qcErr.message);
      }

      // 2. Advance job status to 'ready'
      const { error: jobErr } = await (supabase as any)
        .from("garage_jobs")
        .update({ status: "ready" })
        .eq("id", job.id);

      if (jobErr) throw jobErr;

      toast.success(`QC Passed: ${formatJobNumber(job)} is now READY for pickup`);
      onOpenChange(false);
      onQCPassed();
    } catch (err: any) {
      toast.error(err.message || "Failed to sign off QC");
    } finally {
      setSaving(false);
    }
  };

  const allCrucialChecked =
    form.fluids_checked &&
    form.wheel_nuts_torqued &&
    form.dtc_codes_cleared &&
    form.road_test_passed &&
    form.vehicle_cleaned;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Quality Control (QC) Sign-Off</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pre-delivery verification for {formatJobNumber(job)}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            Complete the safety and mechanical checklist before notifying the customer that the vehicle is ready.
          </div>

          <div className="space-y-2">
            {[
              { key: "fluids_checked", label: "Fluid levels checked & filler caps tight (Oil, Coolant, Brake)" },
              { key: "wheel_nuts_torqued", label: "Wheel lug nuts torqued to manufacturer specifications" },
              { key: "dtc_codes_cleared", label: "OBD diagnostic trouble codes cleared & service light reset" },
              { key: "road_test_passed", label: "Road test / operational test drive completed without fault" },
              { key: "vehicle_cleaned", label: "Interior & exterior touch points cleaned / protectors removed" },
              { key: "old_parts_retained", label: "Old replaced parts packaged for customer inspection (if requested)" },
            ].map((item) => {
              const checked = (form as any)[item.key];
              return (
                <label
                  key={item.key}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-xs transition-colors ${
                    checked
                      ? "border-emerald-400 bg-emerald-50/60 text-emerald-950 font-medium"
                      : "border-border hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(item.key)}
                    className="mt-0.5 h-4 w-4 rounded border-border"
                  />
                  <span>{item.label}</span>
                </label>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 pt-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Inspector / Quality Lead Name *</Label>
              <Input
                value={form.inspector_name}
                onChange={(e) => setForm({ ...form, inspector_name: e.target.value })}
                placeholder="e.g. Master Tech John"
                className="mt-1 h-9"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">QC Notes or Observations (optional)</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. Brake pedal firm, tire pressure adjusted to 32 psi."
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSignOff}
            disabled={saving || !allCrucialChecked}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Pass QC &amp; Mark Vehicle Ready
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
