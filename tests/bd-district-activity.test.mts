import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BD_DISTRICTS, BD_DIVISIONS } from '../src/config/bd-admin.ts';
import {
  DistrictLocator, activityBand, cleanHeadline, computeDistrictActivity, districtsInText, type DistrictFeature,
} from '../src/services/bd-district-activity.ts';

const districtsGeo = JSON.parse(readFileSync(new URL('../public/data/bd-districts.geojson', import.meta.url), 'utf8'));
const divisionsGeo = JSON.parse(readFileSync(new URL('../public/data/bd-divisions.geojson', import.meta.url), 'utf8'));
const locator = new DistrictLocator(districtsGeo.features as DistrictFeature[]);
const NOW = Date.parse('2026-11-21T00:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000);

describe('Bangladesh admin table and boundaries', () => {
  it('has 64 districts in 8 divisions, each with a boundary', () => {
    assert.equal(BD_DISTRICTS.length, 64);
    assert.equal(new Set(BD_DISTRICTS.map((d) => d.id)).size, 64);
    assert.deepEqual([...new Set(BD_DISTRICTS.map((d) => d.division))].sort(), [...BD_DIVISIONS].sort());
    const geoIds = new Set(districtsGeo.features.map((f: { properties: { id: string } }) => f.properties.id));
    for (const d of BD_DISTRICTS) assert.ok(geoIds.has(d.id), `no boundary for ${d.id}`);
    assert.equal(divisionsGeo.features.length, 8);
    assert.match(districtsGeo.attribution, /CC BY 3\.0 IGO/);
  });

  it('places known cities in the right district', () => {
    assert.equal(locator.locate(23.8103, 90.4125), 'dhaka');        // Dhaka
    assert.equal(locator.locate(22.3569, 91.7832), 'chattogram');   // Chattogram port city
    assert.equal(locator.locate(24.8949, 91.8687), 'sylhet');       // Sylhet
    assert.equal(locator.locate(21.4272, 92.0058), 'coxs-bazar');   // Cox's Bazar
    assert.equal(locator.locate(24.3745, 88.6042), 'rajshahi');     // Rajshahi
    assert.equal(locator.locate(28.6139, 77.2090), null);            // New Delhi
    assert.equal(locator.locate(Number.NaN, 90), null);
  });
});

describe('headline → district matching', () => {
  it('matches current and old English spellings and Bangla names', () => {
    assert.deepEqual(districtsInText('Flood waters rise in Sunamganj and Sylhet'), ['sunamganj', 'sylhet']);
    assert.deepEqual(districtsInText('Chittagong port congestion eases'), ['chattogram']);
    assert.deepEqual(districtsInText("Rohingya camp fire in Cox's Bazar"), ['coxs-bazar']);
    assert.deepEqual(districtsInText('বগুড়ায় সড়ক দুর্ঘটনা'), ['bogura']);
    assert.deepEqual(districtsInText('Chapai Nawabganj mango exports'), ['chapai-nawabganj']);
  });

  it('ignores outlet credits and does not match inside other words', () => {
    assert.equal(cleanHeadline('Prices climb again - Dhaka Tribune'), 'Prices climb again');
    assert.deepEqual(districtsInText('Myanmar rejects court ruling - Dhaka Tribune'), []);
    assert.deepEqual(districtsInText('Report by Dhaka Post on markets'), []);
    assert.deepEqual(districtsInText('Fenix rises'), []);
  });
});

describe('district and division activity', () => {
  const snap = computeDistrictActivity({
    news: [
      { title: 'Clash in Feni leaves two injured', link: 'a', source: 'X', pubDate: hoursAgo(2) },
      { title: 'Clash in Feni leaves two injured', link: 'a', source: 'X', pubDate: hoursAgo(2) }, // duplicate
      { title: 'Old Feni story', link: 'b', source: 'X', pubDate: hoursAgo(24 * 9) },             // outside window
      { title: 'Sylhet tea prices', link: 'c', source: 'Y', pubDate: hoursAgo(1).toISOString() },
    ],
    protests: [{ lat: 23.8103, lon: 90.4125, time: hoursAgo(3) }, { lat: 28.6, lon: 77.2, time: hoursAgo(3) }],
    conflicts: [{ lat: 21.4272, lon: 92.0058, time: hoursAgo(5), fatalities: 2 }],
    fires: [{ lat: 22.3569, lon: 91.7832 }, { lat: 22.3569, lon: 91.7832 }],
  }, locator, { now: NOW });
  const get = (id: string) => snap.districts.find((d) => d.id === id)!;

  it('counts each source per district, in the window, without duplicates', () => {
    assert.equal(get('feni').news, 1);
    assert.equal(get('sylhet').news, 1);
    assert.equal(get('dhaka').protests, 1);
    assert.equal(get('coxs-bazar').conflicts, 1);
    assert.equal(get('coxs-bazar').fatalities, 2);
    assert.equal(get('chattogram').fires, 2);
    assert.deepEqual(snap.inputs, { newsItems: 2, protestEvents: 1, conflictEvents: 1, fireDetections: 2 });
  });

  it('scores with the published weights and rolls up to divisions', () => {
    assert.equal(get('dhaka').score, 3);
    assert.equal(get('coxs-bazar').score, 4);
    assert.equal(get('chattogram').score, 1);
    const ctgDiv = snap.divisions.find((d) => d.name === 'Chattogram')!;
    assert.equal(ctgDiv.score, 1 /* feni */ + 4 /* cox */ + 1 /* ctg fires */);
    assert.equal(snap.divisions.length, 8);
  });

  it('keeps the newest headlines per district', () => {
    assert.equal(get('feni').headlines[0]!.title, 'Clash in Feni leaves two injured');
  });

  it('works without boundaries (news only)', () => {
    const s = computeDistrictActivity({ news: [{ title: 'Rain in Khulna', link: 'k', source: 'Z', pubDate: hoursAgo(1) }], protests: [{ lat: 23.8, lon: 90.4, time: hoursAgo(1) }] }, null, { now: NOW });
    assert.equal(s.districts.find((d) => d.id === 'khulna')!.news, 1);
    assert.equal(s.inputs.protestEvents, 0);
  });

  it('bands scores 0–5 relative to the busiest district', () => {
    assert.equal(activityBand(0, 10), 0);
    assert.equal(activityBand(10, 10), 5);
    assert.ok(activityBand(1, 100) >= 1);
    assert.equal(activityBand(5, 0), 0);
  });
});

describe('conflict window', () => {
  it('keeps UCDP-lagged conflict events up to 30 days, news only 7', () => {
    const s = computeDistrictActivity({
      news: [{ title: 'Feni rally', link: 'n', source: 'S', pubDate: hoursAgo(24 * 20) }],
      conflicts: [{ lat: 21.4272, lon: 92.0058, time: hoursAgo(24 * 20) }, { lat: 21.4272, lon: 92.0058, time: hoursAgo(24 * 40) }],
    }, locator, { now: NOW });
    assert.equal(s.districts.find((d) => d.id === 'feni')!.news, 0);
    assert.equal(s.districts.find((d) => d.id === 'coxs-bazar')!.conflicts, 1);
  });
});
