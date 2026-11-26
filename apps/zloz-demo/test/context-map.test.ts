import { createContextMapPattern, resolveContextMapRelationship } from '@opsydyn/foldkit-zloz';
import { expect, test } from 'vitest';

import { workbenchPolicy } from '../src/editor/editor-policy';
import { Message } from '../src/editor/message';
import { init } from '../src/editor/model';
import { update } from '../src/editor/update';
test('context starter consumes the public graph and enables composable policy, while presentation is a non-editing preference', () => {
  const original = init().model;
  const model = update(original, Message.SelectedExample({ example: 'context-map' })).model;
  expect(model.editor.graph).toEqual(createContextMapPattern());
  expect(model.nodeDesign).toBe('ddd');
  expect(model.semanticRelationships).toBe(true);
  const toggled = update(model, Message.ClickedContextMapPresentation()).model;
  expect(toggled.contextMapPresentation).toBe(false);
  expect(toggled.editor).toBe(model.editor);
  expect(toggled.editions).toBe(model.editions);
  const edge = model.editor.graph.edges[0];
  if (!edge) throw new Error('Missing edge');
  const next = { ...edge, target: { node: 'orders', port: 'in-top' } };
  expect(workbenchPolicy(model).canConnect?.(next, model.editor.graph)).toContain('distinct');
  for (const connection of model.editor.graph.edges)
    expect(resolveContextMapRelationship(model.editor.graph, connection)?.reason).toBeNull();
});
test('context insertion retains prior content and Undo; disabling presentation is independent of minimal/diagnostic settings', () => {
  const original = init().model;
  const inserted = update(original, Message.ClickedInsertPattern({ pattern: 'context-map' })).model;
  expect(inserted.editor.graph.nodes).toHaveLength(original.editor.graph.nodes.length + 4);
  expect(inserted.editor.past).toEqual([original.editor.graph]);
  const hidden = { ...inserted, minimalMode: true, diagnosticsEnabled: false };
  const toggled = update(hidden, Message.ClickedContextMapPresentation()).model;
  expect(toggled.contextMapPresentation).toBe(false);
  expect(toggled.minimalMode).toBe(true);
  expect(toggled.diagnosticsEnabled).toBe(false);
  expect(toggled.editor).toBe(hidden.editor);
  const undone = update(
    toggled,
    Message.ObservedZlozInput({ message: { type: 'UndoPressed' } }),
  ).model;
  expect(undone.editor.graph).toEqual(original.editor.graph);
});
