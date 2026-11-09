import { expect, test } from 'bun:test';

import {
  resolveHistoryComparisonControls,
  resolveHistoryComparisonRequest,
  type ZlozHistoryComparisonControlsState,
} from '../src/index';
const editions = [
  { id: 'a', name: 'Original' },
  { id: 'b', name: 'Evolved' },
  { id: 'c', name: 'Review' },
];
const state: ZlozHistoryComparisonControlsState = {
  baselineId: 'a',
  ghosts: { enabled: true, nodes: true, edges: true, movements: true },
};
test('baselines retain identity/order, exclude current and require an explicit clear', () => {
  const context = resolveHistoryComparisonControls(editions, 'b', state);
  expect(context.baseline.choices.map((choice) => choice.editionId)).toEqual(['a', 'c']);
  expect(context.baseline.value).toBe('a');
  expect(context.effectiveGhosts.enabled).toBe(true);
  expect(context.statusText).toContain('Original');
  expect(context.statusText).toContain('Evolved');
  for (const editionId of ['b', 'missing'])
    expect(
      resolveHistoryComparisonRequest(editions, 'b', state, {
        type: 'BaselineSelected',
        editionId,
      }),
    ).toEqual({ type: 'ignored' });
  const clear = resolveHistoryComparisonRequest(editions, 'b', state, {
    type: 'BaselineSelected',
    editionId: null,
  });
  expect(clear.type).toBe('ready');
  if (clear.type === 'ready') {
    expect(clear.state.baselineId).toBeNull();
    expect(clear.state.ghosts).toBe(state.ghosts);
  }
});
test('master/minimal visibility never rewrites independently configurable layer choices', () => {
  const off = resolveHistoryComparisonRequest(editions, 'b', state, {
    type: 'GhostVisibilityToggled',
    part: 'enabled',
  });
  if (off.type !== 'ready') throw new Error('Toggle rejected');
  const nodes = resolveHistoryComparisonRequest(editions, 'b', off.state, {
    type: 'GhostVisibilityChanged',
    part: 'nodes',
    value: false,
  });
  if (nodes.type !== 'ready') throw new Error('Layer rejected');
  const on = resolveHistoryComparisonRequest(editions, 'b', nodes.state, {
    type: 'GhostVisibilityToggled',
    part: 'enabled',
  });
  if (on.type !== 'ready') throw new Error('Enable rejected');
  expect(on.state.ghosts).toEqual({ enabled: true, nodes: false, edges: true, movements: true });
  const minimal = resolveHistoryComparisonControls(editions, 'b', on.state, { minimalMode: true });
  expect(minimal.effectiveGhosts.enabled).toBe(false);
  expect(minimal.reasons.join(' ')).toContain('Minimal mode');
  expect(minimal.ghosts.nodes.reason).toBeNull();
  expect(resolveHistoryComparisonControls(editions, 'b', on.state).effectiveGhosts.enabled).toBe(
    true,
  );
  expect(state.ghosts.nodes).toBe(true);
});
test('individual/global restrictions have visible nonempty reasons and recheck fresh state', () => {
  const context = resolveHistoryComparisonControls(editions, 'b', state, {
    ghostReasons: { edges: 'Managed layer' },
  });
  expect(context.ghosts.edges.reason).toBe('Managed layer');
  expect(context.ghosts.nodes.reason).toBeNull();
  expect(
    resolveHistoryComparisonRequest(editions, 'b', state, context.ghosts.edges.request, {
      ghostReasons: { edges: 'Managed layer' },
    }),
  ).toEqual({ type: 'blocked', reason: 'Managed layer' });
  const blocked = resolveHistoryComparisonControls(editions, 'b', state, { blockedReason: ' ' });
  expect(blocked.reasons.join(' ').length).toBeGreaterThan(0);
  expect(
    resolveHistoryComparisonRequest(
      editions,
      'b',
      state,
      { type: 'BaselineSelected', editionId: 'c' },
      { baselineReason: 'Locked baseline' },
    ),
  ).toEqual({ type: 'blocked', reason: 'Locked baseline' });
});
test('preferences can be configured before review; invalid metadata rejects and labels customize', () => {
  const context = resolveHistoryComparisonControls(editions, null, state);
  expect(context.baseline.reason).not.toBeNull();
  expect(context.effectiveGhosts.enabled).toBe(false);
  expect(context.ghosts.enabled.reason).toBeNull();
  expect(
    resolveHistoryComparisonRequest(editions, 'b', state, {
      type: 'GhostVisibilityChanged',
      part: 'nodes',
      value: true,
    }),
  ).toEqual({ type: 'unchanged' });
  expect(() =>
    resolveHistoryComparisonControls([...editions, { id: 'a', name: 'Duplicate' }], 'b', state),
  ).toThrow();
  expect(
    resolveHistoryComparisonControls(editions, 'b', state, {
      labels: { nodes: 'Shapes' },
      labelEdition: (edition) => `Checkpoint ${edition.name}`,
    }).ghosts.nodes.label,
  ).toBe('Shapes');
});

test('captured toggle requests use fresh preferences and fresh host policy', () => {
  const request = resolveHistoryComparisonControls(editions, 'b', state).ghosts.nodes.request;
  const first = resolveHistoryComparisonRequest(editions, 'b', state, request);
  if (first.type !== 'ready') throw new Error('First toggle rejected');
  const second = resolveHistoryComparisonRequest(editions, 'b', first.state, request);
  if (second.type !== 'ready') throw new Error('Repeated toggle rejected');
  expect(second.state.ghosts).toEqual(state.ghosts);
  expect(
    resolveHistoryComparisonRequest(editions, 'b', first.state, request, {
      ghostReasons: { nodes: 'New policy' },
    }),
  ).toEqual({ type: 'blocked', reason: 'New policy' });
  const stale = { ...state, baselineId: 'removed' };
  const context = resolveHistoryComparisonControls(editions, 'b', stale);
  expect(context.baseline.value).toBeNull();
  expect(context.effectiveGhosts.enabled).toBe(false);
  expect(stale.baselineId).toBe('removed');
  expect(
    resolveHistoryComparisonControls(editions, 'b', state, {
      labelEdition: (edition) => `Checkpoint ${edition.name}`,
    }).baseline.current?.label,
  ).toBe('Checkpoint Original');
});
