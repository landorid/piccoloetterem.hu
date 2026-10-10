import { describe, expect, it } from 'vitest';
import type { Bindings } from '../env';
import { memoryKv } from '../menu/memoryKv';
import { noopOrderEvents, type OrderEvents, orderEventsFor, setOrderEvents } from './events';

describe('orderEventsFor', () => {
  const env: Bindings = { MENU_CACHE: memoryKv(), RESTAURANT: 'piccolo' };

  it('listens to nothing until the Worker entry installs listeners, then hands out theirs', async () => {
    expect(orderEventsFor(env)).toBe(noopOrderEvents);

    const heard: [Bindings, string][] = [];
    setOrderEvents(
      (forEnv): OrderEvents => ({
        async orderSubmitted(submissionId) {
          heard.push([forEnv, submissionId]);
        },
      }),
    );
    await orderEventsFor(env).orderSubmitted('submission-1', ['order-1']);

    expect(heard).toEqual([[env, 'submission-1']]);
  });
});
