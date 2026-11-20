// BD Situation Intelligence: Dhaka Stock Exchange, Taka rates and Dhaka bazaar price panels.
import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import { trustedHtml } from '@/utils/dom-utils';
import {
  fetchBdMarkets,
  hasData,
  unitEn,
  type BdBazaar,
  type BdBazaarItem,
  type BdDse,
  type BdFx,
  type BdMarkets,
} from '@/services/bd-markets';

const fmt = (v: number | null | undefined, digits = 2): string =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const fmtInt = (v: number | null | undefined): string => (v == null ? '—' : Math.round(v).toLocaleString('en-US'));
const signCls = (v: number | null | undefined): string => (v == null || v === 0 ? 'flat' : v > 0 ? 'up' : 'down');
const arrow = (v: number | null | undefined): string => (v == null || v === 0 ? '■' : v > 0 ? '▲' : '▼');
const pct = (v: number | null | undefined, digits = 2): string =>
  v == null || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`;

function updatedLabel(at?: number): string {
  if (!at) return '';
  const t = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(at));
  return `checked ${t} Dhaka`;
}

function sourceLine(src: { source?: string; sourceUrl?: string; stale?: boolean; updatedAt?: number }, extra = ''): string {
  const link = src.sourceUrl
    ? `<a href="${escapeHtml(src.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(src.source ?? 'Source')}</a>`
    : escapeHtml(src.source ?? '');
  const stale = src.stale ? ' · <span class="bdm-stale">source unreachable, showing last data</span>' : '';
  return `<div class="bdm-src">Source: ${link}${extra ? ` · ${escapeHtml(extra)}` : ''} · ${escapeHtml(updatedLabel(src.updatedAt))}${stale}</div>`;
}

abstract class BdMarketsPanel extends Panel {
  private timer: ReturnType<typeof setInterval> | null = null;
  /** True once real data has rendered; a later failure keeps it on screen instead of an error. */
  protected _hasData = false;

  constructor(id: string, title: string, infoTooltip: string, private readonly refreshMs: number) {
    super({ id, title, infoTooltip });
    this.showLoading();
    queueMicrotask(() => void this.fetchData());
    this.timer = setInterval(() => void this.fetchData(), this.refreshMs);
  }

  public async fetchData(): Promise<void> {
    try {
      const data = await fetchBdMarkets();
      this.render(data);
    } catch {
      this.fail('Bangladesh market data is unavailable right now.');
    }
  }

  protected fail(message: string): void {
    if (this._hasData) return;
    this.showError(message, () => void this.fetchData());
  }

  protected abstract render(data: BdMarkets): void;

  public override destroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    super.destroy();
  }
}

export class DseBdPanel extends BdMarketsPanel {
  constructor() {
    super('bd-dse', 'Dhaka Stock Exchange', 'DSEX, DS30 and DSES indices, turnover, market breadth and top movers from the Dhaka Stock Exchange. Refreshed every minute.', 60_000);
  }

