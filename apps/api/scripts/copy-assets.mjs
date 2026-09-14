// Copies the two static builds into the Worker's assets directory: apps/web/dist to public/ and
// apps/admin/dist to public/admin/. Run by `pnpm build` after both apps are built.
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = new URL('../', import.meta.url);
const publicDir = fileURLToPath(new URL('public/', apiDir));
const webDist = fileURLToPath(new URL('../web/dist/', apiDir));
const adminDist = fileURLToPath(new URL('../admin/dist/', apiDir));

for (const dist of [webDist, adminDist]) {
  if (!existsSync(dist)) {
    console.error(`Missing ${dist}. Build apps/web and apps/admin first (pnpm build).`);
    process.exit(1);
  }
}

for (const entry of readdirSync(publicDir)) {
  if (entry !== '.assetsignore') {
    rmSync(join(publicDir, entry), { recursive: true, force: true });
  }
}

cpSync(webDist, publicDir, { recursive: true });
cpSync(adminDist, join(publicDir, 'admin'), { recursive: true });
console.log('Copied apps/web/dist → public/ and apps/admin/dist → public/admin/');
