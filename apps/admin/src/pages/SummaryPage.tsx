import { PageHeader } from '@/components/PageHeader';
import { ComingSoon } from '@/pages/ComingSoon';
import { strings } from '@/strings';

/** The kitchen summary and delivery list of one day. Built in S3 (#38). */
export function SummaryPage() {
  return (
    <>
      <PageHeader
        title={strings.pages.summary.title}
        description={strings.pages.summary.description}
      />
      <ComingSoon />
    </>
  );
}
