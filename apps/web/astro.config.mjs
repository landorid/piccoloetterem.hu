import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

// The build output is served at <domain> by its own assets-only Worker (see wrangler.toml).
export default defineConfig({
  integrations: [react()],
});
