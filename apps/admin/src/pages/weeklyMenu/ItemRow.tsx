import { cn } from 'cn';
import { useId } from 'react';
import { AllergenSelect } from '@/components/AllergenSelect';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { VariationsInput } from '@/components/VariationsInput';
import { strings } from '@/strings';
import type { ListKind, Row, RowField } from './model';

const t = strings.weeklyMenu;

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
    <div className={cn('grid shrink-0 gap-1', field === 'priceWeekend' ? 'w-32' : 'w-24')}>
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
        <div className="grid w-44 min-w-0 shrink gap-1">
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
        <div className="grid w-36 min-w-0 shrink gap-1">
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
        <div className="grid min-w-30 flex-[1_1_9rem] gap-1">
          <VariationsInput
            value={row.variations}
            onChange={(variations) => onChange({ variations }, 'variations')}
            invalid={Boolean(errors.variations)}
            className="min-h-8 py-0.5"
            {...(errors.variations ? { 'aria-describedby': `${id}-variations-error` } : {})}
          />
          {error('variations')}
        </div>
        <div className="grid w-36 min-w-24 shrink gap-1">
          <AllergenSelect
            value={row.allergens}
            onChange={(allergens) => onChange({ allergens }, 'allergens')}
            invalid={Boolean(errors.allergens)}
            className="min-h-8"
            {...(errors.allergens ? { 'aria-describedby': `${id}-allergens-error` } : {})}
          />
          {error('allergens')}
        </div>
        {!soup && (
          <div className="grid shrink-0 gap-1">
            <div className="flex h-8 items-center gap-2">
              <Checkbox
                id={`${id}-soupIncluded`}
                checked={row.soupIncluded}
                onCheckedChange={(checked) =>
                  onChange({ soupIncluded: checked === true }, 'soupIncluded')
                }
                {...invalid('soupIncluded')}
              />
              <Label htmlFor={`${id}-soupIncluded`} className="font-normal text-xs">
                {t.fields.soupIncluded}
              </Label>
            </div>
            {error('soupIncluded')}
          </div>
        )}
        <div
          className="flex h-8 shrink-0 items-center gap-2"
          title={row.id ? undefined : t.fields.soldOutUnsaved}
        >
          <Switch
            id={`${id}-soldOut`}
            size="sm"
            checked={soldOut ?? false}
            disabled={soldOut === undefined}
            onCheckedChange={onSoldOutChange}
          />
          <Label htmlFor={`${id}-soldOut`} className="font-normal text-xs">
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
