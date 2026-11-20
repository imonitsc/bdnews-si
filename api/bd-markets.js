// BD Situation Intelligence: Bangladesh markets for the dashboard.
//   GET /api/bd-markets            → { dse, fx, bazaar, fetchedAt }
//   GET /api/bd-markets?part=dse   → one part only (dse | fx | bazaar)
// Sources (public pages, read server-side and cached; data belongs to the publishers):
//   - Dhaka Stock Exchange: https://www.dse.com.bd/api/live/snapshot (JSON used by dse.com.bd)
//   - Bangladesh Bank:      https://www.bb.org.bd/en/index.php/econdata/exchangerate (HTML table)
//   - TCB:                  https://tcb.gov.bd/pages/daily-rmps → latest daily .xlsx
import { jsonResponse } from './_json-response.js';
import { readFirstSheetRows } from './_xlsx-lite.js';

export const config = { runtime: 'edge' };

const UA = 'Mozilla/5.0 (compatible; BDSituationIntelligence/1.0; +https://www.bdnews.si/about.html)';
const TTL = { dse: 60_000, fx: 30 * 60_000, bazaar: 60 * 60_000 };
const cache = new Map(); // part → { at, data }
const inflight = new Map();

async function fetchWithTimeout(url, init = {}, ms = 12_000) {
  return globalThis.fetch(url, {
    ...init,
    headers: { 'user-agent': UA, ...(init.headers || {}) },
    signal: AbortSignal.timeout(ms),
  });
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// ── Dhaka Stock Exchange ────────────────────────────────────────────────────
export function shapeDse(json) {
  const m = json?.market;
  if (!m || !Array.isArray(m.indices)) throw new Error('dse: unexpected shape');
  const mover = (x) => ({
    code: String(x?.code ?? ''),
    ltp: num(x?.ltp),
    percent: num(x?.percent),
  });
  return {
    indices: m.indices.map((i) => ({
      key: String(i.key),
      value: num(i.value),
      change: num(i.change),
      percent: num(i.percent),
    })),
    totals: {
      turnoverMn: num(m.totals?.turnover),
      volume: num(m.totals?.volume),
      trades: num(m.totals?.trades),
      marketCap: num(m.totals?.marketCap),
      tradeTime: m.totals?.tradeTime ? String(m.totals.tradeTime) : null,
    },
    breadth: {
      advanced: num(m.breadth?.advanced),
      declined: num(m.breadth?.declined),
      unchanged: num(m.breadth?.unchanged),
    },
    session: {
      isOpen: m.session?.isOpen === true,
      phase: m.session?.phase ? String(m.session.phase) : null,
      opening: m.session?.opening ?? null,
      closing: m.session?.closing ?? null,
      nextDate: m.session?.date ?? null,
    },
    gainers: (m.movers?.gainers ?? []).slice(0, 8).map(mover),
    losers: (m.movers?.losers ?? []).slice(0, 8).map(mover),
    source: 'Dhaka Stock Exchange',
    sourceUrl: 'https://www.dse.com.bd/',
  };
}

async function loadDse() {
  const res = await fetchWithTimeout('https://www.dse.com.bd/api/live/snapshot', { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`dse: HTTP ${res.status}`);
  return shapeDse(await res.json());
}

// ── Bangladesh Bank exchange rates ──────────────────────────────────────────
const stripTags = (s) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export function parseBbRates(html) {
  const rates = [];
  for (const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => stripTags(c[1]));
    if (cells.length < 3) continue;
    const code = /^([A-Z]{3})\b/.exec(cells[0])?.[1];
    if (!code || code === 'BDT') continue;
    const bid = Number(cells[1].replace(/,/g, ''));
    const ask = Number(cells[2].replace(/,/g, ''));
    if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0) continue;
    const war = cells[3] != null ? Number(cells[3].replace(/,/g, '')) : NaN;
    if (rates.some((r) => r.code === code)) continue;
    rates.push({ code, bid, ask, mid: Number.isFinite(war) && war > 0 ? war : (bid + ask) / 2 });
  }
  const text = stripTags(html);
  let asOf = null;
  const eff = /effective for\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i.exec(text);
  if (eff) asOf = `${eff[3]}-${eff[2].padStart(2, '0')}-${eff[1].padStart(2, '0')}`;
  else {
    const dm = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),\s*(\d{4})/i.exec(text);
    const d = dm ? new Date(`${dm[1]} ${dm[2]}, ${dm[3]} 00:00:00 UTC`) : null;
    if (d && !Number.isNaN(d.getTime())) asOf = d.toISOString().slice(0, 10);
  }
  return { rates, asOf };
}

