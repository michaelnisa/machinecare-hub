import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Trophy,
  Medal,
  Award,
  Sparkles,
  CheckCircle2,
  Calendar,
  Users,
  HardHat,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  FileCheck,
  Printer,
  ChevronLeft,
  ChevronRight,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/PageLoader";
import { toast } from "sonner";

export default function SafetyLeaderboard() {
  const { profile } = useAuth();
  const orgId = profile?.organisation_id;

  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [contractors, setContractors] = useState<any[]>([]);
  const [toolboxTalks, setToolboxTalks] = useState<any[]>([]);
  const [suspensions, setSuspensions] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [correctiveActions, setCorrectiveActions] = useState<any[]>([]);

  // Month Range
  const { monthStart, monthEnd, monthLabel } = useMemo(() => {
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);
    const label = start.toLocaleString("default", { month: "long", year: "numeric" });
    return { monthStart: start.toISOString(), monthEnd: end.toISOString(), monthLabel: label };
  }, [selectedDate]);

  const loadData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [
        { data: contData },
        { data: tbtData },
        { data: suspData },
        { data: incData },
        { data: empData },
        { data: capaData },
      ] = await Promise.all([
        supabase.from("contractors").select("*").eq("organisation_id", orgId),
        (supabase as any)
          .from("contractor_toolbox_talks")
          .select("*")
          .eq("organisation_id", orgId)
          .gte("talk_date", monthStart.slice(0, 10))
          .lte("talk_date", monthEnd.slice(0, 10)),
        (supabase as any)
          .from("contractor_work_suspensions")
          .select("*")
          .eq("organisation_id", orgId)
          .gte("created_at", monthStart)
          .lte("created_at", monthEnd),
        supabase
          .from("safety_incidents")
          .select("*")
          .eq("organisation_id", orgId)
          .gte("occurred_at", monthStart)
          .lte("occurred_at", monthEnd),
        supabase.from("profiles").select("*").eq("organisation_id", orgId),
        supabase
          .from("corrective_actions")
          .select("*")
          .eq("organisation_id", orgId)
          .gte("closed_at", monthStart)
          .lte("closed_at", monthEnd),
      ]);

      setContractors(contData || []);
      setToolboxTalks(tbtData || []);
      setSuspensions(suspData || []);
      setIncidents(incData || []);
      setEmployees(empData || []);
      setCorrectiveActions(capaData || []);
    } catch (e: any) {
      console.error("Failed to load leaderboard data:", e);
      toast.error("Failed to load safety leaderboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [orgId, selectedDate]);

  const prevMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
  };

  // 1. Calculate Contractor Scores
  const contractorLeaderboard = useMemo(() => {
    return contractors.map((c) => {
      const tbts = toolboxTalks.filter((t) => t.contractor_id === c.id);
      const susp = suspensions.filter((s) => s.contractor_id === c.id);
      const contractorIncidents = incidents.filter((i) => i.location?.includes(c.name));

      const tbtCount = tbts.length;
      const safeHours = tbts.reduce((acc, t) => acc + Number(t.man_hours || 0), 0);
      const suspensionsCount = susp.length;
      const hasZeroIncidents = contractorIncidents.length === 0;

      // Score Calculation
      let score = tbtCount * 20 + Math.round(safeHours / 5);
      if (hasZeroIncidents && (tbtCount > 0 || safeHours > 0)) {
        score += 50; // Zero Incident Bonus
      }
      score -= suspensionsCount * 25;
      if (score < 0) score = 0;

      let tier = "Bronze";
      if (score >= 200) tier = "Platinum";
      else if (score >= 100) tier = "Gold";
      else if (score >= 50) tier = "Silver";

      return {
        ...c,
        tbtCount,
        safeHours,
        suspensionsCount,
        incidentCount: contractorIncidents.length,
        score,
        tier,
      };
    }).sort((a, b) => b.score - a.score);
  }, [contractors, toolboxTalks, suspensions, incidents]);

  // 2. Calculate Employee Safety Champions
  const employeeLeaderboard = useMemo(() => {
    return employees.map((emp) => {
      // Near miss / hazard reports created by employee
      const nearMisses = incidents.filter(
        (i) => i.created_by === emp.id && (i.incident_type === "near_miss" || i.incident_type === "hazard")
      ).length;

      // Total TBT attendances
      let tbtAttendance = 0;
      toolboxTalks.forEach((t) => {
        const attendees = Array.isArray(t.attendees) ? t.attendees : [];
        if (
          t.supervisor_name?.toLowerCase() === emp.full_name?.toLowerCase() ||
          attendees.some((a: any) =>
            typeof a === "string"
              ? a.toLowerCase().includes(emp.full_name?.toLowerCase() || "")
              : a.name?.toLowerCase().includes(emp.full_name?.toLowerCase() || "")
          )
        ) {
          tbtAttendance++;
        }
      });

      // CAPAs resolved/closed
      const capasResolved = correctiveActions.filter(
        (c) => c.verified_by === emp.id || c.responsible_person?.toLowerCase() === emp.full_name?.toLowerCase()
      ).length;

      const score = nearMisses * 25 + tbtAttendance * 15 + capasResolved * 20;

      let badge = "Safety Contributor";
      if (score >= 150) badge = "Safety Master";
      else if (score >= 80) badge = "Safety Champion";
      else if (score >= 40) badge = "Proactive Guardian";

      return {
        ...emp,
        nearMisses,
        tbtAttendance,
        capasResolved,
        score,
        badge,
      };
    }).sort((a, b) => b.score - a.score);
  }, [employees, incidents, toolboxTalks, correctiveActions]);

  const handlePrintCertificate = (winnerName: string, category: string, score: number) => {
    const printWin = window.open("", "_blank");
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Safety Champion Certificate - ${winnerName}</title>
          <style>
            @page { size: landscape; margin: 15mm; }
            body {
              font-family: 'Times New Roman', serif;
              text-align: center;
              padding: 40px;
              color: #1a202c;
              background: #fff;
            }
            .cert-border {
              border: 10px solid #00A651;
              padding: 40px;
              border-radius: 12px;
              outline: 3px solid #16a34a;
              outline-offset: -18px;
            }
            .title {
              font-size: 38px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 3px;
              color: #00A651;
              margin-bottom: 8px;
            }
            .subtitle {
              font-size: 18px;
              font-style: italic;
              color: #4a5568;
              margin-bottom: 24px;
            }
            .presented {
              font-size: 16px;
              text-transform: uppercase;
              letter-spacing: 2px;
              color: #718096;
            }
            .winner {
              font-size: 42px;
              font-weight: bold;
              color: #111;
              margin: 16px 0;
              text-decoration: underline;
              text-decoration-color: #00A651;
            }
            .reason {
              font-size: 18px;
              max-width: 650px;
              margin: 16px auto 32px;
              line-height: 1.5;
            }
            .stats {
              font-family: sans-serif;
              font-size: 14px;
              font-weight: bold;
              background: #f0fdf4;
              display: inline-block;
              padding: 8px 24px;
              border-radius: 20px;
              border: 1px solid #00A651;
              color: #166534;
            }
            .signatures {
              margin-top: 50px;
              display: flex;
              justify-content: space-around;
            }
            .sig-line {
              width: 200px;
              border-top: 2px solid #333;
              padding-top: 6px;
              font-size: 13px;
              font-family: sans-serif;
              color: #333;
            }
          </style>
        </head>
        <body>
          <div class="cert-border">
            <div class="title">Certificate of Safety Excellence</div>
            <div class="subtitle">ISO 45001 Proactive EHS Recognition Award</div>
            <div class="presented">This official distinction is proudly conferred upon</div>
            <div class="winner">${winnerName}</div>
            <div class="reason">
              For demonstrating outstanding commitment to site safety, conducting daily Toolbox Talks, zero incident compliance, and championing the culture of harm prevention for <strong>${monthLabel}</strong>.
            </div>
            <div class="stats">
              Category: ${category} &nbsp;•&nbsp; Safety Score: ${score} Points &nbsp;•&nbsp; Period: ${monthLabel}
            </div>
            <div class="signatures">
              <div class="sig-line">EHS Department Manager</div>
              <div class="sig-line">Plant Operations Director</div>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  if (loading && contractors.length === 0) return <PageLoader />;

  const topContractors = contractorLeaderboard.slice(0, 3);
  const topEmployees = employeeLeaderboard.slice(0, 3);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header & Month Navigator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Monthly Safety Champion Leaderboard</h1>
            <Badge className="bg-[#00A651] text-white text-xs font-bold">ISO 45001 Culture</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Recognizing contractor teams and employees with the highest safety participation, clean audits, and completed daily toolbox talks.
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2 bg-card border border-border p-1.5 rounded-xl shadow-xs">
          <Button variant="ghost" size="sm" onClick={prevMonth} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1.5 px-3 text-xs font-bold text-foreground">
            <Calendar className="h-4 w-4 text-[#00A651]" />
            {monthLabel}
          </div>
          <Button variant="ghost" size="sm" onClick={nextMonth} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="contractors" className="space-y-6">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="contractors" className="gap-2 text-xs font-bold">
            <HardHat className="h-4 w-4 text-[#00A651]" /> Contractor Teams ({contractorLeaderboard.length})
          </TabsTrigger>
          <TabsTrigger value="employees" className="gap-2 text-xs font-bold">
            <Users className="h-4 w-4 text-[#00A651]" /> Internal Champions ({employeeLeaderboard.length})
          </TabsTrigger>
        </TabsList>

        {/* 1. CONTRACTOR TEAMS TAB */}
        <TabsContent value="contractors" className="space-y-6">
          {/* Olympic Style Podium for Top 3 Contractors */}
          {topContractors.length > 0 && topContractors[0].score > 0 && (
            <div className="bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 rounded-2xl p-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-[#00A651] text-xs font-black uppercase tracking-wider">
                  <Trophy className="h-4 w-4" /> Monthly Podium of Honor
                </div>
                <h2 className="text-xl font-bold mt-1 text-slate-900 dark:text-white">
                  Top Safety Contractor Teams — {monthLabel}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end max-w-3xl mx-auto">
                {/* 2nd Place (Silver) */}
                {topContractors[1] && (
                  <div className="bg-card border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center order-2 md:order-1 shadow-sm">
                    <div className="h-10 w-10 mx-auto rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black text-lg mb-2">
                      2
                    </div>
                    <Badge variant="outline" className="text-[10px] border-slate-400 text-slate-600 font-bold mb-1">
                      Silver Shield
                    </Badge>
                    <div className="font-bold text-sm text-foreground truncate">{topContractors[1].name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {topContractors[1].tbtCount} TBTs • {topContractors[1].safeHours}h
                    </div>
                    <div className="text-xl font-black text-[#00A651] mt-2">{topContractors[1].score} pts</div>
                  </div>
                )}

                {/* 1st Place (Gold Champion) */}
                {topContractors[0] && (
                  <div className="bg-card border-2 border-amber-400 dark:border-amber-500 rounded-xl p-5 text-center order-1 md:order-2 shadow-lg relative -mt-4">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 font-black text-[10px] px-3 py-0.5 rounded-full uppercase tracking-wider shadow">
                      1st Place Champion
                    </div>
                    <div className="h-14 w-14 mx-auto rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-black text-2xl my-2">
                      🏆
                    </div>
                    <div className="font-black text-base text-foreground truncate">{topContractors[0].name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {topContractors[0].tbtCount} TBTs Briefed • {topContractors[0].safeHours} Man-Hours
                    </div>
                    <div className="text-2xl font-black text-[#00A651] mt-2">{topContractors[0].score} pts</div>

                    <Button
                      size="sm"
                      onClick={() => handlePrintCertificate(topContractors[0].name, "Contractor Team", topContractors[0].score)}
                      className="mt-3 w-full bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-bold gap-1 h-8"
                    >
                      <Printer className="h-3.5 w-3.5" /> Award Certificate
                    </Button>
                  </div>
                )}

                {/* 3rd Place (Bronze) */}
                {topContractors[2] && (
                  <div className="bg-card border border-amber-800/30 rounded-xl p-4 text-center order-3 shadow-sm">
                    <div className="h-10 w-10 mx-auto rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 flex items-center justify-center font-black text-lg mb-2">
                      3
                    </div>
                    <Badge variant="outline" className="text-[10px] border-amber-700/40 text-amber-800 dark:text-amber-300 font-bold mb-1">
                      Bronze Shield
                    </Badge>
                    <div className="font-bold text-sm text-foreground truncate">{topContractors[2].name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {topContractors[2].tbtCount} TBTs • {topContractors[2].safeHours}h
                    </div>
                    <div className="text-xl font-black text-[#00A651] mt-2">{topContractors[2].score} pts</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Full Contractor Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Contractor EHS Performance Standings</h3>
                <p className="text-xs text-muted-foreground">Scored on Toolbox Talks (+20), Safe Hours (+1/5h), Zero-Incident Bonus (+50), Suspensions (-25).</p>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-5 py-3">Rank</th>
                  <th className="px-5 py-3">Contractor Company</th>
                  <th className="px-5 py-3">Toolbox Talks</th>
                  <th className="px-5 py-3">Safe Man-Hours</th>
                  <th className="px-5 py-3">Zero Incidents</th>
                  <th className="px-5 py-3">Suspensions</th>
                  <th className="px-5 py-3 text-right">Total Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contractorLeaderboard.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5 font-black text-muted-foreground">
                      {idx === 0 ? "🥇 #1" : idx === 1 ? "🥈 #2" : idx === 2 ? "🥉 #3" : `#${idx + 1}`}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-foreground">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.contact_person || c.service_type || "Vendor"}</div>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-foreground">
                      {c.tbtCount} talks
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">
                      {c.safeHours} hrs
                    </td>
                    <td className="px-5 py-3.5">
                      {c.incidentCount === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Clean (+50)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 font-semibold">
                          <AlertTriangle className="h-3.5 w-3.5" /> {c.incidentCount} incidents
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-semibold">
                      {c.suspensionsCount > 0 ? (
                        <span className="text-red-600">-{c.suspensionsCount * 25} pts</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-black text-base text-[#00A651]">
                      {c.score} <span className="text-xs font-normal text-muted-foreground">pts</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* 2. EMPLOYEES & WORKERS TAB */}
        <TabsContent value="employees" className="space-y-6">
          {/* Top 3 Employees */}
          {topEmployees.length > 0 && topEmployees[0].score > 0 && (
            <div className="bg-gradient-to-b from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 rounded-2xl p-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-black uppercase tracking-wider">
                  <Star className="h-4 w-4" /> Internal Safety Champions
                </div>
                <h2 className="text-xl font-bold mt-1 text-slate-900 dark:text-white">
                  Top Proactive Safety Contributors — {monthLabel}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end max-w-3xl mx-auto">
                {/* 2nd Place */}
                {topEmployees[1] && (
                  <div className="bg-card border border-border rounded-xl p-4 text-center order-2 md:order-1 shadow-sm">
                    <div className="h-10 w-10 mx-auto rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black text-lg mb-2">
                      2
                    </div>
                    <div className="font-bold text-sm text-foreground truncate">{topEmployees[1].full_name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {topEmployees[1].nearMisses} Near-Misses • {topEmployees[1].tbtAttendance} TBTs
                    </div>
                    <div className="text-xl font-black text-[#00A651] mt-2">{topEmployees[1].score} pts</div>
                  </div>
                )}

                {/* 1st Place */}
                {topEmployees[0] && (
                  <div className="bg-card border-2 border-emerald-500 rounded-xl p-5 text-center order-1 md:order-2 shadow-lg relative -mt-4">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00A651] text-white font-black text-[10px] px-3 py-0.5 rounded-full uppercase tracking-wider shadow">
                      Safety Champion of the Month
                    </div>
                    <div className="h-14 w-14 mx-auto rounded-full bg-emerald-100 text-[#00A651] flex items-center justify-center font-black text-2xl my-2">
                      🌟
                    </div>
                    <div className="font-black text-base text-foreground truncate">{topEmployees[0].full_name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {topEmployees[0].nearMisses} Hazards/Near Misses Reported • {topEmployees[0].capasResolved} CAPAs Closed
                    </div>
                    <div className="text-2xl font-black text-[#00A651] mt-2">{topEmployees[0].score} pts</div>

                    <Button
                      size="sm"
                      onClick={() => handlePrintCertificate(topEmployees[0].full_name, "Internal Employee", topEmployees[0].score)}
                      className="mt-3 w-full bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-bold gap-1 h-8"
                    >
                      <Printer className="h-3.5 w-3.5" /> Print Certificate
                    </Button>
                  </div>
                )}

                {/* 3rd Place */}
                {topEmployees[2] && (
                  <div className="bg-card border border-border rounded-xl p-4 text-center order-3 shadow-sm">
                    <div className="h-10 w-10 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-black text-lg mb-2">
                      3
                    </div>
                    <div className="font-bold text-sm text-foreground truncate">{topEmployees[2].full_name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {topEmployees[2].nearMisses} Near-Misses • {topEmployees[2].tbtAttendance} TBTs
                    </div>
                    <div className="text-xl font-black text-[#00A651] mt-2">{topEmployees[2].score} pts</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Full Employee Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-5 py-3">Rank</th>
                  <th className="px-5 py-3">Employee Name</th>
                  <th className="px-5 py-3">Near-Misses Reported</th>
                  <th className="px-5 py-3">TBT Participations</th>
                  <th className="px-5 py-3">CAPAs Resolved</th>
                  <th className="px-5 py-3">Distinction Badge</th>
                  <th className="px-5 py-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {employeeLeaderboard.map((emp, idx) => (
                  <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5 font-black text-muted-foreground">
                      #{idx + 1}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-foreground">
                      {emp.full_name}
                      <span className="block text-xs font-normal text-muted-foreground capitalize">
                        {emp.role || emp.department || "Staff"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-emerald-600">
                      {emp.nearMisses} (+{emp.nearMisses * 25} pts)
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">
                      {emp.tbtAttendance} sessions
                    </td>
                    <td className="px-5 py-3.5 text-xs font-semibold">
                      {emp.capasResolved} closed
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant="outline" className="text-xs border-[#00A651]/40 text-[#00A651]">
                        {emp.badge}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right font-black text-base text-[#00A651]">
                      {emp.score} <span className="text-xs font-normal text-muted-foreground">pts</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
