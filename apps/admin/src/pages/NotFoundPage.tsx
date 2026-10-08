import { SearchX } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { paths } from '@/paths';
import { strings } from '@/strings';

/** A staff URL that matches no screen. */
export function NotFoundPage() {
  return (
    <EmptyState
      icon={SearchX}
      title={strings.notFound.title}
      description={strings.notFound.description}
      action={
        <Button variant="outline" asChild>
          <Link to={paths.orders}>{strings.notFound.back}</Link>
        </Button>
      }
    />
  );
}
