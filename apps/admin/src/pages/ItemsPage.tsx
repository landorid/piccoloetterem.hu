import { PageHeader } from '@/components/PageHeader';
import { ComingSoon } from '@/pages/ComingSoon';
import { strings } from '@/strings';

/** The permanent items and their allergens. Built in M6 (#28). */
export function ItemsPage() {
  return (
    <>
      <PageHeader title={strings.pages.items.title} description={strings.pages.items.description} />
      <ComingSoon />
    </>
  );
}
