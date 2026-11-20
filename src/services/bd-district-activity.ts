// BDSI: district- and division-level activity for Bangladesh, built from data the
// dashboard has already loaded: news headlines (matched to district names in English
// and Bangla), protests/unrest events, armed-conflict events and satellite fire
// detections (placed by coordinates inside district boundaries).
//
// This is an ACTIVITY measure (how much is being reported or detected where), not a
// risk or instability index. The score formula is shown to users with the layer.

import { BD_DISTRICTS, BD_DIVISIONS, type BdDivision } from '@/config/bd-admin';

export const ACTIVITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const SCORE_WEIGHTS = { news: 1, protests: 3, conflicts: 4, fires: 0.5 } as const;
/** UCDP publishes conflict events with a lag of weeks, so they get a longer window. */
export const CONFLICT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const SCORE_FORMULA = 'news + 3×protests + 4×conflict events + ½×fire detections (news and protests: last 7 days; conflict events: last 30 days, as UCDP reports with a delay; fires: latest satellite passes)';

export interface Headline { title: string; link: string; source: string; time: number }

export interface DistrictActivity {
  id: string;
  name: string;
  division: BdDivision;
  news: number;
  protests: number;
  conflicts: number;
  fatalities: number;
  fires: number;
  score: number;
  headlines: Headline[];
}

export interface DivisionActivity {
  name: BdDivision;
  news: number;
  protests: number;
  conflicts: number;
  fatalities: number;
  fires: number;
  score: number;
}

export interface BdActivitySnapshot {
  computedAt: number;
  windowMs: number;
  districts: DistrictActivity[];
  divisions: DivisionActivity[];
  /** Inputs actually used, so the UI can say what the numbers rest on. */
  inputs: { newsItems: number; protestEvents: number; conflictEvents: number; fireDetections: number };
}

// ---------- news → districts ----------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface Matcher { id: string; en: RegExp; bn: readonly string[] }

