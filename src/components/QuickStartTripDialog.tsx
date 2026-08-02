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

type Driver = { id: string; full_name: string };

const T = {
  en: { title: "Start trip", driver: "Driver", purpose: "Purpose (optional)", destination: "Destination (optional)", startOdo: "Start odometer (km)", start: "Start trip", starting: "Starting…", started: "Trip started", noDrivers: "No active drivers — add one under Fleet → Drivers first." },
  sw: { title: "Anza safari", driver: "Dereva", purpose: "Kusudi (si lazima)", destination: "Mahali unakoenda (si lazima)", startOdo: "Odometa ya kuanzia (km)", start: "Anza safari", starting: "Inaanza…", started: "Safari imeanza", noDrivers: "Hakuna dereva aliyepo — ongeza dereva chini ya Meli → Madereva kwanza." },
};

export function QuickStartTripDialog({ open, onOpenChange, machineId, onSaved }: Props) {
  const { profile, user } = useAuth();
  const { lang } = useI18n();
  const t = T[lang];
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ driver_id: "", purpose: "", destination: "", start_odo: "" });
    supabase.from("drivers").select("id, full_name").eq("status", "active").order("full_name").then(({ data }) => setDrivers((data ?? []) as Driver[]));
    supabase.from("machines").select("current_odometer_km").eq("id", machineId).maybeSingle().then(({ data }) => {
      if (data?.current_odometer_km != null) setForm((f: any) => ({ ...f, start_odo: String(data.current_odometer_km) }));
    });
  }, [open, machineId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    const payload = {
      organisation_id: profile.organisation_id,
      machine_id: machineId,
      driver_id: form.driver_id || null,
      purpose: form.purpose?.trim() || null,
      destination: form.destination?.trim() || null,
      start_odo: form.start_odo === "" ? null : Number(form.start_odo),
      status: "in_progress",
      start_at: new Date().toISOString(),
      created_by: user?.id ?? null,
    };
    const { error } = await supabase.from("trips").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t.started);
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t.title}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label={t.driver}>
            {drivers.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t.noDrivers}</p>
            ) : (
              <select
                value={form.driver_id ?? ""}
                onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">—</option>
                {drivers.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select>
            )}
          </Field>
          <Field label={t.destination}>
            <input type="text" value={form.destination ?? ""} onChange={(e) => setForm({ ...form, destination: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
          </Field>
          <Field label={t.purpose}>
            <input type="text" value={form.purpose ?? ""} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
          </Field>
          <Field label={t.startOdo}>
            <input type="number" step="0.01" value={form.start_odo ?? ""} onChange={(e) => setForm({ ...form, start_odo: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
          </Field>
          <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? t.starting : t.start}</Button>
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
