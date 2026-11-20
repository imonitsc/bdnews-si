// BDSI terminal: tiny DOM helpers. Every text value goes through textContent or
// esc(); no untrusted string is ever parsed as HTML.

export function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

type Child = Node | string | number | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | undefined | null | ((e: Event) => void)> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, '').toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtInt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return Math.round(v).toLocaleString('en-US');
}

export function signClass(v: number | null | undefined): 'up' | 'down' | 'flat' {
  if (v == null || !Number.isFinite(v) || v === 0) return 'flat';
  return v > 0 ? 'up' : 'down';
}

export function arrow(v: number | null | undefined): string {
  const s = signClass(v);
  return s === 'up' ? '▲' : s === 'down' ? '▼' : '';
}

export function pct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
}

const DHAKA_TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', hour12: false });
const DHAKA_DATE = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric' });

export function dhakaTime(ms: number | null | undefined): string {
  return ms ? DHAKA_TIME.format(new Date(ms)) : '—';
}

export function dhakaDate(ms: number | null | undefined): string {
  return ms ? DHAKA_DATE.format(new Date(ms)) : '—';
}

/** Numbered terminal panel: header strip, "n> MNEMONIC <GO>" hint row, body. */
export function panel(opts: { n: number | string; title: string; code: string; hint: string; right?: Node | string; id?: string }, ...body: Child[]): HTMLElement {
  return h('section', { class: 'tp-panel', id: opts.id ?? `panel-${opts.n}`, 'data-panel-n': String(opts.n), tabindex: '-1', 'aria-label': opts.title },
    h('header', { class: 'tp-panel-head' },
      h('span', { class: 'tp-panel-n' }, String(opts.n)),
      h('h2', { class: 'tp-panel-title' }, opts.title),
      h('span', { class: 'tp-spacer' }),
      h('span', { class: 'tp-muted' }, opts.code),
      opts.right ?? null),
    h('div', { class: 'tp-panel-hint' }, `${opts.n}> `, h('span', { class: 'tp-hint-cmd' }, `${opts.hint} <GO>`)),
    h('div', { class: 'tp-panel-body' }, ...body));
}

export function sourceLine(text: string): HTMLElement {
  return h('p', { class: 'tp-source' }, text);
}

export function stateBox(kind: 'loading' | 'error' | 'empty' | 'planned', text: string): HTMLElement {
  return h('div', { class: `tp-state tp-state-${kind}`, role: kind === 'error' ? 'alert' : 'status' }, text);
}
