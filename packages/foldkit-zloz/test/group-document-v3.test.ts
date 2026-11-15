import { expect, test } from 'bun:test';
import { deepStrictEqual } from 'node:assert/strict';

import {
  captureGroupDocumentV3,
  parseGroupDocumentV3,
  serializeGroupDocumentV3,
  upgradeGroupDocumentV3,
  planGroupDocumentDowngradeV3,
  parseGraph,
  parseSnapshot,
  parseConnectionDocument,
  serializeConnectionDocument,
  createEditor,
  createEditorFromConnectionDocument,
  portPosition,
} from '../src/index';
import v2 from './fixtures/connection-v2-loose.json';
import legacy from './fixtures/group-document-v1-portless.json';
import loose from './fixtures/group-document-v3-loose.json';
import ported from './fixtures/group-document-v3-ported.json';
import portless from './fixtures/group-document-v3-portless.json';
const copy = () => structuredClone(ported);

test('literal v3 group ports retain world geometry, ordered identities and detached immutable data', () => {
  const input = copy(),
    document = captureGroupDocumentV3(input);
  input.graph.nodes[0]!.position.x = 999;
  expect(document.graph.nodes[0]!.position).toEqual({ x: 140, y: 140 });
  expect(portPosition(document.graph.nodes[1]!, 'out')).toEqual({ x: 500, y: 230 });
  expect(document.graph.edges[0]!.source).toEqual({ node: 'g', port: 'out' });
  expect(Object.isFrozen(document.graph.nodes[1]!.ports)).toBe(true);
  expect(parseGroupDocumentV3(serializeGroupDocumentV3(document))).toEqual({
    status: 'parsed',
    value: document,
  });
  expect(parseGroupDocumentV3(JSON.stringify(loose)).status).toBe('parsed');
  expect(
    parseGroupDocumentV3(JSON.stringify({ ...loose, connectionMode: 'strict' })),
  ).toMatchObject({ status: 'rejected', code: 'invalid-document' });
});

test('group capability applies even to unconnected ports; lanes and hotspots stay portless', () => {
  const unconnected = { ...ported, graph: { ...ported.graph, edges: [] } };
  expect(
    parseGroupDocumentV3(JSON.stringify({ ...unconnected, capabilities: { groupPorts: false } })),
  ).toMatchObject({ status: 'rejected' });
  expect(parseGroupDocumentV3(JSON.stringify(unconnected)).status).toBe('parsed');
  for (const architecture of [
    { family: 'event-storming', role: 'lane' },
    { family: 'event-storming', role: 'hotspot', status: 'open' },
  ]) {
    const bad = copy();
    Object.assign(bad.graph.nodes[1]!, { architecture });
    expect(parseGroupDocumentV3(JSON.stringify(bad)).status).toBe('rejected');
  }
});

test('existing v1/v2 readers, serializers and editor constructors remain closed to ported groups', () => {
  const document = captureGroupDocumentV3(ported);
  for (const reader of [parseGraph, parseSnapshot, parseConnectionDocument])
    expect(() => reader(JSON.stringify(ported))).toThrow();
  expect(() => createEditor(document.graph)).toThrow('cannot have ports');
  expect(() =>
    createEditorFromConnectionDocument({
      version: 2,
      connectionMode: 'strict',
      graph: document.graph,
    }),
  ).toThrow();
  deepStrictEqual(parseSnapshot(JSON.stringify(legacy)), {
    graph: legacy.graph,
    viewport: legacy.viewport,
  });
});

test('explicit legacy upgrades preserve mode, camera, child-first membership and all data without mutating source', () => {
  const before = JSON.stringify(legacy),
    upgraded = upgradeGroupDocumentV3(legacy);
  deepStrictEqual(upgraded, {
    version: 3,
    coordinateSpace: 'world',
    connectionMode: 'strict',
    capabilities: { groupPorts: false },
    graph: legacy.graph,
    viewport: legacy.viewport,
  });
  expect(JSON.stringify(legacy)).toBe(before);
  expect(upgraded.graph).not.toBe(legacy.graph);
  const snapshot = parseSnapshot(before);
  expect(upgradeGroupDocumentV3(snapshot)).toEqual(upgraded);
  expect(upgradeGroupDocumentV3(v2).connectionMode).toBe('loose');
  expect(() => upgradeGroupDocumentV3(ported)).toThrow();
});

