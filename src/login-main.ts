// BD Situation Intelligence: sign-in / sign-up page.
import './styles/login.css';
import { HEADER_LOGO_SVG } from '@/config/brand-logo';
import { LOGIN_PATH, safeNextPath } from '@/config/auth';
import { siteFooterHtml } from '@/config/site-footer';
import { authClient, syncAuthCookie } from '@/services/bdsi-auth';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const logoSvg = new DOMParser().parseFromString(HEADER_LOGO_SVG, 'image/svg+xml').documentElement;
$('authLogo').append(document.importNode(logoSvg, true));
// Footer: static, trusted markup shared with the dashboard (src/config/site-footer.ts).
$('authFooter').append(document.createRange().createContextualFragment(siteFooterHtml()));

const form = $<HTMLFormElement>('authForm');
const title = $('authTitle');
const subtitle = $('authSubtitle');
const submit = $<HTMLButtonElement>('authSubmit');
const message = $('authMessage');
const nameField = $('nameField');
const emailField = $('emailField');
const passwordField = $('passwordField');
const passwordHint = $('passwordHint');
const nameInput = $<HTMLInputElement>('authName');
const emailInput = $<HTMLInputElement>('authEmail');
const passwordInput = $<HTMLInputElement>('authPassword');
const forgotLink = $<HTMLButtonElement>('forgotLink');
const backLink = $<HTMLButtonElement>('backLink');
const switchLink = $<HTMLButtonElement>('switchLink');
const consentNote = $('consentNote');

const params = new URLSearchParams(location.search);
const nextPath = safeNextPath(params.get('next'));
const supabase = authClient();
let mode: Mode = 'signin';

const COPY: Record<Mode, { title: string; subtitle: string; submit: string }> = {
  signin: { title: 'Sign in', subtitle: '', submit: 'Sign in' },
  signup: { title: 'Create account', subtitle: 'We will email you a link to confirm your address.', submit: 'Create account' },
  forgot: { title: 'Reset password', subtitle: 'Enter your email and we will send you a reset link.', submit: 'Send reset link' },
  reset: { title: 'Choose a new password', subtitle: 'Enter a new password for your account.', submit: 'Save password' },
};

function say(text: string, kind: 'info' | 'error' | 'ok' = 'info'): void {
  message.textContent = text;
  message.dataset.kind = kind;
}

function setMode(next: Mode): void {
  mode = next;
  const c = COPY[next];
  title.textContent = c.title;
  subtitle.textContent = c.subtitle;
  submit.textContent = c.submit;
  nameField.hidden = next !== 'signup';
  emailField.hidden = next === 'reset';
  passwordField.hidden = next === 'forgot';
  passwordHint.hidden = !(next === 'signup' || next === 'reset');
  passwordInput.autocomplete = next === 'signin' ? 'current-password' : 'new-password';
  passwordInput.required = next !== 'forgot';
  emailInput.required = next !== 'reset';
  subtitle.hidden = !c.subtitle;
  consentNote.hidden = next !== 'signup';
  forgotLink.hidden = next !== 'signin';
  switchLink.hidden = !(next === 'signin' || next === 'signup');
  switchLink.textContent = next === 'signup' ? 'Have an account? Sign in' : 'Create account';
  backLink.hidden = next === 'signin' || next === 'signup';
  say('');
}

function goToDashboard(): void {
  location.replace(nextPath);
}

function friendly(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/invalid login credentials/i.test(msg)) return 'Email or password is incorrect.';
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email first. Check your inbox for the link.';
  if (/already registered|already exists/i.test(msg)) return 'An account with this email already exists. Sign in instead.';
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.';
  if (/password/i.test(msg) && /(short|least|weak)/i.test(msg)) return 'Please use a stronger password (at least 8 characters).';
  if (/fetch|network/i.test(msg)) return 'Could not reach the sign-in service. Check your connection and try again.';
  return msg || 'Something went wrong. Please try again.';
}

switchLink.addEventListener('click', () => setMode(mode === 'signup' ? 'signin' : 'signup'));
forgotLink.addEventListener('click', () => setMode('forgot'));
backLink.addEventListener('click', () => setMode('signin'));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (mode !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say('Please enter a valid email address.', 'error');
  if ((mode === 'signup' || mode === 'reset') && password.length < 8) return say('Password must be at least 8 characters.', 'error');
  if (mode === 'signin' && !password) return say('Please enter your password.', 'error');

  submit.disabled = true;
  say('Please wait…');
  try {
    if (mode === 'signin') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      syncAuthCookie(data.session);
      say('Signed in. Opening the dashboard…', 'ok');
      goToDashboard();
    } else if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}${LOGIN_PATH}`,
          data: nameInput.value.trim() ? { full_name: nameInput.value.trim() } : undefined,
        },
      });
      if (error) throw error;
      if (data.session) {
        syncAuthCookie(data.session);
        goToDashboard();
      } else {
        say(`Almost done. We sent a confirmation link to ${email}. Open it to activate your account.`, 'ok');
      }
    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}${LOGIN_PATH}?mode=reset`,
      });
      if (error) throw error;
      say(`If an account exists for ${email}, a reset link is on its way.`, 'ok');
    } else {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      const { data: s } = await supabase.auth.getSession();
      syncAuthCookie(s.session);
      say(`Password updated for ${data.user?.email ?? 'your account'}. Opening the dashboard…`, 'ok');
      setTimeout(goToDashboard, 800);
    }
  } catch (err) {
    say(friendly(err), 'error');
  } finally {
    submit.disabled = false;
  }
});

supabase.auth.onAuthStateChange((event, session) => {
  syncAuthCookie(session);
  if (event === 'PASSWORD_RECOVERY') setMode('reset');
});

// Already signed in (or just returned from an email link): go straight in.
void (async () => {
  if (params.get('mode') === 'reset') setMode('reset');
  const { data } = await supabase.auth.getSession();
  if (data.session && (mode as Mode) !== 'reset') {
    syncAuthCookie(data.session);
    goToDashboard();
    return;
  }
  const errDesc = params.get('error_description');
  if (errDesc) say(errDesc, 'error');
})();
