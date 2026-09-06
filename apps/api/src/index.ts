import { Hono } from 'hono';

const app = new Hono();

// Deliberately does not touch the database: a frequent ping would keep the Neon
// compute awake and multiply its consumption (docs/STACK.md rule 3).
app.get('/api/health', (c) => c.json({ ok: true }));

export default app;