test('downgrade refuses every ported group without a target, including unconnected ports', () => {
  for (const source of [ported, { ...ported, graph: { ...ported.graph, edges: [] } }]) {
    const result = planGroupDocumentDowngradeV3(captureGroupDocumentV3(source));
    expect(result.type).toBe('blocked');
    expect(result).not.toHaveProperty('document');
    expect(result.findings[0]).toMatchObject({
      code: 'group-ports-not-representable',
      nodeId: 'g',
    });
  }
  const source = upgradeGroupDocumentV3(v2);
  const result = planGroupDocumentDowngradeV3(source);
  expect(result.type).toBe('reviewable');
  if (result.type !== 'reviewable') throw new Error('Expected loss-reviewed downgrade');
  expect(parseConnectionDocument(serializeConnectionDocument(result.document)).connectionMode).toBe(
    'loose',
  );
  expect(result.document.graph).toEqual(source.graph);
  expect(result.document.graph).not.toBe(source.graph);
});

test('unsupported declarations are distinguished from malformed structure and never return a value', () => {
  for (const [input, code, path] of [
    [{ ...ported, version: 4 }, 'unsupported-version', '/version'],
    [{ ...ported, version: '3' }, 'invalid-document', '/version'],
    [{ ...ported, coordinateSpace: 'parent' }, 'unsupported-coordinates', '/coordinateSpace'],
    [{ ...ported, coordinateSpace: 3 }, 'invalid-document', '/coordinateSpace'],
    [
      { ...ported, capabilities: { groupPorts: true, guessedParents: true } },
      'unsupported-capability',
      '/capabilities',
    ],
    [{ ...ported, capabilities: {} }, 'invalid-document', '/capabilities'],
    [
      { ...ported, capabilities: { groupPorts: 'yes' } },
      'invalid-document',
      '/capabilities/groupPorts',
    ],
    [{ ...ported, accidentalField: 1 }, 'invalid-document', '/accidentalField'],
  ] as const) {
    const result = parseGroupDocumentV3(JSON.stringify(input));
    expect(result).toMatchObject({ status: 'rejected', code, path });
    expect(result).not.toHaveProperty('value');
  }
});

test('strict nested structural keys reject silent losses while arbitrary data metadata round trips', () => {
  for (const alter of [
    (v: ReturnType<typeof copy>) => Object.assign(v.graph, { extra: true }),
    (v: ReturnType<typeof copy>) => Object.assign(v.graph.nodes[0]!, { extra: true }),
    (v: ReturnType<typeof copy>) => Object.assign(v.graph.nodes[0]!.position, { relative: true }),
    (v: ReturnType<typeof copy>) => Object.assign(v.graph.nodes[0]!.size, { unit: 'px' }),
    (v: ReturnType<typeof copy>) => Object.assign(v.graph.nodes[1]!.ports[0]!, { extra: true }),
    (v: ReturnType<typeof copy>) => Object.assign(v.graph.edges[0]!.source, { extra: true }),
    (v: ReturnType<typeof copy>) => Object.assign(v.viewport, { extra: true }),
  ]) {
    const value = copy();
    alter(value);
    expect(parseGroupDocumentV3(JSON.stringify(value)).status).toBe('rejected');
    expect(() =>
      upgradeGroupDocumentV3({ version: 1, graph: value.graph, viewport: value.viewport }),
    ).toThrow();
  }
  const value = copy();
  Object.assign(value.graph.nodes[0]!, {
    data: JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":"metadata","nested":[null,true,2]}',
    ),
  });
  const result = parseGroupDocumentV3(JSON.stringify(value));
  expect(result.status).toBe('parsed');
  if (result.status !== 'parsed') throw new Error('Expected data-only metadata');
  expect(result.value.graph.nodes[0]!.data).toEqual(
    JSON.parse('{"__proto__":{"polluted":true},"constructor":"metadata","nested":[null,true,2]}'),
  );
  expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
});

