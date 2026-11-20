import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { defaultProviderChain, isDefaultChainProvider } from '../server/_shared/llm.ts';

describe('BDSI: Claude as the primary LLM provider', () => {
  it('keeps the upstream chain unless LLM_PRIMARY_PROVIDER=anthropic and a key is set', () => {
    const upstream = defaultProviderChain({});
    assert.ok(!upstream.includes('anthropic'));
    assert.deepEqual(defaultProviderChain({ LLM_PRIMARY_PROVIDER: 'anthropic' }), upstream);
    assert.deepEqual(defaultProviderChain({ ANTHROPIC_API_KEY: 'k' }), upstream);
  });

  it('puts Claude first, with the usual providers behind it as fallbacks', () => {
    const chain = defaultProviderChain({ LLM_PRIMARY_PROVIDER: ' Anthropic ', ANTHROPIC_API_KEY: 'k' });
    assert.equal(chain[0], 'anthropic');
    assert.deepEqual(chain.slice(1), defaultProviderChain({}));
  });

  it('does not let request input name Claude (key spend stays operator-controlled)', () => {
    assert.equal(isDefaultChainProvider('anthropic'), false);
  });
});

describe('BDSI: Claude first in the seeders’ shared LLM chain', () => {
  it('reaches Claude only when LLM_PRIMARY_PROVIDER=anthropic', async () => {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const src = require('node:fs').readFileSync(new URL('../scripts/lib/llm-chain.cjs', import.meta.url), 'utf8');
    assert.match(src, /!p\.optIn \|\| p\.name === String\(process\.env\.LLM_PRIMARY_PROVIDER/);
    // Claude stays the first entry, so enrolling it makes it the primary.
    assert.ok(src.indexOf("name: 'anthropic'") < src.indexOf("name: 'ollama'"));
  });
});
