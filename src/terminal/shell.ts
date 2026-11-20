// BDSI terminal shell: top bar (BDSI> command line, clocks, user), ticker,
// function keys + workspace tabs, a hash router for screens, and the source-health footer.

import { h, fmtNum, pct, signClass } from './dom';
import { markets, allStatuses, onStatusChange } from './data';
import { COMMANDS, helpLine, resolveTerminalInput, type TerminalCommandDef } from '@/config/terminal-commands';

export interface ScreenCtx {
  /** Navigate to a screen route ('' = Launchpad, 'stock/GP', 'ask', ...). */
  go(route: string, opts?: { focus?: number; query?: string }): void;
  status(text: string, kind?: 'err' | 'info' | ''): void;
  knownTickers: Set<string>;
  email: string | null;
  /** Free text passed with the command (e.g. ASK's question). */
  query: string;
}

export interface Screen {
  code: string;
  title: string;
  mount(el: HTMLElement, args: string[], ctx: ScreenCtx): (() => void) | void;
}

type ScreenLoader = () => Promise<Screen>;

const SCREENS: Record<string, ScreenLoader> = {
  '': () => import('./screens/launchpad').then((m) => m.launchpadScreen),
  ask: () => import('./screens/ask').then((m) => m.askScreen),
  stock: () => import('./screens/stock').then((m) => m.stockScreen),
  scrn: () => import('./screens/screener').then((m) => m.screenerScreen),
  eco: () => import('./screens/economy').then((m) => m.economyScreen),
  power: () => import('./screens/power').then((m) => m.powerScreen),
  sea: () => import('./screens/sea').then((m) => m.seaScreen),
  rsrch: () => import('./screens/research').then((m) => m.researchScreen),
  chat: () => import('./screens/chat').then((m) => m.chatScreen),
};

const FKEYS: Array<{ k: string; label: string; route: string }> = [
  { k: 'F1', label: 'STOCK', route: 'stock/GP' },
  { k: 'F2', label: 'SCRN', route: 'scrn' },
  { k: 'F3', label: 'ECO', route: 'eco' },
  { k: 'F4', label: 'POWER', route: 'power' },
  { k: 'F6', label: 'SEA', route: 'sea' },
  { k: 'F7', label: 'RSRCH', route: 'rsrch' },
  { k: 'F8', label: 'ASK AI', route: 'ask' },
  { k: 'F9', label: 'CHAT', route: 'chat' },
];

const TABS: Array<{ label: string; route: string | null; href?: string }> = [
  { label: 'Markets', route: '' },
  { label: 'Macro', route: 'eco' },
  { label: 'Security', route: 'sea' },
  { label: 'Disaster', route: 'power' },
  { label: 'Chat', route: 'chat' },
  { label: 'Map ↗', route: null, href: '/dashboard' },
];

const CLOCKS = [
  { label: 'DHK', tz: 'Asia/Dhaka' },
  { label: 'LDN', tz: 'Europe/London' },
  { label: 'NY', tz: 'America/New_York' },
];

function clock(tz: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
}

function parseHash(): { screen: string; args: string[]; focus: number | null; query: string } {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path = '', qs = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(qs);
  const focus = Number(params.get('p'));
  return { screen: parts[0] ?? '', args: parts.slice(1), focus: Number.isFinite(focus) && focus > 0 ? focus : null, query: params.get('q') ?? '' };
}