test('shared graph invariants reject missing or ordinary parents, cycles, duplicate identity and dangling endpoints', () => {
  for (const alter of [
    (v: ReturnType<typeof copy>) => {
      v.graph.nodes[0]!.parentId = 'missing';
    },
    (v: ReturnType<typeof copy>) => {
      v.graph.nodes[0]!.parentId = 'b';
    },
    (v: ReturnType<typeof copy>) => {
      v.graph.nodes[0]!.parentId = 'child';
    },
    (v: ReturnType<typeof copy>) => Object.assign(v.graph.nodes[1]!, { parentId: 'child' }),
    (v: ReturnType<typeof copy>) => {
      v.graph.nodes[2]!.id = 'g';
    },
    (v: ReturnType<typeof copy>) =>
      Object.assign(v.graph.nodes[1]!, {
        ports: [...v.graph.nodes[1]!.ports, ...v.graph.nodes[1]!.ports],
      }),
    (v: ReturnType<typeof copy>) => {
      v.graph.edges[0]!.target.port = 'missing';
    },
    (v: ReturnType<typeof copy>) => {
      v.graph.nodes[1]!.size.width = 0;
    },
  ]) {
    const value = copy();
    alter(value);
    expect(parseGroupDocumentV3(JSON.stringify(value)).status).toBe('rejected');
  }
});

test('owned construction rejects accessors, toJSON, prototypes, symbols, cycles and nonfinite data without executing accessors', () => {
  let reads = 0;
  const accessor = {
    ...ported,
    get graph() {
      reads++;
      return ported.graph;
    },
  };
  const toJSON = {
    ...ported,
    toJSON() {
      reads++;
      return ported;
    },
  };
  for (const input of [
    accessor,
    toJSON,
    Object.create(ported),
    { ...ported, [Symbol('hidden')]: true },
    { ...ported, viewport: { x: Infinity, y: 0, zoom: 1 } },
  ])
    expect(() => captureGroupDocumentV3(input)).toThrow();
  const cycle = copy();
  Object.assign(cycle.graph.nodes[0]!, { data: cycle });
  expect(() => captureGroupDocumentV3(cycle)).toThrow();
  expect(reads).toBe(0);
  const defect = new Proxy(
    {},
    {
      getPrototypeOf() {
        throw new TypeError('Unexpected defect');
      },
    },
  );
  expect(() => captureGroupDocumentV3(defect)).toThrow('Unexpected defect');
});

test('bounded raw readers reject escaped duplicate keys, nonfinite exponents, malformed/deep/large text and support tighter limits only', () => {
  const text = JSON.stringify(ported);
  for (const source of [
    text.replace('"version":3', '"version":3,"ver\\u0073ion":3'),
    text + '{}',
    '{bad',
    text.replace('"zoom":1.25', '"zoom":1e999'),
  ]) {
    const result = parseGroupDocumentV3(source);
    expect(result.status).toBe('rejected');
    expect(result).not.toHaveProperty('value');
  }
  expect(parseGroupDocumentV3(' '.repeat(2_000_001))).toMatchObject({
    status: 'rejected',
    code: 'limit-exceeded',
  });
  expect(parseGroupDocumentV3(text, { maxDepth: 2 })).toMatchObject({
    status: 'rejected',
    code: 'limit-exceeded',
  });
  expect(parseGroupDocumentV3(text, { maxValues: 4 })).toMatchObject({
    status: 'rejected',
    code: 'limit-exceeded',
  });
  expect(parseGroupDocumentV3(text, { maxCharacters: 10 })).toMatchObject({
    status: 'rejected',
    code: 'limit-exceeded',
  });
  for (const options of [
    { maxCharacters: 2_000_001 },
    { maxDepth: 65 },
    { maxValues: 100_001 },
    { maxDepth: 0 },
    { maxDepth: null },
  ]) {
    // SAFETY: Deliberately invalid JavaScript options exercise runtime rejection; the test does not rely on this assertion for validation.
    expect(() => parseGroupDocumentV3(text, options as never)).toThrow();
  }
  const escaped = copy();
  Object.assign(escaped.graph.nodes[0]!, { data: '\u0000'.repeat(400_000) });
  expect(() => captureGroupDocumentV3(escaped)).toThrow('canonical text');
});

