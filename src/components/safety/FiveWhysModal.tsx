import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  GitBranch,
  ArrowDown,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Send,
  Calendar,
  User,
  Wrench,
  Clock,
  HelpCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incident: any;
  onSaved?: () => void;
}

const FIVE_M_CATEGORIES = [
  { id: "machine", label: "Machine / Equipment", icon: "⚙️", desc: "Mechanical, electrical, tooling, or sensor wear/failure" },
  { id: "method", label: "Method / Process", icon: "📋", desc: "Work procedure, SOP, permit, or risk assessment gap" },
  { id: "material", label: "Material / Part", icon: "📦", desc: "Defective component, chemical degradation, or raw material" },
  { id: "human", label: "Human / Training", icon: "👷", desc: "Competency, fatigue, miscommunication, or ergonomics" },
  { id: "environment", label: "Environment", icon: "🏭", desc: "Lighting, housekeeping, noise, extreme temperature, or workspace" },
];

export function FiveWhysModal({ open, onOpenChange, incident, onSaved }: Props) {
  const { profile } = useAuth();
  const orgId = profile?.organisation_id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingCapa, setCreatingCapa] = useState(false);

  const [existingRecordId, setExistingRecordId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number>(1);

  // Form State
  const [problemStatement, setProblemStatement] = useState("");
  const [why1, setWhy1] = useState("");
  const [why2, setWhy2] = useState("");
  const [why3, setWhy3] = useState("");
  const [why4, setWhy4] = useState("");
  const [why5, setWhy5] = useState("");
  const [rootCauseSummary, setRootCauseSummary] = useState("");
  const [rootCauseCategory, setRootCauseCategory] = useState("method");
  const [preventiveMeasures, setPreventiveMeasures] = useState("");
  const [capaId, setCapaId] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!incident || !open) return;
    loadFiveWhys();
  }, [incident, open]);

  const loadFiveWhys = async () => {
    setLoading(true);
    try {
      // Default problem statement from incident description
      const defaultProblem = incident.description || `Incident on ${new Date(incident.occurred_at).toLocaleDateString()}`;
      setProblemStatement(defaultProblem);

      const { data, error } = await (supabase as any)
        .from("safety_5_whys")
        .select("*")
        .eq("incident_id", incident.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingRecordId(data.id);
        setProblemStatement(data.problem_statement || defaultProblem);
        setWhy1(data.why_1 || "");
        setWhy2(data.why_2 || "");
        setWhy3(data.why_3 || "");
        setWhy4(data.why_4 || "");
        setWhy5(data.why_5 || "");
        setRootCauseSummary(data.root_cause_summary || "");
        setRootCauseCategory(data.root_cause_category || "method");
        setPreventiveMeasures(data.preventive_measures || "");
        setCapaId(data.capa_id || null);
        setCompletedAt(data.completed_at || null);
      } else {
        setExistingRecordId(null);
        setWhy1("");
        setWhy2("");
        setWhy3("");
        setWhy4("");
        setWhy5("");
        setRootCauseSummary("");
        setRootCauseCategory("method");
        setPreventiveMeasures("");
        setCapaId(null);
        setCompletedAt(null);
      }
    } catch (e: any) {
      console.error("Error loading 5-whys:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (isFinalize = false) => {
    if (!why1.trim()) {
      toast.error("Please enter at least the first 'Why' (direct cause)");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        organisation_id: orgId,
        incident_id: incident.id,
        problem_statement: problemStatement.trim(),
        why_1: why1.trim(),
        why_2: why2.trim() || null,
        why_3: why3.trim() || null,
        why_4: why4.trim() || null,
        why_5: why5.trim() || null,
        root_cause_summary: rootCauseSummary.trim() || why5.trim() || why3.trim() || why1.trim(),
        root_cause_category: rootCauseCategory,
        preventive_measures: preventiveMeasures.trim() || null,
        investigated_by: profile?.id,
        investigator_name: profile?.full_name || "Safety Officer",
        updated_at: new Date().toISOString(),
      };

      if (isFinalize) {
        payload.completed_at = new Date().toISOString();
        setCompletedAt(payload.completed_at);
      }

      if (existingRecordId) {
        const { error } = await (supabase as any)
          .from("safety_5_whys")
          .update(payload)
          .eq("id", existingRecordId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("safety_5_whys")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setExistingRecordId(data.id);
      }

      toast.success(isFinalize ? "5-Whys Root Cause Analysis finalized" : "Progress saved");
      if (onSaved) onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to save 5-whys analysis");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCapa = async () => {
    const summary = rootCauseSummary.trim() || why5.trim() || why3.trim() || why1.trim();
    if (!summary) {
      toast.error("Please complete the investigation and define a root cause first");
      return;
    }

    setCreatingCapa(true);
    try {
      // First ensure 5-whys is saved
      await handleSave(true);

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14); // 2 weeks default

      // Insert corrective action
      const { data: capa, error: capaErr } = await (supabase as any)
        .from("corrective_actions")
        .insert({
          organisation_id: orgId,
          source_type: "incident_5_whys",
          source_id: incident.id,
          description: `[5-Whys RCA - ${rootCauseCategory.toUpperCase()}] ${summary}. Preventive action: ${preventiveMeasures || "Address underlying root cause"}`,
          priority: incident.severity === "critical" ? "high" : "medium",
          status: "open",
          responsible_person: profile?.full_name || "EHS Manager",
          due_date: dueDate.toISOString(),
          created_by: profile?.id,
        })
        .select()
        .single();

      if (capaErr) throw capaErr;

      // Link capa_id into safety_5_whys
      setCapaId(capa.id);
      await (supabase as any)
        .from("safety_5_whys")
        .update({ capa_id: capa.id })
        .eq("incident_id", incident.id);

      toast.success("Corrective Action (CAPA) generated and tracked!");
      if (onSaved) onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to create CAPA action");
    } finally {
      setCreatingCapa(false);
    }
  };

  if (!incident) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="pb-2 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-50 text-[#00A651]">
                <GitBranch className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight">
                  Interactive 5-Whys Root Cause Analysis (RCA)
                </DialogTitle>
                <DialogDescription className="text-xs">
                  ISO 45001 §10.2 Compliant • Drill down from incident symptom to fundamental system cause.
                </DialogDescription>
              </div>
            </div>

            {completedAt ? (
              <Badge className="bg-[#00A651] text-white gap-1 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5" /> RCA Finalized
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500 text-amber-600 gap-1 text-xs">
                <Clock className="h-3.5 w-3.5" /> Investigation In-Progress
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Incident Context Banner */}
        <div className="p-3.5 bg-muted/40 rounded-xl border border-border text-xs flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-bold text-foreground">Incident: </span>
            <span className="capitalize">{incident.incident_type?.replace(/_/g, " ") || "Incident"}</span>
            <span className="text-muted-foreground ml-2">
              ({new Date(incident.occurred_at).toLocaleDateString()} - Severity:{" "}
              <strong className="capitalize text-red-600">{incident.severity}</strong>)
            </span>
          </div>
          {incident.machines?.name && (
            <span className="bg-card px-2 py-1 rounded border border-border font-medium">
              Machine: {incident.machines.name}
            </span>
          )}
        </div>

        {/* Problem Statement Box */}
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            0. Problem Statement (Observed Symptom)
          </Label>
          <Textarea
            value={problemStatement}
            onChange={(e) => setProblemStatement(e.target.value)}
            placeholder="Describe exactly what happened or what failure was observed..."
            className="text-xs min-h-[50px] bg-slate-50 dark:bg-slate-900 border-border"
          />
        </div>

        {/* 5-Whys Interactive Flow */}
        <div className="space-y-4 pt-2">
          {/* Why 1 */}
          <div className="border border-border rounded-xl p-3.5 bg-card shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span className="h-5 w-5 rounded-full bg-[#00A651] text-white inline-flex items-center justify-center text-xs font-black">
                  1
                </span>
                Why 1: Why did this happen? (Direct / Physical Cause)
              </span>
            </div>
            <Input
              value={why1}
              onChange={(e) => setWhy1(e.target.value)}
              placeholder="e.g. Technician slipped and fell on the workshop walkway."
              className="text-xs bg-background"
            />
          </div>

          <div className="flex justify-center -my-2 text-muted-foreground">
            <ArrowDown className="h-4 w-4" />
          </div>

          {/* Why 2 */}
          <div className="border border-border rounded-xl p-3.5 bg-card shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span className="h-5 w-5 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center text-xs font-black">
                  2
                </span>
                Why 2: Why did that occur? (Immediate Condition)
              </span>
            </div>
            <Input
              value={why2}
              onChange={(e) => setWhy2(e.target.value)}
              placeholder="e.g. Because hydraulic oil had pooled on the floor next to Machine #4."
              className="text-xs bg-background"
            />
          </div>

          <div className="flex justify-center -my-2 text-muted-foreground">
            <ArrowDown className="h-4 w-4" />
          </div>

          {/* Why 3 */}
          <div className="border border-border rounded-xl p-3.5 bg-card shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span className="h-5 w-5 rounded-full bg-emerald-700 text-white inline-flex items-center justify-center text-xs font-black">
                  3
                </span>
                Why 3: Why was that condition present? (Mechanical / Operational Gap)
              </span>
            </div>
            <Input
              value={why3}
              onChange={(e) => setWhy3(e.target.value)}
              placeholder="e.g. The hydraulic hose coupling developed a pinhole rupture under high pressure."
              className="text-xs bg-background"
            />
          </div>

          <div className="flex justify-center -my-2 text-muted-foreground">
            <ArrowDown className="h-4 w-4" />
          </div>

          {/* Why 4 */}
          <div className="border border-border rounded-xl p-3.5 bg-card shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span className="h-5 w-5 rounded-full bg-emerald-800 text-white inline-flex items-center justify-center text-xs font-black">
                  4
                </span>
                Why 4: Why did that failure occur? (Maintenance / Inspection System)
              </span>
            </div>
            <Input
              value={why4}
              onChange={(e) => setWhy4(e.target.value)}
              placeholder="e.g. The hose was 6 months past its recommended service life and was not flagged during PM."
              className="text-xs bg-background"
            />
          </div>

          <div className="flex justify-center -my-2 text-muted-foreground">
            <ArrowDown className="h-4 w-4" />
          </div>

          {/* Why 5 */}
          <div className="border-2 border-[#00A651] rounded-xl p-3.5 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <span className="h-5 w-5 rounded-full bg-[#00A651] text-white inline-flex items-center justify-center text-xs font-black">
                  5
                </span>
                Why 5: Why did the system permit this? (Organizational / Root Cause)
              </span>
              <Badge className="bg-[#00A651] text-white text-[10px]">Root Cause</Badge>
            </div>
            <Input
              value={why5}
              onChange={(e) => setWhy5(e.target.value)}
              placeholder="e.g. Preventive maintenance checklist did not include a mandatory hose expiration date audit."
              className="text-xs bg-background border-[#00A651]/40"
            />
          </div>
        </div>

        {/* Root Cause Summary & 5M Categorization */}
        <div className="border-t border-border pt-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Root Cause Classification (5M / Ishikawa Model)
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {FIVE_M_CATEGORIES.map((cat) => {
                const selected = rootCauseCategory === cat.id;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setRootCauseCategory(cat.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      selected
                        ? "border-[#00A651] bg-[#00A651]/10 text-foreground font-bold shadow-xs"
                        : "border-border bg-card hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <div className="text-base">{cat.icon}</div>
                    <div className="text-xs mt-1 font-semibold text-foreground">{cat.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                      {cat.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold">Synthesized Root Cause Finding *</Label>
              <Textarea
                value={rootCauseSummary}
                onChange={(e) => setRootCauseSummary(e.target.value)}
                placeholder="Final summary of the underlying root cause determined from the 5-Whys..."
                className="text-xs mt-1 h-20"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">Recommended Permanent Preventive Measures</Label>
              <Textarea
                value={preventiveMeasures}
                onChange={(e) => setPreventiveMeasures(e.target.value)}
                placeholder="Engineering or administrative controls to guarantee this root cause cannot recur..."
                className="text-xs mt-1 h-20"
              />
            </div>
          </div>
        </div>

        {/* Binding CAPA Box */}
        <div className="border border-border rounded-xl p-4 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-[#00A651]" />
              ISO 45001 Binding Corrective Action (CAPA)
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {capaId
                ? "A corrective action has been bound to this root cause and logged in the CAPA register."
                : "Generate a tracked action item assigned to safety managers with an enforceable due date."}
            </p>
          </div>

          {capaId ? (
            <Badge className="bg-[#00A651] text-white py-1 px-3 gap-1.5 text-xs font-bold shrink-0">
              <CheckCircle2 className="h-4 w-4" /> CAPA Active & Linked
            </Badge>
          ) : (
            <Button
              type="button"
              onClick={handleCreateCapa}
              disabled={creatingCapa}
              className="bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-bold gap-1.5 shrink-0"
            >
              <Sparkles className="h-4 w-4" />
              {creatingCapa ? "Creating CAPA..." : "Generate Binding CAPA"}
            </Button>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Close
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => handleSave(false)}
            className="text-xs"
          >
            Save Draft
          </Button>

          <Button
            type="button"
            disabled={saving}
            onClick={() => handleSave(true)}
            className="bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-bold gap-1"
          >
            <CheckCircle2 className="h-4 w-4" />
            {saving ? "Saving..." : "Finalize 5-Whys RCA"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
