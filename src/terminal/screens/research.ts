// BDSI terminal: RSRCH — sector research. RMG (garments/textiles) by default;
// any DSE sector via rsrch/<SECTOR>. Listed stocks from the DSE price list,
// news and risk signals from the BDSI digest, AI brief via ASK.

import type { Screen } from '../shell';
import { h, fmtNum, fmtInt, pct, signClass, dhakaTime, panel, sourceLine, stateBox } from '../dom';
import { allNews, setStatus, type NewsItem } from '../data';
import type { Row } from './screener';

interface SectorPreset { id: string; label: string; dseSectors: string[]; news: RegExp; risks: Array<{ label: string; re: RegExp }> }

export const SECTOR_PRESETS: SectorPreset[] = [
  {
    id: 'RMG', label: 'RMG — garments and textiles', dseSectors: ['Textile'],
    news: /\b(garment|apparel|rmg|textile|knitwear|bgmea|bkmea|spinning|denim|fashion export)|পোশাক|গার্মেন্টস|তৈরি পোশাক|বস্ত্র/i,
    risks: [
      { label: 'Factory unrest', re: /\b(unrest|protest|strike|agitation|vandal|clash|wage protest|demonstrat)|বিক্ষোভ|আন্দোলন|শ্রমিক অসন্তোষ/i },
      { label: 'Wage board', re: /\b(wage|minimum pay|salary)|মজুরি|বেতন/i },
      { label: 'Orders and buyers', re: /\b(order|buyer|brand|tariff|duty|gsp|export earning)|ক্রয়াদেশ|শুল্ক/i },
      { label: 'Ports and logistics', re: /\b(port|chattogram|chittagong|container|shipment|freight)|বন্দর|কনটেইনার/i },
    ],
  },
  {
    id: 'BANK', label: 'Banks', dseSectors: ['Bank'],
    news: /\b(bank|banking|npl|default loan|bangladesh bank|liquidity|deposit|merger)|ব্যাংক|খেলাপি ঋণ/i,
    risks: [
      { label: 'Bad loans', re: /\b(npl|default|classified loan|non-performing)|খেলাপি/i },
      { label: 'Mergers / restructuring', re: /\b(merger|merge|restructur|board dissolved|administrator)|একীভূত/i },
      { label: 'Liquidity', re: /\b(liquidity|deposit|withdraw|cash crunch)|তারল্য/i },
    ],
  },
  {
    id: 'PHARMA', label: 'Pharmaceuticals and chemicals', dseSectors: ['PharmaChem'],
    news: /\b(pharma|pharmaceutical|medicine|drug|api park|chemical)|ওষুধ/i,
    risks: [{ label: 'Prices and regulation', re: /\b(price|dgda|regulat|patent|trips)|দাম/i }],
  },
  {
    id: 'POWER', label: 'Fuel and power', dseSectors: ['FuelPower'],
    news: /\b(power|electricity|load.?shedding|gas|lng|fuel|energy|petrobangla|bpdb)|বিদ্যুৎ|গ্যাস|জ্বালানি/i,
    risks: [{ label: 'Supply shortfall', re: /\b(load.?shedding|shortage|outage|crisis)|লোডশেডিং|সংকট/i }, { label: 'Tariffs and prices', re: /\b(tariff|price hike|subsid)|দাম/i }],
  },
  {
    id: 'TELECOM', label: 'Telecommunication', dseSectors: ['Telecom'],
    news: /\b(telecom|grameenphone|robi|banglalink|teletalk|btrc|mobile operator|internet|broadband|spectrum)|টেলিকম|ইন্টারনেট/i,
    risks: [{ label: 'Regulation (BTRC)', re: /\b(btrc|regulat|spectrum|licen)/i }, { label: 'Internet shutdowns', re: /\b(shutdown|blackout|throttl|internet cut)/i }],
  },
];

