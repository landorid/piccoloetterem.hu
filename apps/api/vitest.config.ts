import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // With DATABASE_URL the integration tests share one database, and saving the permanent menu
    // deletes every permanent item it does not list, including one another file just created.
    fileParallelism: !process.env.DATABASE_URL,
  },
});
