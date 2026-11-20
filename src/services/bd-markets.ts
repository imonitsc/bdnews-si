// BD Situation Intelligence: Bangladesh markets data from /api/bd-markets
// (Dhaka Stock Exchange, Bangladesh Bank taka rates, TCB Dhaka retail prices).

export interface BdIndex { key: string; value: number | null; change: number | null; percent: number | null }
export interface BdMover { code: string; ltp: number | null; percent: number | null }
interface PartMeta { stale?: boolean; updatedAt?: number; error?: string; source?: string; sourceUrl?: string }

export interface BdDse extends PartMeta {
  indices: BdIndex[];
  totals: { turnoverMn: number | null; volume: number | null; trades: number | null; marketCap: number | null; tradeTime: string | null };
  breadth: { advanced: number | null; declined: number | null; unchanged: number | null };
  session: { isOpen: boolean; phase: string | null; opening: string | null; closing: string | null; nextDate: string | null };
  gainers: BdMover[];
  losers: BdMover[];
}

export interface BdRate { code: string; bid: number; ask: number; mid: number }
export interface BdFx extends PartMeta { base: 'BDT'; asOf: string | null; rates: BdRate[]; official?: boolean }

export interface BdBazaarItem {
  name: string;
  unit: string;
  category: string | null;
  low: number;
  high: number;
  weekAgo: number | null;
  weekChangePct: number | null;
  monthChangePct: number | null;
  yearAgo: number | null;
  yearChangePct: number | null;
}
export interface BdBazaarKeyItem extends BdBazaarItem { id: string; labelEn: string }
export interface BdBazaar extends PartMeta { date: string | null; currency: 'BDT'; key: BdBazaarKeyItem[]; items: BdBazaarItem[] }

export interface BdMarkets {
  fetchedAt: string;
  dse?: BdDse;
  fx?: BdFx;
  bazaar?: BdBazaar;
}

const FRESH_MS = 30_000;
let last: { at: number; data: BdMarkets } | null = null;
let inflight: Promise<BdMarkets> | null = null;

/** Fetches all three parts; concurrent and recent callers share one request. */
export function fetchBdMarkets(force = false): Promise<BdMarkets> {
  if (!force && last && Date.now() - last.at < FRESH_MS) return Promise.resolve(last.data);
  if (inflight) return inflight;
  inflight = fetch('/api/bd-markets', { headers: { accept: 'application/json' } })
    .then(async (res) => {
      const data = (await res.json()) as BdMarkets;
      if (!res.ok && !data?.dse && !data?.fx && !data?.bazaar) throw new Error(`bd-markets HTTP ${res.status}`);
      last = { at: Date.now(), data };
      return data;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

export function hasData<T extends PartMeta>(part: T | undefined): part is T {
  return !!part && !part.error;
}

const UNIT_EN: Array<[RegExp, string]> = [
  [/প্রতি কেজি প্যা/, 'kg, packet'],
  [/প্রতি কেজি/, 'kg'],
  [/প্রতি লিটার/, 'litre'],
  [/প্রতি হালি/, '4 pcs'],
  [/প্রতি দিস্তা/, 'quire'],
  [/প্রতি মে[ঃ:]?\s*টন/, 'tonne'],
  [/৫ লিটার/, '5 litres'],
  [/২ লিটার|2 লিটার/, '2 litres'],
  [/১ লিটার/, '1 litre'],
  [/১ কেজি/, '1 kg'],
];

/** English unit label for a TCB unit string (falls back to the original). */
export function unitEn(unit: string): string {
  const u = unit.normalize('NFC');
  for (const [re, en] of UNIT_EN) if (re.test(u)) return en;
  return unit;
}
