import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Buttons for the whole page, shown on the right. */
  actions?: ReactNode;
};

/** The title row of a staff screen: its `h1`, an optional line under it, and page actions. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
