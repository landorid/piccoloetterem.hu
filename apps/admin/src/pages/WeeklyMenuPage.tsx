import { PageHeader } from '@/components/PageHeader';
import { ComingSoon } from '@/pages/ComingSoon';
import { strings } from '@/strings';

/** The weekly menu grid editor. Built in M5 (#27). */
export function WeeklyMenuPage() {
  return (
    <>
      <PageHeader
        title={strings.pages.weeklyMenu.title}
        description={strings.pages.weeklyMenu.description}
      />
      <ComingSoon />
    </>
  );
}
