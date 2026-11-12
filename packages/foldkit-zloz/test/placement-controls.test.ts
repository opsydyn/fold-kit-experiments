import { expect, test } from 'bun:test';

import {
  createEditor,
  updatePlacement,
  createPlacement,
  createArchitecturePattern,
  updateEditor,
  updatePlacementControls,
  resolvePlacementControls,
  type ZlozPaletteEntry,
  type ZlozPlacementContext,
  type ZlozPlacementInput,
} from '../src/index';

const entries: readonly ZlozPaletteEntry[] = [
  {
    id: 'c4',
    label: 'C4 context',
    intent: {
      source: { type: 'palette', id: 'c4' },
      fragment: createArchitecturePattern('c4-context'),
      anchor: { x: 30, y: 65 },
      snapping: { grid: true },
    },
  },
];
function fixture() {
  const context: ZlozPlacementContext = {
    scope: 'canvas/session',
    editor: {
      ...createEditor({ nodes: [], edges: [] }),
      surface: { width: 800, height: 600 },
    },
  };
  return { context, placement: createPlacement(context.scope) };
}
test('keyboard palette placement previews, nudges and applies as one Undo, with stale actions rejected', () => {
  const { context, placement } = fixture();
  const started = updatePlacementControls(placement, context, entries, {
    type: 'PaletteEntryActivated',
    scope: context.scope,
    generation: 0,
    id: 'c4',
  });
  expect(started.editor).toBe(context.editor);
  const controls = resolvePlacementControls(started.placement, context, entries);
  expect(controls.preview.type).toBe('ready');
  const nudged = updatePlacementControls(started.placement, context, entries, {
    type: 'PlacementNudged',
    scope: context.scope,
    generation: started.placement.generation,
    delta: { x: 20, y: 0 },
    bypassed: true,
  });
  const applied = updatePlacementControls(nudged.placement, context, entries, {
    type: 'PlacementAccepted',
    targetRevision: 2,
    scope: context.scope,
    generation: nudged.placement.generation,
  });
  expect(applied.editor.graph.nodes[0]?.position).toEqual({ x: 420, y: 300 });
  expect(applied.editor.past).toHaveLength(1);
  expect(updateEditor(applied.editor, { type: 'UndoPressed' }).graph).toEqual(context.editor.graph);
  const replay = updatePlacementControls(
    applied.placement,
    { ...context, editor: applied.editor },
    entries,
    {
      type: 'PlacementAccepted',
      targetRevision: 1,
      scope: context.scope,
      generation: nudged.placement.generation,
    },
  );
  expect(replay.editor).toBe(applied.editor);
});
test('live veto, cancellation, missing entries and scoped callbacks never publish a preview', () => {
  const { context, placement } = fixture();
  const start: ZlozPlacementInput = {
    type: 'PaletteEntryActivated',
    scope: context.scope,
    generation: 0,
    id: 'c4',
  };
  const active = updatePlacementControls(placement, context, entries, start).placement;
  const blocked = updatePlacementControls(
    active,
    context,
    entries,
    {
      type: 'PlacementAccepted',
      targetRevision: 1,
      scope: context.scope,
      generation: active.generation,
    },
    { canPlace: () => 'Workspace protected' },
  );
  expect(blocked.editor).toBe(context.editor);
  expect(blocked.notice).toBe('Workspace protected');
  const cancel = updatePlacementControls(active, context, entries, {
    type: 'PlacementDismissed',
    scope: context.scope,
    generation: active.generation,
  });
  expect(cancel.placement.type).toBe('idle');
  expect(cancel.editor).toBe(context.editor);
  expect(updatePlacementControls(placement, context, [], start).placement).toBe(placement);
  expect(
    updatePlacementControls(placement, { ...context, scope: 'other' }, entries, start).placement,
  ).toBe(placement);
  const locked = resolvePlacementControls(placement, context, entries, {
    canStartPlacement: () => 'Palette locked',
  });
  expect(locked.entries[0]?.reason).toBe('Palette locked');
  expect(
    updatePlacementControls(placement, context, entries, start, {
      canStartPlacement: () => 'Palette locked',
    }).editor,
  ).toBe(context.editor);
});
test('pointer samples normalize to screen, commit only inside measured canvas and retain late veto feedback', () => {
  const { context, placement } = fixture();
  const active = updatePlacementControls(placement, context, entries, {
    type: 'PaletteEntryActivated',
    scope: context.scope,
    generation: 0,
    id: 'c4',
  }).placement;
  const sample = {
    type: 'PlacementPointed',
    scope: context.scope,
    generation: active.generation,
    point: { x: 123, y: 234 },
    bypassed: true,
    commit: true,
  } as const;
  const applied = updatePlacementControls(active, context, entries, sample);
  expect(applied.editor.graph.nodes[0]?.position).toEqual({ x: 123, y: 234 });
  const outside = updatePlacementControls(active, context, entries, {
    ...sample,
    point: { x: -1, y: 10 },
  });
  expect(outside.editor).toBe(context.editor);
  expect(outside.notice).toContain('outside');
  expect(outside.placement.type).toBe('placing');
});

