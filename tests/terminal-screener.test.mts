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
