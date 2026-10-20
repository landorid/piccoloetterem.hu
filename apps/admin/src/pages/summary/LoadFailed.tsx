import { CircleAlert } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { strings } from '@/strings';

/** A tab whose first load failed. The global toast already said why; this offers a retry. */
export function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      icon={CircleAlert}
      title={strings.summary.loadFailed.title}
      description={strings.summary.loadFailed.description}
      action={
        <Button variant="outline" onClick={onRetry}>
          {strings.summary.loadFailed.retry}
        </Button>
      }
    />
  );
}
