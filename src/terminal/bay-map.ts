// BDSI terminal: Bay of Bengal SVG map (districts + markers + distance rings).
import type { FeatureCollection } from './data';

export interface MapBox { minLon: number; maxLon: number; minLat: number; maxLat: number }
export interface Marker { lat: number; lon: number; shape: 'square' | 'circle' | 'diamond' | 'dot'; color: string; size?: number; title: string; label?: string }
export interface Ring { lat: number; lon: number; radiiKm: number[]; color: string; title: string }

export const BAY_BOX: MapBox = { minLon: 82, maxLon: 95, minLat: 14, maxLat: 27 };

export function inBox(p: { lat: number; lon: number }, box: MapBox = BAY_BOX): boolean {
  return p.lon >= box.minLon && p.lon <= box.maxLon && p.lat >= box.minLat && p.lat <= box.maxLat;
}

export function bayMap(opts: { districts: FeatureCollection; box?: MapBox; markers: Marker[]; rings?: Ring[]; ariaLabel: string; width?: number }): SVGSVGElement {
  const box = opts.box ?? BAY_BOX;
  const W = opts.width ?? 560;
  const midLat = (box.minLat + box.maxLat) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const s = W / ((box.maxLon - box.minLon) * kx);
  const px = (lon: number) => (lon - box.minLon) * kx * s;
  const py = (lat: number) => (box.maxLat - lat) * s;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${Math.round((box.maxLat - box.minLat) * s)}`);
  svg.setAttribute('class', 'tp-riskmap');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', opts.ariaLabel);
  const add = (tag: string, attrs: Record<string, string>, title?: string, text?: string) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    if (title) { const t = document.createElementNS(NS, 'title'); t.textContent = title; e.append(t); }
    svg.append(e);
    return e;
  };
  add('rect', { x: '0', y: '0', width: '100%', height: '100%', fill: '#03070d' });
  for (const f of opts.districts.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates as number[][][]] : (f.geometry.coordinates as number[][][][]);
    const d = polys.map((poly) => poly.map((ring) => ring.map(([x, y], i) => `${i ? 'L' : 'M'}${px(x!).toFixed(1)},${py(y!).toFixed(1)}`).join('') + 'Z').join('')).join('');
    add('path', { d, fill: '#111', stroke: '#5a4100', 'stroke-width': '0.5' }, `${f.properties.name} (${f.properties.division})`);
  }
  for (const r of opts.rings ?? []) {
    if (!inBox(r, box)) continue;
    for (const km of r.radiiKm) add('circle', { cx: px(r.lon).toFixed(1), cy: py(r.lat).toFixed(1), r: String((km / 111) * s), fill: 'none', stroke: r.color, 'stroke-dasharray': '4 3', 'stroke-width': '1' }, `${km} km · ${r.title}`);
  }
  for (const m of opts.markers) {
    if (!inBox(m, box)) continue;
    const x = px(m.lon), y = py(m.lat), z = m.size ?? 4;
    if (m.shape === 'square') add('rect', { x: (x - z).toFixed(1), y: (y - z).toFixed(1), width: String(2 * z), height: String(2 * z), fill: m.color, stroke: '#000' }, m.title);
    else if (m.shape === 'diamond') add('path', { d: `M${x},${y - z - 1}L${x + z + 1},${y}L${x},${y + z + 1}L${x - z - 1},${y}Z`, fill: m.color, stroke: '#000' }, m.title);
    else add('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: String(m.shape === 'dot' ? Math.max(1.5, z / 2) : z), fill: m.color, stroke: m.shape === 'dot' ? 'none' : '#000', opacity: m.shape === 'dot' ? '0.85' : '1' }, m.title);
    if (m.label) add('text', { x: (x + z + 3).toFixed(1), y: (y + 4).toFixed(1), fill: m.color, 'font-size': '11' }, undefined, m.label);
  }
  return svg;
}
