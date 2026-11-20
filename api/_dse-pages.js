// BD Situation Intelligence: Dhaka Stock Exchange data from its PUBLIC PAGES.
//
// dse.com.bd's robots.txt disallows /api, so BDSI reads only pages robots.txt
// allows, and parses the data those pages already embed (Next.js RSC payload in
// `self.__next_f.push([1,"..."])` scripts, or plain HTML tables):
//   /                            every instrument's price row, session state, DSEX intraday
//   /recent-market-information   daily DSEX / DSES / DS30 closes, trades, volume, turnover
//   /company/<CODE>              company record (P/E, EPS, NAV, dividends, financials, holdings)
//   /news/today                  today's price-sensitive disclosures
// Requests identify BDSI and are cached; data belongs to the Dhaka Stock Exchange.

export const DSE_BASE = 'https://www.dse.com.bd';
export const DSE_UA = 'Mozilla/5.0 (compatible; BDSituationIntelligence/1.0; +https://www.bdnews.si/about.html)';

export async function fetchDsePage(path, ms = 15_000) {
  const res = await globalThis.fetch(`${DSE_BASE}${path}`, {
    headers: { 'user-agent': DSE_UA, accept: 'text/html' },
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`dse ${path}: HTTP ${res.status}`);
  return res.text();
}

/** The concatenated RSC payload strings of a Next.js page. */
export function rscPayload(html) {
  const out = [];
  for (const m of String(html).matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    try { out.push(JSON.parse(`"${m[1]}"`)); } catch { /* skip a malformed chunk */ }
  }
  return out.join('');
}

/** The smallest JSON object in `text` that encloses position `idx`, parsed. */
export function objectAround(text, idx) {
  if (idx < 0) return null;
  let s = idx, depth = 0;
  while (s >= 0) {
    const c = text[s];
    if (c === '}') depth++;
    else if (c === '{') { if (depth === 0) break; depth--; }
    s--;
  }
  if (s < 0) return null;
  let e = s, d = 0, inStr = false;
  for (; e < text.length; e++) {
    const c = text[e];
    if (inStr) { if (c === '\\') e++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) break; }
  }
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return null; }
}

/** The JSON value (object or array) that starts right after `"key":` (first occurrence). */
export function valueAfterKey(text, key) {
  const k = text.indexOf(`"${key}":`);
  if (k < 0) return null;
  let s = k + key.length + 3;
  while (text[s] === ' ') s++;
  const open = text[s];
  const close = open === '{' ? '}' : open === '[' ? ']' : null;
  if (!close) return null;
  let e = s, d = 0, inStr = false;
  for (; e < text.length; e++) {
    const c = text[e];
    if (inStr) { if (c === '\\') e++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === open) d++;
    else if (c === close) { d--; if (d === 0) break; }
  }
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return null; }
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Home page → { rows: [{code, ltp, ycp, open, high, low, close, volume, valueMn, trades, percent, category, board, sector, assetType}], session, dsex } */
export function parseHome(html) {
  const all = rscPayload(html);
  const prices = valueAfterKey(all, 'initialPrices');
  if (!prices || !Array.isArray(prices.cols) || !Array.isArray(prices.rows)) throw new Error('dse home: no price table');
  const col = Object.fromEntries(prices.cols.map((c, i) => [c, i]));
  const at = (r, k) => (col[k] == null ? null : r[col[k]]);
  const rows = prices.rows.map((r) => ({
    code: String(at(r, 'code') ?? ''),
    ltp: num(at(r, 'ltp')), ycp: num(at(r, 'ycp')), open: num(at(r, 'open')), high: num(at(r, 'high')), low: num(at(r, 'low')), close: num(at(r, 'close')),
    volume: num(at(r, 'volume')), valueMn: num(at(r, 'value')), trades: num(at(r, 'trades')), percent: num(at(r, 'percent')),
    category: at(r, 'category') ?? null, board: at(r, 'board') ?? null, sector: at(r, 'sector') ?? null, assetType: at(r, 'assetType') ?? null,
  })).filter((r) => r.code);
  const session = prices.session ?? objectAround(all, all.indexOf('"sessionDate"'));
  const dsexObj = objectAround(all, all.indexOf('"points":['));
  const points = Array.isArray(dsexObj?.points) ? dsexObj.points.filter((p) => num(p?.value) != null) : [];
  const dsex = dsexObj?.key === 'DSEX' && points.length
    ? { day: dsexObj.day ?? null, first: points[0].value, last: points[points.length - 1].value, lastTime: points[points.length - 1].t ?? null, points: points.map((p) => [p.t, p.value]) }
    : null;
  return { rows, session: session ?? null, dsex };
}