  protected render(data: BdMarkets): void {
    const d = data.dse;
    if (!hasData<BdDse>(d)) {
      this.fail('Dhaka Stock Exchange data is unavailable right now.');
      return;
    }
    const idx = d.indices.map((i) => `
      <div class="bdm-idx ${signCls(i.change)}">
        <div class="bdm-idx-k">${escapeHtml(i.key)}</div>
        <div class="bdm-idx-v">${fmt(i.value)}</div>
        <div class="bdm-idx-c">${arrow(i.change)} ${fmt(i.change == null ? null : Math.abs(i.change))} · ${pct(i.percent)}</div>
      </div>`).join('');
    const b = d.breadth;
    const total = (b.advanced ?? 0) + (b.declined ?? 0) + (b.unchanged ?? 0) || 1;
    const bar = `<div class="bdm-breadth" title="Advanced ${b.advanced ?? 0}, declined ${b.declined ?? 0}, unchanged ${b.unchanged ?? 0}">
        <span class="up" style="width:${((b.advanced ?? 0) / total) * 100}%"></span><span class="flat" style="width:${((b.unchanged ?? 0) / total) * 100}%"></span><span class="down" style="width:${((b.declined ?? 0) / total) * 100}%"></span>
      </div>`;
    const movers = (title: string, list: BdDse['gainers']) => `
      <table class="wm-table bdm-table"><thead><tr><th>${title}</th><th class="r">LTP</th><th class="r">Chg</th></tr></thead><tbody>
      ${list.slice(0, 6).map((m) => `<tr><td>${escapeHtml(m.code)}</td><td class="r">${fmt(m.ltp)}</td><td class="r ${signCls(m.percent)}">${pct(m.percent)}</td></tr>`).join('') || '<tr><td colspan="3" class="bdm-muted">—</td></tr>'}
      </tbody></table>`;
    const s = d.session;
    const status = s.isOpen
      ? `<span class="bdm-status open">● OPEN</span>`
      : `<span class="bdm-status closed">● CLOSED</span>`;
    const hours = s.opening && s.closing ? `Session ${escapeHtml(s.opening)}–${escapeHtml(s.closing)} Dhaka` : '';
    this.setTrustedContent(trustedHtml(`
      <div class="bdm">
        <div class="bdm-row bdm-meta">${status}<span class="bdm-muted">${hours}${d.totals.tradeTime ? ` · last trade ${escapeHtml(d.totals.tradeTime)}` : ''}</span></div>
        <div class="bdm-idx-row">${idx}</div>
        <div class="bdm-stats">
          <div><span>Turnover</span><b>৳ ${fmt(d.totals.turnoverMn)} mn</b></div>
          <div><span>Volume</span><b>${fmtInt(d.totals.volume)}</b></div>
          <div><span>Trades</span><b>${fmtInt(d.totals.trades)}</b></div>
          <div><span>Adv / Dec / Unch</span><b><i class="up">${b.advanced ?? '—'}</i> / <i class="down">${b.declined ?? '—'}</i> / ${b.unchanged ?? '—'}</b></div>
        </div>
        ${bar}
        <div class="bdm-cols">${movers('Top gainers', d.gainers)}${movers('Top losers', d.losers)}</div>
        ${sourceLine(d)}
      </div>`, 'BD markets panel: numbers formatted locally, strings escaped'));
    this._hasData = true;
  }
}

const FX_ORDER = ['USD', 'EUR', 'GBP', 'INR', 'CNH', 'JPY', 'SGD', 'AUD', 'CAD', 'SEK', 'LKR'];
const FX_NAMES: Record<string, string> = {
  USD: 'US dollar', EUR: 'Euro', GBP: 'British pound', INR: 'Indian rupee', CNH: 'Chinese yuan (offshore)',
  JPY: 'Japanese yen', SGD: 'Singapore dollar', AUD: 'Australian dollar', CAD: 'Canadian dollar', SEK: 'Swedish krona', LKR: 'Sri Lankan rupee',
};

export class TakaRatesPanel extends BdMarketsPanel {
  constructor() {
    super('bd-taka', 'Taka Rates', 'Official Bangladesh Bank exchange rates of the Taka (BDT): the USD/BDT interbank rate and cross rates, as published each working day.', 15 * 60_000);
  }

