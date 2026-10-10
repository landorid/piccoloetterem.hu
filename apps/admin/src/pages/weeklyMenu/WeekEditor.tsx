import { ApiError } from '@piccolo/api-client';
import { type MenuDay, weekLabel } from '@piccolo/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon, TriangleAlertIcon } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hu } from 'react-day-picker/locale';
import { type BlockerFunction, useBlocker } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DatePicker } from '@/components/DatePicker';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { strings } from '@/strings';
import {
  buildDraft,
  daysWithoutMains,
  fingerprint,
  type Grid,
  gridFromWeek,
  type IsoWeek,
  isEmptyWeek,
  type ListPath,
  menuDays,
  newRow,
  placeErrors,
  type Row,
  type RowErrors,
  type RowField,
  shiftWeek,
  updateList,
  weekDates,
  weekOfDate,
} from './model';
import {
  closedDatesKey,
  closedDatesQuery,
  publishWeek,
  type StoredWeek,
  saveWeek,
  setClosed,
  setSoldOut,
  weekKey,
  weekQuery,
} from './queries';
import { FeaturedSection, WeekGrid } from './WeekGrid';

const t = strings.weeklyMenu;

/** Every item of a stored week with `id` set to `soldOut`, wherever it sits. */
function withSoldOut(week: StoredWeek, id: string, soldOut: boolean): StoredWeek {
  const set = <T extends { id: string; soldOut: boolean }>(list: readonly T[]) =>
    list.map((item) => (item.id === id ? { ...item, soldOut } : item));
  const day = (d: MenuDay) => ({ soups: set(week.days[d].soups), mains: set(week.days[d].mains) });
  return {
    ...week,
    days: { 1: day(1), 2: day(2), 3: day(3), 4: day(4), 5: day(5), 6: day(6) },
    featured: set(week.featured),
  };
}

function soldOutById(week: StoredWeek | undefined): Map<string, boolean> {
  const flags = new Map<string, boolean>();
  if (week) {
    for (const day of menuDays) {
      for (const item of [...week.days[day].soups, ...week.days[day].mains]) {
        flags.set(item.id, item.soldOut);
      }
    }
    for (const item of week.featured) {
      flags.set(item.id, item.soldOut);
    }
  }
  return flags;
}

function formatPublishedAt(publishedAt: string): string {
  return format(new Date(publishedAt), 'yyyy. MMMM d. HH:mm', { locale: hu });
}

type WeekEditorProps = {
  week: IsoWeek;
  /** Moves to another week; a navigation, so unsaved changes are asked about first. */
  onWeekChange: (week: IsoWeek) => void;
};

/**
 * One week of the menu: the week picker, the grid and the featured items, saved with one `PUT`.
 * Sold-out flags and closed dates are not part of the save: each switch writes at once.
 *
 * The draft is the grid as staff left it, next to the stored week it was opened from. While it
 * holds no unsaved change, it follows the stored week, so a refetch shows what others saved.
 */
