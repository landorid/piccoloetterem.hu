import { fileURLToPath } from 'node:url';
import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

// The build output is served at <domain> by its own assets-only Worker (see wrangler.toml).
export default defineConfig({
  integrations: [react()],
  // `/megrendeles` → `megrendeles.html`, which the Worker serves at `/megrendeles` itself
  // (`html_handling` "auto-trailing-slash"). The default `megrendeles/index.html` would answer
  // `/megrendeles` with a 307 to `/megrendeles/`.
  build: { format: 'file' },
  trailingSlash: 'never',
  // Repo-root `.env`, so `PUBLIC_API_URL` lives next to the other keys in `.env.example`.
  vite: {
    envDir: fileURLToPath(new URL('../..', import.meta.url)),
  },
});
