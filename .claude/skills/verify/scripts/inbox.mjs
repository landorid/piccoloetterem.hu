// Waits for an e-mail to <address> in the test inbox (apps/test-inbox, inbox.piccoloetterem.hu)
// and saves it as evidence: <name>.eml (raw), <name>.json (headers, auth verdicts, text) and
// <name>.html. Fails unless the message carries a passing DKIM signature of its From domain.
//
//   node .claude/skills/verify/scripts/inbox.mjs "$ORDER_EMAIL"
//   node .claude/skills/verify/scripts/inbox.mjs <address> [--timeout 120] [--name email] [--since <ISO>]
//
// --since ignores messages received before that moment (default: take the newest one).
// Exit: 0 found and DKIM-aligned, 1 nothing arrived in time, 2 usage or config, 3 DKIM not passing.
// Config: TEST_INBOX_URL and TEST_INBOX_TOKEN, else the .env of this checkout, else of the main
// checkout. Evidence goes to $EVIDENCE, else the run's (VERIFY_RUN, else .verify/latest).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const here = dirname(fileURLToPath(import.meta.url));
const git = (...args) => execFileSync('git', ['-C', here, ...args], { encoding: 'utf8' }).trim();
const repo = process.env.VERIFY_REPO ?? git('rev-parse', '--show-toplevel');
const mainCheckout = git('worktree', 'list', '--porcelain').match(/^worktree (.+)$/m)?.[1];

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    timeout: { type: 'string', default: '120' },
    name: { type: 'string', default: 'email' },
    since: { type: 'string' },
  },
});
const [address] = positionals;
if (!address?.includes('@')) {
  console.error('usage: inbox.mjs <address> [--timeout 120] [--name email] [--since <ISO>]');
  process.exit(2);
}

for (const root of [repo, mainCheckout]) {
  const file = root && join(root, '.env');
  if (!file || !existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^(TEST_INBOX_URL|TEST_INBOX_TOKEN)=(.*)$/);
    const value = match?.[2].trim().replace(/^(["'])(.*)\1$/, '$2');
    if (match && value && !process.env[match[1]]) process.env[match[1]] = value;
  }
}
const { TEST_INBOX_URL: base, TEST_INBOX_TOKEN: token } = process.env;
if (!base || !token) {
  console.error('TEST_INBOX_URL and TEST_INBOX_TOKEN are not set, nor in .env (see .env.example)');
  process.exit(2);
}

const evidence =
  process.env.EVIDENCE ??
  join(process.env.VERIFY_RUN ?? join(repo, '.verify', 'latest'), 'evidence');
mkdirSync(evidence, { recursive: true });

async function get(path) {
  const response = await fetch(new URL(path, base), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`GET ${path}: ${response.status} ${await response.text()}`);
  return response;
}

const since = values.since ? Date.parse(values.since) : 0;
const deadline = Date.now() + Number(values.timeout) * 1000;
let found;
while (!found) {
  const { messages } = await (await get(`/messages?to=${encodeURIComponent(address)}`)).json();
  found = messages.find((message) => Date.parse(message.receivedAt) >= since);
  if (found) break;
  if (Date.now() > deadline) {
    console.error(`No message to ${address} within ${values.timeout}s`);
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

const id = encodeURIComponent(found.id);
const message = await (await get(`/messages/${id}`)).json();
const raw = await (await get(`/messages/${id}/raw`)).text();
const { html, ...rest } = message;
const file = (extension) => join(evidence, `${values.name}.${extension}`);
writeFileSync(file('eml'), raw);
writeFileSync(file('json'), `${JSON.stringify(rest, null, 2)}\n`);
writeFileSync(file('html'), html);

const fromDomain = message.from.slice(message.from.lastIndexOf('@') + 1).toLowerCase();
const aligned = message.dkim.some((v) => v.result === 'pass' && v.domain === fromDomain);
console.log(
  [
    `to:       ${message.to}`,
    `from:     ${message.from}`,
    `subject:  ${message.subject}`,
    `received: ${message.receivedAt}`,
    `dkim:     ${message.dkim.map((v) => `${v.result} (${v.domain})`).join(', ') || 'none'}`,
    `spf:      ${message.spf ?? 'none'}`,
    `dmarc:    ${message.dmarc ?? 'none'}`,
    `saved:    ${file('eml')}, .json, .html`,
  ].join('\n'),
);
if (!aligned) {
  console.error(`No passing DKIM signature for ${fromDomain}`);
  process.exit(3);
}
