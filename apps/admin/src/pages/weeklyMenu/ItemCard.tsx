import { cn } from 'cn';
import { Trash2Icon } from 'lucide-react';
import { useId } from 'react';
import { AllergenSelect } from '@/components/AllergenSelect';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { VariationsInput } from '@/components/VariationsInput';
import { strings } from '@/strings';
import type { ListKind, Row, RowField } from './model';

const t = strings.weeklyMenu;

type FieldErrors = Partial<Record<RowField, string>>;

type ItemCardProps = {
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
  onRemove: () => void;
  onSoldOutChange: (soldOut: boolean) => void;
};

export function errorMessage(code: string): string {
  const messages: Record<string, string> = t.fieldErrors;
  return messages[code] ?? t.fieldErrors.fallback;
}

/** One dish of the grid: every field staff edit, its errors, sold-out and delete. */
export function ItemCard({
  row,
  kind,
  weekendPrice,
  label,
  errors = {},
  soldOut,
  onChange,
  onRemove,
  onSoldOutChange,
}: ItemCardProps) {
  const id = useId();
  const soup = kind === 'soups';
  // Errors the card has no field for, such as an `id` the API rejected, are listed at the bottom.
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
    <div className="grid min-w-0 gap-1">
      <Label htmlFor={`${id}-${field}`} className="font-normal text-muted-foreground text-xs">
        {caption}
      </Label>
      <div className="relative">
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
        'flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-2.5 shadow-xs',
        soldOut && 'border-dashed bg-muted/50',
      )}
    >
      <div className="grid gap-1">
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
      <div className="grid gap-1">
        <Textarea
          aria-label={t.fields.description}
          placeholder={t.fields.description}
          rows={2}
          value={row.description}
          className="min-h-0 resize-y py-1.5"
          onChange={(event) => onChange({ description: event.target.value }, 'description')}
          {...invalid('description')}
        />
        {error('description')}
      </div>

      {soup ? (
        <p className="text-muted-foreground text-xs">{t.fields.soupPrice}</p>
      ) : (
        <div className={cn('grid gap-2', weekendPrice && 'grid-cols-2')}>
          {price('priceWeekday', weekendPrice ? t.fields.priceWeekday : t.fields.price)}
          {weekendPrice && price('priceWeekend', t.fields.priceWeekend)}
        </div>
      )}

      <div className="grid gap-1">
        <VariationsInput
          value={row.variations}
          onChange={(variations) => onChange({ variations }, 'variations')}
          invalid={Boolean(errors.variations)}
          {...(errors.variations ? { 'aria-describedby': `${id}-variations-error` } : {})}
        />
        {error('variations')}
      </div>

      <div className="grid gap-1">
        <AllergenSelect
          value={row.allergens}
          onChange={(allergens) => onChange({ allergens }, 'allergens')}
          invalid={Boolean(errors.allergens)}
          {...(errors.allergens ? { 'aria-describedby': `${id}-allergens-error` } : {})}
        />
        {error('allergens')}
      </div>

      {!soup && (
        <div className="grid gap-1">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${id}-soupIncluded`}
              checked={row.soupIncluded}
              onCheckedChange={(checked) =>
                onChange({ soupIncluded: checked === true }, 'soupIncluded')
              }
              {...invalid('soupIncluded')}
            />
            <Label htmlFor={`${id}-soupIncluded`} className="font-normal text-sm">
              {t.fields.soupIncluded}
            </Label>
          </div>
          {error('soupIncluded')}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t pt-2">
        <div
          className="flex items-center gap-2"
          title={row.id ? undefined : t.fields.soldOutUnsaved}
        >
          <Switch
            id={`${id}-soldOut`}
            size="sm"
            checked={soldOut ?? false}
            disabled={soldOut === undefined}
            onCheckedChange={onSoldOutChange}
          />
          <Label htmlFor={`${id}-soldOut`} className="font-normal text-sm">
            {t.fields.soldOut}
          </Label>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          aria-label={t.removeRow}
          title={t.removeRow}
          onClick={onRemove}
        >
          <Trash2Icon />
        </Button>
      </div>

      {other.length > 0 && (
        <ul className="text-destructive text-xs">
          {other.map(([field, code]) => (
            <li key={field}>{errorMessage(code ?? '')}</li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
