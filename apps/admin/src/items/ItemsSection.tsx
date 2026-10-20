import type { PermanentSection } from '@piccolo/core';
import { cn } from 'cn';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useId } from 'react';
import { AllergenSelect } from '@/components/AllergenSelect';
import { PriceInput } from '@/components/PriceInput';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { ItemField, ItemRow, RowErrors } from '@/items/editor';
import { ItemImageCell } from '@/items/ItemImageCell';
import { cell, VariationsCell } from '@/pages/weeklyMenu/ItemRow';
import { strings } from '@/strings';

const t = strings.items;

/** The row's own cells, next to the weekly menu's (`cell`) so the two screens line up. */
const actions = {
  /** Up, down and, for a new item, discard. */
  order: 'flex h-8 shrink-0 items-center @4xl:w-24',
  /** What replaces the active switch and the arrows on an inactive row. */
  reactivate: 'flex h-8 shrink-0 items-center @4xl:w-40',
};

export type ItemsSectionProps = {
  section: PermanentSection;
  rows: readonly ItemRow[];
  errors: RowErrors;
  /** Stored items whose sold-out switch is on its way to the API. */
  soldOutPending: ReadonlySet<string>;
  /** Stored item id → its image's version, for the items that have one. */
  imageVersions: ReadonlyMap<string, string>;
  /** Stored items with an image upload or removal in flight. */
  imagePending: ReadonlySet<string>;
  /** The list is being saved: no image operation may start. */
  saving: boolean;
  onEdit: (key: string, patch: Partial<Pick<ItemRow, ItemField>>) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onMove: (key: string, direction: -1 | 1) => void;
  onActive: (key: string, active: boolean) => void;
  onSoldOut: (id: string, soldOut: boolean) => void;
  onImagePick: (id: string, file: File) => void;
  onImageRemove: (id: string) => void;
};

function errorMessage(code: string): string {
  const messages: Readonly<Record<string, string>> = t.fieldErrors;
  return Object.hasOwn(messages, code)
    ? (messages[code] ?? t.fieldErrorFallback)
    : t.fieldErrorFallback;
}

function FieldError({ id, code }: { id: string; code: string | undefined }) {
  if (code === undefined) {
    return null;
  }
  return (
    <p id={id} className="text-destructive text-xs">
      {errorMessage(code)}
    </p>
  );
}

/** A side has no price, and only the all-week mains can require a side. */
function fieldsOf(section: PermanentSection) {
  return { priced: section !== 'sides', sideChoice: section === 'allWeek' };
}

type RowProps = Pick<
  ItemsSectionProps,
  | 'onEdit'
  | 'onRemove'
  | 'onMove'
  | 'onActive'
  | 'onSoldOut'
  | 'onImagePick'
  | 'onImageRemove'
  | 'saving'
> & {
  row: ItemRow;
  section: PermanentSection;
  label: string;
  errors: Readonly<Record<string, string>> | undefined;
  isFirst: boolean;
  isLast: boolean;
  soldOutPending: boolean;
  imageVersion: string | undefined;
  imagePending: boolean;
};

/**
 * One item as one row, as in the weekly menu: name, description and prices, then the variations,
 * allergens and the switches. Inactive rows come last, greyed, with a reactivate button instead of
 * the active switch. The sold-out switch writes at once, so a new item has none until it is saved.
 */
