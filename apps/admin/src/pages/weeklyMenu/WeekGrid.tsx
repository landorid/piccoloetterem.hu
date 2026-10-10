import type { MenuDay } from '@piccolo/core';
import { cn } from 'cn';
import { format } from 'date-fns';
import { PlusIcon } from 'lucide-react';
import { useId } from 'react';
import { hu } from 'react-day-picker/locale';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { fromIsoDate } from '@/dates';
import { strings } from '@/strings';
import { ItemRow, ItemRowHeader } from './ItemRow';
import {
  type Grid,
  type ListKind,
  type ListPath,
  listAt,
  listPath,
  maxFeatured,
  menuDays,
  type Row,
  type RowErrors,
  type RowField,
} from './model';

const t = strings.weeklyMenu;

export type GridHandlers = {
  onChange: (path: ListPath, key: string, patch: Partial<Row>, field: RowField) => void;
  onAdd: (path: ListPath) => void;
  onSoldOutChange: (id: string, soldOut: boolean) => void;
};

type ListProps = GridHandlers & {
  grid: Grid;
  kind: ListKind;
  day: MenuDay | null;
  errors: RowErrors;
  /** By stored item id. */
  soldOut: ReadonlyMap<string, boolean>;
};

/** The rows of one list, and the button that adds a row to it. */
function ListEditor({ grid, kind, day, errors, soldOut, ...handlers }: ListProps) {
  const path = listPath(kind, day);
  const rows = listAt(grid, path);
  const full = kind === 'featured' && rows.length >= maxFeatured;
  const dayName = day === null ? t.groups.featured : t.days[day];

  return (
    <>
      {rows.length > 0 && (
        <ItemRowHeader kind={kind} weekendPrice={kind === 'featured' || day === 6} />
      )}
      {rows.map((row, index) => (
        <ItemRow
          key={row.key}
          row={row}
          kind={kind}
          weekendPrice={kind === 'featured' || day === 6}
          label={`${dayName}, ${index + 1}. ${t.rowNames[kind]}`}
          errors={errors[row.key]}
          soldOut={row.id === undefined ? undefined : (soldOut.get(row.id) ?? false)}
          onChange={(patch, field) => handlers.onChange(path, row.key, patch, field)}
          onSoldOutChange={(next) => row.id && handlers.onSoldOutChange(row.id, next)}
        />
      ))}
      {kind !== 'soups' && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="justify-start text-muted-foreground"
          disabled={full}
          onClick={() => handlers.onAdd(path)}
        >
          <PlusIcon />
          {t.add[kind]}
        </Button>
      )}
    </>
  );
}

type WeekGridProps = GridHandlers & {
  grid: Grid;
  errors: RowErrors;
  soldOut: ReadonlyMap<string, boolean>;
  /** Monday … Saturday, `YYYY-MM-DD`. */
  dates: Record<MenuDay, string>;
  closedDates: ReadonlySet<string>;
  onClosedChange: (date: string, closed: boolean) => void;
};

function dayDate(date: string): string {
  const parsed = fromIsoDate(date);
  return parsed ? format(parsed, 'MMM d.', { locale: hu }) : date;
}

/**
 * Monday to Saturday one below the other, each day's soups above its mains, a dish to a line. A day
 * closed for ordering stays editable, shaded.
 */
export function WeekGrid({
  grid,
  errors,
  soldOut,
  dates,
  closedDates,
  onClosedChange,
  ...handlers
}: WeekGridProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-4">
      {menuDays.map((day) => {
        const closed = closedDates.has(dates[day]);
        const headingId = `${id}-day-${day}`;
        const switchId = `${id}-closed-${day}`;
        return (
          <section
            key={day}
            aria-labelledby={headingId}
            data-closed={closed || undefined}
            className={cn(
              '@container min-w-0 rounded-lg border px-3 py-3 shadow-xs',
              closed ? 'bg-muted/60' : 'bg-card',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h2 id={headingId} className="flex items-baseline gap-2">
                <span className="font-semibold text-xl">{t.days[day]}</span>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {dayDate(dates[day])}
                </span>
              </h2>
              <div className="flex items-center gap-2">
                <Switch
                  id={switchId}
                  size="sm"
                  aria-label={`${t.days[day]}: ${t.closed}`}
                  checked={closed}
                  onCheckedChange={(next) => onClosedChange(dates[day], next)}
                />
                <Label
                  htmlFor={switchId}
                  className={cn(
                    'font-normal text-sm',
                    closed ? 'font-semibold text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {t.closed}
                </Label>
              </div>
            </div>
            {/* A closed day keeps its rows (and so its draft) but shows only its header. */}
            <fieldset
              disabled={closed}
              className={cn(
                'm-0 mt-2 flex min-w-0 flex-col gap-3 border-0 p-0',
                closed && 'hidden',
              )}
            >
              {(['soups', 'mains'] as const).map((kind) => (
                <div key={kind} className="flex flex-col">
                  <h3 className="font-semibold text-muted-foreground text-sm">{t.groups[kind]}</h3>
                  <div className="flex flex-col">
                    <ListEditor
                      grid={grid}
                      kind={kind}
                      day={day}
                      errors={errors}
                      soldOut={soldOut}
                      {...handlers}
                    />
                  </div>
                </div>
              ))}
            </fieldset>
          </section>
        );
      })}
    </div>
  );
}

type FeaturedProps = GridHandlers & {
  grid: Grid;
  errors: RowErrors;
  soldOut: ReadonlyMap<string, boolean>;
};

/** The week's featured items, offered every day of it, up to five. */
export function FeaturedSection({ grid, errors, soldOut, ...handlers }: FeaturedProps) {
  const id = useId();
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="@container flex min-w-0 flex-col gap-2 rounded-lg border bg-card px-3 py-3 shadow-xs"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={`${id}-heading`} className="font-semibold text-xl">
          {t.groups.featured}
        </h2>
        <p className="text-muted-foreground text-sm">{t.featuredHint}</p>
      </div>
      <div className="flex flex-col">
        <ListEditor
          grid={grid}
          kind="featured"
          day={null}
          errors={errors}
          soldOut={soldOut}
          {...handlers}
        />
      </div>
    </section>
  );
}
