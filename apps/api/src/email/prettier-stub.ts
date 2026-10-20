/**
 * Stands in for `prettier/standalone` and `prettier/plugins/html` in the Worker bundle (the
 * `[alias]` in wrangler.toml). `@react-email/render` imports prettier only for
 * `render(…, { pretty: true })`, which this API never asks for; the real modules would add about
 * 325 KiB to the Worker. Tests and scripts run in Node and get the real prettier.
 */
export function format(): never {
  throw new Error('prettier is not bundled into the Worker: render without `pretty`.');
}