/** Sector KPIs from price rows (pure; exported for tests). */
export function sectorStats(rows: Row[]) {
  const traded = rows.filter((r) => (r.trades ?? 0) > 0 && r.percent != null);
  const avg = traded.length ? traded.reduce((s, r) => s + (r.percent ?? 0), 0) / traded.length : null;
  return {
    listed: rows.length,
    traded: traded.length,
    advanced: traded.filter((r) => (r.percent ?? 0) > 0).length,
    declined: traded.filter((r) => (r.percent ?? 0) < 0).length,
    valueMn: traded.reduce((s, r) => s + (r.valueMn ?? 0), 0),
    avgChange: avg,
  };
}

export const researchScreen: Screen = {
  code: 'RSRCH',
  title: 'Sector research',
  mount(el, args, ctx) {
    const preset = SECTOR_PRESETS.find((p) => p.id === (args[0] ?? 'RMG').toUpperCase()) ?? SECTOR_PRESETS[0]!;
    let alive = true;
    const root = h('section', { class: 'tp-screen' });
    el.append(root);
    const tabs = h('nav', { class: 'tp-chips', 'aria-label': 'Sectors' }, ...SECTOR_PRESETS.map((p) =>
      h('a', { href: `#/rsrch/${p.id}`, class: `tp-chip${p.id === preset.id ? ' on' : ''}`, 'aria-current': p.id === preset.id ? 'page' : undefined }, p.id)));
    const kpis = h('div', { class: 'tp-stats' }, stateBox('loading', 'Loading sector…'));
    const stocks = h('div', {}, stateBox('loading', 'Loading listed companies…'));
    const newsBox = h('div', {}, stateBox('loading', 'Loading sector news…'));
    const riskBox = h('div', {});
    const askQ = `Write a short sector brief on Bangladesh ${preset.label}: the latest news, risks and how listed ${preset.id} stocks traded in the last DSE session.`;
    const exportsNote = preset.id === 'RMG'
      ? stateBox('planned', 'RMG exports by month and by market (EPB data) are not connected yet. They will appear here, with their source, once the EPB feed is added — no figures are shown until then.')
      : null;

    root.append(
      h('header', { class: 'tp-screen-head' }, h('span', { class: 'tp-logo-sm' }, 'RSRCH'), h('h1', {}, `BDSI SECTOR RESEARCH — ${preset.label.toUpperCase()}`)),
      tabs, kpis,
      h('div', { class: 'tp-grid' },
        h('div', { class: 'tp-slot' }, panel({ n: 1, title: `LISTED ${preset.id}`, code: 'EQS', hint: `${preset.id} EQS` }, stocks)),
        h('div', { class: 'tp-slot' }, panel({ n: 2, title: 'SECTOR NEWS', code: 'NEWS', hint: `${preset.id} NEWS` }, newsBox)),
        h('div', { class: 'tp-slot' }, panel({ n: 3, title: 'RISK WATCH', code: 'RISK', hint: `${preset.id} RISK` }, riskBox,
          preset.id === 'RMG' ? h('p', {}, h('a', { href: '#/sea' }, 'Port and shipping picture: SEA <GO>')) : null)),
        h('div', { class: 'tp-slot' }, panel({ n: 4, title: 'AI · SECTOR BRIEF', code: 'ASK', hint: `ASK ${preset.id}` },
          h('p', { class: 'tp-dim' }, 'The BDSI analyst writes a brief from the latest DSE prices and Bangladesh news, citing each source.'),
          h('button', { type: 'button', class: 'tp-chip on', onclick: () => ctx.go('ask', { query: askQ }) }, `WRITE ${preset.id} BRIEF`),
          exportsNote))));

    fetch('/api/bd-stock?screen=1', { signal: AbortSignal.timeout(25_000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { rows: Row[]; session: { sessionDate?: string } | null; stale?: boolean }) => {
        if (!alive) return;
        setStatus('DSE', j.stale ? 'stale' : 'ok');
        const rows = j.rows.filter((r) => r.sector && preset.dseSectors.includes(r.sector));
        const st = sectorStats(rows);
        kpis.replaceChildren(...[
          ['LISTED', fmtInt(st.listed)], ['TRADED', fmtInt(st.traded)], ['ADV / DEC', `${st.advanced} / ${st.declined}`],
          ['SECTOR VALUE', `৳${fmtNum(st.valueMn)} mn`], ['AVG CHANGE', pct(st.avgChange)],
        ].map(([k, v]) => h('div', {}, h('div', { class: 'tp-stat-k' }, k!), h('div', { class: 'tp-w' }, v!))));
        const sorted = [...rows].sort((a, b) => (b.valueMn ?? 0) - (a.valueMn ?? 0));
        stocks.replaceChildren(rows.length
          ? h('div', { class: 'tp-table-scroll' }, h('table', { class: 'tp-table' },
            h('thead', {}, h('tr', {}, h('th', {}, 'TICKER'), h('th', { class: 'r' }, 'LTP'), h('th', { class: 'r' }, 'CHG'), h('th', { class: 'r' }, 'VALUE ৳MN'), h('th', {}, 'CAT'))),
            h('tbody', {}, ...sorted.map((r) => h('tr', {},
              h('td', {}, h('a', { href: `#/stock/${encodeURIComponent(r.code)}`, class: 'tp-tick' }, r.code)),
              h('td', { class: 'r tp-w' }, fmtNum(r.ltp)), h('td', { class: `r tp-${signClass(r.percent)}` }, pct(r.percent)),
              h('td', { class: 'r' }, fmtNum(r.valueMn)), h('td', {}, r.category ?? '—'))))))
          : stateBox('empty', `No DSE instruments in sector ${preset.dseSectors.join(' / ')}.`),
        sourceLine(`Source: Dhaka Stock Exchange price list · close of ${j.session?.sessionDate ?? '—'} · sorted by traded value`));
      })
      .catch(() => { if (alive) { setStatus('DSE', 'error'); stocks.replaceChildren(stateBox('error', 'DSE price list unavailable right now.')); kpis.replaceChildren(); } });

    allNews().then((items: NewsItem[]) => {
      if (!alive) return;
      const sectorNews = items.filter((n) => preset.news.test(n.title));
      newsBox.replaceChildren(sectorNews.length
        ? h('ul', { class: 'tp-disc' }, ...sectorNews.slice(0, 14).map((n) => h('li', {},
          h('a', { href: n.link, target: '_blank', rel: 'noopener noreferrer' }, n.title), h('span', { class: 'tp-muted' }, ` · ${n.source} · ${dhakaTime(n.publishedAt)}`))))
        : stateBox('empty', 'No sector stories in the current news digest.'),
      sourceLine('BDSI news digest, matched by sector keywords (English and Bangla).'));
      riskBox.replaceChildren(
        h('table', { class: 'tp-table' }, h('thead', {}, h('tr', {}, h('th', {}, 'SIGNAL'), h('th', { class: 'r' }, 'STORIES'), h('th', {}, 'LATEST'))),
          h('tbody', {}, ...preset.risks.map((rk) => {
            const hits = sectorNews.filter((n) => rk.re.test(n.title));
            return h('tr', {}, h('td', { class: 'tp-w' }, rk.label), h('td', { class: `r ${hits.length ? 'tp-amber' : ''}` }, String(hits.length)),
              h('td', {}, hits[0] ? h('a', { href: hits[0].link, target: '_blank', rel: 'noopener noreferrer' }, hits[0].title.slice(0, 90)) : h('span', { class: 'tp-muted' }, '—')));
          }))),
        sourceLine('Counts of sector stories in the current digest that mention each signal — a news count, not a measured index.'));
    }).catch(() => { if (alive) newsBox.replaceChildren(stateBox('error', 'News unavailable right now.')); });
    return () => { alive = false; };
  },
};
