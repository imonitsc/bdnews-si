// BDSI terminal: POWER — power, gas, weather and cyclone risk.
// Live: active storms (EONET/JTWC/GDACS via /api/natural), NASA FIRMS fires, energy
// and disaster news. Reference: major power and gas sites (approximate locations).
// Not connected yet: PGCB demand/load-shedding, BMD signals, FFWC river levels.

import type { Screen } from '../shell';
import { h, fmtNum, dhakaTime, dhakaDate, panel, sourceLine, stateBox } from '../dom';
import { allNews, boundaries, fires, setStatus, type FeatureCollection, type GeoEvent } from '../data';

export interface Site { name: string; kind: 'coal' | 'gas' | 'nuclear' | 'lng' | 'gasfield'; mw?: number; lat: number; lon: number; place: string }

/** Public reference list; locations approximate. */
export const SITES: Site[] = [
  { name: 'Matarbari power plant', kind: 'coal', mw: 1200, lat: 21.71, lon: 91.88, place: "Moheshkhali, Cox's Bazar" },
  { name: 'Payra power plant', kind: 'coal', mw: 1320, lat: 21.85, lon: 90.2, place: 'Kalapara, Patuakhali' },
  { name: 'Rampal (Maitree) power plant', kind: 'coal', mw: 1320, lat: 22.58, lon: 89.55, place: 'Rampal, Bagerhat' },
  { name: 'Rooppur nuclear power plant', kind: 'nuclear', mw: 2400, lat: 24.07, lon: 89.05, place: 'Ishwardi, Pabna (commissioning)' },
  { name: 'Moheshkhali FSRUs (2 LNG terminals)', kind: 'lng', lat: 21.53, lon: 91.86, place: "off Moheshkhali, Cox's Bazar" },
  { name: 'Ghorashal power station', kind: 'gas', lat: 23.98, lon: 90.63, place: 'Palash, Narsingdi' },
  { name: 'Bibiyana gas field', kind: 'gasfield', lat: 24.45, lon: 91.63, place: 'Nabiganj, Habiganj' },
  { name: 'Titas gas field', kind: 'gasfield', lat: 23.97, lon: 91.13, place: 'Brahmanbaria' },
];

export interface Storm { id: string; title: string; lat: number; lon: number; date: number; magnitude: number | null; unit: string | null; source: string | null; url: string | null }

/** Great-circle distance in km (pure; exported for tests). */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const BOX = { minLon: 82, maxLon: 95, minLat: 14, maxLat: 27 };
const inBox = (p: { lat: number; lon: number }) => p.lon >= BOX.minLon && p.lon <= BOX.maxLon && p.lat >= BOX.minLat && p.lat <= BOX.maxLat;
const ENERGY_NEWS = /\b(power|electricity|load.?shedding|gas|lng|fuel|energy|petrobangla|bpdb|pgcb|cyclone|storm|flood|rain|landslide|weather|heatwave|depression|signal)|বিদ্যুৎ|গ্যাস|জ্বালানি|লোডশেডিং|ঘূর্ণিঝড়|বন্যা|বৃষ্টি|ভূমিধস|সংকেত|নিম্নচাপ/i;
const BD = /bangladesh|dhaka|chattogram|chittagong|khulna|barishal|sylhet|cox|বাংলাদেশ|ঢাকা/i;

