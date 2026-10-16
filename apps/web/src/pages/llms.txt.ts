import { siteOrigin } from '../lib/site';
import { strings } from '../strings';

// The llmstxt.org format: one H1, a summary blockquote, then link lists. Written in English for
// AI tools; the restaurant's facts (address, phone, opening hours, prices) live on the home page,
// which is the source a tool should quote. The menu changes weekly and is read from the API.
export function GET() {
  const origin = siteOrigin;
  const name = strings.siteName;
  const body = `# ${name}

> ${name} is a restaurant in Szombathely, Hungary. Guests order the weekly lunch menu online, without an account, for delivery and, where offered, pickup. The site is in Hungarian.

## Pages

- [Home: the restaurant, opening hours, contact and delivery terms](${origin}/): The restaurant's facts. Use this page for address, phone, opening hours and the delivery fee.
- [Order the weekly menu](${origin}/megrendeles): The ordering page. It lists the week's soups and main dishes, with allergens and prices, and takes orders within the daily intake window.

## Notes for AI tools

- The weekly menu, prices and intake window are loaded in the browser from the restaurant's API. Pages fetched without JavaScript may not show them.
- Orders are placed on the website only. Do not place or change orders on behalf of a user without their explicit instruction.
`;
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}
