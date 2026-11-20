// BDSI terminal: SCRN — DSE equity screener, watchlist and price alerts.
// Data: /api/bd-stock?screen=1 (all DSE instruments from dse.com.bd public pages).
// Watchlist and alerts live in this browser (localStorage); alerts are checked
// while the terminal is open, and the screen says so.

import type { Screen } from '../shell';
import { h, fmtNum, fmtInt, pct, signClass, dhakaTime, sourceLine, stateBox } from '../dom';
import { setStatus } from '../data';

export interface Row { code: string; ltp: number | null; ycp: number | null; high: number | null; low: number | null; volume: number | null; valueMn: number | null; trades: number | null; percent: number | null; category: string | null; board: string | null; sector: string | null; assetType: string | null }
export interface Criteria { text: string; sector: string; category: string; board: string; assetType: string; minPrice: number | null; maxPrice: number | null; minChange: number | null; maxChange: number | null; minValueMn: number | null; tradedOnly: boolean }
type SortKey = 'code' | 'sector' | 'ltp' | 'percent' | 'valueMn' | 'volume' | 'trades';

export const DEFAULT_CRITERIA: Criteria = { text: '', sector: '', category: '', board: '', assetType: 'EQ', minPrice: null, maxPrice: null, minChange: null, maxChange: null, minValueMn: null, tradedOnly: true };

/** Pure filter used by the screener (exported for tests). */
export function screen(rows: Row[], c: Criteria): Row[] {
  const q = c.text.trim().toUpperCase();
  return rows.filter((r) =>
    (!q || r.code.includes(q))
    && (!c.sector || r.sector === c.sector)
    && (!c.category || r.category === c.category)
    && (!c.board || r.board === c.board)
    && (!c.assetType || r.assetType === c.assetType)
    && (c.minPrice == null || (r.ltp ?? -Infinity) >= c.minPrice)
    && (c.maxPrice == null || (r.ltp ?? Infinity) <= c.maxPrice)
    && (c.minChange == null || (r.percent ?? -Infinity) >= c.minChange)
    && (c.maxChange == null || (r.percent ?? Infinity) <= c.maxChange)
    && (c.minValueMn == null || (r.valueMn ?? 0) >= c.minValueMn)
    && (!c.tradedOnly || (r.trades ?? 0) > 0));
}

const WL_KEY = 'bdsi-watchlist';
const AL_KEY = 'bdsi-alerts';
interface Alert { code: string; op: '>=' | '<='; price: number; created: number; hit?: number }

function load<T>(key: string, fallback: T): T {
  try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v ?? fallback; } catch { return fallback; }
}
function save(key: string, v: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ }
}

