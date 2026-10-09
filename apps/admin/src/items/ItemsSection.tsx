import type { PermanentSection } from '@piccolo/core';
import { cn } from 'cn';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { AllergenSelect } from '@/components/AllergenSelect';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { VariationsInput } from '@/components/VariationsInput';
import type { ItemField, ItemRow, RowErrors } from '@/items/editor';
import { strings } from '@/strings';

export type ItemsSectionProps = {
  section: PermanentSection;
  rows: readonly ItemRow[];
  errors: RowErrors;
  /** Stored items whose sold-out switch is on its way to the API. */
  soldOutPending: ReadonlySet<string>;
  onEdit: (key: string, patch: Partial<Pick<ItemRow, ItemField>>) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onMove: (key: string, direction: -1 | 1) => void;
  onActive: (key: string, active: boolean) => void;
  onSoldOut: (id: string, soldOut: boolean) => void;
};

function errorMessage(code: string): string {
  const messages: Readonly<Record<string, string>> = strings.items.fieldErrors;
  return Object.hasOwn(messages, code)
    ? (messages[code] ?? strings.items.fieldErrorFallback)
    : strings.items.fieldErrorFallback;
}

function FieldError({ id, code }: { id: string; code: string | undefined }) {
  if (code === undefined) {
    return null;
  }
  return (
    <p id={id} className="mt-1 text-destructive text-xs">
      {errorMessage(code)}
    </p>
  );
}

/**
 * One permanent section as an editable table. A side has no price, so the sides table has no
 * price columns; only the all-week mains can require a side. Inactive rows come last, greyed,
 * with a reactivate button instead of the active switch.
 */
