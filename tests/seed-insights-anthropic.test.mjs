import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  callLLM,
  __setInsightsLlmTransportForTests,
  anthropicInsightsBody,
  anthropicInsightsText,
  ANTHROPIC_INSIGHTS_DEFAULT_MODEL,
} from '../scripts/seed-insights.mjs';

const KEYS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_INSIGHTS_MODEL', 'ANTHROPIC_MODEL', 'OPENROUTER_API_KEY', 'OLLAMA_API_URL', 'USAGE_TELEMETRY'];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  __setInsightsLlmTransportForTests(null);
});

describe('seed-insights: Claude provider (native Messages API)', () => {
  it('builds a Messages body without temperature, with thinking headroom and low effort', () => {
    const body = anthropicInsightsBody({ model: 'm', systemPrompt: 'sys', userPrompt: 'u', maxTokens: 300 });
    assert.deepEqual(body, {
      model: 'm', system: 'sys', messages: [{ role: 'user', content: 'u' }],
      max_tokens: 300 + 4096, output_config: { effort: 'low' },
    });
    assert.ok(!('temperature' in body));
  });

  it('reads only text blocks and treats a refusal as empty', () => {
    assert.equal(anthropicInsightsText({ content: [{ type: 'thinking', thinking: 'x' }, { type: 'text', text: ' Hello ' }] }), 'Hello');
    assert.equal(anthropicInsightsText({ stop_reason: 'refusal', content: [{ type: 'text', text: 'no' }] }), '');
    assert.equal(anthropicInsightsText({}), '');
  });

  it('calls Claude first when ANTHROPIC_API_KEY is set, with the right headers', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.OPENROUTER_API_KEY = 'or-test';
    const calls = [];
    __setInsightsLlmTransportForTests({ fetch: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Flooding in Sylhet division has displaced thousands as rivers rose above danger levels, officials said on Friday.' }], usage: { input_tokens: 10, output_tokens: 5 } }), { status: 200 });
    } });
    const result = await callLLM('Floods in Sylhet', { retryDelayMs: 0 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
    assert.equal(calls[0].init.headers['x-api-key'], 'sk-ant-test');
    assert.equal(calls[0].init.headers['anthropic-version'], '2023-06-01');
    assert.equal(JSON.parse(calls[0].init.body).model, ANTHROPIC_INSIGHTS_DEFAULT_MODEL);
    const text = typeof result === 'string' ? result : result?.content ?? result?.text;
    assert.match(String(text), /Sylhet/);
  });

  it('skips Claude without a key and keeps the upstream chain', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENROUTER_API_KEY = 'or-test';
    const urls = [];
    __setInsightsLlmTransportForTests({ fetch: async (url) => {
      urls.push(url);
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Flooding in Sylhet division has displaced thousands as rivers rose above danger levels, officials said.' } }] }), { status: 200 });
    } });
    await callLLM('x', { retryDelayMs: 0 });
    assert.ok(urls.length >= 1);
    assert.ok(urls.every((u) => !u.includes('anthropic.com')));
  });
});
