import { cn } from 'cn';
import { Skeleton } from '@/components/ui/skeleton';
import { strings } from '@/strings';

type LoadingStateProps = {
  /** How many skeleton rows stand in for the content. */
  rows?: number;
  className?: string;
};

/** Content that is still loading: skeleton rows, announced to screen readers. */
export function LoadingState({ rows = 3, className }: LoadingStateProps) {
  const keys = Array.from({ length: rows }, (_, row) => `row-${row}`);
  return (
    <div role="status" aria-busy="true" className={cn('flex flex-col gap-3', className)}>
      <span className="sr-only">{strings.loading}</span>
      {keys.map((key) => (
        <Skeleton key={key} className="h-10 w-full" />
      ))}
    </div>
  );
}
