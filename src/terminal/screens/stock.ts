// BDSI terminal: <TICKER> <GO> — DSE stock page (/api/bd-stock?code=…).

import type { Screen } from '../shell';
import { h, fmtNum, fmtInt, pct, signClass, arrow, dhakaTime, panel, sourceLine, stateBox } from '../dom';
import { allNews, setStatus } from '../data';

interface Quote { code: string; ltp: number | null; ycp: number | null; open: number | null; high: number | null; low: number | null; volume: number | null; valueMn: number | null; trades: number | null; percent: number | null; category: string | null; sector: string | null; board: string | null }
interface Company {
  name: string | null; sector: string | null; category: string | null; isin: string | null; listingYear: number | null; website: string | null;
  marketCap: number | null; freeFloatMarketCap: number | null; pe: number | null; eps: number | null; nav: number | null; dividendYield: number | null;
  faceValue: number | null; weekHigh52: number | null; weekLow52: number | null; yearEnd: string | null; agmDate: string | null; asOfDate: string | null;
  sharePattern: Array<{ date: string; pattern: Record<string, number> }> | null;
  dividendHistory: Array<{ year: number; cash: number | null; stock: number | null; yieldPct: number | null; rights: string | null }>;
  multiYearFinancials: Array<{ year: number; eps: number | null; nav: number | null; profitMn: number | null; pe: number | null }>;
}
interface StockData {
  code: string; quote: Quote | null; company: Company | null;
  disclosures: Array<{ id: string; type: string | null; date: string | null; time: string | null; summary: string; body: string }>;
  history: Array<[string, number, number | null]>;
  session: { isOpen?: boolean; sessionDate?: string } | null; sourceUrl: string; fetchedAt: string; stale: boolean;
}

function rangeBar(low: number | null, high: number | null, cur: number | null, label: string): HTMLElement {
  if (low == null || high == null || cur == null || high <= low) return h('div', { class: 'tp-muted' }, `${label}: —`);
  const pos = Math.max(0, Math.min(100, ((cur - low) / (high - low)) * 100));
  return h('div', { class: 'tp-range' },
    h('div', { class: 'tp-stat-k' }, label),
    h('div', { class: 'tp-range-bar', role: 'img', 'aria-label': `${label}: low ${fmtNum(low)}, high ${fmtNum(high)}, current ${fmtNum(cur)}` },
      h('span', { class: 'tp-range-mark', style: `left:${pos}%` })),
    h('div', { class: 'tp-range-ends' }, h('span', {}, fmtNum(low)), h('span', { class: 'tp-w' }, fmtNum(cur)), h('span', {}, fmtNum(high))));
}

function chart(history: StockData['history']): HTMLElement {
  if (history.length < 2) {
    return stateBox('empty', history.length === 1
      ? `Price history: 1 session archived (${history[0]![0]}). The chart fills in as BDSI archives each DSE session close.`
      : 'Price history: BDSI archives each DSE session close from 21 Nov 2026; the chart appears after two sessions.');
  }
  const W = 640, H = 200, P = 28;
  const vals = history.map((x) => x[1]);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => P + (i * (W - P * 2)) / (history.length - 1);
  const y = (v: number) => H - P - ((v - min) / span) * (H - P * 2);
  const d = history.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
  const up = vals[vals.length - 1]! >= vals[0]!;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'tp-chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Closing prices from ${history[0]![0]} to ${history[history.length - 1]![0]}: low ${fmtNum(min)}, high ${fmtNum(max)}`);
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', up ? '#5bd96b' : '#ff6b6b');
  path.setAttribute('stroke-width', '1.6');
  svg.append(path);
  for (const [v, yy] of [[max, y(max)], [min, y(min)]] as Array<[number, number]>) {
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', '2'); t.setAttribute('y', String(yy + 4)); t.setAttribute('fill', '#8c8c8c'); t.setAttribute('font-size', '10');
    t.textContent = fmtNum(v);
    svg.append(t);
  }
  return h('figure', { class: 'tp-chart-wrap' }, svg,
    h('figcaption', { class: 'tp-source' }, `Daily closes ${history[0]![0]} → ${history[history.length - 1]![0]} (${history.length} sessions, BDSI archive of DSE closes)`));
}

function keyword(name: string | null): string | null {
  const w = (name ?? '').replace(/\b(ltd|limited|plc|company|co|bangladesh|industries|the)\b\.?/gi, ' ').trim().split(/\s+/)[0] ?? '';
  return w.length >= 5 ? w : null;
}

