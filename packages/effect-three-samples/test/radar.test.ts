import { describe, expect, test } from 'bun:test';

import { createSceneGraph, previewSvg, type SceneNode } from '@opsydyn/effect-three';
import { Option } from 'effect';

import { categoryIds, ringIds } from '../src/radar/data';
import { sectorStarts } from '../src/radar/layout';
import { Message } from '../src/radar/message';
import {
  blipKey,
  homeCamera,
  idOfBlip,
  type Model,
  positionsOf,
  visibleOf,
} from '../src/radar/model';
import { sceneFor } from '../src/radar/scene';
import { blipPosition, onSphere, shellRadius } from '../src/radar/space';
import { init, update } from '../src/radar/update';

const start = init().model;
const step = (model: Model, message: Message): Model => update(model, message).model;
const steps = (model: Model, messages: ReadonlyArray<Message>): Model =>
  messages.reduce(step, model);

const firstId = (model: Model): string => positionsOf(model)[0]?.entry.id ?? 'missing';

type GroupNode = Extract<SceneNode, { readonly _tag: 'Group' }>;
const isGroup = (node: SceneNode): node is GroupNode => node._tag === 'Group';

/** A blip: a group keyed by its entry, holding its forms near to far. */
const blipOf = (model: Model, id: string): GroupNode | undefined =>
  sceneFor(model)
    .children.filter(isGroup)
    .find((node) => node.key === blipKey(id));

/** The material of a blip's body, as it shows up close. */
const materialId = (blip: GroupNode | undefined): string | undefined => {
  const near = blip?.children.find((node) => node.key === `${blip.key}:near`);
  const body =
    near?._tag === 'Group'
      ? near.children.find((node) => node.key === `${blip?.key}:near:body`)
      : undefined;
  return body?._tag === 'Mesh' && body.material._tag === 'SharedMaterial'
    ? body.material.id
    : undefined;
};

describe('radar space', () => {
  test('every blip lies on its ring’s shell', () => {
    for (const position of positionsOf(start)) {
      expect(Math.hypot(...blipPosition(position))).toBeCloseTo(
        shellRadius(position.entry.ring),
        12,
      );
    }
  });

  test('each category’s blips stay inside its own quarter of longitude', () => {
    for (const position of positionsOf(start)) {
      const [x, , z] = blipPosition(position);
      const longitude = (Math.atan2(x, z) * 180) / Math.PI;
      const start = sectorStarts[position.entry.category];
      const offset = (((longitude - start) % 360) + 360) % 360;
      expect(offset).toBeGreaterThan(0);
      expect(offset).toBeLessThan(90);
    }
  });

  test('longitude 0 faces the home camera, positive longitudes to its right, latitude up', () => {
    expect(onSphere(0, 0, 2)[2]).toBeCloseTo(2, 12);
    expect(onSphere(90, 0, 2)[0]).toBeCloseTo(2, 12);
    expect(onSphere(0, 90, 2)[1]).toBeCloseTo(2, 12);
  });
});

