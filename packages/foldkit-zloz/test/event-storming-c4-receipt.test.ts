import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  parseEventStormingC4Conversion,
  serializeEventStormingC4Conversion,
  createEditor,
  applyEventStormingC4Conversion,
  createEventStormingC4ConversionPlan,
  type JsonValue,
} from '../src/index';
import wire from './fixtures/c4-conversion-v1.json';

function changed(path: readonly (string | number)[], value: JsonValue) {
  // Deliberately untyped JSON mutation: malformed wire data must not be a domain constructor.
  const copy = JSON.parse(JSON.stringify(wire));
  let cursor = copy;
  for (const key of path.slice(0, -1)) cursor = cursor[key];
  const last = path.at(-1);
  assert(last !== undefined);
  cursor[last] = value;
  return JSON.stringify(copy);
}
test('independent literal v1 receipt validates without Apply, detaches and freezes source, options and target', () => {
  const receipt = parseEventStormingC4Conversion(JSON.stringify(wire));
  assert.deepEqual(receipt, wire);
  expect(Object.isFrozen(receipt.source.document.snapshot.graph.nodes[1]?.data)).toBe(true);
  expect(Object.isFrozen(receipt.options.memberships?.[0]?.placement)).toBe(true);
  expect(Object.isFrozen(receipt.document)).toBe(true);
  expect(JSON.parse(serializeEventStormingC4Conversion(receipt))).toEqual(wire);
  expect(Object.isFrozen(wire)).toBe(false);
});
for (const [path, value] of [
  [['version'], 2],
  [['format'], 'foldkit-zloz-ddd-conversion'],
  [['lossesAccepted'], false],
  [['lossesAccepted'], 'true'],
  [['extra'], true],
  [['source', 'revision'], -1],
  [['source', 'revision'], 1.5],
  [['source', 'sessionId'], ''],
  [['source', 'extra'], 1],
  [['options', 'extra'], 1],
  [['options', 'mappings', 'extra'], 1],
  [['options', 'mappings', 'nodes', 1, 'extra'], 1],
  [['options', 'mappings', 'nodes', 1, 'architecture', 'unknown'], true],
  [['options', 'memberships', 0, 'placement', 'extra'], 1],
  [['options', 'memberships', 0, 'placement', 'type'], 'guess'],
  [['options', 'memberships'], []],
  [['options', 'mappings', 'nodes'], []],
  [['document', 'snapshot', 'graph', 'nodes', 1, 'label'], 'Tampered'],
  [['document', 'snapshot', 'graph', 'nodes', 1, 'position', 'x'], 999],
  [['document', 'snapshot', 'graph', 'nodes', 1, 'parentId'], 'lane'],
  [['document', 'snapshot', 'graph', 'nodes', 1, 'data', 'owner'], 'Other team'],
  [['document', 'snapshot', 'viewport', 'zoom'], 1],
  [['document', 'name'], 'Other model'],
  [['source', 'document', 'snapshot', 'viewport'], null],
  [['document', 'editions'], [{ id: 'invented' }]],
  [['options', 'mappings', 'edges', 0, 'extra'], true],
  [['options', 'mappings', 'edges', 0, 'relationship', 'extra'], true],
  [['options', 'mappings', 'edges', 0, 'relationship', 'label'], ''],
  [['document', 'snapshot', 'graph', 'edges', 0, 'label'], 'Tampered communication'],
  [['document', 'snapshot', 'graph', 'edges'], []],
  [['document', 'editions', 0, 'name'], 'Changed history'],
  [['document', 'origin', 'modelName'], 'Changed ancestry'],
  [['options', 'memberships', 0, 'placement'], { type: 'contained', parentId: 'lane' }],
  [['options', 'memberships', 0, 'nodeId'], 'foreign'],
] as const) {
  test(`strict receipt rejects ${path.join('.')} = ${JSON.stringify(value)}`, () => {
    expect(() => parseEventStormingC4Conversion(changed(path, value))).toThrow();
  });
}
test('malformed, null and non-envelope JSON is rejected', () => {
  for (const json of ['{', 'null', '[]', '{}', JSON.stringify(wire) + 'tail'])
    expect(() => parseEventStormingC4Conversion(json)).toThrow();
});
test('serializer revalidates data and cannot package a forged target', () => {
  const valid = parseEventStormingC4Conversion(JSON.stringify(wire));
  const forged = { ...valid, document: { ...valid.document, name: 'Forged name' } };
  expect(() => serializeEventStormingC4Conversion(forged)).toThrow();
});
test('actual atomic Apply produces portable data and parsing never grants consent', () => {
  const receipt = parseEventStormingC4Conversion(JSON.stringify(wire));
  const source = { ...receipt.source, revision: 0 };
  const editor = createEditor(source.document.snapshot.graph, {
    viewport: source.document.snapshot.viewport,
  });
  const plan = createEventStormingC4ConversionPlan(source, receipt.options);
  const applied = applyEventStormingC4Conversion(editor, source, {
    conversion: receipt.options,
    consent: { planKey: plan.key, accepted: true },
  });
  expect(applied.type).toBe('applied');
  if (applied.type !== 'applied') return;
  expect(
    parseEventStormingC4Conversion(serializeEventStormingC4Conversion(applied.conversion)),
  ).toEqual(applied.conversion);
  expect(
    applyEventStormingC4Conversion(editor, source, { conversion: receipt.options, consent: null }),
  ).toMatchObject({ type: 'blocked', code: 'consent-required' });
});

test('duplicate choices, stripped source camera and unchanged plans cannot be represented as applied receipts', () => {
  const duplicate = JSON.parse(JSON.stringify(wire));
  duplicate.options.mappings.nodes.push(duplicate.options.mappings.nodes[1]);
  expect(() => parseEventStormingC4Conversion(JSON.stringify(duplicate))).toThrow();
  const noCamera = JSON.parse(JSON.stringify(wire));
  delete noCamera.source.document.snapshot.viewport;
  delete noCamera.document.snapshot.viewport;
  expect(() => parseEventStormingC4Conversion(JSON.stringify(noCamera))).toThrow();
  const unchanged = JSON.parse(JSON.stringify(wire));
  unchanged.options.mappings.nodes = unchanged.source.document.snapshot.graph.nodes.map(
    (node: { id: string }) => ({ nodeId: node.id, architecture: null }),
  );
  unchanged.options.mappings.edges = [{ edgeId: 'emits', relationship: null }];
  unchanged.options.memberships = [];
  unchanged.document = unchanged.source.document;
  expect(() => parseEventStormingC4Conversion(JSON.stringify(unchanged))).toThrow();
});
