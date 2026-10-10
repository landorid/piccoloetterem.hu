import { cn } from 'cn';
import { ChevronDownIcon } from 'lucide-react';
import { useId } from 'react';
import { AllergenSelect } from '@/components/AllergenSelect';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { VariationsInput } from '@/components/VariationsInput';
import { strings } from '@/strings';
import type { ListKind, Row, RowField } from './model';

const t = strings.weeklyMenu;

/**
 * The widths of a row's cells, shared with the header above the rows so the two line up. The
 * toggles are narrow columns under their header when there is room for the header (a container at
 * 4xl); below that the rows have no header and keep a visible label beside each toggle.
 */
const cell = {
  name: 'w-56 min-w-0 shrink',
  description: 'w-48 min-w-0 shrink',
  price: 'w-24 shrink-0',
  priceWeekend: 'w-32 shrink-0',
  variations: 'min-w-30 flex-[1_1_9rem]',
  allergens: 'w-44 min-w-24 shrink',
  toggle: 'shrink-0 @4xl:w-16 @4xl:justify-center',
};

type FieldErrors = Partial<Record<RowField, string>>;

type ItemRowProps = {
  row: Row;
  kind: ListKind;
  /** Saturday's mains and featured items have a weekend price as well. */
  weekendPrice: boolean;
  /** For screen readers, e.g. "Monday, 2. soup" in Hungarian (strings.weeklyMenu.rowNames). */
  label: string;
  errors: FieldErrors | undefined;
  /** The stored item's flag; undefined for a row that has never been saved. */
  soldOut: boolean | undefined;
  onChange: (patch: Partial<Row>, field: RowField) => void;
  onSoldOutChange: (soldOut: boolean) => void;
};

export function errorMessage(code: string): string {
  const messages: Record<string, string> = t.fieldErrors;
  return messages[code] ?? t.fieldErrors.fallback;
}

/**
 * One dish as one row, so a day reads down the page: name, description and price, then the
 * variations, allergens, soup and sold-out. The two groups share a line when there is room and
 * otherwise the second drops below the first, the same way in every row. There is no delete: a
 * row emptied of its text is left out of the save.
 */
