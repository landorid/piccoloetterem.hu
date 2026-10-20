import { cn } from 'cn';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** A button or link that gets the user out of the empty state. */
  action?: ReactNode;
  className?: string;
};

/** Nothing to show: no data yet, no results, no access. shadcn's `Empty` with a border. */
export function EmptyState({ title, description, icon: Icon, action, className }: EmptyStateProps) {
  return (
    <Empty className={cn('border', className)}>
      <EmptyHeader>
        {Icon && (
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
        )}
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
