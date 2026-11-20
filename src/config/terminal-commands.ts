// BDSI: the BDNEWS> command line registry and parser (CLAUDE.md §6).
//
// One typed table: a new command is one entry. Pure module (no DOM), so the
// parser is unit-tested in tests/terminal-commands.test.mts; src/app/terminal-bar.ts
// renders the results.

export type PlanTier = 'free' | 'pro' | 'business' | 'enterprise' | 'government';

export type CommandAction =
  /** Scroll to and flash a dashboard panel (data-panel key). */
  | { type: 'panel'; target: string }
  /** Scroll to the map. */
  | { type: 'map' }
  /** Show the command list, or one command's help. */
  | { type: 'help' }
  /** Not built yet: say so, and optionally open the nearest existing panel. */
  | { type: 'planned'; phase: 1 | 2 | 3; fallback?: string };

export interface TerminalCommandDef {
  mnemonic: string;
  aliases?: readonly string[];
  /** Short label for the function-key strip; commands without one get no F-key. */
  fkeyLabel?: string;
  description: string;
  args?: string;
  action: CommandAction;
  tier: PlanTier;
}

export const COMMANDS: readonly TerminalCommandDef[] = [
  // Function keys F1–F10, in order.
  { mnemonic: 'BD', aliases: ['BDN', 'N'], fkeyLabel: 'BD NEWS', description: 'Bangladesh news from Bangladeshi outlets and stories about Bangladesh', action: { type: 'panel', target: 'bangladesh' }, tier: 'free' },
  { mnemonic: 'TV', aliases: ['LIVE'], fkeyLabel: 'LIVE TV', description: 'Live news channels', action: { type: 'panel', target: 'live-news' }, tier: 'free' },
  { mnemonic: 'DSE', aliases: ['DSEX', 'STOCKS', 'SHARE'], fkeyLabel: 'DSE', description: 'Dhaka Stock Exchange: DSEX, DS30, DSES, turnover, breadth, top movers', action: { type: 'panel', target: 'bd-dse' }, tier: 'free' },
  { mnemonic: 'FX', aliases: ['TAKA', 'BDT', 'USDBDT'], fkeyLabel: 'TAKA', description: 'Taka exchange rates from Bangladesh Bank', action: { type: 'panel', target: 'bd-taka' }, tier: 'free' },
  { mnemonic: 'BAZAR', aliases: ['BAZAAR', 'TCB', 'PRICES'], fkeyLabel: 'BAZAR', description: 'Dhaka retail prices of essentials (TCB)', action: { type: 'panel', target: 'bd-bazaar' }, tier: 'free' },
  { mnemonic: 'MAP', aliases: ['GEO'], fkeyLabel: 'MAP', description: 'Map with the Bangladesh layer preset', action: { type: 'map' }, tier: 'free' },
  { mnemonic: 'MKT', aliases: ['MKTS', 'EQ'], fkeyLabel: 'WORLD MKTS', description: 'World markets', action: { type: 'panel', target: 'markets' }, tier: 'free' },
  { mnemonic: 'WRLD', aliases: ['WORLD', 'W'], fkeyLabel: 'WORLD', description: 'World politics news', action: { type: 'panel', target: 'politics' }, tier: 'free' },
  { mnemonic: 'AI', aliases: ['INS', 'INSIGHTS'], fkeyLabel: 'INSIGHTS', description: 'AI insights and focal points, Bangladesh first', action: { type: 'panel', target: 'insights' }, tier: 'free' },
  { mnemonic: 'RISK', aliases: ['CII'], fkeyLabel: 'RISK', description: 'Country instability and risk', args: '[district]', action: { type: 'panel', target: 'cii' }, tier: 'free' },

  // Available now, no F-key.
  { mnemonic: 'NEWS', description: 'Bangladesh news', args: '[topic]', action: { type: 'panel', target: 'bangladesh' }, tier: 'free' },
  { mnemonic: 'CONF', aliases: ['UCDP', 'CONFLICT'], description: 'Armed conflict events (UCDP)', action: { type: 'panel', target: 'ucdp-events' }, tier: 'free' },
  { mnemonic: 'REF', aliases: ['REFUGEES', 'IDP'], description: 'Refugees and displacement', action: { type: 'panel', target: 'displacement' }, tier: 'free' },
  { mnemonic: 'NET', aliases: ['OUTAGE', 'SHUTDOWN'], description: 'Internet disruptions (IODA)', action: { type: 'panel', target: 'internet-disruptions' }, tier: 'free' },
  { mnemonic: 'FIRE', aliases: ['FIRES'], description: 'Active fires (NASA FIRMS)', action: { type: 'panel', target: 'satellite-fires' }, tier: 'free' },
  { mnemonic: 'HELP', aliases: ['H', '?'], description: 'List all functions; HELP <FUNC> explains one', args: '[function]', action: { type: 'help' }, tier: 'free' },

  // Planned (CLAUDE.md §6 and §9 roadmap). Each says so instead of failing.
  { mnemonic: 'CSE', description: 'Chittagong Stock Exchange overview', action: { type: 'planned', phase: 1, fallback: 'bd-dse' }, tier: 'free' },
  { mnemonic: 'SCRN', description: 'Stock screener (P/E, yield, sector, market cap)', action: { type: 'planned', phase: 1, fallback: 'bd-dse' }, tier: 'pro' },
  { mnemonic: 'WL', description: 'Watchlists', action: { type: 'planned', phase: 1 }, tier: 'pro' },
  { mnemonic: 'ALRT', description: 'Price, volume and news alerts', action: { type: 'planned', phase: 1 }, tier: 'pro' },
  { mnemonic: 'BB', description: 'Bangladesh Bank dashboard', action: { type: 'planned', phase: 1, fallback: 'bd-taka' }, tier: 'business' },
  { mnemonic: 'CPI', description: 'Inflation (BBS)', action: { type: 'planned', phase: 1 }, tier: 'business' },
  { mnemonic: 'GDP', description: 'GDP growth', action: { type: 'planned', phase: 1 }, tier: 'business' },
  { mnemonic: 'REMIT', description: 'Remittance inflows', action: { type: 'planned', phase: 1 }, tier: 'business' },
  { mnemonic: 'EXP', description: 'Exports (EPB)', action: { type: 'planned', phase: 1 }, tier: 'business' },
  { mnemonic: 'IMP', description: 'Imports', action: { type: 'planned', phase: 1 }, tier: 'business' },
  { mnemonic: 'RES', description: 'Foreign exchange reserves (gross and BPM6)', action: { type: 'planned', phase: 1 }, tier: 'business' },
  { mnemonic: 'YC', description: 'Treasury yield curve', action: { type: 'planned', phase: 1 }, tier: 'business' },
  { mnemonic: 'RMG', description: 'Garment sector: exports, unrest, wage board', action: { type: 'planned', phase: 1 }, tier: 'business' },
  { mnemonic: 'PORT', description: 'Chattogram and Mongla ports', action: { type: 'planned', phase: 1 }, tier: 'business' },
  { mnemonic: 'POWER', description: 'Electricity demand, load-shedding, gas, fuel', action: { type: 'planned', phase: 1 }, tier: 'business' },
  { mnemonic: 'BORDER', description: 'Myanmar and India border watch', action: { type: 'planned', phase: 2, fallback: 'ucdp-events' }, tier: 'enterprise' },
  { mnemonic: 'SEA', description: 'Bay of Bengal maritime picture', action: { type: 'planned', phase: 2, fallback: 'map' }, tier: 'government' },
  { mnemonic: 'WX', description: 'Weather (BMD)', action: { type: 'planned', phase: 1, fallback: 'map' }, tier: 'free' },
  { mnemonic: 'FLOOD', description: 'Flood forecasts and river levels (FFWC)', action: { type: 'planned', phase: 1, fallback: 'map' }, tier: 'free' },
  { mnemonic: 'CYCLONE', description: 'Cyclone tracks and signals (BMD)', action: { type: 'planned', phase: 1, fallback: 'map' }, tier: 'free' },
  { mnemonic: 'BRIEF', description: 'AI morning brief', action: { type: 'planned', phase: 2, fallback: 'insights' }, tier: 'pro' },
  { mnemonic: 'ASK', description: 'Ask the AI analyst (answers with sources)', args: '<question>', action: { type: 'planned', phase: 2 }, tier: 'pro' },
];

