#!/usr/bin/env node
// BD Situation Intelligence: archive Dhaka Stock Exchange daily closes into Redis,
// so stock pages can chart price history (DSE publishes no history feed that its
// robots.txt allows). Run by the seed workflow after the seeders.
//
//   bdsi:dse:close:<CODE>  JSON [[sessionDate, close, volume], ...] oldest first, last 400 sessions
//   bdsi:dse:indices        JSON [{ date, dsex, dses, ds30, trades, volume, turnoverMn }], oldest first, last 600
//
// Only closed sessions are archived (the session's last prices are final), and a
// session is written once. Reads public pages only: / and /recent-market-information.
import { fetchDsePage, parseHome, parseRecentMarket } from '../api/_dse-pages.js';

const MAX_SESSIONS = 400;
const MAX_INDEX_DAYS = 600;
const TTL_SECONDS = 2 * 365 * 86400;

function creds() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Redis credentials missing (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)');
  return { url, token };
}

async function pipeline(commands) {
  const { url, token } = creds();
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Redis pipeline HTTP ${res.status}`);
  return res.json();
}

/** Append one session to a code's series (pure; exported for tests). */
export function appendClose(series, sessionDate, close, volume, max = MAX_SESSIONS) {
  const list = Array.isArray(series) ? series.filter((x) => Array.isArray(x) && typeof x[0] === 'string') : [];
  if (list.length && list[list.length - 1][0] >= sessionDate) return null; // already archived (or older)
  list.push([sessionDate, close, volume ?? null]);
  return list.slice(-max);
}

/** Merge daily index rows by date (pure; exported for tests). */
export function mergeIndexDays(existing, rows, max = MAX_INDEX_DAYS) {
  const byDate = new Map((Array.isArray(existing) ? existing : []).map((r) => [r.date, r]));
  for (const r of rows) byDate.set(r.date, r);
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-max);
}

async function main() {
  const [homeHtml, recentHtml] = await Promise.all([fetchDsePage('/'), fetchDsePage('/recent-market-information')]);
  const home = parseHome(homeHtml);
  const recent = parseRecentMarket(recentHtml);

  // Index history (the daily table has closed sessions only).
  const [idxRes] = await pipeline([['GET', 'bdsi:dse:indices']]);
  const merged = mergeIndexDays(idxRes?.result ? JSON.parse(idxRes.result) : [], recent);
  await pipeline([['SET', 'bdsi:dse:indices', JSON.stringify(merged), 'EX', TTL_SECONDS]]);
  console.log(`  indices: ${merged.length} days (latest ${merged[merged.length - 1]?.date ?? 'n/a'})`);

  const s = home.session ?? {};
  if (s.isOpen || !s.sessionDate) {
    console.log(`  closes: skipped (session ${s.isOpen ? 'open' : 'unknown'})`);
    return;
  }
  const rows = home.rows.filter((r) => r.close != null && (r.trades ?? 0) > 0);
  let written = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const got = await pipeline(batch.map((r) => ['GET', `bdsi:dse:close:${r.code}`]));
    const sets = [];
    batch.forEach((r, j) => {
      let prev = [];
      try { prev = got[j]?.result ? JSON.parse(got[j].result) : []; } catch { prev = []; }
      const next = appendClose(prev, s.sessionDate, r.close, r.volume);
      if (next) sets.push(['SET', `bdsi:dse:close:${r.code}`, JSON.stringify(next), 'EX', TTL_SECONDS]);
    });
    if (sets.length) { await pipeline(sets); written += sets.length; }
  }
  console.log(`  closes: session ${s.sessionDate}, ${written} of ${rows.length} traded codes archived`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(() => console.log('Done: DSE archive OK')).catch((e) => {
    console.error(`DSE archive failed: ${e?.message || e}`);
    process.exit(1);
  });
}