const MATCHERS: readonly Matcher[] = BD_DISTRICTS.map((d) => {
  const names = [d.name, ...(d.aliases ?? [])].map(escapeRegex);
  return { id: d.id, en: new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.join('|')})(?![\\p{L}\\p{N}])`, 'iu'), bn: d.bn };
});

/** Outlet names that contain a district name and must not count as a mention. */
const OUTLET_NAMES = /\b(Dhaka Tribune|Dhaka Post|Dhaka Courier|Dhaka Times|Sylhet Today|Chattogram Pratidin)\b|ঢাকা পোস্ট|ঢাকা টাইমস/giu;

/** Strip a trailing " - Outlet" / " | Outlet" credit and outlet names, which often name a city. */
export function cleanHeadline(title: string): string {
  return title.replace(/\s+[-–—|]\s+[^-–—|]{2,60}$/u, '').replace(OUTLET_NAMES, ' ');
}

/** District ids mentioned in a headline (English word match, Bangla substring match). */
export function districtsInText(title: string): string[] {
  const text = cleanHeadline(title);
  const ids: string[] = [];
  for (const m of MATCHERS) {
    if (m.en.test(text) || m.bn.some((b) => text.includes(b))) ids.push(m.id);
  }
  return ids;
}

// ---------- points → districts ----------

type Ring = number[][];
type PolygonCoords = Ring[];
export interface DistrictFeature {
  properties: { id: string };
  geometry: { type: 'Polygon'; coordinates: PolygonCoords } | { type: 'MultiPolygon'; coordinates: PolygonCoords[] };
}

interface IndexedDistrict { id: string; polygons: PolygonCoords[]; bbox: [number, number, number, number] }

function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(lon: number, lat: number, poly: PolygonCoords): boolean {
  if (!poly[0] || !inRing(lon, lat, poly[0])) return false;
  for (let h = 1; h < poly.length; h++) if (inRing(lon, lat, poly[h]!)) return false;
  return true;
}

export class DistrictLocator {
  private readonly index: IndexedDistrict[];
  private readonly bounds: [number, number, number, number];

  constructor(features: readonly DistrictFeature[]) {
    this.index = features.map((f) => {
      const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of polygons) for (const [x, y] of (p[0] ?? []) as Array<[number, number]>) {
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      return { id: f.properties.id, polygons, bbox: [minX, minY, maxX, maxY] };
    });
    this.bounds = this.index.reduce<[number, number, number, number]>((b, d) => [
      Math.min(b[0], d.bbox[0]), Math.min(b[1], d.bbox[1]), Math.max(b[2], d.bbox[2]), Math.max(b[3], d.bbox[3]),
    ], [Infinity, Infinity, -Infinity, -Infinity]);
  }

  /** District id containing the point, or null outside Bangladesh. */
  locate(lat: number, lon: number): string | null {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const [x0, y0, x1, y1] = this.bounds;
    if (lon < x0 || lon > x1 || lat < y0 || lat > y1) return null;
    for (const d of this.index) {
      if (lon < d.bbox[0] || lon > d.bbox[2] || lat < d.bbox[1] || lat > d.bbox[3]) continue;
      if (d.polygons.some((p) => inPolygon(lon, lat, p))) return d.id;
    }
    return null;
  }
}

// ---------- aggregation ----------

export interface ActivityInputs {
  news: ReadonlyArray<{ title: string; link: string; source: string; pubDate: Date | string | number }>;
  protests?: ReadonlyArray<{ lat: number; lon: number; time: Date | string | number }>;
  conflicts?: ReadonlyArray<{ lat: number; lon: number; time: Date | string | number; fatalities?: number }>;
  fires?: ReadonlyArray<{ lat: number; lon: number }>;
}

function toMs(v: Date | string | number): number {
  const t = v instanceof Date ? v.getTime() : typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(t) ? t : NaN;
}

export function computeDistrictActivity(
  inputs: ActivityInputs,
  locator: DistrictLocator | null,
  opts: { now?: number; windowMs?: number; conflictWindowMs?: number; headlinesPerDistrict?: number } = {},
): BdActivitySnapshot {
  const now = opts.now ?? Date.now();
  const windowMs = opts.windowMs ?? ACTIVITY_WINDOW_MS;
  const since = now - windowMs;
  const perDistrict = opts.headlinesPerDistrict ?? 3;
  const recent = (t: number) => Number.isFinite(t) && t >= since && t <= now + 3_600_000;
  const conflictSince = now - (opts.conflictWindowMs ?? CONFLICT_WINDOW_MS);
  const recentConflict = (t: number) => Number.isFinite(t) && t >= conflictSince && t <= now + 3_600_000;

  const byId = new Map<string, DistrictActivity>(BD_DISTRICTS.map((d) => [d.id, {
    id: d.id, name: d.name, division: d.division,
    news: 0, protests: 0, conflicts: 0, fatalities: 0, fires: 0, score: 0, headlines: [],
  }]));

  const seenLinks = new Set<string>();
  let newsItems = 0;
  for (const n of inputs.news) {
    const t = toMs(n.pubDate);
    if (!recent(t)) continue;
    const key = n.link || `${n.source}|${n.title}`;
    if (seenLinks.has(key)) continue;
    seenLinks.add(key);
    const ids = districtsInText(n.title);
    if (ids.length === 0) continue;
    newsItems++;
    for (const id of ids) {
      const d = byId.get(id)!;
      d.news++;
      d.headlines.push({ title: n.title, link: n.link, source: n.source, time: t });
    }
  }

  let protestEvents = 0, conflictEvents = 0, fireDetections = 0;
  if (locator) {
    for (const p of inputs.protests ?? []) {
      if (!recent(toMs(p.time))) continue;
      const id = locator.locate(p.lat, p.lon);
      if (id) { byId.get(id)!.protests++; protestEvents++; }
    }
    for (const c of inputs.conflicts ?? []) {
      if (!recentConflict(toMs(c.time))) continue;
      const id = locator.locate(c.lat, c.lon);
      if (id) {
        const d = byId.get(id)!;
        d.conflicts++; d.fatalities += Math.max(0, c.fatalities ?? 0); conflictEvents++;
      }
    }
    for (const f of inputs.fires ?? []) {
      const id = locator.locate(f.lat, f.lon);
      if (id) { byId.get(id)!.fires++; fireDetections++; }
    }
  }

  const districts = [...byId.values()];
  for (const d of districts) {
    d.score = d.news * SCORE_WEIGHTS.news + d.protests * SCORE_WEIGHTS.protests
      + d.conflicts * SCORE_WEIGHTS.conflicts + d.fires * SCORE_WEIGHTS.fires;
    d.headlines.sort((a, b) => b.time - a.time);
    d.headlines = d.headlines.slice(0, perDistrict);
  }

  const divisions: DivisionActivity[] = BD_DIVISIONS.map((name) => {
    const ds = districts.filter((d) => d.division === name);
    const sum = (k: 'news' | 'protests' | 'conflicts' | 'fatalities' | 'fires' | 'score') => ds.reduce((s, d) => s + d[k], 0);
    return { name, news: sum('news'), protests: sum('protests'), conflicts: sum('conflicts'), fatalities: sum('fatalities'), fires: sum('fires'), score: sum('score') };
  });

  return {
    computedAt: now,
    windowMs,
    districts,
    divisions,
    inputs: { newsItems, protestEvents, conflictEvents, fireDetections },
  };
}

/** 0 (none) … 5 (highest) colour band, relative to the busiest district right now. */
export function activityBand(score: number, maxScore: number): number {
  if (score <= 0 || maxScore <= 0) return 0;
  const r = Math.sqrt(score / maxScore); // sqrt so Dhaka does not wash out every other district
  return Math.min(5, Math.max(1, Math.ceil(r * 5)));
}