/** /recent-market-information → daily rows, newest first: { date, trades, volume, turnoverMn, dsex, dses, ds30 } */
export function parseRecentMarket(html) {
  const out = [];
  const tables = String(html).split(/<table/i).slice(1);
  for (const t of tables) {
    if (!/DSEX/.test(t) || !/DS30/.test(t)) continue;
    for (const tr of t.split(/<tr/i).slice(1)) {
      const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim());
      if (cells.length < 9 || !/^\d{4}-\d{2}-\d{2}$/.test(cells[0])) continue;
      const n = (s) => { const v = Number(String(s).replace(/,/g, '')); return Number.isFinite(v) ? v : null; };
      // Columns as rendered: date, trades, volume, turnover (mn), equity market cap (mn),
      // total market cap (mn), DSEX, DSES, DS30 (the page's header row is offset by one).
      const vals = cells.map(n);
      const dsex = vals[6], dses = vals[7], ds30 = vals[8];
      if (!(dsex > 1000 && dses > 100 && ds30 > 500)) continue;
      out.push({ date: cells[0], trades: vals[1], volume: vals[2], turnoverMn: vals[3], dsex, dses, ds30 });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Market summary in the shape the dashboard's DSE panel uses (src/services/bd-markets.ts BdDse). */
export function buildDseSummary(home, recent) {
  const rows = home.rows.filter((r) => r.ltp != null);
  const traded = rows.filter((r) => (r.trades ?? 0) > 0);
  const latest = recent[0] ?? null;
  const prev = recent[1] ?? null;
  const session = home.session ?? {};
  const sessionDate = session.sessionDate ?? null;
  // The daily table's newest row is the last completed session.
  const closeIdx = (key, label) => {
    if (!latest) return { key: label, value: null, change: null, percent: null };
    const v = latest[key], p = prev?.[key];
    return { key: label, value: v, change: p != null ? v - p : null, percent: p ? ((v - p) / p) * 100 : null };
  };
  let dsexIdx = closeIdx('dsex', 'DSEX');
  // During or after a session that the daily table does not have yet, DSEX comes from the live intraday series.
  if (home.dsex && home.dsex.day && (!latest || home.dsex.day > latest.date)) {
    const base = latest?.dsex ?? null;
    dsexIdx = { key: 'DSEX', value: home.dsex.last, change: base != null ? home.dsex.last - base : null, percent: base ? ((home.dsex.last - base) / base) * 100 : null };
  }
  const byPct = (dir) => traded.filter((r) => r.percent != null && (dir > 0 ? r.percent > 0 : r.percent < 0))
    .sort((a, b) => dir * (b.percent - a.percent)).slice(0, 8)
    .map((r) => ({ code: r.code, ltp: r.ltp, percent: r.percent }));
  const sum = (k) => traded.reduce((s, r) => s + (r[k] ?? 0), 0);
  return {
    indices: [dsexIdx, closeIdx('ds30', 'DS30'), closeIdx('dses', 'DSES')],
    indexDate: latest?.date ?? null,
    totals: {
      turnoverMn: traded.length ? Math.round(sum('valueMn') * 100) / 100 : latest?.turnoverMn ?? null,
      volume: traded.length ? sum('volume') : latest?.volume ?? null,
      trades: traded.length ? sum('trades') : latest?.trades ?? null,
      marketCap: null,
      tradeTime: sessionDate ? `${sessionDate} close` : null,
    },
    breadth: {
      advanced: traded.filter((r) => r.percent > 0).length,
      declined: traded.filter((r) => r.percent < 0).length,
      unchanged: traded.filter((r) => r.percent === 0).length,
    },
    session: {
      isOpen: session.isOpen === true,
      phase: session.phase ?? null,
      opening: session.opening ?? null,
      closing: session.closing ?? null,
      nextDate: session.next?.date ?? null,
      sessionDate,
    },
    gainers: byPct(1),
    losers: byPct(-1),
    source: 'Dhaka Stock Exchange',
    sourceUrl: `${DSE_BASE}/`,
  };
}

/** Fields a stock page needs from /company/<CODE>; no personal contact details are kept. */
export function parseCompany(html, code) {
  const all = rscPayload(html);
  const obj = objectAround(all, all.indexOf('"scripCode"'));
  if (!obj || String(obj.code ?? '').toUpperCase() !== String(code).toUpperCase()) return null;
  const pick = (k) => obj[k] ?? null;
  return {
    code: obj.code, name: pick('name'), sector: pick('sector'), board: pick('board'), category: pick('category'),
    instrumentType: pick('instrumentType'), isin: pick('isin'), listingYear: pick('listingYear'), website: pick('website'), hq: pick('hq'),
    price: num(obj.price), change: num(obj.change), changePct: num(obj.changePct), prevClose: num(obj.prevClose),
    open: num(obj.open), high: num(obj.high), low: num(obj.low), volume: num(obj.volume), trades: num(obj.trades),
    marketCap: num(obj.marketCap), freeFloatMarketCap: num(obj.freeFloatMarketCap), freeFloat: num(obj.freeFloat),
    pe: num(obj.pe), eps: num(obj.eps), nav: num(obj.nav), dividendYield: num(obj.dividendYield), faceValue: num(obj.faceValue),
    paidUpCapital: num(obj.paidUpCapital), weekHigh52: num(obj.weekHigh52), weekLow52: num(obj.weekLow52),
    yearEnd: pick('yearEnd'), agmDate: pick('agmDate'), asOfDate: pick('asOfDate'), asOfTime: pick('asOfTime'),
    operationalStatus: pick('operationalStatus'),
    sharePattern: Array.isArray(obj.sharePattern) ? obj.sharePattern.slice(-3) : obj.sharePattern ?? null,
    dividendHistory: Array.isArray(obj.dividendHistory)
      ? [...obj.dividendHistory].sort((a, b) => (b?.year ?? 0) - (a?.year ?? 0)).slice(0, 8)
      : [],
    multiYearFinancials: Array.isArray(obj.multiYearFinancials)
      ? [...obj.multiYearFinancials].sort((a, b) => (a?.year ?? 0) - (b?.year ?? 0)).slice(-5).map((f) => ({ year: f.year, eps: num(f.epsBasic), nav: num(f.nav), profitMn: num(f.profit), pe: num(f.pe) }))
      : [],
    psiUrl: pick('psiUrl'), financialStatementsUrl: pick('financialStatementsUrl'),
  };
}

/** /news/today → disclosures [{ id, code, name, type, date, time, summary, body }] */
export function parseTodayDisclosures(html) {
  const all = rscPayload(html);
  const list = valueAfterKey(all, 'disclosures');
  if (!Array.isArray(list)) return [];
  return list.map((d) => ({
    id: String(d.id ?? ''), code: String(d.code ?? ''), name: d.name ?? null, type: d.type ?? null,
    date: d.date ?? null, time: d.time ?? null, summary: String(d.summary ?? '').slice(0, 300), body: String(d.body ?? '').slice(0, 1200),
  })).filter((d) => d.code);
}
