import { type MouseEvent, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { strings } from '@/strings';

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** A red confirm button, for actions that cannot be undone (cancelling an order). */
  destructive?: boolean;
  /**
   * Runs on confirm. A returned promise keeps the dialog open with its buttons disabled until it
   * settles; it closes when the promise resolves and stays open when it rejects. Use a mutation,
   * so the global error toast reports the failure.
   */
  onConfirm: () => unknown;
};

/** "Are you sure?" before an action: shadcn's `AlertDialog`, controlled by the caller. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = strings.confirm.confirm,
  cancelLabel = strings.confirm.cancel,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  const confirm = async (event: MouseEvent) => {
    // Radix closes the dialog on Action by default; close only once onConfirm succeeds.
    event.preventDefault();
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // The mutation's error already reached the global toast; keep the dialog for a retry.
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      {/* Without a description, an explicit undefined tells Radix there is none on purpose. */}
      <AlertDialogContent {...(description ? {} : { 'aria-describedby': undefined })}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            disabled={pending}
            onClick={(event) => void confirm(event)}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
