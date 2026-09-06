import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

// The build output is served by the Worker at / (see apps/api/wrangler.toml).
export default defineConfig({
  integrations: [react()],
});
