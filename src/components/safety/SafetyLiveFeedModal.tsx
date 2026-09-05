import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Settings2, UserCheck, Award, Radio, Save } from "lucide-react";

export type DutyRoster = {
  chiefSafetyOfficer: { name: string; phone: string };
  firstAidOfficer: { name: string; phone: string };
  safetyOfficerOnDuty: { name: string; phone: string };
};

export type SafetyTvFeedConfig = {
  roster: DutyRoster;
  bulletinNotices?: string[];
  recordLtiDays?: number | null;
  complianceTargetRate?: number | null;
  baselineLtiDays?: number | null;
};

const defaultRoster: DutyRoster = {
  chiefSafetyOfficer: { name: "", phone: "" },
  firstAidOfficer: { name: "", phone: "" },
  safetyOfficerOnDuty: { name: "", phone: "" },
};

interface SafetyLiveFeedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function SafetyLiveFeedModal({ open, onOpenChange, onSaved }: SafetyLiveFeedModalProps) {
  const { organisation, profile } = useAuth();
  const orgId = organisation?.id || profile?.organisation_id;
  const storageKey = orgId ? `machinecare_safety_live_feed_${orgId}` : null;

  const [saving, setSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; full_name: string; phone: string | null; department: string | null }>>([]);

  const [formRoster, setFormRoster] = useState<DutyRoster>(defaultRoster);
  const [formRecordDays, setFormRecordDays] = useState<string>("");
  const [formBaselineDays, setFormBaselineDays] = useState<string>("");
  const [formComplianceRate, setFormComplianceRate] = useState<string>("");
  const [formBulletins, setFormBulletins] = useState<string>("");

