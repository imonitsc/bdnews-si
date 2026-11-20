// BD Situation Intelligence: sign-in gate for dashboard page requests.
// A page request needs a Supabase access token in the AUTH_COOKIE_NAME cookie.
// The token is checked with Supabase (GET /auth/v1/user); valid tokens are
// remembered in this isolate until they expire (at most five minutes).
import {
  AUTH_COOKIE_NAME,
  AUTH_SUPABASE_PUBLISHABLE_KEY,
  AUTH_SUPABASE_URL,
  GATED_PAGE_PATHS,
  LOGIN_PATH,
} from './src/config/auth';

const VERIFIED = new Map<string, number>();
const MAX_CACHE_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 2000;

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      const value = part.slice(eq + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Expiry (ms) from the JWT payload, or null when the token is malformed. */
function tokenExpiryMs(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

async function isValidToken(token: string): Promise<boolean> {
  const now = Date.now();
  const expiry = tokenExpiryMs(token);
  if (expiry == null || expiry <= now) return false;
  const cached = VERIFIED.get(token);
  if (cached && cached > now) return true;
  try {
    const res = await globalThis.fetch(`${AUTH_SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: AUTH_SUPABASE_PUBLISHABLE_KEY,
        authorization: `Bearer ${token}`,
        'user-agent': 'bd-situation-intelligence-gate/1.0',
      },
    });
    if (!res.ok) return false;
    if (VERIFIED.size >= MAX_CACHE_ENTRIES) VERIFIED.clear();
    VERIFIED.set(token, Math.min(expiry, now + MAX_CACHE_MS));
    return true;
  } catch {
    // Supabase unreachable: fail closed, the login page explains and retries.
    return false;
  }
}

/**
 * Returns a redirect to the login page when a gated page is requested without
 * a valid session, or undefined to let the request continue.
 */
export async function authGate(request: Request, url: URL): Promise<Response | undefined> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return undefined;
  if (!GATED_PAGE_PATHS.has(url.pathname)) return undefined;
  // Agent JSON view of the home page stays public.
  if (url.pathname === '/' && url.searchParams.get('mode') === 'agent') return undefined;
  const token = readCookie(request.headers.get('cookie'), AUTH_COOKIE_NAME);
  if (token && (await isValidToken(token))) return undefined;
  const login = new URL(LOGIN_PATH, url);
  login.searchParams.set('next', `${url.pathname}${url.search}`);
  return new Response(null, {
    status: 302,
    headers: {
      location: `${login.pathname}${login.search}`,
      'cache-control': 'private, no-store',
    },
  });
}