export function ItemRow({
  row,
  kind,
  weekendPrice,
  label,
  errors = {},
  soldOut,
  onChange,
  onSoldOutChange,
}: ItemRowProps) {
  const id = useId();
  const soup = kind === 'soups';
  // Errors the row has no field for, such as an `id` the API rejected, are listed below it.
  const shown = new Set<RowField>(['name', 'description', 'variations', 'allergens']);
  if (!soup) {
    shown.add('priceWeekday');
    shown.add('soupIncluded');
  }
  if (!soup && weekendPrice) {
    shown.add('priceWeekend');
  }
  const other = Object.entries(errors).filter(([field]) => !shown.has(field as RowField));

  /** Props tying a control to its error message. */
  const invalid = (field: RowField) =>
    errors[field] ? { 'aria-invalid': true, 'aria-describedby': `${id}-${field}-error` } : {};
  const error = (field: RowField) =>
    errors[field] && (
      <p id={`${id}-${field}-error`} className="text-destructive text-xs">
        {errorMessage(errors[field])}
      </p>
    );

  const price = (field: 'priceWeekday' | 'priceWeekend', caption: string) => (
    <div className={cn('grid gap-1', field === 'priceWeekend' ? cell.priceWeekend : cell.price)}>
      <Label htmlFor={`${id}-${field}`} className="sr-only">
        {caption}
      </Label>
      <div className="relative">
        {field === 'priceWeekend' && (
          <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-muted-foreground text-xs">
            {t.fields.weekendShort}
          </span>
        )}
        <Input
          id={`${id}-${field}`}
          inputMode="numeric"
          autoComplete="off"
          value={row[field]}
          placeholder={field === 'priceWeekend' ? row.priceWeekday : undefined}
          title={field === 'priceWeekend' ? t.fields.weekendEmpty : undefined}
          className="h-8 pr-7 text-right tabular-nums"
          onChange={(event) => onChange({ [field]: event.target.value }, field)}
          {...invalid(field)}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted-foreground text-xs">
          {t.fields.currency}
        </span>
      </div>
      {error(field)}
    </div>
  );

  return (
    <fieldset
      aria-label={label}
      data-sold-out={soldOut || undefined}
      className={cn(
        'flex min-w-0 flex-wrap items-start gap-x-2 gap-y-2 border-b py-2 last:border-b-0 @4xl:flex-nowrap',
        soldOut && 'bg-muted/60',
      )}
    >
      <div className="flex min-w-0 flex-[3_1_26rem] items-start gap-2 @4xl:contents">
        <div className={cn('grid gap-1', cell.name)}>
          <Input
            aria-label={t.fields.name}
            placeholder={t.fields.name}
            autoComplete="off"
            value={row.name}
            className="h-8 font-medium"
            onChange={(event) => onChange({ name: event.target.value }, 'name')}
            {...invalid('name')}
          />
          {error('name')}
        </div>
        <div className={cn('grid gap-1', cell.description)}>
          <Input
            aria-label={t.fields.description}
            placeholder={t.fields.description}
            autoComplete="off"
            value={row.description}
            className="h-8"
            onChange={(event) => onChange({ description: event.target.value }, 'description')}
            {...invalid('description')}
          />
          {error('description')}
        </div>
        {!soup && price('priceWeekday', weekendPrice ? t.fields.priceWeekday : t.fields.price)}
        {!soup && weekendPrice && price('priceWeekend', t.fields.priceWeekend)}
      </div>

      <div className="flex min-w-0 flex-[2_1_34rem] flex-wrap items-start gap-2 @4xl:contents">
        <div className={cn('grid grid-cols-[minmax(0,1fr)] gap-1', cell.variations)}>
          <VariationsCell
            id={`${id}-variations`}
            value={row.variations}
            onChange={(variations) => onChange({ variations }, 'variations')}
            invalid={Boolean(errors.variations)}
            {...(errors.variations ? { 'aria-describedby': `${id}-variations-error` } : {})}
          />
          {error('variations')}
        </div>
        <div className={cn('grid grid-cols-[minmax(0,1fr)] gap-1', cell.allergens)}>
          <AllergenSelect
            value={row.allergens}
            onChange={(allergens) => onChange({ allergens }, 'allergens')}
            invalid={Boolean(errors.allergens)}
            className="h-8"
            {...(errors.allergens ? { 'aria-describedby': `${id}-allergens-error` } : {})}
          />
          {error('allergens')}
        </div>
        {!soup && (
          <div className={cn('grid gap-1', cell.toggle)}>
            <div className="flex h-8 items-center gap-2 @4xl:justify-center">
              <Checkbox
                id={`${id}-soupIncluded`}
                checked={row.soupIncluded}
                onCheckedChange={(checked) =>
                  onChange({ soupIncluded: checked === true }, 'soupIncluded')
                }
                {...invalid('soupIncluded')}
              />
              <Label htmlFor={`${id}-soupIncluded`} className="font-normal text-xs @4xl:sr-only">
                {t.fields.soupIncluded}
              </Label>
            </div>
            {error('soupIncluded')}
          </div>
        )}
        <div
          className={cn('flex h-8 items-center gap-2', cell.toggle)}
          title={row.id ? undefined : t.fields.soldOutUnsaved}
        >
          <Switch
            id={`${id}-soldOut`}
            size="sm"
            checked={soldOut ?? false}
            disabled={soldOut === undefined}
            onCheckedChange={onSoldOutChange}
          />
          <Label htmlFor={`${id}-soldOut`} className="font-normal text-xs @4xl:sr-only">
            {t.fields.soldOut}
          </Label>
        </div>
      </div>

      {other.length > 0 && (
        <ul className="basis-full text-destructive text-xs">
          {other.map(([field, code]) => (
            <li key={field}>{errorMessage(code ?? '')}</li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

type VariationsCellProps = {
  id: string;
  value: readonly string[];
  onChange: (value: string[]) => void;
  invalid: boolean;
  'aria-describedby'?: string;
};

/**
 * The variations of a row as one line of text that truncates, so any number of them keeps the row
 * one line high. The chips and the input to add one are in a popover.
 */
function VariationsCell({ id, value, onChange, invalid, ...rest }: VariationsCellProps) {
  const summary = value.join(', ');
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={`${strings.variationsInput.label}: ${summary || strings.allergenSelect.none}`}
          aria-invalid={invalid || undefined}
          aria-describedby={rest['aria-describedby']}
          title={summary || undefined}
          className="h-8 w-full justify-between gap-1 px-3 font-normal"
        >
          <span
            className={cn(
              'min-w-0 truncate text-left',
              value.length === 0 && 'text-muted-foreground',
            )}
          >
            {summary || t.fields.variationShort}
          </span>
          <ChevronDownIcon className="shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-2"
        align="start"
        onOpenAutoFocus={(event) => {
          // The input, not the first chip's remove button.
          event.preventDefault();
          document.getElementById(id)?.focus();
        }}
      >
        <VariationsInput id={id} value={value} onChange={onChange} invalid={invalid} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * The column names above a list's rows, in the rows' widths. Only where the rows are one line
 * (a container at 4xl); narrower, each field says what it is on its own.
 */
export function ItemRowHeader({ kind, weekendPrice }: { kind: ListKind; weekendPrice: boolean }) {
  const soup = kind === 'soups';
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
      {title(t.fields.name, cell.name)}
      {title(t.fields.description, cell.description)}
      {!soup &&
        title(weekendPrice ? t.fields.priceWeekday : t.fields.price, cell.price, 'text-right')}
      {!soup && weekendPrice && title(t.fields.priceWeekend, cell.priceWeekend, 'text-right')}
      {title(strings.variationsInput.label, cell.variations)}
      {title(strings.allergenSelect.label, cell.allergens)}
      {!soup && toggle(t.fields.soupIncluded)}
      {toggle(t.fields.soldOut)}
    </div>
  );
}
