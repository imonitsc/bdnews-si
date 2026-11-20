// BD Situation Intelligence: sign-in settings (Supabase Auth).
// The URL and publishable key are public by design: they identify the project,
// and Supabase's own rules decide what a holder may do. Never put a secret or
// service-role key here.

export const AUTH_SUPABASE_URL = 'https://vpxwqmjqhuimflccwxqq.supabase.co';
export const AUTH_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_UXb7NpywavDC1agH5cIh5g_Dea8c4mJ';

/** Cookie that carries the Supabase access token so the server can check page requests. */
export const AUTH_COOKIE_NAME = 'bdsi_at';

export const LOGIN_PATH = '/login.html';

/** Page paths that need a signed-in user. */
export const GATED_PAGE_PATHS: ReadonlySet<string> = new Set([
  '/',
  '/dashboard',
  '/dashboard.html',
  '/index.html',
  '/settings.html',
  '/live-channels.html',
]);

/** Hosts this deployment gates: the production domain and this project's Vercel previews. */
const GATED_HOST = /^(?:www\.)?bdnews\.si$|^bdnews-si(?:-[a-z0-9-]+)?\.vercel\.app$/i;

export function isGatedHost(host: string | null | undefined): boolean {
  return !!host && GATED_HOST.test(host.split(':')[0]!);
}

/** Only same-site paths are allowed as the post-login destination. */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  if (raw.startsWith(LOGIN_PATH)) return '/';
  return raw;
}
