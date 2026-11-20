// bdnews SI: the Bangladesh News panel. It has no feed category of its own; it collects, from every
// news category already loaded, the stories that come from a Bangladeshi outlet or are about Bangladesh.

export const BANGLADESH_NEWS_PANEL_KEY = 'bangladesh';

export const BANGLADESH_NEWS_SOURCES: ReadonlySet<string> = new Set([
  'The Daily Star', 'Dhaka Tribune', 'Prothom Alo', 'bdnews24',
  'The Business Standard', 'New Age Bangladesh', 'Financial Express BD', 'UNB Bangladesh', 'Prothom Alo English',
  'Kaler Kantho', 'Jugantor', 'Samakal', 'The Daily Ittefaq', 'Bangla Tribune', 'Bangladesh Pratidin',
  'Jago News 24', 'Dhaka Post',
]);

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
