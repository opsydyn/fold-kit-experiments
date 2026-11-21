import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  parseGroupDocumentV3,
  serializeGroupDocumentV3,
} from '../../packages/foldkit-zloz/dist/index.mjs';
import { importLikeC4 } from './import.mjs';

function exportFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'zloz-likec4-import-'));
  // oxlint-disable-next-line linteffect/no-try-catch -- Reclaim the owned fixture directory after CLI success or failure.
  try {
    copyFileSync(new URL('./import-fixture.c4', import.meta.url), join(directory, 'model.c4'));
    const cli = fileURLToPath(new URL('./node_modules/likec4/bin/likec4.mjs', import.meta.url));
    const options = { timeout: 30_000, stdio: 'pipe' };
    execFileSync(process.execPath, [cli, 'validate', directory, '--max-warnings', '0'], options);
    const path = join(directory, 'dump.json');
    execFileSync(process.execPath, [cli, 'export', 'json', '-o', path, directory], options);
    return readFileSync(path, 'utf8');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
const dump = exportFixture();

test('CLI JSON yields a detached v3 document with authored parallel relationships and group ports', () => {
  const result = importLikeC4(dump, 'detail');
  assert.equal(result.status, 'converted', JSON.stringify(result));
  const { document, diagnostics } = result.value;
  assert.deepEqual(parseGroupDocumentV3(serializeGroupDocumentV3(document)), {
    status: 'parsed',
    value: document,
  });

  const nodes = new Map(document.graph.nodes.map((node) => [node.id, node]));
  assert.equal(nodes.size, 5);
  assert.equal(nodes.get('storefront.web.api').parentId, 'storefront.web');
  assert.equal(nodes.get('storefront.web').parentId, 'storefront');
  assert.equal(nodes.get('storefront.web').architecture.technology, 'Astro');
  assert.equal(nodes.get('bank').architecture.scope, 'external');
  assert.equal(nodes.get('storefront').kind, 'group');
  assert.equal(document.capabilities.groupPorts, true);
  const sourceNode = JSON.parse(dump).views.detail.nodes.find(
    ({ id }) => id === 'storefront.web.api',
  );
  assert.deepEqual(nodes.get('storefront.web.api').position, { x: sourceNode.x, y: sourceNode.y });
  assert.deepEqual(nodes.get('storefront.web.api').size, {
    width: sourceNode.width,
    height: sourceNode.height,
  });

  const edges = document.graph.edges;
  assert.deepEqual(edges.map((e) => [e.source.node, e.target.node, e.label]).sort(), [
    ['buyer', 'storefront', 'Browses'],
    ['storefront.web.api', 'bank', 'Authorizes'],
    ['storefront.web.api', 'bank', 'Refunds'],
  ]);
  const ids = JSON.parse(dump).relations;
  for (const edge of edges) assert.equal(ids[edge.id].title, edge.label);
  assert.deepEqual(
    diagnostics
      .filter(({ code }) => code === 'generated-port')
      .map(({ subject }) => subject)
      .sort(),
    ['bank', 'buyer', 'storefront', 'storefront.web.api'],
  );
  assert.ok(diagnostics.some(({ code }) => code === 'view-presentation'));
  assert.equal(Object.isFrozen(document.graph.nodes[0]), true);
});

test('rolled-up view edges report hidden authored endpoints instead of inventing relations', () => {
  const result = importLikeC4(dump, 'overview');
  assert.equal(result.status, 'converted');
  assert.deepEqual(
    result.value.document.graph.edges.map(({ label }) => label),
    ['Browses'],
  );
  assert.equal(result.value.diagnostics.filter(({ code }) => code === 'hidden-endpoint').length, 2);
});

test('unknown, dynamic, unlaid-out and malformed selected views reject without a document', () => {
  const wrongReference = JSON.parse(dump);
  wrongReference.views.detail.edges[0].relations.push('missing');
  const cycle = JSON.parse(dump);
  cycle.views.detail.nodes.find(({ id }) => id === 'storefront').parent = 'storefront.web';
  const computed = JSON.parse(dump);
  computed._stage = 'computed';
  const malformedNode = JSON.parse(dump);
  delete malformedNode.views.detail.nodes[0].width;
  for (const [text, id] of [
    [dump, 'absent'],
    [dump, 'checkout'],
    [JSON.stringify(computed), 'detail'],
    [JSON.stringify(wrongReference), 'detail'],
    [JSON.stringify(cycle), 'detail'],
    [JSON.stringify(malformedNode), 'detail'],
    ['{', 'detail'],
  ]) {
    const result = importLikeC4(text, id);
    assert.equal(result.status, 'rejected');
    assert.equal('value' in result, false);
  }
});

test('view membership selects authored IDs once and reports unsupported relationship properties', () => {
  const model = JSON.parse(dump);
  const edge = model.views.detail.edges[0];
  const id = edge.relations[0];
  model.views.detail.edges.push({ ...edge, id: 'another-rendering' });
  model.relations[id].isBidirectional = true;
  model.relations[id].technology = 'JSON';
  model.relations.unreferenced = { ...model.relations[id], id: 'unreferenced' };

  const result = importLikeC4(JSON.stringify(model), 'detail');
  assert.equal(result.status, 'converted');
  assert.equal(result.value.document.graph.edges.filter((edge) => edge.id === id).length, 1);
  assert.ok(result.value.document.graph.edges.every((edge) => edge.id !== 'unreferenced'));
  assert.deepEqual(
    result.value.diagnostics
      .filter((item) => item.subject === id)
      .map(({ code }) => code)
      .sort(),
    ['bidirectional', 'relationship-properties'],
  );
});
