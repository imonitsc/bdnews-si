// BDSI terminal: WORLD — the global picture around Bangladesh.
// Live: world headlines by region (BDSI news digest), country instability
// scores and travel advisories, active natural hazards worldwide.
// World market quotes need a market-data key on the server; until then the
// panel says so and shows finance and commodity headlines instead.

import type { Screen } from '../shell';
import { h, dhakaTime, panel, sourceLine, stateBox } from '../dom';
import { allNews, setStatus, type NewsItem } from '../data';

export const REGIONS: Array<{ key: string; label: string; cats: string[] }> = [
  { key: 'top', label: 'TOP', cats: ['crisis', 'politics', 'asia', 'middleeast', 'europe', 'us', 'africa', 'latam', 'intel'] },
  { key: 'asia', label: 'ASIA', cats: ['asia'] },
  { key: 'me', label: 'MIDDLE EAST', cats: ['middleeast'] },
  { key: 'eu', label: 'EUROPE', cats: ['europe'] },
  { key: 'us', label: 'US', cats: ['us', 'politics', 'gov'] },
  { key: 'af', label: 'AFRICA', cats: ['africa'] },
  { key: 'la', label: 'LATIN AMERICA', cats: ['latam'] },
];

/** Headlines for one region: alerts first, then newest. Pure; exported for tests. */
export function regionNews(items: NewsItem[], cats: string[], limit = 15): NewsItem[] {
  const set = new Set(cats);
  return items.filter((n) => set.has(n.category))
    .sort((a, b) => Number(b.isAlert) - Number(a.isAlert) || b.publishedAt - a.publishedAt)
    .slice(0, limit);
}

interface Cii { region: string; staticBaseline: number; dynamicScore: number; combinedScore: number; advisoryLevel?: string; computedAt?: number }
interface Hazard { title: string; category: string; categoryTitle?: string; date: number; magnitude?: number; magnitudeUnit?: string; sourceUrl?: string; sourceName?: string; closed?: boolean }

