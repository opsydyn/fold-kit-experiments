import { expect, test } from 'bun:test';

import { verifyBoardMigration } from '../tools/staging-board-migration';
const manifest = [
  { name: 'existing.sql', hash: 'a' },
  { name: 'board.sql', hash: 'b' },
];
const entries = manifest.map((m, i) => ({
  ...m,
  id: i + 1,
  created_at: null,
  applied_at: '2026-11-24',
}));
const columns = [{ name: 'diagramId', type: 'TEXT', notnull: 1, dflt_value: null }];
const before = { history: entries.slice(0, 1), columns };
const complete = {
  history: entries,
  columns: [...columns, { name: 'nameRevision', type: 'INTEGER', notnull: 1, dflt_value: '0' }],
};
test('board release verifies a pending migration, a successful apply and an already-applied retry', () => {
  expect(verifyBoardMigration(manifest, before)).toBe(false);
  expect(verifyBoardMigration(manifest, complete, before)).toBe(true);
  expect(verifyBoardMigration(manifest, complete, complete)).toBe(true);
});
test('board release refuses divergent history, partial schema and rewritten historical rows', () => {
  for (const altered of [
    { ...complete, history: entries.toReversed() },
    { ...complete, history: [...entries, entries[1]!] },
    { ...complete, history: [{ ...entries[0]!, hash: 'drift' }, entries[1]!] },
    { ...complete, history: [{ ...entries[0]!, applied_at: 'changed' }, entries[1]!] },
    { ...complete, columns },
    { ...before, columns: complete.columns },
    { ...complete, columns: [...columns, { ...complete.columns[1]!, dflt_value: null }] },
    before,
  ])
    expect(() => verifyBoardMigration(manifest, altered, before)).toThrow();
});