function EditableRow({
  row,
  section,
  label,
  errors = {},
  isFirst,
  isLast,
  soldOutPending,
  imageVersion,
  imagePending,
  saving,
  onEdit,
  onRemove,
  onMove,
  onActive,
  onSoldOut,
  onImagePick,
  onImageRemove,
}: RowProps) {
  const id = useId();
  const { priced, sideChoice } = fieldsOf(section);
  const shown = new Set<string>(['name', 'description', 'variations', 'allergens']);
  if (priced) {
    shown.add('priceWeekday');
    shown.add('priceWeekend');
  }
  if (sideChoice) {
    shown.add('requiresSide');
  }
  // Errors on what has no input here (`id`, a side's hidden price) show under the row.
  const other = Object.entries(errors).filter(([field]) => !shown.has(field));

  const invalid = (field: ItemField) =>
    errors[field]
      ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-${field}-error` }
      : {};
  const error = (field: ItemField) => (
    <FieldError id={`${id}-${field}-error`} code={errors[field]} />
  );
  const dim = row.active ? undefined : 'opacity-60';

  return (
    <fieldset
      aria-label={label}
      data-inactive={row.active ? undefined : ''}
      data-sold-out={row.soldOut || undefined}
      className={cn(
        'flex min-w-0 flex-wrap items-start gap-x-2 gap-y-2 border-b py-2 last:border-b-0 @4xl:flex-nowrap',
        (!row.active || row.soldOut) && 'bg-muted/60',
      )}
    >
      <div
        className={cn(
          'flex min-w-0 flex-[3_1_26rem] items-start gap-2 @4xl:contents',
          dim && '[&>*]:opacity-60',
        )}
      >
        <ItemImageCell
          id={row.id}
          version={imageVersion}
          label={label}
          busy={imagePending}
          disabled={saving || imagePending}
          onPick={(file) => row.id !== undefined && onImagePick(row.id, file)}
          onRemove={() => row.id !== undefined && onImageRemove(row.id)}
        />
        <div className={cn('grid gap-1', cell.name)}>
          <Input
            id={`${row.key}-name`}
            aria-label={t.columns.name}
            placeholder={t.columns.name}
            autoComplete="off"
            value={row.name}
            className="h-8 font-medium"
            onChange={(event) => onEdit(row.key, { name: event.target.value })}
            {...invalid('name')}
          />
          {error('name')}
        </div>
        <div className={cn('grid gap-1', cell.description)}>
          <Input
            aria-label={t.columns.description}
            placeholder={t.columns.description}
            autoComplete="off"
            value={row.description}
            className="h-8"
            onChange={(event) => onEdit(row.key, { description: event.target.value })}
            {...invalid('description')}
          />
          {error('description')}
        </div>
        {priced && (
          <>
            <PriceInput
              id={`${id}-priceWeekday`}
              label={t.columns.priceWeekday}
              value={row.priceWeekday}
              className={cell.price}
              error={error('priceWeekday')}
              onChange={(priceWeekday) => onEdit(row.key, { priceWeekday })}
              {...invalid('priceWeekday')}
            />
            <PriceInput
              id={`${id}-priceWeekend`}
              label={t.columns.priceWeekend}
              value={row.priceWeekend}
              weekend
              // Empty means the weekday price; the placeholder shows it.
              placeholder={row.priceWeekday}
              title={t.weekendSameAsWeekday}
              className={cell.priceWeekend}
              error={error('priceWeekend')}
              onChange={(priceWeekend) => onEdit(row.key, { priceWeekend })}
              {...invalid('priceWeekend')}
            />
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-[2_1_34rem] flex-wrap items-start gap-2 @4xl:contents">
        <div className={cn('grid grid-cols-[minmax(0,1fr)] gap-1', cell.variations, dim)}>
          <VariationsCell
            id={`${id}-variations`}
            value={row.variations}
            onChange={(variations) => onEdit(row.key, { variations })}
            invalid={Boolean(errors.variations)}
            {...(errors.variations ? { 'aria-describedby': `${id}-variations-error` } : {})}
          />
          {error('variations')}
        </div>
        <div className={cn('grid grid-cols-[minmax(0,1fr)] gap-1', cell.allergens, dim)}>
          <AllergenSelect
            value={row.allergens}
            onChange={(allergens) => onEdit(row.key, { allergens })}
            invalid={Boolean(errors.allergens)}
            className="h-8"
            {...(errors.allergens ? { 'aria-describedby': `${id}-allergens-error` } : {})}
          />
          {error('allergens')}
        </div>
        {sideChoice && (
          <div className={cn('grid gap-1', cell.toggle, dim)}>
            <div className="flex h-8 items-center gap-2 @4xl:justify-center">
              <Checkbox
                id={`${id}-requiresSide`}
                checked={row.requiresSide}
                onCheckedChange={(checked) => onEdit(row.key, { requiresSide: checked === true })}
                {...invalid('requiresSide')}
              />
              <Label htmlFor={`${id}-requiresSide`} className="font-normal text-xs @4xl:sr-only">
                {t.columns.requiresSide}
              </Label>
            </div>
            {error('requiresSide')}
          </div>
        )}
        <div
          className={cn('flex h-8 items-center gap-2', cell.toggle, dim)}
          title={row.id === undefined ? t.soldOutAfterSave : undefined}
        >
          <Switch
            id={`${id}-soldOut`}
            size="sm"
            checked={row.soldOut}
            disabled={row.id === undefined || soldOutPending}
            onCheckedChange={(soldOut) => {
              if (row.id !== undefined) {
                onSoldOut(row.id, soldOut);
              }
            }}
          />
          <Label htmlFor={`${id}-soldOut`} className="font-normal text-xs @4xl:sr-only">
            {t.columns.soldOut}
          </Label>
        </div>
        {row.active ? (
          <>
            <div className={cn('flex h-8 items-center gap-2', cell.toggle)}>
              <Switch
                id={`${id}-active`}
                size="sm"
                checked
                onCheckedChange={(active) => onActive(row.key, active)}
              />
              <Label htmlFor={`${id}-active`} className="font-normal text-xs @4xl:sr-only">
                {t.columns.active}
              </Label>
            </div>
            <div className={actions.order}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label={t.moveUp}
                title={t.moveUp}
                disabled={isFirst}
                onClick={() => onMove(row.key, -1)}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label={t.moveDown}
                title={t.moveDown}
                disabled={isLast}
                onClick={() => onMove(row.key, 1)}
              >
                <ArrowDownIcon />
              </Button>
              {row.id === undefined && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  aria-label={t.removeNewItem}
                  title={t.removeNewItem}
                  onClick={() => onRemove(row.key)}
                >
                  <Trash2Icon />
                </Button>
              )}
            </div>
          </>
        ) : (
          // An inactive item has no place in the order; reactivating puts it last.
          <div className={actions.reactivate}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onActive(row.key, true)}
            >
              {t.reactivate}
            </Button>
          </div>
        )}
      </div>

      {other.length > 0 && (
        <ul className="basis-full text-destructive text-xs">
          {other.map(([field, code]) => (
            <li key={field}>{errorMessage(code)}</li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

/**
 * The column names above a section's rows, in the rows' widths. Only where the rows are one line
 * (a container at 4xl); narrower, each field says what it is on its own.
 */
function ItemsHeader({ section }: { section: PermanentSection }) {
  const { priced, sideChoice } = fieldsOf(section);
  const title = (text: string, width: string, extra?: string) => (
    <span className={cn('truncate', width, extra)}>{text}</span>
  );
  const toggle = (text: string) => (
    <span className={cn('text-center leading-tight', cell.toggle)}>{text}</span>
  );
  return (
    <div
      aria-hidden="true"
      className="hidden flex-nowrap items-end gap-x-2 pb-1 text-muted-foreground text-xs @4xl:flex"
    >
      <span className="w-10 shrink-0" />
      {title(t.columns.name, cell.name)}
      {title(t.columns.description, cell.description)}
      {priced && title(t.columns.priceWeekday, cell.price, 'text-right')}
      {priced && title(t.columns.priceWeekend, cell.priceWeekend, 'text-right')}
      {title(t.columns.variations, cell.variations)}
      {title(t.columns.allergens, cell.allergens)}
      {sideChoice && toggle(t.columns.requiresSide)}
      {toggle(t.columns.soldOut)}
      {toggle(t.columns.active)}
      <span className="w-24 shrink-0" />
    </div>
  );
}

/**
 * One permanent section as a card of rows, like a day of the weekly menu. Only the active rows
 * move; the inactive ones stay below them.
 */
export function ItemsSection({
  section,
  rows,
  errors,
  soldOutPending,
  imageVersions,
  imagePending,
  onAdd,
  ...handlers
}: ItemsSectionProps) {
  const headingId = useId();
  const activeRows = rows.filter((row) => row.active).length;

  return (
    <section
      aria-labelledby={headingId}
      className="@container flex min-w-0 flex-col gap-2 rounded-lg border bg-card px-3 py-3 shadow-xs"
    >
      <h2 id={headingId} className="font-semibold text-xl">
        {t.sections[section]}
      </h2>
      <div className="flex flex-col">
        {rows.length > 0 ? (
          <ItemsHeader section={section} />
        ) : (
          <p className="py-1 text-muted-foreground text-sm">{t.emptySection}</p>
        )}
        {rows.map((row, index) => (
          <EditableRow
            key={row.key}
            row={row}
            section={section}
            label={t.rowName(t.sections[section], index + 1)}
            errors={errors[row.key]}
            isFirst={index === 0}
            isLast={index === activeRows - 1}
            soldOutPending={row.id !== undefined && soldOutPending.has(row.id)}
            imageVersion={row.id === undefined ? undefined : imageVersions.get(row.id)}
            imagePending={row.id !== undefined && imagePending.has(row.id)}
            {...handlers}
          />
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 self-start text-muted-foreground"
          onClick={onAdd}
        >
          <PlusIcon />
          {t.addItem}
        </Button>
      </div>
    </section>
  );
}
