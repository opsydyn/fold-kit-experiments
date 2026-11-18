import { expect, test } from 'bun:test';

import {
  evaluateCouplingAssessment,
  parseCouplingAssessment,
  serializeCouplingAssessment,
  ZlozCouplingError,
  type ZlozCouplingAssessment,
  type ZlozCouplingContext,
  type ZlozCouplingInput,
  type ZlozCouplingIntegration,
  type ZlozCouplingLevel,
} from '../src/coupling';
import fixture from './fixtures/coupling-binary-v1.json';

const fresh = () => parseCouplingAssessment(JSON.stringify(fixture));
const known = <T>(value: T): ZlozCouplingInput<T> => ({
  status: 'known',
  value,
  basis: 'declared',
  rationale: 'Explicit fixture judgment.',
});
function context(): ZlozCouplingContext {
  return {
    documentId: 'orders-model',
    graphVersion: 7,
    graph: {
      nodes: [
        {
          id: 'a',
          label: 'Orders',
          position: { x: 0, y: 0 },
          size: { width: 100, height: 80 },
          ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
        },
        {
          id: 'b',
          label: 'Billing',
          position: { x: 200, y: 0 },
          size: { width: 100, height: 80 },
          ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
        },
      ],
      edges: [{ id: 'a-b', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } }],
    },
  };
}
// Independent literal oracle from coupling.dev's binary semantics, not evaluator arithmetic.
const cases = [
  {
    strength: 'low',
    distance: 'low',
    volatility: 'high',
    expected: { status: 'imbalanced', pattern: 'low-cohesion', basis: 'matching-dimensions' },
  },
  {
    strength: 'low',
    distance: 'high',
    volatility: 'high',
    expected: { status: 'balanced', pattern: 'loose-coupling', basis: 'complementary-dimensions' },
  },
  {
    strength: 'high',
    distance: 'low',
    volatility: 'high',
    expected: { status: 'balanced', pattern: 'high-cohesion', basis: 'complementary-dimensions' },
  },
  {
    strength: 'high',
    distance: 'high',
    volatility: 'high',
    expected: { status: 'imbalanced', pattern: 'tight-coupling', basis: 'matching-dimensions' },
  },
  {
    strength: 'low',
    distance: 'low',
    volatility: 'low',
    expected: { status: 'balanced', pattern: 'low-cohesion', basis: 'low-volatility' },
  },
  {
    strength: 'low',
    distance: 'high',
    volatility: 'low',
    expected: { status: 'balanced', pattern: 'loose-coupling', basis: 'complementary-dimensions' },
  },
  {
    strength: 'high',
    distance: 'low',
    volatility: 'low',
    expected: { status: 'balanced', pattern: 'high-cohesion', basis: 'complementary-dimensions' },
  },
  {
    strength: 'high',
    distance: 'high',
    volatility: 'low',
    expected: { status: 'balanced', pattern: 'tight-coupling', basis: 'low-volatility' },
  },
] as const;
for (const { strength, distance, volatility, expected } of cases) {
  test(`binary oracle: ${strength} strength / ${distance} distance / ${volatility} volatility`, () => {
    const document = fresh();
    const result = evaluateCouplingAssessment(
      {
        ...document,
        inputs: {
          ...document.inputs,
          strength: known(strength),
          distance: known(distance),
          volatility: known(volatility),
        },
      },
      context(),
    );
    expect(result).toEqual({
      modelVersion: 'balanced-coupling-binary/v1',
      target: fixture.target,
      scope: fixture.scope,
      ...expected,
    });
    expect(result).not.toHaveProperty('risk');
    expect(result).not.toHaveProperty('score');
  });
}

test('literal version-one wire preserves all four integration categories without invented numeric mappings', () => {
  for (const value of ['intrusive', 'functional', 'model', 'contract'] as const) {
    const wire = {
      ...fixture,
      inputs: { ...fixture.inputs, integrationType: { ...fixture.inputs.integrationType, value } },
    };
    const document = parseCouplingAssessment(JSON.stringify(wire));
    expect(document.inputs.integrationType).toEqual({
      status: 'known',
      value,
      basis: 'declared',
      rationale: wire.inputs.integrationType.rationale,
    });
    expect(evaluateCouplingAssessment(document, context())).toMatchObject({
      status: 'balanced',
      pattern: 'high-cohesion',
      basis: 'complementary-dimensions',
    });
    expect(parseCouplingAssessment(serializeCouplingAssessment(document))).toEqual(document);
  }
});

test('missing evidence never becomes zero, low volatility or a healthy default', () => {
  const document = fresh();
  for (const field of ['integrationType', 'strength', 'distance', 'volatility'] as const) {
    const input = {
      ...document,
      inputs: {
        ...document.inputs,
        [field]: { status: 'unknown' as const, reason: 'Not reviewed yet.' },
        volatility:
          field === 'volatility'
            ? { status: 'unknown' as const, reason: 'Not reviewed yet.' }
            : known<ZlozCouplingLevel>('low'),
      },
    };
    expect(evaluateCouplingAssessment(input, context())).toEqual({
      modelVersion: 'balanced-coupling-binary/v1',
      target: fixture.target,
      scope: fixture.scope,
      status: 'unassessed',
      missing: [field],
    });
  }
  const unknown = { status: 'unknown' as const, reason: 'Awaiting workshop.' };
  const input: ZlozCouplingAssessment = {
    ...document,
    inputs: { integrationType: unknown, strength: unknown, distance: unknown, volatility: unknown },
  };
  expect(
    evaluateCouplingAssessment(
      parseCouplingAssessment(serializeCouplingAssessment(input)),
      context(),
    ),
  ).toMatchObject({
    status: 'unassessed',
    missing: ['integrationType', 'strength', 'distance', 'volatility'],
  });
});

