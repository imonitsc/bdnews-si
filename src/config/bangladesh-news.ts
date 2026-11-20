// bdnews SI: the Bangladesh News panel. It has no feed category of its own; it collects, from every
// news category already loaded, the stories that come from a Bangladeshi outlet or are about Bangladesh.

import { BANGLADESH_SOURCE_NAMES } from '../../shared/bangladesh-sources.js';

export const BANGLADESH_NEWS_PANEL_KEY = 'bangladesh';

export const BANGLADESH_NEWS_SOURCES: ReadonlySet<string> = new Set(BANGLADESH_SOURCE_NAMES);

const BANGLADESH_TOPIC = /\b(bangladesh|bangladeshi|dhaka|chattogram|chittagong|sylhet|khulna|rajshahi|rohingya|cox'?s bazar|teesta|padma)\b|বাংলাদেশ|ঢাকা/i;

export function isBangladeshNews(item: { source: string; title: string }): boolean {
  return BANGLADESH_NEWS_SOURCES.has(item.source) || BANGLADESH_TOPIC.test(item.title);
}

/** Newest first, one row per link, from every loaded category except the panel's own. */
export function collectBangladeshNews<T extends { source: string; title: string; link: string; pubDate: Date }>(
  byCategory: Record<string, T[] | undefined>,
  limit = 150,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const [category, items] of Object.entries(byCategory)) {
    if (category === BANGLADESH_NEWS_PANEL_KEY || !items) continue;
    for (const item of items) {
      const key = item.link || `${item.source}|${item.title}`;
      if (seen.has(key) || !isBangladeshNews(item)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  out.sort((a, b) => (b.pubDate?.getTime?.() ?? 0) - (a.pubDate?.getTime?.() ?? 0));
  return out.slice(0, limit);
}
