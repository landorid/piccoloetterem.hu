import { cn } from 'cn';
import { XIcon } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { strings } from '@/strings';

type VariationsInputProps = {
  /** Trimmed, non-empty and unique, as core's `validateMenuItem` requires. */
  value: readonly string[];
  onChange: (value: string[]) => void;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  className?: string;
};

/**
 * The variations of a dish (a guest must pick one), as chips. Enter or leaving the field adds the
 * typed text; Backspace in the empty field removes the last chip. Blank and repeated entries are
 * dropped, so the value always passes core's variation rules.
 */
export function VariationsInput({
  value,
  onChange,
  id,
  disabled = false,
  invalid = false,
  'aria-label': ariaLabel = strings.variationsInput.label,
  'aria-describedby': ariaDescribedBy,
  className,
}: VariationsInputProps) {
  const [text, setText] = useState('');

  const commit = () => {
    const variation = text.trim();
    setText('');
    if (variation !== '' && !value.includes(variation)) {
      onChange([...value, variation]);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Backspace' && text === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div
      className={cn(
        'flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1 shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30',
        invalid && 'border-destructive ring-destructive/20 dark:ring-destructive/40',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      {value.map((variation) => (
        <Badge key={variation} variant="secondary" className="gap-0.5 pr-1">
          {variation}
          <button
            type="button"
            className="rounded-full p-0.5 hover:bg-muted-foreground/20 disabled:pointer-events-none"
            aria-label={strings.variationsInput.remove(variation)}
            disabled={disabled}
            onClick={() => onChange(value.filter((other) => other !== variation))}
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
      <input
        id={id}
        type="text"
        value={text}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedBy}
        placeholder={value.length === 0 ? strings.variationsInput.placeholder : undefined}
        className="h-7 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
      />
    </div>
  );
}
