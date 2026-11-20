// BDSI terminal: ECO BD — Bangladesh economy: Bangladesh Bank taka rates, Dhaka
// retail prices (TCB), DSE daily market history and economy news. Feeds that are
// not connected yet (policy rates, reserves, circulars, T-bill auctions, release
// calendar) are shown as such, never with placeholder numbers.

import type { Screen } from '../shell';
import { h, fmtNum, fmtInt, pct, signClass, dhakaTime, panel, sourceLine, stateBox } from '../dom';
import { markets, allNews, type NewsItem } from '../data';
import { unitEn, type BdMarkets } from '@/services/bd-markets';

interface IndexDay { date: string; dsex: number; dses: number; ds30: number; trades: number | null; volume: number | null; turnoverMn: number | null }

const ECON_NEWS = /\b(econom|inflation|gdp|export|import|remittance|reserve|budget|imf|world bank|adb|bangladesh bank|central bank|interest rate|policy rate|repo|treasury|t-bill|bond|tax|vat|revenue|tariff|trade deficit|dollar|taka|exchange rate|lc |letter of credit)|অর্থনীতি|মূল্যস্ফীতি|রপ্তানি|আমদানি|রেমিট্যান্স|রিজার্ভ|বাজেট|বাংলাদেশ ব্যাংক|ডলার|টাকা/i;

function sparkline(values: number[], label: string): SVGSVGElement | HTMLElement {
  if (values.length < 2) return h('span', { class: 'tp-muted' }, '—');
  const W = 560, H = 120, P = 6;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${(P + (i * (W - 2 * P)) / (values.length - 1)).toFixed(1)},${(H - P - ((v - min) / span) * (H - 2 * P)).toFixed(1)}`).join('');
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'tp-chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${label}: from ${fmtNum(values[0])} to ${fmtNum(values[values.length - 1])}, low ${fmtNum(min)}, high ${fmtNum(max)}`);
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#ffb000'); p.setAttribute('stroke-width', '1.6');
  svg.append(p);
  return svg;
}

const NOT_CONNECTED: Array<[string, string]> = [
  ['Policy (repo) rate, SDF, SLF', 'Bangladesh Bank monetary policy page'],
  ['Gross reserves and BPM6 reserves', 'Bangladesh Bank weekly reserves release'],
  ['Latest circulars (DOS, FEPD, MPD…)', 'Bangladesh Bank circulars list'],
  ['T-bill / T-bond auction cut-offs and yield curve', 'Bangladesh Bank auction results'],
  ['Release calendar: CPI, GDP, exports, remittance', 'BBS, EPB and Bangladesh Bank release schedules'],
];