test('an old Apply action cannot accept a newer target, and stale projections cannot be keyboard-rebased', () => {
  const { context, placement } = fixture();
  const active = updatePlacementControls(placement, context, entries, {
    type: 'PaletteEntryActivated',
    scope: context.scope,
    generation: 0,
    id: 'c4',
  }).placement;
  const moved = updatePlacementControls(active, context, entries, {
    type: 'PlacementPointed',
    scope: context.scope,
    generation: active.generation,
    point: { x: 120, y: 220 },
    bypassed: false,
    commit: false,
  }).placement;
  const stale = updatePlacementControls(moved, context, entries, {
    type: 'PlacementAccepted',
    scope: context.scope,
    generation: active.generation,
    targetRevision: 1,
  });
  expect(stale.editor).toBe(context.editor);
  expect(stale.notice).toContain('target changed');
  const zoomed = { ...context, editor: { ...context.editor, viewport: { x: 20, y: 30, zoom: 2 } } };
  const nudged = updatePlacementControls(active, zoomed, entries, {
    type: 'PlacementNudged',
    scope: context.scope,
    generation: active.generation,
    delta: { x: 20, y: 0 },
    bypassed: false,
  });
  expect(nudged.placement).toBe(active);
  expect(nudged.editor).toBe(zoomed.editor);
  expect(nudged.notice).toContain('canvas changed');
});

test('keyboard can leave a policy-rejected destination and respects the intent grid override', () => {
  const { context, placement } = fixture();
  const policy = {
    canPlace: (candidate: { position: { x: number } }) =>
      candidate.position.x === 400 ? 'Centre reserved' : null,
  };
  const active = updatePlacementControls(
    placement,
    context,
    entries,
    { type: 'PaletteEntryActivated', scope: context.scope, generation: 0, id: 'c4' },
    policy,
  ).placement;
  expect(resolvePlacementControls(active, context, entries, policy).preview.type).toBe('blocked');
  expect(resolvePlacementControls(active, context, entries, policy).step).toBe(
    context.editor.gridSpacing,
  );
  const moved = updatePlacementControls(
    active,
    context,
    entries,
    {
      type: 'PlacementNudged',
      scope: context.scope,
      generation: active.generation,
      delta: { x: 20, y: 0 },
      bypassed: false,
    },
    policy,
  );
  expect(resolvePlacementControls(moved.placement, context, entries, policy).preview.type).toBe(
    'ready',
  );
  expect(moved.editor).toBe(context.editor);
});

test('keyboard continues a client-space headless target using its captured live origin', () => {
  const base = fixture();
  const context = {
    ...base.context,
    origin: { x: 300, y: 100 },
    editor: { ...base.context.editor, viewport: { x: 20, y: 30, zoom: 2 } },
  };
  const entry = entries[0];
  if (!entry) throw new Error('Missing fixture');
  const state = updatePlacement(base.placement, context, {
    type: 'PlacementStarted',
    scope: context.scope,
    generation: 0,
    intent: { ...entry.intent, snapping: { grid: false } },
  });
  const positioned = updatePlacement(state, context, {
    type: 'PlacementTargetChanged',
    scope: context.scope,
    generation: state.generation,
    target: { space: 'client', point: { x: 500, y: 350 } },
  });
  const moved = updatePlacementControls(positioned, context, entries, {
    type: 'PlacementNudged',
    scope: context.scope,
    generation: state.generation,
    delta: { x: 20, y: 40 },
    bypassed: true,
  });
  const preview = resolvePlacementControls(moved.placement, context, entries).preview;
  expect(preview.type).toBe('ready');
  if (preview.type !== 'ready') throw new Error('Expected preview');
  expect(preview.position).toEqual({ x: 100, y: 130 });
});
