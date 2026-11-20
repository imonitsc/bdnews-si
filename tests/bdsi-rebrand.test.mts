import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { rebrandText, brandPostProcessor } from '../src/config/brand-rebrand.ts';

describe('BDSI rebrand of upstream product names', () => {
  it('renames World Monitor in its common forms', () => {
    assert.equal(rebrandText('Enjoying World Monitor?'), 'Enjoying BD Situation Intelligence?');
    assert.equal(rebrandText('Get World Monitor Pro'), 'Get BDSI Pro');
    assert.equal(rebrandText('WORLD MONITOR · COUNTRY BRIEF'), 'BD SITUATION INTELLIGENCE · COUNTRY BRIEF');
    assert.equal(rebrandText('across all WorldMonitor sources'), 'across all BDSI sources');
    assert.equal(rebrandText("Not in WorldMonitor's sources"), "Not in BDSI's sources");
    assert.equal(rebrandText('<strong>WM Analyst</strong> AI analyst'), '<strong>BDSI Analyst</strong> AI analyst');
    assert.equal(rebrandText('WM // COMMAND DECK'), 'BDSI // COMMAND DECK');
  });

  it('leaves URLs, headers and unrelated text alone', () => {
    assert.equal(rebrandText('https://www.worldmonitor.app/docs'), 'https://www.worldmonitor.app/docs');
    assert.equal(rebrandText('X-WorldMonitor-Key'), 'X-WorldMonitor-Key');
    assert.equal(rebrandText('Dhaka Stock Exchange'), 'Dhaka Stock Exchange');
    assert.equal(rebrandText('WMO Severe Weather'), 'WMO Severe Weather');
    assert.equal(rebrandText(''), '');
    assert.equal(rebrandText(42 as unknown as string), 42);
  });

  it('exposes an i18next post-processor', () => {
    assert.equal(brandPostProcessor.type, 'postProcessor');
    assert.equal(brandPostProcessor.process('Install World Monitor'), 'Install BD Situation Intelligence');
  });
});
