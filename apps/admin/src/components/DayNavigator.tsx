import { addDays } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DatePicker } from '@/components/DatePicker';
import { Button } from '@/components/ui/button';
import { fromIsoDate, toIsoDate } from '@/dates';
import { strings } from '@/strings';

type DayNavigatorProps = {
  /** ISO date, `YYYY-MM-DD`. */
  value: string;
  onChange: (value: string) => void;
};

/** The day a screen shows: `DatePicker` between a previous-day and a next-day button. */
export function DayNavigator({ value, onChange }: DayNavigatorProps) {
  const step = (days: number) => {
    const day = fromIsoDate(value);
    if (day) {
      onChange(toIsoDate(addDays(day, days)));
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label={strings.dayNavigator.previous}
        title={strings.dayNavigator.previous}
        onClick={() => step(-1)}
      >
        <ChevronLeft />
      </Button>
      <DatePicker value={value} onChange={onChange} />
      <Button
        variant="outline"
        size="icon"
        aria-label={strings.dayNavigator.next}
        title={strings.dayNavigator.next}
        onClick={() => step(1)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
