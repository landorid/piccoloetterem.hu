import { Hono } from 'hono';

const app = new Hono();

// Deliberately does not touch the database: a frequent ping would keep the Neon
// compute awake and multiply its consumption (docs/STACK.md rule 3).
app.get('/api/health', (c) => c.json({ ok: true }));

// Every response this Worker produces is structured JSON. Error bodies carry a
// machine-readable `code`; the frontends map that code to a Hungarian message in
// their own strings.ts, so no user-facing text originates here.
app.notFound((c) => c.json({ error: { code: 'not_found' } }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: { code: 'internal_error' } }, 500);
});

export default app;
