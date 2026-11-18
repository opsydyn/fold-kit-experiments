import { expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import coreManifest from '../../foldkit-zloz/package.json';
import manifest from '../package.json';
import assessmentFixture from './fixtures/assessment-v1.json';

const exec = promisify(execFile);
const here = fileURLToPath(new URL('..', import.meta.url));
const coreWorkspace = fileURLToPath(new URL('../../foldkit-zloz', import.meta.url));
test('packed adapter has portable declarations and executes recovery on Node and Bun without workspace links', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'zloz-m4-packed-'));
  const options = { maxBuffer: 5 * 1024 * 1024 };
  for (const cwd of [coreWorkspace, here])
    await exec('bun', ['pm', 'pack', '--destination', directory], {
      ...options,
      cwd,
    });
  const core = path.join(directory, `opsydyn-foldkit-zloz-${coreManifest.version}.tgz`);
  const adapter = path.join(directory, `opsydyn-foldkit-zloz-alchemy-${manifest.version}.tgz`);
  await writeFile(
    path.join(directory, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  );
  await exec(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      core,
      adapter,
      'effect@4.1.0',
      'foldkit@0.170.0',
      '@effect/platform-browser@4.1.0',
      '@alchemy.run/domain@2.0.0-beta.85',
      'alchemy@2.0.0-beta.85',
    ],
    {
      ...options,
      cwd: directory,
    },
  );
  expect(
    (
      await lstat(path.join(directory, 'node_modules/@opsydyn/foldkit-zloz-alchemy'))
    ).isSymbolicLink(),
  ).toBe(false);
  const packed = JSON.parse(
    await readFile(
      path.join(directory, 'node_modules/@opsydyn/foldkit-zloz-alchemy/package.json'),
      'utf8',
    ),
  );
  expect(JSON.stringify(packed)).not.toContain('catalog:');
  expect(JSON.stringify(packed)).not.toContain('workspace:');
  expect(packed.exports['.'].import).toBe('./dist/index.mjs');
  const source = `import { makeDiagramDomain, type DiagramHost, type DiagramRuntime } from '@opsydyn/foldkit-zloz-alchemy/collaboration';
import { createDiagramCheckpoint, parseDiagramCheckpoint } from '@opsydyn/foldkit-zloz-alchemy/checkpoint';
import { newSession, isDiagramFrame } from '@opsydyn/foldkit-zloz-alchemy/session';
import { applyDiagramDelta } from '@opsydyn/foldkit-zloz-alchemy/delta';
import { operationHash } from '@opsydyn/foldkit-zloz-alchemy/hash';
import { parseAssessmentRequest } from '@opsydyn/foldkit-zloz-alchemy/assessment';
import { createOperationDocument, recoverOperationDocument, decideOperation, type ZlozOperationRequest } from '@opsydyn/foldkit-zloz';
import * as Domain from '@alchemy.run/domain';
import { Effect, Layer } from 'effect';
const host: DiagramHost = { authorize: () => Effect.void, authorizeRecovery: () => Effect.void };
const domain = makeDiagramDomain(host);
const actor = { userId: 'owner', sessionId: 'session' };
const target = { teamId: 'team', diagramId: 'diagram' };
const graph = { nodes: [{ id: 'n', label: 'Original', position: { x: 0, y: 0 }, size: { width: 100, height: 80 }, ports: [{ id: 'out', kind: 'output' as const, side: 'right' as const, offset: 0.5 }] }, { id: 'm', label: 'Peer', position: { x: 200, y: 0 }, size: { width: 100, height: 80 }, ports: [{ id: 'in', kind: 'input' as const, side: 'left' as const, offset: 0.5 }] }], edges: [{ id: 'ab', source: { node: 'n', port: 'out' }, target: { node: 'm', port: 'in' } }] };
const request: ZlozOperationRequest = { version: 1, operationId: 'rename', operation: { type: 'RenameNode', id: 'n', expected: 0, label: 'Changed' } };
if (domain.api.commands.length !== 0) throw new Error('Native mutations leaked');
if (newSession({ ...target, actorId: actor.userId, generation: 'g' }).confirmed !== null) throw new Error('Session contract');
if (isDiagramFrame({})) throw new Error('Invalid frame accepted');
if (recoverOperationDocument(createOperationDocument(graph), graph, 0).status !== 'unchanged') throw new Error('Pure recovery missing');
if ((await operationHash(request)).length !== 64) throw new Error('Hash contract');
const beforeDelta = createOperationDocument(graph);
const decided = decideOperation(beforeDelta, request, { ...target, actorId: actor.userId });
if (decided.receipt.status !== 'accepted') throw new Error('Packed delta fixture failed');
const delta = applyDiagramDelta({ target, sourceVersion: 0, document: beforeDelta, coverage: [] }, { format: 'foldkit-zloz-delta', version: 1, target, previousSourceVersion: 0, sourceVersion: 1, payload: { kind: 'graph', receipt: decided.receipt, requestHash: await operationHash(request) } });
if (delta._tag !== 'Applied' || delta.frame.document.graph.nodes[0]?.label !== 'Changed' || delta.frame.document.graph.nodes[1] !== beforeDelta.graph.nodes[1] || delta.frame.document.undo.length !== 0) throw new Error('Packed immutable delta export failed');
const checkpoint = await createDiagramCheckpoint(target, 0, graph);
await parseDiagramCheckpoint(JSON.stringify(checkpoint));
await Effect.runPromise(Effect.gen(function* () {
  const runtime: DiagramRuntime = yield* domain.runtime;
  const initial = yield* runtime.initialize(actor, target, 'init', graph);
  const assessment = parseAssessmentRequest(${JSON.stringify(JSON.stringify({ version: 1, operationId: 'assessment', expectedRevision: 0, assessment: { ...assessmentFixture, target: { ...assessmentFixture.target, documentId: 'diagram', sourceNodeId: 'n', targetNodeId: 'm' } } }))});
  const authored = yield* runtime.saveAssessment(actor, target, assessment);
  if(authored.decision.status !== 'accepted' || authored.decision.record.revision !== 1) throw new Error('Packed authoring failed');
  yield* runtime.execute(actor, target, request);
  const restored = yield* runtime.recover(actor, target, 'restore', 1, checkpoint);
  const retried = yield* runtime.saveAssessment(actor, target, assessment);
  const frame = yield* runtime.frame(actor, target, {stream: initial.sourceStream, version: restored.sourceVersion});
  if (JSON.stringify(retried) !== JSON.stringify(authored) || frame?.assessments?.[0]?.revision !== 1 || frame.document.version !== 2) throw new Error('Packed assessment recovery failed');
  if (restored.status !== 'restored' || (yield* runtime.read(actor, target))?.graph.nodes[0]?.label !== 'Original') throw new Error('Packed recovery failed');
}).pipe(Effect.provide(domain.model.layer(Layer.empty).pipe(Layer.provide(Domain.InMemory))), Effect.scoped));
console.log('packed-zloz-adapter-ok');`;
  await writeFile(path.join(directory, 'consumer.mts'), source);
  await exec(
    path.join(here, 'node_modules/.bin/tsc'),
    [
      '--strict',
      '--skipLibCheck',
      '--target',
      'ES2022',
      '--module',
      'NodeNext',
      '--outDir',
      'compiled',
      'consumer.mts',
    ],
    { ...options, cwd: directory },
  );
  for (const runtime of ['node', 'bun']) {
    const result = await exec(runtime, ['compiled/consumer.mjs'], { ...options, cwd: directory });
    expect(result.stdout).toContain('packed-zloz-adapter-ok');
  }
  // Retain archives/consumer for audit and the native packed-consumer rehearsal.
  await writeFile(
    path.join(tmpdir(), 'zloz-m4-packed-consumer.json'),
    JSON.stringify({ directory, core, adapter }, null, 2),
  );
}, 180_000);
