// BDSI: how the dashboard (/dashboard) is organised.
// Upstream World Monitor turns on ~90 global panels. BDSI shows a smaller set
// in fixed groups, Bangladesh first; every other panel stays available (off)
// in the panel settings. Live webcam panels are removed entirely.

import type { PanelConfig } from '@/types';

export interface BdsiPanelGroup { id: string; label: string; tab: string; keys: readonly string[] }

/** Default-on panels, in display order. */
export const BDSI_PANEL_GROUPS: readonly BdsiPanelGroup[] = [
  { id: 'bd', tab: 'BANGLADESH', label: 'Bangladesh', keys: ['bangladesh', 'bd-dse', 'bd-taka', 'bd-bazaar', 'insights'] },
  { id: 'security', tab: 'SECURITY', label: 'Security and risk', keys: ['ucdp-events', 'displacement', 'internet-disruptions', 'satellite-fires', 'cii', 'strategic-risk', 'threat-timeline', 'security-advisories', 'gdelt-intel', 'intel'] },
  { id: 'world', tab: 'WORLD', label: 'World news', keys: ['live-news', 'politics', 'asia', 'middleeast', 'europe', 'us', 'africa', 'latam'] },
  { id: 'markets', tab: 'MARKETS', label: 'Markets and economy', keys: ['markets', 'commodities', 'energy-complex', 'energy', 'economic', 'supply-chain', 'finance'] },
  { id: 'hazards', tab: 'HAZARDS', label: 'Hazards and climate', keys: ['climate', 'disease-outbreaks', 'population-exposure'] },
  { id: 'analysis', tab: 'ANALYSIS', label: 'Analysis', keys: ['strategic-posture', 'cross-source-signals', 'thinktanks', 'world-clock', 'monitors'] },
];

/** Panels BDSI does not offer at all. */
export const BDSI_REMOVED_PANELS: ReadonlySet<string> = new Set(['live-webcams', 'windy-webcams']);

/** Map layers BDSI does not offer at all. */
export const BDSI_REMOVED_LAYERS: ReadonlySet<string> = new Set(['webcams']);

/** One-time switch of saved dashboards to this layout. Bump to re-apply after changing the groups. */
export const BDSI_DASHBOARD_LAYOUT_KEY = 'bdsi-dashboard-layout-v1';

const DEFAULT_ON: ReadonlySet<string> = new Set(BDSI_PANEL_GROUPS.flatMap((g) => g.keys));

/**
 * Reorder and re-default a variant's panel table: `map` first, then the BDSI
 * groups (enabled, in order), then every other panel (disabled, upstream
 * order). Removed panels are dropped. Group keys missing from `panels` are
 * skipped. Pure; exported for tests.
 */
export function organizeBdsiPanels(panels: Record<string, PanelConfig>): Record<string, PanelConfig> {
  const out: Record<string, PanelConfig> = {};
  if (panels.map) out.map = { ...panels.map, enabled: true };
  for (const g of BDSI_PANEL_GROUPS) {
    for (const key of g.keys) {
      const cfg = panels[key];
      if (cfg && !(key in out)) out[key] = { ...cfg, enabled: true };
    }
  }
  for (const [key, cfg] of Object.entries(panels)) {
    if (key in out || BDSI_REMOVED_PANELS.has(key)) continue;
    // Upstream Pro panels keep their flag: BDSI never shows them (BRAND.hideUpstreamPremiumPanels),
    // and the WebMCP tool inventory is derived from these defaults.
    out[key] = { ...cfg, enabled: cfg.premium === 'locked' ? cfg.enabled : false };
  }
  return out;
}

/**
 * Apply the BDSI defaults to a visitor's saved panel settings: removed panels
 * are deleted, BDSI group panels are switched on and every other panel the
 * variant knows is switched off. Returns a new object. Pure; exported for tests.
 */
export function applyBdsiLayoutToSaved(
  saved: Record<string, PanelConfig>,
  defaults: Record<string, PanelConfig>,
): Record<string, PanelConfig> {
  const out: Record<string, PanelConfig> = {};
  for (const [key, cfg] of Object.entries(saved)) {
    if (BDSI_REMOVED_PANELS.has(key)) continue;
    out[key] = key in defaults ? { ...cfg, enabled: DEFAULT_ON.has(key) || key === 'map' } : cfg;
  }
  for (const key of DEFAULT_ON) {
    if (!(key in out) && defaults[key]) out[key] = { ...defaults[key], enabled: true };
  }
  return out;
}

/** Dashboard tab ids: 'all', each group id, and 'other' for panels outside the groups. */
export type BdsiTab = 'all' | 'other' | string;

/** Which tab a panel belongs to. Pure; exported for tests. */
export function tabOfPanel(key: string): string {
  return BDSI_PANEL_GROUPS.find((g) => g.keys.includes(key))?.id ?? 'other';
}

/** Whether a panel is shown under a tab. The map is always shown. Pure; exported for tests. */
export function panelShownInTab(key: string, tab: BdsiTab): boolean {
  return tab === 'all' || key === 'map' || tabOfPanel(key) === tab;
}
