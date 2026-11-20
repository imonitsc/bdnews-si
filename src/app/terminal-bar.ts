// bdnews SI: terminal-style command strip under the header.
// A command prompt, function keys that jump to panels, a scrolling market
// ticker built from the quotes the dashboard already loads, and market clocks.
import type { AppContext } from '@/app/app-context';
import type { MarketData } from '@/types';

import { FKEY_COMMANDS, COMMANDS, parseCommand, helpLine, type TerminalCommandDef } from '@/config/terminal-commands';

const BAR_ID = 'bdnTerminalBar';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function findTarget(target: string): HTMLElement | null {
  if (target === 'map') return document.getElementById('mapSection');
  return document.querySelector<HTMLElement>(`.panel[data-panel="${CSS.escape(target)}"]`);
}

function setStatus(status: HTMLElement, text: string, state: 'err' | 'info' | '' = ''): void {
  status.textContent = text;
  status.title = text;
  if (state) status.dataset.state = state;
  else delete status.dataset.state;
}

function jumpTo(target: string, status: HTMLElement): boolean {
  const node = findTarget(target);
  if (!node) {
    setStatus(status, 'PANEL NOT ON THIS SCREEN · add it from Settings → Panels', 'err');
    return false;
  }
  node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  node.classList.remove('bdn-flash');
  void node.offsetWidth;
  node.classList.add('bdn-flash');
  status.textContent = '';
  delete status.dataset.state;
  return true;
}

