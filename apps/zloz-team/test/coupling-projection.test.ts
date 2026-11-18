import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { createOperationDocument, parseGraph, type ZlozEdge } from '@opsydyn/foldkit-zloz';
import type { AssessmentRecord } from '@opsydyn/foldkit-zloz-alchemy/assessment';
import { isDiagramFrame, type DiagramFrame } from '@opsydyn/foldkit-zloz-alchemy/session';
import {
  parseCouplingAssessment,
  type ZlozCouplingAssessment,
} from '@opsydyn/foldkit-zloz/coupling';

import graphFixture from '../../../packages/foldkit-zloz/test/fixtures/operations-v1.json';
import { projectCoupling } from '../src/editor/coupling-projection';
import * as Editor from '../src/editor/main';
import { liveFrames } from '../src/editor/protocol';
import fixture from './fixtures/coupling-projection-v1.json';

const assessment = parseCouplingAssessment(JSON.stringify(fixture.assessment));
const base: DiagramFrame = {
  target: { teamId: 'team-a', diagramId: 'diagram-a' },
  sourceVersion: 11,
  document: {
    ...createOperationDocument(
      parseGraph(JSON.stringify({ version: 1, graph: graphFixture.graph })),
    ),
    version: 7,
  },
  coverage: [],
};
const documentWithEdges = (edges: readonly ZlozEdge[]) => ({
  ...createOperationDocument({ ...base.document.graph, edges }),
  version: 7,
});
const record = (value: ZlozCouplingAssessment = assessment): AssessmentRecord => ({
  revision: 3,
  authoredBy: 'author-a',
  operationId: 'assessment-op-3',
  assessment: value,
});
function ready(frame: DiagramFrame = { ...base, assessments: [record()] }) {
  assert(isDiagramFrame(frame), 'Fixture must cross the real frame validator');
  const result = projectCoupling(frame);
  assert(result.status === 'ready', 'A validated confirmed frame must project ready data');
  return result;
}
const zero = {
  total: 0,
  'complementary-balance': 0,
  'low-volatility-balance': 0,
  imbalance: 0,
  unknown: 0,
  stale: 0,
  'invalid-binding': 0,
  'not-started': 0,
};

test('no confirmed frame is waiting, distinct from a loaded empty graph or legacy unassessed graph', () => {
  expect(projectCoupling(null)).toEqual({ status: 'waiting' });
  const empty = ready({ ...base, document: createOperationDocument({ nodes: [], edges: [] }) });
  expect(empty).toEqual({
    status: 'ready',
    stamp: { target: base.target, sourceVersion: 11, graphVersion: 0 },
    rows: [],
    readiness: zero,
    cohorts: [],
    removed: [],
  });
  const legacy = ready(base);
  expect(legacy.readiness).toEqual({ ...zero, total: 2, 'not-started': 2 });
  expect(legacy.rows.map((row) => [row.relationshipId, row.state])).toEqual([
    ['ab', 'not-started'],
    ['cb', 'not-started'],
  ]);
  expect(legacy.cohorts).toEqual([]);
  expect(ready({ ...base, assessments: [] })).toEqual(legacy);
});

