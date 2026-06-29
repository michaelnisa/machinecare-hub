import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { GraduationCap, AlertTriangle, Bell, Users, CheckCircle2, Clock } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

type Inductee = { id: string; full_name: string; inductee_type: string; company: string | null };
type RecordRow = { id: string; inductee_id: string; programme_id: string; status: string; expires_at: string | null; completed_at: string | null };
type Programme = { id: string; name: string };

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

export default function InductionDashboard() {
  const { profile } = useAuth();
  const { isManager } = useUserRole();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [inductees, setInductees] = useState<Inductee[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [sending, setSending] = useState<string | null>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: ind }, { data: recs }, { data: progs }] = await Promise.all([
      supabase.from("inductees").select("id,full_name,inductee_type,company").eq("organisation_id", profile.organisation_id),
      supabase.from("induction_records").select("id,inductee_id,programme_id,status,expires_at,completed_at").eq("organisation_id", profile.organisation_id),
      supabase.from("induction_programmes").select("id,name").eq("organisation_id", profile.organisation_id),
    ]);
    setInductees((ind ?? []) as Inductee[]);
    setRecords((recs ?? []) as RecordRow[]);
    setProgrammes((progs ?? []) as Programme[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const in30 = new Date(now); in30.setDate(in30.getDate() + 30);

    const completed = records.filter((r) => r.status === "completed");
    const completedThisMonth = completed.filter((r) => r.completed_at && new Date(r.completed_at) >= monthStart).length;

    const latestByInductee = new Map<string, RecordRow>();
    for (const r of completed) {
      const cur = latestByInductee.get(r.inductee_id);
      if (!cur || (r.completed_at && cur.completed_at && r.completed_at > cur.completed_at)) latestByInductee.set(r.inductee_id, r);
    }

    let expired = 0, expiringSoon = 0, valid = 0;
    const expiringList: { rec: RecordRow; inductee: Inductee | undefined; programme: Programme | undefined }[] = [];
    for (const r of latestByInductee.values()) {
      if (!r.expires_at) { valid++; continue; }
      const exp = new Date(r.expires_at);
      if (exp < now) expired++;
      else if (exp <= in30) {
        expiringSoon++;
        expiringList.push({
          rec: r,
          inductee: inductees.find((i) => i.id === r.inductee_id),
          programme: programmes.find((p) => p.id === r.programme_id),
        });
      } else valid++;
    }
    const never = inductees.length - latestByInductee.size;
    expiringList.sort((a, b) => (a.rec.expires_at ?? "").localeCompare(b.rec.expires_at ?? ""));

    // Monthly chart (last 6 months)
    const months: { month: string; label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ month: monthKey(d), label: d.toLocaleString(undefined, { month: "short" }), count: 0 });
    }
    for (const r of completed) {
      if (!r.completed_at) continue;
      const k = monthKey(new Date(r.completed_at));
      const m = months.find((x) => x.month === k);
      if (m) m.count++;
    }

    return { total: inductees.length, completedThisMonth, expired, expiringSoon, never, expiringList, months };
  }, [records, inductees, programmes]);

  const sendReminder = async (recordId: string) => {
    if (!profile) return;
    setSending(recordId);
    const { error } = await supabase.from("induction_reminders").insert({
      organisation_id: profile.organisation_id,
      induction_record_id: recordId,
      channel: "manual",
      reminded_by: profile.id,
    });
    setSending(null);
    if (error) return toast.error(error.message);
    toast.success(t.induction.reminderSent);
  };

  if (loading) return <PageLoader />;

  const cards = [
    { label: t.induction.statTotal, value: stats.total, icon: Users, tone: "text-foreground" },
    { label: t.induction.statCompletedMonth, value: stats.completedThisMonth, icon: CheckCircle2, tone: "text-primary" },
    { label: t.induction.statExpiringSoon, value: stats.expiringSoon, icon: Clock, tone: "text-yellow-600 dark:text-yellow-400" },
    { label: t.induction.statExpired, value: stats.expired, icon: AlertTriangle, tone: "text-destructive" },
    { label: t.induction.statNever, value: stats.never, icon: GraduationCap, tone: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.induction.dashboard}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.induction.dashboardSub}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/induction/programmes"><Button variant="outline">{t.induction.programmes}</Button></Link>
          <Link to="/induction/inductees"><Button>{t.induction.inductees}</Button></Link>
        </div>
      </div>

      {inductees.length === 0 && programmes.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-5 w-5" />}
          title={t.induction.empty}
          action={isManager ? <Link to="/induction/programmes"><Button>{t.induction.newProgramme}</Button></Link> : undefined}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {cards.map((c) => (
              <div key={c.label} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.label}</span>
                  <c.icon className={`h-4 w-4 ${c.tone}`} />
                </div>
                <div className={`mt-2 text-2xl font-semibold tracking-tight ${c.tone}`}>{c.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="rounded-xl border border-border bg-card p-4 lg:col-span-3">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t.induction.monthlyCompletions}</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.months} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Clock className="h-4 w-4" /> {t.induction.expiringSoon}
              </h2>
              {stats.expiringList.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-background/40 p-6 text-center text-sm text-muted-foreground">
                  {t.induction.noExpiring}
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.expiringList.slice(0, 8).map(({ rec, inductee, programme }) => (
                    <div key={rec.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{inductee?.full_name ?? "—"}</div>
                        <div className="truncate text-xs text-muted-foreground">{programme?.name ?? "—"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="whitespace-nowrap">{formatDate(rec.expires_at)}</Badge>
                        {isManager && (
                          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => sendReminder(rec.id)} disabled={sending === rec.id}>
                            <Bell className="h-3.5 w-3.5" /> {t.induction.sendReminder}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
