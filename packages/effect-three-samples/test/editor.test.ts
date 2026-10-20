import { expect, test } from 'bun:test';

import { History, scene, SceneFile } from '@opsydyn/effect-three';

import { placementOf } from '../src/editor/document';
import { Message } from '../src/editor/message';
import { init } from '../src/editor/model';
import { update } from '../src/editor/update';

type Model = ReturnType<typeof init>['model'];
const step = (model: Model, message: typeof Message.Type): Model => update(model, message).model;
const start = init().model;
const keys = (model: Model) => model.nodes.map((node) => node.key);
const at = (model: Model, key: string) =>
  placementOf(model.nodes.find((node) => node.key === key) ?? model.nodes[0]!).position;

/** A ray from straight above, down onto `(x, z)`. */
const down = (x: number, z: number) => ({
  origin: [x, 10, z] as const,
  direction: [0, -1, 0] as const,
});

test('adding puts a new node in the scene, selected, as a step', () => {
  const added = step(start, Message.ClickedAdd({ kind: 'cone' }));
  expect(keys(added)).toEqual(['crate-1', 'ball-1', 'light-1', 'cone-1']);
  expect(added.selected).toEqual(['cone-1']);
  expect(History.presentEntry(added.history).label).toBe('Added cone-1');
  expect(keys(step(added, Message.ClickedAdd({ kind: 'cone' })))).toContain('cone-2');
});

test('a click picks the node it is on, a light by its marker; staging picks nothing', () => {
  expect(step(start, Message.ClickedScene({ key: 'ball-1', path: [] })).selected).toEqual([
    'ball-1',
  ]);
  expect(step(start, Message.ClickedScene({ key: 'marker:light-1', path: [] })).selected).toEqual([
    'light-1',
  ]);
  expect(step(start, Message.ClickedScene({ key: 'editor:floor', path: [] })).selected).toEqual(
    start.selected,
  );
  expect(step(start, Message.ClickedNothing()).selected).toEqual([]);
});

test('duplicate copies the selection beside itself; delete removes it; both undo', () => {
  const copied = step(start, Message.ClickedDuplicate());
  expect(copied.selected).toEqual(['crate-2']);
  expect(at(copied, 'crate-2')[0]).toBeCloseTo(at(start, 'crate-1')[0] + 1, 9);
  const deleted = step(copied, Message.ClickedDelete());
  expect(keys(deleted)).toEqual(['crate-1', 'ball-1', 'light-1']);
  expect(keys(step(deleted, Message.ClickedUndo()))).toContain('crate-2');
});

test('the gizmo moves the selection, lights included, alike', () => {
  const both = { ...start, selected: ['crate-1', 'light-1'] };
  const [x = 0, , z = 0] = at(both, 'crate-1');
  const pressed = step(both, Message.PressedScene({ key: 'gizmo:x:tip', path: [], ...down(x, z) }));
  const dragged = step(pressed, Message.DraggedScene(down(x + 2, z)));
  const moved = step(dragged, Message.ReleasedScene());
  expect(at(moved, 'crate-1')[0]).toBeCloseTo(x + 2, 5);
  expect(at(moved, 'light-1')[0]).toBeCloseTo(at(start, 'light-1')[0] + 2, 5);
  expect(History.presentEntry(moved.history).label).toBe('Moved crate-1, light-1');
});

test('the inspector edits through the scene node schema, and refuses what it refuses', () => {
  const brighter = step(
    { ...start, selected: ['light-1'] },
    Message.EditedNode({ key: 'light-1', path: ['intensity'], value: 20 }),
  );
  expect(brighter.nodes.find((node) => node.key === 'light-1')).toMatchObject({ intensity: 20 });
  const rough = step(
    start,
    Message.EditedNode({ key: 'crate-1', path: ['material', 'roughness'], value: 3 }),
  );
  expect(rough.nodes).toEqual(start.nodes);
  expect(rough.issue).toMatchObject({ _tag: 'Some' });
});

test('any step can be jumped to, and a change after an undo keeps the old branch', () => {
  const two = step(
    step(start, Message.ClickedAdd({ kind: 'box' })),
    Message.ClickedAdd({ kind: 'ring' }),
  );
  const back = step(two, Message.ClickedStep({ id: 0 }));
  expect(keys(back)).toEqual(keys(start));
  const branched = step(back, Message.ClickedAdd({ kind: 'ball' }));
  expect(branched.history.entries).toHaveLength(4);
  expect(keys(step(branched, Message.ClickedStep({ id: 2 })))).toContain('ring-1');
});

test('saving writes a scene file and marks the document saved; opening one replaces it', () => {
  const added = step(start, Message.ClickedAdd({ kind: 'box' }));
  const saving = update(added, Message.ClickedSave());
  expect(saving.model.saved).toEqual(added.nodes);
  expect(saving.commands?.map((command) => command.name)).toEqual(['DownloadFile']);
  const text = SceneFile.save(scene({ children: [added.nodes[0]!] }));
  const opened = step(start, Message.ReadFile({ text }));
  expect(keys(opened)).toEqual(['crate-1']);
  expect(opened.saved).toEqual(opened.nodes);
  const refused = step(start, Message.ReadFile({ text: '{ nope' }));
  expect(refused.nodes).toEqual(start.nodes);
  expect(refused.issue).toMatchObject({ _tag: 'Some' });
});

test('an assistant’s intents: place a thing, frame a shot, choose a mood', () => {
  const placed = step(start, Message.PlacedThing({ kind: 'ring', at: [2, 0.5, -1] }));
  expect(at(placed, 'ring-1')).toEqual([2, 0.5, -1]);
  expect(placed.selected).toEqual(['ring-1']);
  expect(History.presentEntry(placed.history).label).toBe('Placed ring-1');
  const framed = step(placed, Message.FramedShot({ subject: ['ring-1'], angle: 'front' }));
  expect(framed.camera.lookAt[0]).toBeCloseTo(2, 6);
  expect(framed.camera.position[2]).toBeGreaterThan(-1);
  // Nothing named that is in the scene: everything is framed.
  const all = step(placed, Message.FramedShot({ subject: ['nothing'], angle: 'top' }));
  expect(all.camera.position[1]).toBeGreaterThan(3);
  expect(step(start, Message.ChoseMood({ mood: 'sunset' })).mood).toBe('sunset');
});