export function ItemsSection({
  section,
  rows,
  errors,
  soldOutPending,
  onEdit,
  onAdd,
  onRemove,
  onMove,
  onActive,
  onSoldOut,
}: ItemsSectionProps) {
  const priced = section !== 'sides';
  const sideChoice = section === 'allWeek';
  const shownFields: readonly ItemField[] = [
    'name',
    'description',
    ...(priced ? (['priceWeekday', 'priceWeekend'] as const) : []),
    'variations',
    ...(sideChoice ? (['requiresSide'] as const) : []),
    'allergens',
  ];
  // Name and description share a cell.
  const columns = shownFields.length + 2;
  const activeRows = rows.filter((row) => row.active).length;
  const headingId = `${section}-heading`;
  const { columns: labels } = strings.items;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="font-semibold text-lg">
        {strings.items.sections[section]}
      </h2>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.nameAndDescription}</TableHead>
              {priced && <TableHead className="whitespace-normal">{labels.priceWeekday}</TableHead>}
              {priced && <TableHead className="whitespace-normal">{labels.priceWeekend}</TableHead>}
              <TableHead>{labels.variations}</TableHead>
              {sideChoice && (
                <TableHead className="whitespace-normal">{labels.requiresSide}</TableHead>
              )}
              <TableHead>{labels.allergens}</TableHead>
              <TableHead>{labels.soldOut}</TableHead>
              <TableHead>{labels.active}</TableHead>
              <TableHead>{labels.order}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns} className="text-muted-foreground">
                  {strings.items.emptySection}
                </TableCell>
              </TableRow>
            )}
            {rows.map((row, index) => {
              const rowErrors = errors[row.key] ?? {};
              const id = (field: string) => `${row.key}-${field}`;
              const errorId = (field: string) => `${row.key}-${field}-error`;
              const invalid = (field: ItemField) => rowErrors[field] !== undefined;
              const describedBy = (field: ItemField) =>
                invalid(field) ? errorId(field) : undefined;
              // Errors on what has no input here (`id`, a side's hidden price) show under the name.
              const rowLevel = Object.entries(rowErrors).filter(
                ([field]) => !(shownFields as readonly string[]).includes(field),
              );
              const dim = cn('whitespace-normal align-top', !row.active && 'opacity-60');

              return (
                <TableRow
                  key={row.key}
                  data-inactive={row.active ? undefined : ''}
                  className={cn(!row.active && 'bg-muted/40')}
                >
                  <TableCell className={dim}>
                    <div className="flex min-w-48 flex-col gap-1">
                      <Input
                        id={id('name')}
                        value={row.name}
                        aria-label={labels.name}
                        aria-invalid={invalid('name') || undefined}
                        aria-describedby={describedBy('name')}
                        onChange={(event) => onEdit(row.key, { name: event.target.value })}
                      />
                      <FieldError id={errorId('name')} code={rowErrors.name} />
                      {rowLevel.map(([field, code]) => (
                        <FieldError key={field} id={errorId(field)} code={code} />
                      ))}
                      <Input
                        id={id('description')}
                        value={row.description}
                        placeholder={strings.items.descriptionPlaceholder}
                        aria-label={labels.description}
                        aria-invalid={invalid('description') || undefined}
                        aria-describedby={describedBy('description')}
                        className="h-8 text-xs md:text-xs"
                        onChange={(event) => onEdit(row.key, { description: event.target.value })}
                      />
                      <FieldError id={errorId('description')} code={rowErrors.description} />
                    </div>
                  </TableCell>
                  {priced && (
                    <TableCell className={dim}>
                      <Input
                        id={id('priceWeekday')}
                        value={row.priceWeekday}
                        inputMode="numeric"
                        aria-label={labels.priceWeekday}
                        aria-invalid={invalid('priceWeekday') || undefined}
                        aria-describedby={describedBy('priceWeekday')}
                        className="w-20 text-right"
                        onChange={(event) => onEdit(row.key, { priceWeekday: event.target.value })}
                      />
                      <FieldError id={errorId('priceWeekday')} code={rowErrors.priceWeekday} />
                    </TableCell>
                  )}
                  {priced && (
                    <TableCell className={dim}>
                      <Input
                        id={id('priceWeekend')}
                        value={row.priceWeekend}
                        inputMode="numeric"
                        // Empty means the weekday price; the placeholder shows it.
                        placeholder={row.priceWeekday}
                        title={strings.items.weekendSameAsWeekday}
                        aria-label={labels.priceWeekend}
                        aria-invalid={invalid('priceWeekend') || undefined}
                        aria-describedby={describedBy('priceWeekend')}
                        className="w-20 text-right"
                        onChange={(event) => onEdit(row.key, { priceWeekend: event.target.value })}
                      />
                      <FieldError id={errorId('priceWeekend')} code={rowErrors.priceWeekend} />
                    </TableCell>
                  )}
                  <TableCell className={dim}>
                    <VariationsInput
                      id={id('variations')}
                      value={row.variations}
                      aria-label={labels.variations}
                      invalid={invalid('variations')}
                      aria-describedby={describedBy('variations')}
                      className="min-w-40"
                      onChange={(variations) => onEdit(row.key, { variations })}
                    />
                    <FieldError id={errorId('variations')} code={rowErrors.variations} />
                  </TableCell>
                  {sideChoice && (
                    <TableCell className={dim}>
                      <Checkbox
                        id={id('requiresSide')}
                        checked={row.requiresSide}
                        aria-label={labels.requiresSide}
                        aria-invalid={invalid('requiresSide') || undefined}
                        aria-describedby={describedBy('requiresSide')}
                        className="mt-2.5"
                        onCheckedChange={(checked) =>
                          onEdit(row.key, { requiresSide: checked === true })
                        }
                      />
                      <FieldError id={errorId('requiresSide')} code={rowErrors.requiresSide} />
                    </TableCell>
                  )}
                  <TableCell className={dim}>
                    <AllergenSelect
                      id={id('allergens')}
                      value={row.allergens}
                      invalid={invalid('allergens')}
                      aria-describedby={describedBy('allergens')}
                      className="min-w-44"
                      onChange={(allergens) => onEdit(row.key, { allergens })}
                    />
                    <FieldError id={errorId('allergens')} code={rowErrors.allergens} />
                  </TableCell>
                  <TableCell className={dim}>
                    <Switch
                      checked={row.soldOut}
                      disabled={row.id === undefined || soldOutPending.has(row.id)}
                      title={row.id === undefined ? strings.items.soldOutAfterSave : undefined}
                      aria-label={labels.soldOut}
                      className="mt-2.5"
                      onCheckedChange={(soldOut) => {
                        if (row.id !== undefined) {
                          onSoldOut(row.id, soldOut);
                        }
                      }}
                    />
                  </TableCell>
                  {row.active ? (
                    <>
                      <TableCell className="align-top">
                        <Switch
                          checked
                          aria-label={labels.active}
                          className="mt-2.5"
                          onCheckedChange={(active) => onActive(row.key, active)}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-center">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={strings.items.moveUp}
                            title={strings.items.moveUp}
                            disabled={index === 0}
                            onClick={() => onMove(row.key, -1)}
                          >
                            <ArrowUpIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={strings.items.moveDown}
                            title={strings.items.moveDown}
                            disabled={index === activeRows - 1}
                            onClick={() => onMove(row.key, 1)}
                          >
                            <ArrowDownIcon />
                          </Button>
                          {row.id === undefined && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={strings.items.removeNewItem}
                              title={strings.items.removeNewItem}
                              onClick={() => onRemove(row.key)}
                            >
                              <Trash2Icon />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    // An inactive item has no place in the order; reactivating puts it last.
                    <TableCell colSpan={2} className="align-top">
                      <Button variant="outline" size="sm" onClick={() => onActive(row.key, true)}>
                        {strings.items.reactivate}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns}>
                <Button variant="ghost" size="sm" onClick={onAdd}>
                  <PlusIcon />
                  {strings.items.addItem}
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
