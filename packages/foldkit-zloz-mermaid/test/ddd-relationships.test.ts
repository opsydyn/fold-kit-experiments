import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  captureModelDocument,
  parseModelDocument,
  serializeModelDocument,
  type DddEdgeArchitecture,
  type ZlozGraph,
} from '@opsydyn/foldkit-zloz';

import { createReviewPacket, exportMermaid } from '../src/index';
const architecture: DddEdgeArchitecture = {
  family: 'ddd',
  scope: 'strategic',
  role: 'upstream-downstream',
  upstream: ['open-host-service', 'published-language'],
  downstream: 'anti-corruption-layer',
};
const graph: ZlozGraph = {
  nodes: ['upstream', 'downstream'].map((id, index) => ({
    id,
    label: id,
    position: { x: index * 250, y: 0 },
    size: { width: 200, height: 100 },
    architecture: { family: 'ddd', role: 'bounded-context' },
    ports: [
      { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
      { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
    ],
  })),
  edges: [
    {
      id: 'ddd-link',
      source: { node: 'upstream', port: 'out' },
      target: { node: 'downstream', port: 'in' },
      architecture,
    },
  ],
};
test('model/edition codecs and packets retain DDD meaning while Mermaid discloses loss and causal audit stays scoped', () => {
  const document = captureModelDocument({
    id: 'ddd',
    name: 'Context contract',
    origin: null,
    snapshot: { graph },
    editions: [{ id: 'baseline', name: 'Baseline', snapshot: { graph } }],
  });
  expect(parseModelDocument(serializeModelDocument(document))).toEqual(document);
  const projection = exportMermaid(graph, { lossPolicy: 'report' });
  assert(projection.status === 'converted');
  expect(
    projection.diagnostics.some(
      (item) =>
        item.code === 'edge-fields-omitted' &&
        item.subject === 'ddd-link' &&
        item.dimension === 'semantics' &&
        item.message.includes('architecture'),
    ),
  ).toBe(true);
  expect(exportMermaid(graph).status).toBe('rejected');
  const result = createReviewPacket(document, { baselineId: 'baseline' }, { lossPolicy: 'report' });
  assert(result.status === 'created');
  expect(result.value.selected.snapshot.graph.edges[0]?.architecture).toEqual(architecture);
  expect(result.value.baseline.snapshot.graph.edges[0]?.architecture).toEqual(architecture);
  expect(result.value.comparison.selected.audit.summary).toEqual({
    edges: 1,
    typed: 0,
    inferred: 0,
    unrelated: 1,
    blocked: 0,
  });
  expect(result.value.comparison.summary).toEqual({ introduced: 0, resolved: 0, persisting: 0 });
  const portable = JSON.parse(JSON.stringify(result.value));
  expect(portable.selected.snapshot.graph.edges[0].architecture).toEqual(architecture);
  const strict = createReviewPacket(document, { baselineId: 'baseline' });
  expect(strict.status).toBe('rejected');
});
test('packet convention reader refuses a syntactically valid DDD descriptor in an EventStorming catalogue', () => {
  const document = {
    id: 'ddd',
    name: 'DDD',
    origin: null,
    snapshot: { graph },
    editions: [{ id: 'baseline', name: 'Baseline', snapshot: { graph } }],
  };
  const rule = {
    architecture: { family: 'ddd' as const, scope: 'tactical' as const, role: 'emits' as const },
    sources: ['aggregate' as const],
    targets: ['domain-event' as const],
    label: 'Emits',
  };
  const result = createReviewPacket(
    document,
    { baselineId: 'baseline' },
    {
      lossPolicy: 'report',
      // @ts-expect-error Exercise the family boundary for JavaScript consumers too.
      rules: [rule],
    },
  );
  assert(result.status === 'rejected');
  expect(result.reason).toBe('input');
  expect(result.diagnostics[0]?.code).toBe('invalid-options');
});
