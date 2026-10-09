import { ApiError, unwrap } from '@piccolo/api-client';
import type { PermanentItemsDraft, PermanentSection } from '@piccolo/core';
import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from 'cn';
import { TriangleAlertIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  addRow,
  checkSave,
  type EditorState,
  editorFromMenu,
  errorCount,
  errorsByRow,
  isDirty,
  menuWithSoldOut,
  moveRow,
  newRow,
  type RowErrors,
  type RowKeys,
  removeNewRow,
  sections,
  setActive,
  setSoldOut,
  updateRow,
  withoutError,
} from '@/items/editor';
import { ItemsSection } from '@/items/ItemsSection';
import { permanentItemsQuery } from '@/queries';
import { strings } from '@/strings';

const soldOutKey = ['admin', 'menu', 'sold-out'];

type SoldOutChange = { id: string; soldOut: boolean };

/**
 * The permanent menu at `/etlap`: every section's items edited in place and saved together with
 * one `PUT /api/admin/menu/items`. The sold-out switch alone acts at once, on its own route.
 */
export function ItemsPage() {
  const queryClient = useQueryClient();
  const menu = useQuery(permanentItemsQuery);
  const base = useMemo(() => (menu.data ? editorFromMenu(menu.data) : undefined), [menu.data]);
  // `null` until staff change something; then the edited copy, until it is saved or discarded.
  const [edited, setEdited] = useState<EditorState | null>(null);
  const [errors, setErrors] = useState<RowErrors>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [errorFocus, setErrorFocus] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);

  const state = edited ?? base;
  const dirty = edited !== null && base !== undefined && isDirty(edited, base);
  const invalidFields = errorCount(errors);

  useEffect(() => {
    if (focusId) {
      document.getElementById(focusId)?.focus();
      setFocusId(null);
    }
  }, [focusId]);

  useEffect(() => {
    if (errorFocus > 0) {
      editorRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [errorFocus]);

  // Leaving the page with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const showErrors = (next: RowErrors) => {
    setErrors(next);
    setErrorFocus((count) => count + 1);
  };

  const save = useMutation({
    mutationFn: async ({ draft }: { draft: PermanentItemsDraft; keys: RowKeys }) =>
      unwrap(await api.api.admin.menu.items.$put({ json: draft })),
    onSuccess: (saved) => {
      queryClient.setQueryData(permanentItemsQuery.queryKey, saved);
      setEdited(null);
      setErrors({});
      toast.success(strings.items.saved);
    },
    // The global handler shows the toast; the fields go next to their inputs.
    onError: (error, { keys }) => {
      if (error instanceof ApiError && error.code === 'validation' && error.fields) {
        showErrors(errorsByRow(error.fields, keys));
      }
    },
  });

  const applySoldOut = ({ id, soldOut }: SoldOutChange) => {
    queryClient.setQueryData(
      permanentItemsQuery.queryKey,
      (current) => current && menuWithSoldOut(current, id, soldOut),
    );
    setEdited((current) => current && setSoldOut(current, id, soldOut));
  };

  // Optimistic: the switch moves at once and moves back if the API refuses.
  const markSoldOut = useMutation({
    mutationKey: soldOutKey,
    mutationFn: async ({ id, soldOut }: SoldOutChange) =>
      unwrap(
        await api.api.admin.menu.items[':id']['sold-out'].$post({
          param: { id },
          json: { soldOut },
        }),
      ),
    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey: permanentItemsQuery.queryKey });
      applySoldOut(change);
    },
    onError: (_error, change) => applySoldOut({ id: change.id, soldOut: !change.soldOut }),
    onSuccess: ({ item }) => applySoldOut(item),
  });

  const soldOutPending = new Set(
    useMutationState({
      filters: { mutationKey: soldOutKey, status: 'pending' },
      select: (mutation) => (mutation.state.variables as SoldOutChange).id,
    }),
  );

  if (menu.isPending) {
    return (
      <>
        <PageHeader
          title={strings.pages.items.title}
          description={strings.pages.items.description}
        />
        <LoadingState rows={8} />
      </>
    );
  }

  if (!state) {
    return (
      <>
        <PageHeader
          title={strings.pages.items.title}
          description={strings.pages.items.description}
        />
        <EmptyState
          icon={TriangleAlertIcon}
          title={strings.items.loadFailed}
          action={
            <Button variant="outline" onClick={() => void menu.refetch()}>
              {strings.items.retry}
            </Button>
          }
        />
      </>
    );
  }

  const edit = (change: (current: EditorState) => EditorState) =>
    setEdited((current) => change(current ?? state));

  const onSave = () => {
    if (!menu.data) {
      return;
    }
    const check = checkSave(state, menu.data);
    if (!check.ok) {
      showErrors(check.errors);
      return;
    }
    setErrors({});
    save.mutate({ draft: check.draft, keys: check.keys });
  };

  const handlers = (section: PermanentSection) => ({
    onEdit: (key: string, patch: Parameters<typeof updateRow>[3]) => {
      edit((current) => updateRow(current, section, key, patch));
      setErrors((current) =>
        Object.keys(patch).reduce((next, field) => withoutError(next, key, field), current),
      );
    },
    onAdd: () => {
      const key = crypto.randomUUID();
      edit((current) => addRow(current, section, newRow(section, key)));
      setFocusId(`${key}-name`);
    },
    onRemove: (key: string) => {
      edit((current) => removeNewRow(current, section, key));
      setErrors(({ [key]: _, ...rest }) => rest);
    },
    onMove: (key: string, direction: -1 | 1) =>
      edit((current) => moveRow(current, section, key, direction)),
    onActive: (key: string, active: boolean) =>
      edit((current) => setActive(current, section, key, active)),
    onSoldOut: (id: string, soldOut: boolean) => markSoldOut.mutate({ id, soldOut }),
  });

  return (
    <>
      <PageHeader title={strings.pages.items.title} description={strings.pages.items.description} />
      <div ref={editorRef} className="flex flex-col gap-8">
        <fieldset disabled={save.isPending} className="flex min-w-0 flex-col gap-8">
          {sections.map((section) => (
            <ItemsSection
              key={section}
              section={section}
              rows={state[section]}
              errors={errors}
              soldOutPending={soldOutPending}
              {...handlers(section)}
            />
          ))}
        </fieldset>
        <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-wrap items-center gap-3 border-t bg-background px-4 py-3 lg:-mx-6 lg:-mb-6 lg:px-6">
          <p
            role="status"
            className={cn(
              'text-sm',
              invalidFields > 0 ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {invalidFields > 0
              ? strings.items.invalidFields(invalidFields)
              : dirty
                ? strings.items.unsaved
                : strings.items.upToDate}
          </p>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              disabled={!dirty || save.isPending}
              onClick={() => setConfirmDiscard(true)}
            >
              {strings.items.discard}
            </Button>
            <Button disabled={!dirty || save.isPending} onClick={onSave}>
              {save.isPending ? strings.items.saving : strings.items.save}
            </Button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={strings.items.discardConfirm.title}
        description={strings.items.discardConfirm.description}
        confirmLabel={strings.items.discardConfirm.confirm}
        destructive
        onConfirm={() => {
          setEdited(null);
          setErrors({});
        }}
      />
    </>
  );
}