test('literal portless v3 data downgrades with detached explicit v2 camera/mode and capability disclosure', () => {
  const source = captureGroupDocumentV3(portless);
  const result = planGroupDocumentDowngradeV3(source);
  expect(result.type).toBe('reviewable');
  if (result.type !== 'reviewable') throw new Error('Expected portless downgrade');
  deepStrictEqual(result.document, {
    version: 2,
    connectionMode: 'strict',
    graph: legacy.graph,
    viewport: legacy.viewport,
  });
  expect(result.losses).toEqual([]);
  expect(upgradeGroupDocumentV3(legacy)).toEqual(source);
  const enabled = planGroupDocumentDowngradeV3(
    captureGroupDocumentV3({ ...portless, capabilities: { groupPorts: true } }),
  );
  if (enabled.type !== 'reviewable') throw new Error('Expected explicit capability loss');
  expect(enabled.losses[0]?.code).toBe('group-capability-removed');
});

test('default scanner/ownership budgets reject deep and high-value payloads before structural publication', () => {
  expect(parseGroupDocumentV3('['.repeat(66) + '0' + ']'.repeat(66))).toMatchObject({
    status: 'rejected',
    code: 'limit-exceeded',
  });
  expect(
    parseGroupDocumentV3(JSON.stringify(Array.from({ length: 100_001 }, () => null))),
  ).toMatchObject({ status: 'rejected', code: 'limit-exceeded' });
  const highValues = copy();
  Object.assign(highValues.graph.nodes[0]!, { data: Array.from({ length: 100_001 }, () => null) });
  expect(() => captureGroupDocumentV3(highValues)).toThrow('100000');
  expect(
    parseGroupDocumentV3(JSON.stringify({ ...ported, viewport: { x: 0, y: 0, zoom: 0 } })),
  ).toMatchObject({ status: 'rejected', code: 'invalid-document', path: '/viewport' });
});

test('eligible C4 and DDD boundaries may own ports without inferring edge meaning; ordinary hotspots remain portless', () => {
  for (const architecture of [
    { family: 'c4', role: 'software-system' },
    { family: 'c4', role: 'container', technology: 'Worker' },
    { family: 'ddd', role: 'aggregate' },
    { family: 'ddd', role: 'bounded-context' },
  ]) {
    const value = copy();
    Object.assign(value.graph.nodes[1]!, { architecture });
    const result = parseGroupDocumentV3(JSON.stringify(value));
    expect(result.status).toBe('parsed');
    if (result.status === 'parsed')
      expect(result.value.graph.edges[0]).not.toHaveProperty('architecture');
  }
  const hotspot = copy();
  Object.assign(hotspot.graph.nodes[2]!, {
    architecture: { family: 'event-storming', role: 'hotspot', status: 'open' },
  });
  expect(parseGroupDocumentV3(JSON.stringify(hotspot)).status).toBe('rejected');
});

test('canonical capture and reopening agree for native JSON negative-zero normalization', () => {
  const input = copy();
  input.viewport.x = -0;
  Object.assign(input.graph.nodes[0]!, { data: { number: -0 } });
  const captured = captureGroupDocumentV3(input);
  expect(Object.is(captured.viewport!.x, -0)).toBe(false);
  deepStrictEqual(parseGroupDocumentV3(serializeGroupDocumentV3(captured)), {
    status: 'parsed',
    value: captured,
  });
  expect(Object.is(input.viewport.x, -0)).toBe(true);
});
