import type { ImportFinding } from '@piccolo/core/menu-card';
import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { strings } from '@/strings';
import type { ImportedCard } from './CardImport';
import { menuDays } from './model';

const t = strings.weeklyMenu.cardImport;

function describe(finding: ImportFinding): string {
  // `t.findings` holds one text per kind, typed by kind; TypeScript cannot pair them by itself.
  const text = t.findings[finding.kind] as (finding: ImportFinding) => string;
  return text(finding);
}

type ImportReportProps = {
  card: ImportedCard;
  onDismiss: () => void;
};

/**
 * What the last Word card put into the grid, what it left out and what to check, above the grid
 * until staff close it.
 */
export function ImportReport({ card, onDismiss }: ImportReportProps) {
  const count = menuDays.reduce(
    (sum, day) => sum + card.draft.days[day].soups.length + card.draft.days[day].mains.length,
    card.draft.featured.length,
  );
  return (
    <section
      aria-label={t.report.title}
      className="flex flex-col gap-2 rounded-md border bg-muted/40 p-4 text-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-semibold">{t.report.title}</h2>
          <p>{t.report.summary(count)}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t.report.dismiss}
          title={t.report.dismiss}
          onClick={onDismiss}
        >
          <XIcon />
        </Button>
      </div>
      {card.findings.length > 0 && (
        <ul className="list-disc space-y-1 pl-5">
          {card.findings.map(describe).map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground">
        {t.report.splitHint} {t.report.permanentHint}
      </p>
    </section>
  );
}
