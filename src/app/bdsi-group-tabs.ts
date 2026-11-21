// BDSI: tab row on the dashboard that shows one group of panels at a time
// (Bangladesh, Security, World, Markets, Hazards, Analysis, Other, All).
// Panels are only hidden with a class; nothing is unmounted or disabled.

import { BDSI_PANEL_GROUPS, panelShownInTab, tabOfPanel, type BdsiTab } from '@/config/bdsi-dashboard';

const STORE_KEY = 'bdsi-dashboard-tab';
const TABS_ID = 'bdsiGroupTabs';
const OFF = 'bdsi-gtab-off';
const GRIDS = ['panelsGrid', 'mapBottomGrid'];

let current: BdsiTab = 'bd';
let buttons = new Map<string, HTMLButtonElement>();
let observer: MutationObserver | null = null;

function readStored(): BdsiTab {
  try {
    const v = localStorage.getItem(STORE_KEY);
    if (v && (v === 'all' || v === 'other' || BDSI_PANEL_GROUPS.some((g) => g.id === v))) return v;
  } catch { /* storage unavailable */ }
  return 'bd';
}

function panels(): HTMLElement[] {
  return GRIDS.flatMap((id) => Array.from(document.getElementById(id)?.querySelectorAll<HTMLElement>(':scope > .panel[data-panel]') ?? []));
}

function apply(): void {
  let otherCount = 0;
  for (const p of panels()) {
    const key = p.dataset.panel ?? '';
    if (tabOfPanel(key) === 'other' && key !== 'map') otherCount++;
    p.classList.toggle(OFF, !panelShownInTab(key, current));
  }
  const other = buttons.get('other');
  if (other) other.hidden = otherCount === 0 && current !== 'other';
  for (const [id, b] of buttons) {
    const on = id === current;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  }
}

export function setDashboardTab(tab: BdsiTab): void {
  current = tab;
  try { localStorage.setItem(STORE_KEY, tab); } catch { /* storage unavailable */ }
  apply();
  document.getElementById('panelsGrid')?.scrollTo({ top: 0 });
}

/** Make sure a panel is visible before jumping to it: switch to its tab if needed. */
export function revealPanel(key: string): void {
  if (!panelShownInTab(key, current)) setDashboardTab(tabOfPanel(key));
}

/** Insert the tab row after `anchor` (the terminal bar). Safe to call again. */
export function mountGroupTabs(anchor: HTMLElement): HTMLElement {
  document.getElementById(TABS_ID)?.remove();
  observer?.disconnect();
  current = readStored();
  buttons = new Map();

  const row = document.createElement('div');
  row.id = TABS_ID;
  row.className = 'bdsi-gtabs';
  row.setAttribute('role', 'tablist');
  row.setAttribute('aria-label', 'Dashboard sections');
  const defs: Array<{ id: string; label: string; title: string }> = [
    ...BDSI_PANEL_GROUPS.map((g) => ({ id: g.id, label: g.tab, title: g.label })),
    { id: 'other', label: 'OTHER', title: 'Panels you switched on that are outside the groups' },
    { id: 'all', label: 'ALL', title: 'Every panel' },
  ];
  for (const d of defs) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bdsi-gtab';
    b.textContent = d.label;
    b.title = d.title;
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => setDashboardTab(d.id));
    buttons.set(d.id, b);
    row.append(b);
  }
  // Arrow keys move between tabs.
  row.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const ids = defs.map((d) => d.id).filter((id) => !buttons.get(id)?.hidden);
    const i = ids.indexOf(current);
    const next = ids[(i + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length];
    if (next) { e.preventDefault(); setDashboardTab(next); buttons.get(next)?.focus(); }
  });
  anchor.after(row);

  // Panels mount lazily and can be added from Settings: re-apply when the grids change.
  const obs = new MutationObserver(() => apply());
  observer = obs;
  const watched = new Set<string>();
  const watch = (tries: number): void => {
    if (observer !== obs) return;
    for (const id of GRIDS) {
      const grid = document.getElementById(id);
      if (grid && !watched.has(id)) { obs.observe(grid, { childList: true }); watched.add(id); }
    }
    apply();
    // The grids may render after the bar; keep looking for a few seconds.
    if (watched.size < GRIDS.length && tries > 0) setTimeout(() => watch(tries - 1), 500);
  };
  watch(20);
  return row;
}
