// BDSI terminal: Launchpad (Markets workspace). Four numbered panels:
// 1 DSE market monitor · 2 top Bangladesh news · 3 Bangladesh risk map · 4 Taka rates.

import type { Screen } from '../shell';
import { h, fmtNum, fmtInt, pct, arrow, signClass, dhakaTime, panel, sourceLine, stateBox } from '../dom';
import { markets, bdNews, unrest, fires, conflicts, boundaries, type NewsItem, type GeoEvent } from '../data';
import { drawRiskMap, type RiskMapLayers } from '../risk-map';
import { computeDistrictActivity, DistrictLocator, SCORE_FORMULA, type BdActivitySnapshot, type DistrictFeature } from '@/services/bd-district-activity';
import type { BdMarkets, BdMover } from '@/services/bd-markets';

const FX_NAMES: Record<string, string> = {
  USD: 'US dollar', EUR: 'Euro', GBP: 'British pound', INR: 'Indian rupee', SGD: 'Singapore dollar', CNH: 'Chinese yuan (off)',
  CNY: 'Chinese yuan', JPY: 'Japanese yen', AUD: 'Australian dollar', CAD: 'Canadian dollar', LKR: 'Sri Lankan rupee', SAR: 'Saudi riyal',
  AED: 'UAE dirham', MYR: 'Malaysian ringgit', SEK: 'Swedish krona', CHF: 'Swiss franc', HKD: 'Hong Kong dollar',
};
const FX_ORDER = ['USD', 'EUR', 'GBP', 'INR', 'SGD', 'CNH', 'JPY', 'AUD', 'CAD', 'LKR', 'SAR', 'AED', 'MYR'];

let lastNews: NewsItem[] = [];

/** Opens Launchpad news row n (1-based) in a new tab; false if there is no such row. */
export function openNewsRow(n: number): boolean {
  const item = lastNews[n - 1];
  if (!item) return false;
  window.open(item.link, '_blank', 'noopener,noreferrer');
  return true;
}

