import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BD_PRIMARY_LAYERS, getOrderedLayerKeys, layerGroupHeadingBefore } from '../src/config/map-layer-definitions.ts';
import { DEFAULT_MAP_LAYERS as FULL_MAP_LAYERS } from '../src/config/panels.ts';

describe('Bangladesh map layer preset', () => {
  const keys = getOrderedLayerKeys('full');

  it('lists the Bangladesh preset first, then the global layers', () => {
    const firstGlobal = keys.findIndex((k) => !BD_PRIMARY_LAYERS.has(k));
    assert.ok(firstGlobal > 0);
    assert.ok(keys.slice(0, firstGlobal).every((k) => BD_PRIMARY_LAYERS.has(k)));
    assert.ok(keys.slice(firstGlobal).every((k) => !BD_PRIMARY_LAYERS.has(k)));
    for (const k of ['canadaRoads', 'canadaAlerts', 'spaceports', 'satellites']) {
      assert.ok(keys.indexOf(k as never) >= firstGlobal, `${k} should be under Advanced / Global`);
    }
  });

  it('puts exactly one "Advanced / Global" heading before the first global layer', () => {
    const headings = keys.map((_, i) => layerGroupHeadingBefore(keys, i, 'full')).filter(Boolean);
    assert.equal(headings.length, 1);
    assert.match(headings[0]!, /Advanced \/ Global/);
    assert.equal(keys.map((_, i) => layerGroupHeadingBefore(keys, i, 'tech')).filter(Boolean).length, 0);
  });

  it('turns on no global-only layer by default', () => {
    const onByDefault = Object.entries(FULL_MAP_LAYERS).filter(([, v]) => v === true).map(([k]) => k);
    for (const k of ['canadaRoads', 'canadaAlerts', 'spaceports', 'satellites', 'nuclear', 'sanctions', 'economic']) {
      assert.ok(!onByDefault.includes(k), `${k} should be off by default`);
    }
  });
});
