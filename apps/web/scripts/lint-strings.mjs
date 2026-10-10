// Fails when Hungarian text appears in src/ outside src/strings.ts. Every user-facing string of
// the public site lives in strings.ts (AGENTS.md); tests and test fixtures are exempt.
// Also fails on an invisible space typed as is anywhere in src/: write it as an escape
// (` `), so a reviewer can see it.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src', import.meta.url));
const hungarian = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/;
const invisible = /[  -​  　﻿]/;

const all = (await readdir(src, { recursive: true }))
  .filter((file) => /\.(tsx?|astro|css)$/.test(file))
  .sort();
const exempt = (file) =>
  /\.test\.tsx?$/.test(file) || file === 'strings.ts' || file.startsWith(join('test', ''));

const offences = [];
const spaces = [];
for (const file of all) {
  const lines = (await readFile(join(src, file), 'utf8')).split('\n');
  lines.forEach((line, index) => {
    if (!exempt(file) && !file.endsWith('.css') && hungarian.test(line)) {
      offences.push(`  src/${file}:${index + 1}: ${line.trim()}`);
    }
    if (invisible.test(line)) {
      spaces.push(`  src/${file}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (offences.length > 0) {
  console.error('Hungarian text outside src/strings.ts. Move it into strings.ts and import it:');
  console.error(offences.join('\n'));
}
if (spaces.length > 0) {
  console.error('Invisible spaces typed as is. Write them as escapes, e.g. \\u00a0:');
  console.error(spaces.join('\n'));
}
if (offences.length > 0 || spaces.length > 0) {
  process.exit(1);
}
console.log(
  `lint:strings: ${all.length} files, no Hungarian text outside src/strings.ts, no invisible spaces.`,
);
