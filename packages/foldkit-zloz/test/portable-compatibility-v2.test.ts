import { expect, test } from 'bun:test';

import { assessPortableCompatibilityV2, captureModelDocumentV2 } from '../src/index';

const graph = {
  nodes: ['a', 'b'].map((id) => ({
    id,
    label: id,
    position: { x: 0, y: 0 },
    size: { width: 100, height: 80 },
    ports: [{ id: 'in', kind: 'input' as const, side: 'left' as const, offset: 0.5 }],
  })),
  edges: [{ id: 'loose', source: { node: 'a', port: 'in' }, target: { node: 'b', port: 'in' } }],
};
test('portable capability review checks every checkpoint and never supplies a silent downgrade', () => {
  const model = captureModelDocumentV2({
    id: 'm',
    name: 'Mixed',
    snapshot: { version: 2, connectionMode: 'strict', graph: { ...graph, edges: [] } },
    editions: [
      { id: 'loose', name: 'Loose', snapshot: { version: 2, connectionMode: 'loose', graph } },
    ],
    origin: null,
  });
  const before = JSON.stringify(model);
  const report = assessPortableCompatibilityV2(model);
  expect(report.scope).toBe('format-capability-only');
  expect(report.checkpoints).toEqual([
    { path: '/snapshot', connectionMode: 'strict', strictIncompatibleEdges: [] },
    { path: '/editions/0/snapshot', connectionMode: 'loose', strictIncompatibleEdges: ['loose'] },
  ]);
  expect(report.downgrade.type).toBe('blocked');
  expect(report.adapters.map(({ adapter, status }) => [adapter, status])).toEqual([
    ['layout', 'supported'],
    ['mermaid', 'projection'],
    ['modelling-patch', 'supported'],
    ['conversion-receipt', 'supported'],
    ['review-packet', 'supported'],
    ['relationship-audit', 'supported'],
  ]);
  expect(JSON.stringify(model)).toBe(before);
  expect(Object.isFrozen(report.checkpoints[1]?.strictIncompatibleEdges)).toBe(true);
  expect('document' in report.downgrade).toBe(false);
});

test('origin-only loose authoring is disclosed even when every graph is strict-compatible', () => {
  const snapshot = {
    version: 2 as const,
    connectionMode: 'strict' as const,
    graph: { nodes: [], edges: [] },
  };
  const model = captureModelDocumentV2({
    id: 'fork',
    name: 'Fork',
    snapshot,
    editions: [],
    origin: {
      modelId: 'source',
      modelName: 'Source',
      edition: { id: 'base', name: 'Base', snapshot: { ...snapshot, connectionMode: 'loose' } },
    },
  });
  const report = assessPortableCompatibilityV2(model);
  expect(report.checkpoints.at(-1)).toEqual({
    path: '/origin/edition/snapshot',
    connectionMode: 'loose',
    strictIncompatibleEdges: [],
  });
  expect(report.downgrade).toEqual({
    type: 'reviewable',
    findings: [
      {
        code: 'loose-mode-removed',
        path: '/origin/edition/snapshot',
        reason:
          'A v1 snapshot does not retain loose connection semantics. Review this change to future authoring before explicitly saving the strict snapshot.',
      },
    ],
  });
  expect(() =>
    assessPortableCompatibilityV2({ ...model, snapshot: { ...snapshot, graph } }),
  ).toThrow();
});
