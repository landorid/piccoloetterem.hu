import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * jsdom has no layout. `matchMedia` answers `min-width` / `max-width` queries from
 * `window.innerWidth`, so a test sets the viewport by assigning it before it renders.
 */
function matchesWidth(query: string): boolean {
  const width = window.innerWidth;
  const min = /min-width:\s*(\d+)px/.exec(query)?.[1];
  const max = /max-width:\s*(\d+)px/.exec(query)?.[1];
  return (min === undefined || width >= Number(min)) && (max === undefined || width <= Number(max));
}

window.matchMedia = (query: string) =>
  ({
    media: query,
    get matches() {
      return matchesWidth(query);
    },
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

// Radix measures popovers and tooltips with it.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

afterEach(() => cleanup());
