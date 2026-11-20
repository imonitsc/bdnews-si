// BDSI terminal: data sources. Each fetch records its health (ok / stale / error,
// last success) so the footer can show it, as CLAUDE.md §3.4 asks.

import { fetchBdMarkets, type BdMarkets } from '@/services/bd-markets';
import { isBangladeshNews } from '@/config/bangladesh-news';

export type Health = 'ok' | 'stale' | 'error' | 'loading';

export interface SourceStatus { name: string; health: Health; lastOk: number | null; note?: string }

const statuses = new Map<string, SourceStatus>();
const listeners = new Set<() => void>();

export function setStatus(name: string, health: Health, note?: string): void {
  const prev = statuses.get(name);
  statuses.set(name, { name, health, note, lastOk: health === 'ok' || health === 'stale' ? Date.now() : prev?.lastOk ?? null });
  for (const l of listeners) l();
}

export function allStatuses(): SourceStatus[] {
  return [...statuses.values()];
}

export function onStatusChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function getJson<T>(url: string, timeoutMs = 20_000): Promise<T> {
  const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return (await r.json()) as T;
}

/** Caches one in-flight/recent promise per key. */
function cached<T>(ttlMs: number, load: () => Promise<T>): (force?: boolean) => Promise<T> {
  let at = 0;
  let p: Promise<T> | null = null;
  return (force = false) => {
    if (!force && p && Date.now() - at < ttlMs) return p;
    at = Date.now();
    p = load().catch((e) => { at = 0; throw e; });
    return p;
  };
}

// ---------- markets ----------

export const markets = cached<BdMarkets>(30_000, async () => {
  try {
    const d = await fetchBdMarkets(true);
    setStatus('DSE', d.dse && !d.dse.error ? (d.dse.stale ? 'stale' : 'ok') : 'error');
    setStatus('Bangladesh Bank', d.fx && !d.fx.error ? (d.fx.stale || d.fx.official === false ? 'stale' : 'ok') : 'error',
      d.fx?.official === false ? 'fallback rates' : undefined);
    setStatus('TCB bazaar', d.bazaar && !d.bazaar.error ? (d.bazaar.stale ? 'stale' : 'ok') : 'error');
    return d;
  } catch (e) {
    for (const n of ['DSE', 'Bangladesh Bank', 'TCB bazaar']) setStatus(n, 'error');
    throw e;
  }
});

// ---------- news ----------

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: number;
  isAlert: boolean;
  category: string;
}

interface DigestItem { title?: string; link?: string; source?: string; publishedAt?: number | string; isAlert?: boolean }
interface Digest { categories?: Record<string, { items?: DigestItem[] }>; coverage?: { servedStale?: boolean; state?: string } }

export const allNews = cached<NewsItem[]>(120_000, async () => {
  try {
    const d = await getJson<Digest>('/api/news/v1/list-feed-digest?variant=full&lang=en', 25_000);
    const out: NewsItem[] = [];
    const seen = new Set<string>();
    for (const [category, bucket] of Object.entries(d.categories ?? {})) {
      for (const it of bucket.items ?? []) {
        if (!it.title || !it.link || seen.has(it.link)) continue;
        seen.add(it.link);
        const t = typeof it.publishedAt === 'number' ? it.publishedAt : Date.parse(String(it.publishedAt ?? ''));
        out.push({ title: it.title, link: it.link, source: it.source ?? '', publishedAt: Number.isFinite(t) ? t : 0, isAlert: !!it.isAlert, category });
      }
    }
    out.sort((a, b) => b.publishedAt - a.publishedAt);
    setStatus('News', d.coverage?.servedStale ? 'stale' : 'ok');
    return out;
  } catch (e) {
    setStatus('News', 'error');
    throw e;
  }
});

export async function bdNews(): Promise<NewsItem[]> {
  return (await allNews()).filter((n) => isBangladeshNews(n));
}

// ---------- events for the risk map ----------

export interface GeoEvent { lat: number; lon: number; time: number; city?: string; country?: string; fatalities?: number }

export const unrest = cached<GeoEvent[]>(300_000, async () => {
  try {
    const d = await getJson<{ events?: Array<{ location?: { latitude: number; longitude: number }; occurredAt?: number; city?: string; country?: string; fatalities?: number }> }>('/api/unrest/v1/list-unrest-events');
    setStatus('Protests (GDELT)', 'ok');
    return (d.events ?? []).filter((e) => e.location).map((e) => ({
      lat: e.location!.latitude, lon: e.location!.longitude, time: e.occurredAt ?? 0, city: e.city, country: e.country, fatalities: e.fatalities,
    }));
  } catch (e) {
    setStatus('Protests (GDELT)', 'error');
    throw e;
  }
});

export const fires = cached<GeoEvent[]>(300_000, async () => {
  try {
    const d = await getJson<{ fireDetections?: Array<{ location?: { latitude: number; longitude: number }; detectedAt?: number }> }>('/api/wildfire/v1/list-fire-detections');
    const out = (d.fireDetections ?? []).filter((f) => f.location).map((f) => ({ lat: f.location!.latitude, lon: f.location!.longitude, time: f.detectedAt ?? 0 }));
    setStatus('NASA FIRMS', out.length ? 'ok' : 'stale', out.length ? undefined : 'no detections loaded');
    return out;
  } catch (e) {
    setStatus('NASA FIRMS', 'error');
    throw e;
  }
});

export const conflicts = cached<GeoEvent[]>(600_000, async () => {
  try {
    const d = await getJson<{ events?: Array<{ location?: { latitude: number; longitude: number }; dateStart?: number; deathsBest?: number; hasPreciseLocation?: boolean }> }>('/api/conflict/v1/list-ucdp-events');
    const ev = (d.events ?? []).filter((e) => e.location && e.hasPreciseLocation !== false);
    setStatus('UCDP', ev.length ? 'ok' : 'stale', ev.length ? undefined : 'waiting for UCDP access token');
    return ev.map((e) => ({ lat: e.location!.latitude, lon: e.location!.longitude, time: e.dateStart ?? 0, fatalities: e.deathsBest ?? 0 }));
  } catch (e) {
    setStatus('UCDP', 'error');
    throw e;
  }
});

// ---------- boundaries ----------

export interface FeatureCollection { type: 'FeatureCollection'; attribution?: string; features: Array<{ properties: Record<string, string>; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } }> }

export const boundaries = cached<{ districts: FeatureCollection; divisions: FeatureCollection }>(86_400_000, async () => {
  const [districts, divisions] = await Promise.all([
    getJson<FeatureCollection>('/data/bd-districts.geojson'),
    getJson<FeatureCollection>('/data/bd-divisions.geojson'),
  ]);
  return { districts, divisions };
});
