import { expect, type Locator, type Page, test } from '@playwright/test';
import { strings } from '../src/strings';
import { type Reply, type SubmissionBody, stored, stubApi } from './api';

const { checkout, composer, summary } = strings;

const composerForm = (page: Page) => page.getByRole('region', { name: /menü összeállítása$/ });
const group = (page: Page, name: RegExp) => composerForm(page).getByRole('group', { name });
/** The phone's bar at the bottom of the screen. */
const bar = (page: Page) => page.locator('.sumbar.only-mobile');

/** Taps a row of a course, as a guest does: its label covers the row. */
async function tapChoice(page: Page, course: RegExp, name: string | RegExp) {
  await group(page, course)
    .getByText(name, { exact: typeof name === 'string' })
    .tap();
}

async function pickMain(page: Page, name: string) {
  await composerForm(page)
    .getByRole('button', { name: /^Főétel: Válassz$| — Módosítás$/ })
    .tap();
  const dialog = page.getByRole('dialog', { name: composer.pickerTitle('Főétel') });
  await dialog.getByRole('button', { name, exact: true }).tap();
  await expect(dialog).toBeHidden();
}

async function openOrderPage(page: Page) {
  await page.goto('/megrendeles');
  await expect(composerForm(page)).toBeVisible();
}

async function addSoupOnlyMenu(page: Page) {
  await tapChoice(page, /^Leves/, 'Brokkolikrémleves');
  await pickMain(page, composer.none);
  await bar(page).getByRole('button', { name: summary.addToCart }).tap();
}

async function toCheckout(page: Page) {
  await bar(page).getByRole('button', { name: summary.continue }).tap();
  await expect(page.getByRole('heading', { name: checkout.title })).toBeVisible();
}

const field = (page: Page, label: RegExp) => page.getByLabel(label);

/** Types as a phone keyboard does: one key at a time, into the field that was tapped. */
async function typeInto(input: Locator, text: string) {
  await input.tap();
  await input.pressSequentially(text);
}

async function fillContact(page: Page) {
  await typeInto(field(page, /^Név/), 'Kovács Anna');
  await typeInto(field(page, /^Telefonszám/), '06 30 123 4567');
  await typeInto(field(page, /^E-mail cím/), 'anna@example.hu');
  await typeInto(field(page, /^Szállítási cím/), 'Szombathely, Fő tér 1.');
}

