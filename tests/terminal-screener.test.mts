import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { screen, DEFAULT_CRITERIA, type Row } from '../src/terminal/screens/screener.ts';

const row = (code: string, o: Partial<Row> = {}): Row => ({ code, ltp: 10, ycp: 10, high: 10, low: 10, volume: 100, valueMn: 1, trades: 5, percent: 0, category: 'A', board: 'PUBLIC', sector: 'Bank', assetType: 'EQ', ...o });

describe('DSE screener filter', () => {
  const rows = [
    row('BRACBANK', { ltp: 50, percent: 2, valueMn: 40 }),
    row('GP', { ltp: 226.7, percent: -0.04, sector: 'Telecom', valueMn: 22 }),
    row('MATINSPINN', { ltp: 137.8, percent: 11, sector: 'Textile' }),
    row('IDLE', { trades: 0 }),
    row('1JANATAMF', { assetType: 'MF', sector: 'MutFund' }),
  ];
  it('defaults to traded equities', () => {
    assert.deepEqual(screen(rows, DEFAULT_CRITERIA).map((r) => r.code), ['BRACBANK', 'GP', 'MATINSPINN']);
  });
  it('filters by sector, price, change, value and code text', () => {
    assert.deepEqual(screen(rows, { ...DEFAULT_CRITERIA, sector: 'Textile' }).map((r) => r.code), ['MATINSPINN']);
    assert.deepEqual(screen(rows, { ...DEFAULT_CRITERIA, minPrice: 100 }).map((r) => r.code), ['GP', 'MATINSPINN']);
    assert.deepEqual(screen(rows, { ...DEFAULT_CRITERIA, minChange: 1, maxChange: 5 }).map((r) => r.code), ['BRACBANK']);
    assert.deepEqual(screen(rows, { ...DEFAULT_CRITERIA, minValueMn: 30 }).map((r) => r.code), ['BRACBANK']);
    assert.deepEqual(screen(rows, { ...DEFAULT_CRITERIA, text: 'bank' }).map((r) => r.code), ['BRACBANK']);
    assert.deepEqual(screen(rows, { ...DEFAULT_CRITERIA, assetType: '', tradedOnly: false }).length, 5);
  });
});

import { sectorStats, SECTOR_PRESETS } from '../src/terminal/screens/research.ts';

describe('sector research', () => {
  it('computes sector KPIs from traded rows only', () => {
    const s = sectorStats([row('A', { percent: 2, valueMn: 3 }), row('B', { percent: -1, valueMn: 1 }), row('C', { trades: 0, percent: 5 })]);
    assert.deepEqual(s, { listed: 3, traded: 2, advanced: 1, declined: 1, valueMn: 4, avgChange: 0.5 });
  });
  it('matches RMG news in English and Bangla', () => {
    const rmg = SECTOR_PRESETS[0]!;
    assert.ok(rmg.news.test('Garment exports rise in October'));
    assert.ok(rmg.news.test('তৈরি পোশাক রপ্তানি বেড়েছে'));
    assert.ok(!rmg.news.test('Cricket team wins series'));
  });
});

import { distanceKm, SITES } from '../src/terminal/screens/power.ts';

describe('power screen', () => {
  it('measures great-circle distance', () => {
    const d = distanceKm({ lat: 23.81, lon: 90.41 }, { lat: 22.36, lon: 91.78 }); // Dhaka → Chattogram ≈ 210 km
    assert.ok(d > 200 && d < 225, String(d));
    assert.equal(distanceKm({ lat: 1, lon: 1 }, { lat: 1, lon: 1 }), 0);
  });
  it('keeps every reference site inside Bangladesh or its coast', () => {
    for (const s of SITES) assert.ok(s.lat > 20.5 && s.lat < 26.7 && s.lon > 88 && s.lon < 92.7, s.name);
  });
});
