import type { PermanentSection } from '@piccolo/core';

/*
 * What the permanent menu page knows about images. Not part of `EditorState`: an image has its own
 * immediate routes, so its only copy is the server's, the `permanentItemsQuery` data. The rows,
 * `isDirty` and the save never see it, so an image change is never unsaved and a save can never
 * undo it.
 */

type WithImage = { id: string; imageVersion?: string | undefined };

/** Item id → image version, for the stored items that have an image. */
export function imageVersions(
  menu: Readonly<Record<PermanentSection, readonly WithImage[]>> | undefined,
): ReadonlyMap<string, string> {
  return new Map(
    Object.values(menu ?? {})
      .flat()
      .flatMap((item) => (item.imageVersion === undefined ? [] : [[item.id, item.imageVersion]])),
  );
}

/** The cached menu with item `id`'s image set to `imageVersion` (`undefined`: none). */
export function menuWithImage<T extends WithImage>(
  menu: Readonly<Record<PermanentSection, readonly T[]>>,
  id: string,
  imageVersion: string | undefined,
): Record<PermanentSection, T[]> {
  const section = (name: PermanentSection) =>
    menu[name].map((item) => {
      if (item.id !== id) {
        return item;
      }
      const { imageVersion: _, ...rest } = item;
      return (imageVersion === undefined ? rest : { ...rest, imageVersion }) as T;
    });
  return {
    allWeek: section('allWeek'),
    desserts: section('desserts'),
    pickles: section('pickles'),
    sides: section('sides'),
    sideExtras: section('sideExtras'),
  };
}