function formatPrice(v: number): string {
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 0 : abs >= 10 ? 2 : 4;
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function renderTicker(track: HTMLElement, markets: MarketData[]): string {
  const quotes = markets.filter(m => m.price != null);
  const sig = quotes.map(m => `${m.symbol}:${m.price}:${m.change}`).join('|');
  if (track.dataset.sig === sig) return sig;
  track.dataset.sig = sig;
  track.replaceChildren();
  if (quotes.length === 0) {
    track.append(el('span', 'bdn-tick bdn-tick-wait', 'WAITING FOR MARKET DATA…'));
    track.classList.remove('bdn-scroll');
    return sig;
  }
  // Two copies so the CSS marquee loops without a gap.
  for (let pass = 0; pass < 2; pass++) {
    for (const m of quotes) {
      const item = el('span', 'bdn-tick');
      if (pass === 1) item.setAttribute('aria-hidden', 'true');
      item.append(el('span', 'bdn-tick-sym', m.display || m.symbol));
      item.append(el('span', 'bdn-tick-px', formatPrice(m.price as number)));
      if (m.change != null) {
        const up = m.change >= 0;
        item.append(el('span', `bdn-tick-chg ${up ? 'up' : 'down'}`, `${up ? '▲' : '▼'}${Math.abs(m.change).toFixed(2)}%`));
      }
      track.append(item);
    }
  }
  track.style.setProperty('--bdn-ticker-duration', `${Math.max(30, quotes.length * 4)}s`);
  track.classList.add('bdn-scroll');
  return sig;
}

const CLOCKS: ReadonlyArray<{ label: string; tz: string }> = [
  { label: 'DHAKA', tz: 'Asia/Dhaka' },
  { label: 'LDN', tz: 'Europe/London' },
  { label: 'NY', tz: 'America/New_York' },
];

function clockText(tz: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
}

let cleanup: (() => void) | null = null;

export function mountTerminalBar(ctx: AppContext): void {
  cleanup?.();
  cleanup = null;
  document.getElementById(BAR_ID)?.remove();
  const header = ctx.container.querySelector('.header');
  if (!header) return;

  const knownTickers = new Set<string>();
  const tickerQuotes = new Map<string, MarketData>();
  const bar = el('div', 'bdn-terminal-bar');
  bar.id = BAR_ID;
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Terminal commands');

  // Command prompt
  const form = el('form', 'bdn-cmd');
  const prompt = el('label', 'bdn-cmd-prompt', 'BDNEWS>');
  const input = el('input', 'bdn-cmd-input');
  input.id = 'bdnCmdInput';
  prompt.htmlFor = input.id;
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = 'HELP <GO>';
  input.setAttribute('aria-label', 'Command, for example BD, DSE, FX or HELP');
  const go = el('button', 'bdn-go', 'GO');
  go.type = 'submit';
  const status = el('span', 'bdn-cmd-status');
  status.setAttribute('role', 'status');
  form.append(prompt, input, go, status);
  // Autocomplete: every mnemonic with its description (native datalist, keyboard friendly).
  const list = el('datalist');
  list.id = 'bdnCmdList';
  for (const c of COMMANDS) {
    const opt = el('option');
    opt.value = c.mnemonic;
    opt.label = c.description;
    list.append(opt);
  }
  input.setAttribute('list', list.id);
  form.append(list);

  // HELP overlay
  const help = el('div', 'bdn-help');
  help.id = 'bdnHelp';
  help.hidden = true;
  help.setAttribute('role', 'dialog');
  help.setAttribute('aria-label', 'Terminal commands');
  const closeHelp = () => { help.hidden = true; };
  const showHelp = (topic: TerminalCommandDef | null) => {
    help.replaceChildren();
    const head = el('div', 'bdn-help-head', topic ? `HELP ${topic.mnemonic}` : 'FUNCTIONS · type a mnemonic and press Enter (<GO>) · Esc closes');
    const close = el('button', 'bdn-help-close', '✕');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close help');
    close.addEventListener('click', closeHelp);
    head.append(close);
    help.append(head);
    const rows = el('div', 'bdn-help-rows');
    for (const c of topic ? [topic] : COMMANDS) {
      const row = el('div', `bdn-help-row${c.action.type === 'planned' ? ' planned' : ''}`, helpLine(c));
      rows.append(row);
    }
    help.append(rows);
    help.hidden = false;
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const result = parseCommand(input.value, knownTickers);
    switch (result.kind) {
      case 'empty':
        setStatus(status, '');
        return;
      case 'help':
        showHelp(result.topic);
        setStatus(status, result.unknownTopic ? `NO FUNCTION ${result.unknownTopic}` : '', result.unknownTopic ? 'err' : '');
        input.value = '';
        return;
      case 'unknown':
        setStatus(status, result.suggestions.length
          ? `UNKNOWN: ${result.input} · did you mean ${result.suggestions.join(', ')}?`
          : `UNKNOWN: ${result.input} · type HELP <GO>`, 'err');
        return;
      case 'ticker': {
        const q = bdQuotes.find((m) => m.symbol === result.code) ?? tickerQuotes.get(result.code);
        const px = q?.price != null ? ` ${formatPrice(q.price)}${q.change != null ? ` (${q.change >= 0 ? '+' : ''}${q.change.toFixed(2)}%)` : ''}` : '';
        if (jumpTo('bd-dse', status)) {
          setStatus(status, `${result.code}${px} · full stock pages are planned (phase 1)`, 'info');
          input.value = '';
        }
        return;
      }
      case 'run': {
        const { command } = result;
        const action = command.action;
        if (action.type === 'map') {
          if (jumpTo('map', status)) input.value = '';
        } else if (action.type === 'panel') {
          if (jumpTo(action.target, status)) input.value = '';
        } else if (action.type === 'help') {
          showHelp(null);
        } else {
          const note = `${command.mnemonic}: ${command.description} · planned, phase ${action.phase}`;
          if (action.fallback && jumpTo(action.fallback, status)) input.value = '';
          setStatus(status, action.fallback ? `${note} · showing nearest view` : note, 'info');
        }
        return;
      }
    }
  });

  // Function keys
  const keys = el('div', 'bdn-fkeys');
  const runFkey = (cmd: TerminalCommandDef) => {
    if (cmd.action.type === 'map') jumpTo('map', status);
    else if (cmd.action.type === 'panel') jumpTo(cmd.action.target, status);
  };
  FKEY_COMMANDS.forEach((cmd, i) => {
    const b = el('button', 'bdn-fkey');
    b.type = 'button';
    b.title = `${cmd.mnemonic} <GO> · ${cmd.description}`;
    b.append(el('span', 'bdn-fkey-n', `F${i + 1}`), el('span', 'bdn-fkey-l', cmd.fkeyLabel ?? cmd.mnemonic));
    b.addEventListener('click', () => runFkey(cmd));
    keys.append(b);
  });

  // Ticker
  const ticker = el('div', 'bdn-ticker');
  ticker.setAttribute('aria-label', 'Market ticker');
  const track = el('div', 'bdn-ticker-track');
  ticker.append(track);

  // Clocks
  const clocks = el('div', 'bdn-clocks');
  const clockNodes = CLOCKS.map(c => {
    const wrap = el('span', 'bdn-clock');
    const value = el('span', 'bdn-clock-v');
    wrap.append(el('span', 'bdn-clock-l', c.label), value);
    clocks.append(wrap);
    return { value, tz: c.tz };
  });

  // Signed-in user and sign-out.
  const user = el('div', 'bdn-user');
  const who = el('span', 'bdn-user-email', '');
  const out = el('button', 'bdn-signout', 'LOG OUT');
  out.type = 'button';
  out.title = 'Sign out of BD Situation Intelligence';
  out.addEventListener('click', () => {
    out.disabled = true;
    void import('@/services/bdsi-auth').then((m) => m.signOut());
  });
  user.append(who, out);
  void import('@/services/bdsi-auth')
    .then((m) => m.authClient().auth.getSession())
    .then(({ data }) => {
      const email = data.session?.user.email ?? '';
      who.textContent = email;
      who.title = email;
    })
    .catch(() => {});

  bar.append(form, keys, ticker, clocks, user);
  header.after(bar);
  bar.after(help);

  // The Markets panel only loads quotes once it is on screen. Until it does,
  // the ticker fetches the default symbols itself.
  let ownQuotes: MarketData[] = [];
  let fetching = false;
  const fetchOwnQuotes = async () => {
    if (fetching || (ctx.latestMarkets?.length ?? 0) > 0) return;
    fetching = true;
    try {
      const [{ fetchMultipleStocks }, { MARKET_SYMBOLS }] = await Promise.all([
        import('@/services/market'),
        import('@/config/markets'),
      ]);
      const result = await fetchMultipleStocks(MARKET_SYMBOLS);
      if (result.data.length > 0) ownQuotes = result.data;
    } catch {
      // Ticker keeps its waiting state; the next refresh retries.
    } finally {
      fetching = false;
    }
  };
  const firstFetch = window.setTimeout(() => void fetchOwnQuotes(), 4000);
  const quoteTimer = window.setInterval(() => void fetchOwnQuotes(), 5 * 60_000);

  // Bangladesh first: DSE indices and the Bangladesh Bank USD/BDT rate.
  let bdQuotes: MarketData[] = [];
  const fetchBdQuotes = async () => {
    try {
      const { fetchBdMarkets } = await import('@/services/bd-markets');
      const d = await fetchBdMarkets();
      // DSE codes we have prices for (today's movers), so GP <GO> resolves when listed.
      if (d.dse && !d.dse.error) {
        for (const m of [...d.dse.gainers, ...d.dse.losers]) {
          if (!m.code) continue;
          knownTickers.add(m.code.toUpperCase());
          tickerQuotes.set(m.code.toUpperCase(), { symbol: m.code, name: m.code, display: m.code, price: m.ltp, change: m.percent });
        }
      }
      const out: MarketData[] = [];
      for (const i of d.dse && !d.dse.error ? d.dse.indices : []) {
        out.push({ symbol: i.key, name: i.key, display: i.key, price: i.value, change: i.percent });
      }
      const usd = d.fx && !d.fx.error ? d.fx.rates.find((r) => r.code === 'USD') : undefined;
      if (usd) out.push({ symbol: 'USDBDT', name: 'USD/BDT', display: 'USD/BDT', price: usd.mid, change: null });
      if (out.length) bdQuotes = out;
    } catch {
      // Keep the previous Bangladesh quotes.
    }
  };
  void fetchBdQuotes();
  const bdTimer = window.setInterval(() => void fetchBdQuotes(), 60_000);

  const tick = () => {
    for (const c of clockNodes) c.value.textContent = clockText(c.tz);
    const live = ctx.latestMarkets ?? [];
    renderTicker(track, [...bdQuotes, ...(live.length > 0 ? live : ownQuotes)]);
  };
  tick();
  const timer = window.setInterval(tick, 1000);

  // "/" or Ctrl+G focuses the prompt (unless typing elsewhere).
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if ((e.key === '/' && !typing) || (e.ctrlKey && e.key.toLowerCase() === 'g')) {
      e.preventDefault();
      input.focus();
      return;
    }
    if (e.key === 'Escape' && !help.hidden) {
      closeHelp();
      return;
    }
    // F1–F10 run the function keys (browser F5 reload and F11/F12 untouched).
    const fn = /^F(\d{1,2})$/.exec(e.key);
    if (fn && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const n = Number(fn[1]);
      const cmd = n !== 5 ? FKEY_COMMANDS[n - 1] : undefined;
      if (cmd) {
        e.preventDefault();
        runFkey(cmd);
      }
    }
  };
  document.addEventListener('keydown', onKey);
  cleanup = () => {
    window.clearInterval(timer);
    window.clearInterval(quoteTimer);
    window.clearInterval(bdTimer);
    window.clearTimeout(firstFetch);
    document.removeEventListener('keydown', onKey);
    help.remove();
  };
}
