import { strFromU8, unzipSync } from 'fflate';

/*
 * The .docx format, as far as the menu card needs it: the main document's tables laid out on
 * their grid, and the text outside them. Knows zip and WordprocessingML as Word and Pages write
 * them; knows nothing about menus. The bytes are untrusted, so every check on them is here and
 * nothing throws.
 */

/** A table cell on its table's grid. */
export interface Cell {
  /** The first grid column it covers: the row's `w:gridBefore` plus the spans to its left. */
  column: number;
  /** How many grid columns it covers (`w:gridSpan`), at least 1. */
  span: number;
  /** Its paragraphs' text: NFC, whitespace collapsed, trimmed, empty ones dropped. */
  lines: readonly string[];
}

export type Row = readonly Cell[];
export type Table = readonly Row[];

export interface DocxBody {
  /**
   * Every paragraph outside the tables, in document order, text boxes included (also one anchored
   * in a cell). A text box's fallback copy (`mc:Fallback`) is left out, so its text appears once.
   */
  outsideText: readonly string[];
  /** The body's top-level tables, in document order. Tables nested in a cell are left out. */
  tables: readonly Table[];
}

export type DocxFailure = 'legacy_doc' | 'not_docx' | 'too_large';

export type DocxResult = { ok: true; body: DocxBody } | { ok: false; reason: DocxFailure };

const maxFileBytes = 32 * 1024 * 1024;
const maxDocumentBytes = 16 * 1024 * 1024;
const documentPath = 'word/document.xml';
/** An OLE compound file: Word 97–2003's `.doc`. */
const oleSignature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export function readDocx(file: Uint8Array): DocxResult {
  if (oleSignature.every((byte, i) => file[i] === byte)) {
    return { ok: false, reason: 'legacy_doc' };
  }
  if (file.length > maxFileBytes) {
    return { ok: false, reason: 'too_large' };
  }
  try {
    let oversized = false;
    // Only the main document is inflated, into a buffer of the size the zip declares for it.
    const xml = unzipSync(file, {
      filter: ({ name, originalSize }) => {
        oversized ||= name === documentPath && originalSize > maxDocumentBytes;
        return name === documentPath && !oversized;
      },
    })[documentPath];
    if (oversized || (xml && xml.length > maxDocumentBytes)) {
      return { ok: false, reason: 'too_large' };
    }
    const body = xml && readDocumentXml(strFromU8(xml));
    return body ? { ok: true, body } : { ok: false, reason: 'not_docx' };
  } catch {
    return { ok: false, reason: 'not_docx' };
  }
}

/**
 * Comments, processing instructions, CDATA, an end tag, a start tag, text. A DOCTYPE (which
 * WordprocessingML never has) matches none, so it fails the document, and no entity is expanded.
 */
const token =
  /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/y;

const namedEntities: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decode(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, ref: string) => {
    if (!ref.startsWith('#')) {
      return namedEntities[ref] ?? entity;
    }
    const hex = ref[1] === 'x' || ref[1] === 'X';
    return String.fromCodePoint(Number.parseInt(ref.slice(hex ? 2 : 1), hex ? 16 : 10));
  });
}

function valOf(attributes: string, fallback: number): number {
  const value = Number.parseInt(/\bval\s*=\s*["'](\d+)/.exec(attributes)?.[1] ?? '', 10);
  return Number.isNaN(value) ? fallback : value;
}

function localName(name: string | undefined): string {
  return name?.slice(name.indexOf(':') + 1) ?? '';
}

/** Elements whose whole subtree is not read: a fallback copy, tracked deletions, tab stops. */
const skipped = new Set(['Fallback', 'del', 'moveFrom', 'tabs']);

/**
 * `word/document.xml` as a `DocxBody`, or `null` when it is not well-formed. One pass over the
 * tokens, no DOM (core runs without one). Elements are matched by local name, so the prefix a
 * producer binds does not matter.
 */
function readDocumentXml(xml: string): DocxBody | null {
  const outsideText: string[] = [];
  const tables: Table[] = [];
  const open: string[] = [];
  let skipFrom: number | null = null;
  let textBoxes = 0;
  let inText = false;
  let table: Row[] | null = null;
  let row: Cell[] | null = null;
  let cell: { column: number; span: number; lines: string[] } | null = null;
  let column = 0;
  /** A text box's paragraphs sit inside the paragraph that anchors it: one buffer per level. */
  const paragraphs: string[][] = [];

  const start = (name: string, attributes: string) => {
    const local = localName(name);
    open.push(name);
    if (skipFrom !== null) {
      return;
    }
    const inGrid = table !== null && textBoxes === 0;
    if (skipped.has(local) || (local === 'tbl' && inGrid)) {
      skipFrom = open.length;
    } else if (local === 'txbxContent') {
      textBoxes += 1;
    } else if (local === 'tbl' && textBoxes === 0) {
      table = [];
    } else if (local === 'tr' && inGrid) {
      row = [];
      column = 0;
    } else if (local === 'gridBefore' && inGrid && row && !cell) {
      column += valOf(attributes, 0);
    } else if (local === 'tc' && inGrid && row) {
      cell = { column, span: 1, lines: [] };
    } else if (local === 'gridSpan' && inGrid && cell) {
      cell.span = Math.max(1, valOf(attributes, 1));
    } else if (local === 'p') {
      paragraphs.push([]);
    } else if (local === 't') {
      inText = true;
    } else if (local === 'tab' || local === 'br' || local === 'cr') {
      paragraphs.at(-1)?.push(' ');
    }
  };

  const end = (name: string) => {
    const local = localName(name);
    const inGrid = table !== null && textBoxes === 0;
    if (skipFrom !== null) {
      skipFrom = open.length === skipFrom ? null : skipFrom;
    } else if (local === 'txbxContent') {
      textBoxes -= 1;
    } else if (local === 't') {
      inText = false;
    } else if (local === 'p') {
      const text = (paragraphs.pop() ?? []).join('').normalize('NFC').replace(/\s+/g, ' ').trim();
      if (text !== '') {
        (cell && textBoxes === 0 ? cell.lines : outsideText).push(text);
      }
    } else if (local === 'tc' && inGrid && row && cell) {
      row.push(cell);
      column += cell.span;
      cell = null;
    } else if (local === 'tr' && inGrid && table && row) {
      table.push(row);
      row = null;
    } else if (local === 'tbl' && inGrid && table) {
      tables.push(table);
      table = null;
    }
    open.pop();
  };

  let root = false;
  token.lastIndex = 0;
  while (token.lastIndex < xml.length) {
    const match = token.exec(xml);
    if (!match) {
      return null;
    }
    const [, cdata, closing, opening, attributes = '', selfClosing, text] = match;
    if (opening) {
      if (root && open.length === 0) {
        return null;
      }
      root = true;
      start(opening, attributes);
      if (selfClosing) {
        end(opening);
      }
    } else if (closing) {
      if (open.at(-1) !== closing) {
        return null;
      }
      end(closing);
    } else if (inText && skipFrom === null) {
      paragraphs.at(-1)?.push(cdata ?? decode(text ?? ''));
    }
  }
  return root && open.length === 0 ? { outsideText, tables } : null;
}
