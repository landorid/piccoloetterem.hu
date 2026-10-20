import type { Slot } from '@piccolo/core';
import { useQuery } from '@tanstack/react-query';
import { ChefHat } from 'lucide-react';
import { useId } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadFailed } from '@/pages/summary/LoadFailed';
import { type DaySummary, daySummaryQuery } from '@/pages/summary/queries';
import { strings } from '@/strings';

/** The kitchen cooks mains first, so they lead; the API's `slots` order is soup first. */
const slotOrder: readonly Slot[] = ['main', 'soup', 'side', 'pickle', 'dessert'];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-1 py-4 print:rounded-none print:py-2 print:shadow-none">
      <CardHeader className="px-4 print:px-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="px-4 print:px-2">
        <CardTitle className="text-2xl tabular-nums print:text-lg">{value}</CardTitle>
      </CardContent>
    </Card>
  );
}

function CountTable({
  title,
  rows,
  withVariation,
}: {
  title: string;
  rows: readonly { name: string; variation?: string | null; count: number }[];
  withVariation: boolean;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-2 print:break-inside-avoid">
      <h2 id={id} className="font-semibold text-base">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{strings.summary.noneInSlot}</p>
      ) : (
        <Table data-print="table">
          <TableHeader>
            <TableRow>
              <TableHead>{strings.summary.columns.name}</TableHead>
              {withVariation && <TableHead>{strings.summary.columns.variation}</TableHead>}
              <TableHead className="w-20 text-right">{strings.summary.columns.count}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.name}\u0000${row.variation ?? ''}`}>
                <TableCell className="whitespace-normal">{row.name}</TableCell>
                {withVariation && (
                  <TableCell className="whitespace-normal">{row.variation}</TableCell>
                )}
                <TableCell className="text-right font-medium tabular-nums">{row.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function SummaryContent({ summary }: { summary: DaySummary }) {
  if (summary.orderCount === 0) {
    return (
      <EmptyState
        icon={ChefHat}
        title={strings.summary.noOrders.title}
        description={strings.summary.noOrders.description}
      />
    );
  }
  return (
    <div className="space-y-6 print:space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 print:grid-cols-4 print:gap-2">
        <Stat label={strings.summary.cards.orders} value={String(summary.orderCount)} />
        <Stat label={strings.summary.cards.menus} value={String(summary.menuCount)} />
        <Stat
          label={strings.summary.cards.fulfilment}
          value={`${summary.deliveryCount} / ${summary.pickupCount}`}
        />
        <Stat
          label={strings.summary.cards.revenue}
          value={strings.summary.money(summary.revenue)}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2 print:block print:columns-2 print:gap-6 print:[&>section]:mb-4">
        {slotOrder.map((slot) => (
          <CountTable
            key={slot}
            title={strings.summary.slots[slot]}
            rows={summary.dishes[slot]}
            withVariation={summary.dishes[slot].some((dish) => dish.variation !== null)}
          />
        ))}
        <CountTable
          title={strings.summary.extras}
          rows={summary.extras.map(({ name, quantity }) => ({ name, count: quantity }))}
          withVariation={false}
        />
      </div>
    </div>
  );
}

/** The kitchen summary tab: the day's counts, then each slot's dishes, most ordered first. */
export function KitchenSummary({ date }: { date: string }) {
  const summary = useQuery(daySummaryQuery(date));

  if (summary.data) {
    return <SummaryContent summary={summary.data} />;
  }
  if (summary.isError) {
    return <LoadFailed onRetry={() => void summary.refetch()} />;
  }
  return <LoadingState rows={6} />;
}
