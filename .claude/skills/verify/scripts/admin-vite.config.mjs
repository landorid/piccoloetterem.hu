// The admin's Vite dev server for a verification run (started by up.sh). Same app, same plugins
// as apps/admin/vite.config.ts, with two changes: `@clerk/react` is the stub in clerk-stub.js,
// and the env comes from the run (VERIFY_ADMIN_ENV_DIR), not from the repo-root .env.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const adminRoot = process.env.VERIFY_ADMIN_ROOT;
const envDir = process.env.VERIFY_ADMIN_ENV_DIR;
if (!adminRoot || !envDir) {
  throw new Error(
    'Start the admin with scripts/up.sh: VERIFY_ADMIN_ROOT/VERIFY_ADMIN_ENV_DIR unset',
  );
}

// Resolved from apps/admin, because this file lives outside it.
const require = createRequire(join(adminRoot, 'package.json'));
const load = async (name) => (await import(pathToFileURL(require.resolve(name)).href)).default;
const react = await load('@vitejs/plugin-react');
const tailwindcss = await load('@tailwindcss/vite');

export default {
  root: adminRoot,
  envDir,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@clerk/react': join(here, 'clerk-stub.js'),
      '@': join(adminRoot, 'src'),
    },
  },
  server: { strictPort: true },
};
