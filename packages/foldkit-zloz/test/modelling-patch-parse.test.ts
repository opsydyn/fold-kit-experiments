import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  parseModellingPatch,
  dryRunModellingPatch,
  createEditor,
  type ZlozModellingPatchParseResult,
} from '../src/index';
import literal from './fixtures/modelling-patch-v1.json';
const text = JSON.stringify(literal);
function rejection(
  input: string,
  code: Extract<ZlozModellingPatchParseResult, { status: 'rejected' }>['code'],
  path?: string,
) {
  const result = parseModellingPatch(input);
  assert(result.status === 'rejected');
  expect(result.code).toBe(code);
  if (path !== undefined) expect(result.path).toBe(path);
  return result;
}
test('literal v1 text decodes into owned frozen data and reproduces dry-run findings without editor edits', () => {
  const decoded = parseModellingPatch(text);
  assert(decoded.status === 'parsed');
  expect(JSON.parse(JSON.stringify(decoded.value))).toEqual(literal);
  expect(decoded.value).not.toBe(literal);
  expect(Object.isFrozen(decoded.value.operations)).toBe(true);
  expect(Object.isFrozen(decoded.value.source.graph.nodes[0]?.data)).toBe(true);
  const before = createEditor(decoded.value.source.graph),
    result = dryRunModellingPatch(decoded.value.source, decoded.value);
  assert(result.type === 'reviewable');
  expect(result.losses[0]?.fields).toEqual(['label']);
  expect(result.graph.nodes[0]?.label).toBe('Order management');
  expect(before.graph.nodes[0]?.label).toBe('Orders');
  expect(before.past).toEqual([]);
  expect(before.revision).toBe(0);
  const reordered = JSON.stringify(Object.fromEntries(Object.entries(literal).reverse()));
  expect(parseModellingPatch(reordered)).toEqual(decoded);
});
test('format/version and exact proposal fields reject independently of source freshness', () => {
  rejection('null', 'invalid-patch', '');
  rejection('[]', 'invalid-patch', '');
  rejection(
    JSON.stringify({ ...literal, format: 'foldkit-zloz-model' }),
    'unsupported-format',
    '/format',
  );
  for (const version of [0, 2, '1', null])
    rejection(JSON.stringify({ ...literal, version }), 'unsupported-version', '/version');
  rejection(JSON.stringify({ ...literal, extra: true }), 'invalid-patch', '');
  rejection(
    JSON.stringify({ ...literal, source: { ...literal.source, revision: -1 } }),
    'invalid-patch',
    '/source',
  );
  rejection(
    JSON.stringify({
      ...literal,
      operations: [{ id: 'bad', type: 'node.merge', node: literal.source.graph.nodes[0] }],
    }),
    'invalid-patch',
    '/operations/0/type',
  );
  rejection(JSON.stringify({ version: 1, data: literal }), 'unsupported-format', '/format');
  const dangling = {
    ...literal,
    operations: [{ id: 'absent', type: 'node.remove', nodeId: 'missing' }],
  };
  const decoded = parseModellingPatch(JSON.stringify(dangling));
  assert(decoded.status === 'parsed');
  expect(dryRunModellingPatch(decoded.value.source, decoded.value).type).toBe('rejected');
});
test('duplicate decoded keys reject at all depths, including opaque metadata and escaped names', () => {
  for (const [input, path] of [
    ['{"version":1,"version":1}', '/version'],
    ['{"version":1,"\\u0076ersion":1}', '/version'],
    [
      text.replace('"owner":"commerce"', '"owner":"commerce","owner":"commerce"'),
      '/source/graph/nodes/0/data/owner',
    ],
    [
      text.replace('"owner":"commerce"', '"owner":"commerce","\\u006fwner":"other"'),
      '/source/graph/nodes/0/data/owner',
    ],
    ['{"a/b":{"~key":1,"\\u007ekey":2}}', '/a~1b/~0key'],
    ['{"😀":1,"\\ud83d\\ude00":2}', '/😀'],
  ] as const)
    rejection(input, 'invalid-json', path);
  const distinct = JSON.stringify({
    ...literal,
    provenance: { ...literal.provenance, reason: 'Escapes: \\" quote " slash / braces { [ ] }' },
    operations: [],
  });
  expect(parseModellingPatch(distinct).status).toBe('parsed');
});
test('strict JSON grammar and framing reject before domain interpretation', () => {
  for (const input of [
    '',
    '{',
    '{"a":1,}',
    '[1,]',
    '{"a":01}',
    '{"a":1.}',
    '{"a":1e}',
    '{"a":1e400x}',
    '{"a":+1}',
    '{"a":NaN}',
    '{"a":Infinity}',
    '{"a":"\\x41"}',
    '{"a":"\\u12"}',
    '{"a":"\n"}',
    '{"a" 1}',
    '{"a":true false}',
    '{"a":tru}',
    '{"a":null]',
    '/* comment */' + text,
    '\uFEFF' + text,
    text + '{}',
    text + ' null',
    '\u00a0' + text,
    text + '\u00a0',
  ])
    rejection(input, 'invalid-json');
  expect(parseModellingPatch(' \t\n\r' + text + ' \n').status).toBe('parsed');
  rejection(text.replace('"revision":7', '"revision":1e400'), 'invalid-patch', '/source/revision');
});
test('text, depth, value and operation budgets are bounded and configuration cannot relax v1 caps', () => {
  expect(parseModellingPatch(text, { maxCharacters: text.length }).status).toBe('parsed');
  expect(parseModellingPatch(text, { maxCharacters: text.length - 1 })).toMatchObject({
    status: 'rejected',
    code: 'limit-exceeded',
  });
  expect(parseModellingPatch(text, { maxValues: 10 })).toMatchObject({
    status: 'rejected',
    code: 'limit-exceeded',
  });
  rejection('['.repeat(66) + '0' + ']'.repeat(66), 'limit-exceeded');
  rejection('[' + Array(100001).fill(0).join(',') + ']', 'limit-exceeded');
  const tooMany = {
    ...literal,
    operations: Array.from({ length: 1001 }, (_, i) => ({
      id: String(i),
      type: 'node.remove',
      nodeId: String(i),
    })),
  };
  rejection(JSON.stringify(tooMany), 'limit-exceeded', '/operations');
  for (const options of [
    { maxCharacters: 0 },
    { maxCharacters: 2000001 },
    { maxDepth: 65 },
    { maxDepth: 1.5 },
    { maxValues: 100001 },
    { maxValues: Infinity },
    { maxDepth: NaN },
  ])
    expect(() => parseModellingPatch(text, options)).toThrow();
});

