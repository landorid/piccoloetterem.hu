import type { OrderStatus } from '@piccolo/core';
import { useQuery } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadFailed } from '@/pages/summary/LoadFailed';
import { type DeliveryList as DeliveryListData, deliveryListQuery } from '@/pages/summary/queries';
import { strings } from '@/strings';

const statusVariant = {
  received: 'default',
  processed: 'secondary',
  cancelled: 'destructive',
} as const satisfies Record<OrderStatus, 'default' | 'secondary' | 'destructive'>;

/** Only on paper: an empty box the courier ticks when the order is handed over. */
const paperOnly = 'hidden print:table-cell';
/**
 * On paper the phone sits under the name and the note under the address, so a row of a full A4
 * list stays two or three lines high.
 */
const screenOnly = 'print:hidden';
const paperOnlyInline = 'hidden print:inline';

function ListContent({ list }: { list: DeliveryListData }) {
  if (list.orders.length === 0) {
    return (
      <EmptyState
        icon={Truck}
        title={strings.summary.noDeliveries.title}
        description={strings.summary.noDeliveries.description}
      />
    );
  }
  const total = list.orders.reduce((sum, order) => sum + order.total, 0);
  const menus = list.orders.reduce((sum, order) => sum + order.menuCount, 0);
  return (
    <Table data-print="table">
      <TableHeader>
        <TableRow>
          <TableHead className={`${paperOnly} w-[10mm] text-[7pt]`}>
            {strings.summary.columns.handedOver}
          </TableHead>
          <TableHead className="print:w-[34mm]">{strings.summary.columns.name}</TableHead>
          <TableHead className={screenOnly}>{strings.summary.columns.phone}</TableHead>
          <TableHead>
            <span className={screenOnly}>{strings.summary.columns.address}</span>
            <span className={paperOnlyInline}>{strings.summary.columns.addressAndNote}</span>
          </TableHead>
          <TableHead className="text-right print:w-[11mm] print:text-[8pt]">
            {strings.summary.columns.menus}
          </TableHead>
          <TableHead className="text-right print:w-[20mm]">
            {strings.summary.columns.total}
          </TableHead>
          <TableHead className={screenOnly}>{strings.summary.columns.note}</TableHead>
          <TableHead className="print:w-[17mm] print:text-[8pt]">
            {strings.summary.columns.status}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className={paperOnly}>
              <span aria-hidden className="block size-4 border border-current" />
            </TableCell>
            <TableCell className="whitespace-normal">
              <span className="font-medium">{order.name}</span>
              <span className="hidden print:block">{order.phone}</span>
            </TableCell>
            <TableCell className={screenOnly}>
              <a href={`tel:${order.phone}`} className="underline-offset-4 hover:underline">
                {order.phone}
              </a>
            </TableCell>
            <TableCell className="whitespace-normal">
              {order.address || strings.summary.pickup}
              {order.note && (
                <span className="hidden whitespace-pre-line break-words italic print:block">
                  {order.note}
                </span>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">{order.menuCount}</TableCell>
            <TableCell className="text-right tabular-nums">
              {strings.summary.money(order.total)}
            </TableCell>
            <TableCell className={`${screenOnly} min-w-40 whitespace-pre-line break-words`}>
              {order.note}
            </TableCell>
            <TableCell>
              <Badge variant={statusVariant[order.status]}>
                {strings.summary.statuses[order.status]}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className={paperOnly} />
          <TableCell className="whitespace-normal">
            {strings.summary.deliveryTotal(list.orders.length)}
          </TableCell>
          <TableCell className={screenOnly} />
          <TableCell />
          <TableCell className="text-right tabular-nums">{menus}</TableCell>
          <TableCell className="text-right tabular-nums">{strings.summary.money(total)}</TableCell>
          <TableCell className={screenOnly} />
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  );
}

/**
 * The delivery list tab: the courier's delivery orders, by address as the API sorts them. It
 * shows what each order costs and nothing about the minimum order value, which is a checkout
 * notice only (#57).
 */
export function DeliveryList({ date }: { date: string }) {
  const list = useQuery(deliveryListQuery(date));

  if (list.data) {
    return <ListContent list={list.data} />;
  }
  if (list.isError) {
    return <LoadFailed onRetry={() => void list.refetch()} />;
  }
  return <LoadingState rows={8} />;
}