describe('radar update', () => {
  test('blip keys round-trip, and other keys are not blips', () => {
    expect(idOfBlip(blipKey('effect'))).toEqual(Option.some('effect'));
    expect(Option.isNone(idOfBlip('shell:adopt'))).toBe(true);
  });

  test('a click pins a blip, a second click or a miss unpins it', () => {
    const key = blipKey(firstId(start));
    const pinned = step(start, Message.ClickedBlip({ key }));
    expect(pinned.selected).toEqual(Option.some(firstId(start)));
    expect(Option.isNone(step(pinned, Message.ClickedBlip({ key })).selected)).toBe(true);
    expect(Option.isNone(step(pinned, Message.ClickedEmptySpace()).selected)).toBe(true);
  });

  test('filters intersect, and drop a hover or a pin they hide', () => {
    const id = firstId(start);
    const entry = positionsOf(start)[0]?.entry;
    const other = categoryIds.find((category) => category !== entry?.category) ?? 'tools';
    const focused = steps(start, [
      Message.ClickedBlip({ key: blipKey(id) }),
      Message.HoveredBlip({ key: blipKey(id) }),
    ]);
    const hidden = step(focused, Message.ChangedCategory({ category: other }));
    expect(visibleOf(hidden).every((position) => position.entry.category === other)).toBe(true);
    expect(Option.isNone(hidden.selected)).toBe(true);
    expect(Option.isNone(hidden.hovered)).toBe(true);
    const noRings = steps(
      start,
      ringIds.map((ring) => Message.ClickedRing({ ring })),
    );
    expect(visibleOf(noRings)).toEqual([]);
    expect(visibleOf(step(noRings, Message.ClickedClearFilters()))).toHaveLength(32);
  });

  test('hidden blips cannot be hovered or pinned', () => {
    const hidden = step(start, Message.ChangedQuery({ query: 'no entry says this' }));
    const key = blipKey(firstId(start));
    expect(step(hidden, Message.ClickedBlip({ key }))).toBe(hidden);
    expect(step(hidden, Message.HoveredBlip({ key }))).toBe(hidden);
    expect(step(hidden, Message.ClickedEntry({ id: firstId(start) }))).toBe(hidden);
  });

  test('choosing a list entry pins it and turns the camera to face it', () => {
    const id = firstId(start);
    const longitude = positionsOf(start)[0]?.longitude ?? Number.NaN;
    const chosen = step(start, Message.ClickedEntry({ id }));
    expect(chosen.selected).toEqual(Option.some(id));
    const [x, , z] = chosen.camera.position;
    expect((Math.atan2(x, z) * 180) / Math.PI).toBeCloseTo(longitude, 9);
  });

  test('turning keeps the camera’s height and distance; reset goes home', () => {
    const left = step(start, Message.ClickedTurn({ direction: 'left' }));
    const distance = (model: Model) => Math.hypot(...model.camera.position);
    expect(left.camera.position[1]).toBeCloseTo(homeCamera.position[1], 12);
    expect(distance(left)).toBeCloseTo(distance(start), 12);
    expect(left.camera.position[0]).toBeGreaterThan(0);
    const back = step(left, Message.ClickedTurn({ direction: 'right' }));
    back.camera.position.forEach((value, axis) =>
      expect(value).toBeCloseTo(homeCamera.position[axis] ?? Number.NaN, 12),
    );
    expect(step(left, Message.ClickedResetView()).camera).toEqual(homeCamera);
  });

  test('a drag orbits, unless it began on a blip', () => {
    const drag = {
      _tag: 'Drag' as const,
      button: 0,
      modifiers: { shift: false, control: false, meta: false, alt: false },
      width: 800,
      height: 400,
      x: 400,
      y: 200,
      deltaX: 40,
      deltaY: 0,
    };
    const orbited = step(start, Message.MadeGesture({ gesture: drag }));
    expect(orbited.camera.position).not.toEqual(start.camera.position);
    expect(orbited.camera.lookAt).toEqual([0, 0, 0]);
    const onBlip = step(
      start,
      Message.MadeGesture({ gesture: { ...drag, key: blipKey(firstId(start)) } }),
    );
    expect(onBlip.camera).toEqual(start.camera);
  });
});

describe('radar scene', () => {
  test('one blip per entry, keyed by its id; filtered blips flatten and turn inert', () => {
    const blips = sceneFor(start).children.filter((node) => idOfBlip(node.key)._tag === 'Some');
    expect(blips.map((node) => node.key).sort()).toEqual(
      positionsOf(start)
        .map(({ entry }) => blipKey(entry.id))
        .sort(),
    );
    const id = firstId(start);
    const hidden = step(
      start,
      Message.ClickedRing({ ring: positionsOf(start)[0]?.entry.ring ?? 'adopt' }),
    );
    expect(blipOf(hidden, id)?.interactive).toBe(false);
    expect(blipOf(hidden, id)?.scale[0]).toBeLessThan(0.01);
    expect(blipOf(start, id)?.interactive).toBe(true);
  });

  test('the hovered or pinned blip takes its category’s lit material and a name label', () => {
    const id = firstId(start);
    const category = positionsOf(start)[0]?.entry.category;
    expect(materialId(blipOf(start, id))).toBe(`body:${category}`);
    const pinned = step(start, Message.ClickedBlip({ key: blipKey(id) }));
    expect(materialId(blipOf(pinned, id))).toBe(`body:${category}:lit`);
    expect(blipOf(pinned, id)?.scale[0]).toBeGreaterThan(1);
    const label = sceneFor(pinned).children.find((node) => node.key === 'label:focus');
    expect(label?._tag === 'Label' ? label.text : undefined).toBe(
      positionsOf(start)[0]?.entry.name,
    );
  });

  test('the scene reconciles in a real graph, before and after a change', () => {
    const graph = createSceneGraph();
    expect(graph.reconcile(sceneFor(start))._tag).toBe('Applied');
    const pinned = step(start, Message.ClickedBlip({ key: blipKey(firstId(start)) }));
    expect(graph.reconcile(sceneFor(pinned))._tag).toBe('Applied');
    graph.dispose();
  });

  test('a still draws without a browser', () => {
    const still = previewSvg(sceneFor(start), { width: 320, height: 240 });
    expect(still._tag).toBe('Preview');
  });
});
