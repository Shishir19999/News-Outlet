// Copies the canonical shared rules (shared/*.js) into backend/src/shared and frontend/src/shared.
// Run from the repository root: node scripts/sync-shared.mjs   (or `npm run sync:shared` in backend/ or frontend/).
// The backend and frontend tests fail when a copy differs from the canonical file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'shared');
const targets = [path.join(root, 'backend', 'src', 'shared'), path.join(root, 'frontend', 'src', 'shared')];
for (const t of targets) {
  fs.mkdirSync(t, { recursive: true });
  for (const f of fs.readdirSync(src).filter((n) => n.endsWith('.js'))) fs.copyFileSync(path.join(src, f), path.join(t, f));
}
console.log('Shared rules copied to', targets.map((t) => path.relative(root, t)).join(' and '));
