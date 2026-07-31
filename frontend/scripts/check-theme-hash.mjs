import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Guards the CSP hash for the pre-paint theme script.
 *
 * THEME_SCRIPT_HASH has to be a literal (middleware runs on the Edge runtime,
 * where node:crypto is unavailable and Web Crypto's digest is async). That
 * means editing THEME_SCRIPT without regenerating the hash would silently
 * break the script under CSP — no build error, just a light/dark flash and a
 * console violation nobody reads.
 */
const FILE = 'src/lib/theme-script.ts';
const src = readFileSync(FILE, 'utf8');

const script = src.match(/THEME_SCRIPT = `([\s\S]*?)`;/)?.[1];
const declared = src.match(/THEME_SCRIPT_HASH =\s*"'([^']+)'"/)?.[1];

if (!script || !declared) {
  console.error(`Could not parse THEME_SCRIPT / THEME_SCRIPT_HASH from ${FILE}`);
  process.exit(1);
}

const actual = `sha256-${createHash('sha256').update(script, 'utf8').digest('base64')}`;

if (declared !== actual) {
  console.error(
    `CSP hash for the theme script is stale.\n` +
      `  declared: ${declared}\n` +
      `  actual:   ${actual}\n` +
      `Update THEME_SCRIPT_HASH in ${FILE}.`,
  );
  process.exit(1);
}

console.log('theme-script CSP hash is current');
