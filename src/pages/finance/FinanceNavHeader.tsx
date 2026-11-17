import React from "react";

interface FinanceNavHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function FinanceNavHeader({ title, subtitle, actions }: FinanceNavHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">{subtitle}</p>
        )}
      </div>

      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
