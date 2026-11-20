import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import middleware from '../middleware.ts';
import { authGate } from '../middleware-auth-gate.ts';
import { isGatedHost, safeNextPath } from '../src/config/auth.ts';

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
function fakeJwt(expSecondsFromNow: number): string {
  return `${b64url({ alg: 'HS256' })}.${b64url({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })}.sig`;
}

describe('BD Situation Intelligence sign-in gate', () => {
  it('sends a signed-out visitor on bdnews.si to the login page with the return path', async () => {
    const req = new Request('https://www.bdnews.si/?lat=23.7&lon=90.4', { headers: { host: 'www.bdnews.si' } });
    const res = await middleware(req);
    assert.equal(res?.status, 302);
    assert.equal(res?.headers.get('location'), '/login.html?next=%2F%3Flat%3D23.7%26lon%3D90.4');
    assert.match(res?.headers.get('cache-control') ?? '', /no-store/);
  });

  it('gates the dashboard file paths that skip the catch-all matcher', async () => {
    for (const path of ['/dashboard.html', '/index.html', '/dashboard']) {
      const res = await authGate(new Request(`https://bdnews.si${path}`), new URL(`https://bdnews.si${path}`));
      assert.equal(res?.status, 302, path);
    }
  });

  it('treats an expired token as signed out without calling Supabase', async () => {
    const realFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = (async () => { called = true; return new Response('{}'); }) as typeof fetch;
    try {
      const url = new URL('https://www.bdnews.si/');
      const res = await authGate(new Request(url, { headers: { cookie: `bdsi_at=${fakeJwt(-60)}` } }), url);
      assert.equal(res?.status, 302);
      assert.equal(called, false);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('lets a request with a token Supabase accepts through', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('{"id":"u1"}', { status: 200 })) as typeof fetch;
    try {
      const url = new URL('https://www.bdnews.si/');
      const res = await authGate(new Request(url, { headers: { cookie: `bdsi_at=${fakeJwt(600)}` } }), url);
      assert.equal(res, undefined);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('redirects when Supabase rejects the token', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('{}', { status: 401 })) as typeof fetch;
    try {
      const url = new URL('https://www.bdnews.si/dashboard');
      const res = await authGate(new Request(url, { headers: { cookie: `bdsi_at=${fakeJwt(900)}x` } }), url);
      assert.equal(res?.status, 302);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('leaves other hosts and non-page paths alone', async () => {
    assert.equal(isGatedHost('www.worldmonitor.app'), false);
    assert.equal(isGatedHost('bdnews-si-git-main-mik-partners.vercel.app'), true);
    assert.equal(isGatedHost('www.bdnews.si'), true);
    const api = new URL('https://www.bdnews.si/api/news/v1/list-feed-digest');
    assert.equal(await authGate(new Request(api), api), undefined);
    const login = new URL('https://www.bdnews.si/login.html');
    assert.equal(await authGate(new Request(login), login), undefined);
  });

  it('only returns to same-site paths after login', () => {
    assert.equal(safeNextPath('/dashboard?x=1'), '/dashboard?x=1');
    assert.equal(safeNextPath('//evil.example/'), '/');
    assert.equal(safeNextPath('https://evil.example/'), '/');
    assert.equal(safeNextPath('/\\evil.example'), '/');
    assert.equal(safeNextPath('/login.html?next=/'), '/');
    assert.equal(safeNextPath(null), '/');
  });
});
