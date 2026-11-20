import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { mapIodaEvents, fetchIodaOutages } from '../scripts/lib/ioda-outages.mjs';

const NOW = 1795208052; // 2026-11-20T20:54:12Z, the fixture's request time
const fixture = JSON.parse(readFileSync(new URL('./fixtures/ioda-outage-events.json', import.meta.url), 'utf8'));

describe('IODA outage events → infra:outages:v1', () => {
  it('merges a country’s signals into one outage with the panel’s fields', () => {
    const out = mapIodaEvents(fixture, { nowSec: NOW });
    const cn = out.filter((o) => o.country === 'China');
    assert.equal(cn.length, 1);
    const o = cn[0];
    assert.equal(o.id, 'ioda-CN-1794492000');
    assert.equal(o.link, 'https://ioda.inetintel.cc.gatech.edu/country/CN');
    assert.deepEqual(o.categories, ['IODA', 'BGP routing', 'Google traffic']);
    assert.equal(o.severity, 'OUTAGE_SEVERITY_MAJOR'); // two independent signals
    assert.equal(o.detectedAt, 1794492000 * 1000);
    assert.equal(o.endedAt, (1794492000 + 300000) * 1000);
    assert.ok(o.location.latitude && o.location.longitude);
    assert.ok(!('_score' in o) && !('_focus' in o));
  });

  it('marks an event that runs to the window end as ongoing', () => {
    const gi = mapIodaEvents(fixture, { nowSec: NOW }).find((o) => o.country === 'Venezuela');
    assert.equal(gi.endedAt, 0);
    assert.equal(gi.severity, 'OUTAGE_SEVERITY_PARTIAL');
    assert.match(gi.description, /still ongoing/);
  });

  it('keeps South Asia focus countries ahead of stronger signals when capping', () => {
    const out = mapIodaEvents(fixture, { nowSec: NOW, maxOutages: 1 });
    assert.equal(out.length, 1);
    assert.equal(out[0].country, 'Bangladesh');
  });

  it('drops old events, non-country locations and unknown codes; never reports TOTAL', () => {
    const out = mapIodaEvents(fixture, { nowSec: NOW });
    assert.ok(!out.some((o) => o.country === 'Old Place'));
    assert.ok(!out.some((o) => /region|asn/i.test(o.id)));
    assert.ok(!out.some((o) => o.severity === 'OUTAGE_SEVERITY_TOTAL'));
  });

  it('rejects a malformed or error response instead of reporting zero outages', () => {
    assert.throws(() => mapIodaEvents({ data: null }, { nowSec: NOW }), /no data array/);
    assert.throws(() => mapIodaEvents({ data: [], error: 'boom' }, { nowSec: NOW }), /boom/);
  });

  it('fetches with a timeout and surfaces HTTP errors', async () => {
    let seen;
    const ok = await fetchIodaOutages({ fetchImpl: async (url, init) => { seen = { url, init }; return { ok: true, json: async () => ({ data: [] }) }; } });
    assert.deepEqual(ok.outages, []);
    assert.match(seen.url, /entityType=country/);
    assert.ok(seen.init.signal);
    await assert.rejects(fetchIodaOutages({ fetchImpl: async () => ({ ok: false, status: 503 }) }), /IODA API error: 503/);
  });
});
