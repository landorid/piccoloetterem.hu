import type { Page, Request } from '@playwright/test';
import { openMenu } from '../src/test/fixtures';

export const apiOrigin = 'http://localhost:8790';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

/** An answer of the stubbed API, or a request that never reaches it. */
export type Reply = { status?: number; json: unknown } | 'network_error';

interface Stub {
  /** What `GET /api/menu` answers; change it before the page refetches. */
  menu: unknown;
  /** What each `POST /api/orders` answers, in turn; the last one repeats. Default: stored. */
  orderReplies: Array<(body: SubmissionBody) => Reply>;
  /** The bodies the page sent to `POST /api/orders`. */
  orders: SubmissionBody[];
}

export interface SubmissionBody {
  name: string;
  phone: string;
  email: string;
  address?: string;
  note?: string;
  days: Array<{ deliveryDate: string; menus: unknown[]; extras: unknown[] }>;
}

/** The API stored the submission: one order per day. */
export const stored = (body: SubmissionBody): Reply => ({
  status: 201,
  json: {
    submissionId: 'sub-1',
    orders: body.days.map((day, i) => ({
      id: `order-${i + 1}`,
      deliveryDate: day.deliveryDate,
      total: 1000 + i,
    })),
    grandTotal: 2000,
  },
});

/**
 * Answers the page's API requests in the browser, so a test decides what the API says. The clock
 * is Wednesday 9 September 2026, 08:00 in Szombathely: the fixture week's Wednesday is orderable.
 */
export async function stubApi(page: Page): Promise<Stub> {
  const stub: Stub = { menu: openMenu, orderReplies: [], orders: [] };
  await page.clock.setFixedTime(new Date('2026-09-09T08:00:00+02:00'));
  await page.route(`${apiOrigin}/**`, async (route, request: Request) => {
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: cors });
    }
    const path = new URL(request.url()).pathname;
    let reply: Reply = { status: 404, json: { error: 'not_found' } };
    if (path === '/api/menu') {
      reply = { json: stub.menu };
    } else if (path === '/api/orders' && request.method() === 'POST') {
      const body = request.postDataJSON() as SubmissionBody;
      stub.orders.push(body);
      const next = stub.orderReplies.length > 1 ? stub.orderReplies.shift() : stub.orderReplies[0];
      reply = (next ?? stored)(body);
    }
    if (reply === 'network_error') return route.abort('internetdisconnected');
    return route.fulfill({ status: reply.status ?? 200, headers: cors, json: reply.json });
  });
  return stub;
}