test('binding rejects a different document, stale version, missing relationship and changed endpoints before any assessment', () => {
  const document = fresh();
  const current = context();
  expect(
    evaluateCouplingAssessment(document, { ...current, documentId: 'another-document' }),
  ).toMatchObject({ status: 'rejected', code: 'document-mismatch' });
  expect(evaluateCouplingAssessment(document, { ...current, graphVersion: 8 })).toMatchObject({
    status: 'rejected',
    code: 'graph-version-mismatch',
  });
  expect(
    evaluateCouplingAssessment(document, { ...current, graph: { ...current.graph, edges: [] } }),
  ).toMatchObject({ status: 'rejected', code: 'relationship-missing' });
  const reversed = {
    ...document,
    target: { ...document.target, sourceNodeId: 'b', targetNodeId: 'a' },
  };
  expect(evaluateCouplingAssessment(reversed, current)).toMatchObject({
    status: 'rejected',
    code: 'endpoint-mismatch',
  });
  const unknown = {
    ...document,
    inputs: { ...document.inputs, strength: { status: 'unknown' as const, reason: 'Not known.' } },
  };
  expect(evaluateCouplingAssessment(unknown, { ...current, graphVersion: 8 })).toMatchObject({
    status: 'rejected',
    code: 'graph-version-mismatch',
  });
});

test('strict wire boundary rejects unsupported identities, malformed records and ambiguous evidence', () => {
  for (const patch of [
    { version: 2 },
    { version: '1' },
    { modelVersion: 'c4-v2' },
    { format: 'some-other-assessment' },
  ]) {
    expect(() => parseCouplingAssessment(JSON.stringify({ ...fixture, ...patch }))).toThrow(
      expect.objectContaining({ name: 'ZlozCouplingError', code: 'unsupported-version' }),
    );
  }
  const malformed: unknown[] = [
    null,
    [],
    {},
    { ...fixture, extra: true },
    { ...fixture, target: { ...fixture.target, extra: true } },
    { ...fixture, scope: { ...fixture.scope, horizon: ' ' } },
    { ...fixture, inputs: { ...fixture.inputs, extra: true } },
  ];
  for (const graphVersion of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, null])
    malformed.push({ ...fixture, target: { ...fixture.target, graphVersion } });
  for (const value of ['unknown-kind', 'MODEL', 1, null])
    malformed.push({
      ...fixture,
      inputs: { ...fixture.inputs, integrationType: { ...fixture.inputs.integrationType, value } },
    });
  for (const input of [
    { status: 'known', value: 'high', basis: 'declared', rationale: '' },
    { status: 'known', value: 'high', rationale: 'Missing basis.' },
    { status: 'known', value: 10, basis: 'declared', rationale: 'Not a binary dimension.' },
    { status: 'unknown', value: 'low', reason: 'Conflicting branch.' },
    { status: 'unknown', reason: '' },
  ])
    malformed.push({ ...fixture, inputs: { ...fixture.inputs, strength: input } });
  for (const value of malformed)
    expect(() => parseCouplingAssessment(JSON.stringify(value))).toThrow(ZlozCouplingError);
  expect(() => parseCouplingAssessment('{')).toThrow(ZlozCouplingError);
  expect(() =>
    parseCouplingAssessment(JSON.stringify({ ...fixture, padding: '💥'.repeat(20_000) })),
  ).toThrow(/64 KiB/);
});

test('results are deterministic and detached while source graphs and evidence remain untouched', () => {
  const document = fresh();
  const current = context();
  const before = JSON.stringify({ document, current });
  const first = evaluateCouplingAssessment(document, current);
  expect(evaluateCouplingAssessment(document, current)).toEqual(first);
  expect(JSON.stringify({ document, current })).toBe(before);
  expect(first.target).not.toBe(document.target);
  expect(first.scope).not.toBe(document.scope);
  expect(() => evaluateCouplingAssessment(document, { ...current, graphVersion: -1 })).toThrow();
  expect(() =>
    evaluateCouplingAssessment(document, { ...current, graph: { ...current.graph, nodes: [] } }),
  ).toThrow();
});

test('serialization validates live values and is stable across input property ordering', () => {
  const document = fresh();
  const extended = { ...document, extra: true };
  expect(() => serializeCouplingAssessment(extended)).toThrow(ZlozCouplingError);
  const reordered = {
    ...document,
    target: {
      targetNodeId: 'b',
      sourceNodeId: 'a',
      relationshipId: 'a-b',
      graphVersion: 7,
      documentId: 'orders-model',
    },
    inputs: {
      volatility: document.inputs.volatility,
      distance: document.inputs.distance,
      strength: document.inputs.strength,
      integrationType: document.inputs.integrationType,
    },
  };
  expect(serializeCouplingAssessment(reordered)).toBe(serializeCouplingAssessment(document));
  expect(() => evaluateCouplingAssessment(extended, context())).toThrow(ZlozCouplingError);
});

test('layout, presentation and workspace-like host data never supply coupling judgments', () => {
  const document = fresh();
  const current = context();
  const decorated: ZlozCouplingContext = {
    ...current,
    graph: {
      ...current.graph,
      nodes: current.graph.nodes.map((node) => ({
        ...node,
        label: `Renamed ${node.label}`,
        position: { x: 40_000, y: -20_000 },
        data: { teamId: 'different-workspace', teamOwnership: 'some-team', editCount: 100_000 },
      })),
    },
  };
  expect(evaluateCouplingAssessment(document, decorated)).toEqual(
    evaluateCouplingAssessment(document, current),
  );
});

// This type annotation also protects the public four-way taxonomy at compile time.
const modelIntegration: ZlozCouplingIntegration = 'model';
void modelIntegration;
