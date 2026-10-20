/**
 * `pnpm email:preview` — renders the confirmation e-mail of the fixture submission (two days, three
 * menus, both soup adjustments, extras; src/email/fixture.ts) to `.preview/order-confirmation.html`
 * and its plain-text part to `.preview/order-confirmation.txt`. Open the HTML in a browser.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '@piccolo/core';
import { fixtureSubmission } from '../src/email/fixture';
import { renderOrderConfirmation } from '../src/email/templates/OrderConfirmation';
import { confirmationEmail } from '../src/email/view';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../.preview');

const email = confirmationEmail(fixtureSubmission, loadConfig({ RESTAURANT: 'piccolo' }));
const { html, text } = await renderOrderConfirmation(email.view);

mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'order-confirmation.html'), html);
writeFileSync(
  resolve(out, 'order-confirmation.txt'),
  `To: ${email.to}\nSubject: ${email.subject}\n\n${text}\n`,
);
console.log(
  `${email.subject}\n→ ${resolve(out, 'order-confirmation.html')} (${html.length} characters)`,
);