  useEffect(() => {
    if (!open || !orgId) return;

    // Load team members for quick-select
    supabase
      .from("profiles")
      .select("id, full_name, phone, department")
      .eq("organisation_id", orgId)
      .order("full_name")
      .then(({ data }) => {
        if (data) {
          setTeamMembers(
            data.map((p) => ({
              id: p.id,
              full_name: p.full_name || "Staff Member",
              phone: p.phone,
              department: p.department,
            }))
          );
        }
      });

    // Load current config from localStorage or Supabase
    let loaded: SafetyTvFeedConfig | null = null;
    if (storageKey) {
      try {
        const cached = localStorage.getItem(storageKey);
        if (cached) loaded = JSON.parse(cached);
      } catch {
        // ignore
      }
    }

    (supabase as any)
      .from("safety_rules")
      .select("match_value")
      .eq("organisation_id", orgId)
      .eq("name", "SAFETY_LIVE_TV_FEED")
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.match_value) {
          try {
            const parsed = JSON.parse(data.match_value);
            loaded = parsed;
          } catch {
            // ignore
          }
        }
        if (loaded) {
          if (loaded.roster) {
            setFormRoster({
              chiefSafetyOfficer: {
                name: loaded.roster.chiefSafetyOfficer?.name || "",
                phone: loaded.roster.chiefSafetyOfficer?.phone || "",
              },
              firstAidOfficer: {
                name: loaded.roster.firstAidOfficer?.name || "",
                phone: loaded.roster.firstAidOfficer?.phone || "",
              },
              safetyOfficerOnDuty: {
                name: loaded.roster.safetyOfficerOnDuty?.name || "",
                phone: loaded.roster.safetyOfficerOnDuty?.phone || "",
              },
            });
          }
          setFormRecordDays(loaded.recordLtiDays ? String(loaded.recordLtiDays) : "");
          setFormBaselineDays(loaded.baselineLtiDays ? String(loaded.baselineLtiDays) : "");
          setFormComplianceRate(loaded.complianceTargetRate ? String(loaded.complianceTargetRate) : "");
          setFormBulletins(loaded.bulletinNotices ? loaded.bulletinNotices.join("\n") : "");
        }
      });
  }, [open, orgId, storageKey]);

  const saveConfiguration = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      const parsedBulletins = formBulletins
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const newConfig: SafetyTvFeedConfig = {
        roster: formRoster,
        bulletinNotices: parsedBulletins.length > 0 ? parsedBulletins : undefined,
        recordLtiDays: formRecordDays ? parseInt(formRecordDays, 10) || null : null,
        baselineLtiDays: formBaselineDays ? parseInt(formBaselineDays, 10) || null : null,
        complianceTargetRate: formComplianceRate ? parseFloat(formComplianceRate) || null : null,
      };

      const payload = JSON.stringify(newConfig);

      // 1. Save to local storage for instant cache
      if (storageKey) {
        localStorage.setItem(storageKey, payload);
      }

      // 2. Persist to Supabase safety_rules
      const { data: existing } = await (supabase as any)
        .from("safety_rules")
        .select("id")
        .eq("organisation_id", orgId)
        .eq("name", "SAFETY_LIVE_TV_FEED")
        .maybeSingle();

      if (existing?.id) {
        await (supabase as any)
          .from("safety_rules")
          .update({
            match_value: payload,
            is_active: true,
            match_field: "live_config",
          })
          .eq("id", existing.id);
      } else {
        await (supabase as any)
          .from("safety_rules")
          .insert({
            organisation_id: orgId,
            name: "SAFETY_LIVE_TV_FEED",
            match_field: "live_config",
            match_value: payload,
            is_active: true,
            required_ppe: [],
          });
      }

      // 3. Broadcast to all open Live TV screens in real time
      const channel = supabase.channel(`safety-live-tv:${orgId}`);
      channel.send({
        type: "broadcast",
        event: "feed_updated",
        payload: newConfig,
      });

      toast.success("Safety Live TV feed & duty roster updated successfully");
      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to save feed configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border border-border text-foreground shadow-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-emerald-500" /> Feed Safety Live TV & Duty Roster
          </DialogTitle>
          <div className="text-xs text-muted-foreground">
            Feed and update real-time duty roster contacts, site benchmark targets, and daily live bulletins displayed on the Safety Live TV.
          </div>
        </DialogHeader>

        <div className="space-y-6 py-3 max-h-[70vh] overflow-y-auto pr-2">
          {/* EMERGENCY DUTY ROSTER PERSONNEL */}
          <div className="space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <UserCheck className="h-4 w-4" /> Emergency Duty Roster Personnel
            </div>

            {/* Chief Safety Officer */}
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">1. Chief Safety Officer</span>
                {teamMembers.length > 0 && (
                  <select
                    className="text-xs bg-background border border-border rounded-md px-2 py-1 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    onChange={(e) => {
                      const m = teamMembers.find((x) => x.id === e.target.value);
                      if (m) {
                        setFormRoster((prev) => ({
                          ...prev,
                          chiefSafetyOfficer: { name: m.full_name, phone: m.phone || prev.chiefSafetyOfficer.phone },
                        }));
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Select from team...</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} {m.department ? `(${m.department})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Officer Name</Label>
                  <Input
                    placeholder="e.g. Eng. Wilson Mkono"
                    value={formRoster.chiefSafetyOfficer.name}
                    onChange={(e) =>
                      setFormRoster((prev) => ({
                        ...prev,
                        chiefSafetyOfficer: { ...prev.chiefSafetyOfficer, name: e.target.value },
                      }))
                    }
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Emergency Phone Number</Label>
                  <Input
                    placeholder="e.g. +255 784 991 223"
                    value={formRoster.chiefSafetyOfficer.phone}
                    onChange={(e) =>
                      setFormRoster((prev) => ({
                        ...prev,
                        chiefSafetyOfficer: { ...prev.chiefSafetyOfficer, phone: e.target.value },
                      }))
                    }
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* First Aid Officer */}
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">2. First Aid Officer</span>
                {teamMembers.length > 0 && (
                  <select
                    className="text-xs bg-background border border-border rounded-md px-2 py-1 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    onChange={(e) => {
                      const m = teamMembers.find((x) => x.id === e.target.value);
                      if (m) {
                        setFormRoster((prev) => ({
                          ...prev,
                          firstAidOfficer: { name: m.full_name, phone: m.phone || prev.firstAidOfficer.phone },
                        }));
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Select from team...</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} {m.department ? `(${m.department})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Officer Name</Label>
                  <Input
                    placeholder="e.g. Sarah K. Kimaro"
                    value={formRoster.firstAidOfficer.name}
                    onChange={(e) =>
                      setFormRoster((prev) => ({
                        ...prev,
                        firstAidOfficer: { ...prev.firstAidOfficer, name: e.target.value },
                      }))
                    }
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Emergency Phone Number</Label>
                  <Input
                    placeholder="e.g. +255 754 312 889"
                    value={formRoster.firstAidOfficer.phone}
                    onChange={(e) =>
                      setFormRoster((prev) => ({
                        ...prev,
                        firstAidOfficer: { ...prev.firstAidOfficer, phone: e.target.value },
                      }))
                    }
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Safety Officer on Duty */}
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">3. Safety Officer on Duty</span>
                {teamMembers.length > 0 && (
                  <select
                    className="text-xs bg-background border border-border rounded-md px-2 py-1 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    onChange={(e) => {
                      const m = teamMembers.find((x) => x.id === e.target.value);
                      if (m) {
                        setFormRoster((prev) => ({
                          ...prev,
                          safetyOfficerOnDuty: { name: m.full_name, phone: m.phone || prev.safetyOfficerOnDuty.phone },
                        }));
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Select from team...</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} {m.department ? `(${m.department})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Officer Name</Label>
                  <Input
                    placeholder="e.g. Juma R. Mushi"
                    value={formRoster.safetyOfficerOnDuty.name}
                    onChange={(e) =>
                      setFormRoster((prev) => ({
                        ...prev,
                        safetyOfficerOnDuty: { ...prev.safetyOfficerOnDuty, name: e.target.value },
                      }))
                    }
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Emergency Phone Number</Label>
                  <Input
                    placeholder="e.g. +255 713 445 670"
                    value={formRoster.safetyOfficerOnDuty.phone}
                    onChange={(e) =>
                      setFormRoster((prev) => ({
                        ...prev,
                        safetyOfficerOnDuty: { ...prev.safetyOfficerOnDuty, phone: e.target.value },
                      }))
                    }
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CUSTOM BENCHMARKS & TARGETS */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <Award className="h-4 w-4" /> Custom Site Benchmarks & Targets (Optional)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">All-Time Site Record (Days)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 365"
                  value={formRecordDays}
                  onChange={(e) => setFormRecordDays(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Baseline Days Without LTI</Label>
                <Input
                  type="number"
                  placeholder="Auto-calculated if blank"
                  value={formBaselineDays}
                  onChange={(e) => setFormBaselineDays(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Target Compliance (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="100.0"
                  value={formComplianceRate}
                  onChange={(e) => setFormComplianceRate(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* LIVE ROLLING TICKER BULLETINS */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <Radio className="h-4 w-4" /> Live Bulletin Announcements (One notice per line)
            </div>
            <Textarea
              rows={4}
              placeholder="Enter custom daily safety notices (one per line)... If blank, dynamic live metrics will scroll."
              value={formBulletins}
              onChange={(e) => setFormBulletins(e.target.value)}
              className="text-xs font-sans leading-relaxed"
            />
            <div className="text-[11px] text-muted-foreground">
              Leave empty to automatically display live status bulletins (incident-free count, contractor counts, emergency contacts).
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border pt-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={saveConfiguration}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save & Broadcast to TV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
