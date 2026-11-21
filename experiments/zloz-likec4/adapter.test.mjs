import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LikeC4 } from 'likec4';

import { exportLikeC4 } from './adapter.mjs';

const port = (id, kind, side) => ({ id, kind, side, offset: 0.5 });
const document = {
  version: 3,
  coordinateSpace: 'world',
  connectionMode: 'strict',
  capabilities: { groupPorts: true },
  graph: {
    nodes: [
      {
        id: 'store / live',
        label: 'Store',
        kind: 'group',
        architecture: { family: 'c4', role: 'software-system', scope: 'internal' },
        position: { x: 100, y: 0 },
        size: { width: 560, height: 360 },
        ports: [port('incoming', 'input', 'left')],
      },
      {
        id: 'web',
        label: "Buyer's web",
        kind: 'group',
        parentId: 'store / live',
        architecture: { family: 'c4', role: 'container', technology: 'Astro' },
        position: { x: 124, y: 60 },
        size: { width: 330, height: 220 },
        ports: [],
      },
      {
        id: 'checkout',
        label: 'Checkout',
        parentId: 'web',
        architecture: { family: 'c4', role: 'component', description: 'Places an order' },
        position: { x: 142, y: 122 },
        size: { width: 140, height: 70 },
        ports: [port('payments', 'output', 'right')],
        data: { secret: 'excluded fixture value' },
      },
      {
        id: 'buyer',
        label: 'Buyer',
        architecture: { family: 'c4', role: 'person' },
        position: { x: 0, y: 100 },
        size: { width: 50, height: 60 },
        ports: [port('uses', 'output', 'right')],
      },
      {
        id: 'bank',
        label: 'Bank',
        architecture: { family: 'c4', role: 'software-system', scope: 'external' },
        position: { x: 720, y: 100 },
        size: { width: 120, height: 60 },
        ports: [port('api', 'input', 'left')],
      },
    ],
    edges: [
      {
        id: 'visit',
        source: { node: 'buyer', port: 'uses' },
        target: { node: 'store / live', port: 'incoming' },
        label: 'Browses',
      },
      {
        id: 'authorize',
        source: { node: 'checkout', port: 'payments' },
        target: { node: 'bank', port: 'api' },
        label: 'Authorizes',
      },
      {
        id: 'refund',
        source: { node: 'checkout', port: 'payments' },
        target: { node: 'bank', port: 'api' },
        label: 'Refunds',
      },
    ],
  },
};

test('default rejection reports losses and report mode returns a deterministic identity receipt', async () => {
  const rejected = await exportLikeC4(document);
  assert.equal(rejected.status, 'rejected');
  assert.equal('value' in rejected, false);
  assert.deepEqual([...new Set(rejected.diagnostics.map(({ code }) => code))].sort(), [
    'host-data',
    'layout',
    'ports',
  ]);
  const reviewed = await exportLikeC4(document, { lossPolicy: 'report' });
  assert.equal(reviewed.status, 'converted');
  assert.deepEqual(reviewed.value.diagnostics, rejected.diagnostics);
  assert.equal(reviewed.value.source.includes('excluded fixture value'), false);
  assert.deepEqual(
    reviewed.value.identity.relationships.find(({ id }) => id === 'visit'),
    {
      id: 'visit',
      title: 'Browses',
      source: { node: 'buyer', port: 'uses' },
      target: { node: 'store / live', port: 'incoming' },
    },
  );
  const reordered = structuredClone(document);
  reordered.graph.nodes.reverse();
  reordered.graph.edges.reverse();
  assert.deepEqual(await exportLikeC4(reordered, { lossPolicy: 'report' }), reviewed);
});

