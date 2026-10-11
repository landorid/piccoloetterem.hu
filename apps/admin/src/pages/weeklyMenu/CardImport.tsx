import { type CardImportResult, type ImportFinding, readMenuCard } from '@piccolo/core/menu-card';
import { FileUpIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { strings } from '@/strings';
import type { IsoWeek } from './model';

const t = strings.weeklyMenu.cardImport;

export type ImportedCard = Extract<CardImportResult, { ok: true }>;

const isMismatch = (
  finding: ImportFinding,
): finding is Extract<ImportFinding, { kind: 'week_mismatch' }> => finding.kind === 'week_mismatch';

type CardImportProps = {
  week: IsoWeek;
  /** Whether a card would replace something: unsaved edits, or a stored week with items. */
  replaces: boolean;
  disabled: boolean;
  onImport: (card: ImportedCard) => void;
};

/**
 * The header button that reads the week's Word menu card (core's `readMenuCard`) and hands it to
 * the editor. A card that would replace something, or whose dates are another week's, waits for
 * staff to confirm.
 */
export function CardImport({ week, replaces, disabled, onImport }: CardImportProps) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ImportedCard | null>(null);
  const mismatch = pending?.findings.find(isMismatch);

  const apply = (card: ImportedCard) => {
    onImport(card);
    toast.success(t.applied, { id: 'card-import' });
  };

  const read = async (file: File) => {
    const bytes = await file.arrayBuffer().then(
      (buffer) => new Uint8Array(buffer),
      () => null,
    );
    const result = bytes && readMenuCard(bytes, week);
    if (!result) {
      toast.error(t.unreadable, { id: 'card-import' });
    } else if (!result.ok) {
      toast.error(t.failures[result.reason], { id: 'card-import' });
    } else if (replaces || result.findings.some(isMismatch)) {
      setPending(result);
    } else {
      apply(result);
    }
  };

  return (
    <>
      <Button variant="outline" disabled={disabled} onClick={() => input.current?.click()}>
        <FileUpIcon />
        {t.button}
      </Button>
      <input
        ref={input}
        type="file"
        accept=".docx,.doc"
        aria-label={t.fileInput}
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          // Cleared, so picking the same file again reads it again.
          event.currentTarget.value = '';
          if (file) {
            void read(file);
          }
        }}
      />
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={t.confirm.title}
        description={t.confirm.description({ replaces, mismatch })}
        confirmLabel={t.confirm.confirm}
        onConfirm={() => pending && apply(pending)}
      />
    </>
  );
}
