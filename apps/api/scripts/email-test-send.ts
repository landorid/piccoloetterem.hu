/**
 * `pnpm email:test-send <address> [--dry-run]` — sends the fixture's confirmation e-mail
 * (src/email/fixture.ts) to `<address>` through Amazon SES, the way the Worker sends it, to prove
 * the SES identity, DKIM and credentials (P1, #39).
 *
 * Credentials come from the repo-root `.env` (`SES_REGION`, `SES_ACCESS_KEY_ID`,
 * `SES_SECRET_ACCESS_KEY`); variables already set in the shell win. It always sends for real,
 * whatever `EMAIL_DRY_RUN` says, because that is what it is for; `--dry-run` logs instead. The
 * sender is `config.email.from`. While SES is in the sandbox the recipient must be verified too.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '@piccolo/core';
import { fixtureSubmission } from '../src/email/fixture';
import { sendEmail } from '../src/email/ses';
import { renderOrderConfirmation } from '../src/email/templates/OrderConfirmation';
import { confirmationEmail } from '../src/email/view';

const rootEnv = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const [to] = args.filter((arg) => arg !== '--dry-run');
if (!to?.includes('@')) {
  console.error('Usage: pnpm email:test-send <address> [--dry-run]');
  process.exit(1);
}

const config = loadConfig({ RESTAURANT: process.env.RESTAURANT ?? 'piccolo' });
const { view, ...email } = confirmationEmail(fixtureSubmission, config);
const { html, text } = await renderOrderConfirmation(view);

try {
  const result = await sendEmail(
    {
      EMAIL_DRY_RUN: dryRun ? '1' : undefined,
      SES_REGION: process.env.SES_REGION,
      SES_ACCESS_KEY_ID: process.env.SES_ACCESS_KEY_ID,
      SES_SECRET_ACCESS_KEY: process.env.SES_SECRET_ACCESS_KEY,
    },
    { ...email, to, html, text },
  );
  if (!result.dryRun) {
    console.log(`Sent from ${config.email.from} to ${to}: SES MessageId ${result.messageId}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
