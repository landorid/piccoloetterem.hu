import { cn } from 'cn';
import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { hu } from 'react-day-picker/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDateLong, fromIsoDate, toIsoDate } from '@/dates';
import { strings } from '@/strings';

type DatePickerProps = {
  /** ISO date, `YYYY-MM-DD`, the shape the API uses for delivery dates. */
  value: string | undefined;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

/**
 * One day, picked from a Hungarian calendar that starts on Monday: shadcn's `Calendar` in a
 * `Popover`. Clicking the selected day keeps it; there is no empty value to go back to.
 */
export function DatePicker({
  value,
  onChange,
  id,
  disabled,
  placeholder = strings.datePicker.placeholder,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? fromIsoDate(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          className={cn(
            'justify-start font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon />
          {selected ? formatDateLong(selected) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={hu}
          weekStartsOn={1}
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (date) {
              onChange(toIsoDate(date));
            }
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
