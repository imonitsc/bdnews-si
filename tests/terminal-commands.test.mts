import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { COMMANDS, FKEY_COMMANDS, parseCommand, suggestCommands, helpLine, findCommand } from '../src/config/terminal-commands.ts';

describe('BDNEWS> command parser', () => {
  it('runs commands case-insensitively, with or without <GO>', () => {
    for (const input of ['dse', 'DSE <GO>', ' dse go ', 'DSEX<GO>', 'stocks']) {
      const r = parseCommand(input);
      assert.equal(r.kind, 'run', input);
      if (r.kind === 'run') assert.equal(r.command.mnemonic, 'DSE');
    }
  });

  it('passes arguments through', () => {
    const r = parseCommand('RISK Sylhet <GO>');
    assert.equal(r.kind, 'run');
    if (r.kind === 'run') assert.equal(r.args, 'Sylhet');
  });

  it('HELP lists everything; HELP <FUNC> explains one', () => {
    assert.deepEqual(parseCommand('HELP <GO>'), { kind: 'help', topic: null });
    const one = parseCommand('help fx');
    assert.equal(one.kind, 'help');
    if (one.kind === 'help') assert.equal(one.topic?.mnemonic, 'FX');
    const bad = parseCommand('HELP ZZZ');
    assert.ok(bad.kind === 'help' && bad.topic === null && bad.unknownTopic === 'ZZZ');
  });

  it('suggests close matches instead of a bare UNKNOWN COMMAND', () => {
    const r = parseCommand('BAZZAR');
    assert.equal(r.kind, 'unknown');
    if (r.kind === 'unknown') assert.ok(r.suggestions.includes('BAZAR'));
    assert.ok(suggestCommands('DS').includes('DSE'));
    assert.ok(suggestCommands('POWR').includes('POWER'));
    assert.deepEqual(suggestCommands('QQQQQQQQ'), []);
  });

  it('resolves a loaded DSE ticker that is not a command', () => {
    assert.deepEqual(parseCommand('GP <GO>', new Set(['GP', 'SQURPHARMA'])), { kind: 'ticker', code: 'GP' });
    assert.equal(parseCommand('GP <GO>').kind, 'unknown');
    // A command always wins over a ticker of the same name.
    assert.equal(parseCommand('BD', new Set(['BD'])).kind, 'run');
  });

  it('is empty on blank input', () => {
    assert.deepEqual(parseCommand('   '), { kind: 'empty' });
    assert.deepEqual(parseCommand('<GO>'), { kind: 'empty' });
  });
});

describe('command registry', () => {
  it('has unique mnemonics and aliases, every §6 command, and ten F-keys', () => {
    const names = COMMANDS.flatMap((c) => [c.mnemonic, ...(c.aliases ?? [])]);
    assert.equal(new Set(names).size, names.length, 'duplicate mnemonic or alias');
    for (const m of ['DSE', 'CSE', 'SCRN', 'WL', 'ALRT', 'BB', 'CPI', 'GDP', 'REMIT', 'EXP', 'IMP', 'RES', 'FX', 'YC', 'RMG', 'PORT', 'POWER', 'BAZAR', 'RISK', 'BORDER', 'SEA', 'WX', 'FLOOD', 'CYCLONE', 'NEWS', 'BRIEF', 'ASK', 'HELP']) {
      assert.ok(findCommand(m), `missing ${m}`);
    }
    assert.equal(FKEY_COMMANDS.length, 10);
  });

  it('marks planned commands honestly in help', () => {
    assert.match(helpLine(findCommand('POWER')!), /planned, phase 1 · BUSINESS/);
    assert.doesNotMatch(helpLine(findCommand('DSE')!), /planned/);
  });
});
