import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { BellRing, UserX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatNumber } from "@/lib/format";
import { buildMessage } from "@/lib/garage-messages";

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 182;
const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;

export default function GarageReminders() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dueVehicles, setDueVehicles] = useState<any[]>([]);
  const [inactive, setInactive] = useState<any[]>([]);
  const [messageTarget, setMessageTarget] = useState<any>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: vehicles, error: e1 }, { data: customers, error: e2 }, { data: jobs, error: e3 }] = await Promise.all([
      (supabase as any).from("garage_vehicles").select("*, garage_customers(id, name, phone)").not("next_service_date", "is", null).order("next_service_date"),
      (supabase as any).from("garage_customers").select("id, name, phone"),
      (supabase as any).from("garage_jobs").select("customer_id, created_at").order("created_at", { ascending: false }),
    ]);
    const err = e1 || e2 || e3;
    if (err) toast.error(err.message);

    const now = Date.now();
    const soon = new Date(now + THIRTY_DAYS_MS).toISOString().slice(0, 10);
    setDueVehicles((vehicles ?? []).filter((v: any) => v.next_service_date <= soon));

    const lastVisit: Record<string, string> = {};
    (jobs ?? []).forEach((j: any) => { if (!lastVisit[j.customer_id]) lastVisit[j.customer_id] = j.created_at; });
    const cutoff = now - SIX_MONTHS_MS;
    setInactive((customers ?? [])
      .filter((c: any) => lastVisit[c.id] && new Date(lastVisit[c.id]).getTime() < cutoff)
      .map((c: any) => ({ ...c, lastVisit: lastVisit[c.id] }))
      .sort((a: any, b: any) => new Date(a.lastVisit).getTime() - new Date(b.lastVisit).getTime()));

    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reminders</h1>
        <p className="text-sm text-muted-foreground">Vehicles due for service, and customers who haven't been back in a while.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Due for service (next 30 days)</h2>
        {dueVehicles.length === 0 ? (
          <EmptyState icon={<BellRing className="h-5 w-5" />} title="Nothing due soon" description="No vehicles have an upcoming service date set." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-5 py-3 font-medium">Vehicle</th><th className="px-5 py-3 font-medium">Customer</th><th className="px-5 py-3 font-medium">Due</th><th className="px-5 py-3 font-medium"></th></tr>
              </thead>
              <tbody>
                {dueVehicles.map((v) => (
                  <tr key={v.id} className="border-t border-border">
                    <td className="px-5 py-3">
                      <div className="font-medium">{[v.make, v.model].filter(Boolean).join(" ") || "Vehicle"}</div>
                      {v.registration_number && <div className="text-xs text-muted-foreground">{v.registration_number}</div>}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{v.garage_customers?.name}</td>
                    <td className="px-5 py-3">
                      {formatDate(v.next_service_date)}
                      {v.next_service_mileage && <div className="text-xs text-muted-foreground">or {formatNumber(v.next_service_mileage)} km</div>}
                    </td>
                    <td className="px-5 py-3 text-right"><Button size="sm" variant="outline" onClick={() => setMessageTarget({ vehicle: v, customer: v.garage_customers })}>Log message</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Inactive customers (6+ months)</h2>
        {inactive.length === 0 ? (
          <EmptyState icon={<UserX className="h-5 w-5" />} title="No inactive customers" description="Everyone with a job on file has visited within the last 6 months." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-5 py-3 font-medium">Customer</th><th className="px-5 py-3 font-medium">Last visit</th><th className="px-5 py-3 font-medium"></th></tr>
              </thead>
              <tbody>
                {inactive.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-5 py-3 font-medium">{c.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(c.lastVisit)}</td>
                    <td className="px-5 py-3 text-right"><Button size="sm" variant="outline" onClick={() => setMessageTarget({ customer: c })}>Log message</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <LogMessageDialog target={messageTarget} onClose={() => setMessageTarget(null)} orgId={profile?.organisation_id} />
    </div>
  );
}

function LogMessageDialog({ target, onClose, orgId }: any) {
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    setBody(buildMessage("service_reminder", {
      customerName: target.customer?.name,
      vehicleLabel: target.vehicle ? [target.vehicle.make, target.vehicle.model].filter(Boolean).join(" ") : undefined,
      mileage: target.vehicle?.mileage,
      nextServiceMileage: target.vehicle?.next_service_mileage,
    }));
    setChannel("whatsapp");
  }, [target]);

  if (!target) return null;

  const submit = async () => {
    if (!body.trim()) return toast.error("Message is empty");
    setSaving(true);
    const { error } = await (supabase as any).from("garage_customer_messages").insert({
      organisation_id: orgId, customer_id: target.customer.id, trigger_event: "service_reminder", channel, message_body: body.trim(), status: "sent",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Logged");
    onClose();
  };

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Log message to {target.customer?.name}</DialogTitle></DialogHeader>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          {["whatsapp", "sms", "email", "phone_call", "in_person", "other"].map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
        </select>
        <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} className="mt-2" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log as sent"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