export const FKEY_COMMANDS: readonly TerminalCommandDef[] = COMMANDS.filter((c) => c.fkeyLabel);

export type ParseResult =
  | { kind: 'empty' }
  | { kind: 'run'; command: TerminalCommandDef; args: string }
  | { kind: 'help'; topic: TerminalCommandDef | null; unknownTopic?: string }
  | { kind: 'ticker'; code: string }
  | { kind: 'unknown'; input: string; suggestions: string[] };

const BY_NAME: ReadonlyMap<string, TerminalCommandDef> = (() => {
  const m = new Map<string, TerminalCommandDef>();
  for (const c of COMMANDS) {
    m.set(c.mnemonic, c);
    for (const a of c.aliases ?? []) if (!m.has(a)) m.set(a, c);
  }
  return m;
})();

export function findCommand(name: string): TerminalCommandDef | null {
  return BY_NAME.get(name.trim().toUpperCase()) ?? null;
}

/** Levenshtein distance, capped for speed. */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/** Up to `max` mnemonics closest to `word`: prefix matches first, then small edit distances. */
export function suggestCommands(word: string, max = 3): string[] {
  const q = word.trim().toUpperCase();
  if (!q) return [];
  const scored: Array<{ name: string; score: number }> = [];
  for (const c of COMMANDS) {
    let best = Infinity;
    for (const n of [c.mnemonic, ...(c.aliases ?? [])]) {
      if (n.startsWith(q) || q.startsWith(n)) best = Math.min(best, 0.5);
      const d = distance(q, n);
      if (d <= Math.max(1, Math.floor(n.length / 3))) best = Math.min(best, d);
    }
    if (best !== Infinity) scored.push({ name: c.mnemonic, score: best });
  }
  return scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name)).slice(0, max).map((s) => s.name);
}