export const screenerScreen: Screen = {
  code: 'SCRN',
  title: 'Screener',
  mount(el, _args, ctx) {
    let alive = true;
    let rows: Row[] = [];
    let session: { sessionDate?: string; isOpen?: boolean } | null = null;
    let fetchedAt = 0;
    const crit: Criteria = { ...DEFAULT_CRITERIA };
    let sort: { key: SortKey; dir: 1 | -1 } = { key: 'valueMn', dir: -1 };
    let watch: string[] = load<string[]>(WL_KEY, ['GP', 'SQURPHARMA', 'BATBC', 'BRACBANK']);
    let alerts: Alert[] = load<Alert[]>(AL_KEY, []);

    const critBox = h('form', { class: 'tp-crit', 'aria-label': 'Screen criteria' });
    const results = h('div', { class: 'tp-results' }, stateBox('loading', 'Loading all DSE instruments…'));
    const side = h('aside', { class: 'tp-scrn-side' });
    el.append(h('section', { class: 'tp-screen' },
      h('header', { class: 'tp-screen-head' }, h('span', { class: 'tp-logo-sm' }, 'SCRN'), h('h1', {}, 'DSE EQUITY SCREENER, WATCHLIST AND ALERTS')),
      h('div', { class: 'tp-scrn' }, critBox, results, side)));

    const numIn = (label: string, key: keyof Criteria, step = 'any') => {
      const i = h('input', { type: 'number', step, inputmode: 'decimal', value: crit[key] == null ? '' : String(crit[key]), 'aria-label': label }) as HTMLInputElement;
      i.addEventListener('input', () => { (crit[key] as number | null) = i.value === '' ? null : Number(i.value); renderResults(); });
      return h('label', { class: 'tp-field' }, h('span', {}, label), i);
    };
    const select = (label: string, key: 'sector' | 'category' | 'board' | 'assetType', options: string[]) => {
      const s = h('select', { 'aria-label': label }, h('option', { value: '' }, 'All'), ...options.map((o) => h('option', { value: o }, o))) as HTMLSelectElement;
      s.value = crit[key];
      s.addEventListener('change', () => { crit[key] = s.value; renderResults(); });
      return h('label', { class: 'tp-field' }, h('span', {}, label), s);
    };
    const renderCriteria = () => {
      const uniq = (k: keyof Row) => [...new Set(rows.map((r) => r[k]).filter((x): x is string => typeof x === 'string' && x !== ''))].sort();
      const text = h('input', { type: 'search', value: crit.text, placeholder: 'e.g. BANK', 'aria-label': 'Code contains' }) as HTMLInputElement;
      text.addEventListener('input', () => { crit.text = text.value; renderResults(); });
      const traded = h('input', { type: 'checkbox', checked: crit.tradedOnly }) as HTMLInputElement;
      traded.addEventListener('change', () => { crit.tradedOnly = traded.checked; renderResults(); });
      critBox.replaceChildren(
        h('div', { class: 'tp-stat-k' }, 'CRITERIA'),
        h('label', { class: 'tp-field' }, h('span', {}, 'Code contains'), text),
        select('Sector', 'sector', uniq('sector')), select('Category', 'category', uniq('category')),
        select('Board', 'board', uniq('board')), select('Type', 'assetType', uniq('assetType')),
        numIn('Min price ৳', 'minPrice'), numIn('Max price ৳', 'maxPrice'),
        numIn('Min change %', 'minChange'), numIn('Max change %', 'maxChange'),
        numIn('Min value ৳ mn', 'minValueMn'),
        h('label', { class: 'tp-check' }, traded, ' Traded in the session only'),
        h('button', { type: 'button', class: 'tp-chip', onclick: () => { Object.assign(crit, DEFAULT_CRITERIA); renderCriteria(); renderResults(); } }, 'RESET'),
        h('p', { class: 'tp-source' }, 'P/E and yield per stock are on each stock page (DSE publishes them per company, not in the price list).'));
    };

    const exportCsv = (list: Row[]) => {
      const head = ['code', 'sector', 'category', 'board', 'type', 'ltp', 'change_pct', 'value_mn', 'volume', 'trades'];
      const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const csv = [head.join(','), ...list.map((r) => [r.code, r.sector, r.category, r.board, r.assetType, r.ltp, r.percent?.toFixed(2), r.valueMn, r.volume, r.trades].map(esc).join(','))].join('\n');
      const a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `bdsi-screen-${session?.sessionDate ?? 'dse'}.csv` });
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };

    const renderResults = () => {
      if (!rows.length) return;
      const list = screen(rows, crit).sort((a, b) => {
        const k = sort.key;
        const av = a[k], bv = b[k];
        if (typeof av === 'string' || typeof bv === 'string') return sort.dir * String(av ?? '').localeCompare(String(bv ?? ''));
        return sort.dir * (((av as number | null) ?? -Infinity) - ((bv as number | null) ?? -Infinity));
      });
      const th = (label: string, key: SortKey, right = true) => h('th', { class: right ? 'r' : '', 'aria-sort': sort.key === key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none' },
        h('button', { type: 'button', class: 'tp-sortbtn', onclick: () => { sort = { key, dir: sort.key === key ? (sort.dir === 1 ? -1 : 1) : (right ? -1 : 1) }; renderResults(); } }, `${label}${sort.key === key ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}`));
      results.replaceChildren(...[
        h('div', { class: 'tp-results-head' }, h('span', { class: 'tp-stat-k' }, `RESULTS · ${list.length} of ${rows.length}`),
          h('span', { class: 'tp-spacer' }),
          h('button', { type: 'button', class: 'tp-chip', onclick: () => exportCsv(list) }, 'EXPORT CSV')),
        h('div', { class: 'tp-table-scroll' }, h('table', { class: 'tp-table' },
          h('thead', {}, h('tr', {}, th('TICKER', 'code', false), th('SECTOR', 'sector', false), th('LTP', 'ltp'), th('CHG %', 'percent'), th('VALUE ৳MN', 'valueMn'), th('VOLUME', 'volume'), th('TRADES', 'trades'), h('th', {}, 'CAT'), h('th', {}, 'WATCH'))),
          h('tbody', {}, ...list.slice(0, 300).map((r) => h('tr', {},
            h('td', {}, h('a', { href: `#/stock/${encodeURIComponent(r.code)}`, class: 'tp-tick' }, r.code)),
            h('td', { class: 'tp-dim' }, r.sector ?? '—'),
            h('td', { class: 'r tp-w' }, fmtNum(r.ltp)),
            h('td', { class: `r tp-${signClass(r.percent)}` }, pct(r.percent)),
            h('td', { class: 'r' }, fmtNum(r.valueMn)),
            h('td', { class: 'r' }, fmtInt(r.volume)),
            h('td', { class: 'r' }, fmtInt(r.trades)),
            h('td', {}, r.category ?? '—'),
            h('td', {}, h('button', { type: 'button', class: 'tp-linkbtn', 'aria-label': `${watch.includes(r.code) ? 'Remove' : 'Add'} ${r.code} ${watch.includes(r.code) ? 'from' : 'to'} watchlist`, onclick: () => { toggleWatch(r.code); } }, watch.includes(r.code) ? '★' : '☆'))))))),
        list.length > 300 ? h('p', { class: 'tp-source' }, `Showing the first 300; narrow the criteria or export CSV for all ${list.length}.`) : null,
        sourceLine(`Source: Dhaka Stock Exchange price list · ${session?.isOpen ? `live, checked ${dhakaTime(fetchedAt)} DHK` : `close of ${session?.sessionDate ?? '—'}`}`),
      ].filter((x): x is HTMLElement => x !== null));
    };

    const toggleWatch = (code: string) => {
      watch = watch.includes(code) ? watch.filter((c) => c !== code) : [...watch, code];
      save(WL_KEY, watch);
      renderSide();
      renderResults();
    };

    const checkAlerts = () => {
      let changed = false;
      for (const a of alerts) {
        if (a.hit) continue;
        const r = rows.find((x) => x.code === a.code);
        if (!r || r.ltp == null) continue;
        if ((a.op === '>=' && r.ltp >= a.price) || (a.op === '<=' && r.ltp <= a.price)) {
          a.hit = Date.now();
          changed = true;
          ctx.status(`ALERT: ${a.code} ${fmtNum(r.ltp)} is ${a.op === '>=' ? 'at or above' : 'at or below'} ${fmtNum(a.price)}`, 'info');
        }
      }
      if (changed) save(AL_KEY, alerts);
    };

    const renderSide = () => {
      const code = h('input', { type: 'text', placeholder: 'GP', maxlength: '20', 'aria-label': 'Alert code', class: 'tp-alert-code' }) as HTMLInputElement;
      const op = h('select', { 'aria-label': 'Condition' }, h('option', { value: '>=' }, '≥'), h('option', { value: '<=' }, '≤')) as HTMLSelectElement;
      const price = h('input', { type: 'number', step: 'any', placeholder: '৳', 'aria-label': 'Alert price', class: 'tp-alert-price' }) as HTMLInputElement;
      const form = h('form', { class: 'tp-alert-form' }, code, op, price, h('button', { type: 'submit', class: 'tp-chip on' }, '+ ALERT'));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const c = code.value.trim().toUpperCase(), p = Number(price.value);
        if (!c || !Number.isFinite(p) || p <= 0) { ctx.status('Alert needs a code and a price', 'err'); return; }
        if (rows.length && !rows.some((r) => r.code === c)) { ctx.status(`${c} is not a DSE code`, 'err'); return; }
        alerts = [...alerts, { code: c, op: op.value as Alert['op'], price: p, created: Date.now() }];
        save(AL_KEY, alerts);
        checkAlerts();
        renderSide();
      });
      side.replaceChildren(
        h('div', { class: 'tp-stat-k' }, 'MY WATCHLIST'),
        watch.length ? h('table', { class: 'tp-table' }, h('tbody', {}, ...watch.map((c) => {
          const r = rows.find((x) => x.code === c);
          return h('tr', {},
            h('td', {}, h('a', { href: `#/stock/${encodeURIComponent(c)}`, class: 'tp-tick' }, c)),
            h('td', { class: 'r tp-w' }, fmtNum(r?.ltp)),
            h('td', { class: `r tp-${signClass(r?.percent)}` }, pct(r?.percent)),
            h('td', {}, h('button', { type: 'button', class: 'tp-linkbtn', 'aria-label': `Remove ${c}`, onclick: () => toggleWatch(c) }, '✕')));
        }))) : h('p', { class: 'tp-muted' }, 'Star a row to add it.'),
        h('div', { class: 'tp-stat-k' }, 'PRICE ALERTS'),
        alerts.length ? h('ul', { class: 'tp-alerts' }, ...alerts.map((a, i) => h('li', { class: a.hit ? 'tp-amber' : '' },
          `${a.code} ${a.op === '>=' ? '≥' : '≤'} ${fmtNum(a.price)}${a.hit ? ` · triggered ${dhakaTime(a.hit)} DHK` : ''} `,
          h('button', { type: 'button', class: 'tp-linkbtn', 'aria-label': `Delete alert ${a.code}`, onclick: () => { alerts = alerts.filter((_, j) => j !== i); save(AL_KEY, alerts); renderSide(); } }, '✕')))) : h('p', { class: 'tp-muted' }, 'No alerts.'),
        form,
        h('p', { class: 'tp-source' }, 'Watchlist and alerts are saved in this browser. Alerts are checked while the BDSI terminal is open (prices refresh every 2 minutes); email/phone alerts are planned.'));
    };

    const load_ = async () => {
      try {
        const r = await fetch('/api/bd-stock?screen=1', { signal: AbortSignal.timeout(25_000) });
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json() as { rows: Row[]; session: typeof session; stale?: boolean };
        if (!alive) return;
        rows = j.rows; session = j.session; fetchedAt = Date.now();
        setStatus('DSE', j.stale ? 'stale' : 'ok');
        renderCriteria(); renderResults(); renderSide(); checkAlerts();
      } catch {
        if (!alive) return;
        setStatus('DSE', 'error');
        if (!rows.length) results.replaceChildren(stateBox('error', 'Dhaka Stock Exchange price list unavailable right now.'));
      }
    };
    renderCriteria(); renderSide();
    void load_();
    const t = window.setInterval(() => void load_(), 120_000);
    return () => { alive = false; window.clearInterval(t); };
  },
};
