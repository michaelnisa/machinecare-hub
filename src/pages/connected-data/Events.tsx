import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertOctagon,
  Plus,
  Sliders,
  Bell,
  Mail,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Check,
  X,
  Play,
  FileText,
  Filter,
  Search,
  Activity,
  Trash2,
  Wrench,
} from "lucide-react";
import { MOCK_CONNECTED_EVENTS, MOCK_EVENT_RULES, MOCK_MACHINE_DICTIONARY } from "@/lib/connected-data-mock";
import { ConnectedEvent, EventRule } from "@/types/connected-data";
import { RuleEngine, RuleEvaluationResult } from "@/lib/rule-engine";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function ConnectedEventsPage() {
  const { toast } = useToast();
  const [events, setEvents] = useState<ConnectedEvent[]>(MOCK_CONNECTED_EVENTS);
  const [rules, setRules] = useState<EventRule[]>(MOCK_EVENT_RULES);
  const [activeTab, setActiveTab] = useState<"events" | "rule_builder">("events");
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");

  // Rule Builder Form State
  const [newRuleName, setNewRuleName] = useState("");
  const [selectedParamKey, setSelectedParamKey] = useState("engine_coolant_temperature");
  const [operator, setOperator] = useState(">");
  const [threshold, setThreshold] = useState(95);
  const [durationMin, setDurationMin] = useState(5);
  const [actionCreateEvent, setActionCreateEvent] = useState(true);
  const [actionEmail, setActionEmail] = useState(true);
  const [actionNotification, setActionNotification] = useState(true);
  const [actionWebhook, setActionWebhook] = useState(true);
  const [actionWorkOrder, setActionWorkOrder] = useState(false);

  // Rule Simulator State
  const [simRuleId, setSimRuleId] = useState<string>(MOCK_EVENT_RULES[0]?.id || "");
  const [simValue, setSimValue] = useState<number>(98.5);
  const [simResult, setSimResult] = useState<RuleEvaluationResult | null>(null);

  const handleResolveEvent = (id: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "RESOLVED" } : e))
    );
    toast({ title: "Event Resolved", description: "Event marked as resolved by operator." });
  };

  const handleAcknowledgeEvent = (id: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "ACKNOWLEDGED" } : e))
    );
    toast({ title: "Event Acknowledged", description: "Operator acknowledged this active alert." });
  };

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim()) {
      toast({ title: "Rule Name is required", variant: "destructive" });
      return;
    }

    const paramDef = MOCK_MACHINE_DICTIONARY.find((p) => p.standard_key === selectedParamKey);

    const rule: EventRule = {
      id: `rule-${Date.now()}`,
      name: newRuleName.trim(),
      asset_id: "ALL",
      asset_name: "All Assets",
      parameter_key: selectedParamKey,
      operator: operator as any,
      threshold,
      unit: paramDef?.unit || "units",
      duration_minutes: durationMin,
      actions: {
        create_event: actionCreateEvent,
        send_email: actionEmail,
        send_notification: actionNotification,
        trigger_webhook: actionWebhook,
        create_work_order: actionWorkOrder,
      },
      active: true,
      created_at: new Date().toISOString(),
    };

    setRules([rule, ...rules]);
    setShowRuleModal(false);
    setNewRuleName("");
    toast({
      title: "Event Rule Created",
      description: `Rule "${rule.name}" activated across telemetry ingestion pipeline.`,
    });
  };

  const handleRunSimulation = () => {
    const targetRule = rules.find((r) => r.id === simRuleId) || rules[0];
    if (!targetRule) return;
    const res = RuleEngine.evaluateRule(targetRule, simValue, "CAT 6040 Mining Shovel");
    setSimResult(res);

    if (res.triggered) {
      toast({
        title: "Simulation Triggered Alert!",
        description: res.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Simulation Normal",
        description: res.message,
      });
    }
  };

  const handleDeleteRule = (id: string) => {
    setRules(rules.filter((r) => r.id !== id));
    toast({ title: "Rule Deleted", description: "Condition rule removed from engine." });
  };

  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      e.asset_name.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.event_code.toLowerCase().includes(search.toLowerCase());
    const matchesSeverity = severityFilter === "ALL" || e.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Events Engine & Visual Rule Builder
          </h1>
          <p className="text-sm text-muted-foreground">
            Automated condition monitoring, threshold evaluation & multi-channel notification actions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="bg-primary hover:bg-primary/90 text-white font-semibold"
            onClick={() => setShowRuleModal(true)}
          >
            <Plus className="mr-2 h-4 w-4" /> Create Condition Rule
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b">
        <Button
          variant={activeTab === "events" ? "default" : "ghost"}
          size="sm"
          className={activeTab === "events" ? "bg-primary text-white" : ""}
          onClick={() => setActiveTab("events")}
        >
          <AlertOctagon className="mr-2 h-4 w-4" />
          Events Inbox ({events.filter((e) => e.status === "ACTIVE").length} Active)
        </Button>
        <Button
          variant={activeTab === "rule_builder" ? "default" : "ghost"}
          size="sm"
          className={activeTab === "rule_builder" ? "bg-primary text-white" : ""}
          onClick={() => setActiveTab("rule_builder")}
        >
          <Sliders className="mr-2 h-4 w-4" />
          Condition Rules ({rules.length})
        </Button>
      </div>

      {/* TAB 1: EVENTS INBOX */}
      {activeTab === "events" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events by machine, description, code..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Severity:</span>
              <select
                className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical Only</option>
                <option value="WARNING">Warning Only</option>
                <option value="INFO">Info Only</option>
              </select>
            </div>
          </div>

          {/* Events List */}
          <div className="space-y-3">
            {filteredEvents.map((evt) => (
              <Card key={evt.id} className="border-border hover:border-primary/40 transition-all">
                <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-foreground">{evt.asset_name}</span>
                      <Badge
                        className={
                          evt.severity === "CRITICAL"
                            ? "bg-rose-500/10 text-rose-600 border-rose-500/20 text-xs font-bold"
                            : evt.severity === "WARNING"
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs font-bold"
                            : "bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs font-bold"
                        }
                      >
                        {evt.severity}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {evt.event_code}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{evt.description}</p>
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1">
                      <span>Parameter: <strong className="text-foreground">{evt.parameter_key}</strong></span>
                      <span>Trigger Value: <strong className="text-rose-600 font-mono">{evt.triggered_value}</strong></span>
                      <span>Threshold: <strong className="text-foreground font-mono">{evt.threshold_value}</strong></span>
                      <span>{new Date(evt.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {evt.status === "ACTIVE" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleAcknowledgeEvent(evt.id)}
                      >
                        Acknowledge
                      </Button>
                    )}
                    {evt.status !== "RESOLVED" ? (
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-white text-xs font-semibold"
                        onClick={() => handleResolveEvent(evt.id)}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Resolve Event
                      </Button>
                    ) : (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        <Check className="mr-1 h-3 w-3" /> Resolved
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: RULE BUILDER & SIMULATOR */}
      {activeTab === "rule_builder" && (
        <div className="space-y-6">
          {/* Active Rules Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {rules.map((rule) => (
              <Card key={rule.id} className="border-border">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Sliders className="h-4 w-4 text-primary" />
                        {rule.name}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        IF <strong className="text-foreground">{rule.parameter_key}</strong> {rule.operator} <strong className="text-rose-600">{rule.threshold} {rule.unit}</strong> for {rule.duration_minutes}m
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-rose-600"
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {rule.actions.create_event && (
                      <Badge variant="outline" className="bg-primary/10 text-primary">In-App Event</Badge>
                    )}
                    {rule.actions.send_notification && (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600">Push Alert</Badge>
                    )}
                    {rule.actions.trigger_webhook && (
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-600">Webhook POST</Badge>
                    )}
                    {rule.actions.create_work_order && (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600">Auto Work Order</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Interactive Rule Simulator */}
          <Card className="border-primary/30 bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Play className="h-4 w-4 text-primary" />
                Phase 5 Interactive Rule Simulator
              </CardTitle>
              <CardDescription>
                Test your condition rules with sample telemetry parameter readings before activating in production
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Target Condition Rule</Label>
                  <select
                    className="w-full rounded-md border bg-background p-2 text-xs font-medium focus:ring-1 focus:ring-primary"
                    value={simRuleId}
                    onChange={(e) => setSimRuleId(e.target.value)}
                  >
                    {rules.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.parameter_key} {r.operator} {r.threshold})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Simulated Telemetry Value</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={simValue}
                    onChange={(e) => setSimValue(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-white font-semibold"
                    onClick={handleRunSimulation}
                  >
                    <Play className="mr-1.5 h-4 w-4" /> Evaluate Rule
                  </Button>
                </div>
              </div>

              {/* Simulation Result Output */}
              {simResult && (
                <div
                  className={`rounded-lg border p-3.5 text-xs font-mono transition-all ${
                    simResult.triggered
                      ? "bg-rose-950/20 border-rose-500/30 text-rose-700 dark:text-rose-300"
                      : "bg-emerald-950/20 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>Simulation Status: {simResult.triggered ? "🚨 CONDITION BREACH (ALERT TRIGGERED)" : "✅ NORMAL (NO ACTION)"}</span>
                    <Badge variant="outline">{simResult.severity}</Badge>
                  </div>
                  <div className="mt-1.5">{simResult.message}</div>
                  {simResult.dispatched_actions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-rose-500/20">
                      <strong className="block mb-1">Actions Triggered:</strong>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                        {simResult.dispatched_actions.map((act, idx) => (
                          <li key={idx}>{act}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Rule Modal */}
      <Dialog open={showRuleModal} onOpenChange={setShowRuleModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Create Visual Condition Rule
            </DialogTitle>
            <DialogDescription>
              Define IF... THEN conditional triggers across incoming machine telemetry streams.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRule} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="rule-name">Rule Name *</Label>
              <Input
                id="rule-name"
                placeholder="e.g. Engine Overheat Critical Alarm"
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Machine Parameter</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
                  value={selectedParamKey}
                  onChange={(e) => setSelectedParamKey(e.target.value)}
                >
                  {MOCK_MACHINE_DICTIONARY.map((p) => (
                    <option key={p.id} value={p.standard_key}>
                      {p.label} ({p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Operator</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary font-mono"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                >
                  <option value=">">&gt; (Greater Than)</option>
                  <option value=">=">&gt;= (Greater or Eq)</option>
                  <option value="<">&lt; (Less Than)</option>
                  <option value="<=">&lt;= (Less or Eq)</option>
                  <option value="==">== (Equal To)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rule-thresh">Threshold Value</Label>
                <Input
                  id="rule-thresh"
                  type="number"
                  step="0.1"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rule-dur">Duration (Minutes)</Label>
                <Input
                  id="rule-dur"
                  type="number"
                  min="0"
                  value={durationMin}
                  onChange={(e) => setDurationMin(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Actions Checklist */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-semibold">Automated Actions on Trigger</Label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={actionCreateEvent}
                    onChange={(e) => setActionCreateEvent(e.target.checked)}
                  />
                  <span>Create In-App Event</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={actionNotification}
                    onChange={(e) => setActionNotification(e.target.checked)}
                  />
                  <span>Push Notification</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={actionWebhook}
                    onChange={(e) => setActionWebhook(e.target.checked)}
                  />
                  <span>Trigger Outgoing Webhook</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={actionWorkOrder}
                    onChange={(e) => setActionWorkOrder(e.target.checked)}
                  />
                  <span>Auto-Create Work Order</span>
                </label>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setShowRuleModal(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-white font-semibold">
                Save & Activate Rule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
