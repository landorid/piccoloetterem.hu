import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Link } from 'react-router';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LoadingState } from '@/components/LoadingState';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatDateLong, fromIsoDate } from '@/dates';
import { strings } from '@/strings';
import { formatAmount, formatDateTime } from './model';
import { StatusBadge } from './OrdersTable';
import { detailQuery, type OrderDetail } from './queries';

const t = strings.orders;
const d = t.detail;

function longDate(iso: string): string {
  const date = fromIsoDate(iso);
  return date ? formatDateLong(date) : iso;
}

function Money({ amount }: { amount: number }) {
  return (
    <span className="whitespace-nowrap tabular-nums">
      {formatAmount(amount)} {t.currency}
    </span>
  );
}

/** A label and its value on one line, the value on the right. */
function Line({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="min-w-0">{label}</span>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Customer({ order }: { order: OrderDetail }) {
  return (
    <Section title={d.customer}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">{d.name}</dt>
        <dd>{order.name}</dd>
        <dt className="text-muted-foreground">{d.phone}</dt>
        <dd>
          <a className="underline-offset-4 hover:underline" href={`tel:${order.phone}`}>
            {order.phone}
          </a>
        </dd>
        <dt className="text-muted-foreground">{d.email}</dt>
        <dd className="break-all">{order.email}</dd>
        <dt className="text-muted-foreground">{d.address}</dt>
        <dd>{order.fulfilment === 'pickup' ? t.pickup : order.address}</dd>
      </dl>
    </Section>
  );
}

function Menus({ order }: { order: OrderDetail }) {
  return (
    <div className="space-y-4">
      {order.menus.map((menu) => (
        <Section key={menu.position} title={d.menu(menu.position)}>
          <ul className="space-y-1">
            {menu.items.map((item) => (
              <li key={item.slot}>
                <Line
                  label={
                    <>
                      {item.name}
                      {item.variation && (
                        <span className="text-muted-foreground"> · {item.variation}</span>
                      )}
                    </>
                  }
                >
                  <Money amount={item.unitPrice} />
                </Line>
              </li>
            ))}
            {menu.adjustments.map((adjustment) => (
              <li key={adjustment.code} className="text-muted-foreground">
                <Line label={d.adjustments[adjustment.code]}>
                  <Money amount={adjustment.amount} />
                </Line>
              </li>
            ))}
          </ul>
          <Line label={<span className="font-medium">{d.menu(menu.position)}</span>}>
            <span className="font-medium">
              <Money amount={menu.price} />
            </span>
          </Line>
        </Section>
      ))}
    </div>
  );
}

function Totals({ order }: { order: OrderDetail }) {
  return (
    <div className="space-y-1">
      <Line label={d.foodSubtotal}>
        <Money amount={order.foodSubtotal} />
      </Line>
      {order.fulfilment === 'delivery' && (
        <Line label={d.deliveryFee}>
          <Money amount={order.deliveryFee} />
        </Line>
      )}
      <Line label={<span className="font-semibold">{d.total}</span>}>
        <span className="font-semibold text-base">
          <Money amount={order.total} />
        </span>
      </Line>
    </div>
  );
}

function Timestamps({ order }: { order: OrderDetail }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-muted-foreground text-xs">
      <dt>{d.createdAt}</dt>
      <dd className="tabular-nums">{formatDateTime(order.createdAt)}</dd>
      {order.processedAt && (
        <>
          <dt>{d.processedAt}</dt>
          <dd className="tabular-nums">{formatDateTime(order.processedAt)}</dd>
        </>
      )}
      {order.cancelledAt && (
        <>
          <dt>{d.cancelledAt}</dt>
          <dd className="tabular-nums">{formatDateTime(order.cancelledAt)}</dd>
        </>
      )}
    </dl>
  );
}

function Body({
  order,
  siblingHref,
}: {
  order: OrderDetail;
  siblingHref: (date: string, id: string) => string;
}) {
  return (
    <div className="flex-1 space-y-5 overflow-y-auto px-4 text-sm">
      <Timestamps order={order} />
      <Customer order={order} />
      <Separator />
      <Menus order={order} />
      {order.extras.length > 0 && (
        <Section title={d.extras}>
          <ul className="space-y-1">
            {order.extras.map((extra) => (
              <li key={extra.key}>
                <Line label={`${extra.name} × ${extra.quantity}`}>
                  <Money amount={extra.unitPrice * extra.quantity} />
                </Line>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {order.note && (
        <Section title={d.note}>
          <p className="whitespace-pre-wrap rounded-md bg-muted p-3">{order.note}</p>
        </Section>
      )}
      <Separator />
      <Totals order={order} />
      {order.siblings.length > 0 && (
        <Section title={d.siblings}>
          <ul className="space-y-1">
            {order.siblings.map((sibling) => (
              <li key={sibling.id} className="flex items-center justify-between gap-4">
                <Link
                  className="underline underline-offset-4"
                  to={siblingHref(sibling.deliveryDate, sibling.id)}
                >
                  {longDate(sibling.deliveryDate)}
                </Link>
                <StatusBadge status={sibling.status} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

type OrderSheetProps = {
  /** The open order; the sheet is closed without one. */
  orderId: string | undefined;
  onClose: () => void;
  onProcess: (id: string) => void;
  /** Resolves once the API has cancelled it; the confirm dialog waits for it. */
  onCancel: (id: string) => Promise<unknown>;
  /** A status change of this order is on its way. */
  busy: boolean;
  /** Where a link to another day of the same submission goes. */
  siblingHref: (date: string, id: string) => string;
};

/**
 * One order in full, in a sheet from the right; full screen below 1024px. Marking it processed is
 * offered only for a received order, cancelling (after a confirm) for any not cancelled. No
 * minimum-order difference is shown (#57: that is a checkout notice only).
 */
export function OrderSheet({
  orderId,
  onClose,
  onProcess,
  onCancel,
  busy,
  siblingHref,
}: OrderSheetProps) {
  const detail = useQuery({ ...detailQuery(orderId ?? ''), enabled: orderId !== undefined });
  const [confirming, setConfirming] = useState(false);
  const order = detail.data?.id === orderId ? detail.data : undefined;

  return (
    <Sheet open={orderId !== undefined} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="w-full gap-0 sm:max-w-none lg:max-w-xl"
        // The table focuses the selected row itself, which j/k may have moved since opening.
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader className="pr-12">
          <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
            {order ? order.name : d.title}
            {order && <StatusBadge status={order.status} />}
          </SheetTitle>
          <SheetDescription>
            {order ? longDate(order.deliveryDate) : strings.loading}
          </SheetDescription>
        </SheetHeader>
        {order ? (
          <Body order={order} siblingHref={siblingHref} />
        ) : detail.isError ? (
          <div className="flex-1 space-y-3 px-4 text-sm">
            <p>{d.loadFailed}</p>
            <Button variant="outline" onClick={() => void detail.refetch()}>
              {d.retry}
            </Button>
          </div>
        ) : (
          <LoadingState className="flex-1 px-4" rows={6} />
        )}
        {order && order.status !== 'cancelled' && (
          <SheetFooter className="flex-row justify-end border-t">
            <Button variant="outline" disabled={busy} onClick={() => setConfirming(true)}>
              {d.cancel}
            </Button>
            {order.status === 'received' && (
              <Button disabled={busy} onClick={() => onProcess(order.id)}>
                {d.process}
              </Button>
            )}
          </SheetFooter>
        )}
        {order && (
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={t.cancelDialog.title}
            description={t.cancelDialog.description(order.name, longDate(order.deliveryDate))}
            confirmLabel={t.cancelDialog.confirm}
            cancelLabel={t.cancelDialog.cancel}
            destructive
            onConfirm={() => onCancel(order.id)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
