import { expect, it } from 'vitest';
import './index';
import { memoryKv } from './menu/memoryKv';
import { orderEventsFor } from './orders/events';

it('the Worker entry installs the confirmation e-mail as the order listener', async () => {
  // The e-mail listener opens a database client first, so without one it rejects; the default
  // `noopOrderEvents` would resolve.
  await expect(
    orderEventsFor({ MENU_CACHE: memoryKv() }).orderSubmitted('submission-1', ['order-1']),
  ).rejects.toThrow('No database configured');
});