for (const integrationType of ['intrusive', 'functional', 'model', 'contract'] as const) {
  for (const expected of fixture.cases) {
    test(`${integrationType}: ${expected.strength}/${expected.distance}/${expected.volatility} preserves the literal qualitative oracle`, () => {
      // Expected outcomes are literal fixture data; never computed with evaluator arithmetic.
      const value = parseCouplingAssessment(
        JSON.stringify({
          ...fixture.assessment,
          inputs: {
            ...fixture.assessment.inputs,
            integrationType: {
              ...fixture.assessment.inputs.integrationType,
              value: integrationType,
            },
            strength: { ...fixture.assessment.inputs.strength, value: expected.strength },
            distance: { ...fixture.assessment.inputs.distance, value: expected.distance },
            volatility: { ...fixture.assessment.inputs.volatility, value: expected.volatility },
          },
        }),
      );
      const projection = ready({ ...base, assessments: [record(value)] });
      const row = projection.rows.find((row) => row.relationshipId === 'ab');
      assert(row && row.state !== 'not-started');
      assert.deepEqual(row, {
        relationshipId: 'ab',
        relationship: base.document.graph.edges[0],
        sourceLabel: 'Alpha',
        targetLabel: 'Beta',
        state: expected.state,
        integrationType,
        record: record(value),
        cohort: {
          key: '["balanced-coupling-binary/v1","C4 containers","Next quarter"]',
          modelVersion: 'balanced-coupling-binary/v1',
          abstraction: 'C4 containers',
          horizon: 'Next quarter',
        },
        result: {
          modelVersion: assessment.modelVersion,
          target: value.target,
          scope: value.scope,
          status: expected.status,
          pattern: expected.pattern,
          basis: expected.basis,
        },
      });
      expect(projection.readiness).toEqual({
        ...zero,
        total: 2,
        'not-started': 1,
        [expected.state]: 1,
      });
      expect(projection.cohorts).toEqual([
        {
          cohort: row.cohort,
          rows: [row],
          readiness: { ...zero, total: 1, [expected.state]: 1 },
        },
      ]);
    });
  }
}

for (const field of ['integrationType', 'strength', 'distance', 'volatility'] as const) {
  test(`unknown ${field} stays unassessed even where the Boolean formula could short circuit`, () => {
    const value: ZlozCouplingAssessment = {
      ...assessment,
      inputs: {
        ...assessment.inputs,
        [field]: { status: 'unknown', reason: `No ${field} evidence` },
      },
    };
    const row = ready({ ...base, assessments: [record(value)] }).rows.find(
      (row) => row.relationshipId === 'ab',
    );
    expect(row).toMatchObject({
      state: 'unknown',
      record: record(value),
      integrationType: field === 'integrationType' ? null : 'model',
      result: { status: 'unassessed', missing: [field] },
    });
    expect(ready({ ...base, assessments: [record(value)] }).readiness).toEqual({
      ...zero,
      total: 2,
      unknown: 1,
      'not-started': 1,
    });
  });
}

test('stale graph pins and invalid document/endpoints remain distinct, without repairing evidence', () => {
  for (const change of [
    {
      target: { ...assessment.target, graphVersion: 6 },
      state: 'stale',
      code: 'graph-version-mismatch',
    },
    {
      target: { ...assessment.target, graphVersion: 8 },
      state: 'stale',
      code: 'graph-version-mismatch',
    },
    {
      target: { ...assessment.target, documentId: 'another-diagram' },
      state: 'invalid-binding',
      code: 'document-mismatch',
    },
    {
      target: { ...assessment.target, sourceNodeId: 'c' },
      state: 'invalid-binding',
      code: 'endpoint-mismatch',
    },
    {
      target: { ...assessment.target, targetNodeId: 'a' },
      state: 'invalid-binding',
      code: 'endpoint-mismatch',
    },
  ]) {
    const value = { ...assessment, target: change.target };
    const projection = ready({ ...base, assessments: [record(value)] });
    expect(projection.rows.find((row) => row.relationshipId === 'ab')).toMatchObject({
      state: change.state,
      record: record(value),
      result: { status: 'rejected', code: change.code },
    });
    expect(projection.readiness).toEqual({
      ...zero,
      total: 2,
      'not-started': 1,
      [change.state]: 1,
    });
  }
  const moved = ready({
    ...base,
    document: {
      ...base.document,
      version: 8,
      graph: {
        ...base.document.graph,
        nodes: base.document.graph.nodes.map((node) => ({
          ...node,
          position: { x: node.position.x + 10, y: node.position.y },
        })),
      },
    },
    assessments: [record()],
  });
  expect(moved.rows.find((row) => row.relationshipId === 'ab')).toMatchObject({ state: 'stale' });
});

