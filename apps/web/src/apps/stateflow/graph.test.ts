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

  it('counts and dates each edge by the trace up to the scrubber only', () => {
    const graph = graphFor({ ...initModel, cursor: 2 });
    const loaded = graph.edges.find((edge) => edge.event === 'LoadedMetrics');
    const cleared = graph.edges.filter((edge) => edge.event === 'ClearedSelection');

    expect(loaded).toMatchObject({ transitionCount: 1, lastSeenAt: 1 });
    expect(cleared.every((edge) => edge.transitionCount === 0)).toBe(true);
    expect(graph.nodes.find((node) => node.id === 'Selecting')?.role).toBe('active');
  });
});
