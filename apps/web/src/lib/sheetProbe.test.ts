import { describe, expect, it } from 'vitest';
import { listHidden, type SheetMeasure, visibleList } from './sheetProbe';

/** A 402 × 874 phone upright, the sheet rising to 40 px under the top, as it should. */
const upright: SheetMeasure = {
  modal: true,
  innerWidth: 402,
  innerHeight: 874,
  visualTop: 0,
  visualHeight: 874,
  orientation: 'portrait-primary',
  sheetTop: 40,
  sheetHeight: 834,
  headHeight: 88,
  listTop: 128,
  listHeight: 746,
  listScrollHeight: 2177,
};

describe('visibleList', () => {
  it('is the part of the list inside the visual viewport', () => {
    expect(visibleList(upright)).toBe(746);
    expect(visibleList({ ...upright, visualHeight: 600 })).toBe(472);
  });

  it('is never negative', () => {
    expect(visibleList({ ...upright, listTop: 900 })).toBe(0);
  });
});

describe('listHidden', () => {
  it('is false for a sheet that shows its list', () => {
    expect(listHidden(upright)).toBe(false);
  });

  it('is true when the list collapsed under the head', () => {
    expect(
      listHidden({ ...upright, sheetTop: 786, sheetHeight: 88, listTop: 874, listHeight: 0 }),
    ).toBe(true);
  });

  it('is true when a toolbar covers all but a sliver of the list', () => {
    expect(listHidden({ ...upright, visualHeight: 150 })).toBe(true);
  });

  it('is false while the list has nothing in it to show', () => {
    expect(listHidden({ ...upright, listHeight: 0, listScrollHeight: 0 })).toBe(false);
  });
});