export function WeekEditor({ week, onWeekChange }: WeekEditorProps) {
  const queryClient = useQueryClient();
  const stored = useQuery(weekQuery(week));
  const dates = weekDates(week);
  const closedKey = closedDatesKey(dates[1], dates[6]);
  const closed = useQuery(closedDatesQuery(dates[1], dates[6]));

  const [draft, setDraft] = useState<{ base: StoredWeek; grid: Grid } | null>(null);
  const [errors, setErrors] = useState<RowErrors>({});
  const baseFingerprint = useMemo(() => draft && fingerprint(gridFromWeek(draft.base)), [draft]);
  const dirty = draft !== null && fingerprint(draft.grid) !== baseFingerprint;

  if (stored.data && stored.data !== draft?.base && (draft === null || !dirty)) {
    setDraft({ base: stored.data, grid: gridFromWeek(stored.data) });
  }

  // ---- Save ----

  const sentRows = useRef<ReadonlyMap<string, string>>(new Map());
  const save = useMutation({
    mutationFn: (body: Parameters<typeof saveWeek>[1]) => saveWeek(week, body),
    onSuccess: (saved) => {
      queryClient.setQueryData(weekKey(week), saved);
      setDraft({ base: saved, grid: gridFromWeek(saved) });
      setErrors({});
      toast.success(t.toasts.saved, { id: 'week-saved' });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.fields) {
        setErrors(placeErrors(error.fields, sentRows.current).errors);
      }
    },
  });

  const onSave = () => {
    if (!draft) {
      return;
    }
    const built = buildDraft(draft.grid, draft.base);
    if (Object.keys(built.errors).length > 0) {
      setErrors(built.errors);
      toast.error(strings.errors.byCode.validation, { id: 'error-validation' });
      return;
    }
    sentRows.current = built.rowAt;
    save.mutate(built.draft);
  };

  // ---- Editing ----

  const edit = (update: (grid: Grid) => Grid) =>
    setDraft((current) => current && { ...current, grid: update(current.grid) });

  // ---- Sold out: written at once, shown before the API answers ----

  const soldOutMutation = useMutation({
    mutationFn: ({ id, soldOut }: { id: string; soldOut: boolean }) => setSoldOut(id, soldOut),
    onMutate: async ({ id, soldOut }) => {
      await queryClient.cancelQueries({ queryKey: weekKey(week) });
      const previous = queryClient.getQueryData<StoredWeek>(weekKey(week));
      queryClient.setQueryData<StoredWeek>(
        weekKey(week),
        (current) => current && withSoldOut(current, id, soldOut),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(weekKey(week), context?.previous);
    },
    onSuccess: ({ item }) => {
      toast.success(item.soldOut ? t.toasts.soldOut : t.toasts.available, { id: 'sold-out' });
    },
  });

  const handlers = {
    onChange: (path: ListPath, key: string, patch: Partial<Row>, field: RowField) => {
      edit((grid) =>
        updateList(grid, path, (rows) =>
          rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
        ),
      );
      setErrors((current) => {
        const { [field]: _, ...rest } = current[key] ?? {};
        return current[key]?.[field] ? { ...current, [key]: rest } : current;
      });
    },
    onAdd: (path: ListPath) =>
      edit((grid) => updateList(grid, path, (rows) => [...rows, newRow(path, rows.length)])),
    onSoldOutChange: (id: string, soldOut: boolean) => soldOutMutation.mutate({ id, soldOut }),
  };

  // ---- Closed dates: written at once, shown before the API answers ----

  const closedMutation = useMutation({
    mutationFn: ({ date, closed }: { date: string; closed: boolean }) => setClosed(date, closed),
    onMutate: async ({ date, closed }) => {
      await queryClient.cancelQueries({ queryKey: closedKey });
      const previous = queryClient.getQueryData<{ dates: string[] }>(closedKey);
      queryClient.setQueryData<{ dates: string[] }>(closedKey, (current) => {
        const others = (current?.dates ?? []).filter((other) => other !== date);
        return { dates: closed ? [...others, date].sort() : others };
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(closedKey, context?.previous);
    },
    onSuccess: (_result, { closed }) => {
      toast.success(closed ? t.toasts.closed : t.toasts.reopened, { id: 'closed-date' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: closedKey }),
  });

  // ---- Publish ----

  const [publishing, setPublishing] = useState(false);
  const publish = useMutation({
    mutationFn: () => publishWeek(week),
    onSuccess: (result) => {
      queryClient.setQueryData<StoredWeek>(
        weekKey(week),
        (current) => current && { ...current, week: result.week },
      );
      toast.success(t.toasts.published, { id: 'week-published' });
    },
  });
  const noMains = stored.data ? daysWithoutMains(stored.data) : [];
  const publishDescription =
    noMains.length > 0
      ? `${t.publishDialog.description} ${t.publishDialog.noMains} ${noMains
          .map((day) => t.days[day].toLowerCase())
          .join(', ')}.`
      : t.publishDialog.description;

  // ---- Unsaved changes: asked about on navigation and on closing the tab ----

  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
    [dirty],
  );
  const blocker = useBlocker(shouldBlock);
  const leaving = useRef(false);

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // ---- Render ----

  const publishedAt = stored.data?.week.publishedAt ?? null;
  const empty = !stored.data || isEmptyWeek(stored.data);
  const publishBlockedBy = dirty ? t.actions.saveFirst : empty ? t.actions.emptyWeek : undefined;

  let content: ReactNode;
  if (stored.isError) {
    content = (
      <EmptyState
        icon={TriangleAlertIcon}
        title={t.loadFailed.title}
        description={t.loadFailed.description}
        action={
          <Button variant="outline" onClick={() => void stored.refetch()}>
            {t.loadFailed.retry}
          </Button>
        }
      />
    );
  } else if (!draft) {
    content = <LoadingState rows={8} />;
  } else {
    const shared = {
      grid: draft.grid,
      errors,
      soldOut: soldOutById(stored.data),
      ...handlers,
    };
    content = (
      <fieldset disabled={save.isPending} className="m-0 flex min-w-0 flex-col gap-6 border-0 p-0">
        <WeekGrid
          {...shared}
          dates={dates}
          closedDates={new Set(closed.data?.dates)}
          onClosedChange={(date, next) => closedMutation.mutate({ date, closed: next })}
        />
        <FeaturedSection {...shared} />
      </fieldset>
    );
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6">
      <PageHeader
        title={strings.pages.weeklyMenu.title}
        description={strings.pages.weeklyMenu.description}
        actions={
          <>
            {dirty && <span className="text-muted-foreground text-sm">{t.actions.unsaved}</span>}
            <Button onClick={onSave} disabled={!dirty || save.isPending}>
              {t.actions.save}
            </Button>
            {stored.data && !publishedAt && (
              <Button
                variant="outline"
                disabled={publishBlockedBy !== undefined || publish.isPending}
                title={publishBlockedBy}
                onClick={() => setPublishing(true)}
              >
                {t.actions.publish}
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label={t.week.previous}
          title={t.week.previous}
          onClick={() => onWeekChange(shiftWeek(week, -1))}
        >
          <ChevronLeftIcon />
        </Button>
        <DatePicker value={dates[1]} onChange={(date) => onWeekChange(weekOfDate(date))} />
        <Button
          variant="outline"
          size="icon"
          aria-label={t.week.next}
          title={t.week.next}
          onClick={() => onWeekChange(shiftWeek(week, 1))}
        >
          <ChevronRightIcon />
        </Button>
        <h2 className="ml-1 font-semibold">
          {weekLabel(week.isoYear, week.isoWeek, { operatingDays: menuDays })}
        </h2>
        {stored.data &&
          (publishedAt ? (
            <Badge>
              {t.week.published} {formatPublishedAt(publishedAt)}
            </Badge>
          ) : (
            <Badge variant="secondary">{t.week.draft}</Badge>
          ))}
      </div>

      {content}

      <ConfirmDialog
        open={publishing}
        onOpenChange={setPublishing}
        title={t.publishDialog.title}
        description={publishDescription}
        confirmLabel={t.actions.publish}
        onConfirm={() => publish.mutateAsync()}
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && !leaving.current) {
            blocker.reset?.();
          }
        }}
        title={t.leaveDialog.title}
        description={t.leaveDialog.description}
        confirmLabel={t.leaveDialog.confirm}
        cancelLabel={t.leaveDialog.cancel}
        destructive
        onConfirm={() => {
          leaving.current = true;
          blocker.proceed?.();
        }}
      />
    </div>
  );
}
