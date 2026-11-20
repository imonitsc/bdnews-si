import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { floorSeedTtl } from '../scripts/_seed-utils.mjs';

describe('BDSI seed TTL floor (SEED_MIN_TTL_SECONDS)', () => {
  it('changes nothing when unset, as upstream', () => {
    assert.equal(floorSeedTtl(1800, {}), 1800);
    assert.equal(floorSeedTtl(1800, { SEED_MIN_TTL_SECONDS: '' }), 1800);
    assert.equal(floorSeedTtl(1800, { SEED_MIN_TTL_SECONDS: 'abc' }), 1800);
  });

  it('raises short TTLs to the floor and keeps longer ones', () => {
    const env = { SEED_MIN_TTL_SECONDS: '21600' };
    assert.equal(floorSeedTtl(1800, env), 21600);
    assert.equal(floorSeedTtl(7200, env), 21600);
    assert.equal(floorSeedTtl(86400, env), 86400);
  });

  it('leaves "no expiry" alone', () => {
    const env = { SEED_MIN_TTL_SECONDS: '21600' };
    assert.equal(floorSeedTtl(0, env), 0);
    assert.equal(floorSeedTtl(undefined, env), undefined);
  });

  it('is applied to canonical, extra-key and retention writes, and set by the seed workflow', () => {
    const src = readFileSync(new URL('../scripts/_seed-utils.mjs', import.meta.url), 'utf8');
    assert.match(src, /atomicPublish\(canonicalKey, data, validateFn, ttlSeconds, options = \{\}\) \{\n  ttlSeconds = floorSeedTtl\(ttlSeconds\);/);
    assert.match(src, /writeExtraKey\(key, data, ttl, envelopeMeta, options = \{\}\) \{\n  ttl = floorSeedTtl\(ttl\);/);
    assert.match(src, /\['EXPIRE', k, floorSeedTtl\(ttlSeconds\)\]/);
    const wf = readFileSync(new URL('../.github/workflows/bdnews-seed.yml', import.meta.url), 'utf8');
    assert.match(wf, /SEED_MIN_TTL_SECONDS: '21600'/);
  });
});
