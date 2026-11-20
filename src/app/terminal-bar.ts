// bdnews SI: terminal-style command strip under the header.
// A command prompt, function keys that jump to panels, a scrolling market
// ticker built from the quotes the dashboard already loads, and market clocks.
import type { AppContext } from '@/app/app-context';
import type { MarketData } from '@/types';

interface TerminalCommand {
  code: string;
  label: string;
  target: string; // panel key, or 'map'
  aliases?: string[];
}

export const TERMINAL_COMMANDS: readonly TerminalCommand[] = [
  { code: 'BD', label: 'BD NEWS', target: 'bangladesh', aliases: ['BDN', 'NEWS', 'N'] },
  { code: 'TV', label: 'LIVE TV', target: 'live-news', aliases: ['LIVE'] },
  { code: 'MAP', label: 'MAP', target: 'map', aliases: ['GEO'] },
  { code: 'MKT', label: 'MARKETS', target: 'markets', aliases: ['MKTS', 'EQ'] },
  { code: 'CMDTY', label: 'COMMOD', target: 'commodities', aliases: ['CMD', 'GOLD'] },
  { code: 'ASIA', label: 'ASIA', target: 'asia' },
  { code: 'WRLD', label: 'WORLD', target: 'politics', aliases: ['WORLD', 'W'] },
  { code: 'ECO', label: 'MACRO', target: 'economic', aliases: ['MACRO'] },
  { code: 'AI', label: 'INSIGHTS', target: 'insights', aliases: ['INS'] },
  { code: 'RISK', label: 'RISK', target: 'cii', aliases: ['CII'] },
];

const BAR_ID = 'bdnTerminalBar';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

export function resolveTerminalCommand(input: string): TerminalCommand | null {
  const q = input.trim().toUpperCase().replace(/\s*<?GO>?$/, '').trim();
  if (!q) return null;
  return TERMINAL_COMMANDS.find(c => c.code === q || c.aliases?.includes(q)) ?? null;
}

function findTarget(target: string): HTMLElement | null {
  if (target === 'map') return document.getElementById('mapSection');
  return document.querySelector<HTMLElement>(`.panel[data-panel="${CSS.escape(target)}"]`);
}

function jumpTo(target: string, status: HTMLElement): boolean {
  const node = findTarget(target);
  if (!node) {
    status.textContent = 'PANEL NOT ON THIS SCREEN';
    status.dataset.state = 'err';
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
  input.placeholder = 'BD <GO>';
  input.setAttribute('aria-label', 'Command, for example BD, TV, MKT or MAP');
  const go = el('button', 'bdn-go', 'GO');
  go.type = 'submit';
  const status = el('span', 'bdn-cmd-status');
  status.setAttribute('role', 'status');
  form.append(prompt, input, go, status);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const cmd = resolveTerminalCommand(input.value);
    if (!cmd) {
      status.textContent = input.value.trim() ? 'UNKNOWN COMMAND' : '';
      status.dataset.state = 'err';
      return;
    }
    if (jumpTo(cmd.target, status)) input.value = '';
  });

  // Function keys
  const keys = el('div', 'bdn-fkeys');
  TERMINAL_COMMANDS.forEach((cmd, i) => {
    const b = el('button', 'bdn-fkey');
    b.type = 'button';
    b.title = `${cmd.code} <GO>`;
    b.append(el('span', 'bdn-fkey-n', `F${i + 1}`), el('span', 'bdn-fkey-l', cmd.label));
    b.addEventListener('click', () => jumpTo(cmd.target, status));
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

  bar.append(form, keys, ticker, clocks);
  header.after(bar);

  const tick = () => {
    for (const c of clockNodes) c.value.textContent = clockText(c.tz);
    renderTicker(track, ctx.latestMarkets ?? []);
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
    }
  };
  document.addEventListener('keydown', onKey);
  cleanup = () => {
    window.clearInterval(timer);
    document.removeEventListener('keydown', onKey);
  };
}
