// BDSI: keeps the "BD Districts" map layer fed. Loads the district/division boundaries
// once (static files in public/data, CC BY 3.0 IGO, BBS/OCHA via geoBoundaries), then
// every minute recomputes district activity from what the dashboard already has in
// memory (news, protests, UCDP conflict events, satellite fires) and hands it to the map.
// No extra network calls beyond the two boundary files.

import type { AppContext } from '@/app/app-context';
import {
  computeDistrictActivity, DistrictLocator, type BdActivitySnapshot, type DistrictFeature,
} from '@/services/bd-district-activity';

type FeatureCollection = { type: 'FeatureCollection'; features: unknown[] };

const REFRESH_MS = 60_000;
let stop: (() => void) | null = null;
let latest: BdActivitySnapshot | null = null;

/** Most recent district activity (for panels or commands that want the numbers). */
export function latestBdDistrictActivity(): BdActivitySnapshot | null {
  return latest;
}

async function loadBoundaries(): Promise<{ districts: FeatureCollection; divisions: FeatureCollection } | null> {
  try {
    const [d, v] = await Promise.all(['/data/bd-districts.geojson', '/data/bd-divisions.geojson'].map(async (url) => {
      const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return (await r.json()) as FeatureCollection;
    }));
    return { districts: d!, divisions: v! };
  } catch (err) {
    console.warn('[bd-districts] boundaries unavailable', err);
    return null;
  }
}

export function startBdDistrictActivity(ctx: AppContext): void {
  stop?.();
  let cancelled = false;
  let locator: DistrictLocator | null = null;
  let boundaries: { districts: FeatureCollection; divisions: FeatureCollection } | null = null;
  let timer: number | null = null;

  const tick = () => {
    if (cancelled || ctx.isDestroyed) return;
    const cache = ctx.intelligenceCache;
    const ucdp = ctx.map?.getCachedUcdpEvents?.() ?? [];
    latest = computeDistrictActivity({
      news: ctx.allNews,
      protests: cache.protests?.events ?? [],
      conflicts: [
        ...(cache.conflicts ?? []).map((c) => ({ lat: c.lat, lon: c.lon, time: c.time, fatalities: c.fatalities })),
        ...ucdp.map((u) => ({ lat: u.latitude, lon: u.longitude, time: u.date_start, fatalities: u.deaths_best })),
      ],
      fires: cache.satelliteFires ?? [],
    }, locator);
    // Boundaries go with every update (same objects, so nothing is re-parsed): the map
    // can be created after they load, and a one-off hand-over would then be lost.
    ctx.map?.setBdDistricts(boundaries, latest);
  };

  void loadBoundaries().then((loaded) => {
    if (cancelled) return;
    boundaries = loaded;
    if (loaded) locator = new DistrictLocator(loaded.districts.features as DistrictFeature[]);
    tick();
    // First minute: retry quickly so the layer appears as soon as the map exists.
    let quick = 0;
    const warm = window.setInterval(() => { tick(); if (++quick >= 6 || cancelled) window.clearInterval(warm); }, 5_000);
    timer = window.setInterval(tick, REFRESH_MS);
  });

  stop = () => {
    cancelled = true;
    if (timer != null) window.clearInterval(timer);
    stop = null;
  };
}
