import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { buildResponse, findLatestTcbFile, parseBbRates, parseTcbRows, shapeDse, shapeOpenErRates } from '../api/bd-markets.js';
import { readFirstSheetRows } from '../api/_xlsx-lite.js';

// Minimal ZIP writer for test fixtures (deflate entries, central directory, EOCD).
function zip(files) {
  const enc = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const raw = enc.encode(text);
    const data = deflateRawSync(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(Object.keys(files).length, 8); eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  const buf = Buffer.concat([...locals, cd, eocd]);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

const SHARED = ['ভোজ্য তেল', 'সয়াবিন তেল (লুজ)', 'প্রতি লিটার', 'চাল (মোটা)/স্বর্ণা/চায়না ইরি', 'প্রতি কেজি', 'যে সকল বাজার হতে তথ্য সংগ্রহ করা হয়েছেঃ-', 'ইলিশ'];
const sst = `<?xml version="1.0"?><sst>${SHARED.map((s) => `<si><t>${s}</t></si>`).join('')}</sst>`;
const cell = (ref, v) => (typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="s"><v>${v.s}</v></c>`);
const row = (n, vals) => `<row r="${n}">${vals.map((v, i) => (v == null ? '' : cell(`${String.fromCharCode(65 + i)}${n}`, v))).join('')}</row>`;
const sheet = `<?xml version="1.0"?><worksheet><sheetData>${[
  row(1, [{ s: 0 }]),
  row(2, [{ s: 1 }, { s: 2 }, 190, 196, 189, 200, 189, 200, -0.77, 170, 180, 10.29]),
  row(3, [{ s: 3 }, { s: 4 }, 50, 55, 50, 58, 50, 55, 0, 54, 60, -7.89]),
  row(4, [{ s: 6 }, { s: 4 }, 900, 2200, 900, 2200, 1000, 2400, -5, 0, 0, null]),
  row(5, [{ s: 5 }]),
  row(6, [{ s: 1 }, { s: 2 }, 1, 2, 1, 2, 1, 2, 0, 1, 2, 0]),
].join('')}</sheetData></worksheet>`;

describe('BD markets endpoint parsers', () => {
  it('reads the first worksheet of an xlsx with shared strings', async () => {
    const rows = await readFirstSheetRows(zip({ 'xl/sharedStrings.xml': sst, 'xl/worksheets/sheet1.xml': sheet }));
    assert.equal(rows[1][0], 'সয়াবিন তেল (লুজ)');
    assert.equal(rows[1][2], '190');
    assert.equal(rows.length, 6);
  });

  it('turns TCB rows into items with categories, changes and key items, and stops at the footer tables', async () => {
    const rows = await readFirstSheetRows(zip({ 'xl/sharedStrings.xml': sst, 'xl/worksheets/sheet1.xml': sheet }));
    const { key, all } = parseTcbRows(rows);
    assert.equal(all.length, 3, 'footer repeat table must be ignored');
    const oil = all[0];
    assert.equal(oil.category, 'ভোজ্য তেল');
    assert.equal(oil.low, 190);
    assert.equal(oil.high, 196);
    assert.ok(Math.abs(oil.weekChangePct - ((193 - 194.5) / 194.5) * 100) < 1e-9);
    assert.equal(oil.yearChangePct, 10.29);
    assert.equal(all[2].yearChangePct, null, 'no year-ago price means no yearly change');
    assert.deepEqual(key.map((k) => k.id), ['rice-coarse', 'soybean-loose', 'hilsa']);
  });

  it('finds the newest TCB file link and its date in Bangla digits', () => {
    const html = '<tr><td>১</td><td><a href="https://objectstorage.ap-dcc-gazipur-1.oraclecloud15.com/n/x/b/V2Ministry/o/office-tcb/2026/10/a.xlsx">f</a></td><td>১৯-১১-২০২৬</td></tr>'
      + '<tr><td><a href="https://objectstorage.ap-dcc-gazipur-1.oraclecloud15.com/n/x/b/V2Ministry/o/office-tcb/2026/10/b.xlsx">f</a></td><td>১৮-১১-২০২৬</td></tr>';
    const f = findLatestTcbFile(html);
    assert.match(f.url, /\/a\.xlsx$/);
    assert.equal(f.date, '2026-11-19');
  });

  it('parses Bangladesh Bank rate tables and the effective date', () => {
    const html = `<div>FX Rate Sheet effective for 19/11/2026</div>
      <table><tr><th colspan="4">A. USD/BDT Exchange Rate</th></tr><tr><td>Currency</td><td>Bid Rate</td><td>Ask Rate</td><td>WAR</td></tr>
      <tr><td>USD</td><td>124.7500</td><td>124.7500</td><td>124.7500</td></tr></table>
      <table><tr><td>Currency</td><td>Bid Rate</td><td>Ask Rate</td></tr>
      <tr><td>EUR</td><td>136.8882</td><td>136.9256</td></tr><tr><td>INR</td><td>1.3345</td><td>1.3349</td></tr></table>`;
    const { rates, asOf } = parseBbRates(html);
    assert.equal(asOf, '2026-11-19');
    assert.deepEqual(rates.map((r) => r.code), ['USD', 'EUR', 'INR']);
    assert.equal(rates[0].mid, 124.75);
    assert.ok(Math.abs(rates[1].mid - 136.9069) < 1e-9);
  });

  it('shapes the DSE live snapshot', () => {
    const out = shapeDse({
      market: {
        indices: [{ key: 'DSEX', value: 5505.63875, change: 4.80254, percent: 0.08731, prev: 5500.8 }],
        totals: { trades: 201554, volume: 215681302, turnover: 7466.351, marketCap: 1, tradeTime: 'Nov 19, 2026 at 2:40 PM' },
        breadth: { advanced: 126, declined: 171, unchanged: 54 },
        session: { isOpen: false, phase: 'closed', opening: '10:00', closing: '14:00', date: '2026-11-21' },
        movers: { gainers: [{ code: 'MATINSPINN', ltp: 137.8, percent: 11.04, open: 1 }], losers: [] },
      },
    });
    assert.equal(out.indices[0].key, 'DSEX');
    assert.equal(out.totals.turnoverMn, 7466.351);
    assert.equal(out.session.isOpen, false);
    assert.deepEqual(out.gainers[0], { code: 'MATINSPINN', ltp: 137.8, percent: 11.04 });
    assert.throws(() => shapeDse({}), /unexpected shape/);
  });

  it('converts fallback USD-based rates into Taka per unit and marks them unofficial', () => {
    const out = shapeOpenErRates({ result: 'success', time_last_update_unix: 1795132800, rates: { USD: 1, BDT: 122, EUR: 0.9, INR: 90 } });
    assert.equal(out.official, false);
    assert.equal(out.rates.find((r) => r.code === 'USD').mid, 122);
    assert.ok(Math.abs(out.rates.find((r) => r.code === 'EUR').mid - 135.5556) < 1e-3);
    assert.throws(() => shapeOpenErRates({ result: 'error' }), /unexpected shape/);
  });

  it('answers 502 with per-part errors when every source fails', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new TypeError('fetch failed', { cause: new Error('ECONNRESET') }); };
    try {
      const { status, body, cacheControl } = await buildResponse('/api/bd-markets?part=dse');
      assert.equal(status, 502);
      assert.match(body.dse.error, /ECONNRESET/);
      assert.match(cacheControl, /s-maxage=60/);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
