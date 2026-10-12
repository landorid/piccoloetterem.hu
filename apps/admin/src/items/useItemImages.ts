import { unwrap } from '@piccolo/api-client';
import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/api';
import { menuWithImage } from '@/items/image/model';
import { prepareItemImage } from '@/items/image/prepare';
import { permanentItemsQuery } from '@/queries';
import { strings } from '@/strings';

const imageKey = ['admin', 'menu', 'image'];

/**
 * Image operations run one at a time: a batch does not decode several phone photos at once, nor
 * purge the menu cache several times inside KV's one write per second.
 */
const scope = { id: 'item-images' };

type Change = { id: string };

/**
 * Upload (or replace) and remove an item's image: the permanent menu page's whole image surface.
 *
 * Not optimistic: the cell spins from the pick until the API has committed. The answer's item is
 * written into the `permanentItemsQuery` data, the page's only copy of an image, and the query is
 * then refetched, so the server stays the authority when two tabs race. An operation counts as
 * pending until that refetch is back; the page disables Save meanwhile, so a save's answer cannot
 * land on top of a newer image. Failures reach the global toast (`describeError`).
 */
export function useItemImages() {
  const queryClient = useQueryClient();

  const apply = ({ item }: { item: { id: string; imageVersion?: string | undefined } }) =>
    queryClient.setQueryData(
      permanentItemsQuery.queryKey,
      (menu) => menu && menuWithImage(menu, item.id, item.imageVersion),
    );
  const refetch = () => queryClient.invalidateQueries({ queryKey: permanentItemsQuery.queryKey });

  const upload = useMutation({
    mutationKey: imageKey,
    scope,
    mutationFn: async ({ id, file }: Change & { file: File }) => {
      const form = await prepareItemImage(file);
      return unwrap(await api.api.admin.menu.items[':id'].image.$put({ param: { id }, form }));
    },
    onSuccess: (answer) => {
      apply(answer);
      toast.success(strings.items.image.uploaded);
    },
    onSettled: refetch,
  });

  const remove = useMutation({
    mutationKey: imageKey,
    scope,
    mutationFn: async ({ id }: Change) =>
      unwrap(await api.api.admin.menu.items[':id'].image.$delete({ param: { id } })),
    onSuccess: (answer) => {
      apply(answer);
      toast.success(strings.items.image.removed);
    },
    onSettled: refetch,
  });

  const pending: ReadonlySet<string> = new Set(
    useMutationState({
      filters: { mutationKey: imageKey, status: 'pending' },
      select: (mutation) => (mutation.state.variables as Change).id,
    }),
  );

  return {
    upload: (id: string, file: File) => upload.mutate({ id, file }),
    /** The mutation's promise, so `ConfirmDialog` stays open until it settles. */
    remove: (id: string) => remove.mutateAsync({ id }),
    pending,
  };
}