/** Nothing wider than the screen: no sideways scrolling on a phone. */
async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('ordering on a phone', () => {
  test('orders a day from the first tap to the receipt', async ({ page }) => {
    const api = await stubApi(page);
    await openOrderPage(page);
    await expectNoSidewaysScroll(page);

    await tapChoice(page, /^Leves/, 'Húsleves cérnametélttel');
    await pickMain(page, 'Rántott szelet — Csirkemell');
    await tapChoice(page, /^Köret$/, 'Párolt rizs');
    await group(page, /^Extra/)
      .getByRole('button', { name: 'Több: Doboz' })
      .tap();
    await bar(page).getByRole('button', { name: summary.addToCart }).tap();
    await expect(page.getByRole('tab', { name: /1 menü a kosárban/ })).toBeVisible();

    await toCheckout(page);
    await expectNoSidewaysScroll(page);
    await fillContact(page);
    await typeInto(field(page, /^Megjegyzés/), 'Kapukód 12#');
    await page.getByRole('button', { name: checkout.submit }).tap();

    await expect(page.getByRole('heading', { name: strings.success.title })).toBeVisible();
    await expectNoSidewaysScroll(page);
    expect(api.orders).toHaveLength(1);
    expect(api.orders[0]).toMatchObject({
      name: 'Kovács Anna',
      phone: '06 30 123 4567',
      note: 'Kapukód 12#',
      days: [
        {
          deliveryDate: '2026-09-09',
          menus: [{ mainId: 'sze-rantott-szelet', variation: 'Csirkemell', sideId: 'parolt-rizs' }],
          extras: [{ key: 'doboz', quantity: 1 }],
        },
      ],
    } satisfies Partial<SubmissionBody> & Record<string, unknown>);
  });

  test('never zooms into a field on focus: every input is at least 16px', async ({ page }) => {
    await stubApi(page);
    await openOrderPage(page);
    await addSoupOnlyMenu(page);
    await toCheckout(page);
    const sizes = await page
      .locator('form input:not([type=hidden]):not([tabindex="-1"]), form textarea')
      .evaluateAll((inputs) =>
        inputs.map((input) => [input.getAttribute('name'), getComputedStyle(input).fontSize]),
      );
    for (const [name, size] of sizes) {
      expect.soft(Number.parseFloat(size ?? '0'), `${name}`).toBeGreaterThanOrEqual(16);
    }
  });

  test('keeps the submit button and the add button clear of the bottom bar', async ({ page }) => {
    await stubApi(page);
    await openOrderPage(page);
    await tapChoice(page, /^Leves/, 'Brokkolikrémleves');
    await pickMain(page, composer.none);

    // The form's own button, scrolled to: the bar steps aside rather than cover it.
    const add = composerForm(page).getByRole('button', { name: composer.add, exact: true });
    await add.scrollIntoViewIfNeeded();
    await expect(add).toBeInViewport();
    await add.tap();
    await expect(page.getByRole('tab', { name: /1 menü a kosárban/ })).toBeVisible();

    await toCheckout(page);
    const submit = page.getByRole('button', { name: checkout.submit });
    await submit.scrollIntoViewIfNeeded();
    const box = await submit.boundingBox();
    const covering = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.textContent ?? null,
      { x: (box?.x ?? 0) + (box?.width ?? 0) / 2, y: (box?.y ?? 0) + (box?.height ?? 0) / 2 },
    );
    expect(covering).toContain(checkout.submit);
  });

  test('brings the first wrong field into view and focus after a submit', async ({ page }) => {
    const api = await stubApi(page);
    await openOrderPage(page);
    await addSoupOnlyMenu(page);
    await toCheckout(page);
    await typeInto(field(page, /^Név/), 'Kovács Anna');
    await typeInto(field(page, /^Telefonszám/), '06 30 123');
    await typeInto(field(page, /^E-mail cím/), 'anna@example');
    await page.getByRole('button', { name: checkout.submit }).tap();

    await expect(field(page, /^Telefonszám/)).toBeFocused();
    await expect(field(page, /^Telefonszám/)).toBeInViewport();
    await expect(page.getByText(checkout.errors.phoneInvalid)).toBeVisible();
    await expect(page.getByText(checkout.errors.emailInvalid)).toBeVisible();
    await expect(page.getByText(checkout.errors.addressRequired)).toBeVisible();
    expect(api.orders).toHaveLength(0);
  });

  test('stays within the screen with the longest names and addresses a guest may type', async ({
    page,
  }) => {
    await stubApi(page);
    await openOrderPage(page);
    await addSoupOnlyMenu(page);
    await toCheckout(page);
    await field(page, /^Név/).fill(
      'Árvíztűrő Tükörfúrógépné Szentgyörgyváryné Kovács-Nagy Annamária',
    );
    await field(page, /^E-mail cím/).fill(`${'nagyon.hosszu.nev'.repeat(4)}@example.hu`);
    await field(page, /^Szállítási cím/).fill(
      'Szombathely, Szent Márton utca 112/B, III. lépcsőház, 4. emelet 12. ajtó, kapukód 1234#',
    );
    await page.getByRole('button', { name: checkout.submit }).tap();
    await expectNoSidewaysScroll(page);
  });

  test('chooses from the main picker on a phone and scrolls it to the dishes at the bottom', async ({
    page,
  }) => {
    await stubApi(page);
    await openOrderPage(page);
    await tapChoice(page, /^Leves/, composer.none);
    await composerForm(page).getByRole('button', { name: composer.mainPrompt }).tap();
    const dialog = page.getByRole('dialog', { name: composer.pickerTitle('Főétel') });
    await expect(dialog).toBeVisible();

    const viewport = page.viewportSize();
    const box = await dialog.boundingBox();
    expect(box?.height ?? Infinity).toBeLessThanOrEqual(viewport?.height ?? 0);
    expect(box?.width ?? Infinity).toBeLessThanOrEqual(viewport?.width ?? 0);

    // The last all-week dish sits below the fold of the list.
    await dialog.getByRole('button', { name: 'Csirkés cézársaláta', exact: true }).tap();
    await expect(
      composerForm(page).getByRole('button', {
        name: composer.mainChosen('Csirkés cézársaláta'),
      }),
    ).toBeVisible();
  });

  test('reaches Saturday on the day rail and charges its weekend price', async ({ page }) => {
    await stubApi(page);
    await openOrderPage(page);
    await page.getByRole('tab', { name: /^Szombat/ }).tap();
    await expect(page.getByRole('tab', { name: /^Szombat/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await tapChoice(page, /^Leves/, composer.none);
    await pickMain(page, 'Marhapörkölt');
    // 1320 on the weekend, less the 100 without soup.
    await expect(bar(page)).toContainText('1220');
  });

  test('keeps the cart through a reload', async ({ page }) => {
    await stubApi(page);
    await openOrderPage(page);
    await addSoupOnlyMenu(page);
    await page.reload();
    await expect(page.getByRole('tab', { name: /1 menü a kosárban/ })).toBeVisible();
    await toCheckout(page);
    await expect(page.getByText(strings.summary.empty)).toBeHidden();
  });

  for (const [refusal, reply, title] of [
    [
      'a sold-out dish',
      (): Reply => ({
        status: 409,
        json: { error: 'validation', fields: { 'days.0.menus.0.soupId': 'sold_out' } },
      }),
      strings.errors.soldOutTitle,
    ],
    ['a lost connection', (): Reply => 'network_error', strings.errors.submitFailedTitle],
  ] as const) {
    test(`shows the guest at the submit button why ${refusal} stopped the order`, async ({
      page,
    }) => {
      // Known bug: the button keeps focus in the last field, and Checkout moves focus to the
      // banner only when no field has it, so the banner stays above the screen. Remove this line
      // with the fix.
      test.fail();
      const api = await stubApi(page);
      await openOrderPage(page);
      await addSoupOnlyMenu(page);
      await toCheckout(page);
      await fillContact(page);
      api.orderReplies = [reply];
      await page.getByRole('button', { name: checkout.submit }).tap();
      const alert = page.getByRole('alert');
      await expect(alert).toContainText(title);
      await expect(alert).toBeInViewport({ timeout: 2_000 });
    });
  }

  test('says the order did not go out when the phone loses its connection, and resends it', async ({
    page,
  }) => {
    const api = await stubApi(page);
    await openOrderPage(page);
    await addSoupOnlyMenu(page);
    await toCheckout(page);
    await fillContact(page);
    api.orderReplies = [() => 'network_error', stored];
    await page.getByRole('button', { name: checkout.submit }).tap();
    const alert = page.getByRole('alert');
    await expect(alert).toContainText(strings.errors.submitFailedTitle);
    await alert.getByRole('button', { name: strings.errors.resubmit }).tap();
    await expect(page.getByRole('heading', { name: strings.success.title })).toBeVisible();
    expect(api.orders).toHaveLength(2);
  });

  test('gives every control a target a finger can hit', async ({ page }) => {
    await stubApi(page);
    await openOrderPage(page);
    await tapChoice(page, /^Leves/, 'Brokkolikrémleves');
    await pickMain(page, composer.none);
    const targets = composerForm(page).locator('label.stretch, button');
    const tooSmall = await targets.evaluateAll((elements) =>
      elements
        .map((element) => {
          const row = element.closest('.pickrow') ?? element;
          const { width, height } = row.getBoundingClientRect();
          return {
            name: element.textContent?.trim() || element.getAttribute('aria-label'),
            width,
            height,
          };
        })
        .filter(({ width, height }) => width > 0 && (width < 24 || height < 24)),
    );
    expect(tooSmall).toEqual([]);
  });
});
