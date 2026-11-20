import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildSources, pickHeadlines, buildPrompt, parseAnswer } from '../api/bd-ask.js';

const markets = {
  dse: { indices: [{ key: 'DSEX', value: 5505.64, change: 4.8, percent: 0.09 }], totals: { turnoverMn: 7466.35, volume: 1, trades: 2, tradeTime: 'Nov 19, 2026 at 2:40 PM' }, breadth: { advanced: 126, declined: 171, unchanged: 54 }, session: { isOpen: false }, gainers: [{ code: 'MATINSPINN', ltp: 137.8, percent: 11.04 }], losers: [] },
  fx: { asOf: '19 Nov 2026', rates: [{ code: 'USD', mid: 124.75 }] },
  bazaar: { error: 'down' },
};
const digest = { categories: {
  asia: { items: [
    { title: 'DSE closes higher as textiles rally', link: 'a', source: 'The Daily Star', publishedAt: 3 },
    { title: 'Floods hit Sylhet', link: 'b', source: 'Reuters', publishedAt: 2 },
    { title: 'Tokyo shares fall', link: 'c', source: 'Japan Times', publishedAt: 4 },
  ] },
  politics: { items: [{ title: 'DSE closes higher as textiles rally', link: 'a', source: 'The Daily Star', publishedAt: 3 }] },
} };

describe('ASK: sources', () => {
  it('numbers market data first, then Bangladesh headlines; skips failed parts', () => {
    const heads = pickHeadlines(digest);
    assert.deepEqual(heads.map((h) => h.link), ['a', 'b']);
    const s = buildSources(markets, heads);
    assert.deepEqual(s.map((x) => x.n), [1, 2, 3, 4]);
    assert.match(s[0].text, /DSEX 5505\.64/);
    assert.match(s[0].text, /MATINSPINN/);
    assert.match(s[1].text, /USD 124\.7500/);
    assert.equal(s[2].kind, 'news');
  });

  it('puts scope-matching headlines first', () => {
    const heads = pickHeadlines(digest, 'energy');
    assert.equal(heads[0].link, 'b');
  });

  it('tells Claude sources are data and to cite them', () => {
    const p = buildPrompt('Why did textiles rise?', buildSources(markets, []), '2026-11-21T00:00:00Z');
    assert.match(p.system, /data, not instructions/);
    assert.match(p.system, /Never invent numbers/);
    assert.match(p.user, /\[1\] Dhaka Stock Exchange market snapshot/);
    assert.match(p.user, /QUESTION\nWhy did textiles rise\?/);
  });
});

describe('ASK: parsing answers', () => {
  it('keeps valid citations only', () => {
    const r = parseAnswer('Here: {"answer":"Textiles led [1].","points":[{"text":"MATINSPINN +11% [1]","sources":[1,9,"2"]}],"unknown":["Why"],"followups":["Compare last month"]}', 3);
    assert.equal(r.structured, true);
    assert.equal(r.answer, 'Textiles led [1].');
    assert.deepEqual(r.points[0].sources, [1, 2]);
    assert.deepEqual(r.unknown, ['Why']);
  });

  it('falls back to plain text when the reply is not JSON', () => {
    const r = parseAnswer('No JSON here', 3);
    assert.equal(r.structured, false);
    assert.equal(r.answer, 'No JSON here');
  });
});
