/**
 * Rewrite https://github.com/{owner}.png → avatars.githubusercontent.com/{owner}?s=128
 * Usage: node scripts/fix-icon-urls.mjs [--local]
 */
import { writeFileSync, unlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const remote = !process.argv.includes('--local');
const flag = remote ? '--remote' : '--local';

const sql = `
UPDATE apps
SET icon = 'https://avatars.githubusercontent.com/' ||
  replace(replace(icon, 'https://github.com/', ''), '.png', '') ||
  '?s=128',
  updated_at = datetime('now')
WHERE icon LIKE 'https://github.com/%.png';
`;

const sqlPath = join(tmpdir(), `shelfhub-fix-icons-${Date.now()}.sql`);
writeFileSync(sqlPath, sql.trim() + '\n', 'utf8');

console.log(`Fixing GitHub icon URLs (${flag})…`);
try {
  execSync(`npx wrangler d1 execute shelfhub ${flag} --file="${sqlPath}"`, {
    stdio: 'inherit',
    cwd: root
  });
  console.log('Done.');
} finally {
  try { unlinkSync(sqlPath); } catch (_) {}
}