export function mountShell(root: HTMLElement, email: string | null, onSignOut: () => void): void {
  const knownTickers = new Set<string>();
  const statusEl = h('span', { class: 'tp-cmd-status', role: 'status', 'aria-live': 'polite' });
  const setStatus = (text: string, kind: 'err' | 'info' | '' = '') => {
    statusEl.textContent = text;
    statusEl.title = text;
    statusEl.dataset.state = kind;
  };

  // ---- top bar ----
  const input = h('input', { id: 'tpCmd', class: 'tp-cmd-input', type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: 'HELP <GO>', 'aria-label': 'Command, for example GP, DSE, ASK or HELP', list: 'tpCmdList' }) as HTMLInputElement;
  const datalist = h('datalist', { id: 'tpCmdList' }, ...COMMANDS.map((c) => h('option', { value: c.mnemonic, label: c.description })));
  const form = h('form', { class: 'tp-cmd', role: 'search' },
    h('label', { for: 'tpCmd', class: 'tp-cmd-prompt' }, 'BDSI>'), input, datalist,
    h('button', { type: 'submit', class: 'tp-go' }, 'GO'), statusEl);
  const clockEls = CLOCKS.map((c) => ({ ...c, el: h('span', { class: 'tp-w' }) }));
  const top = h('div', { class: 'tp-top' },
    h('a', { class: 'tp-logo', href: '#/', 'aria-label': 'BDSI Launchpad' }, 'BDSI'),
    form,
    h('div', { class: 'tp-clocks' }, ...clockEls.map((c) => h('span', {}, `${c.label} `, c.el))),
    h('div', { class: 'tp-user' }, h('span', { class: 'tp-muted' }, email ?? ''),
      h('button', { type: 'button', class: 'tp-signout', onclick: onSignOut }, 'LOG OUT')));

  // ---- ticker ----
  const ticker = h('div', { class: 'tp-ticker', 'aria-label': 'Market ticker' }, h('span', { class: 'tp-muted' }, 'Loading quotes…'));
  const fillTicker = async () => {
    try {
      const d = await markets();
      const items: HTMLElement[] = [];
      for (const i of d.dse?.indices ?? []) items.push(h('span', {}, h('span', { class: 'tp-amber' }, i.key), ' ', h('span', { class: 'tp-w' }, fmtNum(i.value)), ' ', h('span', { class: `tp-${signClass(i.percent)}` }, pct(i.percent))));
      for (const code of ['USD', 'EUR', 'GBP', 'INR', 'CNH', 'SAR', 'AED']) {
        const r = d.fx?.rates.find((x) => x.code === code);
        if (r) items.push(h('span', {}, h('span', { class: 'tp-amber' }, `${code}/BDT`), ' ', h('span', { class: 'tp-w' }, r.mid.toFixed(code === 'INR' ? 4 : 2)), ' ', h('span', { class: 'tp-dim' }, d.fx?.official === false ? 'REF' : 'BB')));
      }
      for (const m of d.dse?.gainers ?? []) knownTickers.add(m.code.toUpperCase());
      for (const m of d.dse?.losers ?? []) knownTickers.add(m.code.toUpperCase());
      ticker.replaceChildren(...(items.length ? items : [h('span', { class: 'tp-muted' }, 'No quotes available')]));
    } catch {
      ticker.replaceChildren(h('span', { class: 'tp-down' }, 'Quotes unavailable'));
    }
  };

  // ---- function keys and tabs ----
  const fkeys = h('nav', { class: 'tp-fkeys', 'aria-label': 'Functions' },
    ...FKEYS.map((f) => h('a', { href: `#/${f.route}`, class: 'tp-fkey', 'data-route': f.route }, h('b', {}, f.k), ` ${f.label}`)),
    h('span', { class: 'tp-spacer' }),
    ...TABS.map((t) => h('a', { href: t.href ?? `#/${t.route}`, class: 'tp-tab', 'data-tab': t.route ?? '' }, t.label)));

  // ---- main and footer ----
  const main = h('main', { class: 'tp-main', id: 'tpMain', tabindex: '-1' });
  const health = h('div', { class: 'tp-health' });
  const renderHealth = () => {
    health.replaceChildren(...allStatuses().map((s) => h('span', { class: `tp-h-${s.health}`, title: s.note ?? (s.lastOk ? `last OK ${new Date(s.lastOk).toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka' })} DHK` : 'no successful fetch yet') },
      `● ${s.name}${s.health === 'error' ? ' — error' : s.health === 'stale' ? ` — ${s.note ?? 'stale'}` : ''}`)));
  };
  onStatusChange(renderHealth);
  const footer = h('footer', { class: 'tp-footer' }, health, h('span', { class: 'tp-spacer' }),
    h('span', { class: 'tp-muted' }, 'Panels 1–4 · press 1–4 to focus · Esc to clear · / to type'),
    h('nav', { class: 'tp-legal', 'aria-label': 'Site' },
      h('a', { href: '/about.html' }, 'About'), h('a', { href: '/privacy.html' }, 'Privacy'), h('a', { href: '/terms.html' }, 'Terms'),
      h('a', { href: '/copyright.html' }, 'Copyright'), h('a', { href: 'https://github.com/imonitsc/bdnews-si', rel: 'noopener' }, 'Source code (AGPL-3.0)')));

  // ---- help overlay ----
  const help = h('div', { class: 'tp-help', role: 'dialog', 'aria-label': 'Functions', hidden: true });
  const showHelp = (topic: TerminalCommandDef | null) => {
    help.replaceChildren(
      h('div', { class: 'tp-help-head' }, topic ? `HELP ${topic.mnemonic}` : 'FUNCTIONS · type a mnemonic, press Enter (<GO>) · Esc closes',
        h('button', { type: 'button', class: 'tp-help-close', 'aria-label': 'Close help', onclick: () => { help.hidden = true; } }, '✕')),
      h('div', { class: 'tp-help-rows' }, ...(topic ? [topic] : COMMANDS).map((c) => h('div', { class: 'tp-help-row' }, helpLine(c).replace(/ · planned, phase \d/, '')))));
    help.hidden = false;
  };

  root.replaceChildren(top, ticker, fkeys, main, footer, help);

  // ---- router ----
  let cleanup: (() => void) | void;
  let routeSeq = 0;
  const ctx: ScreenCtx = {
    go: (route, opts) => {
      const q = new URLSearchParams();
      if (opts?.focus) q.set('p', String(opts.focus));
      if (opts?.query) q.set('q', opts.query);
      const next = `#/${route}${q.size ? `?${q}` : ''}`;
      if (location.hash === next) void route_();
      else location.hash = next;
    },
    status: setStatus,
    knownTickers,
    email,
    query: '',
  };

  const route_ = async () => {
    const seq = ++routeSeq;
    const { screen, args, focus, query } = parseHash();
    const loader = SCREENS[screen];
    if (typeof cleanup === 'function') cleanup();
    cleanup = undefined;
    main.replaceChildren(h('div', { class: 'tp-state tp-state-loading' }, 'Loading…'));
    for (const a of fkeys.querySelectorAll<HTMLElement>('[data-route]')) a.classList.toggle('on', a.dataset.route?.split('/')[0] === screen);
    for (const a of fkeys.querySelectorAll<HTMLElement>('[data-tab]')) a.classList.toggle('on', a.dataset.tab === screen);
    if (!loader) {
      main.replaceChildren(h('div', { class: 'tp-state tp-state-error' }, `No screen "${screen}". Type HELP <GO>.`));
      return;
    }
    try {
      const s = await loader();
      if (seq !== routeSeq) return;
      main.replaceChildren();
      document.title = `${s.title} · BDSI Terminal`;
      ctx.query = query;
      cleanup = s.mount(main, args, ctx);
      if (focus) window.setTimeout(() => main.querySelector<HTMLElement>(`[data-panel-n="${focus}"]`)?.focus(), 50);
    } catch (e) {
      main.replaceChildren(h('div', { class: 'tp-state tp-state-error' }, 'This screen failed to load. Reload the page to try again.'));
      console.error('[terminal] screen failed', e);
    }
  };
  window.addEventListener('hashchange', () => void route_());

  // ---- commands ----
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const r = resolveTerminalInput(input.value, knownTickers);
    switch (r.kind) {
      case 'empty': setStatus(''); return;
      case 'help': showHelp(r.topic); setStatus(r.unknownTopic ? `NO FUNCTION ${r.unknownTopic}` : '', r.unknownTopic ? 'err' : ''); input.value = ''; return;
      case 'news':
        if (parseHash().screen !== '') { ctx.go(''); setStatus('Launchpad opened · type the row number again to open a story', 'info'); input.value = ''; return; }
        void import('./screens/launchpad').then((m) => {
          if (m.openNewsRow(r.n)) { setStatus(`Opened news row ${r.n}`, 'info'); input.value = ''; }
          else setStatus(`No news row ${r.n}`, 'err');
        });
        return;
      case 'ticker': ctx.go(`stock/${encodeURIComponent(r.code)}`); setStatus(''); input.value = ''; return;
      case 'go': {
        const t = r.target;
        if (t.kind === 'help') showHelp(null);
        else if (t.kind === 'page') location.href = t.href;
        else ctx.go(t.screen, { focus: t.focus, query: r.args || undefined });
        setStatus(''); input.value = '';
        return;
      }
      case 'unknown': {
        const word = r.input;
        if (/^[A-Z][A-Z0-9&.-]{1,14}$/.test(word)) {
          setStatus(r.suggestions.length ? `${word}: did you mean ${r.suggestions.join(', ')}? Opening as a DSE ticker…` : `${word}: opening as a DSE ticker…`, 'info');
          ctx.go(`stock/${encodeURIComponent(word)}`);
          input.value = '';
        } else {
          setStatus(r.suggestions.length ? `UNKNOWN: ${word} · did you mean ${r.suggestions.join(', ')}?` : `UNKNOWN: ${word} · type HELP <GO>`, 'err');
        }
        return;
      }
    }
  });

  // ---- keyboard ----
  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (e.key === 'Escape') {
      if (!help.hidden) { help.hidden = true; return; }
      if (typing) { (t as HTMLInputElement).blur(); return; }
      (document.activeElement as HTMLElement | null)?.blur?.();
      return;
    }
    if (typing) return;
    if (e.key === '/' || (e.ctrlKey && e.key.toLowerCase() === 'g')) { e.preventDefault(); input.focus(); return; }
    if (/^[1-4]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const p = main.querySelector<HTMLElement>(`[data-panel-n="${e.key}"]`);
      if (p) { e.preventDefault(); p.focus(); p.scrollIntoView({ block: 'nearest' }); }
      return;
    }
    const fn = /^F(\d{1,2})$/.exec(e.key);
    if (fn && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const f = FKEYS.find((x) => x.k === e.key);
      if (f) { e.preventDefault(); ctx.go(f.route); }
    }
  });

  // ---- timers ----
  const tick = () => { for (const c of clockEls) c.el.textContent = clock(c.tz); };
  tick();
  window.setInterval(tick, 1000);
  void fillTicker();
  window.setInterval(() => void fillTicker(), 60_000);
  renderHealth();
  void route_();
  // Load the full DSE code list in the background (stock pages); ignore if unavailable.
  void fetch('/api/bd-stock?list=1', { signal: AbortSignal.timeout(20_000) })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { codes?: string[] } | null) => { for (const c of j?.codes ?? []) knownTickers.add(c.toUpperCase()); })
    .catch(() => {});
}