const ADVISORY: Record<string, string> = { 'do-not-travel': 'DO NOT TRAVEL', reconsider: 'RECONSIDER', caution: 'CAUTION', normal: 'NORMAL' };
const countryName = (() => {
  let dn: Intl.DisplayNames | null = null;
  try { dn = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { dn = null; }
  return (code: string): string => { try { return dn?.of(code) ?? code; } catch { return code; } };
})();

function newsList(items: NewsItem[]): HTMLElement {
  return h('ol', { class: 'tp-wnews' }, ...items.map((n) => h('li', { class: n.isAlert ? 'tp-walert' : '' },
    h('span', { class: 'tp-muted' }, `${dhakaTime(n.publishedAt)} `),
    h('a', { href: n.link, target: '_blank', rel: 'noopener noreferrer' }, n.title),
    h('span', { class: 'tp-muted' }, ` · ${n.source}`))));
}

export const worldScreen: Screen = {
  code: 'WORLD',
  title: 'World',
  mount(el) {
    let alive = true;
    let region = REGIONS[0]!;
    let news: NewsItem[] | null = null;
    const chips = h('div', { class: 'tp-chips' });
    const newsBox = h('div', {}, stateBox('loading', 'Loading world headlines…'));
    const riskBox = h('div', {}, stateBox('loading', 'Loading country risk…'));
    const hazBox = h('div', {}, stateBox('loading', 'Loading natural hazards…'));
    const mktBox = h('div', {}, stateBox('loading', 'Loading world markets…'));

    const renderNews = (): void => {
      chips.replaceChildren(...REGIONS.map((r) => {
        const b = h('button', { type: 'button', class: `tp-chip${r.key === region.key ? ' on' : ''}` }, r.label);
        b.addEventListener('click', () => { region = r; renderNews(); });
        return b;
      }));
      if (!news) return;
      const rows = regionNews(news, region.cats);
      newsBox.replaceChildren(rows.length ? newsList(rows) : stateBox('empty', 'No headlines for this region in the current digest.'),
        sourceLine('BDSI news digest (wire services and international outlets). Red = alert. Times are Dhaka time.'));
    };

    el.append(h('section', { class: 'tp-screen' },
      h('header', { class: 'tp-screen-head' }, h('span', { class: 'tp-logo-sm' }, 'WORLD'), h('h1', {}, 'WORLD — HEADLINES, RISK, HAZARDS, MARKETS'),
        h('a', { href: '/dashboard', class: 'tp-muted', style: 'margin-left:auto' }, 'Full world map ↗')),
      h('div', { class: 'tp-grid' },
        h('div', { class: 'tp-slot' }, panel({ n: 1, title: 'WORLD HEADLINES', code: 'WNEWS', hint: 'WORLD NEWS' }, chips, newsBox)),
        h('div', { class: 'tp-slot' }, panel({ n: 2, title: 'COUNTRIES ON WATCH', code: 'WRISK', hint: 'WORLD RISK' }, riskBox)),
        h('div', { class: 'tp-slot' }, panel({ n: 3, title: 'NATURAL HAZARDS WORLDWIDE', code: 'WHAZ', hint: 'WORLD HAZARDS' }, hazBox)),
        h('div', { class: 'tp-slot' }, panel({ n: 4, title: 'WORLD MARKETS', code: 'WMKT', hint: 'WORLD MKT' }, mktBox)))));
    renderNews();

    void allNews().then((items) => { if (!alive) return; news = items; renderNews(); fillMarkets(items); })
      .catch(() => { if (alive) { newsBox.replaceChildren(stateBox('error', 'World headlines unavailable right now.')); fillMarkets(null); } });

    const fillMarkets = (items: NewsItem[] | null): void => {
      void fetch('/api/market/v1/list-market-quotes', { signal: AbortSignal.timeout(20_000) })
        .then((r) => (r.ok ? r.json() : { quotes: [] }))
        .catch(() => ({ quotes: [] }))
        .then((j: { quotes?: Array<{ symbol: string; name?: string; display?: string; price: number; change: number }>; asOf?: string }) => {
          if (!alive) return;
          const quotes = (j.quotes ?? []).filter((q) => Number.isFinite(q.price));
          const fin = items ? regionNews(items, ['finance', 'commodities', 'energy'], 10) : [];
          mktBox.replaceChildren(
            quotes.length
              ? h('table', { class: 'tp-table' }, h('tr', {}, h('th', {}, 'SYMBOL'), h('th', {}, 'PRICE'), h('th', {}, 'CHG %')),
                ...quotes.slice(0, 14).map((q) => h('tr', {}, h('td', {}, q.display || q.name || q.symbol), h('td', {}, q.price.toLocaleString('en-US', { maximumFractionDigits: 2 })),
                  h('td', { class: q.change >= 0 ? 'tp-up' : 'tp-down' }, `${q.change >= 0 ? '+' : ''}${q.change.toFixed(2)}%`))))
              : stateBox('planned', 'World index, commodity and crypto quotes are not connected yet: the server has no market-data provider key. Bangladesh markets are on F1, F2 and the Launchpad.'),
            ...(quotes.length ? [sourceLine(`Market quotes${j.asOf ? ` as of ${j.asOf}` : ''}.`)] : []),
            h('div', { class: 'tp-stat-k' }, 'FINANCE, COMMODITIES AND ENERGY HEADLINES'),
            fin.length ? newsList(fin) : h('p', { class: 'tp-muted' }, 'No finance headlines in the current digest.'));
        });
    };

    void fetch('/api/intelligence/v1/get-risk-scores', { signal: AbortSignal.timeout(20_000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { ciiScores?: Cii[]; stale?: boolean; degraded?: boolean }) => {
        if (!alive) return;
        const rows = (j.ciiScores ?? []).slice().sort((a, b) => b.combinedScore - a.combinedScore).slice(0, 15);
        const liveInputs = rows.some((r) => r.dynamicScore > 0);
        setStatus('Country risk', liveInputs && !j.stale ? 'ok' : 'stale');
        riskBox.replaceChildren(
          !liveInputs || j.stale || j.degraded ? h('p', { class: 'tp-wstale' }, 'LIMITED — live event inputs are not feeding the scores right now, so they mostly reflect each country\'s baseline.') : '',
          rows.length ? h('table', { class: 'tp-table' }, h('tr', {}, h('th', {}, 'COUNTRY'), h('th', {}, 'SCORE'), h('th', {}, 'LIVE'), h('th', {}, 'TRAVEL ADVISORY')),
            ...rows.map((r) => h('tr', {}, h('td', { class: 'tp-w' }, countryName(r.region)), h('td', {}, String(Math.round(r.combinedScore))), h('td', { class: 'tp-muted' }, String(Math.round(r.dynamicScore))),
              h('td', { class: r.advisoryLevel === 'do-not-travel' ? 'tp-down' : 'tp-muted' }, ADVISORY[r.advisoryLevel ?? ''] ?? '—'))))
            : stateBox('empty', 'No country scores available.'),
          sourceLine('Country instability index (0–100), inherited from World Monitor (methodology v14): baseline plus live news, conflict and military signals. Advisories from government travel sites.'));
      })
      .catch(() => { setStatus('Country risk', 'error'); if (alive) riskBox.replaceChildren(stateBox('error', 'Country risk scores unavailable right now.')); });

    void fetch('/api/natural/v1/list-natural-events', { signal: AbortSignal.timeout(20_000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { events?: Hazard[] }) => {
        if (!alive) return;
        const ev = (j.events ?? []).filter((e) => !e.closed).sort((a, b) => b.date - a.date).slice(0, 18);
        hazBox.replaceChildren(
          ev.length ? h('ul', { class: 'tp-disc' }, ...ev.map((e) => h('li', {},
            h('span', { class: 'tp-stat-k' }, `${(e.categoryTitle || e.category).toUpperCase()} `),
            e.sourceUrl ? h('a', { href: e.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, e.title) : e.title,
            h('span', { class: 'tp-muted' }, ` · ${e.magnitude ? `${e.magnitude} ${e.magnitudeUnit ?? ''} · ` : ''}${e.sourceName ?? ''}${e.date ? ` · ${dhakaTime(e.date)}` : ''}`))))
            : stateBox('empty', 'No active natural hazards reported.'),
          sourceLine('NASA EONET and GDACS. Open events only, newest first.'));
      })
      .catch(() => { if (alive) hazBox.replaceChildren(stateBox('error', 'Natural hazard feed unavailable right now.')); });

    return () => { alive = false; };
  },
};
