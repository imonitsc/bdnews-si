import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { organizeBdsiPanels, applyBdsiLayoutToSaved, BDSI_PANEL_GROUPS, BDSI_REMOVED_PANELS } from '../src/config/bdsi-dashboard.ts';

const cfg = (enabled: boolean) => ({ name: 'x', enabled, priority: 1 });

describe('BDSI dashboard layout', () => {
  const upstream = { 'live-news': cfg(true), crypto: cfg(true), map: cfg(true), 'live-webcams': cfg(true), bangladesh: cfg(true), 'bd-dse': cfg(false), layoffs: cfg(true) };

  it('puts the map, then Bangladesh, first and drops webcams', () => {
    const out = organizeBdsiPanels(upstream);
    assert.deepEqual(Object.keys(out), ['map', 'bangladesh', 'bd-dse', 'live-news', 'crypto', 'layoffs']);
    assert.equal(out['bd-dse']!.enabled, true);
    assert.equal(out.crypto!.enabled, false);
    assert.ok(!('live-webcams' in out));
  });

  it('switches saved settings to the grouped defaults once', () => {
    const defaults = { map: cfg(true), bangladesh: cfg(true), crypto: cfg(false), 'bd-taka': cfg(true) };
    const saved = { map: cfg(true), bangladesh: cfg(false), crypto: cfg(true), 'live-webcams': cfg(true), 'cw-custom': cfg(true) };
    const out = applyBdsiLayoutToSaved(saved, defaults);
    assert.equal(out.bangladesh!.enabled, true);
    assert.equal(out.crypto!.enabled, false);
    assert.equal(out['bd-taka']!.enabled, true, 'missing default panel added');
    assert.equal(out['cw-custom']!.enabled, true, 'user widgets untouched');
    assert.ok(!('live-webcams' in out));
  });

  it('has no duplicate or removed panels in the groups', () => {
    const keys = BDSI_PANEL_GROUPS.flatMap((g) => g.keys);
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(keys.every((k) => !BDSI_REMOVED_PANELS.has(k)));
    assert.equal(BDSI_PANEL_GROUPS[0]!.label, 'Bangladesh');
  });
});

describe('BDSI dashboard tabs', async () => {
  const { tabOfPanel, panelShownInTab } = await import('../src/config/bdsi-dashboard.ts');
  it('maps panels to their group tab', () => {
    assert.equal(tabOfPanel('bd-dse'), 'bd');
    assert.equal(tabOfPanel('ucdp-events'), 'security');
    assert.equal(tabOfPanel('crypto'), 'other');
  });
  it('shows the map on every tab and everything on ALL', () => {
    assert.ok(panelShownInTab('map', 'markets'));
    assert.ok(panelShownInTab('crypto', 'all'));
    assert.ok(!panelShownInTab('crypto', 'bd'));
    assert.ok(panelShownInTab('asia', 'world'));
  });
});
