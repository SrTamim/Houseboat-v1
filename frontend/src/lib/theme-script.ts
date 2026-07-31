/**
 * Sets the persisted theme on <html> before first paint, so a dark-mode user
 * never sees a white flash. It has to be an inline script in the document head —
 * a React component would run after paint, which is exactly what this avoids.
 *
 * Keep this in sync with THEME_SCRIPT_HASH below.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('hb-theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

/**
 * CSP source allowing the script above.
 *
 * A hash rather than a nonce, for two reasons:
 *  - The script is static, so the hash is stable and needs no per-request
 *    plumbing through headers into the render tree.
 *  - Passing a nonce to this <script> caused a hydration mismatch: the server
 *    can read request headers and rendered nonce="abc…", while the client
 *    re-render cannot and produced nonce="", so React refused to patch the tree.
 *
 * This is a literal because middleware runs on the Edge runtime, where node's
 * `crypto` is unavailable and Web Crypto's digest is async. If you edit
 * THEME_SCRIPT, regenerate with:
 *
 *   node -e "const c=require('crypto');const s=require('fs').readFileSync('src/lib/theme-script.ts','utf8').match(/THEME_SCRIPT = \`([^\`]*)\`/)[1];console.log('sha256-'+c.createHash('sha256').update(s,'utf8').digest('base64'))"
 *
 * The theme-script.test guards against them drifting apart.
 */
export const THEME_SCRIPT_HASH =
  "'sha256-UWbkzvucrFcqEtWQWik9osnFJcmVy3dCy3UQfJV/eTs='";
