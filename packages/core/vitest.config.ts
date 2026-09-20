import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // A host timezone far from Europe/Budapest (UTC+14), so code that accidentally reads the
    // host's zone fails a test instead of passing by coincidence.
    env: { TZ: 'Pacific/Kiritimati' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Keep fully covered files in the table; the issue's validation quotes the calendar.ts row.
      reporter: [['text', { skipFull: false }]],
    },
  },
});
