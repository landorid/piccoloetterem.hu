import { cn } from 'cn';
import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { strings } from '@/strings';

type PriceInputProps = {
  id: string;
  /** What the field is, for screen readers; the visible name is the column header. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Marks the weekend price with a short label inside the left edge. */
  weekend?: boolean;
  placeholder?: string;
  title?: string;
  /** The field's width, e.g. `w-24 shrink-0`. */
  className?: string;
  /** Shown under the input; `aria-invalid`/`aria-describedby` come from the caller's props. */
  error?: ReactNode;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
};

/** A price in whole forints: right-aligned, with "Ft" inside the field. */
export function PriceInput({
  id,
  label,
  value,
  onChange,
  weekend = false,
  placeholder,
  title,
  className,
  error,
  ...aria
}: PriceInputProps) {
  return (
    <div className={cn('grid gap-1', className)}>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <div className="relative">
        {weekend && (
          <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-muted-foreground text-xs">
            {strings.weeklyMenu.fields.weekendShort}
          </span>
        )}
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          title={title}
          className="h-8 pr-7 text-right tabular-nums"
          onChange={(event) => onChange(event.target.value)}
          {...aria}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted-foreground text-xs">
          {strings.weeklyMenu.fields.currency}
        </span>
      </div>
      {error}
    </div>
  );
}
