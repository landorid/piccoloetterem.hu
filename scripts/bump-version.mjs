// Bumps the minor version of every package.json in the workspace, in lockstep, and prints the new
// version. CI runs it on each push to main (.github/workflows/ci.yml); /api/health reports it.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const files = [
  'package.json',
  ...['apps', 'packages'].flatMap((dir) =>
    readdirSync(new URL(dir, root)).map((name) => `${dir}/${name}/package.json`),
  ),
].filter((file) => existsSync(new URL(file, root)));

const [major, minor] = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
  .version.split('.')
  .map(Number);
const version = `${major}.${minor + 1}.0`;

for (const file of files) {
  const url = new URL(file, root);
  // A text replace, not JSON.stringify, so the files keep their formatting.
  writeFileSync(
    url,
    readFileSync(url, 'utf8').replace(/"version": "[^"]*"/, `"version": "${version}"`),
  );
}

console.log(version);