export const economyScreen: Screen = {
  code: 'ECO',
  title: 'Economy',
  mount(el) {
    let alive = true;
    const fxBox = h('div', {}, stateBox('loading', 'Loading Bangladesh Bank rates…'));
    const bazaarBox = h('div', {}, stateBox('loading', 'Loading TCB prices…'));
    const mktBox = h('div', {}, stateBox('loading', 'Loading DSE daily history…'));
    const newsBox = h('div', {}, stateBox('loading', 'Loading economy news…'));

    el.append(h('section', { class: 'tp-screen' },
      h('header', { class: 'tp-screen-head' }, h('span', { class: 'tp-logo-sm' }, 'ECO'), h('h1', {}, 'BANGLADESH ECONOMY · BANGLADESH BANK · PRICES · MARKETS')),
      h('div', { class: 'tp-grid' },
        h('div', { class: 'tp-slot' }, panel({ n: 1, title: 'BANGLADESH BANK — TAKA RATES', code: 'BB', hint: 'BB FX' }, fxBox,
          h('div', { class: 'tp-stat-k' }, 'NOT CONNECTED YET'),
          h('ul', { class: 'tp-nc' }, ...NOT_CONNECTED.map(([what, src]) => h('li', {}, h('span', { class: 'tp-w' }, what), h('span', { class: 'tp-muted' }, ` — planned source: ${src}`)))))),
        h('div', { class: 'tp-slot' }, panel({ n: 2, title: 'DHAKA PRICES — ESSENTIALS', code: 'BAZAR', hint: 'BAZAR' }, bazaarBox)),
        h('div', { class: 'tp-slot' }, panel({ n: 3, title: 'DSE — DAILY MARKET HISTORY', code: 'MMON', hint: 'DSEX HIST' }, mktBox)),
        h('div', { class: 'tp-slot' }, panel({ n: 4, title: 'ECONOMY NEWS', code: 'NEWS', hint: 'ECO NEWS' }, newsBox)))));

    markets().then((d: BdMarkets) => {
      if (!alive) return;
      const fx = d.fx;
      fxBox.replaceChildren(fx && !fx.error
        ? h('div', {},
          h('div', { class: 'tp-bigquote' }, h('span', { class: 'tp-amber' }, 'USD/BDT'), h('span', { class: 'tp-big' }, fmtNum(fx.rates.find((r) => r.code === 'USD')?.mid ?? null, 4)),
            h('span', { class: 'tp-muted' }, fx.official === false ? 'market reference (Bangladesh Bank unreachable)' : 'official, Bangladesh Bank')),
          h('div', { class: 'tp-table-scroll tp-short' }, h('table', { class: 'tp-table' },
            h('thead', {}, h('tr', {}, h('th', {}, 'CCY'), h('th', { class: 'r' }, 'MID'), h('th', { class: 'r' }, 'BID'), h('th', { class: 'r' }, 'ASK'))),
            h('tbody', {}, ...fx.rates.map((r) => h('tr', {}, h('td', { class: 'tp-w' }, r.code), h('td', { class: 'r tp-w' }, r.mid.toFixed(4)), h('td', { class: 'r' }, r.bid.toFixed(4)), h('td', { class: 'r' }, r.ask.toFixed(4))))))),
          sourceLine(`Source: ${fx.official === false ? 'ExchangeRate-API' : 'Bangladesh Bank'}${fx.asOf ? ` · effective ${fx.asOf}` : ''}${fx.stale ? ' · STALE' : ''}`))
        : stateBox('error', 'Taka rates unavailable right now.'));
      const bz = d.bazaar;
      bazaarBox.replaceChildren(bz && !bz.error
        ? h('div', {},
          h('div', { class: 'tp-table-scroll' }, h('table', { class: 'tp-table' },
            h('thead', {}, h('tr', {}, h('th', {}, 'ITEM'), h('th', {}, 'UNIT'), h('th', { class: 'r' }, 'TODAY ৳'), h('th', { class: 'r' }, '1 WK'), h('th', { class: 'r' }, '1 MO'), h('th', { class: 'r' }, '1 YR'))),
            h('tbody', {}, ...bz.items.map((it) => h('tr', {},
              h('td', { lang: 'bn' }, it.name), h('td', { class: 'tp-muted' }, unitEn(it.unit)),
              h('td', { class: 'r tp-w' }, it.low === it.high ? fmtInt(it.low) : `${fmtInt(it.low)}–${fmtInt(it.high)}`),
              h('td', { class: `r tp-${signClass(it.weekChangePct)}` }, pct(it.weekChangePct)),
              h('td', { class: `r tp-${signClass(it.monthChangePct)}` }, pct(it.monthChangePct)),
              h('td', { class: `r tp-${signClass(it.yearChangePct)}` }, pct(it.yearChangePct))))))),
          sourceLine(`Source: Trading Corporation of Bangladesh, Dhaka retail prices${bz.date ? ` · ${bz.date}` : ''} · changes compare range midpoints${bz.stale ? ' · STALE' : ''}`))
        : stateBox('error', 'TCB prices unavailable right now.'));
    }).catch(() => { if (alive) { fxBox.replaceChildren(stateBox('error', 'Taka rates unavailable right now.')); bazaarBox.replaceChildren(stateBox('error', 'TCB prices unavailable right now.')); } });

    fetch('/api/bd-stock?indices=1', { signal: AbortSignal.timeout(25_000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { days: IndexDay[] }) => {
        if (!alive) return;
        const days = j.days;
        if (!days.length) { mktBox.replaceChildren(stateBox('empty', 'No DSE daily history yet.')); return; }
        const last = days[days.length - 1]!;
        mktBox.replaceChildren(
          sparkline(days.map((d) => d.dsex), 'DSEX daily closes'),
          h('p', { class: 'tp-source' }, `DSEX daily closes ${days[0]!.date} → ${last.date} (${days.length} sessions)`),
          h('div', { class: 'tp-table-scroll tp-short' }, h('table', { class: 'tp-table' },
            h('thead', {}, h('tr', {}, h('th', {}, 'DATE'), h('th', { class: 'r' }, 'DSEX'), h('th', { class: 'r' }, 'DS30'), h('th', { class: 'r' }, 'DSES'), h('th', { class: 'r' }, 'TURNOVER ৳MN'), h('th', { class: 'r' }, 'TRADES'))),
            h('tbody', {}, ...[...days].reverse().slice(0, 30).map((d) => h('tr', {},
              h('td', {}, d.date), h('td', { class: 'r tp-w' }, fmtNum(d.dsex)), h('td', { class: 'r' }, fmtNum(d.ds30)), h('td', { class: 'r' }, fmtNum(d.dses)),
              h('td', { class: 'r' }, fmtNum(d.turnoverMn)), h('td', { class: 'r' }, fmtInt(d.trades))))))),
          sourceLine('Source: Dhaka Stock Exchange, recent market information (archived daily by BDSI)'));
      })
      .catch(() => { if (alive) mktBox.replaceChildren(stateBox('error', 'DSE daily history unavailable right now.')); });

    allNews().then((items: NewsItem[]) => {
      if (!alive) return;
      const eco = items.filter((n) => ECON_NEWS.test(n.title) && /bangladesh|dhaka|taka|bdt|বাংলাদেশ|ঢাকা|টাকা/i.test(`${n.title} ${n.source}`) || (ECON_NEWS.test(n.title) && /[ঀ-৿]/.test(n.title)));
      newsBox.replaceChildren(eco.length
        ? h('ul', { class: 'tp-disc' }, ...eco.slice(0, 16).map((n) => h('li', {}, h('a', { href: n.link, target: '_blank', rel: 'noopener noreferrer' }, n.title), h('span', { class: 'tp-muted' }, ` · ${n.source} · ${dhakaTime(n.publishedAt)}`))))
        : stateBox('empty', 'No Bangladesh economy stories in the current digest.'),
      sourceLine('BDSI news digest, matched by economy keywords (English and Bangla).'));
    }).catch(() => { if (alive) newsBox.replaceChildren(stateBox('error', 'News unavailable right now.')); });

    return () => { alive = false; };
  },
};
