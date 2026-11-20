import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { GATED_PAGE_PATHS } from '../src/config/auth.ts';
import { isKnownPublicPagePath } from '../src/config/agent-not-found.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('BDSI terminal page routing', () => {
  it('requires sign-in for /terminal and /terminal.html', () => {
    assert.ok(GATED_PAGE_PATHS.has('/terminal'));
    assert.ok(GATED_PAGE_PATHS.has('/terminal.html'));
    assert.match(read('middleware.ts'), /'\/terminal\.html',/);
  });

  it('is a known page and the bdnews.si home', () => {
    assert.equal(isKnownPublicPagePath('/terminal'), true);
    const vercel = JSON.parse(read('vercel.json'));
    const rewrites: Array<{ source: string; destination: string; has?: Array<{ value: string }> }> = vercel.rewrites;
    assert.ok(rewrites.some((r) => r.source === '/terminal' && r.destination === '/terminal.html'));
    const home = rewrites.find((r) => r.source === '/' && r.has?.some((h) => h.value.includes('bdnews')));
    assert.equal(home?.destination, '/terminal.html');
  });

  it('is built as its own page', () => {
    assert.match(read('vite.config.ts'), /terminal: resolve\(__dirname, 'terminal\.html'\)/);
    assert.match(read('terminal.html'), /src="\/src\/terminal-main\.ts"/);
  });
});
