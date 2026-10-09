import { loadConfig } from '@piccolo/core';
import { describe, expect, it } from 'vitest';
import { app } from '../app';

const config = loadConfig({ RESTAURANT: 'piccolo' });

describe('GET /api/config/public', () => {
  it('returns the public part of the config, anonymously and without a database', async () => {
    // No DATABASE_URL and no HYPERDRIVE: `withDb` would throw, so a 200 also proves the route
    // never touches the database.
    const res = await app.request('/api/config/public', {}, { RESTAURANT: 'piccolo' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      name: config.name,
      contact: config.contact,
      pickupEnabled: config.pickupEnabled,
      pricing: config.pricing,
      extras: config.extras,
    });
  });
});
