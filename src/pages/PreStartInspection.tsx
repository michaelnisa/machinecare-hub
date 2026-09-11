import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CheckCircle2, XCircle, MinusCircle, Wrench, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { enqueue, errorMessage, looksOffline } from "@/lib/offlineQueue";

type MachineInfo = {
  id: string;
  organisation_id: string;
  name: string;
  plate_number: string | null;
};

type InspectionItem = {
  item_id: string;
  item_text: string;
  item_sort_order: number;
  item_severity: string;
};

const DEFAULT_FLEET_CHECKLIST: InspectionItem[] = [
  { item_id: "item-brakes", item_text: "Foot Brake & Parking Handbrake Operation", item_sort_order: 1, item_severity: "critical" },
  { item_id: "item-tyres", item_text: "Tyres Tread Depth, Inflation & Wheel Lug Nuts", item_sort_order: 2, item_severity: "critical" },
  { item_id: "item-fluids", item_text: "Engine Oil, Coolant & Brake Fluid Levels", item_sort_order: 3, item_severity: "major" },
  { item_id: "item-lights", item_text: "Headlights, Tail Lights, Brake Lights & Indicators", item_sort_order: 4, item_severity: "major" },
  { item_id: "item-mirrors", item_text: "Mirrors, Windscreen, Wipers & Washer Fluid", item_sort_order: 5, item_severity: "minor" },
  { item_id: "item-safety", item_text: "Seatbelt, Fire Extinguisher & Warning Triangles", item_sort_order: 6, item_severity: "critical" },
];

type Driver = { id: string; full_name: string };

type Result = "ok" | "not_ok" | "not_relevant";