test('current-edge coverage partitions exactly; removed records never inflate its denominator', () => {
  const ids = [
    'complementary',
    'pragmatic',
    'imbalanced',
    'unknown',
    'stale',
    'invalid',
    'missing',
  ];
  const edges = ids.map((id) => ({ ...base.document.graph.edges[0]!, id }));
  const forEdge = (id: string, value: ZlozCouplingAssessment = assessment) =>
    record({ ...value, target: { ...value.target, relationshipId: id } });
  const projection = ready({
    ...base,
    document: documentWithEdges(edges),
    assessments: [
      forEdge('complementary'),
      forEdge('pragmatic', {
        ...assessment,
        inputs: {
          ...assessment.inputs,
          distance: {
            status: 'known',
            value: 'high',
            basis: 'declared',
            rationale: 'Synthetic distant teams',
          },
          volatility: {
            status: 'known',
            value: 'low',
            basis: 'observed',
            rationale: 'Synthetic stable requirement',
          },
        },
      }),
      forEdge('imbalanced', {
        ...assessment,
        inputs: {
          ...assessment.inputs,
          distance: {
            status: 'known',
            value: 'high',
            basis: 'declared',
            rationale: 'Synthetic distant teams',
          },
        },
      }),
      forEdge('unknown', {
        ...assessment,
        inputs: {
          ...assessment.inputs,
          integrationType: { status: 'unknown', reason: 'Need team input' },
          distance: { status: 'unknown', reason: 'Need co-evolution evidence' },
        },
      }),
      forEdge('stale', { ...assessment, target: { ...assessment.target, graphVersion: 6 } }),
      forEdge('invalid', { ...assessment, target: { ...assessment.target, documentId: 'wrong' } }),
      forEdge('removed'),
    ],
  });
  expect(projection.readiness).toEqual({
    total: 7,
    'complementary-balance': 1,
    'low-volatility-balance': 1,
    imbalance: 1,
    unknown: 1,
    stale: 1,
    'invalid-binding': 1,
    'not-started': 1,
  });
  expect(projection.rows.map((row) => row.relationshipId)).toEqual([
    'complementary',
    'imbalanced',
    'invalid',
    'pragmatic',
    'stale',
    'unknown',
    'missing',
  ]);
  expect(projection.rows.find((row) => row.relationshipId === 'unknown')).toMatchObject({
    result: { missing: ['integrationType', 'distance'] },
  });
  expect(projection.cohorts[0]?.readiness).toEqual({
    total: 6,
    'complementary-balance': 1,
    'low-volatility-balance': 1,
    imbalance: 1,
    unknown: 1,
    stale: 1,
    'invalid-binding': 1,
    'not-started': 0,
  });
  expect(projection.removed).toEqual([
    {
      state: 'removed',
      relationshipId: 'removed',
      record: forEdge('removed'),
      integrationType: 'model',
      cohort: projection.cohorts[0]?.cohort,
    },
  ]);
  const onlyRemoved = ready({
    ...base,
    document: createOperationDocument({ nodes: [], edges: [] }),
    assessments: [forEdge('removed')],
  });
  expect(onlyRemoved.readiness).toEqual(zero);
  expect(onlyRemoved.cohorts).toEqual([]);
  expect(onlyRemoved.removed.map((row) => row.relationshipId)).toEqual(['removed']);
});

test('cohorts use exact scope/horizon/model tuples, without trimming, case folding or separator collisions', () => {
  const scopes = [
    { abstraction: 'C4', horizon: 'quarter' },
    { abstraction: 'c4', horizon: 'quarter' },
    { abstraction: 'C4 ', horizon: 'quarter' },
    { abstraction: 'C4', horizon: 'Quarter' },
    { abstraction: 'C4|quarter', horizon: 'year' },
    { abstraction: 'C4', horizon: 'quarter|year' },
    { abstraction: 'C4', horizon: 'quarter' },
  ];
  const edges = scopes.map((_, index) => ({
    ...base.document.graph.edges[0]!,
    id: `edge-${index}`,
  }));
  const assessments = scopes.map((scope, index) =>
    record({
      ...assessment,
      scope,
      target: { ...assessment.target, relationshipId: `edge-${index}` },
    }),
  );
  const frame = {
    ...base,
    document: documentWithEdges(edges),
    assessments,
  };
  const projection = ready(frame);
  expect(
    projection.cohorts.map((group) => [
      group.cohort.abstraction,
      group.cohort.horizon,
      group.rows.map((row) => row.relationshipId),
    ]),
  ).toEqual([
    ['C4', 'Quarter', ['edge-3']],
    ['C4', 'quarter', ['edge-0', 'edge-6']],
    ['C4', 'quarter|year', ['edge-5']],
    ['C4 ', 'quarter', ['edge-2']],
    ['C4|quarter', 'year', ['edge-4']],
    ['c4', 'quarter', ['edge-1']],
  ]);
  expect(new Set(projection.cohorts.map((group) => group.cohort.key)).size).toBe(6);
  for (const group of projection.cohorts) {
    expect(JSON.parse(group.cohort.key)).toEqual([
      'balanced-coupling-binary/v1',
      group.cohort.abstraction,
      group.cohort.horizon,
    ]);
    expect(group.readiness).toEqual({
      ...zero,
      total: group.rows.length,
      'complementary-balance': group.rows.length,
    });
  }
});

