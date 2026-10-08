import { Construction } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { strings } from '@/strings';

/** Stands in for a screen that a later issue builds. */
export function ComingSoon() {
  return (
    <EmptyState
      icon={Construction}
      title={strings.placeholder.title}
      description={strings.placeholder.description}
    />
  );
}