function drawMap(districts: FeatureCollection, storms: Storm[], fireList: GeoEvent[]): SVGSVGElement {
  const W = 560, H = 520;
  const kx = Math.cos((21 * Math.PI) / 180);
  const sx = W / ((BOX.maxLon - BOX.minLon) * kx), sy = H / (BOX.maxLat - BOX.minLat);
  const s = Math.min(sx, sy);
  const px = (lon: number) => (lon - BOX.minLon) * kx * s;
  const py = (lat: number) => (BOX.maxLat - lat) * s;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${Math.round((BOX.maxLon - BOX.minLon) * kx * s)} ${Math.round((BOX.maxLat - BOX.minLat) * s)}`);
  svg.setAttribute('class', 'tp-riskmap');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Bay of Bengal: ${storms.length} active storm(s), ${SITES.length} power and gas sites, ${fireList.length} fire detections`);
  const add = (tag: string, attrs: Record<string, string>, title?: string) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (title) { const t = document.createElementNS(NS, 'title'); t.textContent = title; e.append(t); }
    svg.append(e);
    return e;
  };
  add('rect', { x: '0', y: '0', width: '100%', height: '100%', fill: '#03070d' });
  for (const f of districts.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates as number[][][]] : (f.geometry.coordinates as number[][][][]);
    const d = polys.map((poly) => poly.map((ring) => ring.map(([x, y], i) => `${i ? 'L' : 'M'}${px(x!).toFixed(1)},${py(y!).toFixed(1)}`).join('') + 'Z').join('')).join('');
    add('path', { d, fill: '#111', stroke: '#5a4100', 'stroke-width': '0.5' }, `${f.properties.name} (${f.properties.division})`);
  }
  for (const f of fireList.filter(inBox)) add('circle', { cx: px(f.lon).toFixed(1), cy: py(f.lat).toFixed(1), r: '1.8', fill: '#ff7a1a', opacity: '0.8' }, 'Fire detection (NASA FIRMS)');
  for (const st of SITES) {
    const x = px(st.lon), y = py(st.lat);
    const color = st.kind === 'nuclear' ? '#b388ff' : st.kind === 'coal' ? '#bfbfbf' : st.kind === 'lng' ? '#4fc3f7' : '#5bd96b';
    if (st.kind === 'gasfield') add('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: '4', fill: color, stroke: '#000' }, `${st.name} · ${st.place}`);
    else add('rect', { x: (x - 4).toFixed(1), y: (y - 4).toFixed(1), width: '8', height: '8', fill: color, stroke: '#000' }, `${st.name}${st.mw ? ` · ${st.mw} MW` : ''} · ${st.place}`);
  }
  for (const st of storms) {
    const x = px(st.lon), y = py(st.lat);
    for (const r of [300, 150]) add('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: String((r / 111) * s), fill: 'none', stroke: '#ff6b6b', 'stroke-dasharray': '4 3', 'stroke-width': '1' }, `${r} km from ${st.title}`);
    add('text', { x: (x + 8).toFixed(1), y: (y - 8).toFixed(1), fill: '#ff6b6b', 'font-size': '12' }, st.title).textContent = `${st.title.replace(/^Tropical Cyclone\s*/i, 'TC ')}`;
    add('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: '6', fill: '#ff6b6b', stroke: '#000' }, `${st.title} · ${st.magnitude ?? '?'} ${st.unit ?? ''} · ${st.source ?? ''}`);
  }
  return svg;
}

export const powerScreen: Screen = {
  code: 'POWER',
  title: 'Power and disasters',
  mount(el) {
    let alive = true;
    const mapBox = h('div', { class: 'tp-map' }, stateBox('loading', 'Loading map…'));
    const stormBox = h('div', {}, stateBox('loading', 'Loading active storms…'));
    const siteBox = h('div', {}, stateBox('loading', 'Checking sites…'));
    const newsBox = h('div', {}, stateBox('loading', 'Loading energy and disaster news…'));
    el.append(h('section', { class: 'tp-screen' },
      h('header', { class: 'tp-screen-head' }, h('span', { class: 'tp-logo-sm' }, 'POWER'), h('h1', {}, 'POWER, GAS AND WEATHER RISK')),
      h('div', { class: 'tp-grid' },
        h('div', { class: 'tp-slot' }, panel({ n: 1, title: 'BAY OF BENGAL — STORMS, PLANTS, FIRES', code: 'WX', hint: 'CYCLONE MAP' }, mapBox,
          h('p', { class: 'tp-legend' }, h('span', { style: 'color:#bfbfbf' }, '■ Coal'), ' ', h('span', { style: 'color:#5bd96b' }, '■ Gas plant ● Gas field'), ' ', h('span', { style: 'color:#b388ff' }, '■ Nuclear'), ' ', h('span', { style: 'color:#4fc3f7' }, '■ LNG'), ' ', h('span', { style: 'color:#ff6b6b' }, '● Storm (rings 150/300 km)'), ' ', h('span', { style: 'color:#ff7a1a' }, '• Fire')))),
        h('div', { class: 'tp-slot' }, panel({ n: 2, title: 'ACTIVE STORMS NEAR BANGLADESH', code: 'CYCLONE', hint: 'CYCLONE' }, stormBox)),
        h('div', { class: 'tp-slot' }, panel({ n: 3, title: 'POWER AND GAS SITES — STORM DISTANCE', code: 'POWER', hint: 'POWER SITES' }, siteBox,
          h('div', { class: 'tp-stat-k' }, 'NOT CONNECTED YET'),
          h('ul', { class: 'tp-nc' },
            h('li', {}, h('span', { class: 'tp-w' }, 'Demand, generation and load-shedding by zone'), h('span', { class: 'tp-muted' }, ' — planned source: PGCB daily report')),
            h('li', {}, h('span', { class: 'tp-w' }, 'Cyclone signal numbers and port warnings'), h('span', { class: 'tp-muted' }, ' — planned source: Bangladesh Meteorological Department')),
            h('li', {}, h('span', { class: 'tp-w' }, 'River levels and flood forecasts'), h('span', { class: 'tp-muted' }, ' — planned source: FFWC'))))),
        h('div', { class: 'tp-slot' }, panel({ n: 4, title: 'ENERGY AND DISASTER NEWS', code: 'NEWS', hint: 'POWER NEWS' }, newsBox)))));

    const stormsP = fetch('/api/natural/v1/list-natural-events', { signal: AbortSignal.timeout(20_000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { events?: Array<{ id: string; title: string; category: string; lat: number; lon: number; date: number; magnitude?: number; magnitudeUnit?: string; sourceName?: string; sourceUrl?: string; closed?: boolean }> }) => {
        setStatus('Storms (EONET/GDACS)', 'ok');
        return (j.events ?? []).filter((e) => e.category === 'severeStorms' && !e.closed && inBox(e))
          .map((e): Storm => ({ id: e.id, title: e.title, lat: e.lat, lon: e.lon, date: e.date, magnitude: e.magnitude ?? null, unit: e.magnitudeUnit ?? null, source: e.sourceName ?? null, url: e.sourceUrl ?? null }));
      })
      .catch(() => { setStatus('Storms (EONET/GDACS)', 'error'); return null; });

    void Promise.all([stormsP, boundaries().catch(() => null), fires().catch(() => [] as GeoEvent[])]).then(([storms, geo, fireList]) => {
      if (!alive) return;
      mapBox.replaceChildren(geo ? drawMap(geo.districts, storms ?? [], fireList) : stateBox('error', 'Map boundaries unavailable.'));
      stormBox.replaceChildren(storms == null
        ? stateBox('error', 'Storm feed unavailable right now.')
        : storms.length
          ? h('ul', { class: 'tp-disc' }, ...storms.map((st) => {
            const dBd = distanceKm(st, { lat: 22.35, lon: 91.8 });
            return h('li', {}, h('b', { class: 'tp-down' }, st.title),
              h('div', { class: 'tp-w' }, `${fmtNum(st.lat, 1)}°N ${fmtNum(st.lon, 1)}°E · ${st.magnitude ?? '—'} ${st.unit ?? ''} · ${fmtNum(dBd, 0)} km from Chattogram`),
              h('div', { class: 'tp-muted' }, `${st.source ?? 'source n/a'} · ${dhakaDate(st.date)} ${dhakaTime(st.date)} DHK`),
              st.url ? h('a', { href: st.url, target: '_blank', rel: 'noopener noreferrer' }, 'Advisory ↗') : null);
          }))
          : h('p', { class: 'tp-up' }, 'No active storms in the Bay of Bengal right now.'),
      sourceLine('Source: NASA EONET (JTWC / GDACS advisories). Position only — official Bangladesh signals come from BMD (not connected yet).'));
      const list = storms ?? [];
      siteBox.replaceChildren(
        h('table', { class: 'tp-table' },
          h('thead', {}, h('tr', {}, h('th', {}, 'SITE'), h('th', { class: 'r' }, 'MW'), h('th', {}, 'PLACE'), h('th', { class: 'r' }, 'NEAREST STORM'))),
          h('tbody', {}, ...SITES.map((st) => {
            const nearest = list.map((x) => distanceKm(st, x)).sort((a, b) => a - b)[0];
            return h('tr', {}, h('td', { class: 'tp-w' }, st.name), h('td', { class: 'r' }, st.mw ? String(st.mw) : '—'), h('td', { class: 'tp-dim' }, st.place),
              h('td', { class: `r ${nearest != null && nearest < 300 ? 'tp-down' : nearest != null && nearest < 600 ? 'tp-amber' : ''}` }, nearest == null ? '—' : `${fmtNum(nearest, 0)} km`));
          }))),
        sourceLine('Reference list of major sites (approximate locations, public information). Red: within 300 km of an active storm; amber: within 600 km.'));
    });

    allNews().then((items) => {
      if (!alive) return;
      const news = items.filter((n) => ENERGY_NEWS.test(n.title) && (BD.test(`${n.title} ${n.source}`) || /[ঀ-৿]/.test(n.title)));
      const shedding = news.filter((n) => /load.?shedding|লোডশেডিং/i.test(n.title)).length;
      newsBox.replaceChildren(
        h('div', { class: 'tp-stats' },
          h('div', {}, h('div', { class: 'tp-stat-k' }, 'STORIES'), h('div', { class: 'tp-w' }, String(news.length))),
          h('div', {}, h('div', { class: 'tp-stat-k' }, 'LOAD-SHEDDING MENTIONS'), h('div', { class: shedding ? 'tp-amber' : 'tp-w' }, String(shedding)))),
        news.length
          ? h('ul', { class: 'tp-disc' }, ...news.slice(0, 14).map((n) => h('li', {}, h('a', { href: n.link, target: '_blank', rel: 'noopener noreferrer' }, n.title), h('span', { class: 'tp-muted' }, ` · ${n.source} · ${dhakaTime(n.publishedAt)}`))))
          : stateBox('empty', 'No Bangladesh energy or weather stories in the current digest.'),
        sourceLine('BDSI news digest, matched by energy and weather keywords (English and Bangla).'));
    }).catch(() => { if (alive) newsBox.replaceChildren(stateBox('error', 'News unavailable right now.')); });

    return () => { alive = false; };
  },
};
