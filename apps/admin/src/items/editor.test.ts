import type { MenuItem, PermanentMenu } from '@piccolo/core';
import { describe, expect, it } from 'vitest';
import {
  addRow,
  checkSave,
  draftFromEditor,
  type EditorState,
  editorFromMenu,
  errorCount,
  errorsByRow,
  isDirty,
  menuWithSoldOut,
  moveRow,
  newRow,
  parsePrice,
  removeNewRow,
  rowKeys,
  setActive,
  setSoldOut,
  updateRow,
  withoutError,
} from './editor';

const item = (
  fields: Pick<MenuItem, 'id' | 'category' | 'name'> & Partial<MenuItem>,
): MenuItem => ({
  description: null,
  priceWeekday: 1000,
  priceWeekend: null,
  variations: [],
  allergens: [],
  soupIncluded: false,
  requiresSide: false,
  soldOut: false,
  active: true,
  sortOrder: 0,
  ...fields,
});

const menu: PermanentMenu = {
  allWeek: [
    item({ id: 'a1', category: 'all_week', name: 'Rántott csirkemell', requiresSide: true }),
    // Inactive items can sit anywhere in sortOrder; the editor lists them last.
    item({ id: 'a2', category: 'all_week', name: 'Régi pörkölt', active: false, sortOrder: 1 }),
    item({
      id: 'a3',
      category: 'all_week',
      name: 'Cordon bleu',
      priceWeekend: 2850,
      variations: ['sertés', 'csirke'],
      sortOrder: 2,
    }),
  ],
  desserts: [
    item({
      id: 'd1',
      category: 'dessert',
      name: 'Túrós palacsinta',
      description: 'Két darab.',
      allergens: ['gluten', 'eggs', 'milk'],
    }),
  ],
  pickles: [],
  sides: [item({ id: 's1', category: 'side', name: 'Hasábburgonya', priceWeekday: 0 })],
  sideExtras: [],
};

const names = (state: EditorState, section: keyof EditorState) =>
  state[section].map((row) => row.name);

describe('editorFromMenu', () => {
  it('lists active items first, then inactive ones, each in sortOrder', () => {
    const state = editorFromMenu(menu);
    expect(names(state, 'allWeek')).toEqual(['Rántott csirkemell', 'Cordon bleu', 'Régi pörkölt']);
  });

  it('holds prices as text, an empty weekend price and description as ""', () => {
    const [row] = editorFromMenu(menu).allWeek;
    expect(row).toMatchObject({
      key: 'a1',
      id: 'a1',
      description: '',
      priceWeekday: '1000',
      priceWeekend: '',
    });
  });
});

describe('draftFromEditor', () => {
  it('round-trips the stored menu, in the editor order', () => {
    const draft = draftFromEditor(editorFromMenu(menu));
    expect(draft.allWeek.map((entry) => entry.id)).toEqual(['a1', 'a3', 'a2']);
    expect(draft.allWeek[1]).toEqual({
      id: 'a3',
      name: 'Cordon bleu',
      description: null,
      priceWeekday: 1000,
      priceWeekend: 2850,
      variations: ['sertés', 'csirke'],
      allergens: [],
      soupIncluded: false,
      requiresSide: false,
      active: true,
    });
    expect(draft.desserts[0]?.description).toBe('Két darab.');
  });

  it('trims text, sends an empty weekend price as null and a new row without id', () => {
    const state = addRow(editorFromMenu(menu), 'pickles', {
      ...newRow('pickles', 'k1'),
      name: '  Vegyes savanyúság ',
      description: '   ',
      priceWeekday: '1 200',
    });
    expect(draftFromEditor(state).pickles).toEqual([
      {
        name: 'Vegyes savanyúság',
        description: null,
        priceWeekday: 1200,
        priceWeekend: null,
        variations: [],
        allergens: [],
        soupIncluded: false,
        requiresSide: false,
        active: true,
      },
    ]);
  });
});

describe('parsePrice', () => {
  it.each([
    ['2350', 2350],
    [' 2 350 ', 2350],
    ['0', 0],
    ['-5', -5],
  ])('reads %j as %d', (text, price) => {
    expect(parsePrice(text)).toBe(price);
  });

  it.each(['', 'abc', '12.5', '1,5', '12 Ft'])('reads %j as NaN', (text) => {
    expect(parsePrice(text)).toBeNaN();
  });
});

