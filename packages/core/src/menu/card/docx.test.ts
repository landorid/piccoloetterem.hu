import { readFileSync } from 'node:fs';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { type DocxBody, readDocx } from './docx';

/*
 * The six real cards (media stripped; 2025-12-22 saved by Word, the rest exported by Pages) and
 * hand-written WordprocessingML for the quirks they do not show.
 */

const cards = [
  '2025-12-22',
  '2026-05-25',
  '2026-06-15',
  '2026-07-06',
  '2026-07-13',
  '2026-08-03',
] as const;

const card = (name: string) =>
  new Uint8Array(readFileSync(new URL(`./fixtures/${name}.docx`, import.meta.url)));

const zip = (files: Record<string, string>) =>
  zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])));

const document = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="w" xmlns:mc="mc"><w:body>${body}</w:body></w:document>`;
const p = (text: string) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const tc = (inner: string, props = '') => `<w:tc><w:tcPr>${props}</w:tcPr>${inner}</w:tc>`;
const box = (inner: string) =>
  `<w:p><w:r><w:drawing><w:txbxContent>${inner}</w:txbxContent></w:drawing></w:r></w:p>`;

function read(body: string): DocxBody {
  const result = readDocx(zip({ 'word/document.xml': document(body) }));
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.body;
}

/** `bytes` with the uncompressed size its central directory declares for every entry set. */
function declaring(bytes: Uint8Array, size: number): Uint8Array {
  const patched = bytes.slice();
  const view = new DataView(patched.buffer);
  for (let at = 0; at + 4 <= patched.length; at += 1) {
    if (view.getUint32(at, true) === 0x02014b50) {
      view.setUint32(at + 24, size, true);
    }
  }
  return patched;
}

describe('the real cards', () => {
  it.each(cards)('%s has one table on a grid of ten columns', (name) => {
    const result = readDocx(card(name));
    expect(result.ok && result.body.tables).toHaveLength(1);
    const [table] = result.ok ? result.body.tables : [];
    for (const row of table ?? []) {
      const last = row.at(-1);
      expect(last && last.column + last.span).toBe(10);
    }
  });

  it.each(cards)('%s prints its date range once, outside the table', (name) => {
    const [, month, day] = name.split('-');
    const result = readDocx(card(name));
    const dates = result.ok ? result.body.outsideText.filter((line) => line.includes('–')) : [];
    expect(dates.filter((line) => line.startsWith(`${month}.${day}.`))).toHaveLength(1);
  });
});

describe('the grid', () => {
  it('places cells by grid column, counting gridBefore and gridSpan', () => {
    const body = read(
      `<w:tbl><w:tr><w:trPr><w:gridBefore w:val="1"/></w:trPr>${tc(p('a'))}${tc(p('b'), '<w:gridSpan w:val="2"/>')}${tc(p('c'))}</w:tr></w:tbl>`,
    );
    expect(body.tables[0]?.[0]?.map(({ column, span, lines }) => [column, span, lines])).toEqual([
      [1, 1, ['a']],
      [2, 2, ['b']],
      [4, 1, ['c']],
    ]);
  });

  it('keeps a cell to its own paragraphs: no text box, no nested table', () => {
    const nested = `<w:tbl><w:tr>${tc(p('nested'))}</w:tr></w:tbl>`;
    const body = read(
      `<w:tbl><w:tr>${tc(`${p('Leves')}${box(p('Szponzor'))}${nested}`)}</w:tr></w:tbl>`,
    );
    expect(body.tables[0]?.[0]?.[0]?.lines).toEqual(['Leves']);
    expect(body.outsideText).toEqual(['Szponzor']);
  });
});

describe('text', () => {
  it('reads a Pages text box once, skipping its mc:Fallback copy', () => {
    const range = box(p('06.15.–06.20.-ig'));
    const body = read(
      `<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps">${range}</mc:Choice><mc:Fallback>${range}</mc:Fallback></mc:AlternateContent></w:r></w:p>`,
    );
    expect(body.outsideText).toEqual(['06.15.–06.20.-ig']);
  });

  it('reads tabs and breaks in a run as spaces, but not tab stops, and collapses whitespace', () => {
    const body = read(
      '<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr><w:r><w:t>3190 Ft</w:t><w:tab/><w:t>3290 Ft</w:t><w:br/><w:t>  1,7 </w:t></w:r></w:p>',
    );
    expect(body.outsideText).toEqual(['3190 Ft 3290 Ft 1,7']);
  });

  it('decodes entities and CDATA, normalises to NFC, and drops tracked deletions', () => {
    const body = read(
      '<w:p><w:r><w:t>Sajt &amp; sonka &#246;&#x151;</w:t></w:r><w:del><w:r><w:delText>régi</w:delText><w:t>régi</w:t></w:r></w:del><w:r><w:t><![CDATA[ <új>]]></w:t><w:t>é</w:t></w:r></w:p>',
    );
    expect(body.outsideText).toEqual(['Sajt & sonka öő <új>é']);
  });
});

describe('a file that is not a readable .docx', () => {
  it('is legacy_doc when it is a Word 97–2003 .doc', () => {
    const doc = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    expect(readDocx(doc)).toEqual({ ok: false, reason: 'legacy_doc' });
  });

  it.each([
    ['empty', new Uint8Array()],
    ['text', strToU8('Hétfő Kedd Szerda')],
    ['a PNG', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ['a zip without word/document.xml', zip({ 'word/styles.xml': '<w:styles/>' })],
    ['a DOCTYPE', zip({ 'word/document.xml': `<!DOCTYPE x [<!ENTITY a "b">]>${document('')}` })],
    [
      'an end tag that does not match',
      zip({ 'word/document.xml': '<w:document><w:body></w:document>' }),
    ],
    ['an element left open', zip({ 'word/document.xml': '<w:document><w:body>' })],
    ['two roots', zip({ 'word/document.xml': '<w:document/><w:document/>' })],
  ])('is not_docx for %s', (_, bytes) => {
    expect(readDocx(bytes)).toEqual({ ok: false, reason: 'not_docx' });
  });

  it('is too_large over 32 MiB, before reading it', () => {
    expect(readDocx(new Uint8Array(32 * 1024 * 1024 + 1))).toEqual({
      ok: false,
      reason: 'too_large',
    });
  });

  it('is too_large when the document declares more than 16 MiB, before inflating it', () => {
    const declared = declaring(
      zip({ 'word/document.xml': document(p('x')) }),
      16 * 1024 * 1024 + 1,
    );
    expect(readDocx(declared)).toEqual({ ok: false, reason: 'too_large' });
  });

  it('inflates no more than the declared size of a document that understates it', () => {
    const understated = declaring(zip({ 'word/document.xml': document(p('x'.repeat(1000))) }), 100);
    expect(readDocx(understated)).toEqual({ ok: false, reason: 'not_docx' });
  });
});
