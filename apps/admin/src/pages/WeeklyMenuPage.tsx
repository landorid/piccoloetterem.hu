import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { LoadingState } from '@/components/LoadingState';
import { PageHeader } from '@/components/PageHeader';
import { formatWeek, parseWeek } from '@/pages/weeklyMenu/model';
import { defaultWeekQuery } from '@/pages/weeklyMenu/queries';
import { WeekEditor } from '@/pages/weeklyMenu/WeekEditor';
import { strings } from '@/strings';

/**
 * The weekly menu grid editor (M5, #27). The week is in the URL (`?week=2026-W42`), so a reload
 * stays on it. Without one, the page opens on the API's default week (the week guests order from
 * next) and writes it into the URL.
 */
export function WeeklyMenuPage() {
  const [params, setParams] = useSearchParams();
  const requested = parseWeek(params.get('week'));
  const fallback = useQuery({ ...defaultWeekQuery, enabled: requested === null });
  const week = requested ?? fallback.data;

  useEffect(() => {
    if (requested === null && fallback.data) {
      setParams({ week: formatWeek(fallback.data) }, { replace: true });
    }
  }, [requested, fallback.data, setParams]);

  if (!week) {
    return (
      <>
        <PageHeader
          title={strings.pages.weeklyMenu.title}
          description={strings.pages.weeklyMenu.description}
        />
        <LoadingState rows={8} />
      </>
    );
  }
  return (
    <WeekEditor
      key={formatWeek(week)}
      week={week}
      onWeekChange={(next) => setParams({ week: formatWeek(next) })}
    />
  );
}