  protected render(data: BdMarkets): void {
    const f = data.fx;
    if (!hasData<BdFx>(f)) {
      this.fail('Bangladesh Bank rates are unavailable right now.');
      return;
    }
    const usd = f.rates.find((r) => r.code === 'USD');
    const sorted = [...f.rates].sort((a, b) => (FX_ORDER.indexOf(a.code) + 99 * +(FX_ORDER.indexOf(a.code) < 0)) - (FX_ORDER.indexOf(b.code) + 99 * +(FX_ORDER.indexOf(b.code) < 0)));
    const rows = sorted.map((r) => `
      <tr><td><b>${escapeHtml(r.code)}</b> <span class="bdm-muted">${escapeHtml(FX_NAMES[r.code] ?? '')}</span></td>
      <td class="r">${fmt(r.mid, 4)}</td><td class="r bdm-muted">${fmt(r.bid, 4)}</td><td class="r bdm-muted">${fmt(r.ask, 4)}</td></tr>`).join('');
    const asOf = f.asOf ? new Date(`${f.asOf}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
    this.setTrustedContent(trustedHtml(`
      <div class="bdm">
        ${usd ? `<div class="bdm-hero"><span class="bdm-muted">1 USD =</span> <b>৳ ${fmt(usd.mid, 2)}</b> <span class="bdm-muted">BDT</span></div>` : ''}
        <table class="wm-table bdm-table"><thead><tr><th>Currency (1 unit in BDT)</th><th class="r">Rate</th><th class="r">Bid</th><th class="r">Ask</th></tr></thead><tbody>${rows}</tbody></table>
        ${sourceLine(f, asOf ? `rates effective ${asOf}` : '')}
      </div>`, 'BD markets panel: numbers formatted locally, strings escaped'));
    this._hasData = true;
  }
}

export class BazaarPricesPanel extends BdMarketsPanel {
  private showAll = false;
  private lastData: BdMarkets | null = null;

  constructor() {
    super('bd-bazaar', 'Dhaka Bazaar Prices', 'Daily retail prices of essential goods in Dhaka markets, from the Trading Corporation of Bangladesh (TCB). Prices in Taka; changes compare the middle of each price range.', 60 * 60_000);
    this.content.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-bdm-toggle]');
      if (!btn || !this.lastData) return;
      this.showAll = !this.showAll;
      this.render(this.lastData);
    });
  }

  private row(it: BdBazaarItem, label: string, sub: string): string {
    const range = it.low === it.high ? fmtInt(it.low) : `${fmtInt(it.low)}–${fmtInt(it.high)}`;
    return `<tr>
      <td>${label}${sub ? `<div class="bdm-sub" lang="bn">${sub}</div>` : ''}</td>
      <td class="bdm-muted">${escapeHtml(unitEn(it.unit))}</td>
      <td class="r"><b>৳ ${range}</b></td>
      <td class="r ${signCls(it.weekChangePct)}">${pct(it.weekChangePct, 1)}</td>
      <td class="r ${signCls(it.yearChangePct)}">${pct(it.yearChangePct, 1)}</td>
    </tr>`;
  }

  protected render(data: BdMarkets): void {
    this.lastData = data;
    const z = data.bazaar;
    if (!hasData<BdBazaar>(z)) {
      this.fail('TCB bazaar prices are unavailable right now.');
      return;
    }
    let body: string;
    if (this.showAll) {
      let cat: string | null = '';
      body = z.items.map((it) => {
        const head = it.category !== cat ? `<tr class="bdm-cat"><td colspan="5" lang="bn">${escapeHtml(it.category ?? '')}</td></tr>` : '';
        cat = it.category;
        return head + this.row(it, `<span lang="bn">${escapeHtml(it.name)}</span>`, '');
      }).join('');
    } else {
      body = z.key.map((it) => this.row(it, escapeHtml(it.labelEn), escapeHtml(it.name))).join('');
    }
    const date = z.date ? new Date(`${z.date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
    this.setTrustedContent(trustedHtml(`
      <div class="bdm">
        <div class="bdm-row bdm-meta"><span class="bdm-muted">Dhaka retail prices${date ? ` · ${escapeHtml(date)}` : ''}</span>
          <button type="button" class="bdm-toggle" data-bdm-toggle>${this.showAll ? 'KEY ITEMS' : `ALL ${z.items.length} ITEMS`}</button></div>
        <table class="wm-table bdm-table"><thead><tr><th>Item</th><th>Unit</th><th class="r">Today</th><th class="r">1 wk</th><th class="r">1 yr</th></tr></thead><tbody>${body}</tbody></table>
        ${sourceLine(z)}
      </div>`, 'BD markets panel: numbers formatted locally, strings escaped'));
    this._hasData = true;
  }
}
