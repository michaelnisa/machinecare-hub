import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machineId: string;
  onSaved?: () => void;
}

const T = {
  en: { title: "Log fuel", date: "Date", litres: "Litres", cost: "Cost", currency: "Currency", odometer: "Hours / odometer", station: "Station (optional)", save: "Save", saving: "Saving…", saved: "Fuel logged" },
  sw: { title: "Andika mafuta", date: "Tarehe", litres: "Lita", cost: "Gharama", currency: "Sarafu", odometer: "Masaa / odometa", station: "Kituo (si lazima)", save: "Hifadhi", saving: "Inahifadhi…", saved: "Mafuta yameandikwa" },
};

export function QuickFuelDialog({ open, onOpenChange, machineId, onSaved }: Props) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const t = T[lang];
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setForm({ recorded_at: new Date().toISOString().slice(0, 10), fuel_litres: "", fuel_cost: "", currency: "TZS", odometer: "", station: "" });
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload: any = {
      machine_id: machineId,
      recorded_at: form.recorded_at,
      fuel_litres: form.fuel_litres === "" ? null : Number(form.fuel_litres),
      fuel_cost: Number(form.fuel_cost) || 0,
      currency: form.currency || "TZS",
      odometer: form.odometer === "" ? null : Number(form.odometer),
      station: form.station || null,
      created_by: user?.id ?? null,
    };
    const { error } = await supabase.from("fuel_logs").insert(payload);
    if (!error && payload.odometer != null) {
      await supabase.from("machines").update({ current_hours: payload.odometer }).eq("id", machineId);
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t.saved);
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t.title}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label={t.date}>
              <input type="date" required value={form.recorded_at ?? ""} onChange={(e) => setForm({ ...form, recorded_at: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </Field>
            <Field label={t.odometer}>
              <input type="number" step="0.01" value={form.odometer ?? ""} onChange={(e) => setForm({ ...form, odometer: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </Field>
            <Field label={t.litres}>
              <input type="number" step="0.01" value={form.fuel_litres ?? ""} onChange={(e) => setForm({ ...form, fuel_litres: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </Field>
            <Field label={t.cost}>
              <input type="number" step="0.01" value={form.fuel_cost ?? ""} onChange={(e) => setForm({ ...form, fuel_cost: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </Field>
            <Field label={t.currency}>
              <input type="text" value={form.currency ?? ""} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </Field>
            <Field label={t.station}>
              <input type="text" value={form.station ?? ""} onChange={(e) => setForm({ ...form, station: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </Field>
          </div>
          <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? t.saving : t.save}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
