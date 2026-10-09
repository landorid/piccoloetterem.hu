// Writes a run's private state (called by up.sh):
//   state/api.dev.vars  the API's secrets and vars for `wrangler dev --env-file`
//   state/admin/.env    the admin's VITE_* (its envDir)
//   state/staff.jwt     a staff session token the API accepts
//   state/db.url        DATABASE_URL, for sql.mjs
//
// Staff auth without Clerk's hosted sign-in: a per-run RSA key pair stands in for the Clerk
// instance. The API runs the real `requireStaff` with CLERK_JWT_KEY set to the run's public key,
// so it verifies the token below exactly as it verifies Clerk's (signature, azp, org). Nothing is
// sent to Clerk, and the Clerk keys in .dev.vars are never read.
//
// Usage: node prepare.mjs <runDir> <apiUrl> <webUrl> <adminUrl> <devVars|-> <rootEnv|->
import { createSign, generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [runDir, apiUrl, webUrl, adminUrl, devVarsPath, rootEnvPath] = process.argv.slice(2);
const state = join(runDir, 'state');
const ORG_ID = 'org_verify';
const USER_ID = 'user_verify';

/** `KEY=value` lines; quotes stripped. Multi-line values are skipped (only the Clerk PEM is one). */
function readEnv(path) {
  if (!path || path === '-' || !existsSync(path)) return {};
  const values = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

const databaseUrl =
  process.env.DATABASE_URL ||
  readEnv(devVarsPath).DATABASE_URL ||
  readEnv(rootEnvPath).DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not found in the environment, apps/api/.dev.vars or .env');
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString().trim();

const base64url = (value) => Buffer.from(value).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const header = { alg: 'RS256', typ: 'JWT', kid: 'ins_verify' };
// The claims of a Clerk v2 session token with an active organization.
const claims = {
  azp: adminUrl,
  exp: now + 12 * 60 * 60,
  iat: now,
  nbf: now - 10,
  iss: 'https://verify.clerk.accounts.dev',
  sid: 'sess_verify',
  sub: USER_ID,
  sts: 'active',
  v: 2,
  o: { id: ORG_ID, rol: 'admin', slg: 'verify' },
};
const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
const signature = createSign('RSA-SHA256').update(unsigned).sign(privateKey).toString('base64url');
const token = `${unsigned}.${signature}`;

// A syntactically valid publishable key for a Clerk instance that does not exist.
const publishableKey = `pk_test_${Buffer.from('verify.clerk.accounts.dev$').toString('base64')}`;

mkdirSync(join(state, 'admin'), { recursive: true });
const quote = (value) => JSON.stringify(value);
writeFileSync(
  join(state, 'api.dev.vars'),
  [
    `DATABASE_URL=${quote(databaseUrl)}`,
    `CORS_ORIGINS=${quote(`${webUrl},${adminUrl}`)}`,
    `CLERK_AUTHORIZED_PARTIES=${quote(adminUrl)}`,
    `CLERK_PUBLISHABLE_KEY=${quote(publishableKey)}`,
    `CLERK_SECRET_KEY=${quote('sk_test_verify')}`,
    `CLERK_JWT_KEY=${quote(publicPem)}`,
    `CLERK_ORG_ID=${quote(ORG_ID)}`,
    '',
  ].join('\n'),
  { mode: 0o600 },
);
writeFileSync(
  join(state, 'admin', '.env'),
  [
    `VITE_CLERK_PUBLISHABLE_KEY=${publishableKey}`,
    `VITE_CLERK_ORG_ID=${ORG_ID}`,
    `VITE_API_URL=${apiUrl}`,
    `VITE_VERIFY_STAFF_TOKEN=${token}`,
    '',
  ].join('\n'),
  { mode: 0o600 },
);
writeFileSync(join(state, 'staff.jwt'), token, { mode: 0o600 });
writeFileSync(join(state, 'db.url'), databaseUrl, { mode: 0o600 });
