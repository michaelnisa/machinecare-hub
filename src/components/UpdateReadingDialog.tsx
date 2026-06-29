import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machineId: string;
  currentHours: number | null;
  onSaved: () => void;
}

export function UpdateReadingDialog({ open, onOpenChange, machineId, currentHours, onSaved }: Props) {
  const { profile, user } = useAuth();
  const { t } = useI18n();
  const [reading, setReading] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setReading("");
      setDate(new Date().toISOString().slice(0, 10));
      setNotes("");
    }
  }, [open]);

  const submit = async () => {
    const value = Number(reading);
    if (!reading || Number.isNaN(value) || value < 0) {
      toast.error(t.machine.invalidReading);
      return;
    }
    if (currentHours != null && value < currentHours) {
      if (!confirm(t.machine.confirmLowerReading)) return;
    }
    setSaving(true);
    const { error } = await supabase.from("meter_readings").insert({
      machine_id: machineId,
      organisation_id: profile!.organisation_id,
      reading: value,
      reading_date: date,
      notes: notes.trim() || null,
      recorded_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t.machine.readingSaved);
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t.machine.updateReading}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ur-reading">{t.machine.newReading} *</Label>
            <Input id="ur-reading" type="number" min={0} value={reading} onChange={(e) => setReading(e.target.value)} placeholder={currentHours != null ? `${t.machine.currentLabel}: ${currentHours}` : "0"} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ur-date">{t.machine.readingDate} *</Label>
            <Input id="ur-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ur-notes">{t.checklist.notes}</Label>
            <Textarea id="ur-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.machine.readingNotePlaceholder} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t.common.cancel}</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
