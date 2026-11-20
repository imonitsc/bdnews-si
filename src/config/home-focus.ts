// BDSI: put Bangladesh first in ranked "focal point" style lists (CLAUDE.md §4 item 4).
// Upstream ranks countries globally, so AI Insights led with whichever country had the
// strongest worldwide signal (the UAE on 2026-11-20). These helpers keep that ranking,
// but lift the home country and then its neighbours to the top.

import { DEFAULT_FOCUS } from './brand';

/** Home country first, then the neighbours that matter most to it. */
export const HOME_FOCUS_ORDER: readonly string[] = [DEFAULT_FOCUS.countryCode, 'MM', 'IN', 'NP', 'BT', 'LK', 'PK'];

export interface FocalLike {
  entityId: string;
  entityType: string;
  newsMentions: number;
  signalCount: number;
  signalTypes: string[];
}

function homeRank(fp: FocalLike): number {
  if (fp.entityType !== 'country') return HOME_FOCUS_ORDER.length;
  const i = HOME_FOCUS_ORDER.indexOf(fp.entityId.toUpperCase());
  return i === -1 ? HOME_FOCUS_ORDER.length : i;
}

/**
 * Pick the focal points AI Insights shows. Upstream keeps only points with both
 * news and a signal (or an active strike). We keep that rule, also keep the home
 * country whenever it is in the news at all, and order home and neighbours first.
 * Ties keep the upstream (score) order, so the sort is stable.
 */
export function selectHomeFocalPoints<T extends FocalLike>(points: readonly T[], limit = 5): T[] {
  const home = DEFAULT_FOCUS.countryCode;
  const kept = points.filter((fp) =>
    (fp.newsMentions > 0 && fp.signalCount > 0)
    || fp.signalTypes.includes('active_strike')
    || (fp.entityType === 'country' && fp.entityId.toUpperCase() === home && fp.newsMentions > 0));
  return kept
    .map((fp, i) => ({ fp, i, r: homeRank(fp) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.fp);
}
