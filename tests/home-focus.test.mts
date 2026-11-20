import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { selectHomeFocalPoints } from '../src/config/home-focus.ts';

const fp = (entityId: string, newsMentions: number, signalCount: number, signalTypes: string[] = [], entityType = 'country') =>
  ({ entityId, entityType, newsMentions, signalCount, signalTypes });

describe('AI Insights focal points with a Bangladesh home focus', () => {
  it('leads with Bangladesh and neighbours, keeping score order for the rest', () => {
    const ranked = [fp('AE', 40, 5), fp('US', 30, 4), fp('IN', 10, 2), fp('BD', 8, 1), fp('MM', 3, 1)];
    assert.deepEqual(selectHomeFocalPoints(ranked).map((p) => p.entityId), ['BD', 'MM', 'IN', 'AE', 'US']);
  });

  it('keeps Bangladesh when it is in the news even without a correlated signal', () => {
    const ranked = [fp('AE', 40, 5), fp('BD', 6, 0), fp('FR', 9, 0)];
    assert.deepEqual(selectHomeFocalPoints(ranked).map((p) => p.entityId), ['BD', 'AE']);
  });

  it('applies the upstream rule otherwise, and the limit', () => {
    const ranked = [fp('UA', 0, 0, ['active_strike']), fp('JP', 5, 0), fp('BD', 0, 0), fp('SPX', 9, 3, [], 'index')];
    assert.deepEqual(selectHomeFocalPoints(ranked).map((p) => p.entityId), ['UA', 'SPX']);
    assert.equal(selectHomeFocalPoints(Array.from({ length: 9 }, (_, i) => fp(`C${i}`, 1, 1))).length, 5);
  });
});
