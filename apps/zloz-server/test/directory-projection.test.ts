import { Database } from 'bun:sqlite';
import { afterAll, beforeAll, expect, test } from 'bun:test';

import { splitSqliteStatements } from '@alchemy.run/sql/SqlFile';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';

import { directoryRecencyProjectionSql } from '../src/diagram-routes';

const runtime = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("projection fixture"); } }',
    compatibilityDate: '2026-11-11',
    d1Databases: ['DB'],
    cf: false,
  }),
);
const database = runtime.getD1Database('DB');
beforeAll(async () => {
  const db = await database;
  for (const filename of [
    '0001_auth.sql',
    '0002_membership_invariants.sql',
    '0003_unique_membership.sql',
    '0004_team_onboarding.sql',
  ]) {
    const sql = await Bun.file(new URL(`../migrations/${filename}`, import.meta.url)).text();
    for (const statement of splitSqliteStatements(sql)) await db.prepare(statement).run();
  }
  for (const id of ['team', 'other'])
    await db
      .prepare('INSERT INTO organization (id, name, slug, createdAt) VALUES (?, ?, ?, ?)')
      .bind(id, id, id, 0)
      .run();
  for (const [team, diagram] of [
    ['team', 'diagram'],
    ['team', 'second'],
    ['other', 'diagram'],
  ])
    await db
      .prepare(
        'INSERT INTO diagramDirectory (organizationId, diagramId, name, updatedAt) VALUES (?, ?, ?, ?)',
      )
      .bind(team, diagram, `${team}/${diagram}`, 10_000)
      .run();
  const migration = await Bun.file(
    new URL('../migrations/0006_board_name_revision.sql', import.meta.url),
  ).text();
  await db.prepare(migration).run();
});
afterAll(async () => {
  await runtime.dispose();
});

test('the board-name migration preserves existing directory rows and starts each at revision zero', async () => {
  const db = await database;
  expect(
    (
      await db
        .prepare(
          'SELECT organizationId, diagramId, name, nameRevision FROM diagramDirectory ORDER BY organizationId, diagramId',
        )
        .all()
    ).results,
  ).toEqual([
    { organizationId: 'other', diagramId: 'diagram', name: 'other/diagram', nameRevision: 0 },
    { organizationId: 'team', diagramId: 'diagram', name: 'team/diagram', nameRevision: 0 },
    { organizationId: 'team', diagramId: 'second', name: 'team/second', nameRevision: 0 },
  ]);
});

test('real D1 recency writes have a one-second boundary, remain monotonic and target one row', async () => {
  const db = await database;
  const update = (now: number, team = 'team', diagram = 'diagram') =>
    db.prepare(directoryRecencyProjectionSql).bind(now, team, diagram).run();
  const timestamp = (team = 'team', diagram = 'diagram') =>
    db
      .prepare('SELECT updatedAt FROM diagramDirectory WHERE organizationId = ? AND diagramId = ?')
      .bind(team, diagram)
      .first<number>('updatedAt');
  for (const now of [10_000, 10_001, 10_999]) {
    const result = await update(now);
    expect(result.meta.changes).toBe(0);
    expect(result.meta.rows_written).toBe(0);
    expect(await timestamp()).toBe(10_000);
  }
  expect((await update(11_000)).meta.changes).toBe(1);
  expect(await timestamp()).toBe(11_000);
  for (const now of [11_001, 11_999, 10_500, 9_000]) {
    expect((await update(now)).meta.changes).toBe(0);
    expect(await timestamp()).toBe(11_000);
  }
  expect((await update(12_000)).meta.changes).toBe(1);
  expect(await timestamp()).toBe(12_000);
  expect(await timestamp('other')).toBe(10_000);
  expect(await timestamp('team', 'second')).toBe(10_000);
  expect((await update(13_000, 'other')).meta.changes).toBe(1);
  expect(await timestamp('other')).toBe(13_000);
  expect(await timestamp()).toBe(12_000);
  expect((await update(20_000, 'missing')).meta.changes).toBe(0);
  expect((await update(20_000, 'team', 'missing')).meta.changes).toBe(0);
  expect(await timestamp('team', 'missing')).toBeNull();
});

test('1200 timestamp projections at ten per second perform 120 writes without changing directory identity', () => {
  const db = new Database(':memory:');
  // This fixture isolates the projection columns; the preceding native test runs all real migrations.
  db.exec(
    'CREATE TABLE diagramDirectory (organizationId TEXT, diagramId TEXT, name TEXT, updatedAt INTEGER, PRIMARY KEY (organizationId, diagramId))',
  );
  db.prepare('INSERT INTO diagramDirectory VALUES (?, ?, ?, ?)').run('team', 'diagram', 'Name', 0);
  const statement = db.prepare(directoryRecencyProjectionSql);
  let writes = 0;
  for (let index = 1; index <= 1200; index++)
    writes += statement.run(index * 100, 'team', 'diagram').changes;
  const row = db
    .query<{ organizationId: string; diagramId: string; name: string; updatedAt: number }, []>(
      'SELECT organizationId, diagramId, name, updatedAt FROM diagramDirectory',
    )
    .get();
  db.close();
  expect(writes).toBe(120);
  expect(row).toEqual({
    organizationId: 'team',
    diagramId: 'diagram',
    name: 'Name',
    updatedAt: 120_000,
  });
});