describe('checkSave', () => {
  it('passes the stored menu unchanged', () => {
    const check = checkSave(editorFromMenu(menu), menu);
    expect(check.ok).toBe(true);
  });

  it("reports core's codes on the rows they belong to", () => {
    let state = editorFromMenu(menu);
    state = addRow(state, 'desserts', newRow('desserts', 'k1'));
    state = updateRow(state, 'allWeek', 'a3', { priceWeekday: 'sok', priceWeekend: '-1' });
    const check = checkSave(state, menu);
    expect(check).toEqual({
      ok: false,
      errors: {
        a3: { priceWeekday: 'not_integer', priceWeekend: 'negative' },
        k1: { name: 'required', priceWeekday: 'not_integer' },
      },
    });
  });

  it('starts a new side at price 0, so it passes with only a name', () => {
    const state = addRow(editorFromMenu(menu), 'sides', {
      ...newRow('sides', 'k1'),
      name: 'Párolt rizs',
    });
    expect(checkSave(state, menu).ok).toBe(true);
  });
});

describe('errorsByRow', () => {
  it('follows the payload order and drops paths that name no row', () => {
    const state = editorFromMenu(menu);
    expect(
      errorsByRow(
        {
          'allWeek.2.name': 'required',
          'allWeek.2.id': 'unknown_item',
          'sides.0.priceWeekday': 'must_be_zero',
          'sides.5.name': 'required',
          'drinks.0.name': 'required',
          garbage: 'invalid',
        },
        rowKeys(state),
      ),
    ).toEqual({
      a2: { name: 'required', id: 'unknown_item' },
      s1: { priceWeekday: 'must_be_zero' },
    });
  });

  it('counts and clears errors field by field', () => {
    const errors = { a1: { name: 'required', priceWeekday: 'negative' }, d1: { name: 'required' } };
    expect(errorCount(errors)).toBe(3);
    const fewer = withoutError(errors, 'd1', 'name');
    expect(fewer).toEqual({ a1: { name: 'required', priceWeekday: 'negative' } });
    expect(withoutError(fewer, 'a1', 'description')).toBe(fewer);
  });
});

describe('edits', () => {
  it('adds a row at the end of the active items', () => {
    const state = addRow(editorFromMenu(menu), 'allWeek', {
      ...newRow('allWeek', 'k1'),
      name: 'Új',
    });
    expect(names(state, 'allWeek')).toEqual([
      'Rántott csirkemell',
      'Cordon bleu',
      'Új',
      'Régi pörkölt',
    ]);
  });

  it('moves active rows within the active items only', () => {
    const state = editorFromMenu(menu);
    expect(names(moveRow(state, 'allWeek', 'a3', -1), 'allWeek')).toEqual([
      'Cordon bleu',
      'Rántott csirkemell',
      'Régi pörkölt',
    ]);
    expect(moveRow(state, 'allWeek', 'a3', 1)).toBe(state);
    expect(moveRow(state, 'allWeek', 'a1', -1)).toBe(state);
    expect(moveRow(state, 'allWeek', 'a2', -1)).toBe(state);
  });

  it('deactivates to the top of the inactive rows and reactivates to the end of the active ones', () => {
    const deactivated = setActive(editorFromMenu(menu), 'allWeek', 'a1', false);
    expect(names(deactivated, 'allWeek')).toEqual([
      'Cordon bleu',
      'Rántott csirkemell',
      'Régi pörkölt',
    ]);
    expect(deactivated.allWeek.map((row) => row.active)).toEqual([true, false, false]);

    const reactivated = setActive(deactivated, 'allWeek', 'a2', true);
    expect(names(reactivated, 'allWeek')).toEqual([
      'Cordon bleu',
      'Régi pörkölt',
      'Rántott csirkemell',
    ]);
    expect(draftFromEditor(reactivated).allWeek.map((entry) => entry.active)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('removes only rows that were never saved', () => {
    const state = addRow(editorFromMenu(menu), 'sides', newRow('sides', 'k1'));
    expect(removeNewRow(state, 'sides', 's1').sides).toHaveLength(2);
    expect(removeNewRow(state, 'sides', 'k1').sides.map((row) => row.key)).toEqual(['s1']);
  });

  it('sets sold-out on the editor and on the API shape alike', () => {
    expect(setSoldOut(editorFromMenu(menu), 'd1', true).desserts[0]?.soldOut).toBe(true);
    expect(menuWithSoldOut(menu, 'd1', true).desserts[0]?.soldOut).toBe(true);
    expect(menuWithSoldOut(menu, 'd1', true).allWeek).toEqual(menu.allWeek);
  });

  it('is dirty after an edit, not after an edit undone or a sold-out change', () => {
    const base = editorFromMenu(menu);
    const edited = updateRow(base, 'desserts', 'd1', { name: 'Palacsinta' });
    expect(isDirty(edited, base)).toBe(true);
    expect(isDirty(updateRow(edited, 'desserts', 'd1', { name: 'Túrós palacsinta' }), base)).toBe(
      false,
    );
    expect(isDirty(setSoldOut(base, 'd1', true), base)).toBe(false);
    expect(isDirty(moveRow(base, 'allWeek', 'a3', -1), base)).toBe(true);
  });
});
