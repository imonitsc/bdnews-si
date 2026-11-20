// BD Situation Intelligence: DSE instruments for the terminal.
//   GET /api/bd-stock?list=1     → { codes: [...], sessionDate }
//   GET /api/bd-stock?screen=1   → { rows: [{ code, ltp, ycp, open, high, low, volume, valueMn, trades, percent, category, board, sector, assetType }], session }
//   GET /api/bd-stock?code=GP    → { quote, company, disclosures, history, session }
// Data comes from dse.com.bd's public pages only (robots.txt disallows /api);
// see api/_dse-pages.js. Daily closes are archived by scripts/seed-bd-dse-closes.mjs.
import { fetchDsePage, parseHome, parseCompany, parseTodayDisclosures } from './_dse-pages.js';
import { redisPipeline } from './_upstash-json.js';

export const config = { maxDuration: 30 };

const CODE_RE = /^[A-Z0-9&().-]{1,20}$/;
const cache = new Map(); // key → { at, data }

async function cached(key, ttlMs, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  try {
    const data = await load();
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch (e) {
    if (hit) return { ...hit.data, stale: true };
    throw e;
  }
}

const home = () => cached('home', 60_000, async () => parseHome(await fetchDsePage('/')));
const today = () => cached('today', 5 * 60_000, async () => ({ list: parseTodayDisclosures(await fetchDsePage('/news/today')) }));

/** Archived daily closes for a code: [[date, close, volume], ...], oldest first. */
async function history(code) {
  const res = await redisPipeline([['GET', `bdsi:dse:close:${code}`]], 4_000, true);
  const raw = res?.[0]?.result;
  if (!raw) return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
}

function send(res, status, body, maxAge = 60) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', status === 200 ? `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 5}` : 'no-store');
  res.end(JSON.stringify(body));
}

export async function buildStock(code) {
  const [h, comp, t, hist] = await Promise.all([
    home(),
    cached(`company:${code}`, 10 * 60_000, async () => ({ c: parseCompany(await fetchDsePage(`/company/${encodeURIComponent(code)}`), code) })).catch(() => ({ c: null })),
    today().catch(() => ({ list: [] })),
    history(code).catch(() => []),
  ]);
  const quote = h.rows.find((r) => r.code.toUpperCase() === code) ?? null;
  if (!quote && !comp.c) return null;
  return {
    code,
    quote,
    company: comp.c,
    disclosures: t.list.filter((d) => d.code.toUpperCase() === code),
    history: hist,
    session: h.session,
    source: 'Dhaka Stock Exchange',
    sourceUrl: `https://www.dse.com.bd/company/${encodeURIComponent(code)}`,
    fetchedAt: new Date().toISOString(),
    stale: !!h.stale,
  };
}

export default async function handler(req, res) {
  const url = new URL(req.url || '/api/bd-stock', 'https://www.bdnews.si');
  try {
    if (url.searchParams.has('list')) {
      const h = await home();
      return send(res, 200, { codes: h.rows.map((r) => r.code), sessionDate: h.session?.sessionDate ?? null }, 600);
    }
    if (url.searchParams.has('screen')) {
      const h = await home();
      return send(res, 200, { rows: h.rows, session: h.session, source: 'Dhaka Stock Exchange', fetchedAt: new Date().toISOString(), stale: !!h.stale }, 120);
    }
    const code = String(url.searchParams.get('code') || '').trim().toUpperCase();
    if (!CODE_RE.test(code)) return send(res, 400, { error: 'bad_code' });
    const data = await buildStock(code);
    if (!data) return send(res, 404, { error: 'not_found', code });
    return send(res, 200, data, 120);
  } catch (e) {
    return send(res, 502, { error: 'dse_unavailable', detail: String(e?.message || e).slice(0, 160) });
  }
}
