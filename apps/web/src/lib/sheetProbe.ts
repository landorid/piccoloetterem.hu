import { captureMessage } from '@sentry/react';

/**
 * Field reports say the main-course sheet opens on some phones with its list out of sight: the
 * head shows, no dish does, and the modal holds the page still. Nothing throws, so the error
 * handlers never see it. This measures the open sheet and, if the guest can see less than one row
 * of the list, sends the numbers to Sentry once per page load.
 */

/** Less than this much of the list on screen is less than one row (`--tap` is 48 px). */
export const minVisibleList = 48;

export interface SheetMeasure {
  /** Whether the sheet was opened with `showModal()`. */
  modal: boolean;
  innerWidth: number;
  innerHeight: number;
  /** The visual viewport, which on-screen toolbars and the keyboard shrink. */
  visualTop: number;
  visualHeight: number;
  orientation: string | null;
  sheetTop: number;
  sheetHeight: number;
  headHeight: number;
  listTop: number;
  listHeight: number;
  listScrollHeight: number;
}

/** How many pixels of the list lie inside the visual viewport. */
export function visibleList(m: SheetMeasure): number {
  const top = Math.max(m.listTop, m.visualTop);
  const bottom = Math.min(m.listTop + m.listHeight, m.visualTop + m.visualHeight);
  return Math.max(0, bottom - top);
}

/** A list with content of which the guest sees less than one row. */
export function listHidden(m: SheetMeasure): boolean {
  return m.listScrollHeight > 0 && visibleList(m) < minVisibleList;
}

export function measureSheet(dialog: HTMLElement, modal: boolean): SheetMeasure | null {
  const head = dialog.querySelector('.sheet-head');
  const list = dialog.querySelector('.sheet-body');
  if (!head || !list) return null;
  const sheet = dialog.getBoundingClientRect();
  const listRect = list.getBoundingClientRect();
  const visual = window.visualViewport;
  return {
    modal,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    visualTop: visual?.offsetTop ?? 0,
    visualHeight: visual?.height ?? window.innerHeight,
    orientation: screen.orientation?.type ?? null,
    sheetTop: Math.round(sheet.top),
    sheetHeight: Math.round(sheet.height),
    headHeight: Math.round(head.getBoundingClientRect().height),
    listTop: Math.round(listRect.top),
    listHeight: Math.round(listRect.height),
    listScrollHeight: list.scrollHeight,
  };
}

let reported = false;

/** Measures the open sheet and reports it once per page load when its list is out of sight. */
export function probeSheet(dialog: HTMLElement, modal: boolean): void {
  if (reported || !dialog.isConnected) return;
  const m = measureSheet(dialog, modal);
  if (!m || !listHidden(m)) return;
  reported = true;
  captureMessage('Main-course sheet list not visible', {
    level: 'warning',
    tags: { probe: 'main-picker', modal: String(modal), orientation: m.orientation ?? 'unknown' },
    extra: { ...m, visibleList: visibleList(m) },
  });
}
