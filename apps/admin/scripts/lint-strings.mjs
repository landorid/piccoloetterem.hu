// Fails when Hungarian text appears in src/ outside src/strings.ts. Every user-facing string of
// the admin lives in strings.ts (AGENTS.md); tests are exempt.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src', import.meta.url));
const hungarian = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/;

const files = (await readdir(src, { recursive: true }))
  .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
  .filter((file) => file !== 'strings.ts')
  .sort();

const offences = [];
for (const file of files) {
  const lines = (await readFile(join(src, file), 'utf8')).split('\n');
  lines.forEach((line, index) => {
    if (hungarian.test(line)) {
      offences.push(`  src/${file}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (offences.length > 0) {
  console.error('Hungarian text outside src/strings.ts. Move it into strings.ts and import it:');
  console.error(offences.join('\n'));
  process.exit(1);
}
console.log(`lint:strings: ${files.length} files, no Hungarian text outside src/strings.ts.`);
