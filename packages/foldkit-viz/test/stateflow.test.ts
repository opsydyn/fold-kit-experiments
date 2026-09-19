import { describe, expect, it } from 'bun:test';

import { layoutStateFlow } from '../src/stateflow';

const graph = {
  nodes: [
    { id: 'Loading', label: 'Loading', role: 'transient', visitCount: 1 },
    { id: 'Ready', label: 'Ready', role: 'active', visitCount: 2 },
  ],
  edges: [
    {
      id: 'Loading:LoadedMetrics:Ready:When:1',
      source: 'Loading',
      target: 'Ready',
      event: 'LoadedMetrics',
      guard: 'when',
      guardPosition: 1,
      transitionCount: 1,
      lastSeenAt: 1_700_000_000_000,
    },
  ],
} as const;

describe('layoutStateFlow', () => {
  it('returns a deterministic input-ordered layout that retains edge semantics', () => {
    const first = layoutStateFlow(graph, { width: 640, height: 360, iterations: 80 });
    const second = layoutStateFlow(graph, { width: 640, height: 360, iterations: 80 });

    expect(first).toEqual(second);
    expect(first.nodes.map(({ id }) => id)).toEqual(['Loading', 'Ready']);
    expect(first.edges).toHaveLength(1);
    expect(first.edges[0]).toMatchObject({
      source: 'Loading',
      target: 'Ready',
      guard: 'when',
      guardPosition: 1,
    });
    expect(first.edges[0]).toMatchObject({
      x1: expect.any(Number),
      y1: expect.any(Number),
      x2: expect.any(Number),
      y2: expect.any(Number),
    });
  });

  it('rejects an edge whose endpoint is not a graph node', () => {
    expect(() =>
      layoutStateFlow({
        nodes: [{ id: 'Loading', label: 'Loading', role: 'transient', visitCount: 1 }],
        edges: [
          {
            id: 'Loading:Loaded:Ready:Unguarded',
            source: 'Loading',
            target: 'Ready',
            event: 'Loaded',
            guard: 'unguarded',
            transitionCount: 1,
          },
        ],
      }),
    ).toThrow('unknown node');
  });

  it('rejects duplicate edge identifiers instead of overwriting graph data', () => {
    const edge = {
      id: 'Loading:Loaded:Ready:Unguarded',
      source: 'Loading',
      target: 'Ready',
      event: 'Loaded',
      guard: 'unguarded' as const,
      transitionCount: 1,
    };

    expect(() =>
      layoutStateFlow({
        nodes: [
          { id: 'Loading', label: 'Loading', role: 'transient', visitCount: 1 },
          { id: 'Ready', label: 'Ready', role: 'active', visitCount: 2 },
        ],
        edges: [edge, edge],
      }),
    ).toThrow('Duplicate edge ID');
  });
});
