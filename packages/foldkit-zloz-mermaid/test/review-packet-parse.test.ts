import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { createEventStormingPattern, type ZlozModelDocument } from '@opsydyn/foldkit-zloz';

import { createReviewPacket, parseReviewPacket } from '../src/index';
import literal from './fixtures/review-packet-v1.json';
const text = JSON.stringify(literal);
const clone = (): typeof literal => JSON.parse(text);
test('literal v1 packets reopen as detached frozen data with reproducible derived content', () => {
  const result = parseReviewPacket(text);
  assert(result.status === 'parsed');
  expect(JSON.parse(JSON.stringify(result.value))).toEqual(literal);
  expect(result.value).not.toBe(literal);
  expect(Object.isFrozen(result.value)).toBe(true);
  expect(Object.isFrozen(result.value.selected.snapshot.graph.nodes)).toBe(true);
  const reversed = JSON.stringify(Object.fromEntries(Object.entries(literal).reverse()));
  expect(parseReviewPacket(reversed)).toEqual(result);
});
test('unsupported envelopes, unknown fields, duplicate escaped keys and malformed JSON reject explicitly', () => {
  for (const [json, code] of [
    ['{', 'invalid-json'],
    ['null', 'invalid-packet'],
    [JSON.stringify({ ...literal, format: 'another' }), 'unsupported-format'],
    [JSON.stringify({ ...literal, version: 2 }), 'unsupported-version'],
    [JSON.stringify({ ...literal, extra: true }), 'invalid-packet'],
    ['{"format":"foldkit-zloz-review","format":"foldkit-zloz-review"}', 'invalid-json'],
    ['{"version":1,"\\u0076ersion":1}', 'invalid-json'],
  ] as const)
    expect(parseReviewPacket(json)).toEqual(expect.objectContaining({ status: 'rejected', code }));
});
test('limits apply before reconstruction and report bounded failures rather than overflowing', () => {
  expect(parseReviewPacket(text, { maxCharacters: text.length - 1 })).toEqual(
    expect.objectContaining({ status: 'rejected', code: 'limit-exceeded' }),
  );
  expect(parseReviewPacket('['.repeat(65) + '0' + ']'.repeat(65))).toEqual(
    expect.objectContaining({ status: 'rejected', code: 'limit-exceeded' }),
  );
  expect(parseReviewPacket(text, { maxValues: 10 })).toEqual(
    expect.objectContaining({ status: 'rejected', code: 'limit-exceeded' }),
  );
  expect(() => parseReviewPacket(text, { maxDepth: 0 })).toThrow();
});
test('snapshots, identities, rule catalogues and every derived packet section are validated', () => {
  const changes = [
    (p: typeof literal) => {
      p.comparison.summary.introduced += 1;
    },
    (p: typeof literal) => {
      p.projections.selected.source += '\nmalicious diagram';
    },
    (p: typeof literal) => {
      p.diagnostics = [];
    },
    (p: typeof literal) => {
      p.projections.baseline.identity.nodes = [];
    },
    (p: typeof literal) => {
      const first = p.selected.snapshot.graph.nodes[0];
      assert(first);
      Object.assign(first, { unrecognized: true });
    },
    (p: typeof literal) => {
      const first = p.conventions.rules[0];
      assert(first);
      first.label = 'Forged builtin';
    },
    (p: typeof literal) => {
      Object.assign(p.selected.source, {
        kind: 'edition',
        id: p.baseline.source.id,
        name: 'Other',
      });
    },
  ];
  for (const change of changes) {
    const p = clone();
    change(p);
    expect(parseReviewPacket(JSON.stringify(p)).status).toBe('rejected');
  }
  const invalid = clone();
  const first = invalid.selected.snapshot.graph.nodes[0];
  assert(first);
  first.position.x = Infinity;
  expect(parseReviewPacket(JSON.stringify(invalid)).status).toBe('rejected');
});
test('current, distinct editions and self-comparisons reconstruct without inventing archive content', () => {
  const graph = createEventStormingPattern();
  const doc: ZlozModelDocument = {
    id: 'sample',
    name: 'Sample',
    origin: null,
    snapshot: { graph },
    editions: [
      { id: 'a', name: 'A', snapshot: { graph } },
      { id: 'b', name: 'B', snapshot: { graph } },
    ],
  };
  for (const selection of [
    { baselineId: 'a' },
    { baselineId: 'a', selectedId: 'b' },
    { baselineId: 'a', selectedId: 'a' },
  ]) {
    const made = createReviewPacket(doc, selection, { lossPolicy: 'report', rules: [] });
    assert(made.status === 'created');
    const parsed = parseReviewPacket(JSON.stringify(made.value));
    assert(parsed.status === 'parsed');
    expect(parsed.value).toEqual(made.value);
  }
});
test('projection loss policy and custom data-only rules cannot be bypassed by cached projections', () => {
  const p = clone();
  p.projectionOptions.lossPolicy = 'reject';
  expect(parseReviewPacket(JSON.stringify(p)).status).toBe('rejected');
  const custom = clone();
  custom.conventions.source = 'custom';
  const rule = custom.conventions.rules[0];
  assert(rule);
  Object.assign(rule, { unexpected: true });
  expect(parseReviewPacket(JSON.stringify(custom)).status).toBe('rejected');
});

