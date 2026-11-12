import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";
import { Fuel, Truck } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machineId: string;
  onSaved?: () => void;
}

const T = {
  en: {
    title: "Add Fuel",
    desc: "Record a fuel refill and tie it to a vehicle trip.",
    date: "Date",
    litres: "Litres (L)",
    cost: "Cost",
    currency: "Currency",
    odometer: "Hours / Odometer (km)",
    station: "Station / Vendor",
    trip: "Associated Trip (Optional)",
    save: "Add Fuel",
    saving: "Adding…",
    saved: "Fuel added successfully",
  },
  sw: {
    title: "Ongeza Mafuta",
    desc: "Rekodi mafuta yaliyowekwa na unganisha na safari ya gari.",
    date: "Tarehe",
    litres: "Lita (L)",
    cost: "Gharama",
    currency: "Sarafu",
    odometer: "Masaa / Odometa (km)",
    station: "Kituo cha Mafuta",
    trip: "Safari Husika (Si lazima)",
    save: "Ongeza Mafuta",
    saving: "Inaongeza…",
    saved: "Mafuta yameongezwa kikamilifu",
  },
};

export function QuickFuelDialog({ open, onOpenChange, machineId, onSaved }: Props) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const t = T[lang] || T.en;
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [currentOdo, setCurrentOdo] = useState<number | null>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>("none");

  useEffect(() => {
    if (open && machineId) {
      setForm({
        recorded_at: new Date().toISOString().slice(0, 10),
        fuel_litres: "",
        fuel_cost: "",
        currency: "TZS",
        odometer: "",
        station: "",
        notes: "",
      });
      setSelectedTripId("none");

      // Load current vehicle odometer
      supabase
        .from("machines")
        .select("current_hours, current_odometer_km")
        .eq("id", machineId)
        .maybeSingle()
        .then(({ data }: any) => {
          const odo = data?.current_odometer_km ?? data?.current_hours;
          if (odo != null) {
            setCurrentOdo(Number(odo));
            setForm((prev: any) => ({ ...prev, odometer: String(odo) }));
          }
        });

      // Load trips for this machine
      supabase
        .from("trips")
        .select("id, origin, destination, status, client_name")
        .eq("machine_id", machineId)
        .order("created_at", { ascending: false })
        .limit(20)
        .then(({ data }) => {
          setTrips(data || []);
        });
    }
  }, [open, machineId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.odometer !== "" && currentOdo != null) {
      const entered = Number(form.odometer);
      if (entered < currentOdo) {
        if (!confirm(`Warning: Entered odometer (${entered} km) is lower than current vehicle odometer (${currentOdo} km). Are you sure?`)) {
          return;
        }
      } else if (entered > currentOdo + 3000) {
        if (!confirm(`Notice: Odometer jumped by ${entered - currentOdo} km from last reading (${currentOdo} km). Please check for typos.`)) {
          return;
        }
      }
    }

    setBusy(true);

    let notesText = form.notes || "";
    if (selectedTripId !== "none") {
      const chosen = trips.find((tr) => tr.id === selectedTripId);
      if (chosen) {
        const tripHeader = `[Trip: ${chosen.origin || "Origin"} ➔ ${chosen.destination || "Destination"} #${chosen.id.slice(0, 8)}]`;
        notesText = `${tripHeader} ${notesText}`.trim();
      }
    }

    const payload: any = {
      machine_id: machineId,
      recorded_at: form.recorded_at,
      fuel_litres: form.fuel_litres === "" ? null : Number(form.fuel_litres),
      fuel_cost: Number(form.fuel_cost) || 0,
      currency: form.currency || "TZS",
      odometer: form.odometer === "" ? null : Number(form.odometer),
      station: form.station || null,
      notes: notesText || null,
      created_by: user?.id ?? null,
    };

    const { error } = await supabase.from("fuel_logs").insert(payload);
    if (!error && payload.odometer != null) {
      await supabase
        .from("machines")
        .update({ current_hours: payload.odometer, current_odometer_km: payload.odometer })
        .eq("id", machineId);
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
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5 text-primary" />
            {t.title}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t.desc}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3 pt-1">
          {/* Associated Trip Picker */}
          {trips.length > 0 && (
            <div className="space-y-1 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
              <label className="block text-[11px] font-semibold text-primary flex items-center gap-1">
                <Truck className="h-3 w-3" />
                {t.trip}
              </label>
              <select
                value={selectedTripId}
                onChange={(e) => setSelectedTripId(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="none">— General / No Specific Trip —</option>
                {trips.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {tr.origin} ➔ {tr.destination} ({tr.status === "in_progress" ? "In Transit" : tr.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Field label={t.date}>
              <input
                type="date"
                required
                value={form.recorded_at ?? ""}
                onChange={(e) => setForm({ ...form, recorded_at: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
              />
            </Field>

            <Field label={t.odometer}>
              <input
                type="number"
                step="any"
                value={form.odometer ?? ""}
                onChange={(e) => setForm({ ...form, odometer: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                placeholder="Current km"
              />
            </Field>

            <Field label={t.litres}>
              <input
                type="number"
                step="any"
                required
                value={form.fuel_litres ?? ""}
                onChange={(e) => setForm({ ...form, fuel_litres: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                placeholder="0.00"
              />
            </Field>

            <Field label={t.cost}>
              <input
                type="number"
                step="any"
                required
                value={form.fuel_cost ?? ""}
                onChange={(e) => setForm({ ...form, fuel_cost: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                placeholder="0.00"
              />
            </Field>

            <Field label={t.currency}>
              <select
                value={form.currency ?? "TZS"}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="TZS">TZS</option>
                <option value="USD">USD</option>
                <option value="ZMW">ZMW</option>
                <option value="KES">KES</option>
                <option value="ZAR">ZAR</option>
              </select>
            </Field>

            <Field label={t.station}>
              <input
                type="text"
                value={form.station ?? ""}
                onChange={(e) => setForm({ ...form, station: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                placeholder="Puma, Total, Oryx..."
              />
            </Field>
          </div>

          <Button type="submit" className="h-10 w-full mt-2 text-xs font-semibold gap-1.5" disabled={busy}>
            <Fuel className="h-4 w-4" />
            {busy ? t.saving : t.save}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