async function loadFx() {
  const res = await fetchWithTimeout('https://www.bb.org.bd/en/index.php/econdata/exchangerate', { headers: { accept: 'text/html' } });
  if (!res.ok) throw new Error(`fx: HTTP ${res.status}`);
  const html = await res.text();
  const { rates, asOf } = parseBbRates(html);
  if (!rates.some((r) => r.code === 'USD')) {
    const title = /<title>([^<]{0,80})/i.exec(html)?.[1] ?? '';
    throw new Error(`fx: USD rate not found (status ${res.status}, ${html.length} bytes, tables ${(html.match(/<table/gi) || []).length}, title "${title.trim()}")`);
  }
  return {
    base: 'BDT',
    asOf,
    rates,
    source: 'Bangladesh Bank',
    sourceUrl: 'https://www.bb.org.bd/en/index.php/econdata/exchangerate',
  };
}

// ── TCB daily Dhaka retail prices ───────────────────────────────────────────
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const toAsciiDigits = (s) => s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

export function findLatestTcbFile(html) {
  const m = /https:\/\/objectstorage\.[a-z0-9.-]+\/[^"'\s<>]+?\.xlsx/i.exec(html);
  if (!m) return null;
  const after = html.slice(m.index, m.index + 2000);
  const d = /([০-৯\d]{2})-([০-৯\d]{2})-([০-৯\d]{4})/.exec(after);
  const date = d ? `${toAsciiDigits(d[3])}-${toAsciiDigits(d[2])}-${toAsciiDigits(d[1])}` : null;
  return { url: m[0].replace(/&amp;/g, '&'), date };
}

// Items shown first, matched against TCB's Bangla item names (others follow in sheet order).
// Patterns are compiled after NFC normalisation: TCB's files mix precomposed and
// decomposed Bangla letters (e.g. য় U+09DF vs য + ় U+09AF U+09BC).
const nfc = (s) => String(s).normalize('NFC');
const KEY_ITEMS = [
  ['rice-coarse', 'Rice (coarse)', String.raw`^চাল \(মোটা\)`],
  ['rice-medium', 'Rice (medium)', String.raw`^চাল \(মাঝারী\)`],
  ['rice-fine', 'Rice (fine)', String.raw`^চাল সরু`],
  ['atta', 'Atta (loose)', String.raw`^আটা সাদা \(খোলা\)`],
  ['soybean-loose', 'Soybean oil (loose)', String.raw`^সয়াবিন তেল \(লুজ\)`],
  ['lentil-coarse', 'Lentil (coarse)', String.raw`^মশুর ডাল \(বড় দানা\)`],
  ['onion-local', 'Onion (local)', String.raw`^পিঁয়াজ \(দেশী\)`],
  ['potato', 'Potato', String.raw`^আলু`],
  ['egg', 'Egg (farm, per 4)', String.raw`^ডিম \(ফার্ম\)`],
  ['broiler', 'Chicken (broiler)', String.raw`^মুরগী\s*\(ব্রয়লার\)`],
  ['beef', 'Beef', String.raw`^গরু$`],
  ['hilsa', 'Hilsa', String.raw`^ইলিশ$`],
  ['sugar', 'Sugar', String.raw`^চিনি$`],
  ['green-chili', 'Green chili', String.raw`^কাঁচা\s?মরিচ`],
];
const KEY_PATTERNS = KEY_ITEMS.map(([id, en, src]) => [id, en, new RegExp(nfc(src))]);

export function parseTcbRows(rows) {
  const items = [];
  let category = null;
  for (const r of rows) {
    const name = nfc(r[0] ?? '').trim();
    if (!name) continue;
    // The sheet ends with a list of source markets and a repeat table of changed items.
    if (name.startsWith('যে সকল')) break;
    const nums = r.slice(2, 12).map((v) => {
      const n = Number(String(v ?? '').replace(/,/g, ''));
      return Number.isFinite(n) ? n : null;
    });
    const [lo, hi, wLo, wHi, mLo, mHi, mPct, yLo, yHi, yPct] = nums;
    if (lo == null || hi == null || !(hi > 0)) {
      // Category heading rows have a name and no prices.
      if (!r.slice(1).some((v) => String(v ?? '').trim()) && name.length <= 40 && !/^নং/.test(name)) category = name;
      continue;
    }
    const mid = (a, b) => (a != null && b != null && b > 0 ? (a + b) / 2 : null);
    const now = mid(lo, hi);
    const week = mid(wLo, wHi);
    items.push({
      name,
      unit: String(r[1] ?? '').trim(),
      category,
      low: lo,
      high: hi,
      weekAgo: week,
      weekChangePct: now != null && week ? ((now - week) / week) * 100 : null,
      monthChangePct: Number.isFinite(mPct) ? mPct : null,
      yearAgo: mid(yLo, yHi),
      yearChangePct: Number.isFinite(yPct) && yLo ? yPct : null,
    });
  }
  const used = new Set();
  const key = [];
  for (const [id, en, re] of KEY_PATTERNS) {
    const it = items.find((x, i) => !used.has(i) && re.test(x.name));
    if (!it) continue;
    used.add(items.indexOf(it));
    key.push({ id, labelEn: en, ...it });
  }
  return { key, all: items };
}

async function loadBazaar() {
  const page = await fetchWithTimeout('https://tcb.gov.bd/pages/daily-rmps', { headers: { accept: 'text/html' } }, 15_000);
  if (!page.ok) throw new Error(`bazaar: HTTP ${page.status}`);
  const listing = await page.text();
  const file = findLatestTcbFile(listing);
  if (!file) {
    const title = /<title>([^<]{0,80})/i.exec(listing)?.[1] ?? '';
    throw new Error(`bazaar: no daily file link (status ${page.status}, ${listing.length} bytes, title "${title.trim()}")`);
  }
  const res = await fetchWithTimeout(file.url, {}, 15_000);
  if (!res.ok) throw new Error(`bazaar file: HTTP ${res.status}`);
  const { key, all } = parseTcbRows(await readFirstSheetRows(await res.arrayBuffer()));
  if (all.length < 10) throw new Error('bazaar: too few items parsed');
  return {
    date: file.date,
    currency: 'BDT',
    key,
    items: all,
    source: 'Trading Corporation of Bangladesh (TCB)',
    sourceUrl: 'https://tcb.gov.bd/pages/daily-rmps',
  };
}

const LOADERS = { dse: loadDse, fx: loadFx, bazaar: loadBazaar };

async function getPart(part) {
  const hit = cache.get(part);
  const now = Date.now();
  if (hit && now - hit.at < TTL[part]) return { ...hit.data, stale: false, updatedAt: hit.at };
  if (!inflight.has(part)) {
    inflight.set(part, LOADERS[part]()
      .then((data) => { cache.set(part, { at: Date.now(), data }); return data; })
      .finally(() => inflight.delete(part)));
  }
  try {
    const data = await inflight.get(part);
    return { ...data, stale: false, updatedAt: cache.get(part)?.at ?? now };
  } catch (err) {
    if (hit) return { ...hit.data, stale: true, updatedAt: hit.at };
    const cause = err?.cause ? ` (cause: ${String(err.cause?.message || err.cause).slice(0, 120)})` : '';
    return { error: `${err?.name ?? 'Error'}: ${String(err?.message || err)}${cause}`.slice(0, 300) };
  }
}

export default async function handler(req) {
  const url = new URL(req.url);
  const only = url.searchParams.get('part');
  const parts = only && only in LOADERS ? [only] : Object.keys(LOADERS);
  const results = await Promise.all(parts.map((p) => getPart(p)));
  const body = { fetchedAt: new Date().toISOString() };
  parts.forEach((p, i) => { body[p] = results[i]; });
  const anyOk = results.some((r) => !r.error);
  const maxAge = parts.length === 1 && parts[0] !== 'dse' ? 600 : 60;
  return jsonResponse(body, anyOk ? 200 : 502, {
    'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 5}, stale-if-error=86400`,
  });
}