test('taxonomy then relationship identity define stable ordering, independent of labels, input order, revisions or balance', () => {
  const ids = [
    'contract',
    'model-b',
    'functional',
    'intrusive',
    'model-a',
    'unknown',
    'missing',
    '__proto__',
  ];
  const edges = ids.map((id) => ({ ...base.document.graph.edges[0]!, id }));
  const assessments = edges
    .filter((edge) => edge.id !== 'missing')
    .map((edge) =>
      record(
        parseCouplingAssessment(
          JSON.stringify({
            ...assessment,
            target: { ...assessment.target, relationshipId: edge.id },
            inputs: {
              ...assessment.inputs,
              integrationType:
                edge.id === 'unknown'
                  ? { status: 'unknown', reason: 'No category evidence' }
                  : {
                      status: 'known',
                      value:
                        edge.id === '__proto__' || edge.id.startsWith('model') ? 'model' : edge.id,
                      basis: 'declared',
                      rationale: 'Synthetic taxonomy fixture',
                    },
            },
          }),
        ),
      ),
    );
  const frame = {
    ...base,
    document: documentWithEdges(edges),
    assessments,
  };
  const projection = ready(frame);
  expect(projection.rows.map((row) => row.relationshipId)).toEqual([
    'intrusive',
    'functional',
    '__proto__',
    'model-a',
    'model-b',
    'contract',
    'unknown',
    'missing',
  ]);
  expect(
    ready({
      ...frame,
      document: {
        ...frame.document,
        graph: { ...frame.document.graph, edges: [...edges].reverse() },
      },
      assessments: [...assessments].reverse(),
    }),
  ).toEqual(projection);
  const changed = {
    ...assessments[0]!,
    revision: 4,
    authoredBy: 'author-b',
    operationId: 'new-op',
    assessment: {
      ...assessments[0]!.assessment,
      inputs: {
        ...assessment.inputs,
        distance: {
          status: 'known' as const,
          value: 'high' as const,
          basis: 'observed' as const,
          rationale: 'Changed judgment now gives tight coupling',
        },
        integrationType: {
          status: 'known' as const,
          value: 'contract' as const,
          basis: 'observed' as const,
          rationale: 'Updated evidence, same category',
        },
      },
    },
  };
  const updated = ready({
    ...frame,
    sourceVersion: 12,
    assessments: [...assessments.slice(1), changed],
  });
  expect(updated.rows.map((row) => row.relationshipId)).toEqual(
    projection.rows.map((row) => row.relationshipId),
  );
  expect(updated.rows.find((row) => row.relationshipId === 'contract')).toMatchObject({
    record: changed,
    state: 'imbalance',
    result: { status: 'imbalanced', pattern: 'tight-coupling', basis: 'matching-dimensions' },
  });
  expect(updated.stamp).toEqual({ target: base.target, sourceVersion: 12, graphVersion: 7 });
});

