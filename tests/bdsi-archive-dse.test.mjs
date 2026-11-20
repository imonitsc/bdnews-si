import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { appendClose, mergeIndexDays } from '../scripts/bdsi-archive-dse.mjs';

describe('DSE close archive', () => {
  it('appends a new session once and caps the series', () => {
    const a = appendClose([], '2026-11-18', 226.8, 100);
    assert.deepEqual(a, [['2026-11-18', 226.8, 100]]);
    const b = appendClose(a, '2026-11-19', 226.7, 200);
    assert.equal(b.length, 2);
    assert.equal(appendClose(b, '2026-11-19', 1, 1), null); // already archived
    assert.equal(appendClose(b, '2026-11-17', 1, 1), null); // older session
    const many = Array.from({ length: 5 }, (_, i) => [`2026-01-0${i + 1}`, i, 0]);
    assert.equal(appendClose(many, '2026-02-01', 9, 0, 5).length, 5);
  });
  it('merges index days by date, oldest first', () => {
    const m = mergeIndexDays([{ date: '2026-11-17', dsex: 1 }, { date: '2026-11-18', dsex: 2 }], [{ date: '2026-11-18', dsex: 3 }, { date: '2026-11-19', dsex: 4 }]);
    assert.deepEqual(m.map((r) => [r.date, r.dsex]), [['2026-11-17', 1], ['2026-11-18', 3], ['2026-11-19', 4]]);
  });
});
