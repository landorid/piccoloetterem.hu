import type { OrderStatus } from '@piccolo/core';
import { cn } from 'cn';
import { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { strings } from '@/strings';
import { formatAmount, formatTime } from './model';
import type { OrderRow } from './queries';

const t = strings.orders;

const badgeVariant = {
  received: 'default',
  processed: 'secondary',
  cancelled: 'outline',
} as const satisfies Record<OrderStatus, string>;

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={badgeVariant[status]}>{t.status[status]}</Badge>;
}

type OrdersTableProps = {
  rows: readonly OrderRow[];
  selectedId: string | undefined;
  /** Rows that changed elsewhere since the last poll; highlighted. */
  fresh: ReadonlySet<string>;
  onOpen: (id: string) => void;
  /**
   * Keep focus on the selected row's button, so a real Enter opens the selected order: on each
   * selection change, and when the detail closes. Off while the detail is open: focus stays in it.
   */
  focusSelection: boolean;
};

/**
 * The day's orders, one row each. A click (or the name's button, for the keyboard) opens the
 * detail; the selected row is the one `j`/`k` move. Below 1024px the phone sits under the name,
 * so the table fits beside the collapsed sidebar at 768px.
 */
export function OrdersTable({ rows, selectedId, fresh, onOpen, focusSelection }: OrdersTableProps) {
  const selectedRow = useRef<HTMLTableRowElement>(null);

  // Keyboard selection can move off screen; follow it.
  useEffect(() => {
    if (selectedId) {
      selectedRow.current?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [selectedId]);

  useEffect(() => {
    if (selectedId && focusSelection) {
      selectedRow.current?.querySelector('button')?.focus({ preventScroll: true });
    }
  }, [selectedId, focusSelection]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t.columns.name}</TableHead>
          <TableHead>{t.columns.address}</TableHead>
          <TableHead className="hidden lg:table-cell">{t.columns.phone}</TableHead>
          <TableHead>{t.columns.createdAt}</TableHead>
          <TableHead className="text-right">{t.columns.menus}</TableHead>
          <TableHead className="text-right">{t.columns.total}</TableHead>
          <TableHead>{t.columns.status}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const selected = row.id === selectedId;
          return (
            <TableRow
              key={row.id}
              ref={selected ? selectedRow : undefined}
              data-state={selected ? 'selected' : undefined}
              data-fresh={fresh.has(row.id) || undefined}
              aria-selected={selected}
              onClick={() => onOpen(row.id)}
              className={cn(
                'cursor-pointer transition-colors duration-700',
                fresh.has(row.id) && 'bg-amber-100 hover:bg-amber-100 dark:bg-amber-900/40',
                row.status === 'cancelled' && 'text-muted-foreground',
              )}
            >
              <TableCell className="font-medium">
                <button
                  type="button"
                  className="text-left hover:underline focus-visible:underline focus-visible:outline-none"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(row.id);
                  }}
                >
                  {row.name}
                </button>
                <div className="font-normal text-muted-foreground text-xs lg:hidden">
                  {row.phone}
                </div>
              </TableCell>
              <TableCell className="max-w-64 truncate" title={row.address || undefined}>
                {row.fulfilment === 'pickup' ? t.pickup : row.address}
              </TableCell>
              <TableCell className="hidden whitespace-nowrap lg:table-cell">{row.phone}</TableCell>
              <TableCell className="tabular-nums">{formatTime(row.createdAt)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.menuCount}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatAmount(row.total)} {t.currency}
              </TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
