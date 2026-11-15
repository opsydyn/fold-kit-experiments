import { expect, test } from 'bun:test';

import { resolveEdgeWaypointControls, type EditorEvent } from '@opsydyn/foldkit-zloz';

import { workbenchPolicy } from '../src/editor/editor-policy';
import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { update } from '../src/editor/update';

test('waypoint designs are preferences; protection rechecks package edits and Undo restores the graph', () => {
  const original = init().model;
  const send = (model: Model, message: EditorEvent) =>
    update(
      model,
      Message.ObservedModelInput({
        modelId: model.modelIdentity.id,
        epoch: model.modelEpoch,
        message,
      }),
    ).model;
  const context = resolveEdgeWaypointControls(
    original.editor,
    'draft-review',
    workbenchPolicy(original),
  );
  if (!context) throw new Error('Expected starter edge');
  const added = send(original, context.add.event);
  expect(added.editor.past).toHaveLength(1);
  expect(added.editor.graph.edges[0]?.waypoints).toHaveLength(1);
  for (const waypointDesign of ['off', 'native', 'custom'] as const) {
    const preferred = update(added, Message.SelectedWaypointDesign({ waypointDesign })).model;
    expect(preferred.waypointDesign).toBe(waypointDesign);
    expect(preferred.editor).toBe(added.editor);
  }
  const protectedModel = update(added, Message.ClickedWaypointProtection()).model;
  const controls = resolveEdgeWaypointControls(
    protectedModel.editor,
    'draft-review',
    workbenchPolicy(protectedModel),
  );
  expect(controls?.reason).toContain('managed by the architecture team');
  if (!controls) throw new Error('Expected controls');
  const blocked = send(protectedModel, controls.reset.event);
  expect(blocked.editor.graph).toBe(added.editor.graph);
  expect(blocked.editor.past).toBe(added.editor.past);
  expect(send(added, { type: 'UndoPressed' }).editor.graph).toEqual(original.editor.graph);
});