/**
 * Parse `<MNEMONIC> [ARGS] <GO>`. Case-insensitive; a trailing "GO" or "<GO>" is
 * ignored. `knownTickers` (DSE codes the app has loaded) lets `GP <GO>` resolve
 * to a ticker when it is not a command.
 */
export function parseCommand(input: string, knownTickers: ReadonlySet<string> = new Set()): ParseResult {
  const cleaned = input.trim().replace(/\s*<\s*GO\s*>\s*$/i, '').replace(/\s+GO$/i, '').trim();
  if (!cleaned) return { kind: 'empty' };
  const [head = '', ...rest] = cleaned.split(/\s+/);
  const word = head.toUpperCase();
  const args = rest.join(' ');

  const command = findCommand(word);
  if (command?.action.type === 'help') {
    if (!args) return { kind: 'help', topic: null };
    const topic = findCommand(args.split(/\s+/)[0]!);
    return topic ? { kind: 'help', topic } : { kind: 'help', topic: null, unknownTopic: args.toUpperCase() };
  }
  if (command) return { kind: 'run', command, args };
  if (knownTickers.has(word)) return { kind: 'ticker', code: word };
  return { kind: 'unknown', input: word, suggestions: suggestCommands(word) };
}

/** One help line: "DSE [args] — description (aliases) · PLANNED · PRO". */
export function helpLine(c: TerminalCommandDef): string {
  const parts = [`${c.mnemonic}${c.args ? ` ${c.args}` : ''} — ${c.description}`];
  if (c.aliases?.length) parts.push(`also ${c.aliases.join(', ')}`);
  if (c.action.type === 'planned') parts.push(`planned, phase ${c.action.phase}`);
  if (c.tier !== 'free') parts.push(c.tier.toUpperCase());
  return parts.join(' · ');
}
