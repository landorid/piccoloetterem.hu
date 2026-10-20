/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served at the root of admin.<domain> by its own assets-only Worker (wrangler.toml). It calls
// the API at api.<domain> cross-origin (see docs/STACK.md §1).
export default defineConfig({
  // Repo-root `.env`, so `VITE_CLERK_PUBLISHABLE_KEY` lives next to the API keys in `.env.example`.
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Component tests run in jsdom; src/test/setup.ts fills in what jsdom lacks.
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
