// `pnpm dev` for the API: `wrangler dev` with a local stand-in for the HYPERDRIVE binding. Wrangler
// refuses to start a Hyperdrive binding without CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE
// and reads it from the process environment only, never from .dev.vars. A value already in the
// shell wins; otherwise this passes DATABASE_URL from .dev.vars.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HYPERDRIVE_LOCAL = 'CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The value of `name` in .dev.vars, unquoted, or undefined when the file or a value is missing. */
function readDevVar(name) {
  const path = resolve(apiRoot, '.dev.vars');
  if (!existsSync(path)) return undefined;
  const match = readFileSync(path, 'utf8').match(new RegExp(`^\\s*${name}\\s*=(.*)$`, 'm'));
  if (!match) return undefined;
  const value = match[1].trim();
  const unquoted = /^(["']).*\1$/.test(value) ? value.slice(1, -1) : value;
  return unquoted || undefined;
}

const connectionString = process.env[HYPERDRIVE_LOCAL] || readDevVar('DATABASE_URL');
// Without one, wrangler stops with its own error naming the variable.
const env = connectionString
  ? { ...process.env, [HYPERDRIVE_LOCAL]: connectionString }
  : process.env;

const wrangler = resolve(apiRoot, 'node_modules/wrangler/bin/wrangler.js');
const child = spawn(process.execPath, [wrangler, 'dev', ...process.argv.slice(2)], {
  cwd: apiRoot,
  env,
  stdio: 'inherit',
});

// Pass a stop on to wrangler, so it shuts workerd down instead of leaving it on :8787.
const forwarded = ['SIGINT', 'SIGTERM', 'SIGHUP'];
for (const signal of forwarded) process.on(signal, () => child.kill(signal));

child.on('exit', (code, signal) => {
  if (signal) {
    // Die of the same signal: drop the forwarding handler so the default action runs.
    process.removeAllListeners(signal);
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
