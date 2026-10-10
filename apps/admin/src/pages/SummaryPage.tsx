import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { DayNavigator } from '@/components/DayNavigator';
import { LoadingState } from '@/components/LoadingState';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateLong, fromIsoDate, toIsoDate } from '@/dates';
import { useDateParam } from '@/hooks/use-date-param';
import { DeliveryList } from '@/pages/summary/DeliveryList';
import { KitchenSummary } from '@/pages/summary/KitchenSummary';
import { configQuery } from '@/queries';
import { strings } from '@/strings';

const tabs = ['kitchen', 'delivery'] as const;
type Tab = (typeof tabs)[number];

/** Only the open tab is rendered, so printing prints it under this heading. */
function PrintTitle({ date, tab }: { date: string; tab: Tab }) {
  const config = useQuery(configQuery);
  const day = fromIsoDate(date);
  return (
    <div className="hidden print:block">
      <p className="text-sm">{config.data?.name ?? strings.appName}</p>
      <h1 className="font-semibold text-xl">
        {strings.summary.tabs[tab]}
        {day && ` – ${formatDateLong(day)}`}
      </h1>
    </div>
  );
}

/**
 * The kitchen summary and the courier's delivery list of one day (S3, #38), both printable on A4
 * (`@media print` in index.css). The day is in the URL (`?date=`), and so is the tab (`?tab=`).
 */
export function SummaryPage() {
  const [date, setDate] = useDateParam(toIsoDate(new Date()));
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: Tab = tabs.find((each) => each === requested) ?? 'kitchen';

  const setTab = (next: string) =>
    setParams((current) => {
      const updated = new URLSearchParams(current);
      updated.set('tab', next);
      return updated;
    });

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={strings.pages.summary.title}
          description={strings.pages.summary.description}
          actions={
            <>
              {date && <DayNavigator value={date} onChange={setDate} />}
              <Button variant="outline" onClick={() => window.print()}>
                <Printer />
                {strings.summary.print}
              </Button>
            </>
          }
        />
      </div>
      {date ? (
        <Tabs value={tab} onValueChange={setTab} className="gap-4">
          <TabsList className="print:hidden">
            {tabs.map((each) => (
              <TabsTrigger key={each} value={each}>
                {strings.summary.tabs[each]}
              </TabsTrigger>
            ))}
          </TabsList>
          <PrintTitle date={date} tab={tab} />
          <TabsContent value="kitchen">
            <KitchenSummary date={date} />
          </TabsContent>
          <TabsContent value="delivery">
            <DeliveryList date={date} />
          </TabsContent>
        </Tabs>
      ) : (
        <LoadingState />
      )}
    </>
  );
}
