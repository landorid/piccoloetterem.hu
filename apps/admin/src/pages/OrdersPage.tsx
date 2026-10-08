import { PageHeader } from '@/components/PageHeader';
import { ComingSoon } from '@/pages/ComingSoon';
import { strings } from '@/strings';

/** The orders of one day. Built in S2 (#37). */
export function OrdersPage() {
  return (
    <>
      <PageHeader
        title={strings.pages.orders.title}
        description={strings.pages.orders.description}
      />
      <ComingSoon />
    </>
  );
}
