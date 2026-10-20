/**
 * The one API request the server makes: `astro dev` renders /megrendeles with the public config it
 * fetches here. Everything the browser asks the API is stubbed per test (see `api.ts`).
 *
 * Runs under Node's type stripping, so it imports the fixture by its `.ts` path.
 */
import { createServer } from 'node:http';
import { publicConfig } from '../src/test/fixtures.ts';

const port = Number(process.env.PORT ?? 8790);

createServer((request, response) => {
  if (request.url === '/api/config/public') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(publicConfig));
    return;
  }
  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'not_found' }));
}).listen(port);
