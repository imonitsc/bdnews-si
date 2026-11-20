// BDSI terminal: Bangladesh activity map drawn as SVG from the boundary files
// (no tiles, no map library). Districts or divisions are shaded by the activity
// score from src/services/bd-district-activity.ts; event markers are optional.

import { activityBand, type BdActivitySnapshot } from '@/services/bd-district-activity';
import type { FeatureCollection, GeoEvent } from './data';

const NS = 'http://www.w3.org/2000/svg';
const BAND_FILL = ['#0b0b0b', '#3a2a08', '#5c3d06', '#8a5200', '#b85a10', '#d2401e'];

export interface RiskMapLayers { shade: 'districts' | 'divisions'; protests: boolean; conflicts: boolean; fires: boolean }

type Ring = Array<[number, number]>;

function rings(geometry: FeatureCollection['features'][number]['geometry']): Ring[][] {
  return geometry.type === 'Polygon' ? [geometry.coordinates as Ring[]] : (geometry.coordinates as Ring[][]);
}

export function drawRiskMap(opts: {
  width: number;
  height: number;
  districts: FeatureCollection;
  divisions: FeatureCollection;
  snapshot: BdActivitySnapshot | null;
  layers: RiskMapLayers;
  events: { protests: GeoEvent[]; conflicts: GeoEvent[]; fires: GeoEvent[] };
  onSelect?: (kind: 'district' | 'division', id: string) => void;
}): SVGSVGElement {
  const { width, height } = opts;
  // Fit Bangladesh's extent with an equirectangular projection corrected at 24°N.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of opts.districts.features) for (const poly of rings(f.geometry)) for (const [x, y] of poly[0] ?? []) {
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const kx = Math.cos((24 * Math.PI) / 180);
  const pad = 8;
  const scale = Math.min((width - pad * 2) / ((maxX - minX) * kx), (height - pad * 2) / (maxY - minY));
  const offX = (width - (maxX - minX) * kx * scale) / 2;
  const offY = (height - (maxY - minY) * scale) / 2;
  const px = (lon: number) => offX + (lon - minX) * kx * scale;
  const py = (lat: number) => offY + (maxY - lat) * scale;
  const pathOf = (g: FeatureCollection['features'][number]['geometry']) => rings(g)
    .map((poly) => poly.map((ring) => ring.map(([x, y], i) => `${i ? 'L' : 'M'}${px(x).toFixed(1)},${py(y).toFixed(1)}`).join('') + 'Z').join(''))
    .join('');

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'tp-riskmap');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Map of Bangladesh shaded by reported activity per ' + (opts.layers.shade === 'divisions' ? 'division' : 'district'));

  const snap = opts.snapshot;
  const byDistrict = new Map((snap?.districts ?? []).map((d) => [d.id, d]));
  const byDivision = new Map((snap?.divisions ?? []).map((d) => [d.name.toLowerCase(), d]));
  const maxDistrict = Math.max(0, ...(snap?.districts ?? []).map((d) => d.score));
  const maxDivision = Math.max(0, ...(snap?.divisions ?? []).map((d) => d.score));

  const add = (parent: Element, tag: string, attrs: Record<string, string>) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    parent.append(el);
    return el;
  };
  const title = (el: Element, text: string) => { const t = document.createElementNS(NS, 'title'); t.textContent = text; el.append(t); };

  // Districts (always drawn; shaded when shade = districts).
  const gD = add(svg, 'g', { class: 'tp-rm-districts' });
  for (const f of opts.districts.features) {
    const id = f.properties.id!;
    const a = byDistrict.get(id);
    const band = opts.layers.shade === 'districts' && a ? activityBand(a.score, maxDistrict) : 0;
    const p = add(gD, 'path', {
      d: pathOf(f.geometry), fill: opts.layers.shade === 'districts' ? BAND_FILL[band]! : 'transparent',
      stroke: '#5a4100', 'stroke-width': '0.6', 'data-id': id, tabindex: '0', class: 'tp-rm-area',
    });
    title(p, a
      ? `${a.name} (${a.division}) · score ${Math.round(a.score * 10) / 10} · news ${a.news} · protests ${a.protests} · conflict ${a.conflicts} · fires ${a.fires}`
      : `${f.properties.name} (${f.properties.division})`);
    const pick = () => opts.onSelect?.('district', id);
    p.addEventListener('click', pick);
    p.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') pick(); });
  }

  // Divisions: shaded underneath-looking overlay when shade = divisions, outlines always.
  const gV = add(svg, 'g', { class: 'tp-rm-divisions' });
  for (const f of opts.divisions.features) {
    const id = f.properties.id!;
    const a = byDivision.get(id);
    const band = opts.layers.shade === 'divisions' && a ? activityBand(a.score, maxDivision) : 0;
    const p = add(gV, 'path', {
      d: pathOf(f.geometry),
      fill: opts.layers.shade === 'divisions' ? BAND_FILL[band]! : 'none',
      'fill-opacity': opts.layers.shade === 'divisions' ? '0.85' : '0',
      stroke: '#FFB000', 'stroke-width': '1.4',
      'pointer-events': opts.layers.shade === 'divisions' ? 'auto' : 'none',
      class: 'tp-rm-area',
    });
    if (opts.layers.shade === 'divisions') {
      title(p, a ? `${a.name} division · score ${Math.round(a.score)} · news ${a.news} · protests ${a.protests} · conflict ${a.conflicts} · fires ${a.fires}` : String(f.properties.name));
      p.addEventListener('click', () => opts.onSelect?.('division', id));
    }
  }

  // Event markers inside the frame only.
  const inFrame = (e: GeoEvent) => e.lon >= minX && e.lon <= maxX && e.lat >= minY && e.lat <= maxY;
  const dots = (list: GeoEvent[], cls: string, r: number, label: string) => {
    const g = add(svg, 'g', { class: cls, 'aria-hidden': 'true' });
    for (const e of list.filter(inFrame)) {
      const c = add(g, 'circle', { cx: px(e.lon).toFixed(1), cy: py(e.lat).toFixed(1), r: String(r) });
      title(c, label);
    }
  };
  if (opts.layers.fires) dots(opts.events.fires, 'tp-rm-fires', 2, 'Satellite fire detection (NASA FIRMS)');
  if (opts.layers.protests) dots(opts.events.protests.filter((p) => !(p.city && p.country && p.city.toLowerCase() === p.country.toLowerCase())), 'tp-rm-protests', 3.5, 'Protest / unrest report (GDELT, unverified)');
  if (opts.layers.conflicts) dots(opts.events.conflicts, 'tp-rm-conflicts', 4, 'Conflict event (UCDP)');

  return svg;
}
