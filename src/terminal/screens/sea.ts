// BDSI terminal: SEA — Bay of Bengal, ports and borders.
// Live: active storms, UCDP conflict events and GDELT unrest near the borders,
// UNHCR Rohingya figures, port/shipping and border/Rohingya news.
// Reference: ports, submarine-cable landings, LNG terminals, refugee camps
// (approximate locations). Not connected: live AIS vessel positions (needs a
// licensed AIS feed or BDSI's own receivers), CPA port queue, dark-vessel detection.

import type { Screen } from '../shell';
import { h, fmtInt, fmtNum, dhakaTime, panel, sourceLine, stateBox } from '../dom';
import { allNews, boundaries, conflicts, unrest, setStatus, type GeoEvent } from '../data';
import { bayMap, type Marker } from '../bay-map';

export const INFRA: Array<{ name: string; kind: 'port' | 'cable' | 'lng' | 'camp'; lat: number; lon: number; note: string }> = [
  { name: 'Chattogram port', kind: 'port', lat: 22.31, lon: 91.8, note: "Bangladesh's main seaport" },
  { name: 'Mongla port', kind: 'port', lat: 22.49, lon: 89.6, note: 'Second seaport (Bagerhat)' },
  { name: 'Payra port', kind: 'port', lat: 21.83, lon: 90.27, note: 'Patuakhali' },
  { name: 'Matarbari deep-sea port (under construction)', kind: 'port', lat: 21.72, lon: 91.87, note: "Moheshkhali, Cox's Bazar" },
  { name: "SEA-ME-WE 4 landing, Cox's Bazar", kind: 'cable', lat: 21.43, lon: 91.98, note: 'Submarine cable landing' },
  { name: 'SEA-ME-WE 5 landing, Kuakata', kind: 'cable', lat: 21.82, lon: 90.12, note: 'Submarine cable landing' },
  { name: 'Moheshkhali FSRUs (LNG)', kind: 'lng', lat: 21.53, lon: 91.86, note: 'Two floating LNG terminals' },
  { name: 'Kutupalong–Balukhali camps', kind: 'camp', lat: 21.21, lon: 92.16, note: "Rohingya refugee camps, Ukhia, Cox's Bazar" },
  { name: 'Bhasan Char', kind: 'camp', lat: 22.37, lon: 91.4, note: 'Rohingya relocation island, Noakhali' },
];

const SEA_BOX = { minLon: 87.5, maxLon: 94.5, minLat: 19.5, maxLat: 27 };
const PORT_NEWS = /\b(port|chattogram|chittagong|mongla|payra|matarbari|container|vessel|ship|shipping|freight|cargo|bay of bengal|maritime|coast guard|navy|fishing ban|trawler|sea|lng)|বন্দর|কনটেইনার|জাহাজ|বঙ্গোপসাগর|নৌবাহিনী|কোস্ট গার্ড/i;
// Strong terms match alone; generic ones (border, Myanmar, refugee…) need a Bangladesh mention.
const BORDER_STRONG = /\b(rohingya|rakhine|arakan army|teknaf|naf river|ukhia|bhasan char|bgb|bsf)\b|রোহিঙ্গা|টেকনাফ|উখিয়া|বিজিবি|বিএসএফ|সীমান্ত/i;
const BORDER_GENERIC = /\b(border|myanmar|refugees?|smuggl\w*|push-?in|infiltrat\w*)\b|মিয়ানমার|শরণার্থী/i;
const BD_CONTEXT = /bangladesh|dhaka|chattogram|chittagong|cox'?s bazar|sylhet|[ঀ-৿]/i;
export const isBorderNews = (title: string, source = ''): boolean => BORDER_STRONG.test(title) || (BORDER_GENERIC.test(title) && BD_CONTEXT.test(`${title} ${source}`));