test('root-zero depth and value counts have exact boundaries on the independent literal', () => {
  // Independently counted literal: 54 values, maximum value depth 6; keys do not count as values.
  expect(parseModellingPatch(text, { maxDepth: 6, maxValues: 54 }).status).toBe('parsed');
  expect(parseModellingPatch(text, { maxDepth: 5 })).toMatchObject({
    status: 'rejected',
    code: 'limit-exceeded',
  });
  expect(parseModellingPatch(text, { maxValues: 53 })).toMatchObject({
    status: 'rejected',
    code: 'limit-exceeded',
  });
});
test('JSON scalars, escapes, arrays, distinct Unicode and prototype-named metadata survive decoding', () => {
  const values = [
    null,
    true,
    false,
    0,
    -0,
    -12.5,
    1e-100,
    1e20,
    'quote " slash / backslash \\ controls \b\f\n\r\t',
    '\ud800',
    [],
    {},
    [true, null, { a: 'x' }],
    JSON.parse('{"__proto__":{"safe":true},"constructor":2,"é":1,"e\\u0301":2}'),
  ];
  for (const data of values) {
    const raw = JSON.parse(text);
    raw.source.graph.nodes[0].data = data;
    const result = parseModellingPatch(JSON.stringify(raw));
    assert(result.status === 'parsed');
    expect(result.value.source.graph.nodes[0]?.data).toEqual(JSON.parse(JSON.stringify(data)));
    expect(Object.getPrototypeOf(result.value.source.graph.nodes[0]?.data ?? {})).not.toBeNull();
  }
  expect(Object.prototype.hasOwnProperty.call({}, 'safe')).toBe(false);
});

test('explicit nonnumeric limit configuration is rejected rather than defaulted', () => {
  for (const options of [
    JSON.parse('{"maxDepth":null}'),
    JSON.parse('{"maxValues":true}'),
    JSON.parse('{"maxCharacters":"2000000"}'),
  ])
    expect(() => parseModellingPatch(text, options)).toThrow();
});
