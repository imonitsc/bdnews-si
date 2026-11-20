import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { rscPayload, objectAround, valueAfterKey, parseHome, parseRecentMarket, buildDseSummary, parseCompany, parseTodayDisclosures } from '../api/_dse-pages.js';

/** Wrap JSON text the way Next.js does: split into escaped self.__next_f.push chunks. */
function rscHtml(text, chunks = 3) {
  const size = Math.ceil(text.length / chunks);
  const parts = [];
  for (let i = 0; i < text.length; i += size) parts.push(`<script>self.__next_f.push([1,${JSON.stringify(text.slice(i, i + size))}])</script>`);
  return `<html><body>${parts.join('')}</body></html>`;
}

const session = { isOpen: false, phase: 'closed', opening: '10:00', closing: '14:00', date: '2026-11-21', sessionDate: '2026-11-19', next: { date: '2026-11-22' } };
const homeJson = `1:["$","div",null,{"indexes":[{"code":"DSEX"}],"embedded":true,"initialPrices":{"cols":["code","ltp","ycp","open","high","low","close","volume","value","trades","percent","category","board","sector","assetType"],"rows":[["GP",226.7,226.8,226.8,227.5,226.3,226.7,100838,22.87,867,-0.044,"A","PUBLIC","Telecom","EQ"],["MATINSPINN",137.8,124.1,125,138,124,137.8,500,5.5,40,11.04,"A","PUBLIC","Textile","EQ"],["IDLE",10,10,0,0,0,10,0,0,0,0,"Z","PUBLIC","Misc","EQ"]],"session":${JSON.stringify(session)}}}]
2:{"key":"DSEX","points":[{"t":"10:00","value":5496.1},{"t":"14:00","value":5505.63875}],"session":${JSON.stringify(session)},"day":"2026-11-19","cursor":1}`;
const recentHtml = `<table><thead><tr><th>Metric</th></tr></thead><tbody><tr><td>Total Number of Trades</td><td>421,803</td><td>2021-08-09</td></tr></tbody></table>
<table><thead><tr><th>Date</th><th>Total Trades</th><th>Total Volume</th><th>Turnover (mn)</th><th>Market Capitalization in Taka (mn)</th><th>DSEX</th><th>DSES</th><th>DS30</th><th>DGEN</th></tr></thead><tbody>
<tr><td class="x">2026-11-18</td><td>213,304</td><td>241,580,720</td><td>8,199.03</td><td>3,391,836.09</td><td>6,742,117.73</td><td>5,500.84</td><td>1,074.90</td><td>2,088.49</td><td>-</td></tr>
<tr><td>2026-11-19</td><td>201,554</td><td>215,681,302</td><td>7,466.35</td><td>3,392,912.63</td><td>6,733,723.39</td><td>5,505.64</td><td>1,074.08</td><td>2,085.73</td><td>-</td></tr>
</tbody></table>`;

describe('DSE page parsing helpers', () => {
  it('joins and unescapes RSC chunks', () => {
    const html = rscHtml('{"a":"x\\"y","b":[1,2]}');
    assert.equal(rscPayload(html), '{"a":"x\\"y","b":[1,2]}');
  });
  it('finds the object around a key and the value after a key', () => {
    const t = 'junk {"outer":{"code":"GP","scripCode":27001,"s":"a}b"}} tail';
    assert.deepEqual(objectAround(t, t.indexOf('"scripCode"')), { code: 'GP', scripCode: 27001, s: 'a}b' });
    assert.deepEqual(valueAfterKey('x "list":[{"a":"]"},2] y', 'list'), [{ a: ']' }, 2]);
    assert.equal(valueAfterKey('{}', 'missing'), null);
  });
});

