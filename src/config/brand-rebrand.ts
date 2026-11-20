// BD Situation Intelligence: user-facing rebrand of upstream World Monitor strings.
//
// Upstream copy (all 29 locale files plus a few hard-coded strings) names the
// product "World Monitor" / "WorldMonitor" / "WM". Rather than editing every
// locale file (which would conflict on each upstream merge), translated strings
// pass through rebrandText() via an i18next post-processor.
//
// Only user-facing text is rewritten. URLs (worldmonitor.app), HTTP headers
// (X-WorldMonitor-Key), storage keys (wm-*) and source-file copyright notices
// are untouched, and the About page keeps its upstream credit (AGPL-3.0).

import { BRAND } from './brand';

/** Short product name used where upstream wrote "WorldMonitor" or "WM". */
export const BRAND_SHORT = 'BDSI';

// Order matters: longer phrases first so "World Monitor Pro" is not split.
const REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/World Monitor Pro\b/g, `${BRAND_SHORT} Pro`],
  [/WORLD MONITOR\b/g, BRAND.name.toUpperCase()],
  [/World Monitor\b/g, BRAND.name],
  // "WorldMonitor" as a word, but not inside identifiers such as X-WorldMonitor-Key.
  [/(?<![-\w])WorldMonitor(?![-\w])/g, BRAND_SHORT],
  [/\bWM Analyst\b/g, `${BRAND_SHORT} Analyst`],
  [/\bWM \/\/ /g, `${BRAND_SHORT} // `],
];

/** Replace upstream product names in a user-facing string. Non-strings pass through. */
export function rebrandText<T>(value: T): T {
  if (typeof value !== 'string' || value.length === 0) return value;
  if (!/World ?Monitor|WORLD MONITOR|\bWM\b/.test(value)) return value;
  let out: string = value;
  for (const [pattern, replacement] of REPLACEMENTS) out = out.replace(pattern, replacement);
  return out as unknown as T;
}

/** i18next post-processor: rewrites every resolved translation. */
export const brandPostProcessor = {
  type: 'postProcessor' as const,
  name: 'bdsiBrand',
  process(value: string): string {
    return rebrandText(value);
  },
};
