import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from 'cn';
import { Inbox, Keyboard, RefreshCw, SearchX } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { DayNavigator } from '@/components/DayNavigator';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { fromIsoDate } from '@/dates';
import { useDateParam } from '@/hooks/use-date-param';
import { moveSelection, parseStatusFilter, statusFilters } from '@/pages/orders/model';
import { OrderSheet } from '@/pages/orders/OrderSheet';
import { OrdersTable } from '@/pages/orders/OrdersTable';
import {
  defaultDateQuery,
  detailKey,
  listQuery,
  type OrderDetail,
  type StatusFilter,
} from '@/pages/orders/queries';
import { useFreshRows } from '@/pages/orders/useFreshRows';
import { useStatusChange } from '@/pages/orders/useStatusChange';
import { paths } from '@/paths';
import { strings } from '@/strings';

const t = strings.orders;

/** How long the search waits after the last keystroke before it asks the API. */
const searchDelay = 300;

type ParamChanges = Record<string, string | null>;

/** Sets (or, with `null`, removes) search params, keeping the others. */
function useParamUpdate() {
  const [, setParams] = useSearchParams();
  return useCallback(
    (changes: ParamChanges, options?: { replace: boolean }) =>
      setParams((current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        }
        return next;
      }, options),
    [setParams],
  );
}

/** Whether a key press belongs to a field, a popover or a confirm dialog, not to the shortcuts. */
function isForSomethingElse(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
    return true;
  }
  const target = event.target instanceof Element ? event.target : null;
  return (
    target?.closest(
      'input, textarea, select, [contenteditable="true"], [data-radix-popper-content-wrapper]',
    ) != null || document.querySelector('[role="alertdialog"]') !== null
  );
}

function ShortcutHelp() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" aria-label={t.shortcuts.label}>
            <Keyboard />
          </Button>
        </TooltipTrigger>
        <TooltipContent align="end" className="max-w-xs">
          <ul className="space-y-0.5 text-left">
            <li>{t.shortcuts.next}</li>
            <li>{t.shortcuts.previous}</li>
            <li>{t.shortcuts.open}</li>
            <li>{t.shortcuts.process}</li>
            <li className="pt-1 opacity-80">{t.shortcuts.arrowsInDetail}</li>
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StatusChips({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
}) {
  return (
    <fieldset aria-label={t.statusFilter.label} className="flex flex-wrap gap-1">
      {statusFilters.map((filter) => (
        <Button
          key={filter}
          size="sm"
          variant={filter === value ? 'default' : 'outline'}
          aria-pressed={filter === value}
          className="rounded-full"
          onClick={() => onChange(filter)}
        >
          {filter === 'all' ? t.statusFilter.all : t.status[filter]}
        </Button>
      ))}
    </fieldset>
  );
}

