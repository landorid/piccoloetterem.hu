import { type AllergenCode, allergenCodes, allergenLabelsHu } from '@piccolo/core';
import { cn } from 'cn';
import { ChevronDownIcon } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { strings } from '@/strings';

type AllergenSelectProps = {
  value: readonly AllergenCode[];
  /** Always in the order of the EU list (`allergenCodes`). */
  onChange: (value: AllergenCode[]) => void;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  'aria-describedby'?: string;
  className?: string;
};

/**
 * The allergens of a dish: the EU-14 list with its Hungarian labels, both from `packages/core`,
 * as checkboxes in a `Popover`. The button shows the chosen ones as one line of text, cut off with an ellipsis when it does not fit;
 * the full list is its tooltip.
 */
export function AllergenSelect({
  value,
  onChange,
  id,
  disabled = false,
  invalid = false,
  'aria-describedby': ariaDescribedBy,
  className,
}: AllergenSelectProps) {
  const ownId = useId();
  const chosen = allergenCodes.filter((code) => value.includes(code));
  const summary =
    chosen.length > 0
      ? chosen.map((code) => allergenLabelsHu[code]).join(', ')
      : strings.allergenSelect.none;

  const toggle = (code: AllergenCode, checked: boolean) => {
    onChange(allergenCodes.filter((other) => (other === code ? checked : value.includes(other))));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={`${strings.allergenSelect.label}: ${summary}`}
          aria-invalid={invalid || undefined}
          aria-describedby={ariaDescribedBy}
          title={chosen.length > 0 ? summary : undefined}
          className={cn('w-full justify-between gap-1 px-3 font-normal', className)}
        >
          <span
            className={cn(
              'min-w-0 truncate text-left',
              chosen.length === 0 && 'text-muted-foreground',
            )}
          >
            {summary}
          </span>
          <ChevronDownIcon className="shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <fieldset className="flex flex-col">
          <legend className="sr-only">{strings.allergenSelect.label}</legend>
          {allergenCodes.map((code) => {
            const checkboxId = `${id ?? ownId}-${code}`;
            return (
              <label
                key={code}
                htmlFor={checkboxId}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  id={checkboxId}
                  checked={value.includes(code)}
                  onCheckedChange={(checked) => toggle(code, checked === true)}
                />
                {allergenLabelsHu[code]}
              </label>
            );
          })}
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
