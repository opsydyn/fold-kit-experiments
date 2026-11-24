import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';

import type { StackPlan } from 'alchemy/Alchemist';
import { Schema } from 'effect';

import { QuickStagingPlanRejected } from './staging-quick-plan';

const directory = '../zloz-server/migrations';
export const boardMigration = '0006_board_name_revision.sql';
const approvedHash = 'feb240163608e02eae140a2736fa3f1c00b8978911d216289c48b9438f900882';
const stop = (message: string): never => {
  throw new QuickStagingPlanRejected({ message });
};
export const migrationManifest = async () => {
  const files = (await readdir(directory, { recursive: true }))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  const manifest = await Promise.all(
    files.map(async (name) => ({
      name,
      hash: createHash('sha256')
        .update(await readFile(directory + '/' + name))
        .digest('hex'),
    })),
  );
  if (
    manifest.length !== 6 ||
    manifest.at(-1)?.name !== boardMigration ||
    manifest.at(-1)?.hash !== approvedHash
  )
    stop('The migration files do not match the reviewed board-name release.');
  return manifest;
};
type Migration = { name: string; hash: string };
const HistoryRow = Schema.Struct({
  id: Schema.Int,
  name: Schema.String,
  hash: Schema.String,
  created_at: Schema.NullOr(Schema.Number),
  applied_at: Schema.NullOr(Schema.String),
});
type History = readonly (typeof HistoryRow.Type)[];
const Column = Schema.Struct({
  name: Schema.String,
  type: Schema.String,
  notnull: Schema.Int,
  dflt_value: Schema.NullOr(Schema.String),
});
type Snapshot = { history: History; columns: readonly (typeof Column.Type)[] };
export function verifyBoardMigration(
  manifest: readonly Migration[],
  snapshot: Snapshot,
  before?: Snapshot,
) {
  const { history, columns } = snapshot;
  const complete = history.length === manifest.length;
  const expected = complete ? manifest : manifest.slice(0, -1);
  if (
    !isDeepStrictEqual(
      history.map(({ name, hash }) => ({ name, hash })),
      expected,
    )
  )
    stop('D1 migration history differs from the release files.');
  const column = columns.find((c) => c.name === 'nameRevision');
  if (
    !columns.some((c) => c.name === 'diagramId') ||
    (complete
      ? !(column?.type === 'INTEGER' && column.notnull === 1 && column.dflt_value === '0')
      : column !== undefined)
  )
    stop('Board directory schema disagrees with D1 migration history.');
  if (
    before &&
    (!complete || !isDeepStrictEqual(history.slice(0, before.history.length), before.history))
  )
    stop('The migration did not preserve and complete the original D1 history.');
  return complete;
}

export function stagingDatabase(plan: StackPlan, account: string, manifest: readonly Migration[]) {
  const row = Object.values(plan.native.resources).find((r) => r.resource.FQN === 'ZlozTeamAuth');
  if (
    !row ||
    (row.action !== 'noop' && row.action !== 'update') ||
    (row.state.status !== 'created' && row.state.status !== 'updated')
  )
    throw new QuickStagingPlanRejected({ message: 'Expected the existing Teams auth database.' });
  const { databaseId, accountId } = row.state.attr;
  if (
    row.resource.Type !== 'Cloudflare.D1Database' ||
    row.renamedFrom?.length ||
    !account ||
    accountId !== account ||
    !Schema.is(Schema.String.check(Schema.isUUID()))(databaseId) ||
    !isDeepStrictEqual(row.state.props, { migrations: directory }) ||
    (row.action === 'update' && !isDeepStrictEqual(row.props, row.state.props))
  )
    stop('Unexpected staging database identity or settings.');
  if (row.action === 'update') {
    const prior = Object.fromEntries(manifest.slice(0, -1).map((m) => [m.name, m.hash]));
    if (
      !isDeepStrictEqual(row.state.attr.migrationsHashes, prior) ||
      (row.state.attr.readReplication?.mode ?? 'disabled') !== 'disabled'
    )
      stop(
        'The D1 update must advance exactly the reviewed migration from the recorded predecessor.',
      );
  }
  return { databaseId: String(databaseId), pending: row.action === 'update' };
}

export async function inspectBoardDatabase(account: string, databaseId: string) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) stop('Missing staging Cloudflare credentials.');
  const query = async (sql: string) => {
    const response = await fetch(
      'https://api.cloudflare.com/client/v4/accounts/' +
        encodeURIComponent(account) +
        '/d1/database/' +
        encodeURIComponent(databaseId) +
        '/query',
      {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
        body: JSON.stringify({ sql }),
      },
    );
    if (!response.ok) stop('Could not read staging D1 metadata (HTTP ' + response.status + ').');
    const envelope = Schema.decodeUnknownSync(
      Schema.Struct({
        success: Schema.Literal(true),
        result: Schema.Tuple([
          Schema.Struct({ success: Schema.Literal(true), results: Schema.Array(Schema.Unknown) }),
        ]),
      }),
    )(await response.json());
    return envelope.result[0].results;
  };
  return {
    history: Schema.decodeUnknownSync(Schema.Array(HistoryRow))(
      await query(
        'SELECT id,name,hash,created_at,applied_at FROM __alchemy_migrations ORDER BY id',
      ),
    ),
    columns: Schema.decodeUnknownSync(Schema.Array(Column))(
      await query('PRAGMA table_info(diagramDirectory)'),
    ),
  };
}
