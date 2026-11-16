import { expect, test } from 'bun:test';

import { captureGroupDocumentV3 } from '@opsydyn/foldkit-zloz';

import wire from '../../foldkit-zloz/test/fixtures/group-document-v3-ported.json';
import { exportGroupMermaidV3 } from '../src/index';
const document = () => captureGroupDocumentV3(wire);
test('native group endpoints project as subgraph links with explicit socket losses and native identity, never a legacy downgrade', () => {
  const input = document(),
    before = JSON.stringify(input);
  expect(exportGroupMermaidV3(input).status).toBe('rejected');
  const result = exportGroupMermaidV3(input, { lossPolicy: 'report' });
  expect(result.status).toBe('converted');
  if (result.status !== 'converted') throw new Error('Expected projection');
  expect(result.value.protocol).toBe('foldkit-zloz-mermaid/v3');
  expect(result.value.coordinateSpace).toBe('world');
  expect(result.value.capabilities).toEqual({ groupPorts: true });
  expect(result.value.connectionMode).toBe('strict');
  expect(result.value.source).toBe(
    'flowchart LR\n  subgraph n_67["Boundary"]\n    n_63_68_69_6c_64["Child"]\n  end\n  n_62["Other system"]\n  n_67 e_62_6f_75_6e_64_61_72_79_2d_6c_69_6e_6b@--> n_62\n',
  );
  expect(result.value.identity.version).toBe(3);
  expect(result.value.identity.nodes[1]).toEqual({
    mermaidId: 'n_67',
    nodeId: 'g',
    kind: 'group',
    ports: [{ id: 'out', kind: 'output' }],
  });
  expect(result.value.identity.nodes[0]?.parentId).toBe('g');
  expect(result.value.identity.edges[0]).toMatchObject({
    edgeId: 'boundary-link',
    sourceNode: 'n_67',
    sourcePort: 'out',
    targetNode: 'n_62',
    targetPort: 'in',
  });
  expect(result.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: 'group-port-details-omitted',
        subject: 'g',
        severity: 'loss',
      }),
      expect.objectContaining({
        code: 'group-port-attachment-omitted',
        subject: 'boundary-link',
        severity: 'loss',
      }),
      expect.objectContaining({ code: 'group-capability-omitted', severity: 'loss' }),
      expect.objectContaining({ code: 'viewport-omitted', severity: 'loss' }),
    ]),
  );
  expect(Object.isFrozen(result.value.identity.nodes[1]?.ports)).toBe(true);
  expect(JSON.stringify(input)).toBe(before);
});
test('native loose mode preserves ordered same-kind endpoints and reports future-rule omission', () => {
  const source = document(),
    loose = captureGroupDocumentV3({
      ...source,
      connectionMode: 'loose',
      graph: {
        ...source.graph,
        nodes: source.graph.nodes.map((n) => ({
          ...n,
          ports: n.ports.map((p) => ({ ...p, kind: 'input' })),
        })),
      },
    });
  const result = exportGroupMermaidV3(loose, { direction: 'TB', lossPolicy: 'report' });
  expect(result.status).toBe('converted');
  if (result.status !== 'converted') throw new Error('Expected loose export');
  expect(result.value.connectionMode).toBe('loose');
  expect(result.value.source).toStartWith('flowchart TB\n');
  expect(result.value.identity.edges[0]?.sourcePort).toBe('out');
  expect(result.diagnostics.some((d) => d.code === 'connection-mode-omitted')).toBe(true);
  expect(
    exportGroupMermaidV3({ ...loose, connectionMode: 'strict' }, { lossPolicy: 'report' }).status,
  ).toBe('rejected');
});
test('errors never become consentable losses: disabled capability, empty groups, invalid labels, options and source budget', () => {
  const source = document();
  const cases = [
    { ...source, capabilities: { groupPorts: false } },
    {
      ...source,
      graph: { ...source.graph, nodes: source.graph.nodes.filter((n) => n.id !== 'child') },
    },
    {
      ...source,
      graph: {
        ...source.graph,
        nodes: source.graph.nodes.map((n) => (n.id === 'g' ? { ...n, label: 'fa:invalid' } : n)),
      },
    },
  ];
  for (const input of cases) {
    const result = exportGroupMermaidV3(input, { lossPolicy: 'report' });
    expect(result.status).toBe('rejected');
    expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true);
    expect('value' in result).toBe(false);
  }
  const long = {
    ...source,
    graph: {
      ...source.graph,
      nodes: source.graph.nodes.map((n) => ({ ...n, label: 'x'.repeat(12000) })),
    },
  };
  expect(
    exportGroupMermaidV3(long, { lossPolicy: 'report' }).diagnostics.some(
      (d) => d.code === 'source-limit',
    ),
  ).toBe(true);
  let calls = 0;
  const options = Object.defineProperty({}, 'direction', {
    enumerable: true,
    get() {
      calls++;
      return 'LR';
    },
  });
  expect(exportGroupMermaidV3(source, options).diagnostics[0]?.code).toBe('invalid-options');
  expect(calls).toBe(0);
});