/** The search box. It writes `?q=` once typing pauses for `searchDelay`. */
function SearchInput({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  const [text, setText] = useState(value);

  // The URL can change under it: a link to another day clears the search.
  useEffect(() => setText(value), [value]);

  useEffect(() => {
    if (text.trim() === value) {
      return;
    }
    const timer = setTimeout(() => onChange(text.trim()), searchDelay);
    return () => clearTimeout(timer);
  }, [text, value, onChange]);

  return (
    <Input
      type="search"
      aria-label={t.search.label}
      placeholder={t.search.placeholder}
      value={text}
      onChange={(event) => setText(event.target.value)}
      className="w-full sm:w-64"
    />
  );
}

/**
 * The orders of one day (S2, #37). Everything that decides what is shown is in the URL, so a
 * reload or a shared link opens the same view: `?date=` (S3's `useDateParam`; without one, the
 * API's default day), `?status=`, `?q=` and `?order=` (the open order). The list polls every 30 s
 * while the page is visible, and rows that changed elsewhere since the last poll light up.
 */
export function OrdersPage() {
  const [params] = useSearchParams();
  const requested = params.get('date');
  const fallback = useQuery({
    ...defaultDateQuery,
    enabled: requested === null || fromIsoDate(requested) === undefined,
  });
  const [date] = useDateParam(fallback.data?.date);

  return (
    <>
      <PageHeader
        title={strings.pages.orders.title}
        description={strings.pages.orders.description}
      />
      {date ? <OrdersOfDay date={date} /> : <LoadingState rows={8} />}
    </>
  );
}

function OrdersOfDay({ date }: { date: string }) {
  const [params] = useSearchParams();
  const update = useParamUpdate();
  const queryClient = useQueryClient();
  const status = parseStatusFilter(params.get('status'));
  const q = (params.get('q') ?? '').trim();
  const orderId = params.get('order') ?? undefined;

  const list = useQuery(listQuery({ date, status, q }));
  const rows = list.data ?? [];
  const { fresh, expect } = useFreshRows(
    `${date}|${status}|${q}`,
    list.isPlaceholderData ? undefined : list.data,
  );
  const statusChange = useStatusChange(expect);

  const [selectedId, setSelectedId] = useState<string>();
  const selected = orderId ?? selectedId;

  const openOrder = (id: string | undefined, options?: { replace: boolean }) => {
    if (id) {
      setSelectedId(id);
    }
    update({ order: id ?? null }, options);
  };

  const busy = statusChange.isPending && statusChange.variables?.id === orderId;
  const process = (id: string) => statusChange.mutate({ id, to: 'processed' });

  const onShortcut = (event: KeyboardEvent) => {
    if (isForSomethingElse(event)) {
      return;
    }
    const open = orderId !== undefined;
    const key = event.key;
    if (key === 'j' || key === 'k' || key === 'ArrowDown' || key === 'ArrowUp') {
      // In an open order the arrows scroll it; j and k still move to the next one.
      if (open && key.startsWith('Arrow')) {
        return;
      }
      const step = key === 'j' || key === 'ArrowDown' ? 1 : -1;
      const next = moveSelection(
        rows.map((row) => row.id),
        selected,
        step,
      );
      if (next) {
        event.preventDefault();
        if (open) {
          openOrder(next, { replace: true });
        } else {
          setSelectedId(next);
        }
      }
    } else if (key === 'Enter') {
      const onControl = event.target instanceof Element && event.target.closest('button, a');
      if (!open && selected && !onControl) {
        event.preventDefault();
        openOrder(selected);
      }
    } else if (key === 'p' && orderId && !busy) {
      const current =
        queryClient.getQueryData<OrderDetail>(detailKey(orderId)) ??
        rows.find((row) => row.id === orderId);
      if (current?.status === 'received') {
        event.preventDefault();
        process(orderId);
      }
    }
  };

  // One listener for the page's life; it always calls this render's handler.
  const shortcuts = useRef(onShortcut);
  useEffect(() => {
    shortcuts.current = onShortcut;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => shortcuts.current(event);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const onSearch = useCallback(
    (next: string) => update({ q: next || null }, { replace: true }),
    [update],
  );

  let content: ReactNode;
  if (list.isPending) {
    content = <LoadingState rows={8} />;
  } else if (list.isError && !list.data) {
    content = (
      <EmptyState
        icon={SearchX}
        title={t.loadFailed}
        action={
          <Button variant="outline" onClick={() => void list.refetch()}>
            {t.retry}
          </Button>
        }
      />
    );
  } else if (rows.length === 0) {
    content =
      q || status !== 'all' ? (
        <EmptyState icon={SearchX} title={t.noMatch.title} description={t.noMatch.description} />
      ) : (
        <EmptyState icon={Inbox} title={t.empty.title} description={t.empty.description} />
      );
  } else {
    content = (
      <OrdersTable
        rows={rows}
        selectedId={selected}
        fresh={fresh}
        onOpen={openOrder}
        focusSelection={orderId === undefined}
      />
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <DayNavigator value={date} onChange={(next) => update({ date: next, order: null })} />
        <StatusChips
          value={status}
          onChange={(next) => update({ status: next === 'all' ? null : next })}
        />
        <div className="flex w-full items-center gap-2 sm:w-auto lg:ml-auto">
          <SearchInput value={q} onChange={onSearch} />
          <Button
            variant="outline"
            size="icon"
            aria-label={t.refresh}
            title={t.refresh}
            onClick={() => void list.refetch()}
          >
            <RefreshCw className={cn(list.isFetching && 'animate-spin')} />
          </Button>
          <ShortcutHelp />
        </div>
      </div>
      {list.data && <p className="-mt-3 text-muted-foreground text-sm">{t.count(rows.length)}</p>}
      {content}
      <OrderSheet
        orderId={orderId}
        onClose={() => update({ order: null })}
        onProcess={process}
        onCancel={(id) => statusChange.mutateAsync({ id, to: 'cancelled' })}
        busy={busy}
        siblingHref={(day, id) =>
          `${paths.orders}?${new URLSearchParams({ date: day, order: id })}`
        }
      />
    </>
  );
}
