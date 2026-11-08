import { expect, test } from 'bun:test';

import { exportMermaid } from '../src/index.ts';

test('JavaScript callers get structured errors for invalid options and malformed graphs', () => {
  for (const options of [null, 12, [], { direction: 'down' }, { lossPolicy: 'ignore' }]) {
    const result = exportMermaid({ nodes: [], edges: [] }, options);
    expect(result.status).toBe('rejected');
    expect(result.diagnostics[0].code).toBe('invalid-options');
    expect('value' in result).toBe(false);
  }
  for (const graph of [null, {}, { nodes: [], edges: [{ id: 'broken' }] }]) {
    const result = exportMermaid(graph);
    expect(result.status).toBe('rejected');
    expect(result.diagnostics[0].code).toBe('invalid-graph');
    expect('value' in result).toBe(false);
  }
});
