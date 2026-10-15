// @vitest-environment jsdom
import type { MenuItem } from '@piccolo/core';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpenMenu } from '../lib/api';
import { strings } from '../strings';
import { openMenu, publicConfig } from '../test/fixtures';
import { OrderingApp } from './OrderingApp';

/** `openMenu` with an image version on the named dishes, weekly ones included. */
function withImages(versions: Record<string, string>): OpenMenu {
  const tag = (item: MenuItem): MenuItem =>
    versions[item.id] ? { ...item, imageVersion: versions[item.id] } : item;
  const { menu } = openMenu;
  return {
    ...openMenu,
    menu: {
      ...menu,
      days: Object.fromEntries(
        Object.entries(menu.days).map(([day, entry]) => [
          day,
          { ...entry, soups: entry.soups.map(tag), mains: entry.mains.map(tag) },
        ]),
      ) as OpenMenu['menu']['days'],
      featured: menu.featured.map(tag),
      permanent: {
        allWeek: menu.permanent.allWeek.map(tag),
        sides: menu.permanent.sides.map(tag),
        sideExtras: menu.permanent.sideExtras.map(tag),
        pickles: menu.permanent.pickles.map(tag),
        desserts: menu.permanent.desserts.map(tag),
      },
    },
  };
}

const thumb = (id: string, version: string) =>
  `https://img-dev.piccoloetterem.hu/${id}/${version}/thumb`;

let answer: unknown;

beforeEach(() => {
  answer = openMenu;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('/api/menu')
        ? Response.json(answer)
        : Response.json({ error: 'not_found' }, { status: 404 }),
    ),
  );
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

async function renderOrderPage(menu: OpenMenu) {
  answer = menu;
  render(<OrderingApp initial={{ config: publicConfig }} now={() => new Date(2026, 8, 9, 8, 0)} />);
  await screen.findByRole('region', { name: /menü összeállítása$/ });
  await settle();
}

const composer = () => screen.getByRole('region', { name: /menü összeállítása$/ });
const block = (name: RegExp) => within(composer()).getByRole('group', { name });
const row = (scope: HTMLElement, name: string) =>
  (within(scope).getByRole('radio', { name }) as HTMLElement).closest('.pickrow') as HTMLElement;
const tileOf = (element: HTMLElement) => element.querySelector('.tile');
const imgSrc = (element: HTMLElement) => element.querySelector('.tile img')?.getAttribute('src');

function openPicker() {
  fireEvent.click(within(composer()).getByRole('radio', { name: 'Brokkolikrémleves' }));
  fireEvent.click(within(composer()).getByRole('button', { name: /^Főétel: Válassz$/ }));
  return screen.getByRole('dialog', { name: strings.composer.pickerTitle('Főétel') });
}

const pickerRow = (dialog: HTMLElement, name: string) =>
  within(dialog).getByRole('button', { name }).closest('.pickrow') as HTMLElement;

describe('étlap thumbnails', () => {
  it("shows a dessert's photo, and gives the course's other rows their initial and none an empty tile", async () => {
    await renderOrderPage(withImages({ somloi: 'v1' }));
    const desserts = block(/^Desszert/);

    expect(imgSrc(row(desserts, 'Somlói galuska'))).toBe(thumb('somloi', 'v1'));
    const img = row(desserts, 'Somlói galuska').querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(tileOf(row(desserts, 'Somlói galuska'))?.getAttribute('aria-hidden')).toBe('true');
    expect(tileOf(row(desserts, 'Túrógombóc'))?.textContent).toBe('T');
    const none = row(desserts, strings.composer.none);
    expect(tileOf(none)?.classList.contains('tile-none')).toBe(true);
    expect(tileOf(none)?.textContent).toBe('');

    expect(block(/^Savanyúság/).querySelector('.tile')).toBeNull();
  });

  it('keeps every course without a photo as it is today: no tiles at all', async () => {
    await renderOrderPage(openMenu);
    expect(composer().querySelectorAll('.choicerows .tile')).toHaveLength(0);
  });

  it('falls back to the initial when the photo fails, and tries a new version again', async () => {
    await renderOrderPage(withImages({ somloi: 'v1' }));
    const somloi = () => row(block(/^Desszert/), 'Somlói galuska');

    fireEvent.error(somloi().querySelector('img') as HTMLImageElement);
    expect(somloi().querySelector('img')).toBeNull();
    expect(tileOf(somloi())?.textContent).toBe('S');

    answer = withImages({ somloi: 'v2' });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    fireEvent(document, new Event('visibilitychange'));
    await settle();
    expect(imgSrc(somloi())).toBe(thumb('somloi', 'v2'));
  });

  it('tiles every all-week row in the picker once one has a photo, and the chosen one keeps it', async () => {
    await renderOrderPage(withImages({ trapista: 'v1' }));
    const dialog = openPicker();

    expect(imgSrc(pickerRow(dialog, 'Rántott trapista sajt'))).toBe(thumb('trapista', 'v1'));
    expect(tileOf(pickerRow(dialog, 'Görög saláta'))?.textContent).toBe('G');
    expect(tileOf(pickerRow(dialog, 'Paprikás csirke'))).toBeNull();
    expect(tileOf(pickerRow(dialog, 'Cordon bleu'))).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Rántott trapista sajt' }));
    const mainRow = composer().querySelector('.mainrow') as HTMLElement;
    expect(imgSrc(mainRow)).toBe(thumb('trapista', 'v1'));
  });

  it('never shows a photo for a weekly dish, even when the menu carries a version for it', async () => {
    await renderOrderPage(
      withImages({ 'sze-brokkoli': 'v1', 'sze-paprikas-csirke': 'v1', 'cordon-bleu': 'v1' }),
    );
    expect(block(/^Leves/).querySelector('.tile')).toBeNull();

    const dialog = openPicker();
    expect(dialog.querySelector('.tile')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Paprikás csirke' }));
    expect(composer().querySelector('.mainrow img')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });
});