test('projection keeps every current relationship at the supported 500-edge bound; paging belongs to the later view', () => {
  const edges = Array.from({ length: 500 }, (_, index) => ({
    ...base.document.graph.edges[0]!,
    id: `edge-${String(index).padStart(3, '0')}`,
  }));
  const assessments = edges.slice(0, 480).map((edge, index) => {
    const example = fixture.cases[index % 8]!;
    return record(
      parseCouplingAssessment(
        JSON.stringify({
          ...fixture.assessment,
          target: { ...fixture.assessment.target, relationshipId: edge.id },
          inputs: {
            ...fixture.assessment.inputs,
            strength: { ...fixture.assessment.inputs.strength, value: example.strength },
            distance: { ...fixture.assessment.inputs.distance, value: example.distance },
            volatility: { ...fixture.assessment.inputs.volatility, value: example.volatility },
          },
        }),
      ),
    );
  });
  const projection = ready({ ...base, document: documentWithEdges(edges), assessments });
  expect(projection.rows.length).toBe(500);
  expect(new Set(projection.rows.map((row) => row.relationshipId)).size).toBe(500);
  expect(projection.readiness).toEqual({
    total: 500,
    'complementary-balance': 240,
    'low-volatility-balance': 120,
    imbalance: 120,
    unknown: 0,
    stale: 0,
    'invalid-binding': 0,
    'not-started': 20,
  });
  expect(projection.cohorts[0]?.rows.length).toBe(480);
  expect(projection.removed).toEqual([]);
});

function freeze<T>(value: T): T {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Test-only recursive traversal of the known JSON fixture, not domain input validation.
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
test('projection is deterministic, preserves all evidence and never mutates even deeply frozen frames', () => {
  const frame = freeze({ ...base, assessments: [record()] });
  const before = JSON.stringify(frame);
  expect(ready(frame)).toEqual(ready(structuredClone(frame)));
  expect(JSON.stringify(frame)).toBe(before);
  const row = ready(frame).rows.find((row) => row.relationshipId === 'ab');
  assert(row && row.state !== 'not-started');
  expect(row.record).toEqual(record());
  assert.deepEqual(row.record.assessment.inputs, fixture.assessment.inputs);
});

test('the production editor and wire boundary reject malformed/future frames and retain the last confirmed projection', () => {
  const props = {
    ...base.target,
    actorId: 'author-a',
    role: 'owner' as const,
    name: 'Synthetic projection qualification',
  };
  const started = Editor.update(
    Editor.init(props).model,
    Editor.Message.SucceededIdentity({ generation: 'tab-a' }),
  ).model;
  const room = started.room;
  const good = { ...base, assessments: [record()] };
  const live = Editor.update(
    started,
    Editor.Message.ObservedFrame({ room, run: 0, frame: good }),
  ).model;
  const before = projectCoupling(live.session.confirmed);
  assert(before.status === 'ready');
  const malformed: unknown[] = [
    { ...good, assessments: [{ ...record(), revision: 0 }] },
    { ...good, assessments: [record(), record()] },
    {
      ...good,
      assessments: [
        {
          ...record(),
          assessment: {
            ...assessment,
            inputs: {
              ...assessment.inputs,
              integrationType: {
                status: 'known',
                value: 'other',
                basis: 'declared',
                rationale: 'Invalid category',
              },
            },
          },
        },
      ],
    },
    {
      ...good,
      assessments: [{ ...record(), assessment: { ...assessment, version: 2 } }],
    },
    {
      ...good,
      assessments: [
        {
          ...record(),
          assessment: {
            ...assessment,
            modelVersion: 'balanced-coupling-binary/v2',
          },
        },
      ],
    },
    { ...good, document: { ...good.document, version: -1 } },
    { ...good, sourceVersion: -1 },
  ];
  for (const frame of malformed) {
    expect(isDiagramFrame(frame)).toBe(false);
    expect(liveFrames(JSON.stringify({ _tag: 'Chunk', values: [{ state: frame }] }))).toEqual([]);
    expect(Editor.update(live, Editor.Message.ObservedFrame({ room, run: 0, frame })).model).toBe(
      live,
    );
    expect(
      Editor.update(started, Editor.Message.ObservedFrame({ room, run: 0, frame })).model.session
        .confirmed,
    ).toBeNull();
    expect(
      Editor.update(live, Editor.Message.SucceededSnapshot({ room, frame, role: 'owner' })).model,
    ).toBe(live);
    expect(projectCoupling(live.session.confirmed)).toEqual(before);
  }
  expect(liveFrames(JSON.stringify({ _tag: 'Chunk', values: [{ state: good }] }))).toEqual([good]);
});
