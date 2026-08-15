import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/PageLoader";
import { Printer, ArrowLeft } from "lucide-react";

const RESPONSE_LABEL: Record<string, string> = {
  pass_fail: "Pass / Fail",
  tri_state: "OK / Not OK / N/A",
  measurement: "Measurement",
  text: "Notes",
  photo_required: "Photo",
};

export default function ChecklistTemplatePrint() {
  const { id } = useParams<{ id: string }>();
  const { organisation } = useAuth();
  const [template, setTemplate] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [{ data: t }, { data: its }] = await Promise.all([
        supabase.from("checklist_templates").select("*").eq("id", id).maybeSingle(),
        supabase.from("checklist_template_items").select("*").eq("template_id", id).order("sort_order"),
      ]);
      setTemplate(t);
      setItems(its ?? []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <PageLoader />;
  if (!template) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Template not found.</p>
        <Link to="/checklist-templates" className="text-primary hover:underline">Back to templates</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 print:bg-white">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 py-3 print:hidden">
        <Link to={`/checklist-templates/${id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div>

      <div className="mx-auto my-6 w-[210mm] min-h-[297mm] bg-white p-[18mm] text-[11pt] text-slate-900 shadow-lg print:my-0 print:w-auto print:min-h-0 print:p-[14mm] print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-teal-600 pb-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Inspection Checklist</div>
            <div className="mt-1 text-2xl font-bold tracking-tight">{template.name}</div>
            <div className="mt-1 text-xs text-slate-500">
              v{template.version} · {template.machine_category ? `Category: ${template.machine_category}` : "Any machine"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">{organisation?.name ?? "—"}</div>
          </div>
        </div>

        {template.description && (
          <p className="mt-3 text-sm text-slate-700">{template.description}</p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-4 text-xs">
          <Field label="Machine / Asset" />
          <Field label="Date" />
          <Field label="Inspector" />
          <Field label="Shift" />
        </div>

        <table className="mt-5 w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className="w-8 border border-slate-300 px-2 py-1.5 font-medium">#</th>
              <th className="border border-slate-300 px-2 py-1.5 font-medium">Item</th>
              <th className="w-40 border border-slate-300 px-2 py-1.5 font-medium">Result</th>
              <th className="w-32 border border-slate-300 px-2 py-1.5 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id}>
                <td className="border border-slate-300 px-2 py-2 align-top text-slate-500">{idx + 1}</td>
                <td className="border border-slate-300 px-2 py-2 align-top">
                  {it.text}
                  {it.severity === "critical" && <span className="ml-1 text-[9px] font-semibold uppercase text-red-600">Critical</span>}
                </td>
                <td className="border border-slate-300 px-2 py-2 align-top">
                  <ResponseArea item={it} />
                </td>
                <td className="border border-slate-300 px-2 py-2 align-top">&nbsp;</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="border border-slate-300 px-2 py-6 text-center text-slate-400">
                  No items in this template yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <section className="mt-8 grid grid-cols-2 gap-8">
          <SignatureBlock label="Inspector sign-off" />
          <SignatureBlock label="Supervisor sign-off" />
        </section>

        <div className="mt-8 border-t border-slate-200 pt-2 text-center text-[9pt] text-slate-400">
          {organisation?.name} · {template.name} v{template.version} · Generated {new Date().toLocaleDateString()}
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

function Field({ label }: { label: string }) {
  return (
    <div>
      <div className="text-[9pt] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 border-b border-slate-300 pb-1">&nbsp;</div>
    </div>
  );
}

function ResponseArea({ item }: { item: any }) {
  switch (item.item_type) {
    case "pass_fail":
      return <span>&#9744; Pass &nbsp; &#9744; Fail</span>;
    case "tri_state":
      return <span>&#9744; OK &nbsp; &#9744; Not OK &nbsp; &#9744; N/A</span>;
    case "measurement":
      return (
        <span>
          _______ {item.unit ?? ""}
          {(item.min_value != null || item.max_value != null) && (
            <div className="mt-0.5 text-[9px] text-slate-500">
              Range: {item.min_value ?? "—"}–{item.max_value ?? "—"} {item.unit ?? ""}
            </div>
          )}
        </span>
      );
    case "photo_required":
      return <span>&#128247; Attach photo</span>;
    default:
      return <span className="text-slate-400">_______________</span>;
  }
}

function SignatureBlock({ label }: { label: string }) {
  return (
    <div>
      <div className="h-12 border-b border-slate-400" />
      <div className="mt-1 text-[9pt] text-slate-500">{label}</div>
    </div>
  );
}