test('wide JSON arrays hit the value budget without argument-list stack overflow', () => {
  const wide = '[' + new Array(150001).fill(0).join(',') + ']';
  expect(parseReviewPacket(wide)).toEqual(
    expect.objectContaining({ status: 'rejected', code: 'limit-exceeded' }),
  );
});

test('custom nonempty catalogues and harmless key order/whitespace changes are portable', () => {
  const custom = clone();
  custom.conventions.source = 'custom';
  const result = parseReviewPacket(JSON.stringify(custom, null, 4));
  assert(result.status === 'parsed');
  expect(result.value.conventions.source).toBe('custom');
  expect(JSON.parse(JSON.stringify(result.value.conventions.rules))).toEqual(
    custom.conventions.rules,
  );
});

test('object-shaped scalar fields cannot trigger coercion or executable interpretation', () => {
  const packet = clone();
  Object.assign(packet.conventions, { source: { toString: null, valueOf: null } });
  expect(parseReviewPacket(JSON.stringify(packet))).toEqual(
    expect.objectContaining({ status: 'rejected', code: 'invalid-packet' }),
  );
  expect(parseReviewPacket(text.replace('"version":1', '"version":1e400'))).toEqual(
    expect.objectContaining({ status: 'rejected', code: 'invalid-packet' }),
  );
});

test('legitimate JSON metadata keys and escaped string content are retained as data', () => {
  const original = createEventStormingPattern();
  const graph = {
    ...original,
    nodes: original.nodes.map((n) => ({
      ...n,
      data: {
        '': 'empty',
        ' ': 'space',
        constructor: 'data',
        toString: null,
        escaped: '" : { [ \\ value',
      },
    })),
  };
  const made = createReviewPacket(
    {
      id: 'data',
      name: 'Data',
      origin: null,
      snapshot: { graph },
      editions: [{ id: 'before', name: 'Before', snapshot: { graph } }],
    },
    { baselineId: 'before' },
    { lossPolicy: 'report' },
  );
  assert(made.status === 'created');
  const parsed = parseReviewPacket(JSON.stringify(made.value));
  assert(parsed.status === 'parsed');
  expect(parsed.value).toEqual(made.value);
});

test('recomputed section mismatches identify their JSON Pointer and parsed identities remain read-only', () => {
  const forged = clone();
  forged.projections.selected.source += ' changed';
  expect(parseReviewPacket(JSON.stringify(forged))).toEqual(
    expect.objectContaining({
      status: 'rejected',
      code: 'inconsistent-packet',
      path: '/projections/selected/source',
    }),
  );
  const parsed = parseReviewPacket(text);
  assert(parsed.status === 'parsed');
  expect(Reflect.set(parsed.value.model, 'name', 'Changed')).toBe(false);
  expect(parsed.value.model.name).toBe(literal.model.name);
});
