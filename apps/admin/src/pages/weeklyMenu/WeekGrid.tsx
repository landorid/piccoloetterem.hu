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
import { ItemCard } from './ItemCard';
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
  onRemove: (path: ListPath, key: string) => void;
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

/** The cards of one list, and the button that adds a row to it. */
function ListEditor({ grid, kind, day, errors, soldOut, ...handlers }: ListProps) {
  const path = listPath(kind, day);
  const rows = listAt(grid, path);
  const full = kind === 'featured' && rows.length >= maxFeatured;
  const dayName = day === null ? t.groups.featured : t.days[day];

  return (
    <>
      {rows.map((row, index) => (
        <ItemCard
          key={row.key}
          row={row}
          kind={kind}
          weekendPrice={kind === 'featured' || day === 6}
          label={`${dayName}, ${index + 1}. ${t.rowNames[kind]}`}
          errors={errors[row.key]}
          soldOut={row.id === undefined ? undefined : (soldOut.get(row.id) ?? false)}
          onChange={(patch, field) => handlers.onChange(path, row.key, patch, field)}
          onRemove={() => handlers.onRemove(path, row.key)}
          onSoldOutChange={(next) => row.id && handlers.onSoldOutChange(row.id, next)}
        />
      ))}
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
 * Monday to Saturday side by side, soups above mains. The grid is wider than the page: it
 * scrolls inside its own box, and the page never scrolls sideways. A day closed for ordering
 * stays editable, shaded.
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
  const closed = (day: MenuDay) => closedDates.has(dates[day]);
  const cellClass = (day: MenuDay) =>
    cn('border-r p-2 align-top last:border-r-0', closed(day) && 'bg-muted');
  const group = (kind: 'soups' | 'mains') => (
    <>
      <tr>
        <th scope="colgroup" colSpan={menuDays.length} className="border-y bg-muted/40 p-0">
          <span className="sticky left-0 block w-fit px-3 py-1.5 text-left font-semibold text-sm">
            {t.groups[kind]}
          </span>
        </th>
      </tr>
      <tr>
        {menuDays.map((day) => (
          <td key={day} className={cellClass(day)} data-closed={closed(day) || undefined}>
            <div className="flex flex-col gap-2">
              <ListEditor
                grid={grid}
                kind={kind}
                day={day}
                errors={errors}
                soldOut={soldOut}
                {...handlers}
              />
            </div>
          </td>
        ))}
      </tr>
    </>
  );

  return (
    // `contain-inline-size`: the grid's width never widens the page, so only this box scrolls.
    <div className="overflow-x-auto rounded-lg border contain-inline-size">
      <table className="w-full min-w-max table-fixed border-collapse">
        <thead>
          <tr>
            {menuDays.map((day) => (
              <th
                key={day}
                scope="col"
                className={cn(
                  'w-64 min-w-64 border-r p-2 text-left align-top font-normal last:border-r-0',
                  closed(day) && 'bg-muted',
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{t.days[day]}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {dayDate(dates[day])}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Switch
                    id={`${id}-closed-${day}`}
                    size="sm"
                    aria-label={`${t.days[day]}: ${t.closed}`}
                    checked={closed(day)}
                    onCheckedChange={(next) => onClosedChange(dates[day], next)}
                  />
                  <Label
                    htmlFor={`${id}-closed-${day}`}
                    className={cn(
                      'font-normal text-xs',
                      closed(day) ? 'font-semibold text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {t.closed}
                  </Label>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {group('soups')}
          {group('mains')}
        </tbody>
      </table>
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
    <section aria-labelledby={`${id}-heading`} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={`${id}-heading`} className="font-semibold text-lg">
          {t.groups.featured}
        </h2>
        <p className="text-muted-foreground text-sm">{t.featuredHint}</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] items-start gap-2">
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