export const seaScreen: Screen = {
  code: 'SEA',
  title: 'Bay of Bengal and borders',
  mount(el) {
    let alive = true;
    const mapBox = h('div', { class: 'tp-map' }, stateBox('loading', 'Loading map…'));
    const borderBox = h('div', {}, stateBox('loading', 'Loading border and Rohingya picture…'));
    const portBox = h('div', {}, stateBox('loading', 'Loading port and shipping news…'));
    el.append(h('section', { class: 'tp-screen' },
      h('header', { class: 'tp-screen-head' }, h('span', { class: 'tp-logo-sm' }, 'SEA'), h('h1', {}, 'BAY OF BENGAL — PORTS, INFRASTRUCTURE AND BORDERS')),
      h('div', { class: 'tp-grid' },
        h('div', { class: 'tp-slot' }, panel({ n: 1, title: 'MAP — PORTS, CABLES, CAMPS, EVENTS', code: 'SEA', hint: 'SEA MAP' }, mapBox,
          h('p', { class: 'tp-legend' }, h('span', { style: 'color:#4fc3f7' }, '■ Port'), ' ', h('span', { style: 'color:#b388ff' }, '◆ Cable landing'), ' ', h('span', { style: 'color:#5bd96b' }, '■ LNG'), ' ', h('span', { style: 'color:#ffd34d' }, '● Refugee camp'), ' ', h('span', { style: 'color:#ff6b6b' }, '● Conflict (UCDP)'), ' ', h('span', { style: 'color:#ffb000' }, '• Unrest (GDELT, unverified)')),
          sourceLine('Infrastructure: reference list, approximate locations. Events: UCDP (30 days), GDELT unrest (7 days, unverified).'))),
        h('div', { class: 'tp-slot' }, panel({ n: 2, title: 'MYANMAR BORDER AND ROHINGYA', code: 'BORDER', hint: 'BORDER' }, borderBox)),
        h('div', { class: 'tp-slot' }, panel({ n: 3, title: 'PORTS AND SHIPPING NEWS', code: 'PORT', hint: 'PORT' }, portBox)),
        h('div', { class: 'tp-slot' }, panel({ n: 4, title: 'VESSELS AND AIRCRAFT', code: 'AIS', hint: 'SEA AIS' },
          stateBox('planned', 'Live vessel positions are not connected. BDSI uses only licensed or self-run sources for this: BDSI-run AIS-catcher receivers at Chattogram, Mongla and Cox\'s Bazar (separate service) or a licensed satellite AIS provider. OpenSky, adsb.fi and Global Fishing Watch stay off until licensed.'),
          h('div', { class: 'tp-stat-k' }, 'ALSO NOT CONNECTED YET'),
          h('ul', { class: 'tp-nc' },
            h('li', {}, h('span', { class: 'tp-w' }, 'Port queue at Chattogram, Mongla, Payra'), h('span', { class: 'tp-muted' }, ' — planned source: Chittagong Port Authority daily berthing')),
            h('li', {}, h('span', { class: 'tp-w' }, 'Dark-vessel detection'), h('span', { class: 'tp-muted' }, ' — planned: Sentinel-1 radar matched against AIS')),
            h('li', {}, h('span', { class: 'tp-w' }, 'Cable and pipeline status'), h('span', { class: 'tp-muted' }, ' — planned: operator notices'))),
          h('p', {}, h('a', { href: '/dashboard' }, 'Global ship and flight layers on the full map ↗')))))));

    const cutoff7 = Date.now() - 7 * 864e5, cutoff30 = Date.now() - 30 * 864e5;
    void Promise.all([
      boundaries().catch(() => null),
      conflicts().catch(() => [] as GeoEvent[]),
      unrest().catch(() => [] as GeoEvent[]),
      fetch('/api/natural/v1/list-natural-events', { signal: AbortSignal.timeout(20_000) }).then((r) => (r.ok ? r.json() : { events: [] })).catch(() => ({ events: [] })),
    ]).then(([geo, conf, unr, nat]) => {
      if (!alive) return;
      const storms = ((nat as { events?: Array<{ title: string; category: string; lat: number; lon: number; closed?: boolean }> }).events ?? []).filter((e) => e.category === 'severeStorms' && !e.closed);
      const markers: Marker[] = [
        ...unr.filter((e) => e.time >= cutoff7 && !(e.city && e.country && e.city.toLowerCase() === e.country.toLowerCase())).map((e): Marker => ({ lat: e.lat, lon: e.lon, shape: 'dot', color: '#ffb000', size: 5, title: `Unrest report (GDELT, unverified)${e.city ? ` · ${e.city}` : ''}` })),
        ...conf.filter((e) => e.time >= cutoff30).map((e): Marker => ({ lat: e.lat, lon: e.lon, shape: 'circle', color: '#ff6b6b', size: 4, title: `Conflict event (UCDP)${e.fatalities ? ` · ${e.fatalities} deaths` : ''}` })),
        ...INFRA.map((i): Marker => ({ lat: i.lat, lon: i.lon, shape: i.kind === 'cable' ? 'diamond' : i.kind === 'camp' ? 'circle' : 'square', color: i.kind === 'port' ? '#4fc3f7' : i.kind === 'cable' ? '#b388ff' : i.kind === 'lng' ? '#5bd96b' : '#ffd34d', size: 5, title: `${i.name} — ${i.note}` })),
        ...storms.map((s): Marker => ({ lat: s.lat, lon: s.lon, shape: 'circle', color: '#ff6b6b', size: 7, title: s.title, label: s.title.replace(/^Tropical Cyclone\s*/i, 'TC ') })),
      ];
      mapBox.replaceChildren(geo ? bayMap({ districts: geo.districts, box: SEA_BOX, markers, ariaLabel: 'Bangladesh coast and borders: ports, cable landings, refugee camps, conflict and unrest events' }) : stateBox('error', 'Map boundaries unavailable.'));
    });

    const unhcr = fetch('/api/displacement/v1/get-displacement-summary', { signal: AbortSignal.timeout(20_000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { summary?: { year?: number; countries?: Array<{ code: string; hostRefugees?: number; hostAsylumSeekers?: number; idps?: number; refugees?: number }>; topFlows?: Array<{ originCode: string; asylumCode: string; refugees: number }> } }) => {
        setStatus('UNHCR', 'ok');
        const s = j.summary ?? (j as unknown as NonNullable<typeof j.summary>);
        const bd = s.countries?.find((c) => c.code === 'BGD');
        const mm = s.countries?.find((c) => c.code === 'MMR');
        const flow = s.topFlows?.find((f) => f.originCode === 'MMR' && f.asylumCode === 'BGD');
        return { year: s.year ?? null, hosted: bd?.hostRefugees ?? null, fromMyanmar: flow?.refugees ?? null, myanmarIdps: mm?.idps ?? null };
      })
      .catch(() => { setStatus('UNHCR', 'error'); return null; });

    void Promise.all([unhcr, allNews().catch(() => null)]).then(([u, items]) => {
      if (!alive) return;
      const border = (items ?? []).filter((n) => isBorderNews(n.title, n.source));
      const ports = (items ?? []).filter((n) => PORT_NEWS.test(n.title) && (/bangladesh|bay of bengal|chattogram|chittagong|mongla|payra|[ঀ-৿]/i.test(`${n.title} ${n.source}`)));
      borderBox.replaceChildren(
        u ? h('div', { class: 'tp-stats' },
          h('div', {}, h('div', { class: 'tp-stat-k' }, 'REFUGEES HOSTED'), h('div', { class: 'tp-w' }, fmtInt(u.hosted))),
          h('div', {}, h('div', { class: 'tp-stat-k' }, 'FROM MYANMAR'), h('div', { class: 'tp-w' }, fmtInt(u.fromMyanmar))),
          h('div', {}, h('div', { class: 'tp-stat-k' }, 'IDPS IN MYANMAR'), h('div', { class: 'tp-w' }, fmtInt(u.myanmarIdps))),
          h('div', {}, h('div', { class: 'tp-stat-k' }, 'UNHCR YEAR'), h('div', { class: 'tp-w' }, u.year ? String(u.year) : '—')))
          : stateBox('error', 'UNHCR figures unavailable right now.'),
        ...(u ? [sourceLine('Source: UNHCR Refugee Data Finder (annual statistics, not live counts).')] : []),
        h('div', { class: 'tp-stat-k' }, `BORDER AND ROHINGYA NEWS · ${border.length}`),
        border.length ? h('ul', { class: 'tp-disc' }, ...border.slice(0, 10).map((n) => h('li', {}, h('a', { href: n.link, target: '_blank', rel: 'noopener noreferrer' }, n.title), h('span', { class: 'tp-muted' }, ` · ${n.source} · ${dhakaTime(n.publishedAt)}`))))
          : h('p', { class: 'tp-muted' }, items ? 'No border or Rohingya stories in the current digest.' : 'News unavailable right now.'));
      portBox.replaceChildren(
        ports.length ? h('ul', { class: 'tp-disc' }, ...ports.slice(0, 14).map((n) => h('li', {}, h('a', { href: n.link, target: '_blank', rel: 'noopener noreferrer' }, n.title), h('span', { class: 'tp-muted' }, ` · ${n.source} · ${dhakaTime(n.publishedAt)}`))))
          : stateBox(items ? 'empty' : 'error', items ? 'No Bangladesh port or shipping stories in the current digest.' : 'News unavailable right now.'),
        sourceLine(`BDSI news digest, matched by port and maritime keywords (English and Bangla). ${fmtNum(ports.length, 0)} stories.`));
    });

    return () => { alive = false; };
  },
};