describe('DSE home + recent market information', () => {
  const home = parseHome(rscHtml(homeJson, 4));
  const recent = parseRecentMarket(recentHtml);

  it('reads every price row, the session and DSEX intraday', () => {
    assert.equal(home.rows.length, 3);
    assert.deepEqual({ code: home.rows[0].code, ltp: home.rows[0].ltp, sector: home.rows[0].sector, valueMn: home.rows[0].valueMn }, { code: 'GP', ltp: 226.7, sector: 'Telecom', valueMn: 22.87 });
    assert.equal(home.session.sessionDate, '2026-11-19');
    assert.equal(home.dsex.last, 5505.63875);
  });

  it('reads daily index closes despite the offset header, newest first', () => {
    assert.deepEqual(recent.map((r) => r.date), ['2026-11-19', '2026-11-18']);
    assert.deepEqual([recent[0].dsex, recent[0].dses, recent[0].ds30, recent[0].turnoverMn], [5505.64, 1074.08, 2085.73, 7466.35]);
  });

  it('builds the market summary: indices with change, totals, breadth, movers', () => {
    const s = buildDseSummary(home, recent);
    const dsex = s.indices.find((i) => i.key === 'DSEX');
    assert.equal(dsex.value, 5505.64);
    assert.ok(Math.abs(dsex.change - 4.8) < 1e-9);
    assert.equal(s.indices.find((i) => i.key === 'DS30').value, 2085.73);
    assert.deepEqual(s.breadth, { advanced: 1, declined: 1, unchanged: 0 });
    assert.equal(s.gainers[0].code, 'MATINSPINN');
    assert.equal(s.losers[0].code, 'GP');
    assert.equal(s.totals.trades, 907);
    assert.equal(s.session.sessionDate, '2026-11-19');
  });

  it('uses live DSEX when the daily table does not have today yet', () => {
    const live = parseHome(rscHtml(homeJson.replace('"day":"2026-11-19"', '"day":"2026-11-20"')));
    const s = buildDseSummary(live, recent);
    assert.equal(s.indices[0].value, 5505.63875);
  });

  it('fails loudly on a page without the price table', () => {
    assert.throws(() => parseHome('<html></html>'), /no price table/);
  });
});

describe('DSE company page and disclosures', () => {
  const company = { code: 'GP', name: 'Grameenphone Ltd.', sector: 'Telecom', price: 226.7, pe: 10.35, eps: 21.9, nav: 41.49, weekHigh52: 282, weekLow52: 221.9, scripCode: 27001,
    companySecretary: { name: 'Someone', email: 'x@y.z', phone: '1' }, phone: '+880', email: 'a@b.c',
    sharePattern: [{ asOn: '2026-10-31', sponsor: 90 }], dividendHistory: [{ year: 2025, cash: 250 }],
    multiYearFinancials: [{ year: 2025, epsBasic: 21.9, nav: 41.49, profit: 29000, pe: 10.3 }] };
  it('keeps business fields and drops personal contact details', () => {
    const c = parseCompany(rscHtml(`0:{"x":1}\n1:{"company":${JSON.stringify(company)}}`), 'gp');
    assert.equal(c.name, 'Grameenphone Ltd.');
    assert.equal(c.pe, 10.35);
    assert.deepEqual(c.multiYearFinancials, [{ year: 2025, eps: 21.9, nav: 41.49, profitMn: 29000, pe: 10.3 }]);
    assert.ok(!('companySecretary' in c) && !('phone' in c) && !('email' in c));
    assert.equal(parseCompany(rscHtml(`{"company":${JSON.stringify(company)}}`), 'BATBC'), null);
  });
  it('reads today\'s disclosures', () => {
    const d = parseTodayDisclosures(rscHtml(`{"labels":{},"disclosures":[{"id":"psi-1","code":"GP","name":"Grameenphone Ltd.","type":"Price sensitive","date":"19 Nov 2026","time":"14:31","summary":"GP: Board meeting","body":"..."}]}`));
    assert.equal(d.length, 1);
    assert.equal(d[0].summary, 'GP: Board meeting');
  });
});
