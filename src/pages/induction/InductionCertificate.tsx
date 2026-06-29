import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/PageLoader";
import { ArrowLeft, Printer, Award } from "lucide-react";
import { formatDate } from "@/lib/format";

export default function InductionCertificate() {
  const { recordId } = useParams<{ recordId: string }>();
  const nav = useNavigate();
  const { organisation } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      if (!recordId) return;
      const { data: rec } = await supabase
        .from("induction_records")
        .select("*")
        .eq("id", recordId)
        .maybeSingle();
      if (!rec) { setLoading(false); return; }
      const [{ data: prog }, { data: ind }] = await Promise.all([
        supabase.from("induction_programmes").select("name").eq("id", rec.programme_id).maybeSingle(),
        supabase.from("inductees").select("full_name,company,inductee_type").eq("id", rec.inductee_id).maybeSingle(),
      ]);
      setData({ rec, prog, ind });
      setLoading(false);
    })();
  }, [recordId]);

  if (loading) return <PageLoader />;
  if (!data?.rec || !data.prog || !data.ind) return <div className="p-6 text-sm text-muted-foreground">Not found.</div>;

  const { rec, prog, ind } = data;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 print:py-0">
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" onClick={() => nav("/induction/inductees")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> {t.induction.backToInductees}
          </Button>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> {t.induction.print}
          </Button>
        </div>

        <div className="rounded-2xl border-2 border-primary/30 bg-card p-8 sm:p-14 text-center shadow-sm print:border-primary print:shadow-none">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Award className="h-8 w-8" />
          </div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{organisation?.name ?? "MachineCare"}</div>
          <h1 className="mt-4 font-serif text-3xl sm:text-4xl font-bold tracking-tight">{t.induction.certificate}</h1>
          <p className="mt-6 text-sm text-muted-foreground">{t.induction.certificateBody}</p>
          <p className="mt-3 font-serif text-2xl sm:text-3xl font-semibold">{ind.full_name}</p>
          {ind.company && <p className="mt-1 text-sm text-muted-foreground">{ind.company}</p>}
          <p className="mt-6 text-sm text-muted-foreground">{t.induction.hasCompleted}</p>
          <p className="mt-2 text-lg font-medium">{prog.name}</p>
          <p className="mt-6 text-sm text-muted-foreground">
            {t.induction.onDate} <span className="font-medium text-foreground">{formatDate(rec.completed_at)}</span>
            {rec.overall_score_percent != null && <> · {t.induction.score}: <span className="font-medium text-foreground">{rec.overall_score_percent}%</span></>}
          </p>
          {rec.expires_at && (
            <p className="mt-1 text-xs text-muted-foreground">{t.induction.validUntil} {formatDate(rec.expires_at)}</p>
          )}

          {rec.digital_signature_url && (
            <div className="mx-auto mt-10 max-w-xs">
              <img src={rec.digital_signature_url} alt="signature" className="mx-auto h-20 object-contain" />
              <div className="mt-1 border-t border-border pt-1 text-xs text-muted-foreground">{t.induction.signaturePrompt}</div>
            </div>
          )}

          <div className="mt-10 text-[10px] uppercase tracking-widest text-muted-foreground">ID: {rec.id.slice(0, 8)}</div>
        </div>
      </div>
    </div>
  );
}