test('report mode still rejects invalid graphs, unsupported roles and ambiguous parallel identities', async () => {
  const invalid = structuredClone(document);
  invalid.graph.edges[0].target.port = 'missing';
  const unknown = structuredClone(document);
  delete unknown.graph.nodes[0].architecture;
  const duplicate = structuredClone(document);
  const refined = structuredClone(duplicate.graph.edges[1]);
  duplicate.graph.edges.push({ ...refined, id: 'second authorization', label: ' Authorizes ' });
  for (const [input, code] of [
    [invalid, 'invalid-document'],
    [unknown, 'unsupported-node'],
    [duplicate, 'ambiguous-relationship'],
  ]) {
    const result = await exportLikeC4(input, { lossPolicy: 'report' });
    assert.equal(result.status, 'rejected');
    assert.equal('value' in result, false);
    assert.ok(result.diagnostics.some((finding) => finding.code === code));
  }
});

test('LikeC4 CLI validates and its model parser retains authored C4 semantics', async (t) => {
  const result = await exportLikeC4(document, { lossPolicy: 'report' });
  assert.equal(result.status, 'converted');

  const directory = mkdtempSync(join(tmpdir(), 'zloz-likec4-fixture-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(join(directory, 'model.c4'), result.value.source);
  const cli = fileURLToPath(new URL('./node_modules/likec4/bin/likec4.mjs', import.meta.url));
  const validation = execFileSync(
    process.execPath,
    [cli, 'validate', directory, '--json', '--max-warnings', '0'],
    { encoding: 'utf8', timeout: 30_000 },
  );
  assert.equal(JSON.parse(validation).valid, true);

  await using parsed = await LikeC4.fromSource(result.value.source, {
    throwIfInvalid: true,
    logger: false,
  });
  const model = await parsed.computedModel();
  const elements = new Map([...model.elements()].map((element) => [element.title, element]));
  assert.equal(elements.size, 5);
  const bank = elements.get('Bank');
  const store = elements.get('Store');
  const web = elements.get("Buyer's web");
  const checkout = elements.get('Checkout');
  assert.equal(elements.get('Buyer').kind, 'person');
  assert.equal(bank.kind, 'system');
  assert.equal(bank.isTagged('external'), true);
  assert.equal(store.isTagged('internal'), true);
  assert.equal(web.kind, 'container');
  assert.equal(web.technology, 'Astro');
  assert.equal(web.parent.id, store.id);
  assert.equal(checkout.kind, 'component');
  assert.equal(checkout.description.text, 'Places an order');
  assert.equal(checkout.parent.id, web.id);
  assert.deepEqual(
    [...model.relationships()]
      .map((relation) => [relation.source.title, relation.target.title, relation.title])
      .sort(),
    [
      ['Buyer', 'Store', 'Browses'],
      ['Checkout', 'Bank', 'Authorizes'],
      ['Checkout', 'Bank', 'Refunds'],
    ],
  );
  for (const [id, title] of [
    ['store / live', 'Store'],
    ['web', "Buyer's web"],
    ['checkout', 'Checkout'],
    ['buyer', 'Buyer'],
    ['bank', 'Bank'],
  ]) {
    const item = result.value.identity.elements.find((element) => element.id === id);
    assert.equal(model.element(item.fqn).title, title);
  }
  assert.ok(model.findView('index'));
});

test('text normalization is disclosed and literal backslashes survive the LikeC4 parser', async () => {
  const input = structuredClone(document);
  input.graph.nodes[0].label = '  Store\nfront  ';
  input.graph.edges[0].label = String.raw`Browses \new`;
  const result = await exportLikeC4(input, { lossPolicy: 'report' });
  assert.equal(result.status, 'converted');
  assert.ok(
    result.value.diagnostics.some(
      ({ code, subject }) => code === 'text-normalized' && subject === 'store / live',
    ),
  );
  await using parsed = await LikeC4.fromSource(result.value.source, {
    throwIfInvalid: true,
    logger: false,
  });
  const model = await parsed.computedModel();
  assert.ok([...model.elements()].some(({ title }) => title === 'Store front'));
  assert.ok([...model.relationships()].some(({ title }) => title === String.raw`Browses \new`));
});
