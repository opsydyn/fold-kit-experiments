import { expect, test } from 'bun:test';

import { exportConnectionMermaid, exportMermaid } from '../src/index';
const graph = {
  nodes: ['a', 'b'].map((id) => ({
    id,
    label: id,
    position: { x: 0, y: 0 },
    size: { width: 100, height: 80 },
    ports: [{ id: 'p', kind: 'input' as const, side: 'left' as const, offset: 0.5 }],
  })),
  edges: [{ id: 'e', source: { node: 'a', port: 'p' }, target: { node: 'b', port: 'p' } }],
};
test('v2 projection preserves ordered loose endpoints and explicit bundle mode, with source-only semantic loss', () => {
  const doc = { version: 2 as const, connectionMode: 'loose' as const, graph };
  expect(exportMermaid(graph, { lossPolicy: 'report' }).status).toBe('rejected');
  const rejected = exportConnectionMermaid(doc);
  expect(rejected.status).toBe('rejected');
  expect(rejected.diagnostics.map((d) => d.code)).toContain('connection-mode-omitted');
  const result = exportConnectionMermaid(doc, { lossPolicy: 'report' });
  expect(result.status).toBe('converted');
  if (result.status !== 'converted') throw new Error('Expected projection');
  expect(result.value.protocol).toBe('foldkit-zloz-mermaid/v2');
  expect(result.value.connectionMode).toBe('loose');
  expect(result.value.identity.edges[0]).toEqual({
    mermaidId: 'e_65',
    flowId: 'e',
    sourceNode: 'n_61',
    sourcePort: 'p',
    targetNode: 'n_62',
    targetPort: 'p',
  });
  expect(
    exportConnectionMermaid({ ...doc, connectionMode: 'strict' }, { lossPolicy: 'report' }).status,
  ).toBe('rejected');
});