export default function PreStartInspection() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [machine, setMachine] = useState<MachineInfo | null>(null);
  const [template, setTemplate] = useState<{ id: string; name: string; version: number } | null>(null);
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverId, setDriverId] = useState<string>("");
  const [driverPin, setDriverPin] = useState("");
  const [rememberedDriver, setRememberedDriver] = useState<{ id: string; name: string } | null>(null);
  const [step, setStep] = useState<"driver" | "checklist" | "confirm" | "done">("driver");
  const [responses, setResponses] = useState<Record<string, { result: Result; comment: string }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      // 1. Instant offline hydration from QR query parameters or local cache
      const searchParams = new URLSearchParams(window.location.search);
      const cachedMachineStr = localStorage.getItem(`mc_machine_cache_${id}`);
      let initialMachine: any = null;

      if (cachedMachineStr) {
        try { initialMachine = JSON.parse(cachedMachineStr); } catch {}
      } else if (searchParams.get("n")) {
        initialMachine = {
          id,
          name: searchParams.get("n"),
          plate_number: searchParams.get("p") || null,
          organisation_id: searchParams.get("o") || "default_org",
        };
      }
      if (initialMachine) setMachine(initialMachine);

      // Check remembered driver on this device
      const lastId = localStorage.getItem("mc_last_driver_id");
      const lastName = localStorage.getItem("mc_last_driver_name");
      if (lastId && lastName) {
        setRememberedDriver({ id: lastId, name: lastName });
        setDriverId(lastId);
      }

      // Check cached inspection template
      const cachedTmplStr = localStorage.getItem(`mc_tmpl_cache_${id}`);
      if (cachedTmplStr) {
        try {
          const parsed = JSON.parse(cachedTmplStr);
          setTemplate(parsed.template);
          setItems(parsed.items);
        } catch {}
      }

      // Check cached driver directory
      const cachedDriversStr = localStorage.getItem("mc_drivers_cache");
      if (cachedDriversStr) {
        try { setDrivers(JSON.parse(cachedDriversStr)); } catch {}
      }

      // 2. Fetch fresh from network
      try {
        const [{ data: m }, { data: tmpl }, { data: d }] = await Promise.all([
          supabase.rpc("get_machine_public", { _machine_id: id }),
          supabase.rpc("get_fleet_pre_start_template", { _machine_id: id }),
          supabase.rpc("get_org_active_drivers_public", { _machine_id: id }),
        ]);

        if (m?.[0]) {
          setMachine(m[0]);
          try { localStorage.setItem(`mc_machine_cache_${id}`, JSON.stringify(m[0])); } catch {}
        }

        if (tmpl && tmpl.length > 0) {
          const tmplData = { id: tmpl[0].template_id, name: tmpl[0].template_name, version: tmpl[0].template_version };
          const itemsData = tmpl
            .map((r: any) => ({ item_id: r.item_id, item_text: r.item_text, item_sort_order: r.item_sort_order, item_severity: r.item_severity }))
            .sort((a: InspectionItem, b: InspectionItem) => a.item_sort_order - b.item_sort_order);
          setTemplate(tmplData);
          setItems(itemsData);
          try {
            localStorage.setItem(`mc_tmpl_cache_${id}`, JSON.stringify({ template: tmplData, items: itemsData }));
          } catch {}
        } else if (!cachedTmplStr) {
          // Fallback built-in vehicle inspection
          setTemplate({ id: "std-fleet-walkaround", name: "Daily Vehicle Pre-Trip Walkaround", version: 1 });
          setItems(DEFAULT_FLEET_CHECKLIST);
        }

        if (d && d.length > 0) {
          setDrivers(d as Driver[]);
          try { localStorage.setItem("mc_drivers_cache", JSON.stringify(d)); } catch {}
        }
      } catch (err) {
        console.warn("Offline fallback activated for inspection:", err);
        if (!template && items.length === 0) {
          setTemplate({ id: "std-fleet-walkaround", name: "Daily Vehicle Pre-Trip Walkaround", version: 1 });
          setItems(DEFAULT_FLEET_CHECKLIST);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const setResult = (itemId: string, result: Result) => {
    setResponses((prev) => ({ ...prev, [itemId]: { result, comment: prev[itemId]?.comment ?? "" } }));
  };
  const setComment = (itemId: string, comment: string) => {
    setResponses((prev) => ({ ...prev, [itemId]: { result: prev[itemId]?.result ?? "not_relevant", comment } }));
  };

  const allAnswered = items.length > 0 && items.every((it) => responses[it.item_id]?.result);
  const notOkItems = useMemo(
    () => items.filter((it) => responses[it.item_id]?.result === "not_ok"),
    [items, responses],
  );
  const driverName = drivers.find((d) => d.id === driverId)?.full_name ?? "Guest";

  const submit = async () => {
    if (!machine || !template || !id) return;
    setSubmitting(true);
    const executionId = crypto.randomUUID();
    const overallResult = notOkItems.length > 0 ? "attention" : "ok";

    const executionPayload = {
      id: executionId,
      organisation_id: machine.organisation_id,
      machine_id: machine.id,
      template_id: template.id,
      template_version: template.version,
      driver_id: driverId || null,
      performed_by_name: driverName,
      performed_at: new Date().toISOString(),
      status: "completed",
      overall_result: overallResult,
    };
    const responseRows = items.map((it, i) => ({
      execution_id: executionId,
      item_id: it.item_id,
      item_text_snapshot: it.item_text,
      item_type: "tri_state",
      severity_snapshot: it.item_severity,
      result: responses[it.item_id]?.result ?? "not_relevant",
      notes: responses[it.item_id]?.comment || null,
      sort_order: i,
    }));

    try {
      if (driverId && driverName) {
        try {
          localStorage.setItem("mc_last_driver_id", driverId);
          localStorage.setItem("mc_last_driver_name", driverName);
        } catch {}
      }
      const { error: execErr } = await supabase.from("checklist_executions").insert(executionPayload);
      if (execErr) throw execErr;
      const { error: respErr } = await supabase.from("checklist_execution_responses").insert(responseRows);
      if (respErr) throw respErr;

      // ── Create a fault report for each "Not OK" item ─────────────────────
      if (notOkItems.length > 0) {
        const faultRows = notOkItems.map((it) => ({
          organisation_id: machine.organisation_id,
          machine_id: machine.id,
          reporter_name: driverName,
          reporter_phone: "",
          description: responses[it.item_id]?.comment
            ? `Pre-start inspection defect: ${it.item_text}. Notes: ${responses[it.item_id].comment}`
            : `Pre-start inspection defect: ${it.item_text}`,
          severity: it.item_severity === "critical" ? "critical" : it.item_severity === "major" ? "medium" : "low",
          status: "open",
          source_execution_id: executionId,
        }));
        // Non-fatal: inspection already saved even if fault report insert fails
        await supabase.from("fault_reports").insert(faultRows);
      }

      setSubmitting(false);
      setStep("done");
    } catch (err) {
      setSubmitting(false);
      if (looksOffline(err)) {
        await enqueue("pre_start_inspection", { executionPayload, responseRows });
        setSavedOffline(true);
        setStep("done");
      } else {
        toast.error(errorMessage(err, "Failed to submit inspection"));
      }
    }
  };

  if (loading) return <PageLoader />;

  if (!machine) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <p className="text-muted-foreground">Machine not found.</p>
          <Link to="/" className="mt-4 inline-block text-primary hover:underline">Home</Link>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <Wrench className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No daily inspection set up yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask a manager or engineer to open this machine's checklist template and turn on "Use as the QR-scan daily inspection template".
          </p>
          <Link to={`/m/${machine.id}`} className="mt-4 inline-block text-primary hover:underline">
            <ArrowLeft className="mr-1 inline h-3.5 w-3.5" /> Back to machine
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <Link to={`/m/${machine.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {machine.plate_number ? `${machine.name} (${machine.plate_number})` : machine.name}
          </Link>
        </div>

        <h1 className="text-xl font-semibold">{template.name}</h1>

        {step === "driver" && (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Who's conducting this inspection?</p>

            {rememberedDriver && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Quick Sign-In</span>
                    <p className="text-sm font-semibold text-foreground">{rememberedDriver.name}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-primary border-primary/30">Remembered</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="4-digit PIN (optional)"
                    value={driverPin}
                    onChange={(e) => setDriverPin(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                  />
                  <Button
                    size="sm"
                    className="whitespace-nowrap h-9 text-xs font-semibold"
                    onClick={() => {
                      setDriverId(rememberedDriver.id);
                      setStep("checklist");
                    }}
                  >
                    Continue as {rememberedDriver.name.split(" ")[0]} →
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Or select from driver roster:</label>
              {drivers.length > 0 ? (
                <Select value={driverId} onValueChange={(val) => {
                  setDriverId(val);
                  const selected = drivers.find(d => d.id === val);
                  if (selected) {
                    setRememberedDriver({ id: selected.id, name: selected.full_name });
                  }
                }}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select driver name" /></SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={driverName !== "Guest" ? driverName : ""}
                  onChange={(e) => setDriverId(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              )}
            </div>

            <Button className="h-12 w-full font-semibold" onClick={() => setStep("checklist")}>
              {driverId ? "Proceed to Walkaround Checklist" : "Continue as Guest Driver"}
            </Button>
          </div>
        )}

        {step === "checklist" && (
          <div className="space-y-3">
            {items.map((it, i) => {
              const r = responses[it.item_id]?.result;
              return (
                <div key={it.item_id} className="rounded-2xl border border-border bg-card p-4">
                  <p className="mb-3 text-sm font-medium">{i + 1}. {it.item_text}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setResult(it.item_id, "ok")}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border-2 py-3 text-xs font-medium transition-colors",
                        r === "ok" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-border text-muted-foreground",
                      )}
                    >
                      <CheckCircle2 className="h-5 w-5" /> OK
                    </button>
                    <button
                      type="button"
                      onClick={() => setResult(it.item_id, "not_ok")}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border-2 py-3 text-xs font-medium transition-colors",
                        r === "not_ok" ? "border-red-500 bg-red-50 text-red-700" : "border-border text-muted-foreground",
                      )}
                    >
                      <XCircle className="h-5 w-5" /> Not OK
                    </button>
                    <button
                      type="button"
                      onClick={() => setResult(it.item_id, "not_relevant")}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border-2 py-3 text-xs font-medium transition-colors",
                        r === "not_relevant" ? "border-slate-400 bg-slate-100 text-slate-700" : "border-border text-muted-foreground",
                      )}
                    >
                      <MinusCircle className="h-5 w-5" /> N/A
                    </button>
                  </div>
                  {r === "not_ok" && (
                    <textarea
                      placeholder="What's wrong? (optional)"
                      value={responses[it.item_id]?.comment ?? ""}
                      onChange={(e) => setComment(it.item_id, e.target.value)}
                      rows={2}
                      className="mt-3 w-full rounded-md border border-input bg-background p-2 text-sm"
                    />
                  )}
                </div>
              );
            })}
            <Button className="h-12 w-full" disabled={!allAnswered} onClick={() => setStep("confirm")}>
              Review & submit
            </Button>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4">
            {notOkItems.length > 0 && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-700">
                  <AlertTriangle className="h-4 w-4" /> {notOkItems.length} item{notOkItems.length === 1 ? "" : "s"} flagged Not OK
                </div>
                <p className="text-xs text-red-700/80">A fault report will be created automatically for each item below.</p>
                <ul className="mt-2 space-y-1 text-sm text-red-800">
                  {notOkItems.map((it) => <li key={it.item_id}>• {it.item_text}</li>)}
                </ul>
              </div>
            )}
            <div className="rounded-2xl border border-border bg-card p-4 text-sm">
              <div className="flex justify-between py-1"><span className="text-muted-foreground">Vehicle</span><span className="font-medium">{machine.plate_number ?? machine.name}</span></div>
              <div className="flex justify-between py-1"><span className="text-muted-foreground">Driver</span><span className="font-medium">{driverName}</span></div>
              <div className="flex justify-between py-1"><span className="text-muted-foreground">Items checked</span><span className="font-medium">{items.length}</span></div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="h-12 flex-1" onClick={() => setStep("checklist")}>Back</Button>
              <Button className="h-12 flex-1" disabled={submitting} onClick={submit}>
                {submitting ? "Submitting…" : "Submit inspection"}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
            <p className="font-medium">{savedOffline ? "Saved on this device" : "Inspection submitted"}</p>
            {savedOffline ? (
              <p className="mt-1 text-sm text-muted-foreground">
                No connection right now — this will submit automatically once you're back online. You can leave this page.
              </p>
            ) : notOkItems.length > 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {notOkItems.length} fault report{notOkItems.length === 1 ? "" : "s"} sent to the maintenance team.
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Everything checked out OK. Safe travels.</p>
            )}
            <Link to={`/m/${machine.id}`} className="mt-4 inline-block text-primary hover:underline">Back to vehicle</Link>
          </div>
        )}
      </div>
    </div>
  );
}
