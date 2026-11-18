import { openSync, closeSync } from 'node:fs';
import { readFile, writeFile, copyFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Data, Schema } from 'effect';

import { stopLocalStack } from './stop-local-stack';
class PackedQualificationFailed extends Data.TaggedError('PackedQualificationFailed')<{
  readonly message: string;
}> {}

async function qualifyPacked() {
  const artifacts = Schema.decodeUnknownSync(
    Schema.fromJsonString(
      Schema.Struct({ directory: Schema.String, core: Schema.String, adapter: Schema.String }),
    ),
  )(await readFile(join(tmpdir(), 'zloz-m4-packed-consumer.json'), 'utf8'));
  const directory = await mkdtemp(join(tmpdir(), 'zloz-m4-packed-native-'));
  await writeFile(`${directory}/package.json`, JSON.stringify({ private: true, type: 'module' }));
  const run = async (args: readonly string[]) => {
    const child = Bun.spawn([...args], { cwd: directory, stdout: 'inherit', stderr: 'inherit' });
    if ((await child.exited) !== 0)
      throw new PackedQualificationFailed({ message: 'Packed native setup failed' });
  };
  await run([
    'npm',
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    artifacts.core,
    artifacts.adapter,
    '@alchemy.run/cloudflare@2.0.0-beta.85',
    'alchemy@2.0.0-beta.85',
    'effect@4.1.0',
    'foldkit@0.170.0',
    '@effect/platform-browser@4.1.0',
    '@effect/sql-d1@4.1.0',
    '@effect/platform-bun@4.1.0',
    '@effect/platform-node@4.1.0',
  ]);
  const installedEffect = Schema.decodeUnknownSync(
    Schema.fromJsonString(Schema.Struct({ version: Schema.Literal('4.1.0') })),
  )(await readFile(`${directory}/node_modules/effect/package.json`, 'utf8'));
  console.log(`Native consumer Effect ${installedEffect.version}`);
  await copyFile(
    fileURLToPath(new URL('../test/packed-worker.ts', import.meta.url)),
    `${directory}/worker.ts`,
  );
  await writeFile(
    `${directory}/alchemy.run.ts`,
    `import * as Cloudflare from '@alchemy.run/cloudflare';
import * as Alchemy from 'alchemy';
import Worker from './worker';
if (process.env.ALCHEMY_DEV !== 'true') throw new PackedQualificationFailed({ message: 'Local packed qualification only' });
export default Alchemy.Stack('zloz-packed-consumer', { providers: Cloudflare.providers(), state: Alchemy.localState() }, Worker);
`,
  );
  const reservation = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response() });
  const port = reservation.port;
  reservation.stop(true);
  if (!port) throw new PackedQualificationFailed({ message: 'No fixture port' });
  const key = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
  const log = `${directory}/native-workerd-${crypto.randomUUID()}.log`;
  const stage = `packed-${crypto.randomUUID()}`;
  const start = () => {
    const fd = openSync(log, 'a', 0o600);
    const child = Bun.spawn(
      [process.execPath, `${directory}/node_modules/alchemy/bin/cli.js`, 'dev', '--stage', stage],
      {
        cwd: directory,
        detached: true,
        stdin: 'ignore',
        stdout: fd,
        stderr: fd,
        env: {
          ...process.env,
          ALCHEMY_WORKERD_PATH: fileURLToPath(import.meta.resolve('workerd/bin/workerd')),
          ZLOZ_PACKED_PORT: String(port),
          ZLOZ_PACKED_KEY: key,
        },
      },
    );
    closeSync(fd);
    return child;
  };
  let child = start();
  const read = (method = 'GET') =>
    fetch(`http://localhost:${port}`, {
      method,
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
  const ready = async () => {
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if ((await readFile(log, 'utf8')).includes('run failed;'))
        throw new PackedQualificationFailed({
          message: `Packed stack import failed; inspect ${log}`,
        });
      if (child.exitCode !== null)
        throw new PackedQualificationFailed({ message: `Packed stack exited; inspect ${log}` });
      try {
        const response = await read();
        if (response.ok) return;
      } catch {
        /* Local workerd startup is asynchronous. */
      }
      await Bun.sleep(200);
    }
    throw new PackedQualificationFailed({ message: `Packed stack timeout; inspect ${log}` });
  };
  const stop = async () => {
    await stopLocalStack(child, 'SIGKILL');
  };
  try {
    await ready();
    const unauthorized = await fetch(`http://localhost:${port}`);
    if (unauthorized.status !== 403)
      throw new PackedQualificationFailed({ message: 'Packed fixture token guard failed' });
    const expected = { assessmentRevision: 1, version: 2, label: 'Packed original' };
    const response = await read('POST');
    const reply = await response.text();
    if (!response.ok || JSON.stringify(JSON.parse(reply)) !== JSON.stringify(expected)) {
      console.error(`Packed native response ${response.status}: ${reply}`);
      throw new PackedQualificationFailed({ message: 'Packed native recovery failed' });
    }
    await stop();
    child = start();
    await ready();
    if (JSON.stringify(await (await read()).json()) !== JSON.stringify(expected))
      throw new PackedQualificationFailed({
        message: 'Packed recovery did not survive workerd restart',
      });
    await writeFile(
      join(tmpdir(), 'zloz-m4-packed-native.json'),
      JSON.stringify(
        {
          ...artifacts,
          nativeDirectory: directory,
          result: 'passed',
          runtime: 'native workerd 1.20261110.1',
          cohort: 'Alchemy beta.85, Effect 4.1.0',
          testIdentity: 'synthetic token-guarded fixture',
          retainedAfterRestart: expected,
          log,
        },
        null,
        2,
      ),
    );
    console.log('Packed adapter native recovery and abrupt restart passed.');
  } finally {
    await stop();
  }
}
await qualifyPacked();
