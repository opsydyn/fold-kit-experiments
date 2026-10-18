import { expect, test } from 'bun:test';

import type { SceneNode } from '@opsydyn/effect-three';

const { Message } = await import('../src/gallery/message');
const { init, update } = await import('../src/gallery/update');
const { measured, sceneFor } = await import('../src/gallery/scene');
const { codeColours, highlight } = await import('../src/gallery/highlight');
const { homeCamera } = await import('../src/gallery/model');

type Model = ReturnType<typeof init>['model'];
const step = (model: Model, message: typeof Message.Type): Model => update(model, message).model;
const start = init().model;

/** The node a key names, wherever it is in the scene's groups. */
const nodeOf = (model: Model, key: string): SceneNode | undefined => {
  const search = (nodes: ReadonlyArray<SceneNode>): SceneNode | undefined => {
    for (const node of nodes) {
      if (node.key === key) return node;
      const found = node._tag === 'Group' ? search(node.children) : undefined;
      if (found !== undefined) return found;
    }
    return undefined;
  };
  return search(sceneFor(model).children);
};

const geometryOf = (node: SceneNode | undefined) =>
  node?._tag === 'Mesh' ? node.geometry : undefined;
const materialOf = (node: SceneNode | undefined) =>
  node?._tag === 'Label' ? node.material : undefined;

test('a plaque’s panel appears once its label is measured, sized to the block with a margin', () => {
  expect(nodeOf(start, 'note:panel')).toBeUndefined();
  const laidOut = step(
    start,
    Message.MeasuredLabel({
      measured: { key: 'note:text', block: [-1, -0.25, 1, 0.25], visible: [-0.9, -0.2, 0.9, 0.2] },
    }),
  );
  const panel = nodeOf(laidOut, 'note:panel');
  expect(geometryOf(panel)).toEqual({ _tag: 'Plane', width: 2.36, height: 0.8 });
  // Every plaque's label is measured.
  expect(sceneFor(start).measure).toEqual(measured);
});

test('clicking a plaque walks up to it; clicking it again, or away, steps back', () => {
  const near = step(start, Message.ClickedPlaque({ id: 'code' }));
  expect(near.focus).toBe('code');
  expect(near.camera).not.toEqual(homeCamera);
  expect(step(near, Message.ClickedPlaque({ id: 'code' })).camera).toEqual(homeCamera);
  expect(step(near, Message.ClickedAway()).focus).toBeNull();
  expect(step(start, Message.ClickedPlaque({ id: 'nothing' })).focus).toBeNull();
});

test('lights off gives the labels troika’s own material; notes are kept short', () => {
  const dark = step(start, Message.ToggledLights());
  expect(materialOf(nodeOf(dark, 'title'))).toBeNull();
  expect(materialOf(nodeOf(start, 'title'))).toBeTruthy();
  expect(step(start, Message.ChangedNote({ note: 'x'.repeat(200) })).note).toHaveLength(90);
});

test('the highlighter colours calls, properties, strings and punctuation, then returns to plain', () => {
  const ranges = highlight("label({ key: 'a' })");
  const at = (index: number) => ranges.filter((range) => range.start <= index).at(-1)?.color;
  expect(at(0)).toBe(codeColours.call);
  expect(at(5)).toBe(codeColours.punctuation);
  expect(at(8)).toBe(codeColours.property);
  expect(at(13)).toBe(codeColours.string);
});
