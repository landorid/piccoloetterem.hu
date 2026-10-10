import { fileURLToPath } from 'node:url';
import react from '@astrojs/react';
import { defineConfig, fontProviders } from 'astro/config';

const subsets = ['latin', 'latin-ext'];

// The build output is served at <domain> by its own assets-only Worker (see wrangler.toml).
export default defineConfig({
  integrations: [react()],
  // `/megrendeles` → `megrendeles.html`, which the Worker serves at `/megrendeles` itself
  // (`html_handling` "auto-trailing-slash"). The default `megrendeles/index.html` would answer
  // `/megrendeles` with a 307 to `/megrendeles/`.
  build: { format: 'file' },
  trailingSlash: 'never',
  // Downloaded at build time and served from the site itself: no visitor request goes to a font
  // CDN (docs/design/megrendeles/README.md, "Production note").
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Manrope',
      cssVariable: '--font-manrope',
      weights: [400, 600, 700],
      subsets,
      fallbacks: [
        'ui-sans-serif',
        'system-ui',
        '-apple-system',
        'Segoe UI',
        'Roboto',
        'Arial',
        'sans-serif',
      ],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Fraunces',
      cssVariable: '--font-fraunces',
      weights: [400, 500, 600],
      subsets,
      fallbacks: ['ui-serif', 'Georgia', 'Times New Roman', 'serif'],
    },
  ],
  // Repo-root `.env`, so `PUBLIC_API_URL` lives next to the other keys in `.env.example`.
  vite: {
    envDir: fileURLToPath(new URL('../..', import.meta.url)),
  },
});
