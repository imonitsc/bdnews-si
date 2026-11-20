import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectBangladeshNews, isBangladeshNews } from '../src/config/bangladesh-news.ts';

const item = (source: string, title: string, link: string, iso: string) => ({ source, title, link, pubDate: new Date(iso) });

describe('Bangladesh News panel selection', () => {
  it('keeps Bangladeshi outlets and stories about Bangladesh', () => {
    assert.equal(isBangladeshNews({ source: 'Jugantor', title: 'যেকোনো শিরোনাম' }), true);
    assert.equal(isBangladeshNews({ source: 'Reuters World', title: 'Floods hit northern Bangladesh' }), true);
    assert.equal(isBangladeshNews({ source: 'BBC World', title: 'ঢাকায় বৃষ্টি' }), true);
    assert.equal(isBangladeshNews({ source: 'BBC World', title: 'Tokyo markets close higher' }), false);
  });

  it('merges categories newest first, drops duplicates and skips its own bucket', () => {
    const shared = item('The Daily Star', 'Dhaka traffic', 'https://x/1', '2026-11-20T10:00:00Z');
    const out = collectBangladeshNews({
      asia: [shared, item('Japan Times', 'Yen moves', 'https://x/2', '2026-11-20T12:00:00Z')],
      politics: [shared, item('AP News', 'Bangladesh election date set', 'https://x/3', '2026-11-20T11:00:00Z')],
      bangladesh: [item('Dhaka Post', 'stale', 'https://x/4', '2026-11-20T13:00:00Z')],
    });
    assert.deepEqual(out.map((n) => n.link), ['https://x/3', 'https://x/1']);
  });

  it('stores the Bangladesh list even before its lazily mounted panel exists', () => {
    // The panel backfills from newsByCategory.bangladesh when it mounts; gating the update on the
    // panel's existence left a late-mounting panel empty until the next 20-minute refresh.
    const src = readFileSync(new URL('../src/app/data-loader.ts', import.meta.url), 'utf8');
    const block = src.slice(src.indexOf('renderNewsForCategory(category: string'), src.indexOf('const filteredItems = this.filterItemsByTimeRange(items);'));
    assert.match(block, /collectBangladeshNews\(this\.ctx\.newsByCategory\)/);
    assert.doesNotMatch(block, /newsPanels\[BANGLADESH_NEWS_PANEL_KEY\]/);
  });
});
