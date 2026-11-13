import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

import * as Domain from '@alchemy.run/domain';
import {
  captureEdition,
  compareEditions,
  serializeGraph,
  writeSvgExport,
} from '@opsydyn/foldkit-zloz';

import { Bank, BankNext, calls, resetCalls } from './dist/fixture.js';
import { extractDeclarations, mapDeclarations } from './dist/index.js';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const installed = read('node_modules/@alchemy.run/domain/package.json'),
  manifest = read('package.json');
assert.equal(installed.version, '2.0.0-beta.85');
for (const [name, version] of [
  ['effect', '4.1.0'],
  ['alchemy', '2.0.0-beta.85'],
  ['typescript', '6.0.3'],
])
  assert.equal(read('node_modules/' + name + '/package.json').version, version);
assert.equal(existsSync(new URL('node_modules/foldkit', import.meta.url)), false);
assert.equal(existsSync(new URL('node_modules/react', import.meta.url)), false);
resetCalls();
assert.deepEqual(Domain.verify(Bank), []);
const a = mapDeclarations(
  extractDeclarations(Bank, { namespace: 'example/bank', revision: 'fixture-v1' }),
);
const b = mapDeclarations(
  extractDeclarations(BankNext, { namespace: 'example/bank', revision: 'fixture-v2' }),
);
assert.equal(a.type, 'mapped');
assert.equal(b.type, 'mapped');
const delta = compareEditions(
  captureEdition({ id: 'v1', name: 'Before', snapshot: { graph: a.graph } }),
  captureEdition({ id: 'v2', name: 'After', snapshot: { graph: b.graph } }),
);
assert.equal(delta.nodes.filter((c) => c.kind === 'added').length, 2);
assert.equal(calls(), 0);
const flags = [
  '--ignoreConfig',
  '--strict',
  '--exactOptionalPropertyTypes',
  '--skipLibCheck',
  '--noEmit',
  '--target',
  'ES2022',
  '--module',
  'NodeNext',
  'fixtures/strict-optional-repro.ts',
];
const probe = spawnSync('node', ['node_modules/typescript/bin/tsc', ...flags], {
  encoding: 'utf8',
});
assert.equal(probe.status, 2);
assert.match(probe.stdout, /definition\.read|read/);
assert.match(probe.stdout, /exactOptionalPropertyTypes/);
mkdirSync(new URL('evidence/', import.meta.url), { recursive: true });
writeFileSync(new URL('evidence/strict-optional-repro.txt', import.meta.url), probe.stdout);
// Compile the supported fixture/adapter with the second consumer resolution profile too.
execFileSync(
  'node',
  [
    'node_modules/typescript/bin/tsc',
    '--noEmit',
    '--declaration',
    'false',
    '--module',
    'ESNext',
    '--moduleResolution',
    'Bundler',
    '-p',
    'tsconfig.json',
  ],
  { stdio: 'pipe' },
);
const svg = writeSvgExport(
  { graph: a.graph },
  {
    title: 'Pinned Alchemy declaration projection',
    description:
      'Synthetic declaration types; untyped nodes and relationships require findings review. Not a running business system.',
    region: { type: 'model', padding: 24 },
    theme: { colorScheme: 'light' },
    background: { type: 'theme' },
    font: { family: 'sans-serif', size: 14, weight: 400 },
    renderers: { nodes: 'built-in', edges: 'built-in' },
  },
  { allowLosses: true },
);
assert.equal(svg.type, 'written');
writeFileSync(new URL('evidence/bank-projection.svg', import.meta.url), svg.svg);
writeFileSync(
  new URL('evidence/bank-next.json', import.meta.url),
  JSON.stringify(b, null, 2) + '\n',
);
const lock = read('package-lock.json');
const report = {
  packageVersion: installed.version,
  node: process.version,
  bun: execFileSync('bun', ['--version'], { encoding: 'utf8' }).trim(),
  typeScript: manifest.devDependencies.typescript,
  sourceDeclarations: a.source.declarations.length,
  sourceRelations: a.source.relations.length,
  graphNodes: a.graph.nodes.length,
  graphEdges: a.graph.edges.length,
  coverageEntries: a.coverage.length,
  roleGaps: a.findings.filter((f) => f.code === 'role-unrepresented').map((f) => f.sourceId),
  untypedRelationships: a.findings.filter((f) => f.code === 'relationship-untyped').length,
  addedDeclarations: delta.nodes.filter((c) => c.kind === 'added').map((c) => c.id),
  changedSemanticNodes: delta.nodes
    .filter((c) => c.kind === 'changed' && c.semanticChanged)
    .map((c) => c.id),
  movedExistingNodes: delta.nodes
    .filter((c) => c.kind === 'changed' && c.layoutChanged)
    .map((c) => c.id),
  handlerInvocations: calls(),
  definitionVerification: [],
  strictOptionalProbe: { exit: probe.status, expectedFailure: true, hasDeclarationReadError: true },
  profiles: ['NodeNext', 'Bundler'],
  optionalFoldkitInstalled: false,
  reactInstalled: false,
  domainIntegrity: lock.packages['node_modules/@alchemy.run/domain'].integrity,
  coreTarballIntegrity: lock.packages['node_modules/@opsydyn/foldkit-zloz'].integrity,
  goldenSourceSha256: createHash('sha256')
    .update(readFileSync(new URL('fixtures/bank-source.json', import.meta.url)))
    .digest('hex'),
  goldenGraphSha256: createHash('sha256')
    .update(readFileSync(new URL('fixtures/bank-graph.json', import.meta.url)))
    .digest('hex'),
  canonicalGraph: JSON.parse(serializeGraph(a.graph)).version,
};
writeFileSync(
  new URL('evidence/qualification.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report));
