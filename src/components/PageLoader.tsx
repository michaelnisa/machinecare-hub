import { ReactNode, isValidElement, ComponentType } from "react";
import { Loader2 } from "lucide-react";

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

interface EmptyProps {
  icon?: ReactNode | ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyProps) {
  const renderedIcon = (() => {
    if (!icon) return null;
    if (isValidElement(icon)) return icon;
    if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
      const IconComp = icon as ComponentType<{ className?: string }>;
      try {
        return <IconComp className="h-6 w-6" />;
      } catch {
        return null;
      }
    }
    return null;
  })();

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 px-6 py-16 text-center">
      {renderedIcon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          {renderedIcon}
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