function dsePanel(d: BdMarkets | null, err: string | null): HTMLElement {
  const dse = d?.dse;
  const session = dse && !dse.error
    ? h('span', { class: dse.session.isOpen ? 'tp-up' : 'tp-down' }, dse.session.isOpen ? '● OPEN' : '● CLOSED')
    : null;
  let body: Node[];
  if (!dse || dse.error) {
    body = [stateBox(err || dse?.error ? 'error' : 'loading', err || dse?.error ? 'Dhaka Stock Exchange data unavailable right now.' : 'Loading Dhaka Stock Exchange…')];
  } else {
    const idx = h('table', { class: 'tp-table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'INDEX'), h('th', { class: 'r' }, 'LAST'), h('th', { class: 'r' }, 'NET CHG'), h('th', { class: 'r' }, '% CHG'))),
      h('tbody', {}, ...dse.indices.map((i) => h('tr', {},
        h('td', { class: 'tp-w' }, i.key),
        h('td', { class: 'r tp-w' }, fmtNum(i.value)),
        h('td', { class: `r tp-${signClass(i.change)}` }, `${arrow(i.change)} ${fmtNum(i.change == null ? null : Math.abs(i.change))}`),
        h('td', { class: `r tp-${signClass(i.percent)}` }, pct(i.percent))))));
    const b = dse.breadth;
    const stats = h('div', { class: 'tp-stats' },
      stat('TURNOVER', `৳${fmtNum(dse.totals.turnoverMn)} mn`),
      stat('VOLUME', fmtInt(dse.totals.volume)),
      stat('TRADES', fmtInt(dse.totals.trades)),
      h('div', {}, h('div', { class: 'tp-stat-k' }, 'ADV / DEC / UNCH'),
        h('div', {}, h('span', { class: 'tp-up' }, fmtInt(b.advanced)), ' / ', h('span', { class: 'tp-down' }, fmtInt(b.declined)), ' / ', h('span', { class: 'tp-w' }, fmtInt(b.unchanged)))));
    const movers = (label: string, list: BdMover[], up: boolean) =>
      h('table', { class: 'tp-table' },
        h('thead', {}, h('tr', {}, h('th', {}, label), h('th', { class: 'r' }, 'LTP'), h('th', { class: 'r' }, 'CHG'))),
        h('tbody', {}, ...list.slice(0, 6).map((m) => h('tr', {},
          h('td', {}, h('a', { href: `#/stock/${encodeURIComponent(m.code)}`, class: 'tp-tick' }, m.code)),
          h('td', { class: 'r' }, fmtNum(m.ltp)),
          h('td', { class: `r ${up ? 'tp-up' : 'tp-down'}` }, `${up ? '▲' : '▼'} ${fmtNum(m.percent == null ? null : Math.abs(m.percent))}%`)))));
    body = [
      idx, stats,
      h('div', { class: 'tp-split' }, movers('TOP GAINERS', dse.gainers, true), movers('TOP LOSERS', dse.losers, false)),
      sourceLine(`Source: Dhaka Stock Exchange${dse.totals.tradeTime ? ` · last trade ${dse.totals.tradeTime}` : ''} · checked ${dhakaTime(dse.updatedAt ?? Date.now())} DHK${dse.stale ? ' · STALE: source unreachable, last data shown' : ''}`),
    ];
  }
  return panel({ n: 1, title: 'DSE MARKET MONITOR', code: 'MMON', hint: 'DSE INDEX MMON', right: session ?? undefined }, ...body);
}

function stat(k: string, v: string, cls = 'tp-w'): HTMLElement {
  return h('div', {}, h('div', { class: 'tp-stat-k' }, k), h('div', { class: cls }, v));
}

function newsPanel(items: NewsItem[] | null, err: boolean): HTMLElement {
  let body: Node[];
  if (!items) body = [stateBox(err ? 'error' : 'loading', err ? 'News feed unavailable right now.' : 'Loading Bangladesh news…')];
  else if (items.length === 0) body = [stateBox('empty', 'No Bangladesh stories in the current news digest.')];
  else {
    body = [
      h('ol', { class: 'tp-news' }, ...items.slice(0, 12).map((n, i) => h('li', { class: n.isAlert ? 'tp-news-alert' : '' },
        h('span', { class: 'tp-muted' }, `${i + 1})`),
        h('span', { class: 'tp-muted' }, dhakaTime(n.publishedAt)),
        h('span', { class: 'tp-amber tp-ellipsis' }, n.source.toUpperCase().slice(0, 14)),
        h('a', { href: n.link, target: '_blank', rel: 'noopener noreferrer', lang: /[ঀ-৿]/.test(n.title) ? 'bn' : 'en' }, n.title)))),
      sourceLine('Red = alert · type <n> <GO> to open row n · Bangladeshi outlets and stories about Bangladesh, newest first'),
    ];
  }
  return panel({ n: 2, title: 'TOP NEWS — BANGLADESH', code: 'NEWS', hint: 'TOP BD NEWS' }, ...body);
}

interface MapState {
  layers: RiskMapLayers;
  snapshot: BdActivitySnapshot | null;
  events: { protests: GeoEvent[]; conflicts: GeoEvent[]; fires: GeoEvent[] };
  selected: { kind: 'district' | 'division'; id: string } | null;
}

function riskPanel(state: MapState, geo: Awaited<ReturnType<typeof boundaries>> | null, err: boolean, rerender: () => void): HTMLElement {
  const chip = (label: string, on: boolean, toggle: () => void) =>
    h('button', { type: 'button', class: `tp-chip${on ? ' on' : ''}`, 'aria-pressed': on ? 'true' : 'false', onclick: () => { toggle(); rerender(); } }, label);
  const L = state.layers;
  const chips = h('div', { class: 'tp-chips' },
    chip('DIVISIONS', L.shade === 'divisions', () => { L.shade = 'divisions'; }),
    chip('DISTRICTS', L.shade === 'districts', () => { L.shade = 'districts'; }),
    chip('PROTESTS', L.protests, () => { L.protests = !L.protests; }),
    chip('CONFLICT', L.conflicts, () => { L.conflicts = !L.conflicts; }),
    chip('FIRES', L.fires, () => { L.fires = !L.fires; }));
  let mapNode: Node;
  if (!geo) mapNode = stateBox(err ? 'error' : 'loading', err ? 'Map boundaries unavailable.' : 'Loading map…');
  else {
    mapNode = drawRiskMap({
      width: 520, height: 420, districts: geo.districts, divisions: geo.divisions, snapshot: state.snapshot, layers: L, events: state.events,
      onSelect: (kind, id) => { state.selected = { kind, id }; rerender(); },
    });
  }
  const s = state.snapshot;
  const sel = state.selected && s
    ? (state.selected.kind === 'district'
      ? s.districts.find((d) => d.id === state.selected!.id)
      : s.divisions.find((d) => d.name.toLowerCase() === state.selected!.id))
    : null;
  const top = s ? [...s.districts].filter((d) => d.score > 0).sort((a, b) => b.score - a.score).slice(0, 5) : [];
  const detail = sel
    ? h('div', { class: 'tp-sel' },
      h('b', { class: 'tp-amber' }, 'division' in sel ? `${sel.name} · ${sel.division} division` : `${sel.name} division`),
      ` · score ${Math.round(sel.score * 10) / 10} · news ${sel.news} · protests ${sel.protests} · conflict ${sel.conflicts}${sel.fatalities ? ` (${sel.fatalities} deaths)` : ''} · fires ${sel.fires}`,
      'headlines' in sel && sel.headlines.length
        ? h('ul', { class: 'tp-sel-heads' }, ...sel.headlines.map((x) => h('li', {}, h('a', { href: x.link, target: '_blank', rel: 'noopener noreferrer' }, x.title), h('span', { class: 'tp-muted' }, ` · ${x.source}`))))
        : null)
    : h('div', { class: 'tp-muted tp-sel' }, 'Click a district or division for details.');
  const stats = h('div', { class: 'tp-stats' },
    stat('BD STORIES 7D', s ? fmtInt(s.inputs.newsItems) : '—'),
    stat('PROTESTS 7D', s ? fmtInt(s.inputs.protestEvents) : '—'),
    stat('CONFLICT 30D', s ? fmtInt(s.inputs.conflictEvents) : '—'),
    stat('FIRES', s ? fmtInt(s.inputs.fireDetections) : '—'));
  const topList = top.length
    ? h('ol', { class: 'tp-toplist' }, ...top.map((d) => h('li', {},
      h('button', { type: 'button', class: 'tp-linkbtn', onclick: () => { state.selected = { kind: 'district', id: d.id }; L.shade = 'districts'; rerender(); } }, d.name),
      h('span', { class: 'tp-muted' }, ` ${d.division} · ${Math.round(d.score * 10) / 10}`))))
    : null;
  return panel({ n: 3, title: 'BANGLADESH RISK MAP', code: 'RISK', hint: 'RISK BD MAP', right: h('span', { class: 'tp-yellow' }, '7D') },
    chips,
    h('div', { class: 'tp-map-row' }, h('div', { class: 'tp-map' }, mapNode), h('div', { class: 'tp-map-side' }, h('div', { class: 'tp-stat-k' }, 'MOST ACTIVE DISTRICTS'), topList ?? h('div', { class: 'tp-muted' }, s ? 'No district activity yet.' : 'Computing…'), detail)),
    stats,
    sourceLine(`Activity, not a risk index. Score = ${SCORE_FORMULA}. Sources: BDSI news digest, GDELT unrest (unverified), UCDP, NASA FIRMS. Boundaries: BBS / OCHA via geoBoundaries (CC BY 3.0 IGO).${s ? ` Updated ${dhakaTime(s.computedAt)} DHK.` : ''}`));
}

function fxPanel(d: BdMarkets | null, err: boolean): HTMLElement {
  const fx = d?.fx;
  let body: Node[];
  if (!fx || fx.error) body = [stateBox(err || fx?.error ? 'error' : 'loading', err || fx?.error ? 'Taka rates unavailable right now.' : 'Loading Bangladesh Bank rates…')];
  else {
    const usd = fx.rates.find((r) => r.code === 'USD');
    const rows = [...fx.rates].sort((a, b) => {
      const ia = FX_ORDER.indexOf(a.code), ib = FX_ORDER.indexOf(b.code);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    }).slice(0, 12);
    body = [
      h('div', { class: 'tp-bigquote' }, h('span', { class: 'tp-amber' }, 'USD/BDT'), h('span', { class: 'tp-big' }, usd ? usd.mid.toFixed(4) : '—'),
        h('span', { class: 'tp-muted' }, fx.official === false ? 'market reference (not official)' : 'Bangladesh Bank')),
      h('table', { class: 'tp-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'CCY'), h('th', {}, 'NAME'), h('th', { class: 'r' }, 'RATE'), h('th', { class: 'r' }, 'BID'), h('th', { class: 'r' }, 'ASK'))),
        h('tbody', {}, ...rows.map((r) => h('tr', {},
          h('td', { class: 'tp-w' }, r.code), h('td', { class: 'tp-dim' }, FX_NAMES[r.code] ?? r.code),
          h('td', { class: 'r tp-w' }, r.mid.toFixed(4)), h('td', { class: 'r' }, r.bid.toFixed(4)), h('td', { class: 'r' }, r.ask.toFixed(4)))))),
      sourceLine(`Source: ${fx.official === false ? 'ExchangeRate-API (Bangladesh Bank unreachable)' : 'Bangladesh Bank'}${fx.asOf ? ` · rates effective ${fx.asOf}` : ''} · checked ${dhakaTime(fx.updatedAt ?? Date.now())} DHK${fx.stale ? ' · STALE' : ''}`),
    ];
  }
  return panel({ n: 4, title: 'TAKA RATES', code: 'FX', hint: 'BDT CURNCY FX' }, ...body);
}

export const launchpadScreen: Screen = {
  code: 'MMON',
  title: 'Launchpad',
  mount(el) {
    let alive = true;
    let mk: BdMarkets | null = null, mkErr = false;
    let news: NewsItem[] | null = null, newsErr = false;
    let geo: Awaited<ReturnType<typeof boundaries>> | null = null, geoErr = false;
    let locator: DistrictLocator | null = null;
    const mapState: MapState = { layers: { shade: 'divisions', protests: true, conflicts: true, fires: false }, snapshot: null, events: { protests: [], conflicts: [], fires: [] }, selected: null };

    const grid = h('div', { class: 'tp-grid' });
    el.append(grid);
    const slots = [1, 2, 3, 4].map(() => h('div', { class: 'tp-slot' }));
    grid.append(...slots);

    const render = (which?: number) => {
      if (!alive) return;
      const make = [
        () => dsePanel(mk, mkErr ? 'x' : null),
        () => newsPanel(news, newsErr),
        () => riskPanel(mapState, geo, geoErr, () => render(3)),
        () => fxPanel(mk, mkErr),
      ];
      for (let i = 0; i < 4; i++) {
        if (which && which !== i + 1) continue;
        const focused = slots[i]!.contains(document.activeElement);
        slots[i]!.replaceChildren(make[i]!());
        if (focused) slots[i]!.querySelector<HTMLElement>('.tp-panel')?.focus();
      }
    };
    render();

    const recompute = async () => {
      if (!locator || !news) return;
      const [p, c, f] = await Promise.all([unrest().catch(() => []), conflicts().catch(() => []), fires().catch(() => [])]);
      mapState.events = { protests: p, conflicts: c, fires: f };
      mapState.snapshot = computeDistrictActivity({
        news: news.map((n) => ({ title: n.title, link: n.link, source: n.source, pubDate: n.publishedAt })),
        protests: p, conflicts: c, fires: f,
      }, locator);
      render(3);
    };

    const loadMarkets = () => markets(true).then((d) => { mk = d; mkErr = false; }).catch(() => { mkErr = true; }).finally(() => { render(1); render(4); });
    const loadNews = () => bdNews().then((n) => { news = n; lastNews = n; newsErr = false; }).catch(() => { newsErr = true; }).finally(() => { render(2); void recompute(); });
    void loadMarkets();
    void loadNews();
    void boundaries().then((g) => {
      geo = g;
      locator = new DistrictLocator(g.districts.features as unknown as DistrictFeature[]);
    }).catch(() => { geoErr = true; }).finally(() => { render(3); void recompute(); });

    const t1 = window.setInterval(loadMarkets, 60_000);
    const t2 = window.setInterval(loadNews, 5 * 60_000);
    return () => { alive = false; window.clearInterval(t1); window.clearInterval(t2); };
  },
};

