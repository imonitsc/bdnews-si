// BDSI: Internet outages from IODA (Internet Outage Detection and Analysis,
// Georgia Tech), used when no Cloudflare Radar token is configured.
// Licence/terms: free public API, see docs/THIRD_PARTY.md (Amber until commercial
// terms are confirmed). Attribution: "IODA, Georgia Tech".
//
// IODA reports one event per (country, signal) pair: BGP visibility, active
// probing (ping-slash24), Google Transparency Report traffic (gtr) and Merit
// network telescope (merit-nt). We merge a country's overlapping events into one
// outage and describe which signals saw it. IODA gives no "nationwide vs
// regional" verdict, so severity only says how many independent signals agree;
// it is never TOTAL.

import { COUNTRY_COORDS } from './radar-country-coords.mjs';

export const IODA_EVENTS_URL = 'https://api.ioda.inetintel.cc.gatech.edu/v2/outages/events';
export const IODA_DASHBOARD_URL = 'https://ioda.inetintel.cc.gatech.edu';

const SIGNAL_NAMES = {
  bgp: 'BGP routing',
  'ping-slash24': 'active probing',
  gtr: 'Google traffic',
  'merit-nt': 'network telescope',
};

/** Countries whose disruptions are always kept, however small, for the Bangladesh focus. */
export const FOCUS_COUNTRIES = new Set(['BD', 'MM', 'IN', 'NP', 'BT', 'LK', 'PK']);

/**
 * Turn an IODA `outages/events` response into the infra:outages:v1 outage shape.
 * Pure: no network. `nowSec` and `windowSec` fix the time window so a fixture
 * replays the same way.
 */
export function mapIodaEvents(body, { nowSec, windowSec = 7 * 86400, maxOutages = 60 } = {}) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.data)) {
    throw new Error('IODA outages/events: response has no data array');
  }
  if (body.error) throw new Error(`IODA outages/events: ${String(body.error).slice(0, 200)}`);
  const now = Number.isFinite(nowSec) ? nowSec : Math.floor(Date.now() / 1000);

  const byCountry = new Map();
  for (const ev of body.data) {
    const m = /^country\/([A-Z]{2})$/.exec(String(ev?.location ?? ''));
    if (!m) continue;
    const code = m[1];
    const start = Number(ev.start);
    const duration = Number(ev.duration);
    if (!Number.isFinite(start) || !Number.isFinite(duration)) continue;
    const end = start + Math.max(0, duration);
    if (end < now - windowSec) continue;
    const cur = byCountry.get(code) ?? { code, name: ev.location_name || code, start, end, signals: new Set(), score: 0 };
    cur.start = Math.min(cur.start, start);
    cur.end = Math.max(cur.end, end);
    if (ev.datasource) cur.signals.add(String(ev.datasource));
    cur.score = Math.max(cur.score, Number(ev.score) || 0);
    byCountry.set(code, cur);
  }

  const outages = [];
  for (const c of byCountry.values()) {
    const coords = COUNTRY_COORDS[c.code];
    if (!coords) continue;
    const signals = [...c.signals].sort();
    const signalLabels = signals.map((s) => SIGNAL_NAMES[s] ?? s);
    // An event that runs up to the query window's end is still open.
    const ongoing = c.end >= now - 600;
    outages.push({
      id: `ioda-${c.code}-${c.start}`,
      title: `Internet disruption in ${c.name}`,
      link: `${IODA_DASHBOARD_URL}/country/${c.code}`,
      description: `IODA detected a drop in ${signalLabels.join(', ')}${ongoing ? '; still ongoing at the last check' : ''}.`,
      detectedAt: c.start * 1000,
      country: c.name,
      region: '',
      location: { latitude: coords[0], longitude: coords[1] },
      severity: signals.length >= 2 ? 'OUTAGE_SEVERITY_MAJOR' : 'OUTAGE_SEVERITY_PARTIAL',
      categories: ['IODA', ...signalLabels],
      cause: '',
      outageType: '',
      endedAt: ongoing ? 0 : c.end * 1000,
      _score: c.score,
      _focus: FOCUS_COUNTRIES.has(c.code),
    });
  }

  // Keep focus countries, then the strongest signals; newest first for display.
  outages.sort((a, b) => Number(b._focus) - Number(a._focus) || b._score - a._score);
  return outages
    .slice(0, maxOutages)
    .map(({ _score, _focus, ...o }) => o)
    .sort((a, b) => b.detectedAt - a.detectedAt);
}

/** Fetch the last `windowSec` of country-level outage events from IODA. */
export async function fetchIodaOutages({ userAgent, windowSec = 7 * 86400, fetchImpl = fetch } = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  const url = `${IODA_EVENTS_URL}?from=${nowSec - windowSec}&until=${nowSec}&entityType=country&limit=1000`;
  const resp = await fetchImpl(url, {
    headers: { Accept: 'application/json', ...(userAgent ? { 'User-Agent': userAgent } : {}) },
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) throw new Error(`IODA API error: ${resp.status}`);
  return { outages: mapIodaEvents(await resp.json(), { nowSec, windowSec }), pagination: undefined };
}
