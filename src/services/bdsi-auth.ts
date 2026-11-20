// BD Situation Intelligence: Supabase sign-in, shared by the login page and the dashboard.
// The session lives in Supabase's own storage; the access token is mirrored into a
// cookie so the server-side gate (middleware-auth-gate.ts) can check page requests.
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import {
  AUTH_COOKIE_NAME,
  AUTH_SUPABASE_PUBLISHABLE_KEY,
  AUTH_SUPABASE_URL,
  LOGIN_PATH,
  safeNextPath,
} from '@/config/auth';

let client: SupabaseClient | null = null;

export function authClient(): SupabaseClient {
  if (!client) {
    client = createClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    });
  }
  return client;
}

export function syncAuthCookie(session: Session | null): void {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  if (!session) {
    document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    return;
  }
  const maxAge = Math.max(60, Math.floor((session.expires_at ?? 0) - Date.now() / 1000));
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(session.access_token)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function loginUrl(next?: string): string {
  const target = safeNextPath(next ?? `${location.pathname}${location.search}`);
  return target === '/' ? LOGIN_PATH : `${LOGIN_PATH}?next=${encodeURIComponent(target)}`;
}

/**
 * Dashboard guard: sends the visitor to the login page when there is no session
 * (the offline cache can serve the page without asking the server), and keeps
 * the gate cookie in step with token refreshes. Resolves with the user's email.
 */
export async function requireSignedIn(): Promise<string | null> {
  const supabase = authClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    syncAuthCookie(null);
    location.replace(loginUrl());
    return null;
  }
  syncAuthCookie(data.session);
  supabase.auth.onAuthStateChange((event, session) => {
    syncAuthCookie(session);
    if (event === 'SIGNED_OUT') location.replace(loginUrl('/'));
  });
  return data.session.user.email ?? null;
}

export async function signOut(): Promise<void> {
  try {
    await authClient().auth.signOut();
  } finally {
    syncAuthCookie(null);
    location.replace(loginUrl('/'));
  }
}
