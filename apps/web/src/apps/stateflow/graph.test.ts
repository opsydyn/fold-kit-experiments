import { describe, expect, it } from 'vitest';

import { diagnosticsMachine } from '../request-diagnostics/machine';
import { graphFor } from './graph';
import { initModel } from './model';

describe('stateflow graph adapter', () => {
  it('maps every machine state and edge with guard metadata', () => {
    const graph = graphFor(initModel);

    expect(graph.nodes).toHaveLength(diagnosticsMachine.stateTags.length);
    expect(graph.edges).toHaveLength(diagnosticsMachine.edges.length);
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ guard: 'when', guardPosition: 0 }),
        expect.objectContaining({ guard: 'otherwise', guardPosition: 1 }),
      ]),
    );
  });
});
