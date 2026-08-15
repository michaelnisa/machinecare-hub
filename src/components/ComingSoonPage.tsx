import { Link } from "react-router-dom";
import { ArrowLeft, Construction } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  phase: number;
  description: string;
  icon?: LucideIcon;
  backTo?: string;
  backLabel?: string;
}

export function ComingSoonPage({ title, phase, description, icon: Icon = Construction, backTo = "/production/overview", backLabel = "Production Overview" }: Props) {
  return (
    <div className="space-y-6 animate-fade-in">
      <Link to={backTo} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
      </Link>
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 px-6 py-24 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <span className="mt-2 rounded-full bg-muted px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Coming in Phase {phase}
        </span>
        <p className="mt-4 max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