export const stockScreen: Screen = {
  code: 'STOCK',
  title: 'Stock page',
  mount(el, args, ctx) {
    const code = (args[0] ?? 'GP').toUpperCase();
    let alive = true;
    const root = h('section', { class: 'tp-screen' }, stateBox('loading', `Loading ${code} from the Dhaka Stock Exchange…`));
    el.append(root);

    fetch(`/api/bd-stock?code=${encodeURIComponent(code)}`, { signal: AbortSignal.timeout(25_000) })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (r.status === 404) throw new Error(`${code} is not a Dhaka Stock Exchange code. Try SCRN <GO> to browse instruments.`);
        if (!r.ok) throw new Error('Dhaka Stock Exchange data is unavailable right now.');
        return j as StockData;
      })
      .then(async (d) => {
        if (!alive) return;
        setStatus('DSE', d.stale ? 'stale' : 'ok');
        const q = d.quote, c = d.company;
        const ltp = q?.ltp ?? null;
        const chg = q && q.ltp != null && q.ycp != null ? q.ltp - q.ycp : null;
        const head = h('header', { class: 'tp-stock-head' },
          h('span', { class: 'tp-logo-sm' }, code),
          h('div', {}, h('h1', { class: 'tp-stock-name' }, c?.name ?? code),
            h('div', { class: 'tp-muted' }, ['DSE', c?.sector ?? q?.sector, c?.category || q?.category ? `Category ${c?.category ?? q?.category}` : null, q?.board].filter(Boolean).join(' · '))),
          h('span', { class: 'tp-spacer' }),
          h('div', { class: 'tp-stock-px' },
            h('span', { class: 'tp-big' }, `৳ ${fmtNum(ltp)}`),
            h('span', { class: `tp-${signClass(chg)}` }, ` ${arrow(chg)} ${fmtNum(chg == null ? null : Math.abs(chg))} (${pct(q?.percent)})`),
            h('div', { class: 'tp-muted' }, d.session?.isOpen ? `live · ${dhakaTime(Date.parse(d.fetchedAt))} DHK` : `close of ${d.session?.sessionDate ?? '—'}${d.stale ? ' · STALE' : ''}`)));

        const stats = h('div', { class: 'tp-kv' }, ...([
          ['Prev close', fmtNum(q?.ycp)], ['Open', fmtNum(q?.open)], ['High', fmtNum(q?.high)], ['Low', fmtNum(q?.low)],
          ['Volume', fmtInt(q?.volume)], ['Value', q?.valueMn != null ? `৳${fmtNum(q.valueMn)} mn` : '—'], ['Trades', fmtInt(q?.trades)],
          ['Market cap', c?.marketCap != null ? `৳${fmtNum(c.marketCap / 1e6, 0)} mn` : '—'],
          ['Free float cap', c?.freeFloatMarketCap != null ? `৳${fmtNum(c.freeFloatMarketCap / 1e6, 0)} mn` : '—'],
          ['P/E (audited)', c?.pe != null ? `${fmtNum(c.pe)}x` : '—'], ['EPS', fmtNum(c?.eps)], ['NAV / share', fmtNum(c?.nav)],
          ['Dividend yield', c?.dividendYield != null ? `${fmtNum(c.dividendYield)}%` : '—'], ['Face value', fmtNum(c?.faceValue)],
          ['Year end', c?.yearEnd ?? '—'], ['AGM', c?.agmDate ?? '—'],
        ] as Array<[string, string]>).map(([k, v]) => h('div', {}, h('div', { class: 'tp-stat-k' }, k), h('div', { class: 'tp-w' }, v))));

        const fin = c?.multiYearFinancials?.length
          ? h('table', { class: 'tp-table' },
            h('thead', {}, h('tr', {}, h('th', {}, 'YEAR'), h('th', { class: 'r' }, 'EPS'), h('th', { class: 'r' }, 'NAV'), h('th', { class: 'r' }, 'PROFIT (৳ mn)'), h('th', { class: 'r' }, 'P/E'))),
            h('tbody', {}, ...c.multiYearFinancials.map((f) => h('tr', {}, h('td', {}, String(f.year)), h('td', { class: 'r' }, fmtNum(f.eps)), h('td', { class: 'r' }, fmtNum(f.nav)), h('td', { class: 'r' }, fmtNum(f.profitMn)), h('td', { class: 'r' }, fmtNum(f.pe))))))
          : stateBox('empty', 'No multi-year financials published on the DSE company page.');
        const divs = c?.dividendHistory?.length
          ? h('table', { class: 'tp-table' },
            h('thead', {}, h('tr', {}, h('th', {}, 'YEAR'), h('th', { class: 'r' }, 'CASH %'), h('th', { class: 'r' }, 'STOCK %'), h('th', { class: 'r' }, 'YIELD %'), h('th', {}, 'RIGHTS'))),
            h('tbody', {}, ...c.dividendHistory.map((x) => h('tr', {}, h('td', {}, String(x.year)), h('td', { class: 'r' }, fmtNum(x.cash, 0)), h('td', { class: 'r' }, fmtNum(x.stock, 0)), h('td', { class: 'r' }, fmtNum(x.yieldPct)), h('td', {}, x.rights || '—')))))
          : stateBox('empty', 'No dividend history on the DSE company page.');
        const latestPattern = c?.sharePattern?.length ? c.sharePattern[c.sharePattern.length - 1]! : null;
        const holders = latestPattern
          ? h('div', { class: 'tp-holders' }, ...Object.entries(latestPattern.pattern).map(([k, v]) => h('div', { class: 'tp-holder' },
            h('span', { class: 'tp-holder-k' }, k[0]!.toUpperCase() + k.slice(1)),
            h('span', { class: 'tp-holder-bar' }, h('span', { style: `width:${Math.max(0, Math.min(100, v))}%` })),
            h('span', { class: 'r tp-w' }, `${fmtNum(v)}%`))),
            sourceLine(`As on ${latestPattern.date}, as reported by the company to DSE.`))
          : stateBox('empty', 'No shareholding pattern published.');
        const disc = d.disclosures.length
          ? h('ul', { class: 'tp-disc' }, ...d.disclosures.map((x) => h('li', {}, h('div', { class: 'tp-amber' }, `${x.date ?? ''} ${x.time ?? ''} · ${x.type ?? ''}`), h('div', { class: 'tp-w' }, x.summary), h('div', { class: 'tp-dim' }, x.body))))
          : h('p', { class: 'tp-muted' }, 'No price-sensitive disclosure from this company today.');

        const word = keyword(c?.name ?? null);
        const newsBox = h('div', {}, stateBox('loading', 'Looking for related news…'));
        void allNews().then((items) => {
          const re = new RegExp(`(?<![\\p{L}])(${[code, word].filter(Boolean).map((x) => x!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}])`, 'iu');
          const hits = items.filter((n) => re.test(n.title)).slice(0, 8);
          newsBox.replaceChildren(hits.length
            ? h('ul', { class: 'tp-disc' }, ...hits.map((n) => h('li', {}, h('a', { href: n.link, target: '_blank', rel: 'noopener noreferrer' }, n.title), h('span', { class: 'tp-muted' }, ` · ${n.source} · ${dhakaTime(n.publishedAt)}`))))
            : h('p', { class: 'tp-muted' }, `No stories mentioning ${word ?? code} in the current news digest.`));
        }).catch(() => newsBox.replaceChildren(stateBox('error', 'News unavailable right now.')));

        const askQ = `What is the latest on ${c?.name ?? code} (${code})? Use its DSE price and any news or disclosures.`;
        const grid = h('div', { class: 'tp-grid' },
          h('div', { class: 'tp-slot' }, panel({ n: 1, title: 'DESCRIPTION AND KEY STATISTICS', code: 'DES', hint: `${code} DES` },
            stats, rangeBar(q?.low ?? null, q?.high ?? null, ltp, "Day's range"), rangeBar(c?.weekLow52 ?? null, c?.weekHigh52 ?? null, ltp, '52-week range'),
            sourceLine(`Source: Dhaka Stock Exchange company page${c?.asOfDate ? ` · as on ${c.asOfDate}` : ''}${c?.isin ? ` · ISIN ${c.isin}` : ''}${c?.listingYear ? ` · listed ${c.listingYear}` : ''}`))),
          h('div', { class: 'tp-slot' }, panel({ n: 2, title: 'PRICE CHART', code: 'GP', hint: `${code} GP` }, chart(d.history),
            h('button', { type: 'button', class: 'tp-chip on', onclick: () => ctx.go('ask', { query: askQ }) }, `ASK AI ABOUT ${code}`))),
          h('div', { class: 'tp-slot' }, panel({ n: 3, title: 'FINANCIALS AND DIVIDENDS', code: 'FA', hint: `${code} FA` }, fin, divs, sourceLine('Source: Dhaka Stock Exchange company page (audited figures; EPS and NAV in ৳; cash/stock dividend in % of face value).'))),
          h('div', { class: 'tp-slot' }, panel({ n: 4, title: 'HOLDERS, DISCLOSURES AND NEWS', code: 'CN', hint: `${code} CN` },
            holders,
            h('div', { class: 'tp-stat-k' }, "TODAY'S DSE DISCLOSURES"), disc,
            h('a', { href: d.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, 'All disclosures on dse.com.bd ↗'),
            h('div', { class: 'tp-stat-k' }, 'RELATED NEWS'), newsBox)));
        root.replaceChildren(head, grid);
      })
      .catch((e: Error) => { if (alive) root.replaceChildren(stateBox('error', e.message)); });
    return () => { alive = false; };
  },
};
