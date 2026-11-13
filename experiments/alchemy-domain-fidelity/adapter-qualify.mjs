import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

import { captureEdition, compareEditions, writeSvgExport } from '@opsydyn/foldkit-zloz';

import { projectAlchemyModel } from './dist/adapter.js';
import { Bank, BankNext, ChainedBank, calls, resetCalls } from './dist/fixture.js';
import { StatelessBank } from './test/stateless-fixture.mjs';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const actual = read('node_modules/@alchemy.run/domain/package.json');
assert.equal(actual.version, '2.0.0-beta.85');
resetCalls();
const options = {
  namespace: 'example/bank',
  revision: 'fixture-v1',
  declaredPackageVersion: actual.version,
};
const a = projectAlchemyModel(Bank, options),
  b = projectAlchemyModel(BankNext, { ...options, revision: 'fixture-v2' }),
  chain = projectAlchemyModel(ChainedBank, options),
  stateless = projectAlchemyModel(StatelessBank, options);
for (const plan of [a, b, chain, stateless]) assert.equal(plan.type, 'reviewable');
assert.equal(a.nativeReadModels.length, 1);
assert.equal(a.nativeConsumption.length, 1);
assert.equal(chain.nativeConsumption.length, 2);
assert.equal(stateless.nativeReadModels.length, 0);
const facts = [...a.source.declarations, ...a.source.relations].map((f) => f.id);
assert.equal(new Set(a.coverage.map((c) => c.sourceId)).size, facts.length);
for (const id of facts) assert.ok(a.coverage.some((c) => c.sourceId === id));
const delta = compareEditions(
  captureEdition({ id: 'a', name: 'Before', snapshot: { graph: a.graph } }),
  captureEdition({ id: 'b', name: 'After', snapshot: { graph: b.graph } }),
);
assert.equal(delta.nodes.filter((c) => c.kind === 'added').length, 2);
assert.deepEqual(
  delta.nodes.filter((c) => c.kind === 'changed' && c.semanticChanged),
  [],
);
const probe = spawnSync(
  'node',
  [
    'node_modules/typescript/bin/tsc',
    '--ignoreConfig',
    '--strict',
    '--exactOptionalPropertyTypes',
    '--skipLibCheck',
    '--noEmit',
    '--target',
    'ES2022',
    '--module',
    'NodeNext',
    'fixtures/stateless-view-repro.ts',
  ],
  { encoding: 'utf8' },
);
assert.equal(probe.status, 2);
assert.match(probe.stdout, /Types of property 'state' are incompatible/);
writeFileSync(new URL('evidence/stateless-view-repro.txt', import.meta.url), probe.stdout);
const svg = writeSvgExport(
  { graph: a.graph },
  {
    title: 'Read-only Alchemy model projection',
    description:
      'Stateful views and declared consumption use native model semantics; remaining findings must be reviewed.',
    region: { type: 'model', padding: 24 },
    theme: { colorScheme: 'light' },
    background: { type: 'theme' },
    font: { family: 'sans-serif', size: 14, weight: 400 },
    renderers: { nodes: 'built-in', edges: 'built-in' },
  },
  { allowLosses: true },
);
assert.equal(svg.type, 'written');
assert.equal(calls(), 0);
writeFileSync(new URL('evidence/adapter-projection.svg', import.meta.url), svg.svg);
writeFileSync(
  new URL('evidence/adapter-projection.json', import.meta.url),
  JSON.stringify(a, null, 2) + '\n',
);
const lock = read('package-lock.json');
const report = {
  node: process.version,
  domainVersion: actual.version,
  coreVersion: read('node_modules/@opsydyn/foldkit-zloz/package.json').version,
  qualifiedCoreSource: 'aaa1186',
  publishedCoreCompatibilityClaim: false,
  domainIntegrity: lock.packages['node_modules/@alchemy.run/domain'].integrity,
  coreIntegrity: lock.packages['node_modules/@opsydyn/foldkit-zloz'].integrity,
  sourceFacts: facts.length,
  coveredFacts: a.coverage.length,
  nativeReadModels: a.nativeReadModels,
  nativeConsumption: a.nativeConsumption,
  remainingRoleGaps: a.findings
    .filter((f) => f.code === 'role-unrepresented')
    .map((f) => f.sourceId),
  untypedRelationships: a.findings.filter((f) => f.code === 'relationship-untyped').length,
  changedExistingSemantics: delta.nodes.filter((c) => c.kind === 'changed' && c.semanticChanged)
    .length,
  addedDeclarations: delta.nodes.filter((c) => c.kind === 'added').map((c) => c.id),
  statelessNativeBindings: stateless.nativeReadModels.length,
  chainedNativeConsumption: chain.nativeConsumption.length,
  handlerInvocations: calls(),
  statelessStrictOptionalProbe: { exit: probe.status, expectedFailure: true },
  knownStrictOptionalGates: ['omitted aggregate read', 'stateless view state'],
  versionClaimIsCallerSupplied: true,
  noProviderExecution: true,
};
writeFileSync(
  new URL('evidence/adapter-qualification.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report));
